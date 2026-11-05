import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  UserRole,
  CreateServiceRequestDto,
  UpdateServiceRequestStatusDto,
  ServiceRequestStatus,
} from '@digital-topup/shared';

@ApiTags('Catalog & Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('catalog')
  @ApiOperation({ summary: 'Public store catalog listing all services and products' })
  async getCatalog() {
    return this.productsService.getCatalog();
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all active categories' })
  async getCategories() {
    return this.productsService.getAllCategories();
  }

  @Get('service/:slug')
  @ApiOperation({ summary: 'Get single service details with dynamic player form fields and products' })
  async getServiceBySlug(@Param('slug') slug: string) {
    return this.productsService.getServiceBySlug(slug);
  }

  @Get('game/:slug')
  @ApiOperation({ summary: 'Backward-compatible route for service lookup by slug' })
  async getGameBySlug(@Param('slug') slug: string) {
    return this.productsService.getServiceBySlug(slug);
  }

  // ====================================================
  // CUSTOMER SERVICE REQUESTS (P06)
  // ====================================================

  @Post('service-requests')
  @ApiOperation({ summary: 'Customer: Submit request to add a new game/app or package' })
  async submitServiceRequest(@Request() req: any, @Body() dto: CreateServiceRequestDto) {
    const userId = req.user?.id || null;
    return this.productsService.createServiceRequest(userId, dto);
  }

  @Get('my-service-requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Customer: View status of my submitted service requests' })
  async getMyServiceRequests(@Request() req: any) {
    return this.productsService.getMyServiceRequests(req.user.id);
  }

  @Get('admin/service-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.SUPPORT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: List customer service requests' })
  async getAdminServiceRequests(@Query('status') status?: ServiceRequestStatus) {
    return this.productsService.getAdminServiceRequests(status);
  }

  @Patch('admin/service-requests/:id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Review and approve/reject customer service request' })
  async reviewServiceRequest(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateServiceRequestStatusDto,
  ) {
    const adminUserId = req.user?.id || 'admin-user';
    return this.productsService.reviewServiceRequest(adminUserId, id, dto);
  }

  // ====================================================
  // ADMIN DYNAMIC CATALOG MANAGEMENT (P06)
  // ====================================================

  @Post('admin/categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create a new category' })
  async createCategory(@Body() dto: { slug: string; name: string; nameAr: string; icon?: string; displayOrder?: number }) {
    return this.productsService.createCategory(dto);
  }

  @Patch('admin/categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update category' })
  async updateCategory(@Param('id') id: string, @Body() dto: any) {
    return this.productsService.updateCategory(id, dto);
  }

  @Delete('admin/categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Soft delete category' })
  async deleteCategory(@Param('id') id: string) {
    return this.productsService.deleteCategory(id);
  }

  @Post('admin/service')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create a new service with dynamic form fields' })
  async createService(@Body() dto: any) {
    return this.productsService.createService(dto);
  }

  @Patch('admin/services/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update service details' })
  async updateService(@Param('id') id: string, @Body() dto: any) {
    return this.productsService.updateService(id, dto);
  }

  @Delete('admin/services/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Soft delete service' })
  async deleteService(@Param('id') id: string) {
    return this.productsService.deleteService(id);
  }

  @Post('admin/services/:serviceId/fields')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Add a dynamic player input field to service' })
  async createServiceField(@Param('serviceId') serviceId: string, @Body() dto: any) {
    return this.productsService.createServiceField(serviceId, dto);
  }

  @Delete('admin/fields/:fieldId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Delete a dynamic field from service' })
  async deleteServiceField(@Param('fieldId') fieldId: string) {
    return this.productsService.deleteServiceField(fieldId);
  }

  @Post('admin/services/:serviceId/products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create a package/product with provider gating check' })
  async createProduct(@Param('serviceId') serviceId: string, @Body() dto: any) {
    return this.productsService.createProduct(serviceId, dto);
  }

  @Patch('admin/products/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update package/product details' })
  async updateProduct(@Param('productId') productId: string, @Body() dto: any) {
    return this.productsService.updateProduct(productId, dto);
  }

  @Post('admin/products/:productId/kill-switch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Emergency Kill Switch - instantly stop product with audit reason' })
  async killSwitchProduct(
    @Request() req: any,
    @Param('productId') productId: string,
    @Body('reason') reason: string,
  ) {
    const adminUserId = req.user?.id || 'admin-user';
    return this.productsService.toggleProductKillSwitch(adminUserId, productId, reason);
  }
}
