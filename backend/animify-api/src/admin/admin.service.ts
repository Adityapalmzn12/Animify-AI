import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderBus } from '../ai-providers/providers/ai-provider.bus';
import {
  CreateCouponDto,
  UpdateAdminUserDto,
  UpsertFeatureFlagDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: AiProviderBus,
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
        },
      }),
      this.prisma.user.count(),
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
