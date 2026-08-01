import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  PaymentProvider,
  PaymentStatus,
  PlanType,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreditsService } from '../credits/credits.service';
import { PricingService } from '../credits/pricing.service';
import { CommissionService } from '../credits/commission.service';
import { CheckoutDto, PromoDto, WalletTopupDto } from './dto/payments.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly credits: CreditsService,
    private readonly pricing: PricingService,
    private readonly commission: CommissionService,
  ) {
    const secretKey = this.config.get<string>('payment.stripe.secretKey');
    if (secretKey) {
      this.stripe = new Stripe(secretKey);
    }
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }
    return this.stripe;
  }

  async listPlans() {
    const pricing = await this.pricing.publicPricing();
    return {
      retailCreditInr: pricing.retailCreditInr,
      plans: pricing.plans,
      examples: pricing.examples,
      video: pricing.video,
      modules: pricing.modules,
    };
  }

  async createCheckoutSession(userId: string, dto: CheckoutDto) {
    const stripe = this.requireStripe();
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const pricing = await this.pricing.publicPricing();
    const plan =
      pricing.plans.find((p) => p.id === (dto.planId || 'pro')) ||
      pricing.plans.find((p) => p.popular) ||
      pricing.plans[0];

    let customerId = (
      await this.prisma.subscription.findUnique({ where: { userId } })
    )?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId },
      });
      customerId = customer.id;
      await this.prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          planType: PlanType.FREE_TRIAL,
          status: SubscriptionStatus.ACTIVE,
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          videoLimit: this.config.get<number>('limits.freeTrialVideoLimit') ?? 3,
          minutesLimit: 0,
          stripeCustomerId: customerId,
        },
        update: { stripeCustomerId: customerId },
      });
    }

    const envPriceId = this.config.get<string>('payment.stripe.priceId');
    const priceId = plan.stripePriceId || envPriceId;
    const successUrl =
      dto.successUrl ||
      this.config.get<string>('payment.stripe.successUrl') ||
      'https://animify.ai/billing/success';
    const cancelUrl =
      dto.cancelUrl ||
      this.config.get<string>('payment.stripe.cancelUrl') ||
      'https://animify.ai/billing/cancel';

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        type: 'subscription',
        planId: plan.id,
        creditGrant: String(plan.credits),
      },
      subscription_data: {
        metadata: {
          userId,
          planId: plan.id,
          creditGrant: String(plan.credits),
        },
      },
    };

    if (priceId) {
      sessionParams.line_items = [{ price: priceId, quantity: 1 }];
    } else {
      sessionParams.line_items = [
        {
          price_data: {
            currency: 'inr',
            product_data: {
              name: `Animify ${plan.name}`,
              description: plan.description,
            },
            unit_amount: plan.priceInr * 100,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return {
      url: session.url,
      sessionId: session.id,
      plan,
    };
  }

  async createPortalSession(userId: string) {
    const stripe = this.requireStripe();
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub?.stripeCustomerId) {
      throw new BadRequestException('No billing account found');
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url:
        this.config.get<string>('payment.stripe.portalReturnUrl') ||
        'https://animify.ai/billing',
    });
    return { url: session.url };
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    const stripe = this.requireStripe();
    const webhookSecret = this.config.get<string>('payment.stripe.webhookSecret');
    if (!webhookSecret) {
      throw new BadRequestException('Stripe webhook secret not configured');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid signature';
      throw new BadRequestException(`Webhook error: ${message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      await this.onCheckoutCompleted(session);
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      await this.onInvoicePaid(invoice);
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      await this.onSubscriptionDeleted(sub);
    }

    return { received: true };
  }

  private async onInvoicePaid(invoice: Stripe.Invoice) {
    const customerId =
      typeof invoice.customer === 'string' ? invoice.customer : null;
    if (!customerId || invoice.billing_reason === 'subscription_create') {
      // Initial checkout already granted credits via checkout.session.completed
      return;
    }
    const sub = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!sub) return;
    const pricing = await this.pricing.publicPricing();
    let planId = 'pro';
    let premiumGrant =
      this.config.get<number>('credits.premiumMonthlyGrant') ?? 500;
    try {
      const stripe = this.requireStripe();
      // Stripe typings vary by SDK version; subscription id lives on invoice parent/sub fields.
      const inv = invoice as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null;
        parent?: { subscription_details?: { subscription?: string } | null } | null;
      };
      const stripeSubId =
        typeof inv.subscription === 'string'
          ? inv.subscription
          : inv.subscription?.id ||
            inv.parent?.subscription_details?.subscription ||
            null;
      if (stripeSubId) {
        const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
        planId = stripeSub.metadata?.planId || planId;
        const fromMeta = parseInt(stripeSub.metadata?.creditGrant || '', 10);
        if (fromMeta > 0) premiumGrant = fromMeta;
      }
    } catch (e) {
      this.logger.warn(`Could not read Stripe sub metadata for renewal: ${e}`);
    }
    const plan = pricing.plans.find((p) => p.id === planId);
    if (plan?.credits) premiumGrant = plan.credits;

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        planType: PlanType.PREMIUM,
        status: SubscriptionStatus.ACTIVE,
        expiresAt,
      },
    });
    await this.credits.grantCredits(
      sub.userId,
      premiumGrant,
      `Subscription renewal ${plan?.name || planId} — ${premiumGrant} credits`,
      'PURCHASE',
      { source: 'stripe_invoice', invoiceId: invoice.id, planId },
    );

    const grossInr = (invoice.amount_paid ?? 0) / 100;
    await this.commission.recordPurchaseSplit({
      buyerUserId: sub.userId,
      grossInr: grossInr || plan?.priceInr || 0,
      creditsGranted: premiumGrant,
      source: 'renewal',
      providerId: invoice.id,
      metadata: { planId },
    });
  }

  private async onSubscriptionDeleted(stripeSub: Stripe.Subscription) {
    const existing = await this.prisma.subscription.findFirst({
      where: { stripeSubId: stripeSub.id },
    });
    if (!existing) return;
    await this.prisma.subscription.update({
      where: { id: existing.id },
      data: {
        planType: PlanType.FREE_TRIAL,
        status: SubscriptionStatus.CANCELLED,
        autoRenew: false,
      },
    });
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    if (!userId) {
      this.logger.warn('Checkout session missing userId metadata');
      return;
    }

    if (session.metadata?.type === 'wallet_topup') {
      const credits = parseInt(session.metadata.credits || '0', 10);
      if (credits > 0) {
        await this.credits.grantCredits(
          userId,
          credits,
          'Wallet top-up',
          'PURCHASE',
          { sessionId: session.id },
        );
      }
      await this.prisma.payment.updateMany({
        where: { providerId: session.id },
        data: { status: PaymentStatus.COMPLETED },
      });
      const grossInr = (session.amount_total ?? 0) / 100;
      await this.commission.recordPurchaseSplit({
        buyerUserId: userId,
        grossInr: grossInr || credits,
        creditsGranted: credits,
        source: 'wallet_topup',
        providerId: session.id,
        metadata: { type: 'wallet_topup' },
      });
      return;
    }

    const pricing = await this.pricing.publicPricing();
    const planId = session.metadata?.planId || 'pro';
    const plan = pricing.plans.find((p) => p.id === planId) || pricing.plans[0];
    const premiumGrant =
      parseInt(session.metadata?.creditGrant || '', 10) ||
      plan?.credits ||
      this.config.get<number>('credits.premiumMonthlyGrant') ||
      500;
    const videoLimit = this.config.get<number>('limits.premiumVideoLimit') ?? 45;
    const minutesLimit =
      this.config.get<number>('limits.premiumMinutesLimit') ?? 450;

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planType: PlanType.PREMIUM,
        status: SubscriptionStatus.ACTIVE,
        startedAt: new Date(),
        expiresAt,
        videoLimit,
        minutesLimit,
        autoRenew: true,
        stripeCustomerId:
          typeof session.customer === 'string' ? session.customer : null,
        stripeSubId:
          typeof session.subscription === 'string'
            ? session.subscription
            : null,
      },
      update: {
        planType: PlanType.PREMIUM,
        status: SubscriptionStatus.ACTIVE,
        expiresAt,
        videoLimit,
        minutesLimit,
        stripeSubId:
          typeof session.subscription === 'string'
            ? session.subscription
            : undefined,
      },
    });

    await this.credits.grantCredits(
      userId,
      premiumGrant,
      `Subscription ${plan?.name || 'Premium'} — ${premiumGrant} credits`,
      'PURCHASE',
      {
        source: 'stripe_checkout',
        sessionId: session.id,
        planId,
      },
    );

    const amount = (session.amount_total ?? 0) / 100;
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        amount,
        currency: (session.currency || 'inr').toUpperCase(),
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.STRIPE,
        providerId: session.id,
        metadata: { mode: session.mode, planId },
      },
    });

    await this.commission.recordPurchaseSplit({
      buyerUserId: userId,
      grossInr: amount || plan?.priceInr || 0,
      creditsGranted: premiumGrant,
      source: 'subscription',
      paymentId: payment.id,
      providerId: session.id,
      metadata: { planId, planName: plan?.name },
    });
  }

  async applyPromo(userId: string, dto: PromoDto) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: dto.code.toUpperCase() },
    });
    if (!coupon || !coupon.isActive) {
      throw new NotFoundException('Invalid promo code');
    }
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      throw new BadRequestException('Promo code expired');
    }
    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('Promo code usage limit reached');
    }

    await this.prisma.coupon.update({
      where: { id: coupon.id },
      data: { usedCount: { increment: 1 } },
    });

    if (coupon.creditGrant > 0) {
      await this.credits.grantCredits(
        userId,
        coupon.creditGrant,
        `Promo: ${coupon.code}`,
        'PROMO',
        { couponId: coupon.id },
      );
    }

    return {
      code: coupon.code,
      creditGrant: coupon.creditGrant,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
    };
  }

  async walletTopup(userId: string, dto: WalletTopupDto) {
    const stripe = this.requireStripe();
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const pricing = await this.pricing.publicPricing();
    const unitInr = pricing.retailCreditInr || 1;
    const amountInr = Math.round(dto.credits * unitInr * 100) / 100;
    const successUrl =
      dto.successUrl ||
      this.config.get<string>('payment.stripe.successUrl') ||
      'https://animify.ai/billing/success';
    const cancelUrl =
      dto.cancelUrl ||
      this.config.get<string>('payment.stripe.cancelUrl') ||
      'https://animify.ai/billing/cancel';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        type: 'wallet_topup',
        credits: String(dto.credits),
        retailCreditInr: String(unitInr),
      },
      line_items: [
        {
          price_data: {
            currency: 'inr',
            product_data: {
              name: `${dto.credits} Animify Credits`,
              description: `₹${unitInr} per Animify credit`,
            },
            unit_amount: Math.max(100, Math.round(amountInr * 100)),
          },
          quantity: 1,
        },
      ],
    });

    await this.prisma.payment.create({
      data: {
        userId,
        amount: amountInr,
        currency: 'INR',
        status: PaymentStatus.PENDING,
        provider: PaymentProvider.STRIPE,
        providerId: session.id,
        metadata: {
          type: 'wallet_topup',
          credits: dto.credits,
          retailCreditInr: unitInr,
        },
      },
    });

    return { url: session.url, sessionId: session.id, amountInr, credits: dto.credits };
  }

  async listInvoices(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return {
      items: items.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Razorpay integration placeholder for future use. */
  async createRazorpayOrder(_userId: string, _amountInr: number) {
    const keyId = this.config.get<string>('payment.razorpay.keyId');
    if (!keyId) {
      throw new BadRequestException('Razorpay is not configured');
    }
    return {
      provider: PaymentProvider.RAZORPAY,
      status: 'not_implemented',
      message: 'Razorpay checkout will be enabled in a future release',
    };
  }
}
