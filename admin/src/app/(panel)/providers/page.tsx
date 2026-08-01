"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Provider = {
  id: string;
  name: string;
  status: string;
  message: string;
  buyUrl: string;
  usedFor?: string[];
  mustBuy?: boolean;
  configured?: boolean;
};

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ providers: Provider[] }>("/admin/ops")
      .then((d) => setProviders(d.providers || []))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl md:text-4xl">Buy APIs</h1>
        <p className="text-muted text-sm mt-1">
          You pay these providers. Users spend Animify wallet credits. Top up anything marked needs_topup.
        </p>
      </header>
      {error ? <div className="panel p-4 text-[var(--bad)]">{error}</div> : null}
      <div className="grid md:grid-cols-2 gap-4">
        {providers.map((p) => (
          <article key={p.id} className="panel p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-semibold">{p.name}</h2>
              <span className="badge bg-white/5 text-muted">{p.status}</span>
            </div>
            <p className="text-sm text-muted">{p.message}</p>
            <p className="text-xs text-muted">
              Used for: {(p.usedFor || []).join(", ") || "—"}
            </p>
            <a
              href={p.buyUrl}
              target="_blank"
              rel="noreferrer"
              className={`btn ${p.mustBuy || p.status === "needs_topup" ? "btn-primary" : "btn-ghost"}`}
            >
              {p.mustBuy || p.status === "needs_topup" ? "Buy / top up now" : "Open dashboard"}
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}
