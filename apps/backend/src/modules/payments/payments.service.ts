import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { CurrencyCode, LedgerTransactionType, PaymentChannelCode } from '@digital-topup/shared';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { CreateCardTopupDto, CreateUsdtTopupDto } from './dto/create-global-topup.dto';

type StripeEvent = {
  id: string;
  type: string;
  data?: { object?: Record<string, any> };
};

type UsdtPaymentEvent = {
  eventId: string;
  paymentId: string;
  transactionHash: string;
  network: string;
  amount: number;
  confirmations: number;
  receiverAddress: string;
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  async createCardTopup(userId: string, dto: CreateCardTopupDto) {
    if (dto.currency !== CurrencyCode.USD) {
      throw new BadRequestException('Card top-ups currently settle in USD only.');
    }
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const publicUrl = process.env.PUBLIC_WEB_URL;
    if (!secretKey || !publicUrl) {
      throw new ServiceUnavailableException('Card payments are not configured.');
    }
    const origin = this.requireSafePublicOrigin(publicUrl);
    const paymentMethod = await this.requirePaymentMethod(PaymentChannelCode.CARD, CurrencyCode.USD);
    this.validatePaymentAmount(dto.amount, paymentMethod.minAmount, paymentMethod.maxAmount);
    const fee = new Prisma.Decimal(
      this.calculateFee(dto.amount, paymentMethod.feePercentage, paymentMethod.feeFixed),
    ).toDecimalPlaces(2).toNumber();
    const payment = await this.createPayment({
      userId,
      methodId: paymentMethod.id,
      currency: dto.currency,
      amount: dto.amount,
      fee,
      idempotencyKey: `CARD-${userId}-${dto.idempotencyKey}`,
      providerCurrency: 'USD',
      providerAmount: dto.amount + fee,
    });

    if (payment.status !== PaymentStatus.Created) {
      return {
        ...this.safePaymentResponse(payment),
        checkoutUrl: payment.checkoutUrl,
      };
    }

    const form = new URLSearchParams();
    form.set('mode', 'payment');
    form.set('success_url', `${origin}/wallet?payment=success&session_id={CHECKOUT_SESSION_ID}`);
    form.set('cancel_url', `${origin}/wallet?payment=cancelled`);
    form.set('client_reference_id', payment.id);
    form.set('metadata[paymentId]', payment.id);
    form.set('line_items[0][quantity]', '1');
    form.set('line_items[0][price_data][currency]', 'usd');
    form.set('line_items[0][price_data][unit_amount]', String(Math.round((dto.amount + fee) * 100)));
    form.set('line_items[0][price_data][product_data][name]', 'Wallet top-up');

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': payment.idempotencyKey!,
      },
      body: form,
    });
    const result = await response.json() as { id?: string; url?: string; error?: { message?: string } };
    if (!response.ok || !result.id || !result.url) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.Failed },
      });
      this.logger.error(`Stripe Checkout session creation failed with HTTP ${response.status}.`);
      throw new ServiceUnavailableException('The card payment session could not be created.');
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { gatewayReference: result.id, checkoutUrl: result.url, status: PaymentStatus.Pending },
    });
    return { paymentId: payment.id, status: PaymentStatus.Pending, checkoutUrl: result.url };
  }

  async createUsdtTopup(userId: string, dto: CreateUsdtTopupDto) {
    if (dto.currency !== CurrencyCode.USD) {
      throw new BadRequestException('USDT top-ups currently settle to USD wallets only.');
    }
    const rate = Number(process.env.USDT_USD_RATE);
    const minimumConfirmations = Number(process.env.USDT_MIN_CONFIRMATIONS || '12');
    const receiverAddress = this.getUsdtReceiverAddress(dto.network);
    if (!Number.isFinite(rate) || rate <= 0 || !Number.isInteger(minimumConfirmations) || minimumConfirmations < 1) {
      throw new ServiceUnavailableException('USDT settlement configuration is invalid.');
    }
    const paymentMethod = await this.requirePaymentMethod(dto.network, CurrencyCode.USD);
    this.validatePaymentAmount(dto.amount, paymentMethod.minAmount, paymentMethod.maxAmount);
    const fee = this.calculateFee(dto.amount, paymentMethod.feePercentage, paymentMethod.feeFixed);
    const usdtAmount = Number(
      new Prisma.Decimal(dto.amount).add(fee).div(rate).toDecimalPlaces(6).toString(),
    );
    const payment = await this.createPayment({
      userId,
      methodId: paymentMethod.id,
      currency: dto.currency,
      amount: dto.amount,
      fee,
      idempotencyKey: `${dto.network}-${userId}-${dto.idempotencyKey}`,
      providerCurrency: 'USDT',
      providerAmount: usdtAmount,
    });
    if (payment.status !== PaymentStatus.Created) {
      return {
        ...this.safePaymentResponse(payment),
        network: dto.network,
        receiverAddress,
        amount: Number(payment.providerAmount),
        currency: payment.providerCurrency,
        minimumConfirmations,
      };
    }
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.Pending },
    });
    return {
      paymentId: payment.id,
      status: PaymentStatus.Pending,
      network: dto.network,
      receiverAddress,
      amount: usdtAmount,
      currency: 'USDT',
      minimumConfirmations,
    };
  }

  async handleStripeWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    if (!rawBody || !signature) {
      throw new UnauthorizedException('Stripe webhook signature is required.');
    }
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException('Stripe webhook verification is not configured.');
    }
    const event = this.verifyStripeSignature(rawBody, signature, secret);
    const session = event.data?.object;
    if (event.type === 'checkout.session.completed' && session?.payment_status === 'paid') {
      const paymentId = session.metadata?.paymentId;
      if (!paymentId || !session.id) {
        throw new BadRequestException('Stripe event is missing payment metadata.');
      }
      return this.confirmPayment({
        provider: 'STRIPE',
        eventId: event.id,
        paymentId,
        providerReference: String(session.payment_intent || session.id),
        gatewayReference: session.id,
        amount: Number(session.amount_total) / 100,
        currency: String(session.currency || '').toUpperCase(),
        requiredCurrency: 'USD',
        channel: PaymentChannelCode.CARD,
        rawBody,
      });
    }

    if (event.type === 'charge.refunded') {
      const charge = session;
      if (!event.id || !charge?.payment_intent) {
        throw new BadRequestException('Stripe refund event is missing its payment reference.');
      }
      if (Number(charge.amount_refunded) !== Number(charge.amount)) {
        throw new ConflictException('Partial card refunds require finance reconciliation.');
      }
      return this.reversePayment(
        'STRIPE',
        event.id,
        String(charge.payment_intent),
        rawBody,
      );
    }
    return { received: true, ignored: true, eventId: event.id };
  }

  async handleUsdtWebhook(
    network: PaymentChannelCode.USDT_TRC20 | PaymentChannelCode.USDT_BEP20,
    rawBody: Buffer | undefined,
    timestamp: string | undefined,
    signature: string | undefined,
  ) {
    if (!rawBody || !timestamp || !signature) {
      throw new UnauthorizedException('Signed USDT payment notification is required.');
    }
    const secret = process.env.USDT_WEBHOOK_SECRET;
    if (!secret || !this.verifyTimestampedHmac(rawBody, timestamp, signature, secret)) {
      throw new UnauthorizedException('USDT payment notification signature is invalid or expired.');
    }
    let event: UsdtPaymentEvent;
    try {
      event = JSON.parse(rawBody.toString('utf8')) as UsdtPaymentEvent;
    } catch {
      throw new BadRequestException('USDT payment event payload is invalid JSON.');
    }
    const expectedAddress = this.getUsdtReceiverAddress(network);
    const minimumConfirmations = Number(process.env.USDT_MIN_CONFIRMATIONS || '12');
    if (
      !event.eventId ||
      !event.paymentId ||
      !/^(0x[a-fA-F0-9]{64}|[a-fA-F0-9]{64})$/.test(event.transactionHash || '') ||
      event.network !== network ||
      event.receiverAddress !== expectedAddress ||
      !Number.isFinite(event.amount) ||
      !Number.isInteger(event.confirmations) ||
      event.confirmations < minimumConfirmations
    ) {
      throw new BadRequestException('USDT payment event failed network, address, amount, or confirmation checks.');
    }
    const payment = await this.prisma.payment.findUnique({
      where: { id: event.paymentId },
      include: { paymentMethod: true },
    });
    if (!payment || payment.paymentMethod.code !== network) {
      throw new BadRequestException('USDT event does not match an active payment request.');
    }
    return this.confirmPayment({
      provider: network,
      eventId: event.eventId,
      paymentId: event.paymentId,
      providerReference: event.transactionHash.toLowerCase(),
      gatewayReference: event.transactionHash.toLowerCase(),
      amount: event.amount,
      currency: 'USDT',
      requiredCurrency: 'USDT',
      channel: network,
      rawBody,
    });
  }

  private async confirmPayment(input: {
    provider: string;
    eventId: string;
    paymentId: string;
    providerReference: string;
    gatewayReference: string;
    amount: number;
    currency: string;
    requiredCurrency: string;
    channel: PaymentChannelCode;
    rawBody: Buffer;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const priorEvent = await tx.paymentWebhookEvent.findUnique({
        where: {
          provider_providerEventId: {
            provider: input.provider,
            providerEventId: input.eventId,
          },
        },
      });
      if (priorEvent) {
        return {
          received: true,
          duplicate: true,
          needsReconciliation: priorEvent.status === 'NEEDS_RECONCILIATION',
          paymentId: priorEvent.paymentId,
        };
      }

      const payment = await tx.payment.findUnique({
        where: { id: input.paymentId },
        include: { paymentMethod: true },
      });
      if (!payment) {
        throw new BadRequestException('Payment request was not found.');
      }
      if (payment.status === PaymentStatus.Confirmed) {
        if (payment.providerReference === input.providerReference) {
          return { received: true, duplicate: true, paymentId: payment.id };
        }
        throw new ConflictException('Payment request has already been settled with a different provider reference.');
      }
      if (payment.status !== PaymentStatus.Pending && payment.status !== PaymentStatus.Created) {
        throw new ConflictException(`Payment in state ${payment.status} cannot be confirmed.`);
      }
      const expectedAmount = new Prisma.Decimal(payment.providerAmount ?? payment.amount);
      if (
        payment.paymentMethod.code !== input.channel ||
        payment.providerCurrency !== input.requiredCurrency ||
        input.currency !== input.requiredCurrency ||
        !Number.isFinite(input.amount) ||
        !new Prisma.Decimal(input.amount).equals(expectedAmount)
      ) {
        throw new BadRequestException('Payment amount, currency, or channel does not match the quote.');
      }

      const event = await tx.paymentWebhookEvent.create({
        data: {
          provider: input.provider,
          providerEventId: input.eventId,
          paymentId: payment.id,
          payloadHash: createHash('sha256').update(input.rawBody).digest('hex'),
        },
      });
      const wallet = await tx.wallet.findUnique({
          where: {
            userId_currency: {
              userId: payment.userId,
              currency: payment.currency,
            },
          },
          select: { id: true },
        });
      if (!wallet) {
        throw new NotFoundException(`Wallet not found for payment ${payment.id}.`);
      }
      const walletCurrency = Object.values(CurrencyCode).find(
        (currency) => currency === payment.currency,
      );
      if (!walletCurrency) {
        throw new BadRequestException('Payment wallet currency is not supported.');
      }
      const ledgerResult = await this.ledgerService.recordGatewayTopup({
        userId: payment.userId,
        walletId: wallet.id,
        currency: walletCurrency,
        amount: Number(payment.amount),
        feeAmount: Number(payment.feeAmount),
        paymentChannel: input.channel,
        referenceId: payment.id,
      }, tx);

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.Confirmed,
          providerReference: input.providerReference,
          gatewayReference: payment.gatewayReference || input.gatewayReference,
          providerEventId: input.eventId,
          ledgerTxId: ledgerResult.transaction.id,
          confirmedAt: new Date(),
        },
      });
      await tx.paymentWebhookEvent.update({
        where: { id: event.id },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });
      return { received: true, duplicate: false, paymentId: updatedPayment.id, status: updatedPayment.status };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async reversePayment(
    provider: string,
    eventId: string,
    providerReference: string,
    rawBody: Buffer,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
      const prior = await tx.paymentWebhookEvent.findUnique({
        where: { provider_providerEventId: { provider, providerEventId: eventId } },
      });
      if (prior) {
        return {
          received: true,
          duplicate: true,
          needsReconciliation: prior.status === 'NEEDS_RECONCILIATION',
          paymentId: prior.paymentId,
        };
      }
      const payment = await tx.payment.findUnique({ where: { providerReference } });
      if (!payment || payment.status !== PaymentStatus.Confirmed || !payment.ledgerTxId) {
        throw new ConflictException('Refund does not match a confirmed, ledger-settled payment.');
      }
      const event = await tx.paymentWebhookEvent.create({
        data: {
          provider,
          providerEventId: eventId,
          paymentId: payment.id,
          payloadHash: createHash('sha256').update(rawBody).digest('hex'),
        },
      });
      await this.ledgerService.recordReversalTransaction(
        payment.ledgerTxId,
        `SYSTEM_${provider}`,
        `Provider reported refund event ${eventId}`,
        tx,
      );
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.Refunded, providerEventId: eventId },
      });
      await tx.paymentWebhookEvent.update({
        where: { id: event.id },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });
      return { received: true, reversed: true, paymentId: payment.id };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error;
      const payment = await this.prisma.payment.findUnique({ where: { providerReference } });
      if (!payment) throw error;
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.NeedsReconciliation },
      });
      await this.prisma.paymentWebhookEvent.create({
        data: {
          provider,
          providerEventId: eventId,
          paymentId: payment.id,
          payloadHash: createHash('sha256').update(rawBody).digest('hex'),
          status: 'NEEDS_RECONCILIATION',
          errorMessage: error.message,
          processedAt: new Date(),
        },
      });
      this.logger.error(`Payment refund requires reconciliation for ${payment.id}: ${error.message}`);
      return { received: true, reversed: false, needsReconciliation: true, paymentId: payment.id };
    }
  }

  private async createPayment(params: {
    userId: string;
    methodId: string;
    currency: CurrencyCode;
    amount: number;
    fee: number;
    idempotencyKey: string;
    providerCurrency: string;
    providerAmount: number;
  }) {
    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existing) {
      if (
        existing.userId !== params.userId ||
        existing.currency !== params.currency ||
        !new Prisma.Decimal(existing.amount).equals(params.amount)
      ) {
        throw new ConflictException('Idempotency key was already used for a different payment request.');
      }
      return existing;
    }
    return this.prisma.payment.create({
      data: {
        userId: params.userId,
        paymentMethodId: params.methodId,
        amount: new Prisma.Decimal(params.amount),
        currency: params.currency,
        feeAmount: new Prisma.Decimal(params.fee),
        providerCurrency: params.providerCurrency,
        providerAmount: new Prisma.Decimal(params.providerAmount),
        idempotencyKey: params.idempotencyKey,
        status: PaymentStatus.Created,
      },
    });
  }

  private async requirePaymentMethod(code: PaymentChannelCode, currency: CurrencyCode) {
    const method = await this.prisma.paymentMethod.findUnique({ where: { code } });
    const supported = Array.isArray(method?.supportedCurrencies)
      ? method.supportedCurrencies as string[]
      : [];
    if (!method || !method.isActive || method.isMock || !supported.includes(currency)) {
      throw new ServiceUnavailableException(`Payment method ${code} is not enabled for ${currency}.`);
    }
    if (
      !Number.isFinite(Number(method.feePercentage)) ||
      Number(method.feePercentage) < 0 ||
      Number(method.feePercentage) > 100 ||
      !Number.isFinite(Number(method.feeFixed)) ||
      Number(method.feeFixed) < 0
    ) {
      throw new ServiceUnavailableException(`Payment fee configuration for ${code} is invalid.`);
    }
    return method;
  }

  private calculateFee(amount: number, percentage: Prisma.Decimal, fixed: Prisma.Decimal) {
    const fee = new Prisma.Decimal(amount)
      .mul(percentage)
      .div(100)
      .add(fixed)
      .toDecimalPlaces(4);
    return fee.toNumber();
  }

  private validatePaymentAmount(amount: number, minimum: Prisma.Decimal, maximum: Prisma.Decimal) {
    if (!Number.isFinite(amount) || amount < Number(minimum) || amount > Number(maximum)) {
      throw new BadRequestException(
        `Payment amount must be between ${minimum.toString()} and ${maximum.toString()}.`,
      );
    }
  }

  private safePaymentResponse(payment: {
    id: string;
    status: PaymentStatus;
    gatewayReference: string | null;
  }) {
    return { paymentId: payment.id, status: payment.status, gatewayReference: payment.gatewayReference };
  }

  private requireSafePublicOrigin(value: string) {
    const url = new URL(value);
    if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('The public payment return URL must use HTTPS.');
    }
    return url.origin;
  }

  private getUsdtReceiverAddress(network: string) {
    const address = network === PaymentChannelCode.USDT_TRC20
      ? process.env.USDT_TRC20_RECEIVER_ADDRESS
      : process.env.USDT_BEP20_RECEIVER_ADDRESS;
    if (!address) {
      throw new ServiceUnavailableException(`USDT receiver address for ${network} is not configured.`);
    }
    return address;
  }

  private verifyStripeSignature(rawBody: Buffer, header: string, secret: string): StripeEvent {
    const parts = header.split(',').reduce<Record<string, string[]>>((all, part) => {
      const [key, value] = part.split('=', 2);
      if (key && value) (all[key] ||= []).push(value);
      return all;
    }, {});
    const timestamp = Number(parts.t?.[0]);
    if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) {
      throw new UnauthorizedException('Stripe webhook timestamp is invalid or expired.');
    }
    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest();
    const valid = (parts.v1 || []).some((candidate) => {
      if (!/^[0-9a-f]{64}$/i.test(candidate)) return false;
      const supplied = Buffer.from(candidate, 'hex');
      return supplied.length === expected.length && timingSafeEqual(supplied, expected);
    });
    if (!valid) throw new UnauthorizedException('Stripe webhook signature is invalid.');
    const event = JSON.parse(rawBody.toString('utf8')) as StripeEvent;
    if (!event.id || !event.type) throw new BadRequestException('Stripe event payload is invalid.');
    return event;
  }

  private verifyTimestampedHmac(rawBody: Buffer, timestamp: string, signature: string, secret: string) {
    const seconds = Number(timestamp);
    if (
      Buffer.byteLength(secret, 'utf8') < 32 ||
      !Number.isSafeInteger(seconds) ||
      Math.abs(Date.now() / 1000 - seconds) > 300 ||
      !/^[0-9a-f]{64}$/i.test(signature)
    ) {
      return false;
    }
    const expected = createHmac('sha256', secret)
      .update(`${seconds}.`)
      .update(rawBody)
      .digest();
    const supplied = Buffer.from(signature, 'hex');
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }
}
