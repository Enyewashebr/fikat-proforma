import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  PackageMinus,
  PackagePlus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { api } from "../api/client";
import {
  DashboardSummary,
  MaterialHierarchy,
  StockSize,
} from "../types/domain";
import { StatCard, Badge } from "../components/ui";

type Category = "GRANITE" | "CERAMIC";
type StockAction = "IN" | "OUT" | "ADJUST";

interface StockModalData {
  stock: StockSize;
  materialName: string;
  applicationName: string;
  action: StockAction;
}

export default function Dashboard() {
  const [category, setCategory] = useState<Category>("GRANITE");

  const [materials, setMaterials] = useState<MaterialHierarchy[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [expandedMaterials, setExpandedMaterials] = useState<
    Record<string, boolean>
  >({});

  const [expandedApplications, setExpandedApplications] = useState<
    Record<string, boolean>
  >({});

  const [stockModal, setStockModal] = useState<StockModalData | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadDashboard() {
    try {
      setLoading(true);

      const [hierarchy, summaryData] = await Promise.all([
        api.get<MaterialHierarchy[]>(
          `/stock/hierarchy?category=${category}`
        ),
        api.get<DashboardSummary>("/stock/summary"),
      ]);

      setMaterials(hierarchy);
      setSummary(summaryData);
    } catch (error) {
      console.error("Failed to load stock dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [category]);

  function toggleMaterial(materialId: string) {
    setExpandedMaterials((current) => ({
      ...current,
      [materialId]: !current[materialId],
    }));
  }

  function toggleApplication(applicationKey: string) {
    setExpandedApplications((current) => ({
      ...current,
      [applicationKey]: !current[applicationKey],
    }));
  }

  function openStockModal(
    stock: StockSize,
    materialName: string,
    applicationName: string,
    action: StockAction
  ) {
    setStockModal({
      stock,
      materialName,
      applicationName,
      action,
    });
  }

  function closeStockModal() {
    if (!saving) {
      setStockModal(null);
    }
  }
function updateStockQuantityLocally(
  stockSizeId: string,
  quantityDelta: number
) {
  setMaterials((currentMaterials) =>
    currentMaterials.map((material) => {
      if (material.category === "GRANITE") {
        return {
          ...material,
          productTypes: material.productTypes.map((productType) => ({
            ...productType,
            stockSizes: productType.stockSizes.map((size) =>
              size.id === stockSizeId
                ? {
                    ...size,
                    quantityAvailable:
                      size.quantityAvailable + quantityDelta,
                    status: getStockStatus(
                      size.quantityAvailable + quantityDelta,
                      size.lowStockThreshold
                    ),
                  }
                : size
            ),
          })),
        };
      }

      return {
        ...material,
        stockSizes: material.stockSizes.map((size) =>
          size.id === stockSizeId
            ? {
                ...size,
                quantityAvailable:
                  size.quantityAvailable + quantityDelta,
                status: getStockStatus(
                  size.quantityAvailable + quantityDelta,
                  size.lowStockThreshold
                ),
              }
            : size
        ),
      };
    })
  );
}
  async function handleStockChange(
  stockSizeId: string,
  quantity: number,
  action: StockAction,
  reason: string
) {
  if (quantity === 0 || !Number.isFinite(quantity)) {
    return;
  }

  let quantityDelta: number;

  if (action === "IN") {
    quantityDelta = Math.abs(quantity);
  } else if (action === "OUT") {
    quantityDelta = -Math.abs(quantity);
  } else {
    quantityDelta = quantity;
  }

  try {
    setSaving(true);

    await api.post(`/stock/${stockSizeId}/adjust`, {
      quantityDelta,
      type: "ADJUSTMENT",
      reason,
    });

    // Update only the affected row.
    updateStockQuantityLocally(stockSizeId, quantityDelta);

    // Update summary numbers without reloading the entire dashboard.
    setSummary((currentSummary) => {
      if (!currentSummary) {
        return currentSummary;
      }

      const previousQuantity = materials
        .flatMap((material) =>
          material.category === "GRANITE"
            ? material.productTypes.flatMap(
                (productType) => productType.stockSizes
              )
            : material.stockSizes
        )
        .find((stock) => stock.id === stockSizeId)?.quantityAvailable;

      if (previousQuantity === undefined) {
        return currentSummary;
      }

      const nextQuantity = previousQuantity + quantityDelta;

      const wasOutOfStock = previousQuantity <= 0;
      const isOutOfStock = nextQuantity <= 0;

      return {
        ...currentSummary,
        totalPieces: currentSummary.totalPieces + quantityDelta,
        outOfStock:
          currentSummary.outOfStock +
          (isOutOfStock ? 1 : 0) -
          (wasOutOfStock ? 1 : 0),
      };
    });

    setStockModal(null);
  } catch (error) {
    console.error("Failed to update stock:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to update stock.";

    window.alert(message);
  } finally {
    setSaving(false);
  }
}

  const filteredMaterials = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) {
      return materials;
    }

    return materials.filter((material) => {
      if (material.name.toLowerCase().includes(search)) {
        return true;
      }

      if (material.category === "GRANITE") {
        return material.productTypes.some((productType) => {
          if (productType.name.toLowerCase().includes(search)) {
            return true;
          }

          return productType.stockSizes.some((size) =>
            sizeMatchesSearch(size, search)
          );
        });
      }

      return material.stockSizes.some((size) =>
        sizeMatchesSearch(size, search)
      );
    });
  }, [materials, query]);

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-quarry-900">
          Stock Dashboard
        </h1>

        <p className="mt-1 text-sm text-quarry-500">
          Manage materials, applications, sizes, and available stock.
        </p>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Material types"
          value={summary?.materialTypeCount ?? "—"}
        />

        <StatCard
          label="Total pieces"
          value={summary?.totalPieces ?? "—"}
        />

        <StatCard
          label="Low stock"
          value={summary?.lowStock ?? "—"}
          tone="warn"
        />

        <StatCard
          label="Out of stock"
          value={summary?.outOfStock ?? "—"}
          tone="danger"
        />
      </div>

      {/* Category and search */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-fit rounded-md border border-quarry-300 bg-white p-1">
          {(["GRANITE", "CERAMIC"] as Category[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`rounded px-5 py-2 text-sm font-medium transition ${
                category === item
                  ? "bg-moss-600 text-white"
                  : "text-quarry-600 hover:bg-quarry-100"
              }`}
            >
              {item === "GRANITE" ? "Granite" : "Ceramic"}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-quarry-400"
          />

          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search material, application or size..."
            className="w-full rounded-md border border-quarry-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-moss-600 focus:ring-1 focus:ring-moss-600"
          />
        </div>
      </div>

      {/* Stock list */}
      {loading ? (
        <div className="rounded-lg border border-quarry-200 bg-white py-12 text-center text-sm text-quarry-500">
          Loading stock...
        </div>
      ) : filteredMaterials.length === 0 ? (
        <div className="rounded-lg border border-dashed border-quarry-300 bg-white py-12 text-center">
          <p className="text-sm font-medium text-quarry-700">
            No materials found
          </p>

          <p className="mt-1 text-xs text-quarry-400">
            Try another search or add materials from Materials.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMaterials.map((material) => (
            <MaterialCard
              key={material.id}
              material={material}
              expanded={!!expandedMaterials[material.id]}
              expandedApplications={expandedApplications}
              onToggle={() => toggleMaterial(material.id)}
              onToggleApplication={toggleApplication}
              onStockAction={openStockModal}
            />
          ))}
        </div>
      )}

      {/* Stock modal */}
      {stockModal && (
        <StockModal
          data={stockModal}
          saving={saving}
          onClose={closeStockModal}
          onSubmit={handleStockChange}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Material card                                                               */
/* -------------------------------------------------------------------------- */

function MaterialCard({
  material,
  expanded,
  expandedApplications,
  onToggle,
  onToggleApplication,
  onStockAction,
}: {
  material: MaterialHierarchy;
  expanded: boolean;
  expandedApplications: Record<string, boolean>;
  onToggle: () => void;
  onToggleApplication: (key: string) => void;
  onStockAction: (
    stock: StockSize,
    materialName: string,
    applicationName: string,
    action: StockAction
  ) => void;
}) {
  const totalPieces = getMaterialTotalPieces(material);
  const lowStockCount = getMaterialLowStockCount(material);
  const outOfStockCount = getMaterialOutOfStockCount(material);

  return (
    <div className="overflow-hidden rounded-lg border border-quarry-200 bg-white">
      {/* Material header */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-4 text-left transition hover:bg-quarry-50"
      >
        <div className="flex min-w-0 items-center gap-3">
          {expanded ? (
            <ChevronDown
              size={18}
              className="shrink-0 text-quarry-400"
            />
          ) : (
            <ChevronRight
              size={18}
              className="shrink-0 text-quarry-400"
            />
          )}

          <div className="min-w-0">
            <div className="font-medium text-quarry-900">
              {material.name}
            </div>

            <div className="mt-1 text-xs text-quarry-400">
              {material.category === "GRANITE"
                ? `${material.productTypes.length} applications`
                : `${material.stockSizes.length} sizes`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-quarry-400">
              Available
            </div>

            <div className="font-semibold text-quarry-900">
              {totalPieces} pcs
            </div>
          </div>

          {lowStockCount > 0 && (
            <div className="hidden sm:block">
              <Badge tone="warn">
                {lowStockCount} low
              </Badge>
            </div>
          )}

          {outOfStockCount > 0 && (
            <div className="hidden sm:block">
              <Badge tone="danger">
                {outOfStockCount} out
              </Badge>
            </div>
          )}
        </div>
      </button>

      {/* Material details */}
      {expanded && (
        <div className="border-t border-quarry-100 bg-quarry-50/30 px-4 pb-4">
          {material.category === "GRANITE" ? (
            <div className="divide-y divide-quarry-200">
              {material.productTypes.map((productType) => {
                const key = `${material.id}-${productType.id}`;

                return (
                  <ApplicationGroup
                    key={productType.id}
                    materialName={material.name}
                    productType={productType}
                    expanded={!!expandedApplications[key]}
                    onToggle={() => onToggleApplication(key)}
                    onStockAction={onStockAction}
                  />
                );
              })}
            </div>
          ) : (
            <div className="pt-4">
              <SizeTable
                sizes={material.stockSizes}
                materialName={material.name}
                applicationName="Ceramic"
                onStockAction={onStockAction}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Application group                                                           */
/* -------------------------------------------------------------------------- */

function ApplicationGroup({
  materialName,
  productType,
  expanded,
  onToggle,
  onStockAction,
}: {
  materialName: string;
  productType: {
    id: string;
    name: string;
    stockSizes: StockSize[];
  };
  expanded: boolean;
  onToggle: () => void;
  onStockAction: (
    stock: StockSize,
    materialName: string,
    applicationName: string,
    action: StockAction
  ) => void;
}) {
  const totalPieces = productType.stockSizes.reduce(
    (total, size) => total + size.quantityAvailable,
    0
  );

  return (
    <div className="py-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left transition hover:bg-quarry-100"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown size={16} className="text-quarry-400" />
          ) : (
            <ChevronRight size={16} className="text-quarry-400" />
          )}

          <span className="text-sm font-medium text-quarry-800">
            {productType.name}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-quarry-400">
            {productType.stockSizes.length} sizes
          </span>

          <span className="font-medium text-quarry-700">
            {totalPieces} pcs
          </span>
        </div>
      </button>

      {expanded && (
        <div className="mt-2 overflow-hidden rounded-md border border-quarry-200 bg-white">
          <SizeTable
            sizes={productType.stockSizes}
            materialName={materialName}
            applicationName={productType.name}
            onStockAction={onStockAction}
          />
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Size table                                                                  */
/* -------------------------------------------------------------------------- */

function SizeTable({
  sizes,
  materialName,
  applicationName,
  onStockAction,
}: {
  sizes: StockSize[];
  materialName: string;
  applicationName: string;
  onStockAction: (
    stock: StockSize,
    materialName: string,
    applicationName: string,
    action: StockAction
  ) => void;
}) {
  if (sizes.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-quarry-400">
        No sizes recorded yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-quarry-200 bg-quarry-50 text-left text-xs uppercase tracking-wide text-quarry-400">
            <th className="px-4 py-3 font-medium">
              Size
            </th>

            <th className="px-4 py-3 font-medium">
              Stock
            </th>

            <th className="px-4 py-3 font-medium">
              Status
            </th>

            <th className="px-4 py-3 text-right font-medium">
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {sizes.map((size) => (
            <tr
              key={size.id}
              className="border-b border-quarry-100 last:border-0"
            >
              <td className="px-4 py-3">
                <div className="font-medium text-quarry-800">
                  {formatSize(size)}
                </div>

                {size.secondaryWidthCm != null && (
                  <div className="mt-1 text-xs text-quarry-400">
                    Secondary width:{" "}
                    {size.secondaryWidthCm} cm
                  </div>
                )}

                {size.secondaryThickness != null && (
                  <div className="text-xs text-quarry-400">
                    Secondary thickness:{" "}
                    {size.secondaryThickness} cm
                  </div>
                )}
              </td>

              <td className="px-4 py-3 font-semibold text-quarry-900">
                {size.quantityAvailable} pcs
              </td>

              <td className="px-4 py-3">
                <StatusBadge status={size.status} />
              </td>

              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <StockActionButton
                    icon={<PackagePlus size={14} />}
                    label="Stock In"
                    onClick={() =>
                      onStockAction(
                        size,
                        materialName,
                        applicationName,
                        "IN"
                      )
                    }
                  />

                  <StockActionButton
                    icon={<PackageMinus size={14} />}
                    label="Stock Out"
                    disabled={size.quantityAvailable <= 0}
                    onClick={() =>
                      onStockAction(
                        size,
                        materialName,
                        applicationName,
                        "OUT"
                      )
                    }
                  />

                  <StockActionButton
                    icon={<SlidersHorizontal size={14} />}
                    label="Adjust"
                    onClick={() =>
                      onStockAction(
                        size,
                        materialName,
                        applicationName,
                        "ADJUST"
                      )
                    }
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stock modal                                                                 */
/* -------------------------------------------------------------------------- */

function StockModal({
  data,
  saving,
  onClose,
  onSubmit,
}: {
  data: StockModalData;
  saving: boolean;
  onClose: () => void;
  onSubmit: (
    stockSizeId: string,
    quantity: number,
    action: StockAction,
    reason: string
  ) => Promise<void>;
}) {
  const [action, setAction] = useState<StockAction>(
    data.action
  );

  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const enteredQuantity = Number(quantity);

  const isNumber = Number.isFinite(enteredQuantity);

  let validQuantity = false;

  if (isNumber && enteredQuantity !== 0) {
    if (action === "IN") {
      validQuantity = enteredQuantity > 0;
    }

    if (action === "OUT") {
      validQuantity =
        enteredQuantity > 0 &&
        enteredQuantity <= data.stock.quantityAvailable;
    }

    if (action === "ADJUST") {
      const resultingStock =
        data.stock.quantityAvailable + enteredQuantity;

      validQuantity = resultingStock >= 0;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validQuantity || saving) {
      return;
    }

    const defaultReason =
      action === "IN"
        ? "Manual stock in"
        : action === "OUT"
        ? "Manual stock out"
        : "Manual stock adjustment";

    await onSubmit(
      data.stock.id,
      enteredQuantity,
      action,
      reason.trim() || defaultReason
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Modal header */}
        <div className="flex items-start justify-between border-b border-quarry-200 px-5 py-4">
          <div>
            <h2 className="font-semibold text-quarry-900">
              Update Stock
            </h2>

            <p className="mt-1 text-xs text-quarry-500">
              {data.materialName} / {data.applicationName}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md p-1.5 text-quarry-400 transition hover:bg-quarry-100 hover:text-quarry-700"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 p-5"
        >
          {/* Selected size */}
          <div className="rounded-lg border border-quarry-200 bg-quarry-50 p-4">
            <div className="text-xs text-quarry-400">
              Selected size
            </div>

            <div className="mt-1 font-semibold text-quarry-900">
              {formatSize(data.stock)}
            </div>

            <div className="mt-2 text-sm text-quarry-600">
              Current stock:{" "}
              <span className="font-semibold text-quarry-900">
                {data.stock.quantityAvailable} pcs
              </span>
            </div>
          </div>

          {/* Action */}
          <div>
            <label className="mb-2 block text-sm font-medium text-quarry-700">
              Stock action
            </label>

            <div className="grid grid-cols-3 gap-2">
              <ActionSelector
                active={action === "IN"}
                icon={<PackagePlus size={15} />}
                label="Stock In"
                onClick={() => setAction("IN")}
              />

              <ActionSelector
                active={action === "OUT"}
                icon={<PackageMinus size={15} />}
                label="Stock Out"
                onClick={() => setAction("OUT")}
              />

              <ActionSelector
                active={action === "ADJUST"}
                icon={<SlidersHorizontal size={15} />}
                label="Adjust"
                onClick={() => setAction("ADJUST")}
              />
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label
              htmlFor="stock-quantity"
              className="mb-2 block text-sm font-medium text-quarry-700"
            >
              {action === "ADJUST"
                ? "Quantity change"
                : "Quantity"}
            </label>

            <input
              id="stock-quantity"
              type="number"
              value={quantity}
              onChange={(event) =>
                setQuantity(event.target.value)
              }
              placeholder={
                action === "ADJUST"
                  ? "Example: +10 or -5"
                  : "Example: 10"
              }
              className="w-full rounded-md border border-quarry-300 px-3 py-2.5 text-sm outline-none transition focus:border-moss-600 focus:ring-1 focus:ring-moss-600"
              autoFocus
            />

            {action === "OUT" && (
              <p className="mt-1 text-xs text-quarry-400">
                Maximum available:{" "}
                {data.stock.quantityAvailable} pcs
              </p>
            )}

            {action === "ADJUST" && (
              <p className="mt-1 text-xs text-quarry-400">
                Positive = add stock. Negative = remove stock.
              </p>
            )}

            {action === "ADJUST" &&
              enteredQuantity < 0 &&
              Math.abs(enteredQuantity) >
                data.stock.quantityAvailable && (
                <p className="mt-1 text-xs text-red-600">
                  You cannot remove more than the available stock.
                </p>
              )}
          </div>

          {/* Reason */}
          <div>
            <label
              htmlFor="stock-reason"
              className="mb-2 block text-sm font-medium text-quarry-700"
            >
              Reason
            </label>

            <input
              id="stock-reason"
              type="text"
              value={reason}
              onChange={(event) =>
                setReason(event.target.value)
              }
              placeholder={
                action === "IN"
                  ? "Example: New purchase"
                  : action === "OUT"
                  ? "Example: Customer order"
                  : "Example: Physical stock count"
              }
              className="w-full rounded-md border border-quarry-300 px-3 py-2.5 text-sm outline-none transition focus:border-moss-600 focus:ring-1 focus:ring-moss-600"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-quarry-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-quarry-300 px-4 py-2 text-sm font-medium text-quarry-700 transition hover:bg-quarry-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!validQuantity || saving}
              className="rounded-md bg-moss-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-moss-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Stock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small UI components                                                         */
/* -------------------------------------------------------------------------- */

function StockActionButton({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-md border border-quarry-300 bg-white px-2.5 py-1.5 text-xs font-medium text-quarry-700 transition hover:border-moss-500 hover:bg-moss-50 hover:text-moss-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
      {label}
    </button>
  );
}

function ActionSelector({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-medium transition ${
        active
          ? "border-moss-600 bg-moss-50 text-moss-700"
          : "border-quarry-300 bg-white text-quarry-600 hover:bg-quarry-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function StatusBadge({
  status,
}: {
  status: StockSize["status"];
}) {
  if (status === "OUT_OF_STOCK") {
    return <Badge tone="danger">Out of stock</Badge>;
  }

  if (status === "LOW_STOCK") {
    return <Badge tone="warn">Low stock</Badge>;
  }

  return <Badge tone="ok">In stock</Badge>;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function formatSize(size: StockSize) {
  return `${size.lengthCm} × ${size.widthCm} × ${size.thickness} cm`;
}

function sizeMatchesSearch(
  size: StockSize,
  search: string
) {
  const values = [
    size.lengthCm,
    size.widthCm,
    size.thickness,
    size.secondaryWidthCm,
    size.secondaryThickness,
  ];

  return values.some(
    (value) =>
      value != null &&
      String(value).toLowerCase().includes(search)
  );
}

function getMaterialTotalPieces(
  material: MaterialHierarchy
) {
  if (material.category === "GRANITE") {
    return material.productTypes.reduce(
      (total, productType) =>
        total +
        productType.stockSizes.reduce(
          (sum, size) => sum + size.quantityAvailable,
          0
        ),
      0
    );
  }

  return material.stockSizes.reduce(
    (total, size) => total + size.quantityAvailable,
    0
  );
}

function getMaterialLowStockCount(
  material: MaterialHierarchy
) {
  if (material.category === "GRANITE") {
    return material.productTypes.reduce(
      (total, productType) =>
        total +
        productType.stockSizes.filter(
          (size) => size.status === "LOW_STOCK"
        ).length,
      0
    );
  }

  return material.stockSizes.filter(
    (size) => size.status === "LOW_STOCK"
  ).length;
}

function getMaterialOutOfStockCount(
  material: MaterialHierarchy
) {
  if (material.category === "GRANITE") {
    return material.productTypes.reduce(
      (total, productType) =>
        total +
        productType.stockSizes.filter(
          (size) => size.status === "OUT_OF_STOCK"
        ).length,
      0
    );
  }

  return material.stockSizes.filter(
    (size) => size.status === "OUT_OF_STOCK"
  ).length;
}


function getStockStatus(
  quantityAvailable: number,
  lowStockThreshold: number
): StockSize["status"] {
  if (quantityAvailable <= 0) {
    return "OUT_OF_STOCK";
  }

  if (quantityAvailable <= lowStockThreshold) {
    return "LOW_STOCK";
  }

  return "IN_STOCK";
}
