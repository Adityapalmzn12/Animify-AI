import { Module } from '@nestjs/common';
import { AiStylizeService } from './ai-stylize.service';

@Module({
  providers: [AiStylizeService],
  exports: [AiStylizeService],
})
export class AiProvidersModule {}
