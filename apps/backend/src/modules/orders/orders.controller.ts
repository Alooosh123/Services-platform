import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto, RetryOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  OrderStatus,
  UserRole,
  ManualFulfillmentDto,
  OrderRefundDto,
} from '@digital-topup/shared';
import { RequireTransactionPin } from '../auth/decorators/require-transaction-pin.decorator';
import { TransactionPinGuard } from '../auth/guards/transaction-pin.guard';
import { PoliciesGuard } from '../auth/guards/policies.guard';
import { RequirePolicy } from '../auth/decorators/require-policy.decorator';
import { RedisRateLimitGuard } from '../../security/redis-rate-limit.guard';
import { RateLimit } from '../../security/rate-limit.decorator';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RedisRateLimitGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  @RequireTransactionPin()
  @RequirePolicy('orders:create')
  @UseGuards(PoliciesGuard, TransactionPinGuard)
  @RateLimit(10, 60_000, 'orders-checkout')
  @ApiOperation({ summary: 'Submit a topup checkout order with atomic balance hold' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Must exactly match body.idempotencyKey' })
  @ApiResponse({ status: 201, description: 'Order created with dynamic snapshots and double-entry payment' })
  async checkout(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateOrderDto,
    @Headers('Idempotency-Key') idempotencyHeader?: string,
  ) {
    const headerKey = idempotencyHeader?.trim();
    const bodyKey = typeof dto?.idempotencyKey === 'string' ? dto.idempotencyKey.trim() : '';
    if (!headerKey || !bodyKey || bodyKey !== headerKey || dto.idempotencyKey !== bodyKey) {
      throw new BadRequestException('Idempotency-Key header must exactly match body.idempotencyKey.');
    }
    return this.ordersService.createOrder(userId, dto);
  }

  @Get('my-orders')
  @ApiOperation({ summary: 'Customer: List personal order history' })
  async getMyOrders(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: OrderStatus,
  ) {
    return this.ordersService.getMyOrders(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      status,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Customer/Staff: Get detailed order status by ID or order number' })
  async getOrderById(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') orderIdentifier: string,
  ) {
    const isStaff = role && role !== UserRole.CUSTOMER;
    return this.ordersService.getOrderById(userId, orderIdentifier, isStaff);
  }

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FULFILLMENT_OPERATOR, UserRole.SUPPORT, UserRole.FINANCE)
  @ApiOperation({ summary: 'Admin: Search and filter platform orders' })
  async getAdminOrders(
    @Query('status') status?: OrderStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.getAdminOrders({
      status,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Post('admin/:id/fulfill-manual')
  @UseGuards(RolesGuard)
  @RateLimit(10, 60_000, 'orders-admin-manual-fulfill')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FULFILLMENT_OPERATOR)
  @ApiOperation({ summary: 'Admin: Manually fulfill order with voucher pin or proof' })
  async fulfillManual(
    @CurrentUser('id') staffId: string,
    @Param('id') orderId: string,
    @Body() dto: ManualFulfillmentDto,
  ) {
    return this.ordersService.adminManualFulfill(staffId, orderId, dto);
  }

  @Post('admin/:id/refund')
  @UseGuards(RolesGuard)
  @RateLimit(5, 60_000, 'orders-admin-refund')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: Refund order and reverse ledger entries' })
  async refundOrder(
    @CurrentUser('id') staffId: string,
    @Param('id') orderId: string,
    @Body() dto: OrderRefundDto,
  ) {
    return this.ordersService.adminRefundOrder(staffId, orderId, dto);
  }

  @Post('admin/:id/retry')
  @UseGuards(RolesGuard)
  @RateLimit(5, 60_000, 'orders-admin-retry')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FULFILLMENT_OPERATOR)
  @ApiOperation({ summary: 'Admin: Trigger manual fulfillment/retry' })
  async retryOrder(
    @CurrentUser('id') staffId: string,
    @Param('id') orderId: string,
    @Body() dto: RetryOrderDto,
  ) {
    return this.ordersService.adminRetryOrder(staffId, orderId, dto);
  }
}
