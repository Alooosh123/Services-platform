import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PricingEngineService } from './pricing-engine.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  UserRole,
  CreatePriceRuleDto,
  PricePreviewDto,
} from '@digital-topup/shared';

@ApiTags('Pricing Engine (Phase P06)')
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingEngine: PricingEngineService) {}

  @Post('preview')
  @ApiOperation({ summary: 'Calculate live pricing preview based on hierarchical rules and FX' })
  async previewPrice(@Body() dto: PricePreviewDto) {
    return this.pricingEngine.calculatePrice(dto);
  }

  @Get('rules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get all active pricing rules and their version history' })
  async getActiveRules() {
    return this.pricingEngine.getAllActiveRules();
  }

  @Post('rules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create a new versioned pricing rule with audit reason' })
  async createPriceRule(@Request() req: any, @Body() dto: CreatePriceRuleDto) {
    const userId = req.user?.id || 'admin-user';
    return this.pricingEngine.createPriceRule(userId, dto);
  }
}
