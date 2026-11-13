import {
  Controller,
  Get,
  Post,
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

}
