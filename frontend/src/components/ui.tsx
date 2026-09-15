import { ReactNode } from "react";

export function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warn" | "danger";
}) {
  const toneClass =
    tone === "warn"
      ? "text-amber-700"
      : tone === "danger"
      ? "text-red-700"
      : "text-quarry-900";
  return (
    <div className="rounded-lg border border-quarry-200 bg-white px-5 py-4">
      <div className="text-sm text-quarry-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1 block text-sm text-quarry-600">{label}</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-quarry-300 bg-white px-3 py-2 text-sm outline-none focus:border-moss-600 focus:ring-1 focus:ring-moss-600"
      />
    </label>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone: "ok" | "warn" | "danger" }) {
  const cls =
    tone === "ok"
      ? "bg-moss-600/10 text-moss-700"
      : tone === "warn"
      ? "bg-amber-100 text-amber-800"
      : "bg-red-100 text-red-700";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}
