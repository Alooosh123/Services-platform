import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  NotificationType,
  NotificationChannel,
} from '@digital-topup/shared';
import { NotificationsService } from './notifications.service';

describe('NotificationsService production persistence', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  let prisma: any;
  let service: NotificationsService;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    prisma = {
      notification: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    service = new NotificationsService(prisma);
  });

  afterEach(() => {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    jest.clearAllMocks();
  });

  it('returns the empty database result without inventing seeded production notifications', async () => {
    await expect(service.getUserNotifications('user-cust-001')).resolves.toEqual({
      notifications: [],
      unreadCount: 0,
    });
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-cust-001' },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  });

  it('does not claim a notification was emitted when durable persistence fails', async () => {
    prisma.notification.create.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.emitNotification(
        'customer-1',
        NotificationType.ORDER_UPDATE,
        'Order updated',
        'Your order status changed.',
        undefined,
        NotificationChannel.IN_APP,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('fails closed when production notification reads are unavailable', async () => {
    prisma.notification.findMany.mockRejectedValue(new Error('database unavailable'));

    await expect(service.getUserNotifications('customer-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('fails closed when production read-state updates are unavailable', async () => {
    prisma.notification.findUnique.mockRejectedValue(new Error('database unavailable'));

    await expect(service.markAsRead('customer-1', 'notification-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('fails closed when production bulk read-state updates are unavailable', async () => {
    prisma.notification.updateMany.mockRejectedValue(new Error('database unavailable'));

    await expect(service.markAllAsRead('customer-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('prevents a customer from marking another customer notification as read', async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: 'notification-1',
      userId: 'another-customer',
    });

    await expect(service.markAsRead('customer-1', 'notification-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });
});
