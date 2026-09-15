import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@fikat.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-quarry-900 px-4">
      <div className="w-full max-w-sm rounded-xl border border-quarry-800 bg-quarry-950 p-8">
        <div className="mb-6">
          <div className="text-xl font-semibold text-white">Fikat Proforma</div>
          <div className="text-sm text-quarry-400">Sign in to manage stock and proformas</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-quarry-300">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              className="w-full rounded-md border border-quarry-700 bg-quarry-900 px-3 py-2 text-sm text-white outline-none focus:border-moss-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-quarry-300">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              className="w-full rounded-md border border-quarry-700 bg-quarry-900 px-3 py-2 text-sm text-white outline-none focus:border-moss-500"
            />
          </div>

          {error && <div className="text-sm text-red-400">{error}</div>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-moss-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-moss-700 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-5 text-xs text-quarry-500">
          Seeded admin: admin@fikat.local / admin1234
        </div>
      </div>
    </div>
  );
}
