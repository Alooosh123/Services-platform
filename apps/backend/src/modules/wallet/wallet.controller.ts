import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { WalletService } from './wallet.service';
import { DepositFundsDto } from '../ledger/dto/ledger-adjustment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrencyCode, PaymentChannelCode, UserRole } from '@digital-topup/shared';
import { RedisRateLimitGuard } from '../../security/redis-rate-limit.guard';
import { RateLimit } from '../../security/rate-limit.decorator';

export class FreezeWalletDto {
  @ApiProperty({ description: 'سبب تجميد المحفظة', example: 'مراجعة أمنية لنشاط غير معتاد' })
  @IsNotEmpty({ message: 'سبب التجميد مطلوب إجبارياً' })
  @IsString()
  reason: string;
}

@ApiTags('Wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balances')
  @ApiOperation({ summary: 'Get all currency wallets (YER, USD, SAR) with available & locked balances' })
  async getBalances(@CurrentUser('id') userId: string) {
    return this.walletService.getWalletsByUserId(userId);
  }

  @Get('balance/:currency')
  @ApiOperation({ summary: 'Get specific currency wallet' })
  async getBalance(
    @CurrentUser('id') userId: string,
    @Param('currency') currency: CurrencyCode,
  ) {
    return this.walletService.getWallet(userId, currency);
  }

  @Post('admin/:walletId/freeze')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(10, 60_000, 'wallet-freeze')
  @Roles(UserRole.ADMIN, UserRole.FINANCE, UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.FINANCE_MANAGER)
  @ApiOperation({ summary: 'Admin: Freeze a customer wallet with reason' })
  async freezeWallet(
    @CurrentUser('id') staffId: string,
    @Param('walletId') walletId: string,
    @Body() dto: FreezeWalletDto,
  ) {
    return this.walletService.freezeWallet(staffId, walletId, dto.reason);
  }

  @Post('admin/:walletId/unfreeze')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(10, 60_000, 'wallet-unfreeze')
  @Roles(UserRole.ADMIN, UserRole.FINANCE, UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.FINANCE_MANAGER)
  @ApiOperation({ summary: 'Admin: Unfreeze a customer wallet' })
  async unfreezeWallet(
    @CurrentUser('id') staffId: string,
    @Param('walletId') walletId: string,
  ) {
    return this.walletService.unfreezeWallet(staffId, walletId);
  }

  @Get('admin/customer/:customerId')
  @Roles(UserRole.ADMIN, UserRole.FINANCE, UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.FINANCE_MANAGER)
  @ApiOperation({ summary: 'Admin: Inspect wallets of a specific customer' })
  async getCustomerWallets(@Param('customerId') customerId: string) {
    return this.walletService.getWalletsForAdmin(customerId);
  }

  @Post('topup/request')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(5, 60_000, 'wallet-topup-request')
  @ApiOperation({ summary: 'Submit manual transfer topup request with proof or reference number' })
  async requestTopup(
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      currency: CurrencyCode;
      amount: number;
      paymentMethodCode: PaymentChannelCode;
      referenceNumber: string;
      proofImage?: string;
    },
  ) {
    return this.walletService.requestTopup(userId, body);
  }

  @Post('admin/topup/:id/confirm')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(10, 60_000, 'wallet-topup-confirm')
  @Roles(UserRole.OWNER, UserRole.FINANCE_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Admin confirms verified topup and credits customer wallet via ledger' })
  async confirmTopup(
    @CurrentUser('id') staffId: string,
    @Param('id') topupId: string,
  ) {
    return this.walletService.confirmTopup(staffId, topupId);
  }

  @Post('deposit')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(2, 60_000, 'wallet-test-deposit')
  @ApiOperation({ summary: 'Instant test deposit for development demo simulation' })
  async deposit(@CurrentUser('id') userId: string, @Body() dto: DepositFundsDto) {
    return this.walletService.depositFunds(userId, dto);
  }
}
