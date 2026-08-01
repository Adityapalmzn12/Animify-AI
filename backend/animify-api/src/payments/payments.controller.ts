import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CheckoutDto, PromoDto, WalletTopupDto } from './dto/payments.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Public plan packs + transparent credit rates (no margin fields). */
  @Get('plans')
  @Public()
  plans() {
    return this.payments.listPlans();
  }

  @Post('checkout')
  @ApiBearerAuth()
  checkout(@CurrentUser('id') userId: string, @Body() dto: CheckoutDto) {
    return this.payments.createCheckoutSession(userId, dto);
  }

  @Post('portal')
  @ApiBearerAuth()
  portal(@CurrentUser('id') userId: string) {
    return this.payments.createPortalSession(userId);
  }

  @Post('webhook/stripe')
  @Public()
  stripeWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    return this.payments.handleStripeWebhook(rawBody, signature);
  }

  @Post('promo')
  @ApiBearerAuth()
  promo(@CurrentUser('id') userId: string, @Body() dto: PromoDto) {
    return this.payments.applyPromo(userId, dto);
  }

  @Post('wallet/topup')
  @ApiBearerAuth()
  walletTopup(@CurrentUser('id') userId: string, @Body() dto: WalletTopupDto) {
    return this.payments.walletTopup(userId, dto);
  }

  @Get('invoices')
  @ApiBearerAuth()
  invoices(
    @CurrentUser('id') userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.payments.listInvoices(
      userId,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }
}
