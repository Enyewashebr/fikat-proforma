import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../api/client";
import { Customer } from "../types/domain";
import { Input } from "../components/ui";

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    api.get<Customer[]>("/customers").then(setCustomers);
  }

  useEffect(load, []);

  async function addCustomer() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.post("/customers", { name, phone, email, address });
      setName("");
      setPhone("");
      setEmail("");
      setAddress("");
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-quarry-900">Customers</h1>
      <p className="mb-6 text-sm text-quarry-500">Everyone you've quoted or sold to.</p>

      <div className="mb-6 grid gap-3 rounded-lg border border-quarry-200 bg-white p-4 md:grid-cols-5">
        <Input label="Name" value={name} onChange={setName} placeholder="Customer name" />
        <Input label="Phone" value={phone} onChange={setPhone} placeholder="09…" />
        <Input label="Email" value={email} onChange={setEmail} placeholder="optional" />
        <Input label="Address" value={address} onChange={setAddress} placeholder="optional — shown on the PDF" />
        <div className="flex items-end">
          <button
            onClick={addCustomer}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-moss-600 px-4 py-2 text-sm font-semibold text-white hover:bg-moss-700 disabled:opacity-50"
          >
            <Plus size={16} />
            Add customer
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-quarry-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-quarry-200 bg-quarry-50 text-left text-quarry-500">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Phone</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Address</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-quarry-400">
                  No customers yet.
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-quarry-100 last:border-0">
                <td className="px-4 py-2 font-medium text-quarry-900">{c.name}</td>
                <td className="px-4 py-2 text-quarry-600">{c.phone || "—"}</td>
                <td className="px-4 py-2 text-quarry-600">{c.email || "—"}</td>
                <td className="px-4 py-2 text-quarry-600">{c.address || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
