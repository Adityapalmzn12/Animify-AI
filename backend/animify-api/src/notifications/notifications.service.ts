import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private resend: Resend | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('email.resendApiKey');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
  }

  async list(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async saveFcmToken(userId: string, token: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken: token },
    });
    return { ok: true };
  }

  async notifyJobComplete(userId: string, jobId: string, title?: string) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title: title || 'Video ready',
        body: 'Your AI video job has completed.',
        type: NotificationType.VIDEO_COMPLETE,
        data: { jobId },
      },
    });
    await this.sendPush(userId, notification.title, notification.body, {
      jobId,
    });
    return notification;
  }

  async notifyLowCredits(userId: string, balance: number) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title: 'Low credits',
        body: `You have ${balance} credits remaining. Top up to keep creating.`,
        type: NotificationType.CREDITS_LOW,
        data: { balance },
      },
    });
    await this.sendPush(userId, notification.title, notification.body, {
      balance: String(balance),
    });
    return notification;
  }

  async sendEmail(to: string, subject: string, html: string) {
    if (!this.resend) {
      this.logger.log(`Email (no Resend key): to=${to} subject=${subject}`);
      return { sent: false, reason: 'RESEND_API_KEY not configured' };
    }
    const from =
      this.config.get<string>('email.from') || 'Animify AI <noreply@animify.ai>';
    const result = await this.resend.emails.send({ from, to, subject, html });
    return { sent: true, id: result.data?.id };
  }

  private async sendPush(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const token = user?.fcmToken;
    const serverKey = this.config.get<string>('fcm.serverKey');
    if (!token || !serverKey) {
      this.logger.log(
        `FCM skipped user=${userId} title=${title} (token or server key missing)`,
      );
      return;
    }

    try {
      const res = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          Authorization: `key=${serverKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          notification: { title, body },
          data: data || {},
        }),
      });
      if (!res.ok) {
        this.logger.warn(`FCM send failed: ${await res.text()}`);
      }
    } catch (error) {
      this.logger.warn('FCM send error', error);
    }
  }
}
