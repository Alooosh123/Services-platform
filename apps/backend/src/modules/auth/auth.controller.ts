import { Controller, Post, Body, Get, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { EnableMfaDto } from './dto/enable-mfa.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SetTransactionPinDto } from './dto/set-transaction-pin.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserRole } from '@digital-topup/shared';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new customer account' })
  @ApiResponse({ status: 201, description: 'Customer account created successfully' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login using email or phone and password' })
  @ApiResponse({ status: 200, description: 'Login successful, returns JWT tokens' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a valid refresh token and issue a new access/refresh token pair' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshSession(dto);
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin/Staff login with MFA requirement' })
  @ApiResponse({ status: 200, description: 'Credentials verified, requires MFA code' })
  async adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto);
  }

  @Post('admin/verify-mfa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify admin MFA code (TOTP) and issue session tokens' })
  @ApiResponse({ status: 200, description: 'MFA verified, returns admin access tokens' })
  async verifyAdminMfa(@Body() dto: VerifyMfaDto) {
    return this.authService.verifyAdminMfa(dto);
  }

  @Get('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a new TOTP secret and setup URI for authenticator app' })
  async setupMfa(@CurrentUser('id') userId: string) {
    return this.authService.setupMfa(userId);
  }

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify initial code and enable TOTP MFA for account' })
  async enableMfa(@CurrentUser('id') userId: string, @Body() dto: EnableMfaDto) {
    return this.authService.enableMfa(userId, dto);
  }

  @Post('transaction-pin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set or replace the financial transaction PIN after password confirmation' })
  async setTransactionPin(
    @CurrentUser('id') userId: string,
    @Body() dto: SetTransactionPinDto,
  ) {
    return this.authService.setTransactionPin(userId, dto);
  }

  @Post('admin/create-staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Super Admin: Create a new administrative staff member' })
  @ApiResponse({ status: 201, description: 'Staff member created successfully' })
  async createStaff(@CurrentUser('id') callerId: string, @Body() dto: CreateStaffDto) {
    return this.authService.createStaff(callerId, dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke active session tokens' })
  async logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }

  @Post('revoke-all-sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Emergency/Security: Revoke all active sessions and refresh tokens for account' })
  async revokeAllSessions(@CurrentUser('id') userId: string) {
    return this.authService.revokeAllSessions(userId);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve current authenticated user profile & wallet' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }
}
