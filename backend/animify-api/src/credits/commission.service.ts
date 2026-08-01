import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const OWNER_WALLET_KEY = 'billing.owner_wallet';
const DEFAULT_MARGIN = 55;

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

  /** Resolve owner account that receives commission INR. */
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

  /**
   * On every user credit purchase:
   * - 55% → owner commission (credited to owner earningsBalanceInr)
   * - 45% → API usage budget (tracked for ops)
   */
  async recordPurchaseSplit(input: PurchaseSplitInput) {
    const gross = Math.max(0, Math.round(Number(input.grossInr) * 100) / 100);
    if (gross <= 0) {
      this.logger.warn('Skip commission: grossInr <= 0');
      return null;
    }

    const margin = this.marginPercent();
    const commissionInr =
      Math.round(gross * (margin / 100) * 100) / 100;
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
          } as Prisma.InputJsonValue,
        },
      });

      if (ownerUserId) {
        await tx.user.update({
          where: { id: ownerUserId },
          data: {
            earningsBalanceInr: { increment: commissionInr },
          },
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
          description: 'Owner 55% commission wallet from credit sales',
          isPublic: false,
        },
        update: { value: next as Prisma.InputJsonValue },
      });

      return created;
    });

    this.logger.log(
      `Commission +₹${commissionInr} (55%) | API budget ₹${apiBudgetInr} | gross ₹${gross} | source=${input.source}`,
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

    const walletRow = await this.prisma.systemSetting.findUnique({
      where: { key: OWNER_WALLET_KEY },
    });
    const wallet = (walletRow?.value || {}) as Record<string, number | string>;

    const [agg, recent] = await Promise.all([
      this.prisma.commissionEntry.aggregate({
        _sum: {
          grossInr: true,
          commissionInr: true,
          apiBudgetInr: true,
        },
        _count: true,
      }),
      this.prisma.commissionEntry.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          buyer: { select: { id: true, email: true, name: true } },
        },
      }),
    ]);

    return {
      marginPercent: margin,
      split: {
        ownerCommission: `${margin}%`,
        apiUsageBudget: `${100 - margin}%`,
      },
      owner: owner
        ? {
            id: owner.id,
            email: owner.email,
            name: owner.name,
            earningsBalanceInr: Number(owner.earningsBalanceInr),
          }
        : null,
      totals: {
        salesCount: agg._count,
        grossInr: Number(agg._sum.grossInr || 0),
        commissionInr: Number(agg._sum.commissionInr || 0),
        apiBudgetInr: Number(agg._sum.apiBudgetInr || 0),
        availableCommissionInr: Number(
          wallet.availableCommissionInr ||
            (owner ? Number(owner.earningsBalanceInr) : 0),
        ),
        withdrawnInr: Number(wallet.withdrawnInr || 0),
        lifetimeCommissionInr: Number(
          wallet.lifetimeCommissionInr || Number(agg._sum.commissionInr || 0),
        ),
      },
      note: 'When a user buys credits, 55% is credited to your earnings balance and 45% is reserved for API (Replicate/OpenAI) usage.',
      recent: recent.map((r) => ({
        id: r.id,
        source: r.source,
        grossInr: Number(r.grossInr),
        commissionInr: Number(r.commissionInr),
        apiBudgetInr: Number(r.apiBudgetInr),
        creditsGranted: r.creditsGranted,
        buyer: r.buyer,
        createdAt: r.createdAt,
      })),
    };
  }

  /** Mark commission as withdrawn (payout taken from Stripe/bank). */
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
