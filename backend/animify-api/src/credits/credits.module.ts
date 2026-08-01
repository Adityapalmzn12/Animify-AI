import { Module } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { PricingService } from './pricing.service';
import { CommissionService } from './commission.service';
import { CreditsController } from './credits.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CreditsService, PricingService, CommissionService],
  controllers: [CreditsController],
  exports: [CreditsService, PricingService, CommissionService],
})
export class CreditsModule {}
