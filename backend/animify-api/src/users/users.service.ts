import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        subscription: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const usage = await this.getCurrentUsage(id);

    return {
      ...this.formatUser(user),
      usage,
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        avatarUrl: dto.avatarUrl,
        locale: dto.locale,
        fcmToken: dto.fcmToken,
      },
      include: {
        subscription: true,
      },
    });

    return this.formatUser(user);
  }

  async delete(id: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.prisma.user.update({
      where: { id },
      data: { status: 'DELETED', fcmToken: null },
    });

    return { message: 'Account deleted successfully' };
  }

  async getCurrentUsage(userId: string) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    let usage = await this.prisma.usage.findFirst({
      where: {
        userId,
        periodStart: { lte: now },
        periodEnd: { gte: now },
      },
    });

    if (!usage) {
      usage = await this.prisma.usage.create({
        data: {
          userId,
          periodStart,
          periodEnd,
        },
      });
    }

    return {
      videosUsed: usage.videosUsed,
      minutesUsed: Number(usage.minutesUsed),
      periodStart: usage.periodStart,
      periodEnd: usage.periodEnd,
    };
  }

  formatUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      role: user.role || 'USER',
      creditBalance: user.creditBalance ?? 0,
      locale: user.locale || 'en',
      createdAt: user.createdAt,
      subscription: user.subscription
        ? {
            planType: user.subscription.planType.toLowerCase(),
            status: user.subscription.status.toLowerCase(),
            expiresAt: user.subscription.expiresAt,
            videoLimit: user.subscription.videoLimit,
            minutesLimit: user.subscription.minutesLimit,
          }
        : null,
    };
  }
}
