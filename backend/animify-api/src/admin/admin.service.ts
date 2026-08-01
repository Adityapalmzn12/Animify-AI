import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderBus } from '../ai-providers/providers/ai-provider.bus';
import { CreditsService } from '../credits/credits.service';
import {
  CreateCouponDto,
  GrantCreditsDto,
  UpdateAdminUserDto,
  UpsertFeatureFlagDto,
} from './dto/admin.dto';

type ProviderHealth = {
  id: string;
  name: string;
  configured: boolean;
  status: 'ok' | 'needs_topup' | 'error' | 'not_configured' | 'unknown';
  message: string;
  buyUrl: string;
  usedFor: string[];
  mustBuy: boolean;
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: AiProviderBus,
    private readonly credits: CreditsService,
    private readonly config: ConfigService,
  ) {}

  async metrics() {
    const [
      userCount,
      jobCounts,
      revenue,
      creditTotals,
    ] = await Promise.all([
      this.prisma.user.count({ where: { status: { not: 'DELETED' } } }),
      this.prisma.videoJob.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      this.prisma.user.aggregate({ _sum: { creditBalance: true } }),
    ]);

    return {
      users: userCount,
      jobsByStatus: Object.fromEntries(
        jobCounts.map((j) => [j.status, j._count.id]),
      ),
      revenue: Number(revenue._sum.amount ?? 0),
      totalCreditsInCirculation: creditTotals._sum.creditBalance ?? 0,
    };
  }

  /** Live ops board: which APIs to buy, active users, subscriptions. */
  async opsDashboard() {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      providers,
      activeJobs,
      recentJobs,
      topConsumers,
      spend24h,
      subscriptions,
      premiumCount,
      freeCount,
      recentPayments,
      failedBillingJobs,
      metrics,
    ] = await Promise.all([
      this.probeProviders(),
      this.prisma.videoJob.findMany({
        where: { status: { in: ['PENDING', 'QUEUED', 'PROCESSING'] } },
        orderBy: { updatedAt: 'desc' },
        take: 30,
        include: {
          user: { select: { id: true, email: true, name: true, creditBalance: true } },
        },
      }),
      this.prisma.videoJob.findMany({
        where: { createdAt: { gte: since24h } },
        orderBy: { createdAt: 'desc' },
        take: 40,
        include: {
          user: { select: { id: true, email: true, name: true, creditBalance: true } },
        },
      }),
      this.prisma.creditLedger.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: since7d },
          amount: { lt: 0 },
        },
        _sum: { amount: true },
        _count: { id: true },
        orderBy: { _sum: { amount: 'asc' } },
        take: 15,
      }),
      this.prisma.creditLedger.aggregate({
        where: { createdAt: { gte: since24h }, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
      this.prisma.subscription.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 40,
        include: {
          user: {
            select: { id: true, email: true, name: true, creditBalance: true },
          },
        },
      }),
      this.prisma.subscription.count({
        where: { planType: 'PREMIUM', status: 'ACTIVE' },
      }),
      this.prisma.subscription.count({
        where: { planType: 'FREE_TRIAL' },
      }),
      this.prisma.payment.findMany({
        where: { createdAt: { gte: since7d } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { email: true, name: true } } },
      }),
      this.prisma.videoJob.findMany({
        where: {
          status: 'FAILED',
          createdAt: { gte: since7d },
          OR: [
            { errorMessage: { contains: 'balance', mode: 'insensitive' } },
            { errorMessage: { contains: 'billing', mode: 'insensitive' } },
            { errorMessage: { contains: 'exhausted', mode: 'insensitive' } },
            { errorMessage: { contains: 'hard limit', mode: 'insensitive' } },
            { errorMessage: { contains: 'locked', mode: 'insensitive' } },
            { errorMessage: { contains: 'quota', mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          provider: true,
          errorMessage: true,
          createdAt: true,
          jobType: true,
        },
      }),
      this.metrics(),
    ]);

    const userIds = topConsumers.map((c) => c.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        name: true,
        creditBalance: true,
        subscription: { select: { planType: true, status: true } },
      },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const mustBuy = providers.filter((p) => p.mustBuy || p.status === 'needs_topup');

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        ...metrics,
        premiumSubscribers: premiumCount,
        freeTrialSubscribers: freeCount,
        creditsSpent24h: Math.abs(spend24h._sum.amount ?? 0),
        activeJobs: activeJobs.length,
        apisNeedingTopUp: mustBuy.map((p) => p.id),
      },
      providers,
      buyNow: mustBuy.map((p) => ({
        id: p.id,
        name: p.name,
        reason: p.message,
        buyUrl: p.buyUrl,
      })),
      liveActiveUsers: activeJobs.map((j) => ({
        jobId: j.id,
        userId: j.userId,
        email: j.user?.email,
        name: j.user?.name,
        creditBalance: j.user?.creditBalance ?? 0,
        jobType: j.jobType,
        status: j.status,
        progress: j.progress,
        provider: j.provider,
        creditsCost: j.creditsCost,
        currentStep: j.currentStep,
        updatedAt: j.updatedAt,
      })),
      recentConsumption: recentJobs.map((j) => ({
        jobId: j.id,
        email: j.user?.email,
        name: j.user?.name,
        jobType: j.jobType,
        status: j.status,
        provider: j.provider,
        creditsCost: j.creditsCost,
        errorMessage: j.errorMessage,
        createdAt: j.createdAt,
      })),
      topConsumers7d: topConsumers.map((c) => {
        const u = userMap.get(c.userId);
        return {
          userId: c.userId,
          email: u?.email,
          name: u?.name,
          creditBalance: u?.creditBalance ?? 0,
          plan: u?.subscription?.planType ?? 'NONE',
          creditsSpent: Math.abs(c._sum.amount ?? 0),
          transactions: c._count.id,
        };
      }),
      subscriptions: subscriptions.map((s) => ({
        userId: s.userId,
        email: s.user?.email,
        name: s.user?.name,
        creditBalance: s.user?.creditBalance ?? 0,
        planType: s.planType,
        status: s.status,
        expiresAt: s.expiresAt,
        videoLimit: s.videoLimit,
        autoRenew: s.autoRenew,
      })),
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        email: p.user?.email,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        provider: p.provider,
        createdAt: p.createdAt,
        metadata: p.metadata,
      })),
      billingFailures: failedBillingJobs,
    };
  }

  private async probeProviders(): Promise<ProviderHealth[]> {
    const results = await Promise.all([
      this.probeFal(),
      this.probeReplicate(),
      this.probeOpenAi(),
      this.probeStripe(),
      this.probeElevenLabs(),
      this.probeOss(),
    ]);
    return results;
  }

  private async probeFal(): Promise<ProviderHealth> {
    const key = this.config.get<string>('ai.fal.apiKey');
    const base: ProviderHealth = {
      id: 'fal',
      name: 'Fal.ai',
      configured: !!key && key.trim().length > 5,
      status: 'not_configured',
      message: 'Key not set — optional if Replicate works',
      buyUrl: 'https://fal.ai/dashboard/billing',
      usedFor: ['video', 'image'],
      mustBuy: false,
    };
    if (!base.configured) return base;
    // Infer from recent failed jobs — avoid spending credits on a probe request
    try {
      const recentFail = await this.prisma.videoJob.findFirst({
        where: {
          status: 'FAILED',
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          OR: [
            { provider: { contains: 'fal', mode: 'insensitive' } },
            { errorMessage: { contains: 'Fal', mode: 'insensitive' } },
            { errorMessage: { contains: 'fal.ai', mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
      const err = recentFail?.errorMessage || '';
      if (/exhausted|locked|billing|402|403/i.test(err)) {
        return {
          ...base,
          status: 'needs_topup',
          message:
            'Recent jobs show Fal balance exhausted — top up at fal.ai/dashboard/billing',
          mustBuy: true,
        };
      }
      return {
        ...base,
        status: 'ok',
        message: 'Key configured (optional backup; Replicate is preferred)',
        mustBuy: false,
      };
    } catch (e) {
      return {
        ...base,
        status: 'unknown',
        message: e instanceof Error ? e.message : 'Could not evaluate Fal',
      };
    }
  }

  private async probeReplicate(): Promise<ProviderHealth> {
    const token = this.config.get<string>('ai.replicate.apiToken');
    const base: ProviderHealth = {
      id: 'replicate',
      name: 'Replicate',
      configured: !!token,
      status: 'not_configured',
      message: 'Required for video + image when Fal is down',
      buyUrl: 'https://replicate.com/account/billing',
      usedFor: ['video', 'image'],
      mustBuy: !token,
    };
    if (!token) return base;
    try {
      const res = await fetch('https://api.replicate.com/v1/account', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { username?: string };
        return {
          ...base,
          status: 'ok',
          message: `OK (@${data.username || 'account'})`,
          mustBuy: false,
        };
      }
      const text = await res.text();
      const needs =
        res.status === 402 || /billing|payment|insufficient/i.test(text);
      return {
        ...base,
        status: needs ? 'needs_topup' : 'error',
        message: text.slice(0, 160) || `HTTP ${res.status}`,
        mustBuy: needs || res.status === 401,
      };
    } catch (e) {
      return {
        ...base,
        status: 'error',
        message: e instanceof Error ? e.message : 'Probe failed',
        mustBuy: true,
      };
    }
  }

  private async probeOpenAi(): Promise<ProviderHealth> {
    const key = this.config.get<string>('ai.openai.apiKey');
    const base: ProviderHealth = {
      id: 'openai',
      name: 'OpenAI',
      configured: !!key && key.trim().length > 10,
      status: 'not_configured',
      message: 'Used for PPT outline, voice TTS, images',
      buyUrl: 'https://platform.openai.com/settings/organization/billing/overview',
      usedFor: ['ppt', 'voice', 'image', 'script'],
      mustBuy: !key,
    };
    if (!base.configured) return base;
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        return { ...base, status: 'ok', message: 'OK', mustBuy: false };
      }
      const text = await res.text();
      const needs = /billing|hard limit|quota|insufficient/i.test(text);
      return {
        ...base,
        status: needs ? 'needs_topup' : 'error',
        message: text.slice(0, 160) || `HTTP ${res.status}`,
        mustBuy: needs || res.status === 401,
      };
    } catch (e) {
      return {
        ...base,
        status: 'error',
        message: e instanceof Error ? e.message : 'Probe failed',
      };
    }
  }

  private async probeStripe(): Promise<ProviderHealth> {
    const key = this.config.get<string>('payment.stripe.secretKey');
    const priceId = this.config.get<string>('payment.stripe.priceId');
    const base: ProviderHealth = {
      id: 'stripe',
      name: 'Stripe',
      configured: !!key,
      status: 'not_configured',
      message: 'Required for subscriptions + wallet top-ups',
      buyUrl: 'https://dashboard.stripe.com/apikeys',
      usedFor: ['subscription', 'wallet_topup'],
      mustBuy: !key,
    };
    if (!key) return base;
    try {
      const res = await fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        return {
          ...base,
          status: 'ok',
          message: priceId
            ? 'OK — Premium price configured'
            : 'OK — set STRIPE_PRICE_ID for Premium plan',
          mustBuy: false,
          buyUrl: 'https://dashboard.stripe.com/products',
        };
      }
      return {
        ...base,
        status: 'error',
        message: (await res.text()).slice(0, 160),
        mustBuy: true,
      };
    } catch (e) {
      return {
        ...base,
        status: 'error',
        message: e instanceof Error ? e.message : 'Probe failed',
        mustBuy: true,
      };
    }
  }

  private async probeElevenLabs(): Promise<ProviderHealth> {
    const key = this.config.get<string>('ai.elevenlabs.apiKey');
    return {
      id: 'elevenlabs',
      name: 'ElevenLabs',
      configured: !!key,
      status: key ? 'unknown' : 'not_configured',
      message: key
        ? 'Configured (optional premium TTS)'
        : 'Optional — OpenAI/espeak used if missing',
      buyUrl: 'https://elevenlabs.io/app/subscription',
      usedFor: ['voice'],
      mustBuy: false,
    };
  }

  private async probeOss(): Promise<ProviderHealth> {
    const url = (this.config.get<string>('ai.workerUrl') || '').trim();
    const base: ProviderHealth = {
      id: 'oss',
      name: 'OSS Worker',
      configured: !!url,
      status: url ? 'unknown' : 'not_configured',
      message: url
        ? `Worker URL set (${url})`
        : 'Local ffmpeg path used when worker down',
      buyUrl: 'https://github.com/Adityapalmzn12/Animify-AI',
      usedFor: ['stylize', 'edit'],
      mustBuy: false,
    };
    if (!url) return base;
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/health`, {
        signal: AbortSignal.timeout(2500),
      });
      return {
        ...base,
        status: res.ok ? 'ok' : 'error',
        message: res.ok ? 'Worker healthy' : `Worker HTTP ${res.status}`,
      };
    } catch {
      return { ...base, status: 'error', message: 'Worker unreachable' };
    }
  }

  async listUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          creditBalance: true,
          createdAt: true,
          subscription: {
            select: {
              planType: true,
              status: true,
              expiresAt: true,
              videoLimit: true,
            },
          },
        },
      }),
      this.prisma.user.count(),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async grantCredits(userId: string, dto: GrantCreditsDto) {
    await this.getUserOrThrow(userId);
    return this.credits.grantCredits(
      userId,
      dto.amount,
      dto.reason || 'Admin credit grant',
      'GRANT',
      { source: 'admin' },
    );
  }

  async listSubscriptions(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.subscription.findMany({
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, name: true, creditBalance: true } },
        },
      }),
      this.prisma.subscription.count(),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateUser(id: string, dto: UpdateAdminUserDto) {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        status: dto.status,
        role: dto.role,
      },
    });
    if (dto.role === UserRole.ADMIN) {
      await this.syncAdminUser(user.email, user.name);
    }
    return user;
  }

  private async syncAdminUser(email: string, name: string) {
    const existing = await this.prisma.adminUser.findUnique({ where: { email } });
    if (existing) return existing;
    return this.prisma.adminUser.create({
      data: {
        email,
        name,
        passwordHash: '',
        role: 'ADMIN',
        isActive: true,
      },
    });
  }

  async listJobs(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where: Prisma.VideoJobWhereInput = {};
    if (status) where.status = status.toUpperCase() as any;
    const [items, total] = await Promise.all([
      this.prisma.videoJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, email: true, name: true } } },
      }),
      this.prisma.videoJob.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async listPayments(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, email: true } } },
      }),
      this.prisma.payment.count(),
    ]);
    return {
      items: items.map((p) => ({ ...p, amount: Number(p.amount) })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  listFeatureFlags() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  upsertFeatureFlag(dto: UpsertFeatureFlagDto) {
    return this.prisma.featureFlag.upsert({
      where: { key: dto.key },
      create: {
        key: dto.key,
        enabled: dto.enabled,
        description: dto.description,
        config: dto.config as Prisma.InputJsonValue,
      },
      update: {
        enabled: dto.enabled,
        description: dto.description,
        config: dto.config as Prisma.InputJsonValue,
      },
    });
  }

  listCoupons() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  createCoupon(dto: CreateCouponDto) {
    return this.prisma.coupon.create({
      data: {
        code: dto.code.toUpperCase(),
        description: dto.description,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxUses: dto.maxUses,
        minAmount: dto.minAmount,
        creditGrant: dto.creditGrant ?? 0,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
        isActive: dto.isActive ?? true,
      },
    });
  }

  listProviders() {
    return this.bus.listConfigured();
  }

  async auditLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count(),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUserOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
