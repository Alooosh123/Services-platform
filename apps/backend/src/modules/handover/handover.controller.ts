import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HandoverService } from './handover.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@digital-topup/shared';
import { RunDrillDto, SignHandoverDto } from './dto/handover.dto';

@ApiTags('Operations Handover & Runbooks (Phase 12)')
@Controller('handover')
export class HandoverController {
  constructor(private readonly handoverService: HandoverService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Get operational and business KPIs dashboard' })
  async getOperationalKpis() {
    return this.handoverService.getOperationalKpis();
  }

  @Get('runbooks')
  @ApiOperation({ summary: 'List all operational and financial SOP runbooks' })
  async getRunbooks() {
    return this.handoverService.getRunbooks();
  }

  @Post('drills')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OWNER,
    UserRole.FINANCE_MANAGER,
    UserRole.FINANCE,
    UserRole.SUPPORT,
    UserRole.SUPER_ADMIN,
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Execute an operational acceptance drill (Support, Daily Close, Historical Audit)' })
  async executeDrill(@Body() dto: RunDrillDto, @Request() req: any) {
    const adminUserId = req.user?.id || 'admin-drill-runner';
    return this.handoverService.executeOperationalDrill(dto, adminUserId);
  }

  @Get('drills/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OWNER,
    UserRole.FINANCE_MANAGER,
    UserRole.FINANCE,
    UserRole.SUPER_ADMIN,
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get history of executed operational drills' })
  async getDrillHistory() {
    return this.handoverService.getDrillHistory();
  }

  @Get('sign-off')
  @ApiOperation({ summary: 'Get formal handover sign-off package and status' })
  async getHandoverSignOff() {
    return this.handoverService.getHandoverSignOffPackage();
  }

  @Get('package')
  @ApiOperation({ summary: 'Get formal handover sign-off package (alias)' })
  async getHandoverPackage() {
    return this.handoverService.getHandoverSignOffPackage();
  }

  @Post('sign-off')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign the formal operational handover document' })
  async signHandover(@Body() dto: SignHandoverDto, @Request() req: any) {
    const adminUserId = req.user?.id || 'admin';
    return this.handoverService.signHandoverPackage(dto, adminUserId);
  }
}
