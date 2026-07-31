import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('health')
  health() {
    return { ok: true, service: 'animify-api', ts: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  async ready() {
    const checks: Record<string, string> = {};
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'fail';
    }
    try {
      const redis = new Redis({
        host: this.config.get<string>('redis.host'),
        port: this.config.get<number>('redis.port'),
        password: this.config.get<string>('redis.password') || undefined,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
      await redis.connect();
      const pong = await redis.ping();
      checks.redis = pong === 'PONG' ? 'ok' : 'fail';
      await redis.quit();
    } catch {
      checks.redis = 'fail';
    }
    const ok = Object.values(checks).every((v) => v === 'ok');
    return { ok, checks };
  }
}
