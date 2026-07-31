import { Test, TestingModule } from '@nestjs/testing';
import { CreditsService } from './credits.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('CreditsService', () => {
  let service: CreditsService;
  const prisma = {
    user: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    creditLedger: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((fn) => fn(prisma)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(CreditsService);
  });

  it('returns balance', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({ creditBalance: 42 });
    await expect(service.getBalance('u1')).resolves.toEqual({ balance: 42 });
  });

  it('rejects non-positive grant', async () => {
    await expect(service.grantCredits('u1', 0, 'x')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('debits when balance sufficient', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({ creditBalance: 10 });
    prisma.user.update.mockResolvedValue({ creditBalance: 5 });
    prisma.creditLedger.create.mockResolvedValue({});
    await expect(service.debitCredits('u1', 5, 'job1')).resolves.toEqual({
      balance: 5,
    });
  });

  it('rejects debit when insufficient', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({ creditBalance: 2 });
    await expect(service.debitCredits('u1', 5)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
