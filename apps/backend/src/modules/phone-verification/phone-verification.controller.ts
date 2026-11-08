import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PhoneVerificationService } from './phone-verification.service';
import { SendPhoneOtpDto } from './dto/send-otp.dto';
import { VerifyPhoneOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RedisRateLimitGuard } from '../../security/redis-rate-limit.guard';
import { RateLimit } from '../../security/rate-limit.decorator';

@ApiTags('Phone Verification (Yemen E.164)')
@Controller('phone-verification')
export class PhoneVerificationController {
  constructor(private readonly phoneService: PhoneVerificationService) {}

  @Post('send-otp')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(3, 60_000, 'phone-otp-send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send verification OTP to Yemeni phone number via SMS' })
  @ApiResponse({ status: 200, description: 'OTP sent with TTL and carrier identification' })
  async sendOtp(@Body() dto: SendPhoneOtpDto, @Req() req: any) {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const userId = req.user?.id;
    return this.phoneService.sendOtp(dto, userId, ip);
  }

  @Post('verify-otp')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(5, 60_000, 'phone-otp-verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify 6-digit OTP code and confirm phone ownership' })
  @ApiResponse({ status: 200, description: 'Phone ownership confirmed' })
  async verifyOtp(@Body() dto: VerifyPhoneOtpDto, @Req() req: any) {
    const userId = req.user?.id;
    return this.phoneService.verifyOtp(dto, userId);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user phone verification status and disclaimers' })
  async getStatus(@CurrentUser('id') userId: string) {
    return this.phoneService.getStatus(userId);
  }
}
