import { Test, TestingModule } from '@nestjs/testing';
import { ServiceAccountsService } from './service-accounts.service';
import { AiRiskEvaluatorService } from './engine/ai-risk-evaluator.service';
import { ServiceCapabilitiesConfig } from './capabilities/service-capabilities.config';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServiceAccountStatus } from '@digital-topup/shared';

describe('Linked service accounts: persistent consent and review requirements', () => {
  let service: ServiceAccountsService;
  const mockPrisma: any = {
    user: { findFirst: jest.fn() },
    order: { count: jest.fn().mockResolvedValue(0) },
    linkedServiceAccount: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    linkedServiceConsent: { count: jest.fn().mockResolvedValue(0) },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.linkedServiceAccount.findMany.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceAccountsService,
        AiRiskEvaluatorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(ServiceAccountsService);
  });

  it('reports reference-only capabilities without claiming publisher or OAuth verification', () => {
    const pubg = ServiceCapabilitiesConfig.getCapability('pubg-mobile');
    expect(pubg.defaultStatus).toBe(ServiceAccountStatus.REFERENCE_ONLY);
    expect(pubg.phoneLinkSupported).toBe(false);
  });

  it('rejects account linking without explicit consent before database writes', async () => {
    await expect(service.linkAccount('customer-id', {
      serviceSlug: 'pubg-mobile',
      accountIdentifier: '5123456789',
      consentGranted: false,
    } as any)).rejects.toThrow(BadRequestException);
  });

  it('does not create a linked account for a user absent from the tenant database', async () => {
    await expect(service.linkAccount('unknown-customer', {
      serviceSlug: 'pubg-mobile',
      accountIdentifier: '5123456789',
      consentGranted: true,
      consentScopes: ['REFERENCE_ONLY'],
    } as any)).rejects.toThrow(NotFoundException);
  });

  it('reads linked accounts from PostgreSQL rather than process memory', async () => {
    await expect(service.getMyAccounts('customer-id')).resolves.toEqual({ data: [], total: 0 });
    expect(mockPrisma.linkedServiceAccount.findMany).toHaveBeenCalled();
  });
});
