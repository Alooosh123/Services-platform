import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { DynamicFieldDefinition, DynamicFieldInputType } from '@digital-topup/shared';

describe('ProductsService - Dynamic Fields Validation', () => {
  let service: ProductsService;

  const mockPrismaService = {
    game: { findMany: jest.fn(), findUnique: jest.fn() },
    productPackage: { findUnique: jest.fn() },
  };

  const samplePlayerFields: DynamicFieldDefinition[] = [
    {
      key: 'player_id',
      label: 'Player ID',
      type: DynamicFieldInputType.TEXT,
      required: true,
      validationRegex: '^[0-9]{6,12}$',
    },
    {
      key: 'zone_id',
      label: 'Zone ID',
      type: DynamicFieldInputType.TEXT,
      required: false,
      validationRegex: '^[0-9]{4,5}$',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should accept valid player data matching regex', () => {
    const validInputs = { player_id: '51234567', zone_id: '1234' };
    const isValid = service.validateSubmittedPlayerFields(samplePlayerFields, validInputs);
    expect(isValid).toBe(true);
  });

  it('should reject missing required player field', () => {
    const invalidInputs = { zone_id: '1234' }; // missing required player_id
    expect(() => {
      service.validateSubmittedPlayerFields(samplePlayerFields, invalidInputs as any);
    }).toThrow(BadRequestException);
  });

  it('should reject player ID containing letters when numeric regex is enforced', () => {
    const invalidInputs = { player_id: 'INVALID_ALPHA_ID' };
    expect(() => {
      service.validateSubmittedPlayerFields(samplePlayerFields, invalidInputs);
    }).toThrow(BadRequestException);
  });
});
