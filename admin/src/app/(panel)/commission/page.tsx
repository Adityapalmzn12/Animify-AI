"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type CommissionSummary = {
  marginPercent: number;
  split: { ownerCommission: string; apiUsageBudget: string };
  note?: string;
  owner: {
    id: string;
    email: string;
    name: string;
    earningsBalanceInr: number;
  } | null;
  totals: {
    salesCount: number;
    grossInr: number;
    commissionInr: number;
    apiBudgetInr: number;
    availableCommissionInr: number;
    withdrawnInr: number;
    lifetimeCommissionInr: number;
  };
  recent: Array<{
    id: string;
    source: string;
    grossInr: number;
    commissionInr: number;
    apiBudgetInr: number;
    creditsGranted: number;
    createdAt: string;
    buyer?: { email?: string; name?: string };
  }>;
};

export default function CommissionPage() {
  const [data, setData] = useState<CommissionSummary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [withdrawAmt, setWithdrawAmt] = useState("");

  const load = useCallback(async () => {
    try {
      const s = await api<CommissionSummary>("/admin/commission");
      setData(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load commission");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function withdraw(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/admin/commission/withdraw", {
        method: "POST",
        body: JSON.stringify({
          amountInr: Number(withdrawAmt),
          note: "Owner payout",
        }),
      });
      setWithdrawAmt("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdraw failed");
    } finally {
      setBusy(false);
    }
  }

  const t = data?.totals;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl md:text-4xl">Your commission</h1>
        <p className="text-muted text-sm mt-1">
          Jab user credits kharida →{" "}
          <strong className="text-white">
            {data?.split.ownerCommission || "55%"}
          </strong>{" "}
          auto aapke account mein credit ·{" "}
          <strong className="text-white">
            {data?.split.apiUsageBudget || "45%"}
          </strong>{" "}
          API usage budget.
        </p>
      </header>

      {error ? <div className="panel p-4 text-[var(--bad)]">{error}</div> : null}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="panel p-4">
          <p className="text-xs uppercase tracking-wide text-muted">
            Available (your account)
          </p>
          <p className="text-3xl font-semibold text-accent mt-1">
            ₹{t?.availableCommissionInr ?? 0}
          </p>
        </div>
        <div className="panel p-4">
          <p className="text-xs uppercase tracking-wide text-muted">
            Lifetime commission 55%
          </p>
          <p className="text-3xl font-semibold mt-1">
            ₹{t?.lifetimeCommissionInr ?? t?.commissionInr ?? 0}
          </p>
        </div>
        <div className="panel p-4">
          <p className="text-xs uppercase tracking-wide text-muted">
            API budget 45%
          </p>
          <p className="text-3xl font-semibold mt-1">
            ₹{t?.apiBudgetInr ?? 0}
          </p>
        </div>
        <div className="panel p-4">
          <p className="text-xs uppercase tracking-wide text-muted">
            Total sales
          </p>
          <p className="text-3xl font-semibold mt-1">₹{t?.grossInr ?? 0}</p>
          <p className="text-xs text-muted">{t?.salesCount ?? 0} purchases</p>
        </div>
      </div>

      {data?.owner ? (
        <div className="panel p-4 text-sm">
          Credited to: <strong>{data.owner.name}</strong> ({data.owner.email}) ·
          earnings balance ₹{data.owner.earningsBalanceInr}
        </div>
      ) : null}

      <form onSubmit={withdraw} className="panel p-5 flex flex-wrap gap-3 items-end">
        <label className="block space-y-1">
          <span className="text-xs text-muted">Withdraw / mark paid (₹)</span>
          <input
            className="input"
            type="number"
            min={1}
            step="0.01"
            value={withdrawAmt}
            onChange={(e) => setWithdrawAmt(e.target.value)}
            placeholder="e.g. 500"
          />
        </label>
        <button className="btn btn-primary" disabled={busy || !withdrawAmt}>
          {busy ? "…" : "Mark withdrawn"}
        </button>
        <p className="text-xs text-muted w-full">
          Real bank money Stripe dashboard se aata hai. Yahan aapka 55% share
          track + account balance update hota hai.
        </p>
      </form>

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted border-b border-line">
            <tr>
              <th className="p-3">When</th>
              <th className="p-3">Buyer</th>
              <th className="p-3">Source</th>
              <th className="p-3">Gross</th>
              <th className="p-3">Your 55%</th>
              <th className="p-3">API 45%</th>
            </tr>
          </thead>
          <tbody>
            {(data?.recent || []).map((r) => (
              <tr key={r.id} className="border-b border-line/50">
                <td className="p-3 text-xs text-muted">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td className="p-3">
                  {r.buyer?.name || "—"}
                  <br />
                  <span className="text-xs text-muted">{r.buyer?.email}</span>
                </td>
                <td className="p-3">{r.source}</td>
                <td className="p-3">₹{r.grossInr}</td>
                <td className="p-3 text-accent font-semibold">
                  ₹{r.commissionInr}
                </td>
                <td className="p-3">₹{r.apiBudgetInr}</td>
              </tr>
            ))}
            {!data?.recent?.length ? (
              <tr>
                <td className="p-4 text-muted" colSpan={6}>
                  Abhi koi purchase nahi — jab user Wallet/Subscription se
                  credits kharidega, yahan auto dikhega.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
