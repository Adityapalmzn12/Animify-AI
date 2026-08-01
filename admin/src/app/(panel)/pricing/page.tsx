"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type ModuleRow = {
  key: string;
  module: string;
  description: string;
  credits: number;
  durationSec?: number;
};

type Plan = {
  id: string;
  name: string;
  priceInr: number;
  credits: number;
  description: string;
  popular?: boolean;
};

type Pricing = {
  retailCreditInr: number;
  modules: ModuleRow[];
  video: { "10s": number; "30s": number; "60s": number };
  plans: Plan[];
  note?: string;
};

export default function PricingPage() {
  const [data, setData] = useState<Pricing | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [costEdits, setCostEdits] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const p = await api<Pricing>("/admin/pricing");
      setData(p);
      const edits: Record<string, string> = {};
      for (const row of p.modules || []) edits[row.key] = String(row.credits);
      setCostEdits(edits);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pricing");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const costs: Record<string, number> = {};
      for (const [k, v] of Object.entries(costEdits)) {
        const n = Number(v);
        if (!Number.isNaN(n) && n > 0) costs[k] = Math.floor(n);
      }
      await api("/admin/pricing", {
        method: "PATCH",
        body: JSON.stringify({ costs }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function resetDefaults() {
    setBusy(true);
    setError("");
    try {
      await api("/admin/pricing", {
        method: "PATCH",
        body: JSON.stringify({ recomputeFromProviderCosts: true }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl md:text-4xl">Credit usage</h1>
        <p className="text-muted text-sm mt-1">
          Transparent credits charged to customers per module. Same numbers appear
          in the app Wallet and on generate screens.
        </p>
      </header>

      {error ? <div className="panel p-4 text-[var(--bad)]">{error}</div> : null}

      {data?.video ? (
        <div className="grid sm:grid-cols-3 gap-3">
          {(
            [
              ["10s video", data.video["10s"]],
              ["30s video", data.video["30s"]],
              ["60s video", data.video["60s"]],
            ] as const
          ).map(([label, credits]) => (
            <div key={label} className="panel p-4">
              <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
              <p className="text-3xl font-semibold mt-1">{credits}</p>
              <p className="text-xs text-muted">credits / create</p>
            </div>
          ))}
        </div>
      ) : null}

      <form onSubmit={save} className="space-y-4">
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted border-b border-line">
              <tr>
                <th className="p-3">Module</th>
                <th className="p-3">What it is</th>
                <th className="p-3">Credits used</th>
              </tr>
            </thead>
            <tbody>
              {(data?.modules || []).map((row) => (
                <tr key={row.key} className="border-b border-line/50">
                  <td className="p-3 font-medium">{row.module}</td>
                  <td className="p-3 text-muted text-xs max-w-xs">
                    {row.description}
                  </td>
                  <td className="p-3">
                    <input
                      className="input max-w-[120px]"
                      type="number"
                      min={1}
                      value={costEdits[row.key] ?? ""}
                      onChange={(e) =>
                        setCostEdits((prev) => ({
                          ...prev,
                          [row.key]: e.target.value,
                        }))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save credit rates"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={resetDefaults}
          >
            Reset default rates
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Subscription packs</h2>
        <p className="text-sm text-muted">
          Credits granted to the customer wallet after a successful Stripe purchase.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          {(data?.plans || []).map((p) => (
            <div key={p.id} className="panel p-5 space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted">
                {p.id}
                {p.popular ? " · popular" : ""}
              </p>
              <h3 className="font-display text-xl">{p.name}</h3>
              <p className="text-2xl font-semibold">
                ₹{p.priceInr}
                <span className="text-sm text-muted font-normal">/mo</span>
              </p>
              <p className="text-accent">{p.credits} credits granted</p>
              <p className="text-xs text-muted">{p.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
