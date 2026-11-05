import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PilotService } from './pilot.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@digital-topup/shared';
import {
  UpdatePilotConfigDto,
  RunPilotCycleDto,
  SignGoNoGoDto,
} from './dto/pilot.dto';

@ApiTags('Pilot & Launch Management (Phase 11)')
@Controller('pilot')
export class PilotController {
  constructor(private readonly pilotService: PilotService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get current Pilot configuration and limits' })
  async getPilotConfig() {
    return this.pilotService.getPilotConfig();
  }

  @Put('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update Pilot limits, active state, and whitelisted cohorts' })
  async updatePilotConfig(@Body() dto: UpdatePilotConfigDto, @Request() req: any) {
    const adminUserId = req.user?.id || 'admin';
    return this.pilotService.updatePilotConfig(dto, adminUserId);
  }

  @Post('run-cycle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.FINANCE_MANAGER, UserRole.FINANCE, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Execute AT-21 Full End-to-End Pilot Verification Cycle' })
  async runPilotCycle(@Body() dto: RunPilotCycleDto, @Request() req: any) {
    const adminUserId = req.user?.id || 'admin-pilot-runner';
    return this.pilotService.runPilotVerificationCycle(dto, adminUserId);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.FINANCE_MANAGER, UserRole.FINANCE, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get history of AT-21 Pilot verification cycles' })
  async getPilotHistory() {
    return this.pilotService.getPilotHistory();
  }

  @Get('go-no-go')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.FINANCE_MANAGER, UserRole.FINANCE, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assess Go/No-Go Decision Gate status against real requirements' })
  async assessGoNoGo() {
    return this.pilotService.assessGoNoGo();
  }

  @Post('go-no-go/sign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign and approve Go/No-Go Decision Gate' })
  async signGoNoGo(@Body() dto: SignGoNoGoDto, @Request() req: any) {
    const adminUserId = req.user?.id || 'admin';
    return this.pilotService.signGoNoGo(dto, adminUserId);
  }
}
