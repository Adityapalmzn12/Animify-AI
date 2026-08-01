"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type BuyApi = {
  provider: string;
  name: string;
  amountInr: number;
  buyUrl: string;
  usedFor?: string;
  action?: string;
};

type Row = {
  userId: string;
  email?: string;
  name?: string;
  paidInr: number;
  yourProfitInr: number;
  apiBudgetInr: number;
  purchases: number;
  creditBalance?: number;
  plan?: string;
};

type Summary = {
  split: { ownerProfit: string; apiAutoReserve: string };
  note?: string;
  owner: { email: string; name: string; profitBalanceInr: number } | null;
  totals: {
    salesCount: number;
    grossInr: number;
    profitInr: number;
    apiBudgetInr: number;
    availableProfitInr: number;
    withdrawnInr: number;
    apiReserveAvailableInr: number;
    apiReserveSpentInr: number;
  };
  revenueByUser: Row[];
  apiUsage7d: Array<{
    provider: string;
    jobs: number;
    credits: number;
    sharePercent: number;
  }>;
  buyApisNow: BuyApi[];
  recent: Array<{
    id: string;
    source: string;
    grossInr: number;
    profitInr: number;
    apiBudgetInr: number;
    createdAt: string;
    buyer?: { email?: string; name?: string };
  }>;
};

export default function CommissionPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [withdrawAmt, setWithdrawAmt] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await api<Summary>("/admin/commission"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
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
        body: JSON.stringify({ amountInr: Number(withdrawAmt), note: "Payout" }),
      });
      setWithdrawAmt("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdraw failed");
    } finally {
      setBusy(false);
    }
  }

  async function markBought(provider: string, amountInr: number) {
    setBusy(true);
    try {
      await api("/admin/commission/api-purchased", {
        method: "POST",
        body: JSON.stringify({ provider, amountInr }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mark failed");
    } finally {
      setBusy(false);
    }
  }

  const t = data?.totals;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl md:text-4xl">Money desk</h1>
        <p className="text-muted text-sm mt-1">
          Sirf admin — user app pe yeh kuch nahi dikhta. User credits kharida →{" "}
          <strong className="text-white">55% aapka profit</strong> ·{" "}
          <strong className="text-white">45% auto API reserve</strong> taaki
          users generate kar saken.
        </p>
      </header>

      {error ? <div className="panel p-4 text-[var(--bad)]">{error}</div> : null}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="panel p-4">
          <p className="text-xs text-muted uppercase tracking-wide">Aapka profit</p>
          <p className="text-3xl font-semibold text-accent mt-1">
            ₹{t?.availableProfitInr ?? 0}
          </p>
        </div>
        <div className="panel p-4">
          <p className="text-xs text-muted uppercase tracking-wide">API reserve (45%)</p>
          <p className="text-3xl font-semibold mt-1">
            ₹{t?.apiReserveAvailableInr ?? 0}
          </p>
          <p className="text-xs text-muted">spent ₹{t?.apiReserveSpentInr ?? 0}</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs text-muted uppercase tracking-wide">Total sales</p>
          <p className="text-3xl font-semibold mt-1">₹{t?.grossInr ?? 0}</p>
          <p className="text-xs text-muted">{t?.salesCount ?? 0} buys</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs text-muted uppercase tracking-wide">Lifetime profit</p>
          <p className="text-3xl font-semibold mt-1">₹{t?.profitInr ?? 0}</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ab kaunsi API buy / top-up karein</h2>
        <p className="text-sm text-muted">
          Credit sales se 45% yahan auto reserve hota hai. Link pe jaake top-up
          karo, phir Mark purchased dabao.
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          {(data?.buyApisNow || [])
            .filter((b) => Number(b.amountInr) > 0)
            .map((b) => (
              <div key={b.provider} className="panel p-4 space-y-3 border-amber-500/30">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-semibold text-amber-300">{b.name}</p>
                    <p className="text-xs text-muted">{b.usedFor}</p>
                    <p className="text-2xl font-semibold mt-2">₹{b.amountInr}</p>
                  </div>
                  <a
                    className="btn btn-primary h-fit"
                    href={b.buyUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Buy / top up
                  </a>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => markBought(b.provider, b.amountInr)}
                >
                  Mark purchased
                </button>
              </div>
            ))}
          {!data?.buyApisNow?.some((b) => Number(b.amountInr) > 0) ? (
            <div className="panel p-4 text-muted text-sm">
              Abhi pending API reserve nahi — jab users credits kharidenge,
              yahan auto amount aa jayega.
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Kaunsi API zyada use ho rahi hai (7d)</h2>
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted border-b border-line">
              <tr>
                <th className="p-3">API</th>
                <th className="p-3">Jobs</th>
                <th className="p-3">Credits</th>
                <th className="p-3">Share</th>
              </tr>
            </thead>
            <tbody>
              {(data?.apiUsage7d || []).map((r) => (
                <tr key={r.provider} className="border-b border-line/50">
                  <td className="p-3 font-medium">{r.provider}</td>
                  <td className="p-3">{r.jobs}</td>
                  <td className="p-3">{r.credits}</td>
                  <td className="p-3">{r.sharePercent}%</td>
                </tr>
              ))}
              {!data?.apiUsage7d?.length ? (
                <tr>
                  <td colSpan={4} className="p-4 text-muted">
                    Abhi usage data kam hai.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Per user — kitna aa raha hai</h2>
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted border-b border-line">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Paid</th>
                <th className="p-3">Aapka 55%</th>
                <th className="p-3">API 45%</th>
                <th className="p-3">Wallet</th>
              </tr>
            </thead>
            <tbody>
              {(data?.revenueByUser || []).map((u) => (
                <tr key={u.userId} className="border-b border-line/50">
                  <td className="p-3">
                    <p className="font-medium">{u.name || "—"}</p>
                    <p className="text-xs text-muted">{u.email}</p>
                  </td>
                  <td className="p-3">{u.plan}</td>
                  <td className="p-3">₹{u.paidInr}</td>
                  <td className="p-3 text-accent font-semibold">
                    ₹{u.yourProfitInr}
                  </td>
                  <td className="p-3">₹{u.apiBudgetInr}</td>
                  <td className="p-3">{u.creditBalance ?? 0} cr</td>
                </tr>
              ))}
              {!data?.revenueByUser?.length ? (
                <tr>
                  <td colSpan={6} className="p-4 text-muted">
                    Jab koi user Stripe se credits kharidega, yahan dikhega.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <form onSubmit={withdraw} className="panel p-5 flex flex-wrap gap-3 items-end">
        <label className="block space-y-1">
          <span className="text-xs text-muted">Profit withdraw / mark paid (₹)</span>
          <input
            className="input"
            type="number"
            min={1}
            value={withdrawAmt}
            onChange={(e) => setWithdrawAmt(e.target.value)}
          />
        </label>
        <button className="btn btn-primary" disabled={busy || !withdrawAmt}>
          Mark withdrawn
        </button>
        {data?.owner ? (
          <p className="text-xs text-muted w-full">
            Profit account: {data.owner.name} ({data.owner.email})
          </p>
        ) : null}
      </form>
    </div>
  );
}
