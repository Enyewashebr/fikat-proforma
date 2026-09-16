import { Fragment, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, Trash2, CheckCircle2, Download, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { api, downloadFile } from "../api/client";
import { Customer, Material, OptimizationResult, Price, Proforma, PricingMode } from "../types/domain";
import { Badge } from "../components/ui";
import { formatSize } from "../data/graniteCatalog";

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const THREAD_STANDARD_WIDTH_CM = 34;

export default function NewProforma() {
  const { id } = useParams(); // undefined until the draft is created
  const navigate = useNavigate();

  const [proforma, setProforma] = useState<Proforma | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [customerId, setCustomerId] = useState("");

  // Draft row (not yet added to the table)
  const [category, setCategory] = useState<"GRANITE" | "CERAMIC">("GRANITE");
  const [materialId, setMaterialId] = useState("");
  const [productTypeId, setProductTypeId] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [thickness, setThickness] = useState("0.03");
  const [quantity, setQuantity] = useState("1");
  const [pricePerM2, setPricePerM2] = useState("");
  const [priceWasAutoFilled, setPriceWasAutoFilled] = useState(false);
  // Ceramic (AREA_TOTAL) only
  const [ceramicSizeId, setCeramicSizeId] = useState("");
  const [requestedAreaM2, setRequestedAreaM2] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Cutting charge — a flat fee added above Subtotal/VAT, editable while draft.
  const [cuttingChargeInput, setCuttingChargeInput] = useState("");
  const [cuttingChargeSaving, setCuttingChargeSaving] = useState(false);

  // Stock plan preview (explains what the optimizer will use at finalize —
  // never mutates inventory, just fetches a preview from the backend).
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [plans, setPlans] = useState<Record<string, OptimizationResult>>({});
  const [planLoading, setPlanLoading] = useState<string | null>(null);

  useEffect(() => {
    api.get<Customer[]>("/customers").then(setCustomers);
    api.get<Material[]>("/materials").then(setMaterials);
    api.get<Price[]>("/materials/prices").then(setPrices);
  }, []);

  useEffect(() => {
    if (id) api.get<Proforma>(`/proformas/${id}`).then(setProforma);
  }, [id]);

  useEffect(() => {
    if (proforma) setCuttingChargeInput(String(proforma.cuttingCharge ?? 0));
  }, [proforma?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isEditable = !proforma || proforma.status === "DRAFT" || proforma.status === "REVIEW";
  const materialsInCategory = materials.filter((m) => m.category === category);
  const selectedMaterial = materialsInCategory.find((m) => m.id === materialId);
  const selectedProductType = selectedMaterial?.productTypes.find((pt) => pt.id === productTypeId);
  const isThreadRiser = category === "GRANITE" && selectedProductType?.name === "Thread & Riser";

  // Ceramic is priced/ordered by total area, not a cut length+width; Thread &
  // Riser is priced per set regardless of area; everything else keeps the
  // original per-piece-by-area calculation. See proformaCalculator.ts.
  const pricingMode: PricingMode = category === "CERAMIC" ? "AREA_TOTAL" : isThreadRiser ? "PIECE" : "AREA_PER_PIECE";

  const selectedCeramicSize = selectedMaterial?.stockSizes.find((s) => s.id === ceramicSizeId);

  // Category is the first choice and it fully resets everything below it —
  // Granite's material/application selection must never leak into a Ceramic row.
  function handleCategoryChange(next: "GRANITE" | "CERAMIC") {
    setCategory(next);
    resetSelection();
  }

  function resetSelection() {
    setMaterialId("");
    setProductTypeId("");
    setLength("");
    setWidth("");
    setCeramicSizeId("");
    setRequestedAreaM2("");
    setPricePerM2("");
    setPriceWasAutoFilled(false);
  }

  // Whenever material/application changes, remember-and-prefill whatever
  // price was last used for that exact combination — the user should never
  // have to retype the same fixed price on every row (spec: "don't make the
  // user enter the fixed price every row").
  useEffect(() => {
    if (!materialId) return;
    const remembered = prices.find(
      (p) => p.materialId === materialId && p.productTypeId === (productTypeId || null)
    );
    if (remembered) {
      setPricePerM2(String(remembered.pricePerM2));
      setPriceWasAutoFilled(true);
    } else {
      setPricePerM2("");
      setPriceWasAutoFilled(false);
    }
    if (isThreadRiser) setWidth(String(THREAD_STANDARD_WIDTH_CM / 100));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId, productTypeId]);

  async function ensureDraft(): Promise<string> {
    if (proforma) return proforma.id;
    if (!customerId) throw new Error("Choose a customer first.");
    const created = await api.post<Proforma>("/proformas", { customerId });
    setProforma(created);
    navigate(`/proformas/${created.id}`, { replace: true });
    return created.id;
  }

  const itemLabel = selectedProductType?.name ?? selectedMaterial?.name ?? "Item";

  async function addItem() {
    setError(null);
    if (!materialId) return setError("Choose a material.");

    const payload: Record<string, unknown> = {
      materialId,
      productTypeId: productTypeId || null,
      itemLabel,
      pricingMode,
      pricePerM2: pricePerM2 ? parseFloat(pricePerM2) : undefined,
    };

    if (pricingMode === "AREA_TOTAL") {
      if (!ceramicSizeId) return setError("Choose which stock size this tile order uses.");
      if (!requestedAreaM2) return setError("Enter the total area needed (m²).");
      payload.customerLengthCm = selectedCeramicSize!.lengthCm;
      payload.customerWidthCm = selectedCeramicSize!.widthCm;
      payload.thickness = selectedCeramicSize!.thickness;
      payload.unit = "m2";
      payload.requestedAreaM2 = parseFloat(requestedAreaM2);
    } else {
      if (!length) return setError("Enter the length.");
      if (pricingMode === "AREA_PER_PIECE" && !width) return setError("Enter the width.");
      if (!quantity) return setError("Enter a quantity.");
      payload.customerLengthCm = parseFloat(length) * 100;
      payload.customerWidthCm = parseFloat(width || (isThreadRiser ? String(THREAD_STANDARD_WIDTH_CM / 100) : "0")) * 100;
      payload.thickness = parseFloat(thickness || "0");
      payload.unit = pricingMode === "PIECE" ? "pcs" : "pcs";
      payload.quantity = parseInt(quantity, 10);
    }

    setBusy(true);
    try {
      const proformaId = await ensureDraft();
      await api.post(`/proformas/${proformaId}/items`, payload);
      const [refreshed, refreshedPrices] = await Promise.all([
        api.get<Proforma>(`/proformas/${proformaId}`),
        api.get<Price[]>("/materials/prices"),
      ]);
      setProforma(refreshed);
      setPrices(refreshedPrices);
      // Clear the entry row so the user can keep adding — nothing here finalizes anything.
      // Material/application/price stay selected since the next row is often the same one.
      setLength("");
      if (!isThreadRiser) setWidth("");
      setQuantity("1");
      setRequestedAreaM2("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add item.");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(itemId: string) {
    if (!proforma) return;
    await api.delete(`/proformas/${proforma.id}/items/${itemId}`);
    const refreshed = await api.get<Proforma>(`/proformas/${proforma.id}`);
    setProforma(refreshed);
  }

  async function saveCuttingCharge() {
    if (!proforma) return;
    setCuttingChargeSaving(true);
    setError(null);
    try {
      const updated = await api.put<Proforma>(`/proformas/${proforma.id}/cutting-charge`, {
        cuttingCharge: parseFloat(cuttingChargeInput || "0"),
      });
      setProforma(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the cutting charge.");
    } finally {
      setCuttingChargeSaving(false);
    }
  }

  async function toggleStockPlan(itemId: string) {
    if (expandedItemId === itemId) {
      setExpandedItemId(null);
      return;
    }
    setExpandedItemId(itemId);
    if (!plans[itemId]) {
      setPlanLoading(itemId);
      try {
        const result = await api.get<OptimizationResult>(`/proformas/items/${itemId}/preview-stock`);
        setPlans((prev) => ({ ...prev, [itemId]: result }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load the stock plan.");
      } finally {
        setPlanLoading(null);
      }
    }
  }

  async function handleFinalize() {
    if (!proforma) return;
    setError(null);
    setBusy(true);
    try {
      const finalized = await api.post<Proforma>(`/proformas/${proforma.id}/finalize`);
      const refreshed = await api.get<Proforma>(`/proformas/${finalized.id}`);
      setProforma(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't finalize this proforma.");
    } finally {
      setBusy(false);
    }
  }

  // Reopens a finalized proforma back to DRAFT so it can be edited again —
  // releases the stock it had allocated back to available inventory.
  async function handleReopen() {
    if (!proforma) return;
    setError(null);
    setBusy(true);
    try {
      const reopened = await api.post<Proforma>(`/proformas/${proforma.id}/reopen`);
      const refreshed = await api.get<Proforma>(`/proformas/${reopened.id}`);
      setProforma(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reopen this proforma for editing.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadPdf() {
    if (!proforma) return;
    setError(null);
    try {
      await downloadFile(`/proformas/${proforma.id}/pdf`, `${proforma.number || "proforma-draft"}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't download the PDF.");
    }
  }

  const items = proforma?.items ?? [];
  const widthCm = parseFloat(width || "0") * 100;
  const showKitchenTopWarning = isThreadRiser && widthCm > THREAD_STANDARD_WIDTH_CM;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-quarry-900">{proforma?.number ?? "New proforma"}</h1>
          <p className="text-sm text-quarry-500">
            Add every row the customer needs — nothing is final until you say so.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {proforma && <StatusBadge status={proforma.status} />}
          {proforma && items.length > 0 && (
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 rounded-md border border-quarry-300 bg-white px-3 py-1.5 text-sm font-medium text-quarry-700 hover:bg-quarry-100"
            >
              <Download size={15} />
              Download / print PDF
            </button>
          )}
          {proforma && proforma.status === "FINALIZED" && (
            <button
              onClick={handleReopen}
              disabled={busy}
              className="flex items-center gap-2 rounded-md border border-quarry-300 bg-white px-3 py-1.5 text-sm font-medium text-quarry-700 hover:bg-quarry-100 disabled:opacity-50"
            >
              <Pencil size={15} />
              Edit proforma
            </button>
          )}
        </div>
      </div>

      {!proforma && (
        <div className="mb-5 max-w-sm">
          <label className="mb-1 block text-sm text-quarry-600">Customer</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full rounded-md border border-quarry-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {isEditable && (
        <div className="mb-4 rounded-lg border border-quarry-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-6">
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as "GRANITE" | "CERAMIC")}
              className="rounded-md border border-quarry-300 px-3 py-2 text-sm"
            >
              <option value="GRANITE">Granite</option>
              <option value="CERAMIC">Ceramic</option>
            </select>

            <select
              value={materialId}
              onChange={(e) => {
                setMaterialId(e.target.value);
                setProductTypeId("");
                setCeramicSizeId("");
              }}
              className="rounded-md border border-quarry-300 px-3 py-2 text-sm"
            >
              <option value="">{category === "GRANITE" ? "Material…" : "Product…"}</option>
              {materialsInCategory.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            {category === "GRANITE" && selectedMaterial && selectedMaterial.productTypes.length > 0 && (
              <select
                value={productTypeId}
                onChange={(e) => setProductTypeId(e.target.value)}
                className="rounded-md border border-quarry-300 px-3 py-2 text-sm"
              >
                <option value="">Application…</option>
                {selectedMaterial.productTypes.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.name}
                  </option>
                ))}
              </select>
            )}

            {pricingMode === "AREA_TOTAL" ? (
              <>
                <select
                  value={ceramicSizeId}
                  onChange={(e) => setCeramicSizeId(e.target.value)}
                  className="rounded-md border border-quarry-300 px-3 py-2 text-sm md:col-span-2"
                >
                  <option value="">Stock size…</option>
                  {(selectedMaterial?.stockSizes ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatSize(s)} — {s.quantityAvailable} in stock
                    </option>
                  ))}
                </select>
                <input
                  value={requestedAreaM2}
                  onChange={(e) => setRequestedAreaM2(e.target.value)}
                  placeholder="Total area needed (m²)"
                  type="number"
                  step="0.01"
                  className="rounded-md border border-quarry-300 px-3 py-2 text-sm"
                />
              </>
            ) : (
              <>
                <input
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  placeholder={isThreadRiser ? "Set length (m)" : "Length (m)"}
                  type="number"
                  step="0.01"
                  className="rounded-md border border-quarry-300 px-3 py-2 text-sm"
                />
                {pricingMode === "AREA_PER_PIECE" && (
                  <input
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    placeholder="Width (m)"
                    type="number"
                    step="0.01"
                    className="rounded-md border border-quarry-300 px-3 py-2 text-sm"
                  />
                )}
                {isThreadRiser && (
                  <input
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    placeholder="Thread width (m)"
                    type="number"
                    step="0.01"
                    title={`Standard is ${THREAD_STANDARD_WIDTH_CM / 100} m — only change this for a non-standard order`}
                    className="rounded-md border border-quarry-300 px-3 py-2 text-sm"
                  />
                )}
                <input
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder={isThreadRiser ? "Qty (pieces)" : "Qty"}
                  type="number"
                  min="1"
                  className="rounded-md border border-quarry-300 px-3 py-2 text-sm"
                />
              </>
            )}

            {pricingMode !== "PIECE" && (
              <input
                value={pricePerM2}
                onChange={(e) => {
                  setPricePerM2(e.target.value);
                  setPriceWasAutoFilled(false);
                }}
                placeholder="Price / m²"
                type="number"
                step="0.01"
                title={
                  priceWasAutoFilled
                    ? "Filled in from the last price used for this material/application — edit to change it"
                    : "Leave blank to use the material's configured price"
                }
                className={`rounded-md border px-3 py-2 text-sm md:col-span-2 ${
                  priceWasAutoFilled ? "border-moss-300 bg-moss-50" : "border-quarry-300"
                }`}
              />
            )}
          </div>

          {pricingMode === "PIECE" && (
            <div className="mt-2 text-xs text-quarry-500">
              Price is fetched automatically from the stock size(s) needed for this length — see "Stock plan" on the
              row after adding it. If the exact length isn't in stock, the next size up is used and priced at its own
              rate; if the length has to be assembled from several pieces, their prices are added together.
            </div>
          )}

          {showKitchenTopWarning && (
            <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Thread & Riser stock only goes up to {THREAD_STANDARD_WIDTH_CM}cm wide. For a {width}m width, cut this
              from a Kitchen Top slab instead (e.g. a 260×63 slab into one {length || "…"}×{width} thread piece + one
              riser) — add this row under <strong>Kitchen Top</strong> and price it at the Kitchen Top rate, since
              that's the material actually being used.
            </div>
          )}

          {priceWasAutoFilled && pricingMode !== "PIECE" && (
            <div className="mt-2 text-xs text-quarry-500">
              Using the price already set for this material/application — change it above if this order is different.
            </div>
          )}

          <button
            onClick={addItem}
            disabled={busy}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-moss-600 px-4 py-2 text-sm font-semibold text-white hover:bg-moss-700 disabled:opacity-50"
          >
            <Plus size={16} />
            Add item to proforma
          </button>
        </div>
      )}

      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

      <div className="overflow-x-auto rounded-lg border border-quarry-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-quarry-200 bg-quarry-50 text-left text-quarry-500">
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Length / Area</th>
              <th className="px-3 py-2 text-right font-medium">Width</th>
              <th className="px-3 py-2 text-right font-medium">Thick</th>
              <th className="px-3 py-2 font-medium">Unit</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Unit price</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="px-3 py-2" />
              {isEditable && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-quarry-400">
                  No items yet — add the customer's first row above.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <Fragment key={item.id}>
                <tr className="border-b border-quarry-100 last:border-0">
                  <td className="px-3 py-2">{item.itemLabel}</td>
                  <td className="px-3 py-2 text-right">
                    {item.pricingMode === "AREA_TOTAL"
                      ? `${item.requestedAreaM2?.toFixed(2)} m²`
                      : (item.customerLengthCm / 100).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {item.pricingMode === "AREA_TOTAL" ? "—" : (item.customerWidthCm / 100).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right">{item.thickness}</td>
                  <td className="px-3 py-2">{item.pricingMode === "PIECE" ? "pc" : item.unit}</td>
                  <td className="px-3 py-2 text-right">{item.quantity}</td>
                  <td className="px-3 py-2 text-right">{money(item.unitPrice)}</td>
                  <td className="px-3 py-2 text-right font-medium">{money(item.totalPrice)}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => toggleStockPlan(item.id)}
                      className="flex items-center gap-1 text-xs text-quarry-500 hover:text-moss-700"
                      title="Preview which stock this will use"
                    >
                      {expandedItemId === item.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      Stock plan
                    </button>
                  </td>
                  {isEditable && (
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  )}
                </tr>
                {expandedItemId === item.id && (
                  <tr className="border-b border-quarry-100 bg-quarry-50">
                    <td colSpan={10} className="px-4 py-3">
                      {planLoading === item.id ? (
                        <div className="text-sm text-quarry-500">Calculating stock plan…</div>
                      ) : plans[item.id] ? (
                        <StockPlanPreview result={plans[item.id]} />
                      ) : (
                        <div className="text-sm text-quarry-500">No plan loaded yet.</div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          {proforma && (
            <tfoot>
              <tr>
                <td colSpan={isEditable ? 9 : 8} className="px-3 py-2 text-right font-medium">
                  Cutting charge
                </td>
                <td className="px-3 py-2 text-right">
                  {isEditable ? (
                    <div className="flex items-center justify-end gap-2">
                      <input
                        value={cuttingChargeInput}
                        onChange={(e) => setCuttingChargeInput(e.target.value)}
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-28 rounded-md border border-quarry-300 px-2 py-1 text-right text-sm"
                      />
                      <button
                        onClick={saveCuttingCharge}
                        disabled={cuttingChargeSaving}
                        className="rounded-md border border-quarry-300 px-2 py-1 text-xs font-medium text-quarry-700 hover:bg-quarry-100 disabled:opacity-50"
                      >
                        Set
                      </button>
                    </div>
                  ) : (
                    money(proforma.cuttingCharge)
                  )}
                </td>
              </tr>
              <TotalRow label="Subtotal" value={proforma.subtotal} span={isEditable ? 9 : 8} />
              <TotalRow
                label={`VAT ${(proforma.vatRate * 100).toFixed(0)}%`}
                value={proforma.vatAmount}
                span={isEditable ? 9 : 8}
              />
              <TotalRow label="Total with VAT" value={proforma.grandTotal} bold span={isEditable ? 9 : 8} />
            </tfoot>
          )}
        </table>
      </div>

      {isEditable && items.length > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleFinalize}
            disabled={busy}
            className="flex items-center gap-2 rounded-md bg-quarry-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-quarry-800 disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
            Finalize proforma
          </button>
        </div>
      )}
    </div>
  );
}

function TotalRow({ label, value, span, bold }: { label: string; value: number; span: number; bold?: boolean }) {
  return (
    <tr>
      <td colSpan={span} className={`px-3 py-2 text-right ${bold ? "font-bold" : "font-medium"}`}>
        {label}
      </td>
      <td className={`px-3 py-2 text-right ${bold ? "font-bold" : "font-medium"}`}>{money(value)}</td>
    </tr>
  );
}

function StatusBadge({ status }: { status: Proforma["status"] }) {
  if (status === "FINALIZED") return <Badge tone="ok">Finalized</Badge>;
  if (status === "CANCELLED") return <Badge tone="danger">Cancelled</Badge>;
  return <Badge tone="warn">Draft — still editable</Badge>;
}

/**
 * Explains the optimizer's plan for one item: which stock sizes it will use,
 * how many customer pieces each contributes, and the waste involved. CUT
 * mode shows pieces cut per stock size; ASSEMBLE mode shows the whole-piece
 * combination joined end to end for one long customer piece. This is a
 * preview only — nothing here changes inventory (that happens at finalize).
 */
function StockPlanPreview({ result }: { result: OptimizationResult }) {
  const cm = (n: number) => `${(n / 100).toFixed(2)} m`;

  if (!result.feasible) {
    return (
      <div className="text-sm text-red-700">
        Insufficient stock: requested {result.shortfall?.requestedPieces}, can currently produce{" "}
        {result.shortfall?.producedPieces}
        {result.combination.length > 0 && " with the stock shown below"} — short by{" "}
        {result.shortfall?.shortagePieces} piece(s).
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-quarry-500">
        {result.mode === "CUT"
          ? "Cutting plan — one or more customer pieces cut from each stock piece"
          : "Assembled plan — whole stock pieces joined end to end for one long piece"}
      </div>
      <table className="w-full max-w-xl text-xs">
        <thead>
          <tr className="text-left text-quarry-400">
            <th className="pb-1 font-medium">Stock size</th>
            <th className="pb-1 text-right font-medium">Stock used</th>
            <th className="pb-1 text-right font-medium">
              {result.mode === "CUT" ? "Pieces produced" : "Units covered"}
            </th>
            {result.mode === "CUT" && <th className="pb-1 text-right font-medium">Waste</th>}
          </tr>
        </thead>
        <tbody>
          {result.combination.map((c) => (
            <tr key={c.stockSizeId} className="border-t border-quarry-200">
              <td className="py-1 text-quarry-700">{c.stockSizeLabel}</td>
              <td className="py-1 text-right">{c.stockPiecesUsed}</td>
              <td className="py-1 text-right">{c.customerPiecesProduced}</td>
              {result.mode === "CUT" && <td className="py-1 text-right">{cm(c.wasteLengthCm)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 text-xs text-quarry-500">
        Total: {result.totalCustomerPiecesProduced} of {result.totalCustomerPiecesRequested} piece(s) requested,{" "}
        {result.totalStockPiecesUsed} stock piece(s) used, {cm(result.totalWasteLengthCm)} total waste.
      </div>
    </div>
  );
}
