import { Module } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { PricingService } from './pricing.service';
import { CreditsController } from './credits.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CreditsService, PricingService],
  controllers: [CreditsController],
  exports: [CreditsService, PricingService],
})
export class CreditsModule {}
