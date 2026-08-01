import { Module } from '@nestjs/common';
import { GeneratorService } from './generator.service';
import { GeneratorController } from './generator.controller';
import { VideosModule } from '../videos/videos.module';
import { AiProvidersModule } from '../ai-providers/ai-providers.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [VideosModule, AiProvidersModule, CreditsModule],
  controllers: [GeneratorController],
  providers: [GeneratorService],
  exports: [GeneratorService],
})
export class GeneratorModule {}
