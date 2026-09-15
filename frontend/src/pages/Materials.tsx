import { useEffect, useMemo, useState, FormEvent } from "react";
import { PackagePlus, X, Plus, Minus, Save, Search, ChevronDown, ChevronRight } from "lucide-react";
import { api } from "../api/client";
import { Material, Price, StockSize } from "../types/domain";
import {
  GRANITE_MATERIAL_SUGGESTIONS,
  CERAMIC_MATERIAL_SUGGESTIONS,
  GRANITE_PRODUCT_TYPES,
  getStandardSizesForProductType,
  getStandardCeramicSizes,
  formatSize,
  StandardSize,
} from "../data/graniteCatalog";
import { Badge } from "../components/ui";

type Category = "GRANITE" | "CERAMIC";
const CUSTOM = "__custom__";

export default function Materials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [showModal, setShowModal] = useState(false);

  function load() {
    api.get<Material[]>("/materials").then(setMaterials);
    api.get<Price[]>("/materials/prices").then(setPrices);
  }
  useEffect(load, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-quarry-900">Materials</h1>
          <p className="text-sm text-quarry-500">
            The granite and ceramic catalog used across stock and proformas.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-moss-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-moss-700"
        >
          <PackagePlus size={17} />
          Add material to store
        </button>
      </div>

      <StockList materials={materials} prices={prices} onChanged={load} />

      {showModal && <AddMaterialModal materials={materials} onClose={() => setShowModal(false)} onAdded={load} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Material modal — adapted to call the real API instead of local state.
// ---------------------------------------------------------------------------

function AddMaterialModal({
  materials,
  onClose,
  onAdded,
}: {
  materials: Material[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [category, setCategory] = useState<Category>("GRANITE");

  const [material, setMaterial] = useState("");
  const [customMaterial, setCustomMaterial] = useState("");
  const [application, setApplication] = useState("");
  const [customApplication, setCustomApplication] = useState("");

  const [sizePreset, setSizePreset] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [thickness, setThickness] = useState("");
  // Thread & Riser only — the riser piece sold as part of the same set.
  const [riserWidth, setRiserWidth] = useState("");
  const [riserThickness, setRiserThickness] = useState("");

  const [quantity, setQuantity] = useState(1);
  const [pricePerM2, setPricePerM2] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const materialSuggestions = category === "GRANITE" ? GRANITE_MATERIAL_SUGGESTIONS : CERAMIC_MATERIAL_SUGGESTIONS;
  const existingNames = new Set(materials.filter((m) => m.category === category).map((m) => m.name));
  const materialOptions = materialSuggestions.filter((s) => !existingNames.has(s));
  const existingMaterial = materials.find((m) => m.category === category && m.name === material);

  const isThreadRiser = category === "GRANITE" && application === "Thread & Riser";

  const standardSizes: StandardSize[] = useMemo(() => {
    if (category === "CERAMIC") return getStandardCeramicSizes();
    if (application && application !== CUSTOM) return getStandardSizesForProductType(application);
    return [];
  }, [category, application]);

  function resetDependentFields(newCategory: Category) {
    setCategory(newCategory);
    setMaterial("");
    setCustomMaterial("");
    setApplication("");
    setCustomApplication("");
    setSizePreset("");
    setLength("");
    setWidth("");
    setThickness("");
    setRiserWidth("");
    setRiserThickness("");
  }

  function applySizePreset(value: string) {
    setSizePreset(value);
    if (value && value !== CUSTOM) {
      const size = JSON.parse(value) as StandardSize;
      setLength(String(size.lengthCm));
      setWidth(String(size.widthCm));
      setThickness(String(size.thickness));
      if (size.secondaryWidthCm != null) setRiserWidth(String(size.secondaryWidthCm));
      if (size.secondaryThickness != null) setRiserThickness(String(size.secondaryThickness));
    }
  }

  function handleQuantityChange(amount: number) {
    setQuantity((current) => Math.max(1, current + amount));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const finalMaterialName = material === CUSTOM ? customMaterial.trim() : material;
    const finalApplication = application === CUSTOM ? customApplication.trim() : application;

    if (!finalMaterialName) return setError("Please select or type a material.");
    if (category === "GRANITE" && !finalApplication) return setError("Please select or type an application.");
    if (!length || !width || !thickness) return setError("Please enter the stock dimensions.");
    if (isThreadRiser && (!riserWidth || !riserThickness)) {
      return setError("Thread & Riser is sold as a set — enter the riser width and thickness too.");
    }

    setBusy(true);
    try {
      // 1. Ensure the material exists (reuse it if already in the catalog).
      let materialId = existingMaterial?.id;
      if (!materialId) {
        const created = await api.post<Material>("/materials", { category, name: finalMaterialName });
        materialId = created.id;
      }

      // 2. Granite only: ensure the application (product type) exists.
      let productTypeId: string | null = null;
      if (category === "GRANITE") {
        const currentMaterial = materials.find((m) => m.id === materialId);
        const existingType = currentMaterial?.productTypes.find((pt) => pt.name === finalApplication);
        if (existingType) {
          productTypeId = existingType.id;
        } else {
          const createdType = await api.post<{ id: string }>(`/materials/${materialId}/product-types`, {
            name: finalApplication,
          });
          productTypeId = createdType.id;
        }
      }

      // 3. Create the stock size itself.
      await api.post(`/materials/${materialId}/stock-sizes`, {
        productTypeId,
        lengthCm: Number(length),
        widthCm: Number(width),
        thickness: Number(thickness),
        secondaryWidthCm: isThreadRiser ? Number(riserWidth) : undefined,
        secondaryThickness: isThreadRiser ? Number(riserThickness) : undefined,
        quantityAvailable: quantity,
      });

      // 4. Optional: set/update the price for this material + application.
      if (pricePerM2) {
        await api.post("/materials/prices", {
          materialId,
          productTypeId,
          pricePerM2: Number(pricePerM2),
        });
      }

      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add this stock.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
              <PackagePlus className="h-6 w-6 text-slate-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Add Material to Store</h2>
              <p className="text-sm text-slate-500">Add new stock to your warehouse inventory</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 p-6">
            {/* Category */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Category</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => resetDependentFields("GRANITE")}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    category === "GRANITE"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  <div className="font-semibold">Granite</div>
                  <div className={`text-xs ${category === "GRANITE" ? "text-slate-300" : "text-slate-400"}`}>
                    Natural stone
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => resetDependentFields("CERAMIC")}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    category === "CERAMIC"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  <div className="font-semibold">Ceramic</div>
                  <div className={`text-xs ${category === "CERAMIC" ? "text-slate-300" : "text-slate-400"}`}>
                    Ceramic products
                  </div>
                </button>
              </div>
            </div>

            {/* Material / Product */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {category === "GRANITE" ? "Granite Material" : "Ceramic Product"}
              </label>
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              >
                <option value="">Select {category === "GRANITE" ? "material" : "product"}</option>
                {materials
                  .filter((m) => m.category === category)
                  .map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name} (existing)
                    </option>
                  ))}
                {materialOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
                <option value={CUSTOM}>+ Add new…</option>
              </select>
              {material === CUSTOM && (
                <input
                  value={customMaterial}
                  onChange={(e) => setCustomMaterial(e.target.value)}
                  placeholder="Type the new material name"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-600"
                />
              )}
            </div>

            {/* Granite Application */}
            {category === "GRANITE" && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Application / Item Type</label>
                <select
                  value={application}
                  onChange={(e) => {
                    setApplication(e.target.value);
                    setSizePreset("");
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                >
                  <option value="">Select application</option>
                  {GRANITE_PRODUCT_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                  <option value={CUSTOM}>+ Add new…</option>
                </select>
                {application === CUSTOM && (
                  <input
                    value={customApplication}
                    onChange={(e) => setCustomApplication(e.target.value)}
                    placeholder="Type the new application"
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-600"
                  />
                )}
                {isThreadRiser && (
                  <p className="mt-2 text-xs text-amber-700">
                    Sold as a set — enter the thread size below, then the riser size underneath it.
                  </p>
                )}
              </div>
            )}

            {/* Quick-fill from a standard size */}
            {standardSizes.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Quick fill from standard size</label>
                <select
                  value={sizePreset}
                  onChange={(e) => applySizePreset(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-600"
                >
                  <option value="">Choose a standard size (optional)…</option>
                  {standardSizes.map((s) => (
                    <option key={formatSize(s)} value={JSON.stringify(s)}>
                      {formatSize(s)}
                    </option>
                  ))}
                  <option value={CUSTOM}>+ Custom size…</option>
                </select>
              </div>
            )}

            {/* Stock Dimensions */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  {isThreadRiser ? "Thread Size" : "Stock Size"}
                </label>
                <span className="text-xs text-slate-400">Length × Width × Thickness (cm)</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <DimInput label="Length" value={length} onChange={setLength} placeholder="140" />
                <DimInput label="Width" value={width} onChange={setWidth} placeholder="34" />
                <DimInput label="Thickness" value={thickness} onChange={setThickness} placeholder="3" />
              </div>
            </div>

            {isThreadRiser && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Riser Size (same set)</label>
                  <span className="text-xs text-slate-400">Width × Thickness (cm)</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DimInput label="Width" value={riserWidth} onChange={setRiserWidth} placeholder="15" />
                  <DimInput label="Thickness" value={riserThickness} onChange={setRiserThickness} placeholder="2" />
                </div>
              </div>
            )}

            {/* Quantity */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Quantity Available {isThreadRiser ? "(sets)" : ""}
              </label>
              <div className="flex w-fit items-center overflow-hidden rounded-xl border border-slate-300">
                <button
                  type="button"
                  onClick={() => handleQuantityChange(-1)}
                  className="flex h-11 w-11 items-center justify-center text-slate-500 hover:bg-slate-100"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="h-11 w-20 border-x border-slate-300 text-center text-sm font-semibold outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleQuantityChange(1)}
                  className="flex h-11 w-11 items-center justify-center text-slate-500 hover:bg-slate-100"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Price */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Price {isThreadRiser ? "per set (optional)" : "per m² (optional)"}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={pricePerM2}
                onChange={(e) => setPricePerM2(e.target.value)}
                placeholder="Sets/updates the default price for this material + application"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-600"
              />
            </div>

            {/* Preview */}
            {material && length && width && thickness && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Stock Preview</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {material === CUSTOM ? customMaterial : material}
                    </div>
                    {category === "GRANITE" && application && (
                      <div className="text-sm text-slate-500">
                        {application === CUSTOM ? customApplication : application}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">
                      {length} × {width}
                      {isThreadRiser && riserWidth ? `/${riserWidth}` : ""} × {thickness}
                      {isThreadRiser && riserThickness ? `/${riserThickness}` : ""}
                    </div>
                    <div className="text-sm text-slate-500">
                      {quantity} {isThreadRiser ? "sets" : "pieces"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && <div className="text-sm text-red-600">{error}</div>}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {busy ? "Adding…" : "Add to Store"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DimInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-500">{label}</label>
      <input
        type="number"
        step="0.1"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-600"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stock list — everything added so far, grouped and expandable, with an
// inline quantity stepper (same adjust endpoint the dashboard uses).
// ---------------------------------------------------------------------------

function StockList({
  materials,
  prices,
  onChanged,
}: {
  materials: Material[];
  prices: Price[];
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function adjust(stockSizeId: string, delta: number) {
    await api.post(`/stock/${stockSizeId}/adjust`, {
      quantityDelta: delta,
      type: "ADJUSTMENT",
      reason: delta > 0 ? "Manual stock in" : "Manual stock out",
    });
    onChanged();
  }

  function priceFor(materialId: string, productTypeId: string | null): number | undefined {
    return prices.find((p) => p.materialId === materialId && p.productTypeId === productTypeId)?.pricePerM2;
  }

  const filtered = materials.filter((m) => (query.trim() ? m.name.toLowerCase().includes(query.toLowerCase()) : true));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-quarry-700">In the catalog</h2>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-quarry-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search material…"
            className="rounded-md border border-quarry-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-moss-600"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-quarry-300 py-10 text-center text-sm text-quarry-500">
          Nothing added yet — use "Add material to store" above.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((material) => (
            <div key={material.id} className="rounded-lg border border-quarry-200 bg-white">
              <button
                onClick={() => toggle(material.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  {expanded[material.id] ? (
                    <ChevronDown size={16} className="text-quarry-400" />
                  ) : (
                    <ChevronRight size={16} className="text-quarry-400" />
                  )}
                  <span className="font-medium text-quarry-900">{material.name}</span>
                  {material.code && <span className="text-xs text-quarry-400">({material.code})</span>}
                </div>
                <span className="text-xs text-quarry-400">
                  {material.category === "GRANITE"
                    ? `${material.productTypes.length} application(s)`
                    : `${material.stockSizes.length} size(s)`}
                </span>
              </button>

              {expanded[material.id] && (
                <div className="border-t border-quarry-100 px-4 pb-4">
                  {material.category === "GRANITE"
                    ? material.productTypes.map((pt) => (
                        <div key={pt.id} className="mt-3">
                          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-quarry-700">
                            {pt.name}
                            {priceFor(material.id, pt.id) != null && (
                              <Badge tone="ok">{priceFor(material.id, pt.id)!.toLocaleString()} / unit</Badge>
                            )}
                          </div>
                          <SizeRows sizes={pt.stockSizes} onAdjust={adjust} />
                        </div>
                      ))
                    : (
                        <div className="mt-3">
                          {priceFor(material.id, null) != null && (
                            <Badge tone="ok">{priceFor(material.id, null)!.toLocaleString()} / m²</Badge>
                          )}
                          <SizeRows sizes={material.stockSizes} onAdjust={adjust} />
                        </div>
                      )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SizeRows({ sizes, onAdjust }: { sizes: StockSize[]; onAdjust: (id: string, delta: number) => void }) {
  if (sizes.length === 0) return <div className="py-2 text-sm text-quarry-400">No sizes recorded yet.</div>;
  return (
    <table className="mt-1 w-full text-sm">
      <tbody>
        {sizes.map((s) => (
          <tr key={s.id} className="border-b border-quarry-100 last:border-0">
            <td className="py-2 text-quarry-600">{formatSize(s)}</td>
            <td className="py-2 text-right text-quarry-900">{s.quantityAvailable} in stock</td>
            <td className="w-24 py-2">
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => onAdjust(s.id, -1)}
                  disabled={s.quantityAvailable <= 0}
                  className="rounded border border-quarry-300 p-1 text-quarry-600 hover:bg-quarry-100 disabled:opacity-30"
                >
                  <Minus size={13} />
                </button>
                <button
                  onClick={() => onAdjust(s.id, 1)}
                  className="rounded border border-quarry-300 p-1 text-quarry-600 hover:bg-quarry-100"
                >
                  <Plus size={13} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
