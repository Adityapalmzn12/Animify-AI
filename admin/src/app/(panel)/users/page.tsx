"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type UserRow = {
  id: string;
  email: string;
  name?: string;
  role?: string;
  status?: string;
  creditBalance?: number;
  subscription?: { planType?: string; status?: string };
};

type AdjustMode = "grant" | "delta" | "set";

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState("");
  const [target, setTarget] = useState<UserRow | null>(null);
  const [mode, setMode] = useState<AdjustMode>("grant");
  const [amount, setAmount] = useState("100");
  const [reason, setReason] = useState("Admin correction");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ items: UserRow[] }>("/admin/users?page=1&limit=50");
      setUsers(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function open(u: UserRow, m: AdjustMode) {
    setTarget(u);
    setMode(m);
    setAmount(m === "set" ? String(u.creditBalance ?? 0) : m === "delta" ? "-50" : "100");
    setReason(
      m === "grant"
        ? "Admin grant from Next.js panel"
        : m === "set"
          ? "Set balance after mistaken credit"
          : "Correct mistaken grant",
    );
    setError("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "grant") {
        await api(`/admin/users/${target.id}/credits`, {
          method: "POST",
          body: JSON.stringify({
            amount: Number(amount),
            reason,
          }),
        });
      } else if (mode === "delta") {
        await api(`/admin/users/${target.id}/credits/adjust`, {
          method: "POST",
          body: JSON.stringify({
            delta: Number(amount),
            reason,
          }),
        });
      } else {
        await api(`/admin/users/${target.id}/credits/adjust`, {
          method: "POST",
          body: JSON.stringify({
            setTo: Number(amount),
            reason,
          }),
        });
      }
      setTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl md:text-4xl">Users</h1>
        <p className="text-muted text-sm mt-1">
          Grant, subtract, or set wallet balance — fix mistaken credits without
          touching Stripe.
        </p>
      </header>
      {error ? <div className="panel p-4 text-[var(--bad)]">{error}</div> : null}
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted border-b border-line">
            <tr>
              <th className="p-3">User</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Credits</th>
              <th className="p-3">Role</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line/50">
                <td className="p-3">
                  <p className="font-medium">{u.name || "—"}</p>
                  <p className="text-muted text-xs">{u.email}</p>
                </td>
                <td className="p-3">{u.subscription?.planType || "NONE"}</td>
                <td className="p-3">{u.creditBalance ?? 0}</td>
                <td className="p-3">{u.role}</td>
                <td className="p-3 text-right space-x-2 whitespace-nowrap">
                  <button className="btn btn-ghost" onClick={() => open(u, "grant")}>
                    Grant
                  </button>
                  <button className="btn btn-ghost" onClick={() => open(u, "delta")}>
                    Adjust ±
                  </button>
                  <button className="btn btn-ghost" onClick={() => open(u, "set")}>
                    Set
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {target ? (
        <div className="fixed inset-0 bg-black/60 grid place-items-center p-4 z-50">
          <form onSubmit={submit} className="panel w-full max-w-md p-6 space-y-4">
            <h2 className="text-xl font-semibold">
              {mode === "grant"
                ? "Grant credits"
                : mode === "delta"
                  ? "Adjust credits (±)"
                  : "Set absolute balance"}
            </h2>
            <p className="text-sm text-muted">
              {target.email} · current {target.creditBalance ?? 0}
            </p>
            <label className="block space-y-1">
              <span className="text-xs text-muted">
                {mode === "delta"
                  ? "Delta (e.g. -50 removes, +50 adds)"
                  : mode === "set"
                    ? "New balance"
                    : "Amount to grant"}
              </span>
              <input
                className="input"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted">Reason (audit log)</span>
              <input
                className="input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                minLength={3}
                required
              />
            </label>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setTarget(null)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Apply"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
