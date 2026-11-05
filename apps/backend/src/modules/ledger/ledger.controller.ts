import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { LedgerService } from './ledger.service';
import { AdminBalanceAdjustmentDto } from './dto/ledger-adjustment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, LedgerTransactionType } from '@digital-topup/shared';

@ApiTags('Financial Ledger & Auditing')
@Controller('ledger')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Post('admin/adjust-balance')
  @Roles(UserRole.OWNER, UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Admin manual balance adjustment with mandatory audit trail' })
  @ApiResponse({ status: 201, description: 'Double-entry transaction recorded and balance updated' })
  async adjustBalance(
    @CurrentUser('id') staffId: string,
    @Body() dto: AdminBalanceAdjustmentDto,
  ) {
    return this.ledgerService.adminAdjustBalance(staffId, dto);
  }

  @Post('admin/reverse-transaction')
  @Roles(UserRole.OWNER, UserRole.FINANCE_MANAGER)
  @ApiOperation({ summary: 'Admin reversal of a previously posted double-entry transaction' })
  async reverseTransaction(
    @CurrentUser('id') staffId: string,
    @Body() body: { transactionId: string; reason: string },
  ) {
    return this.ledgerService.recordReversalTransaction(body.transactionId, staffId, body.reason);
  }

  @Get('admin/statement')
  @Roles(UserRole.OWNER, UserRole.FINANCE_MANAGER, UserRole.GENERAL_MANAGER, UserRole.AUDITOR)
  @ApiOperation({ summary: 'Query double-entry financial ledger statement with filters' })
  async getAdminStatement(
    @Query('walletId') walletId?: string,
    @Query('accountCode') accountCode?: string,
    @Query('type') type?: LedgerTransactionType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ledgerService.getLedgerStatement({
      walletId,
      accountCode,
      type,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('my-statement')
  @ApiOperation({ summary: 'Customer personal wallet ledger entries statement' })
  async getMyStatement(
    @Query('walletId') walletId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ledgerService.getLedgerStatement({
      walletId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }
}
