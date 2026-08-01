import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type PlanPack = {
  id: string;
  name: string;
  priceInr: number;
  credits: number;
  description: string;
  popular?: boolean;
  stripePriceId?: string | null;
};

/** Customer + admin facing module row (no margin / COGS). */
export type ModuleCredit = {
  key: string;
  module: string;
  description: string;
  credits: number;
  durationSec?: number;
  audience: 'customer' | 'admin' | 'both';
};

const PRICING_KEY = 'billing.pricing';
/** Internal only — never exposed on customer APIs or admin UI copy. */
const DEFAULT_MARGIN = 55;

const MODULE_META: Record<
  string,
  { module: string; description: string; durationSec?: number }
> = {
  IMAGE_GEN: {
    module: 'Image generation',
    description: 'Logo, fashion, Ghibli, anime, product, poster, etc.',
  },
  BRAND_KIT: {
    module: 'Brand kit',
    description: 'Two branded images in one run',
  },
  PPT: {
    module: 'PPT maker',
    description: 'AI outline → downloadable .pptx',
  },
  SCRIPT: {
    module: 'Script',
    description: 'Script / scene writing',
  },
  VOICE: {
    module: 'Voice narration',
    description: 'TTS voice-over (usually bundled in video)',
  },
  STYLIZE: {
    module: 'Stylize',
    description: 'Style transfer / enhance',
  },
  IMAGE_TO_VIDEO: {
    module: 'Image → short clip',
    description: 'Single ~10s clip from an image',
    durationSec: 10,
  },
  TEXT_TO_VIDEO: {
    module: 'Text → short clip',
    description: 'Single short clip from text',
  },
  STORY_10: {
    module: 'Video 10 seconds',
    description: 'Scripted scenes + automatic voice',
    durationSec: 10,
  },
  STORY_30: {
    module: 'Video 30 seconds',
    description: 'Scripted scenes + automatic voice',
    durationSec: 30,
  },
  STORY_60: {
    module: 'Video 60 seconds',
    description: 'Scripted scenes + automatic voice',
    durationSec: 60,
  },
  BG_REMOVE: {
    module: 'Background remove',
    description: 'Cut out subject from image',
  },
  EDIT: {
    module: 'Edit tools',
    description: 'Trim / merge / crop / filter / export',
  },
};

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);
  private cache: {
    marginPercent: number;
    retailCreditInr: number;
    costs: Record<string, number>;
    plans: PlanPack[];
    providerCosts: Record<string, number>;
  } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Internal: userCredits = ceil(providerCost / (retail * (1 - margin))) */
  static creditsForCost(
    providerCostInr: number,
    retailCreditInr = 1,
    marginPercent = DEFAULT_MARGIN,
  ) {
    const keep = Math.max(0.05, 1 - marginPercent / 100);
    const denom = retailCreditInr * keep;
    return Math.max(1, Math.ceil(providerCostInr / denom));
  }

  private defaults() {
    const marginPercent =
      parseInt(process.env.BILLING_MARGIN_PERCENT ?? String(DEFAULT_MARGIN), 10) ||
      DEFAULT_MARGIN;
    const retailCreditInr = parseFloat(process.env.CREDIT_INR ?? '1') || 1;

    // Provider INR estimates (internal). User credits computed at 55% cut.
    const providerCosts: Record<string, number> = {
      IMAGE_GEN: 1.6,
      BRAND_KIT: 3.2,
      SCRIPT: 0.8,
      VOICE: 1.2,
      PPT: 2.0,
      STYLIZE: 2.0,
      IMAGE_TO_VIDEO: 6.0,
      TEXT_TO_VIDEO: 8.0,
      STORY_10: 11.0,
      STORY_30: 22.0,
      STORY_60: 42.0,
      BG_REMOVE: 1.2,
      EDIT: 0.8,
    };

    const costs: Record<string, number> = {};
    for (const [key, inr] of Object.entries(providerCosts)) {
      costs[key] = PricingService.creditsForCost(
        inr,
        retailCreditInr,
        marginPercent,
      );
    }

    // Legacy env absolute overrides (user credits)
    const envMap: Record<string, string> = {
      IMAGE_GEN: 'credits.imageGenCost',
      SCRIPT: 'credits.scriptCost',
      VOICE: 'credits.voiceCost',
      STYLIZE: 'credits.stylizeCost',
      IMAGE_TO_VIDEO: 'credits.imageToVideoCost',
      TEXT_TO_VIDEO: 'credits.textToVideoCost',
    };
    for (const [key, cfg] of Object.entries(envMap)) {
      const v = this.config.get<number>(cfg);
      if (v && v > 0) costs[key] = v;
    }

    // Migrate old keys if present in saved config later
    costs.STORY_15 = costs.STORY_10;
    costs.STORY_59 = costs.STORY_60;

    const plans: PlanPack[] = [
      {
        id: 'creator',
        name: 'Creator',
        priceInr: 499,
        credits: 499,
        description: 'Images, PPT & short videos',
        popular: false,
      },
      {
        id: 'pro',
        name: 'Pro',
        priceInr: 999,
        credits: 999,
        description: 'Best for 10–30s story videos with voice',
        popular: true,
      },
      {
        id: 'studio',
        name: 'Studio',
        priceInr: 2499,
        credits: 2499,
        description: 'Heavy creators — 60s reels & frequent exports',
        popular: false,
      },
    ];

    return { marginPercent, retailCreditInr, costs, plans, providerCosts };
  }

  async getConfig() {
    if (this.cache) return this.cache;
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: PRICING_KEY },
    });
    const base = this.defaults();
    if (!row?.value || typeof row.value !== 'object') {
      this.cache = {
        marginPercent: base.marginPercent,
        retailCreditInr: base.retailCreditInr,
        costs: base.costs,
        plans: base.plans,
        providerCosts: base.providerCosts,
      };
      return this.cache;
    }
    const v = row.value as Record<string, unknown>;
    const savedCosts = (v.costs as Record<string, number>) || {};
    const costs = { ...base.costs, ...savedCosts };
    // Alias legacy → new
    if (savedCosts.STORY_15 != null && savedCosts.STORY_10 == null) {
      costs.STORY_10 = savedCosts.STORY_15;
    }
    if (savedCosts.STORY_59 != null && savedCosts.STORY_60 == null) {
      costs.STORY_60 = savedCosts.STORY_59;
    }
    costs.STORY_15 = costs.STORY_10;
    costs.STORY_59 = costs.STORY_60;

    this.cache = {
      marginPercent: Number(v.marginPercent) || base.marginPercent,
      retailCreditInr: Number(v.retailCreditInr) || base.retailCreditInr,
      costs,
      plans: Array.isArray(v.plans) ? (v.plans as PlanPack[]) : base.plans,
      providerCosts: {
        ...base.providerCosts,
        ...((v.providerCosts as Record<string, number>) || {}),
      },
    };
    return this.cache;
  }

  async saveConfig(input: {
    marginPercent?: number;
    retailCreditInr?: number;
    costs?: Record<string, number>;
    providerCosts?: Record<string, number>;
    plans?: PlanPack[];
    recomputeFromProviderCosts?: boolean;
  }) {
    const current = await this.getConfig();
    const defaults = this.defaults();
    // Internal cut is fixed at 55% (not shown in any UI / public API).
    const marginPercent =
      parseInt(process.env.BILLING_MARGIN_PERCENT ?? String(DEFAULT_MARGIN), 10) ||
      DEFAULT_MARGIN;

    let retailCreditInr = input.retailCreditInr ?? current.retailCreditInr;
    let costs = { ...current.costs, ...(input.costs || {}) };
    let providerCosts = {
      ...current.providerCosts,
      ...(input.providerCosts || {}),
    };

    if (input.recomputeFromProviderCosts) {
      costs = { ...costs };
      for (const [key, inr] of Object.entries(providerCosts)) {
        costs[key] = PricingService.creditsForCost(
          Number(inr),
          retailCreditInr,
          marginPercent,
        );
      }
    }

    costs.STORY_15 = costs.STORY_10 ?? costs.STORY_15;
    costs.STORY_59 = costs.STORY_60 ?? costs.STORY_59;

    const plans = input.plans ?? current.plans;
    const value = {
      marginPercent,
      retailCreditInr,
      costs,
      plans,
      providerCosts,
      updatedAt: new Date().toISOString(),
    };

    await this.prisma.systemSetting.upsert({
      where: { key: PRICING_KEY },
      create: {
        key: PRICING_KEY,
        value: value as Prisma.InputJsonValue,
        description: 'Credit prices per module + subscription packs',
        isPublic: true,
      },
      update: {
        value: value as Prisma.InputJsonValue,
      },
    });
    this.cache = {
      marginPercent,
      retailCreditInr,
      costs,
      plans,
      providerCosts,
    };
    this.logger.log(`Pricing saved retail=₹${retailCreditInr}/credit`);
    return this.publicPricing();
  }

  async costFor(key: string, fallback?: number) {
    const cfg = await this.getConfig();
    if (cfg.costs[key] != null) return cfg.costs[key];
    if (fallback != null) return fallback;
    return 5;
  }

  async storyKeyForDuration(durationSec: number) {
    if (durationSec <= 10) return 'STORY_10';
    if (durationSec <= 30) return 'STORY_30';
    return 'STORY_60';
  }

  async storyCredits(durationSec: number) {
    const key = await this.storyKeyForDuration(durationSec);
    const fallback = durationSec <= 10 ? 25 : durationSec <= 30 ? 50 : 95;
    return this.costFor(key, fallback);
  }

  private moduleRows(cfg: Awaited<ReturnType<PricingService['getConfig']>>): ModuleCredit[] {
    const order = [
      'STORY_10',
      'STORY_30',
      'STORY_60',
      'IMAGE_GEN',
      'BRAND_KIT',
      'PPT',
      'IMAGE_TO_VIDEO',
      'TEXT_TO_VIDEO',
      'SCRIPT',
      'VOICE',
      'STYLIZE',
      'BG_REMOVE',
      'EDIT',
    ];
    return order
      .filter((key) => cfg.costs[key] != null || MODULE_META[key])
      .map((key) => {
        const meta = MODULE_META[key] || {
          module: key.replace(/_/g, ' '),
          description: '',
        };
        return {
          key,
          module: meta.module,
          description: meta.description,
          credits: cfg.costs[key] ?? 1,
          durationSec: meta.durationSec,
          audience: 'both' as const,
        };
      });
  }

  /**
   * Customer-safe catalog — credit costs only.
   * Never includes margin, COGS, or provider INR.
   */
  async publicPricing() {
    const cfg = await this.getConfig();
    const modules = this.moduleRows(cfg);
    const byKey = Object.fromEntries(modules.map((m) => [m.key, m.credits]));
    return {
      retailCreditInr: cfg.retailCreditInr,
      modules,
      video: {
        '10s': byKey.STORY_10,
        '30s': byKey.STORY_30,
        '60s': byKey.STORY_60,
      },
      byModule: byKey,
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
        image: byKey.IMAGE_GEN,
        video10s: byKey.STORY_10,
        video30s: byKey.STORY_30,
        video60s: byKey.STORY_60,
        ppt: byKey.PPT,
      },
      // legacy shape for older clients (credits only)
      costs: modules.map((m) => ({
        key: m.key,
        label: m.module,
        userCredits: m.credits,
      })),
    };
  }

  /** Admin catalog — same transparent credits; no margin fields. */
  async adminPricing() {
    const pub = await this.publicPricing();
    const cfg = await this.getConfig();
    return {
      ...pub,
      note: 'Edit credits charged to customers per module. Changes apply immediately in the app.',
      // Keep for PATCH recompute only — not for UI display
      _internal: {
        canRecomputeDefaults: true,
      },
      retailCreditInr: cfg.retailCreditInr,
    };
  }

  invalidate() {
    this.cache = null;
  }
}
