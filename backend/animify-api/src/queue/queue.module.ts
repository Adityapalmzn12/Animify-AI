import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AI_JOBS_QUEUE } from './queue.constants';
import { QueueService } from './queue.service';
import { AiJobProcessor } from './ai-job.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { AiProvidersModule } from '../ai-providers/ai-providers.module';
import { StorageModule } from '../storage/storage.module';
import { JobsModule } from '../jobs/jobs.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AiProvidersModule,
    StorageModule,
    JobsModule,
    CreditsModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password') || undefined,
          db: config.get<number>('redis.db') || 0,
        },
      }),
    }),
    BullModule.registerQueue({ name: AI_JOBS_QUEUE }),
  ],
  providers: [QueueService, AiJobProcessor],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
