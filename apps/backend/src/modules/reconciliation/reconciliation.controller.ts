import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReconciliationService } from './reconciliation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, RunReconciliationDto } from '@digital-topup/shared';

@ApiTags('Daily Financial Reconciliation')
@Controller('reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Get('batches')
  @ApiOperation({ summary: 'Admin/Finance: List all daily reconciliation batches and summaries' })
  async listBatches() {
    return this.reconciliationService.listBatches();
  }

  @Get('batches/:id')
  @ApiOperation({ summary: 'Admin/Finance: Get detailed reconciliation batch items and exceptions' })
  async getBatchById(@Param('id') id: string) {
    return this.reconciliationService.getBatchById(id);
  }

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin/Finance: Execute 3-way daily reconciliation batch (Bank ↔ Deposits ↔ Payouts ↔ Ledger)' })
  async runReconciliation(
    @CurrentUser('id') staffId: string,
    @Body() dto: RunReconciliationDto,
  ) {
    return this.reconciliationService.runDailyReconciliation(staffId, dto);
  }

  @Roles(UserRole.FINANCE_MANAGER)
  @Post('items/:itemId/adjustment/propose')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Finance: propose a balanced ledger adjustment for a validated amount/fee discrepancy' })
  async proposeLedgerAdjustment(
    @CurrentUser('id') staffId: string,
    @Param('itemId') itemId: string,
    @Body('debitAccountCode') debitAccountCode: string,
    @Body('creditAccountCode') creditAccountCode: string,
    @Body('notes') notes: string,
  ) {
    return this.reconciliationService.proposeLedgerAdjustment(
      staffId, itemId, debitAccountCode, creditAccountCode, notes,
    );
  }

  @Roles(UserRole.FINANCE_MANAGER)
  @Post('adjustments/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finance: independently approve and post the proposed double-entry adjustment' })
  async approveLedgerAdjustment(
    @CurrentUser('id') staffId: string,
    @Param('id') id: string,
    @Body('approvalNotes') approvalNotes: string,
  ) {
    return this.reconciliationService.approveLedgerAdjustment(staffId, id, approvalNotes);
  }

  @Roles(UserRole.FINANCE_MANAGER)
  @Post('resolve-discrepancy/:itemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin/Finance: Manually resolve reconciliation discrepancy or dispute' })
  async resolveDiscrepancy(
    @CurrentUser('id') staffId: string,
    @Param('itemId') itemId: string,
    @Body('notes') notes: string,
    @Body('action') action: 'ADJUST_LEDGER' | 'REJECT_EXTERNAL' | 'FORCE_MATCH',
  ) {
    return this.reconciliationService.resolveDiscrepancy(staffId, itemId, notes, action || 'ADJUST_LEDGER');
  }
}
