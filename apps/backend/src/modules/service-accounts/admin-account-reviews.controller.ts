import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ServiceAccountsService } from './service-accounts.service';
import { ResolveReviewDto } from './dto/resolve-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, AccountReviewStatus } from '@digital-topup/shared';

@ApiTags('Account Reviews Queue (Admin)')
@Controller('admin/account-reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminAccountReviewsController {
  constructor(private readonly serviceAccountsService: ServiceAccountsService) {}

  @Get()
  @Roles(
    UserRole.OWNER,
    UserRole.GENERAL_MANAGER,
    UserRole.SUPPORT,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  @ApiOperation({ summary: 'Admin: List pending account review cases with AI recommendations' })
  @ApiResponse({ status: 200, description: 'List of review cases with risk explanations' })
  async getReviewCases(
    @Query('status') status?: AccountReviewStatus,
    @Query('search') search?: string,
  ) {
    return this.serviceAccountsService.getAdminReviewCases(status, search);
  }

  @Post(':id/resolve')
  @Roles(
    UserRole.OWNER,
    UserRole.GENERAL_MANAGER,
    UserRole.SUPPORT,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: Resolve review case (Approve / Reject / Needs Info)' })
  @ApiResponse({ status: 200, description: 'Review case resolved with audit trail (Zero financial impact)' })
  async resolveCase(
    @CurrentUser('id') staffId: string,
    @Param('id') reviewId: string,
    @Body() dto: ResolveReviewDto,
  ) {
    return this.serviceAccountsService.resolveAdminReview(staffId, reviewId, dto);
  }
}
