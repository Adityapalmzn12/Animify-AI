import { Module } from '@nestjs/common';
import { VoicesService } from './voices.service';
import { VoicesController } from './voices.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CreditsModule } from '../credits/credits.module';
import { VideosModule } from '../videos/videos.module';

@Module({
  imports: [PrismaModule, CreditsModule, VideosModule],
  providers: [VoicesService],
  controllers: [VoicesController],
  exports: [VoicesService],
})
export class VoicesModule {}
