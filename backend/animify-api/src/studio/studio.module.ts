import { Module } from '@nestjs/common';
import { StudioService } from './studio.service';
import { StudioController } from './studio.controller';
import { PptxService } from './pptx.service';
import { AiProvidersModule } from '../ai-providers/ai-providers.module';
import { CreditsModule } from '../credits/credits.module';
import { VideosModule } from '../videos/videos.module';

@Module({
  imports: [AiProvidersModule, CreditsModule, VideosModule],
  controllers: [StudioController],
  providers: [StudioService, PptxService],
  exports: [StudioService],
})
export class StudioModule {}
