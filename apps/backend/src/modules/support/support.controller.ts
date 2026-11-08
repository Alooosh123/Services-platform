import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimit } from '../../security/rate-limit.decorator';
import { RedisRateLimitGuard } from '../../security/redis-rate-limit.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  UserRole,
  TicketStatus,
  TicketCategory,
  CreateSupportTicketDto,
  AddTicketMessageDto,
  UpdateTicketStatusDto,
  ResolveDisputeRefundDto,
} from '@digital-topup/shared';

@ApiTags('Customer Support, Tickets & Dispute Center (Phase 08 - AR-01 & AR-15)')
@Controller('support')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  // ----------------------------------------------------
  // CUSTOMER ENDPOINTS (BOLA Protected)
  // ----------------------------------------------------

  @Post('tickets')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(5, 60_000, 'support-ticket-create')
  @ApiOperation({ summary: 'Create support ticket (linked to order/deposit with idempotency)' })
  async createTicket(@Request() req: any, @Body() dto: CreateSupportTicketDto) {
    const userId = req.user?.id || req.user?.userId;
    return this.supportService.createTicket(userId, dto);
  }

  @Get('tickets')
  @ApiOperation({ summary: 'List customer own tickets with unread status' })
  async getMyTickets(
    @Request() req: any,
    @Query('status') status?: TicketStatus,
    @Query('category') category?: TicketCategory,
  ) {
    const userId = req.user?.id || req.user?.userId;
    const userRole = (req.user?.role as UserRole) || UserRole.CUSTOMER;
    return this.supportService.listTickets(userId, userRole, status, category);
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Get single ticket with message history (internal notes redacted for customer)' })
  async getTicketDetails(@Request() req: any, @Param('id') id: string) {
    const userId = req.user?.id || req.user?.userId;
    const userRole = (req.user?.role as UserRole) || UserRole.CUSTOMER;
    return this.supportService.getTicketById(id, userId, userRole);
  }

  @Post('tickets/:id/messages')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(20, 60_000, 'support-customer-reply')
  @ApiOperation({ summary: 'Reply to support ticket' })
  async addCustomerReply(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: AddTicketMessageDto,
  ) {
    const userId = req.user?.id || req.user?.userId;
    const userRole = (req.user?.role as UserRole) || UserRole.CUSTOMER;
    const senderName = req.user?.fullName || req.user?.name || 'العميل';
    return this.supportService.addMessage(id, userId, userRole, dto, senderName);
  }

  // ----------------------------------------------------
  // ADMIN & SUPPORT AGENT ENDPOINTS
  // ----------------------------------------------------

  @Get('admin/tickets')
  @Roles(UserRole.SUPPORT, UserRole.ADMIN, UserRole.OWNER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'List all support tickets for support portal' })
  async listAllTickets(
    @Request() req: any,
    @Query('status') status?: TicketStatus,
    @Query('category') category?: TicketCategory,
  ) {
    const userId = req.user?.id || req.user?.userId;
    const userRole = (req.user?.role as UserRole) || UserRole.SUPPORT;
    return this.supportService.listTickets(userId, userRole, status, category);
  }

  @Patch('admin/tickets/:id/status')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(20, 60_000, 'support-admin-status')
  @Roles(UserRole.SUPPORT, UserRole.ADMIN, UserRole.OWNER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Update ticket status (Resolved, Closed, In Progress)' })
  async updateTicketStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    const staffUserId = req.user?.id || req.user?.userId;
    return this.supportService.updateStatus(id, staffUserId, dto);
  }

  @Post('admin/tickets/:id/assign')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(20, 60_000, 'support-admin-assign')
  @Roles(UserRole.SUPPORT, UserRole.ADMIN, UserRole.OWNER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Assign ticket to support agent' })
  async assignTicket(
    @Request() req: any,
    @Param('id') id: string,
    @Body('agentUserId') agentUserId: string,
    @Body('agentName') agentName?: string,
  ) {
    return this.supportService.assignTicket(id, agentUserId, agentName);
  }

  @Post('admin/tickets/:id/internal-notes')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(20, 60_000, 'support-admin-note')
  @Roles(UserRole.SUPPORT, UserRole.ADMIN, UserRole.OWNER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Add confidential internal note (strictly hidden from customer)' })
  async addInternalNote(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: { message: string },
  ) {
    const staffUserId = req.user?.id || req.user?.userId;
    const userRole = (req.user?.role as UserRole) || UserRole.SUPPORT;
    const senderName = req.user?.fullName || 'موظف الدعم الفني';
    return this.supportService.addMessage(
      id,
      staffUserId,
      userRole,
      { message: dto.message, isInternalNote: true },
      senderName,
    );
  }

  @Get('admin/tickets/:id/diagnose')
  @Roles(UserRole.SUPPORT, UserRole.ADMIN, UserRole.OWNER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'AR-15: Diagnose linked order status, vendor error, and fulfillment diagnostics' })
  async diagnoseOrder(@Request() req: any, @Param('id') id: string) {
    const staffUserId = req.user?.id || req.user?.userId;
    return this.supportService.diagnoseOrder(id, staffUserId);
  }

  @Post('admin/tickets/:id/resolve-dispute')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(5, 60_000, 'support-dispute-review')
  @Roles(UserRole.FINANCE_MANAGER, UserRole.ADMIN, UserRole.OWNER)
  @ApiOperation({ summary: 'AR-01: Resolve dispute refund request with audit notes' })
  async resolveDispute(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeRefundDto,
  ) {
    const staffUserId = req.user?.id || req.user?.userId;
    return this.supportService.resolveDisputeRefund(id, staffUserId, dto);
  }
}
