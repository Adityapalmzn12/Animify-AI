"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Ops = {
  generatedAt?: string;
  summary?: Record<string, unknown>;
  buyNow?: Array<Record<string, unknown>>;
  providers?: Array<Record<string, unknown>>;
  liveActiveUsers?: Array<Record<string, unknown>>;
  topConsumers7d?: Array<Record<string, unknown>>;
  subscriptions?: Array<Record<string, unknown>>;
  billingFailures?: Array<Record<string, unknown>>;
};

function statusTone(status?: string) {
  switch (status) {
    case "ok":
      return "bg-emerald-500/15 text-emerald-300";
    case "needs_topup":
      return "bg-amber-500/15 text-amber-300";
    case "error":
      return "bg-red-500/15 text-red-300";
    default:
      return "bg-white/5 text-muted";
  }
}

export default function DashboardPage() {
  const [ops, setOps] = useState<Ops | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<Ops>("/admin/ops");
      setOps(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ops");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const summary = ops?.summary || {};

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Ops board</h1>
          <p className="text-muted text-sm mt-1">
            Live API health, consumption, and subscriptions
            {ops?.generatedAt ? ` · updated ${new Date(ops.generatedAt).toLocaleTimeString()}` : ""}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {error ? (
        <div className="panel p-4 text-[var(--bad)]">{error}</div>
      ) : null}

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(
          [
            ["Users", summary.users],
            ["Premium", summary.premiumSubscribers],
            ["Credits spent 24h", summary.creditsSpent24h],
            ["Active jobs", summary.activeJobs],
          ] as Array<[string, unknown]>
        ).map(([label, value]) => (
          <div key={label} className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
            <p className="text-2xl font-semibold mt-2">{String(value ?? "—")}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Buy / top up now</h2>
        {(ops?.buyNow || []).length === 0 ? (
          <div className="panel p-4 text-emerald-300">No urgent API top-ups detected.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {(ops?.buyNow || []).map((p) => (
              <div key={String(p.id)} className="panel p-4 border-amber-500/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-amber-300">{String(p.name)}</p>
                    <p className="text-sm text-muted mt-1">{String(p.reason)}</p>
                  </div>
                  <a
                    className="btn btn-primary"
                    href={String(p.buyUrl)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Buy
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Provider health</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {(ops?.providers || []).map((p) => (
            <div key={String(p.id)} className="panel p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{String(p.name)}</p>
                <span className={`badge ${statusTone(String(p.status))}`}>
                  {String(p.status)}
                </span>
              </div>
              <p className="text-sm text-muted mt-2">{String(p.message)}</p>
              <div className="mt-3 flex gap-2">
                <a
                  className="btn btn-ghost text-xs"
                  href={String(p.buyUrl)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {p.mustBuy ? "Buy / top up" : "Open billing"}
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="panel p-4">
          <h2 className="font-semibold mb-3">Live active users</h2>
          <div className="space-y-2 max-h-80 overflow-auto">
            {(ops?.liveActiveUsers || []).length === 0 ? (
              <p className="text-muted text-sm">No jobs processing</p>
            ) : (
              (ops?.liveActiveUsers || []).map((u) => (
                <div key={String(u.jobId)} className="rounded-xl border border-line p-3 text-sm">
                  <p className="font-medium">{String(u.email)}</p>
                  <p className="text-muted">
                    {String(u.jobType)} · {String(u.status)} · {String(u.progress)}% · cost{" "}
                    {String(u.creditsCost)} · bal {String(u.creditBalance)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="panel p-4">
          <h2 className="font-semibold mb-3">Top consumers (7d)</h2>
          <div className="space-y-2 max-h-80 overflow-auto">
            {(ops?.topConsumers7d || []).map((u) => (
              <div key={String(u.userId)} className="flex justify-between text-sm border-b border-line/60 py-2">
                <div>
                  <p>{String(u.email)}</p>
                  <p className="text-muted text-xs">
                    {String(u.plan)} · wallet {String(u.creditBalance)}
                  </p>
                </div>
                <p className="text-amber-300">-{String(u.creditsSpent)} cr</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="font-semibold mb-3">Billing failures</h2>
        {(ops?.billingFailures || []).length === 0 ? (
          <p className="text-muted text-sm">None in last 7 days</p>
        ) : (
          <div className="space-y-2">
            {(ops?.billingFailures || []).map((f) => (
              <div key={String(f.id)} className="text-sm border border-red-500/30 rounded-xl p-3">
                <p className="text-red-300">
                  {String(f.provider)} · {String(f.jobType)}
                </p>
                <p className="text-muted mt-1">{String(f.errorMessage)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
