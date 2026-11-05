import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@digital-topup/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AssignTierDto } from './dto/assign-tier.dto';
import { CreateSubAgentDto } from './dto/create-sub-agent.dto';
import { CreateTierDto } from './dto/create-tier.dto';
import { SetAgentPriceDto } from './dto/set-agent-price.dto';
import { SetTierProductPriceDto } from './dto/set-tier-product-price.dto';
import { UpdateSubAgentDto } from './dto/update-sub-agent.dto';
import { UpdateTierDto } from './dto/update-tier.dto';
import { SubAgentsService } from './sub-agents.service';
import { TiersService } from './tiers.service';

@ApiTags('Users, Tiers & Agents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class UsersAndAgentsController {
  constructor(
    private readonly tiersService: TiersService,
    private readonly subAgentsService: SubAgentsService,
  ) {}

  @Get('tiers')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER, UserRole.RESELLER, UserRole.SUB_AGENT)
  listTiers() {
    return this.tiersService.list();
  }

  @Post('admin/tiers')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN)
  createTier(@Body() dto: CreateTierDto) {
    return this.tiersService.create(dto);
  }

  @Patch('admin/tiers/:tierId')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN)
  updateTier(@Param('tierId') tierId: string, @Body() dto: UpdateTierDto) {
    return this.tiersService.update(tierId, dto);
  }

  @Get('admin/tiers/:tierId/product-prices')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN)
  listTierPrices(@Param('tierId') tierId: string) {
    return this.tiersService.listProductPrices(tierId);
  }

  @Put('admin/tiers/:tierId/product-prices')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN)
  setTierPrice(@Param('tierId') tierId: string, @Body() dto: SetTierProductPriceDto) {
    return this.tiersService.setProductPrice(tierId, dto);
  }

  @Patch('admin/users/:userId/tier')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN)
  assignTier(@Param('userId') userId: string, @Body() dto: AssignTierDto) {
    return this.tiersService.assignUser(userId, dto);
  }

  @Post('agents/sub-agents')
  @Roles(UserRole.RESELLER)
  createSubAgent(@CurrentUser('id') parentAgentId: string, @Body() dto: CreateSubAgentDto) {
    return this.subAgentsService.create(parentAgentId, dto);
  }

  @Get('agents/sub-agents')
  @Roles(UserRole.RESELLER)
  listSubAgents(@CurrentUser('id') parentAgentId: string) {
    return this.subAgentsService.list(parentAgentId);
  }

  @Patch('agents/sub-agents/:subAgentId')
  @Roles(UserRole.RESELLER)
  updateSubAgent(
    @CurrentUser('id') parentAgentId: string,
    @Param('subAgentId') subAgentId: string,
    @Body() dto: UpdateSubAgentDto,
  ) {
    return this.subAgentsService.update(parentAgentId, subAgentId, dto);
  }

  @Put('agents/sub-agents/:subAgentId/prices')
  @Roles(UserRole.RESELLER)
  setCustomPrice(
    @CurrentUser('id') parentAgentId: string,
    @Param('subAgentId') subAgentId: string,
    @Body() dto: SetAgentPriceDto,
  ) {
    return this.subAgentsService.setCustomPrice(parentAgentId, subAgentId, dto);
  }

  @Get('agents/reports')
  @Roles(UserRole.RESELLER)
  reports(@CurrentUser('id') parentAgentId: string) {
    return this.subAgentsService.reports(parentAgentId);
  }
}
