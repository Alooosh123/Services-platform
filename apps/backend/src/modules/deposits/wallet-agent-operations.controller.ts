import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@digital-topup/shared';
import {
  WalletAgentOperationsService,
  SubmitWalletAgentOperationDto,
} from './wallet-agent-operations.service';

@ApiTags('Wallet Agent Operations')
@Controller('wallet-agent/operations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PAYMENT_AGENT)
@ApiBearerAuth()
export class WalletAgentOperationsController {
  constructor(private readonly operationsService: WalletAgentOperationsService) {}

  @Get('my-queue')
  @ApiOperation({ summary: 'Payment agent: get pending inbound deposit and outbound payout tasks' })
  async getMyQueue(@CurrentUser('id') agentUserId: string) {
    return this.operationsService.getMyQueue(agentUserId);
  }

  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Payment agent: atomically claim a wallet operation' })
  async claim(@Param('id') id: string, @CurrentUser('id') agentUserId: string) {
    return this.operationsService.claim(id, agentUserId);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Payment agent: submit observed wallet transaction details for finance review' })
  async submit(
    @Param('id') id: string,
    @CurrentUser('id') agentUserId: string,
    @Body() dto: SubmitWalletAgentOperationDto,
  ) {
    return this.operationsService.submitVerification(id, agentUserId, dto);
  }
}
