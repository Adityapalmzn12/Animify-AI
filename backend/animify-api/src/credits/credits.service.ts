import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreditTxnType, Prisma } from '@prisma/client';

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { balance: user.creditBalance };
  }

  async listLedger(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.creditLedger.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.creditLedger.count({ where: { userId } }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async grantCredits(
    userId: string,
    amount: number,
    reason: string,
    type: CreditTxnType = 'GRANT',
    metadata?: Prisma.InputJsonValue,
  ) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { creditBalance: { increment: amount } },
      });
      await tx.creditLedger.create({
        data: {
          userId,
          type,
          amount,
          balanceAfter: user.creditBalance,
          reason,
          metadata: metadata ?? undefined,
        },
      });
      return { balance: user.creditBalance };
    });
  }

  async debitCredits(userId: string, amount: number, jobId?: string, reason = 'Job charge') {
    if (amount <= 0) return { balance: (await this.getBalance(userId)).balance };
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.creditBalance < amount) {
        throw new BadRequestException('Insufficient credits');
      }
      const updated = await tx.user.update({
        where: { id: userId },
        data: { creditBalance: { decrement: amount } },
      });
      await tx.creditLedger.create({
        data: {
          userId,
          type: 'DEBIT',
          amount: -amount,
          balanceAfter: updated.creditBalance,
          reason,
          jobId,
        },
      });
      return { balance: updated.creditBalance };
    });
  }

  async refundCredits(userId: string, amount: number, jobId?: string, reason = 'Refund') {
    return this.grantCredits(userId, amount, reason, 'REFUND', { jobId });
  }
}
