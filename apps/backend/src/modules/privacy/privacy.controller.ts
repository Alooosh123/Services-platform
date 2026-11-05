import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrivacyService } from './privacy.service';
import { AccountDeletionRequestDto } from './dto/privacy.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@digital-topup/shared';

@ApiTags('Privacy & Compliance')
@Controller('privacy')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  @Post('export-data')
  @ApiOperation({
    summary: 'AR-08: Export complete personal data archive in JSON format (Right to Data Portability)',
  })
  async exportData(@CurrentUser('id') userId: string) {
    return this.privacyService.exportUserData(userId);
  }

  @Post('request-deletion')
  @ApiOperation({
    summary: 'AR-08: Request account erasure / anonymization (Right to be Forgotten) preserving ledger records',
  })
  async requestDeletion(
    @CurrentUser('id') userId: string,
    @Body() dto: AccountDeletionRequestDto,
  ) {
    return this.privacyService.requestAccountDeletion(userId, dto);
  }

  @Post('admin/purge-expired-tokens')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.FINANCE_MANAGER)
  @ApiOperation({
    summary: 'Data Retention: Purge expired sessions and verification tokens from the database',
  })
  async purgeExpiredTokens() {
    return this.privacyService.purgeExpiredTokens();
  }
}
