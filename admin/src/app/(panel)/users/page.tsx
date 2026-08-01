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

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState("");
  const [grantUser, setGrantUser] = useState<UserRow | null>(null);
  const [amount, setAmount] = useState("100");
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

  async function grant(e: FormEvent) {
    e.preventDefault();
    if (!grantUser) return;
    setBusy(true);
    try {
      await api(`/admin/users/${grantUser.id}/credits`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(amount),
          reason: "Admin grant from Next.js panel",
        }),
      });
      setGrantUser(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grant failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl md:text-4xl">Users</h1>
        <p className="text-muted text-sm mt-1">
          Grant credits when a subscriber needs more than their plan.
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
                <td className="p-3 text-right">
                  <button className="btn btn-ghost" onClick={() => setGrantUser(u)}>
                    Grant credits
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {grantUser ? (
        <div className="fixed inset-0 bg-black/60 grid place-items-center p-4 z-50">
          <form onSubmit={grant} className="panel w-full max-w-md p-6 space-y-4">
            <h2 className="text-xl font-semibold">Grant credits</h2>
            <p className="text-sm text-muted">{grantUser.email}</p>
            <input
              className="input"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-ghost" onClick={() => setGrantUser(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? "Granting…" : "Grant"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
