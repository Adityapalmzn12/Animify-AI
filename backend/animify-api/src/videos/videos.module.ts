import { Module, forwardRef } from '@nestjs/common';
import { VideosService } from './videos.service';
import { VideosController } from './videos.controller';
import { AiProvidersModule } from '../ai-providers/ai-providers.module';
import { CreditsModule } from '../credits/credits.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    AiProvidersModule,
    CreditsModule,
    forwardRef(() => QueueModule),
  ],
  controllers: [VideosController],
  providers: [VideosService],
  exports: [VideosService],
})
export class VideosModule {}
