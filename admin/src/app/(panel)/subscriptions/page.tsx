"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Sub = {
  userId: string;
  email?: string;
  name?: string;
  creditBalance?: number;
  planType?: string;
  status?: string;
  expiresAt?: string;
  videoLimit?: number;
  autoRenew?: boolean;
};

export default function SubscriptionsPage() {
  const [items, setItems] = useState<Sub[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ items: Sub[] } | { subscriptions: Sub[] }>("/admin/ops")
      .then((d) => {
        const list =
          (d as { subscriptions?: Sub[] }).subscriptions ||
          (d as { items?: Sub[] }).items ||
          [];
        setItems(list);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl md:text-4xl">Subscriptions</h1>
        <p className="text-muted text-sm mt-1">
          Who is on Premium vs free trial, and their wallet balance.
        </p>
      </header>
      {error ? <div className="panel p-4 text-[var(--bad)]">{error}</div> : null}
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted border-b border-line">
            <tr>
              <th className="p-3">User</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Status</th>
              <th className="p-3">Wallet</th>
              <th className="p-3">Expires</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.userId} className="border-b border-line/50">
                <td className="p-3">
                  <p>{s.name || "—"}</p>
                  <p className="text-muted text-xs">{s.email}</p>
                </td>
                <td className="p-3">{s.planType}</td>
                <td className="p-3">{s.status}</td>
                <td className="p-3">{s.creditBalance ?? 0}</td>
                <td className="p-3">
                  {s.expiresAt ? String(s.expiresAt).split("T")[0] : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
