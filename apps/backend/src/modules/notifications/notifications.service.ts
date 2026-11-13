import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getCurrentTenantId } from '../../tenant/tenant-context.store';
import {
  NotificationType,
  NotificationChannel,
  NotificationStatus,
  NotificationDto,
} from '@digital-topup/shared';

export interface InMemoryNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  status: NotificationStatus;
  channel: NotificationChannel;
  createdAt: Date;
  readAt?: Date | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private memoryNotifications: Map<string, InMemoryNotification> = new Map();

  constructor(private prisma: PrismaService) {
    if (!this.requiresDurableStorage()) {
      this.seedDefaultNotifications();
    }
  }

  private requiresDurableStorage(): boolean {
    return process.env.NODE_ENV === 'production' || Boolean(getCurrentTenantId());
  }

  private seedDefaultNotifications() {
    const n1: InMemoryNotification = {
      id: 'notif-demo-1',
      userId: 'user-cust-001',
      type: NotificationType.ORDER_UPDATE,
      title: 'تم اكتمال شحن طلبك بنجاح',
      message: 'تم شحن 60 شدة ببجي موبايل إلى الحساب 512345678 بنجاح.',
      data: { orderId: 'ord-comp-001', orderNumber: 'ORD-20261011-001' },
      status: NotificationStatus.UNREAD,
      channel: NotificationChannel.IN_APP,
      createdAt: new Date(Date.now() - 3600000),
      readAt: null,
    };
    const n2: InMemoryNotification = {
      id: 'notif-demo-2',
      userId: 'user-cust-001',
      type: NotificationType.DEPOSIT_CONFIRMED,
      title: 'إيداع معتمد في محفظتك',
      message: 'تم تأكيد إيداع 50,000 ريال يمني عبر محفظة جيب وإضافتها إلى رصيدك.',
      data: { depositId: 'dep-001', amount: 50000, currency: 'YER' },
      status: NotificationStatus.READ,
      channel: NotificationChannel.IN_APP,
      createdAt: new Date(Date.now() - 7200000),
      readAt: new Date(Date.now() - 7000000),
    };
    this.memoryNotifications.set(n1.id, n1);
    this.memoryNotifications.set(n2.id, n2);
  }

  clearMemoryNotifications() {
    this.memoryNotifications.clear();
  }

  /**
   * Emit notification ONLY after confirmed backend state (AR-07)
   */
  async emitNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>,
    channel: NotificationChannel = NotificationChannel.IN_APP,
  ): Promise<InMemoryNotification> {
    const id = `notif-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const record: InMemoryNotification = {
      id,
      userId,
      type,
      title,
      message,
      data,
      status: NotificationStatus.UNREAD,
      channel,
      createdAt: new Date(),
      readAt: null,
    };

    try {
      await this.prisma.notification.create({
        data: {
          id,
          userId,
          type,
          title,
          message,
          data: data ? (data as any) : undefined,
          status: NotificationStatus.UNREAD,
          channel,
        },
      });
    } catch (error: any) {
      if (this.requiresDurableStorage()) {
        this.logger.error(`Failed to persist notification ${id}: ${error?.message || error}`);
        throw new ServiceUnavailableException(
          'تعذر حفظ الإشعار في قاعدة البيانات؛ لم يتم تأكيد إرساله. حاول مرة أخرى بعد استعادة الاتصال.',
        );
      }
      this.logger.debug(`Prisma unavailable, saving notification ${id} in local development memory.`);
      this.memoryNotifications.set(id, record);
    }

    this.logger.log(`[Notification Emitted] To user ${userId}: "${title}" [${type}]`);
    return record;
  }

  /**
   * Get user notifications with unread counter (BOLA Enforced - customer can ONLY see their own)
   */
  async getUserNotifications(
    userId: string,
    limit: number = 30,
  ): Promise<{ notifications: NotificationDto[]; unreadCount: number }> {
    try {
      const dbList = await this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      const unreadCount = dbList.filter((n) => n.status === NotificationStatus.UNREAD).length;
      const mapped = dbList.map((n) => ({
        id: n.id,
        userId: n.userId,
        type: n.type as NotificationType,
        title: n.title,
        message: n.message,
        data: n.data as any,
        status: n.status as NotificationStatus,
        channel: n.channel as NotificationChannel,
        createdAt: n.createdAt.toISOString(),
        readAt: n.readAt ? n.readAt.toISOString() : undefined,
      }));

      // An empty database result is authoritative; do not resurrect stale demo
      // notifications from process memory in production.
      if (this.requiresDurableStorage() || dbList.length > 0) {
        return { notifications: mapped, unreadCount };
      }
    } catch (error: any) {
      if (this.requiresDurableStorage()) {
        this.logger.error(`Failed to read notifications for user ${userId}: ${error?.message || error}`);
        throw new ServiceUnavailableException('تعذر تحميل الإشعارات من قاعدة البيانات.');
      }
    }

    const list = Array.from(this.memoryNotifications.values())
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    const unreadCount = list.filter((n) => n.status === NotificationStatus.UNREAD).length;
    const mapped = list.map((n) => ({
      id: n.id,
      userId: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      data: n.data,
      status: n.status,
      channel: n.channel,
      createdAt: n.createdAt.toISOString(),
      readAt: n.readAt ? n.readAt.toISOString() : undefined,
    }));

    return { notifications: mapped, unreadCount };
  }

  /**
   * Mark single notification as read (BOLA Protection)
   */
  async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    try {
      const notif = await this.prisma.notification.findUnique({
        where: { id: notificationId },
      });
      if (!notif) {
        if (this.requiresDurableStorage()) {
          throw new NotFoundException('الإشعار غير موجود');
        }
      } else {
        if (notif.userId !== userId) {
          throw new ForbiddenException('غير مصرح لك بتعديل إشعار مستخدم آخر (BOLA Protection)');
        }
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: { status: NotificationStatus.READ, readAt: new Date() },
        });
        return true;
      }
    } catch (error: any) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
      if (this.requiresDurableStorage()) {
        this.logger.error(`Failed to mark notification ${notificationId} as read: ${error?.message || error}`);
        throw new ServiceUnavailableException('تعذر تحديث حالة الإشعار في قاعدة البيانات.');
      }
    }

    const mem = this.memoryNotifications.get(notificationId);
    if (!mem) {
      throw new NotFoundException('الإشعار غير موجود');
    }
    if (mem.userId !== userId) {
      throw new ForbiddenException('غير مصرح لك بتعديل إشعار مستخدم آخر (BOLA Protection)');
    }
    mem.status = NotificationStatus.READ;
    mem.readAt = new Date();
    return true;
  }

  /**
   * Mark all notifications for a user as read
   */
  async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
    let count = 0;
    try {
      const result = await this.prisma.notification.updateMany({
        where: { userId, status: NotificationStatus.UNREAD },
        data: { status: NotificationStatus.READ, readAt: new Date() },
      });
      count = result.count;
    } catch (error: any) {
      if (this.requiresDurableStorage()) {
        this.logger.error(`Failed to mark all notifications as read for user ${userId}: ${error?.message || error}`);
        throw new ServiceUnavailableException('تعذر تحديث الإشعارات في قاعدة البيانات.');
      }
    }

    if (this.requiresDurableStorage()) {
      return { updatedCount: count };
    }

    for (const mem of this.memoryNotifications.values()) {
      if (mem.userId === userId && mem.status === NotificationStatus.UNREAD) {
        mem.status = NotificationStatus.READ;
        mem.readAt = new Date();
        count++;
      }
    }

    return { updatedCount: count };
  }
}
