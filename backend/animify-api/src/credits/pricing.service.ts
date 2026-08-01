import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_QUALITY_TIERS,
  QualityTierDef,
  QualityTierId,
  normalizeQualityTier,
} from './quality-tiers';

export type PlanPack = {
  id: string;
  name: string;
  priceInr: number;
  credits: number;
  description: string;
  popular?: boolean;
  stripePriceId?: string | null;
};

export type ModuleCredit = {
  key: string;
  module: string;
  description: string;
  credits: number;
  durationSec?: number;
  tier?: QualityTierId;
  audience: 'customer' | 'admin' | 'both';
};

const PRICING_KEY = 'billing.pricing';
const DEFAULT_MARGIN = 55;

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);
  private cache: {
    marginPercent: number;
    retailCreditInr: number;
    costs: Record<string, number>;
    plans: PlanPack[];
    tiers: QualityTierDef[];
  } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  static creditsForCost(
    providerCostInr: number,
    retailCreditInr = 1,
    marginPercent = DEFAULT_MARGIN,
  ) {
    const keep = Math.max(0.05, 1 - marginPercent / 100);
    return Math.max(1, Math.ceil(providerCostInr / (retailCreditInr * keep)));
  }

  private defaults() {
    const marginPercent =
      parseInt(process.env.BILLING_MARGIN_PERCENT ?? String(DEFAULT_MARGIN), 10) ||
      DEFAULT_MARGIN;
    const retailCreditInr = parseFloat(process.env.CREDIT_INR ?? '1') || 1;
    const tiers = DEFAULT_QUALITY_TIERS.map((t) => ({ ...t }));
    const economy = tiers.find((t) => t.id === 'economy')!;

    // Flat costs = economy defaults (backward compatible keys)
    const costs: Record<string, number> = {
      IMAGE_GEN: economy.imageCredits,
      BRAND_KIT: economy.imageCredits * 2,
      SCRIPT: 2,
      VOICE: 3,
      PPT: 5,
      STYLIZE: 5,
      IMAGE_TO_VIDEO: economy.storyCredits[10],
      TEXT_TO_VIDEO: economy.storyCredits[10],
      STORY_10: economy.storyCredits[10],
      STORY_30: economy.storyCredits[30],
      STORY_60: economy.storyCredits[60],
      STORY_15: economy.storyCredits[10],
      STORY_59: economy.storyCredits[60],
      BG_REMOVE: 3,
      EDIT: 2,
    };

    const plans: PlanPack[] = [
      {
        id: 'creator',
        name: 'Creator',
        priceInr: 499,
        credits: 499,
        description: 'Economy videos + images',
        popular: false,
      },
      {
        id: 'pro',
        name: 'Pro',
        priceInr: 999,
        credits: 999,
        description: 'Standard quality videos',
        popular: true,
      },
      {
        id: 'studio',
        name: 'Studio',
        priceInr: 2499,
        credits: 2499,
        description: 'Premium cinema videos',
        popular: false,
      },
    ];

    return { marginPercent, retailCreditInr, costs, plans, tiers };
  }

  async getConfig() {
    if (this.cache) return this.cache;
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: PRICING_KEY },
    });
    const base = this.defaults();
    if (!row?.value || typeof row.value !== 'object') {
      this.cache = { ...base };
      return this.cache;
    }
    const v = row.value as Record<string, unknown>;
    const savedTiers = Array.isArray(v.tiers)
      ? (v.tiers as QualityTierDef[])
      : null;
    const tiers = this.mergeTiers(base.tiers, savedTiers);
    const costs = {
      ...base.costs,
      ...((v.costs as Record<string, number>) || {}),
    };
    // Keep flat STORY_* in sync with economy if not explicitly overridden
    const eco = tiers.find((t) => t.id === 'economy')!;
    if (!(v.costs as Record<string, number>)?.STORY_10) {
      costs.STORY_10 = eco.storyCredits[10];
      costs.STORY_30 = eco.storyCredits[30];
      costs.STORY_60 = eco.storyCredits[60];
    }
    costs.STORY_15 = costs.STORY_10;
    costs.STORY_59 = costs.STORY_60;

    this.cache = {
      marginPercent: Number(v.marginPercent) || base.marginPercent,
      retailCreditInr: Number(v.retailCreditInr) || base.retailCreditInr,
      costs,
      plans: Array.isArray(v.plans) ? (v.plans as PlanPack[]) : base.plans,
      tiers,
    };
    return this.cache;
  }

  private mergeTiers(
    defaults: QualityTierDef[],
    saved: QualityTierDef[] | null,
  ): QualityTierDef[] {
    if (!saved?.length) return defaults.map((t) => ({ ...t }));
    return defaults.map((d) => {
      const s = saved.find((x) => x.id === d.id);
      if (!s) return { ...d };
      return {
        ...d,
        ...s,
        id: d.id,
        storyCredits: {
          10: Number(s.storyCredits?.[10] ?? d.storyCredits[10]),
          30: Number(s.storyCredits?.[30] ?? d.storyCredits[30]),
          60: Number(s.storyCredits?.[60] ?? d.storyCredits[60]),
        },
        imageCredits: Number(s.imageCredits ?? d.imageCredits),
      };
    });
  }

  async saveConfig(input: {
    retailCreditInr?: number;
    costs?: Record<string, number>;
    plans?: PlanPack[];
    tiers?: QualityTierDef[];
    recomputeFromProviderCosts?: boolean;
    marginPercent?: number;
    providerCosts?: Record<string, number>;
  }) {
    const current = await this.getConfig();
    const marginPercent =
      parseInt(process.env.BILLING_MARGIN_PERCENT ?? String(DEFAULT_MARGIN), 10) ||
      DEFAULT_MARGIN;
    const retailCreditInr = input.retailCreditInr ?? current.retailCreditInr;
    let tiers = this.mergeTiers(current.tiers, input.tiers || null);
    if (input.tiers?.length) {
      tiers = this.mergeTiers(DEFAULT_QUALITY_TIERS, input.tiers);
    }

    let costs = { ...current.costs, ...(input.costs || {}) };
    const eco = tiers.find((t) => t.id === 'economy')!;
    // Flat keys follow economy (default path) unless admin overrode via costs
    if (!input.costs?.STORY_10) costs.STORY_10 = eco.storyCredits[10];
    if (!input.costs?.STORY_30) costs.STORY_30 = eco.storyCredits[30];
    if (!input.costs?.STORY_60) costs.STORY_60 = eco.storyCredits[60];
    if (!input.costs?.IMAGE_GEN) costs.IMAGE_GEN = eco.imageCredits;
    costs.STORY_15 = costs.STORY_10;
    costs.STORY_59 = costs.STORY_60;

    if (input.recomputeFromProviderCosts) {
      tiers = DEFAULT_QUALITY_TIERS.map((t) => ({ ...t }));
      costs.STORY_10 = tiers[0].storyCredits[10];
      costs.STORY_30 = tiers[0].storyCredits[30];
      costs.STORY_60 = tiers[0].storyCredits[60];
      costs.IMAGE_GEN = tiers[0].imageCredits;
    }

    const plans = input.plans ?? current.plans;
    const value = {
      marginPercent,
      retailCreditInr,
      costs,
      plans,
      tiers,
      updatedAt: new Date().toISOString(),
    };

    await this.prisma.systemSetting.upsert({
      where: { key: PRICING_KEY },
      create: {
        key: PRICING_KEY,
        value: value as Prisma.InputJsonValue,
        description: 'Credit prices, quality tiers, subscription packs',
        isPublic: true,
      },
      update: { value: value as Prisma.InputJsonValue },
    });
    this.cache = {
      marginPercent,
      retailCreditInr,
      costs,
      plans,
      tiers,
    };
    this.logger.log('Pricing + quality tiers saved');
    return this.publicPricing();
  }

  async costFor(key: string, fallback?: number) {
    const cfg = await this.getConfig();
    if (cfg.costs[key] != null) return cfg.costs[key];
    if (fallback != null) return fallback;
    return 5;
  }

  async getTier(tierId?: string | null): Promise<QualityTierDef> {
    const cfg = await this.getConfig();
    const id = normalizeQualityTier(tierId);
    return cfg.tiers.find((t) => t.id === id) || cfg.tiers[0];
  }

  async storyCredits(durationSec: number, tierId?: string | null) {
    const tier = await this.getTier(tierId);
    const d =
      durationSec <= 10 ? 10 : durationSec <= 30 ? 30 : (60 as 10 | 30 | 60);
    return tier.storyCredits[d];
  }

  async imageCredits(tierId?: string | null) {
    const tier = await this.getTier(tierId);
    return tier.imageCredits;
  }

  async publicPricing() {
    const cfg = await this.getConfig();
    const defaultTier =
      cfg.tiers.find((t) => t.default) || cfg.tiers[0] || DEFAULT_QUALITY_TIERS[0];

    const modules: ModuleCredit[] = [];
    for (const tier of cfg.tiers) {
      for (const dur of [10, 30, 60] as const) {
        modules.push({
          key: `STORY_${dur}_${tier.id}`,
          module: `Video ${dur}s · ${tier.name}`,
          description: tier.tagline,
          credits: tier.storyCredits[dur],
          durationSec: dur,
          tier: tier.id,
          audience: 'both',
        });
      }
      modules.push({
        key: `IMAGE_GEN_${tier.id}`,
        module: `Image · ${tier.name}`,
        description: tier.tagline,
        credits: tier.imageCredits,
        tier: tier.id,
        audience: 'both',
      });
    }
    modules.push(
      {
        key: 'PPT',
        module: 'PPT maker',
        description: 'AI outline → .pptx',
        credits: cfg.costs.PPT ?? 5,
        audience: 'both',
      },
      {
        key: 'SCRIPT',
        module: 'Script',
        description: 'Script writing',
        credits: cfg.costs.SCRIPT ?? 2,
        audience: 'both',
      },
    );

    const videoByTier = Object.fromEntries(
      cfg.tiers.map((t) => [
        t.id,
        {
          '10s': t.storyCredits[10],
          '30s': t.storyCredits[30],
          '60s': t.storyCredits[60],
          image: t.imageCredits,
        },
      ]),
    );

    return {
      retailCreditInr: cfg.retailCreditInr,
      defaultTier: defaultTier.id,
      tiers: cfg.tiers.map((t) => ({
        id: t.id,
        name: t.name,
        tagline: t.tagline,
        default: !!t.default,
        engine: t.engine,
        videoModelT2v: t.videoModelT2v,
        videoModelI2v: t.videoModelI2v,
        imageModel: t.imageModel,
        storyCredits: t.storyCredits,
        imageCredits: t.imageCredits,
        video: {
          '10s': t.storyCredits[10],
          '30s': t.storyCredits[30],
          '60s': t.storyCredits[60],
        },
      })),
      video: {
        '10s': defaultTier.storyCredits[10],
        '30s': defaultTier.storyCredits[30],
        '60s': defaultTier.storyCredits[60],
      },
      videoByTier,
      modules,
      byModule: Object.fromEntries(modules.map((m) => [m.key, m.credits])),
      plans: cfg.plans.map((p) => ({
        id: p.id,
        name: p.name,
        priceInr: p.priceInr,
        credits: p.credits,
        description: p.description,
        popular: p.popular,
        stripePriceId: p.stripePriceId,
      })),
      examples: {
        image: defaultTier.imageCredits,
        video10s: defaultTier.storyCredits[10],
        video30s: defaultTier.storyCredits[30],
        video60s: defaultTier.storyCredits[60],
        ppt: cfg.costs.PPT ?? 5,
      },
      costs: modules.map((m) => ({
        key: m.key,
        label: m.module,
        userCredits: m.credits,
      })),
    };
  }

  async adminPricing() {
    const pub = await this.publicPricing();
    return {
      ...pub,
      note: 'Economy is default (cheap). Users can pick Standard/Premium and pay more credits. Edit credits & model slugs per tier.',
    };
  }

  invalidate() {
    this.cache = null;
  }
}
