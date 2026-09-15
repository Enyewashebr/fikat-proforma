import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Minus, Plus, Search } from "lucide-react";
import { api } from "../api/client";
import { DashboardSummary, MaterialHierarchy, StockSize } from "../types/domain";
import { StatCard, Badge } from "../components/ui";

type Category = "GRANITE" | "CERAMIC";

export default function Dashboard() {
  const [category, setCategory] = useState<Category>("GRANITE");
  const [materials, setMaterials] = useState<MaterialHierarchy[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [hierarchy, summaryData] = await Promise.all([
      api.get<MaterialHierarchy[]>(`/stock/hierarchy?category=${category}`),
      api.get<DashboardSummary>("/stock/summary"),
    ]);
    setMaterials(hierarchy);
    setSummary(summaryData);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  async function adjustQuantity(stockSizeId: string, delta: number) {
    await api.post(`/stock/${stockSizeId}/adjust`, {
      quantityDelta: delta,
      type: "ADJUSTMENT",
      reason: delta > 0 ? "Manual stock in" : "Manual stock out",
    });
    load();
  }

  function toggle(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const filtered = materials.filter((m) =>
    query.trim() ? m.name.toLowerCase().includes(query.toLowerCase()) : true
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-quarry-900">Stock dashboard</h1>
        <p className="text-sm text-quarry-500">
          What material do we have, what size, and how much of it.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Material types" value={summary?.materialTypeCount ?? "—"} />
        <StatCard label="Total pieces" value={summary?.totalPieces ?? "—"} />
        <StatCard label="Low stock" value={summary?.lowStock ?? "—"} tone="warn" />
        <StatCard label="Out of stock" value={summary?.outOfStock ?? "—"} tone="danger" />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-md border border-quarry-300 bg-white p-1">
          {(["GRANITE", "CERAMIC"] as Category[]).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded px-4 py-1.5 text-sm font-medium transition ${
                category === c ? "bg-moss-600 text-white" : "text-quarry-600 hover:bg-quarry-100"
              }`}
            >
              {c === "GRANITE" ? "Granite" : "Ceramic"}
            </button>
          ))}
        </div>

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

      {loading ? (
        <div className="py-12 text-center text-sm text-quarry-500">Loading stock…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-quarry-300 py-12 text-center text-sm text-quarry-500">
          No materials yet in this category. Add one from Materials.
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
                </div>
                <span className="text-xs text-quarry-400">
                  {material.category === "GRANITE"
                    ? `${material.productTypes.length} product type(s)`
                    : `${material.stockSizes.length} size(s)`}
                </span>
              </button>

              {expanded[material.id] && (
                <div className="border-t border-quarry-100 px-4 pb-4">
                  {material.category === "GRANITE"
                    ? material.productTypes.map((pt) => (
                        <ProductTypeGroup
                          key={pt.id}
                          name={pt.name}
                          sizes={pt.stockSizes}
                          onAdjust={adjustQuantity}
                        />
                      ))
                    : (
                        <SizeTable sizes={material.stockSizes} onAdjust={adjustQuantity} />
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

function ProductTypeGroup({
  name,
  sizes,
  onAdjust,
}: {
  name: string;
  sizes: StockSize[];
  onAdjust: (id: string, delta: number) => void;
}) {
  if (sizes.length === 0) return null;
  return (
    <div className="mt-3">
      <div className="mb-1 text-sm font-medium text-quarry-700">{name}</div>
      <SizeTable sizes={sizes} onAdjust={onAdjust} />
    </div>
  );
}

function SizeTable({
  sizes,
  onAdjust,
}: {
  sizes: StockSize[];
  onAdjust: (id: string, delta: number) => void;
}) {
  if (sizes.length === 0) {
    return <div className="py-2 text-sm text-quarry-400">No sizes recorded yet.</div>;
  }
  return (
    <table className="w-full text-sm">
      <tbody>
        {sizes.map((s) => (
          <tr key={s.id} className="border-b border-quarry-100 last:border-0">
            <td className="py-2 text-quarry-600">
              {s.lengthCm} × {s.widthCm} × {s.thickness} cm
            </td>
            <td className="py-2">
              <StatusBadge status={s.status} />
            </td>
            <td className="py-2 text-right text-quarry-900">{s.quantityAvailable} pcs</td>
            <td className="w-28 py-2">
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => onAdjust(s.id, -1)}
                  className="rounded border border-quarry-300 p-1 text-quarry-600 hover:bg-quarry-100 disabled:opacity-30"
                  disabled={s.quantityAvailable <= 0}
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

function StatusBadge({ status }: { status: StockSize["status"] }) {
  if (status === "OUT_OF_STOCK") return <Badge tone="danger">Out of stock</Badge>;
  if (status === "LOW_STOCK") return <Badge tone="warn">Low stock</Badge>;
  return <Badge tone="ok">In stock</Badge>;
}
