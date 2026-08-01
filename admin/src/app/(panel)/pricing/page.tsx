"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Tier = {
  id: string;
  name: string;
  tagline: string;
  default?: boolean;
  videoModelT2v: string;
  videoModelI2v: string;
  imageModel: string;
  storyCredits: { 10: number; 30: number; 60: number };
  imageCredits: number;
};

type Pricing = {
  defaultTier: string;
  tiers: Tier[];
  plans: Array<{
    id: string;
    name: string;
    priceInr: number;
    credits: number;
    description: string;
    popular?: boolean;
  }>;
  note?: string;
};

export default function PricingPage() {
  const [data, setData] = useState<Pricing | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await api<Pricing>("/admin/pricing");
      setData(p);
      setTiers(p.tiers || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pricing");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function updateTier(
    id: string,
    patch: Partial<Tier> | ((t: Tier) => Partial<Tier>),
  ) {
    setTiers((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const p = typeof patch === "function" ? patch(t) : patch;
        return { ...t, ...p };
      }),
    );
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/admin/pricing", {
        method: "PATCH",
        body: JSON.stringify({ tiers }),
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
        <h1 className="font-display text-3xl md:text-4xl">Quality & credits</h1>
        <p className="text-muted text-sm mt-1">
          Default is <strong className="text-white">Economy (cheap)</strong>.
          Users can pick Standard / Premium and pay more credits. Edit rates and
          model slugs here.
        </p>
        {data?.note ? (
          <p className="text-xs text-muted mt-2">{data.note}</p>
        ) : null}
      </header>

      {error ? <div className="panel p-4 text-[var(--bad)]">{error}</div> : null}

      <form onSubmit={save} className="space-y-4">
        {tiers.map((t) => (
          <div key={t.id} className="panel p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl">
                  {t.name}
                  {t.default ? (
                    <span className="ml-2 text-xs text-accent uppercase tracking-wide">
                      default
                    </span>
                  ) : null}
                </h2>
                <p className="text-sm text-muted">{t.tagline}</p>
              </div>
              <p className="text-xs text-muted font-mono">{t.id}</p>
            </div>

            <div className="grid sm:grid-cols-4 gap-3">
              {([10, 30, 60] as const).map((d) => (
                <label key={d} className="block space-y-1">
                  <span className="text-xs text-muted">{d}s video credits</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={t.storyCredits[d]}
                    onChange={(e) =>
                      updateTier(t.id, {
                        storyCredits: {
                          ...t.storyCredits,
                          [d]: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              ))}
              <label className="block space-y-1">
                <span className="text-xs text-muted">Image credits</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={t.imageCredits}
                  onChange={(e) =>
                    updateTier(t.id, { imageCredits: Number(e.target.value) })
                  }
                />
              </label>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <label className="block space-y-1">
                <span className="text-xs text-muted">T2V model</span>
                <input
                  className="input font-mono text-xs"
                  value={t.videoModelT2v}
                  onChange={(e) =>
                    updateTier(t.id, { videoModelT2v: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted">I2V model</span>
                <input
                  className="input font-mono text-xs"
                  value={t.videoModelI2v}
                  onChange={(e) =>
                    updateTier(t.id, { videoModelI2v: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted">Image model</span>
                <input
                  className="input font-mono text-xs"
                  value={t.imageModel}
                  onChange={(e) =>
                    updateTier(t.id, { imageModel: e.target.value })
                  }
                />
              </label>
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save tiers"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={resetDefaults}
          >
            Reset defaults
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Subscription packs</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {(data?.plans || []).map((p) => (
            <div key={p.id} className="panel p-5 space-y-2">
              <h3 className="font-display text-xl">{p.name}</h3>
              <p className="text-2xl font-semibold">
                ₹{p.priceInr}
                <span className="text-sm text-muted font-normal">/mo</span>
              </p>
              <p className="text-accent">{p.credits} credits</p>
              <p className="text-xs text-muted">{p.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
