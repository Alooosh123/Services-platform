import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@digital-topup/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ImportPinsBatchDto } from './dto/import-pins.dto';
import { InventoryQueryDto } from './dto/pin-vault-query.dto';
import { PinVaultService } from './pin-vault.service';

@ApiTags('PIN Vault & Encrypted Gift Cards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/pin-vault')
export class PinVaultController {
  constructor(private readonly pinVaultService: PinVaultService) {}

  @Post('import')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Batch import and encrypt PIN codes/vouchers (AES-256-GCM)',
    description: 'Encrypts PIN codes before database insertion and enforces duplicate rejection.',
  })
  async importBatch(
    @CurrentUser('id') operatorUserId: string,
    @Body() dto: ImportPinsBatchDto,
  ) {
    return this.pinVaultService.importPinsBatch(dto, operatorUserId);
  }

  @Get('inventory')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ADMIN,
    UserRole.FULFILLMENT_OPERATOR,
    UserRole.AUDITOR,
  )
  @ApiOperation({
    summary: 'Get inventory summary and low-stock alerts',
    description: 'Aggregates available, reserved, and sold PINs per product and highlights low stock warnings.',
  })
  async getInventory(@Query() query: InventoryQueryDto) {
    return this.pinVaultService.getInventoryStatus(query);
  }

  @Get('products/:productId/count')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.ADMIN,
    UserRole.FULFILLMENT_OPERATOR,
  )
  @ApiOperation({
    summary: 'Get available PIN count for a specific product',
  })
  async getAvailableCount(@Param('productId') productId: string) {
    const available = await this.pinVaultService.getAvailableCount(productId);
    return { productId, availableCount: available };
  }
}
