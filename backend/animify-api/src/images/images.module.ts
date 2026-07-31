import { Module } from '@nestjs/common';
import { ImagesService } from './images.service';
import { ImagesController } from './images.controller';
import { AiProvidersModule } from '../ai-providers/ai-providers.module';
import { CreditsModule } from '../credits/credits.module';
import { VideosModule } from '../videos/videos.module';

@Module({
  imports: [AiProvidersModule, CreditsModule, VideosModule],
  controllers: [ImagesController],
  providers: [ImagesService],
  exports: [ImagesService],
})
export class ImagesModule {}
