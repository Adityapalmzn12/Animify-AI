import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const OWNER_WALLET_KEY = 'billing.owner_wallet';
const API_RESERVE_KEY = 'billing.api_reserve';
const DEFAULT_MARGIN = 55;

const PROVIDER_BUY: Record<
  string,
  { name: string; buyUrl: string; usedFor: string }
> = {
  replicate: {
    name: 'Replicate',
    buyUrl: 'https://replicate.com/account/billing',
    usedFor: 'Video + images (primary)',
  },
  openai: {
    name: 'OpenAI',
    buyUrl:
      'https://platform.openai.com/settings/organization/billing/overview',
    usedFor: 'Scripts + voice TTS',
  },
  fal: {
    name: 'Fal',
    buyUrl: 'https://fal.ai/dashboard/billing',
    usedFor: 'Backup video/image (optional)',
  },
};

export type PurchaseSplitInput = {
  buyerUserId: string;
  grossInr: number;
  creditsGranted?: number;
  source: 'wallet_topup' | 'subscription' | 'renewal' | 'promo';
  paymentId?: string | null;
  providerId?: string | null;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  marginPercent() {
    return (
      parseInt(
        process.env.BILLING_MARGIN_PERCENT ?? String(DEFAULT_MARGIN),
        10,
      ) || DEFAULT_MARGIN
    );
  }

  async resolveOwnerUserId(): Promise<string | null> {
    const email =
      this.config.get<string>('OWNER_USER_EMAIL') ||
      process.env.OWNER_USER_EMAIL ||
      'adityapalmzn12@gmail.com';
    const byEmail = await this.prisma.user.findUnique({ where: { email } });
    if (byEmail) return byEmail.id;
    const admin = await this.prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
      orderBy: { createdAt: 'asc' },
    });
    return admin?.id || null;
  }

  /** Usage weights from last 7 days of jobs (which API users hit most). */
  async providerUsageWeights() {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.videoJob.groupBy({
      by: ['provider'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      _sum: { creditsCost: true },
    });
    const usable = rows.filter((r) =>
      ['replicate', 'openai', 'fal'].includes(
        String(r.provider || '').toLowerCase(),
      ),
    );
    const total = usable.reduce((s, r) => s + r._count.id, 0) || 1;
    const weights: Record<string, number> = {
      replicate: 0.7,
      openai: 0.3,
      fal: 0,
    };
    if (usable.length) {
      for (const k of Object.keys(weights)) weights[k] = 0;
      for (const r of usable) {
        const p = String(r.provider).toLowerCase();
        weights[p] = (weights[p] || 0) + r._count.id / total;
      }
      // If fal disabled / unused, fold into replicate
      if ((weights.fal || 0) < 0.05) {
        weights.replicate = (weights.replicate || 0) + (weights.fal || 0);
        weights.fal = 0;
      }
    }
    return {
      weights,
      jobs: usable.map((r) => ({
        provider: String(r.provider).toLowerCase(),
        jobs: r._count.id,
        credits: r._sum.creditsCost || 0,
        sharePercent: Math.round((r._count.id / total) * 100),
      })),
    };
  }

  /**
   * Auto-allocate 45% API budget across providers by usage.
   * Creates pending "buy this much" actions for admin.
   */
  async allocateApiBudget(apiBudgetInr: number, meta?: Record<string, unknown>) {
    if (apiBudgetInr <= 0) return null;
    const { weights } = await this.providerUsageWeights();
    const falOn =
      String(this.config.get('ai.fal.enabled') || process.env.FAL_ENABLED || '')
        .toLowerCase() === 'true';

    const allocation: Record<string, number> = {};
    let remaining = apiBudgetInr;
    const keys = falOn
      ? ['replicate', 'openai', 'fal']
      : ['replicate', 'openai'];
    const wSum = keys.reduce((s, k) => s + (weights[k] || 0), 0) || 1;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const share =
        i === keys.length - 1
          ? remaining
          : Math.round(((weights[k] || 0) / wSum) * apiBudgetInr * 100) / 100;
      allocation[k] = Math.max(0, share);
      remaining = Math.round((remaining - share) * 100) / 100;
    }

    const row = await this.prisma.systemSetting.findUnique({
      where: { key: API_RESERVE_KEY },
    });
    const prev = (row?.value || {}) as {
      availableInr?: number;
      spentInr?: number;
      byProvider?: Record<string, { pendingInr: number; purchasedInr: number }>;
      pendingBuys?: Array<Record<string, unknown>>;
    };
    const byProvider = { ...(prev.byProvider || {}) };
    for (const [k, amt] of Object.entries(allocation)) {
      const cur = byProvider[k] || { pendingInr: 0, purchasedInr: 0 };
      byProvider[k] = {
        pendingInr: Math.round((cur.pendingInr + amt) * 100) / 100,
        purchasedInr: cur.purchasedInr || 0,
      };
    }
    const pendingBuys = Object.entries(byProvider)
      .filter(([, v]) => v.pendingInr >= 1)
      .map(([provider, v]) => ({
        provider,
        name: PROVIDER_BUY[provider]?.name || provider,
        amountInr: v.pendingInr,
        buyUrl: PROVIDER_BUY[provider]?.buyUrl || '',
        usedFor: PROVIDER_BUY[provider]?.usedFor || '',
        action: `Top up ~₹${v.pendingInr} so users keep generating`,
      }))
      .sort((a, b) => b.amountInr - a.amountInr);

    const next = {
      availableInr:
        Math.round(
          (Number(prev.availableInr || 0) + apiBudgetInr) * 100,
        ) / 100,
      spentInr: Number(prev.spentInr || 0),
      byProvider,
      pendingBuys,
      lastAllocation: {
        amountInr: apiBudgetInr,
        allocation,
        at: new Date().toISOString(),
        ...meta,
      },
      updatedAt: new Date().toISOString(),
    };

    await this.prisma.systemSetting.upsert({
      where: { key: API_RESERVE_KEY },
      create: {
        key: API_RESERVE_KEY,
        value: next as Prisma.InputJsonValue,
        description:
          '45% of credit sales auto-reserved for API top-ups (Replicate/OpenAI)',
        isPublic: false,
      },
      update: { value: next as Prisma.InputJsonValue },
    });

    this.logger.log(
      `API reserve +₹${apiBudgetInr} allocated ${JSON.stringify(allocation)}`,
    );
    return next;
  }

  /** Admin marked that they topped up a provider from the reserve. */
  async markApiPurchased(provider: string, amountInr: number) {
    const p = String(provider || '').toLowerCase();
    const amount = Math.round(Number(amountInr) * 100) / 100;
    if (!PROVIDER_BUY[p]) throw new BadRequestException('Unknown provider');
    if (amount <= 0) throw new BadRequestException('amount must be > 0');

    const row = await this.prisma.systemSetting.findUnique({
      where: { key: API_RESERVE_KEY },
    });
    const prev = (row?.value || {}) as {
      availableInr?: number;
      spentInr?: number;
      byProvider?: Record<string, { pendingInr: number; purchasedInr: number }>;
    };
    const cur = prev.byProvider?.[p] || { pendingInr: 0, purchasedInr: 0 };
    const apply = Math.min(amount, cur.pendingInr || amount);
    const byProvider = {
      ...(prev.byProvider || {}),
      [p]: {
        pendingInr: Math.max(0, Math.round((cur.pendingInr - apply) * 100) / 100),
        purchasedInr: Math.round((cur.purchasedInr + apply) * 100) / 100,
      },
    };
    const pendingBuys = Object.entries(byProvider)
      .filter(([, v]) => v.pendingInr >= 1)
      .map(([providerId, v]) => ({
        provider: providerId,
        name: PROVIDER_BUY[providerId]?.name || providerId,
        amountInr: v.pendingInr,
        buyUrl: PROVIDER_BUY[providerId]?.buyUrl || '',
        usedFor: PROVIDER_BUY[providerId]?.usedFor || '',
        action: `Top up ~₹${v.pendingInr}`,
      }));

    const next = {
      ...prev,
      availableInr: Math.max(
        0,
        Math.round((Number(prev.availableInr || 0) - apply) * 100) / 100,
      ),
      spentInr: Math.round((Number(prev.spentInr || 0) + apply) * 100) / 100,
      byProvider,
      pendingBuys,
      lastPurchase: {
        provider: p,
        amountInr: apply,
        at: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };

    await this.prisma.systemSetting.upsert({
      where: { key: API_RESERVE_KEY },
      create: {
        key: API_RESERVE_KEY,
        value: next as Prisma.InputJsonValue,
        isPublic: false,
      },
      update: { value: next as Prisma.InputJsonValue },
    });
    return this.summary();
  }

  async recordPurchaseSplit(input: PurchaseSplitInput) {
    const gross = Math.max(0, Math.round(Number(input.grossInr) * 100) / 100);
    if (gross <= 0) {
      this.logger.warn('Skip commission: grossInr <= 0');
      return null;
    }

    const margin = this.marginPercent();
    const commissionInr = Math.round(gross * (margin / 100) * 100) / 100;
    const apiBudgetInr = Math.round((gross - commissionInr) * 100) / 100;
    const ownerUserId = await this.resolveOwnerUserId();

    const entry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.commissionEntry.create({
        data: {
          buyerUserId: input.buyerUserId,
          ownerUserId,
          paymentId: input.paymentId || null,
          source: input.source,
          grossInr: new Prisma.Decimal(gross),
          apiBudgetInr: new Prisma.Decimal(apiBudgetInr),
          commissionInr: new Prisma.Decimal(commissionInr),
          marginPercent: margin,
          creditsGranted: input.creditsGranted || 0,
          currency: 'INR',
          metadata: {
            ...(input.metadata || {}),
            providerId: input.providerId || null,
            autoApiBudget: true,
          } as Prisma.InputJsonValue,
        },
      });

      if (ownerUserId) {
        await tx.user.update({
          where: { id: ownerUserId },
          data: { earningsBalanceInr: { increment: commissionInr } },
        });
      }

      const wallet = await tx.systemSetting.findUnique({
        where: { key: OWNER_WALLET_KEY },
      });
      const prev = (wallet?.value || {}) as Record<string, number>;
      const next = {
        availableCommissionInr:
          Number(prev.availableCommissionInr || 0) + commissionInr,
        lifetimeCommissionInr:
          Number(prev.lifetimeCommissionInr || 0) + commissionInr,
        lifetimeApiBudgetInr:
          Number(prev.lifetimeApiBudgetInr || 0) + apiBudgetInr,
        lifetimeGrossInr: Number(prev.lifetimeGrossInr || 0) + gross,
        withdrawnInr: Number(prev.withdrawnInr || 0),
        marginPercent: margin,
        ownerUserId,
        updatedAt: new Date().toISOString(),
      };
      await tx.systemSetting.upsert({
        where: { key: OWNER_WALLET_KEY },
        create: {
          key: OWNER_WALLET_KEY,
          value: next as Prisma.InputJsonValue,
          description: 'Owner 55% profit from credit sales (admin only)',
          isPublic: false,
        },
        update: { value: next as Prisma.InputJsonValue },
      });

      return created;
    });

    // Auto: reserve 45% for APIs so users can keep generating
    await this.allocateApiBudget(apiBudgetInr, {
      source: input.source,
      buyerUserId: input.buyerUserId,
      creditsGranted: input.creditsGranted || 0,
    });

    this.logger.log(
      `Sale ₹${gross} → profit ₹${commissionInr} (55%) + API reserve ₹${apiBudgetInr} (45%)`,
    );
    return {
      id: entry.id,
      grossInr: gross,
      commissionInr,
      apiBudgetInr,
      marginPercent: margin,
      ownerUserId,
    };
  }

  async summary() {
    const margin = this.marginPercent();
    const ownerUserId = await this.resolveOwnerUserId();
    const owner = ownerUserId
      ? await this.prisma.user.findUnique({
          where: { id: ownerUserId },
          select: {
            id: true,
            email: true,
            name: true,
            earningsBalanceInr: true,
          },
        })
      : null;

    const [walletRow, reserveRow, agg, perUser, usage] = await Promise.all([
      this.prisma.systemSetting.findUnique({ where: { key: OWNER_WALLET_KEY } }),
      this.prisma.systemSetting.findUnique({ where: { key: API_RESERVE_KEY } }),
      this.prisma.commissionEntry.aggregate({
        _sum: { grossInr: true, commissionInr: true, apiBudgetInr: true },
        _count: true,
      }),
      this.prisma.commissionEntry.groupBy({
        by: ['buyerUserId'],
        _sum: { grossInr: true, commissionInr: true, apiBudgetInr: true },
        _count: true,
        orderBy: { _sum: { grossInr: 'desc' } },
        take: 40,
      }),
      this.providerUsageWeights(),
    ]);

    const wallet = (walletRow?.value || {}) as Record<string, number | string>;
    const reserve = (reserveRow?.value || {}) as {
      availableInr?: number;
      spentInr?: number;
      byProvider?: Record<string, { pendingInr: number; purchasedInr: number }>;
      pendingBuys?: Array<Record<string, unknown>>;
    };

    const buyerIds = perUser.map((p) => p.buyerUserId);
    const buyers = await this.prisma.user.findMany({
      where: { id: { in: buyerIds } },
      select: {
        id: true,
        email: true,
        name: true,
        creditBalance: true,
        subscription: { select: { planType: true, status: true } },
      },
    });
    const buyerMap = new Map(buyers.map((b) => [b.id, b]));

    const recent = await this.prisma.commissionEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: {
        buyer: { select: { id: true, email: true, name: true } },
      },
    });

    const pendingBuys = (reserve.pendingBuys || []) as Array<{
      provider: string;
      name: string;
      amountInr: number;
      buyUrl: string;
      usedFor: string;
      action: string;
    }>;

    return {
      // Admin-only — never exposed to mobile app
      adminOnly: true,
      marginPercent: margin,
      split: {
        ownerProfit: `${margin}% → aapke account`,
        apiAutoReserve: `${100 - margin}% → API top-up budget (auto)`,
      },
      owner: owner
        ? {
            id: owner.id,
            email: owner.email,
            name: owner.name,
            profitBalanceInr: Number(owner.earningsBalanceInr),
          }
        : null,
      totals: {
        salesCount: agg._count,
        grossInr: Number(agg._sum.grossInr || 0),
        profitInr: Number(agg._sum.commissionInr || 0),
        apiBudgetInr: Number(agg._sum.apiBudgetInr || 0),
        availableProfitInr: Number(
          wallet.availableCommissionInr ||
            (owner ? Number(owner.earningsBalanceInr) : 0),
        ),
        withdrawnInr: Number(wallet.withdrawnInr || 0),
        apiReserveAvailableInr: Number(reserve.availableInr || 0),
        apiReserveSpentInr: Number(reserve.spentInr || 0),
      },
      /** Per user — kitna aa raha hai */
      revenueByUser: perUser.map((p) => {
        const u = buyerMap.get(p.buyerUserId);
        return {
          userId: p.buyerUserId,
          email: u?.email,
          name: u?.name,
          creditBalance: u?.creditBalance ?? 0,
          plan: u?.subscription?.planType || 'NONE',
          purchases: p._count,
          paidInr: Number(p._sum.grossInr || 0),
          yourProfitInr: Number(p._sum.commissionInr || 0),
          apiBudgetInr: Number(p._sum.apiBudgetInr || 0),
        };
      }),
      /** Kaunsi API zyada use ho rahi hai */
      apiUsage7d: usage.jobs,
      /** Auto: itna API buy karo taaki users chal sakein */
      buyApisNow: pendingBuys.length
        ? pendingBuys
        : Object.entries(PROVIDER_BUY)
            .filter(([id]) => id !== 'fal')
            .map(([id, meta]) => ({
              provider: id,
              name: meta.name,
              amountInr: 0,
              buyUrl: meta.buyUrl,
              usedFor: meta.usedFor,
              action: 'No pending reserve — top up if health shows needs_topup',
            })),
      apiReserveByProvider: reserve.byProvider || {},
      note: 'User app pe kuch nahi dikhta. User credits kharida → 55% aapka profit account mein, 45% auto API reserve mein allocate. Neeche Buy links se Replicate/OpenAI top-up karo.',
      recent: recent.map((r) => ({
        id: r.id,
        source: r.source,
        grossInr: Number(r.grossInr),
        profitInr: Number(r.commissionInr),
        apiBudgetInr: Number(r.apiBudgetInr),
        creditsGranted: r.creditsGranted,
        buyer: r.buyer,
        createdAt: r.createdAt,
      })),
    };
  }

  async withdraw(amountInr: number, note?: string) {
    const amount = Math.round(Number(amountInr) * 100) / 100;
    if (amount <= 0) throw new BadRequestException('amount must be > 0');

    const ownerUserId = await this.resolveOwnerUserId();
    if (!ownerUserId) throw new BadRequestException('Owner account not found');

    const owner = await this.prisma.user.findUniqueOrThrow({
      where: { id: ownerUserId },
    });
    const bal = Number(owner.earningsBalanceInr);
    if (amount > bal) {
      throw new BadRequestException(
        `Insufficient earnings (available ₹${bal})`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: ownerUserId },
        data: { earningsBalanceInr: { decrement: amount } },
      });
      const wallet = await tx.systemSetting.findUnique({
        where: { key: OWNER_WALLET_KEY },
      });
      const prev = (wallet?.value || {}) as Record<string, number>;
      const next = {
        ...prev,
        availableCommissionInr: Math.max(
          0,
          Number(prev.availableCommissionInr || 0) - amount,
        ),
        withdrawnInr: Number(prev.withdrawnInr || 0) + amount,
        lastWithdrawAt: new Date().toISOString(),
        lastWithdrawNote: note || 'Owner withdrawal',
      };
      await tx.systemSetting.upsert({
        where: { key: OWNER_WALLET_KEY },
        create: {
          key: OWNER_WALLET_KEY,
          value: next as Prisma.InputJsonValue,
          isPublic: false,
        },
        update: { value: next as Prisma.InputJsonValue },
      });
    });

    return this.summary();
  }
}
