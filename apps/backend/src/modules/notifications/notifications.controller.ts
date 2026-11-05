import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('In-App Notifications (Phase 08 - AR-07)')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user notifications with unread counter (BOLA isolated)' })
  async getMyNotifications(
    @Request() req: any,
    @Query('limit') limit?: number,
  ) {
    const userId = req.user?.id || req.user?.userId;
    return this.notificationsService.getUserNotifications(userId, limit ? Number(limit) : 30);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Request() req: any, @Param('id') id: string) {
    const userId = req.user?.id || req.user?.userId;
    return this.notificationsService.markAsRead(userId, id);
  }

  @Post('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  async markAllAsRead(@Request() req: any) {
    const userId = req.user?.id || req.user?.userId;
    return this.notificationsService.markAllAsRead(userId);
  }
}
