import { createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { CurrencyCode, PaymentChannelCode } from '@digital-topup/shared';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService global payment notifications', () => {
  const stripeSecret = 'test-stripe-webhook-secret';
  let prisma: any;
  let ledger: any;
  let service: PaymentsService;
  let priorEvent: any;

  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = stripeSecret;
    priorEvent = null;
    const tx = {
      paymentWebhookEvent: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(priorEvent)),
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment-1',
          userId: 'user-1',
          paymentMethodId: 'method-card',
          amount: new Prisma.Decimal(10),
          feeAmount: new Prisma.Decimal(0.5),
          providerAmount: new Prisma.Decimal(10.5),
          providerCurrency: 'USD',
          currency: CurrencyCode.USD,
          status: PaymentStatus.Pending,
          gatewayReference: 'cs_test_1',
          paymentMethod: { code: PaymentChannelCode.CARD },
        }),
        update: jest.fn().mockResolvedValue({ id: 'payment-1', status: PaymentStatus.Confirmed }),
      },
      wallet: {
        findUnique: jest.fn().mockResolvedValue({ id: 'wallet-1' }),
      },
    };
    prisma = {
      tx,
      $transaction: jest.fn((callback) => callback(tx)),
    };
    ledger = {
      recordGatewayTopup: jest.fn().mockResolvedValue({
        transaction: { id: 'ledger-topup-1' },
      }),
    };
    service = new PaymentsService(prisma, ledger);
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  function signedStripeEvent() {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = Buffer.from(JSON.stringify({
      id: 'evt_paid_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          payment_status: 'paid',
          amount_total: 1050,
          currency: 'usd',
          payment_intent: 'pi_test_1',
          metadata: { paymentId: 'payment-1' },
        },
      },
    }));
    const signature = createHmac('sha256', stripeSecret)
      .update(`${timestamp}.`)
      .update(body)
      .digest('hex');
    return { body, signature: `t=${timestamp},v1=${signature}` };
  }

  it('credits the wallet through ledger once after a valid signed paid event', async () => {
    const event = signedStripeEvent();
    const result = await service.handleStripeWebhook(event.body, event.signature);

    expect(result).toMatchObject({ received: true, duplicate: false, paymentId: 'payment-1' });
    expect(ledger.recordGatewayTopup).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        walletId: 'wallet-1',
        currency: CurrencyCode.USD,
        amount: 10,
        feeAmount: 0.5,
        paymentChannel: PaymentChannelCode.CARD,
        referenceId: 'payment-1',
      }),
      prisma.tx,
    );
    expect(prisma.tx.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'payment-1' },
      data: expect.objectContaining({
        status: PaymentStatus.Confirmed,
        providerReference: 'pi_test_1',
        ledgerTxId: 'ledger-topup-1',
      }),
    }));
  });

  it('rejects forged Stripe signatures before accessing payment or ledger data', async () => {
    const event = signedStripeEvent();
    await expect(service.handleStripeWebhook(event.body, 't=1,v1=00')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(ledger.recordGatewayTopup).not.toHaveBeenCalled();
  });

  it('acknowledges a duplicate provider event without a second ledger credit', async () => {
    priorEvent = { id: 'event-1', status: 'PROCESSED', paymentId: 'payment-1' };
    const event = signedStripeEvent();
    const result = await service.handleStripeWebhook(event.body, event.signature);

    expect(result).toMatchObject({ received: true, duplicate: true, paymentId: 'payment-1' });
    expect(ledger.recordGatewayTopup).not.toHaveBeenCalled();
  });
});
