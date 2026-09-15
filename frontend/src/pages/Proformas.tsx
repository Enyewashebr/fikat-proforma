import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "../api/client";
import { Proforma } from "../types/domain";
import { Badge } from "../components/ui";

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function Proformas() {
  const [proformas, setProformas] = useState<Proforma[]>([]);

  useEffect(() => {
    api.get<Proforma[]>("/proformas").then(setProformas);
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-quarry-900">Proformas</h1>
          <p className="text-sm text-quarry-500">Drafts stay editable until finalized.</p>
        </div>
        <Link
          to="/proformas/new"
          className="flex items-center gap-2 rounded-md bg-moss-600 px-4 py-2 text-sm font-semibold text-white hover:bg-moss-700"
        >
          <Plus size={16} />
          New proforma
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-quarry-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-quarry-200 bg-quarry-50 text-left text-quarry-500">
              <th className="px-4 py-2 font-medium">Number</th>
              <th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Items</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {proformas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-quarry-400">
                  No proformas yet.
                </td>
              </tr>
            )}
            {proformas.map((p) => (
              <tr key={p.id} className="border-b border-quarry-100 last:border-0">
                <td className="px-4 py-2">
                  <Link to={`/proformas/${p.id}`} className="font-medium text-moss-700 hover:underline">
                    {p.number ?? "Draft"}
                  </Link>
                </td>
                <td className="px-4 py-2">{p.customer?.name ?? "—"}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-4 py-2 text-right">{p.items?.length ?? 0}</td>
                <td className="px-4 py-2 text-right">{money(p.grandTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Proforma["status"] }) {
  if (status === "FINALIZED") return <Badge tone="ok">Finalized</Badge>;
  if (status === "CANCELLED") return <Badge tone="danger">Cancelled</Badge>;
  return <Badge tone="warn">Draft</Badge>;
}
