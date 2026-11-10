import { Prisma } from '@prisma/client';
import { UserRole, DepositStatus } from '@digital-topup/shared';
import { EncryptionService } from '../../security/encryption.service';
import { LedgerService } from '../ledger/ledger.service';
import { WalletAgentOperationsService } from './wallet-agent-operations.service';

describe('WalletAgentOperationsService manual auto-credit security', () => {
  const originalEnabled = process.env.ENABLE_AGENT_AUTO_CREDIT;
  const originalLimit = process.env.WALLET_AGENT_AUTO_CREDIT_MAX_AMOUNT_YER;
  const encryption = new EncryptionService();
  let service: WalletAgentOperationsService;
  let prisma: any;
  let tx: any;
  let operation: any;
  let deposit: any;
  let config: any;
  let ledger: any;
  let duplicateReference: any;

  beforeEach(() => {
    process.env.ENABLE_AGENT_AUTO_CREDIT = 'true';
    process.env.WALLET_AGENT_AUTO_CREDIT_MAX_AMOUNT_YER = '10000';
    operation = {
      id: 'operation-1',
      tenantId: null,
      direction: 'INBOUND_DEPOSIT',
      status: 'CLAIMED',
      depositRequestId: 'deposit-1',
      customerUserId: 'customer-1',
      agentUserId: 'agent-1',
      expectedAmount: new Prisma.Decimal(5000),
      expectedCurrency: 'YER',
      expectedReferenceNumber: null,
      expectedAccountLastFour: '1234',
      expectedSenderAccountLastFour: '4567',
    };
    deposit = {
      id: 'deposit-1',
      userId: 'customer-1',
      walletId: 'wallet-1',
      amount: new Prisma.Decimal(5000),
      currency: 'YER',
      paymentMethodCode: 'JAIB',
      referenceNumber: 'PENDING-local-token',
      status: DepositStatus.PENDING,
      settlementStatus: 'NOT_STARTED',
      senderAccountId: 'sender-1',
      senderAccount: {
        id: 'sender-1',
        identifierType: 'PHONE',
        identifierCiphertext: encryption.encrypt('967771234567'),
        identifierLastFour: '4567',
        status: 'PENDING_VERIFICATION',
      },
    };
    config = {
      accountNumber: '7700001234',
      regulatoryApprovalReference: 'REG-001',
      regulatoryApprovalDocumentUrl: 'https://example.test/regulatory.pdf',
      providerAgreementReference: 'AGR-001',
      providerAgreementDocumentUrl: 'https://example.test/agreement.pdf',
    };
    duplicateReference = null;

    tx = {
      walletAgentOperation: {
        findFirst: jest.fn().mockResolvedValue(operation),
        update: jest.fn(async ({ data }: any) => ({ ...operation, ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      depositRequest: {
        findUnique: jest.fn().mockResolvedValue(deposit),
        findFirst: jest.fn(async () => duplicateReference),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(async ({ data }: any) => ({ ...deposit, ...data })),
      },
      paymentChannelConfig: {
        findFirst: jest.fn().mockResolvedValue(config),
      },
      paymentSenderAccount: {
        update: jest.fn().mockResolvedValue({ id: 'sender-1', status: 'VERIFIED' }),
      },
      depositStatusHistory: {
        create: jest.fn().mockResolvedValue({ id: 'history-1' }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    ledger = {
      recordTopup: jest.fn().mockResolvedValue({
        transaction: { id: 'ledger-1', txNumber: 'LTX-1', status: 'POSTED' },
      }),
    };
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'agent-1',
          role: UserRole.PAYMENT_AGENT,
          tenantId: null,
        }),
      },
      walletAgentOperation: tx.walletAgentOperation,
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    service = new WalletAgentOperationsService(
      prisma,
      ledger as unknown as LedgerService,
      encryption,
    );
  });

  afterAll(() => {
    if (originalEnabled === undefined) delete process.env.ENABLE_AGENT_AUTO_CREDIT;
    else process.env.ENABLE_AGENT_AUTO_CREDIT = originalEnabled;
    if (originalLimit === undefined) delete process.env.WALLET_AGENT_AUTO_CREDIT_MAX_AMOUNT_YER;
    else process.env.WALLET_AGENT_AUTO_CREDIT_MAX_AMOUNT_YER = originalLimit;
  });

  const verification = (overrides: Partial<any> = {}) => ({
    observedAmount: 5000,
    observedCurrency: 'YER',
    observedReferenceNumber: 'JAIB-TXN-00001',
    observedAccountLastFour: '1234',
    observedSenderIdentifier: '+967 771 234 567',
    evidenceReference: 'STATEMENT-LINE-001',
    ...overrides,
  });

  it('posts a balanced ledger top-up only after exact sender, receiver, amount, currency and unique reference match', async () => {
    const result = await service.submitVerification('operation-1', 'agent-1', verification());

    expect(result.autoCredited).toBe(true);
    expect(result.requiresFinanceReview).toBe(false);
    expect(result.status).toBe('POSTED');
    expect(ledger.recordTopup).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'customer-1',
        walletId: 'wallet-1',
        amount: 5000,
        currency: 'YER',
        referenceId: 'deposit-1',
        performedByUserId: 'agent-1',
      }),
      tx,
    );
    expect(tx.depositRequest.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.paymentSenderAccount.update).toHaveBeenCalledWith({
      where: { id: 'sender-1' },
      data: expect.objectContaining({ status: 'VERIFIED' }),
    });
    expect(tx.walletAgentOperation.update).toHaveBeenCalledWith({
      where: { id: 'operation-1' },
      data: expect.objectContaining({ status: 'POSTED', ledgerTxId: 'ledger-1' }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'WALLET_AGENT_AUTOCREDIT_POSTED' }),
      }),
    );
  });

  it('does not credit when the observed sender identity does not match the saved customer account', async () => {
    const result = await service.submitVerification(
      'operation-1',
      'agent-1',
      verification({ observedSenderIdentifier: '967771111111' }),
    );

    expect(result.autoCredited).toBe(false);
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(ledger.recordTopup).not.toHaveBeenCalled();
    expect(tx.paymentSenderAccount.update).not.toHaveBeenCalled();
  });

  it('does not credit a transaction reference already attached to another deposit', async () => {
    duplicateReference = { id: 'another-deposit' };
    const result = await service.submitVerification('operation-1', 'agent-1', verification());

    expect(result.autoCredited).toBe(false);
    expect(ledger.recordTopup).not.toHaveBeenCalled();
  });

  it('falls back to finance review when automatic credit is disabled', async () => {
    process.env.ENABLE_AGENT_AUTO_CREDIT = 'false';
    const result = await service.submitVerification('operation-1', 'agent-1', verification());

    expect(result.autoCredited).toBe(false);
    expect(result.requiresFinanceReview).toBe(true);
    expect(ledger.recordTopup).not.toHaveBeenCalled();
    expect(tx.depositRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'deposit-1' },
        data: expect.objectContaining({ referenceNumber: 'JAIB-TXN-00001' }),
      }),
    );
  });

  it('falls back to finance review when the deposit exceeds the configured YER ceiling', async () => {
    process.env.WALLET_AGENT_AUTO_CREDIT_MAX_AMOUNT_YER = '1000';
    const result = await service.submitVerification('operation-1', 'agent-1', verification());

    expect(result.autoCredited).toBe(false);
    expect(result.requiresFinanceReview).toBe(true);
    expect(ledger.recordTopup).not.toHaveBeenCalled();
  });
});
