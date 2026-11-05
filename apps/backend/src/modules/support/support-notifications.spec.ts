import { Test, TestingModule } from '@nestjs/testing';
import { SupportService } from './support.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../database/prisma.service';
import {
  UserRole,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  NotificationType,
  NotificationStatus,
  OrderStatus,
} from '@digital-topup/shared';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';

describe('Phase 08 — Mobile UX, In-App Notifications, Customer Support & Dispute Resolution', () => {
  let supportService: SupportService;
  let notificationsService: NotificationsService;

  const mockPrismaService = {
    supportTicket: {
      create: jest.fn().mockImplementation((args) => Promise.resolve(args.data)),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockImplementation((args) => Promise.resolve(args.data)),
    },
    ticketMessage: {
      create: jest.fn().mockImplementation((args) => Promise.resolve(args.data)),
      findMany: jest.fn().mockResolvedValue([]),
    },
    notification: {
      create: jest.fn().mockImplementation((args) => Promise.resolve(args.data)),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockImplementation((args) => Promise.resolve(args.data)),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    order: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 'ord-cust-a') {
          return Promise.resolve({
            id: 'ord-cust-a',
            userId: 'user-cust-a',
            orderNumber: 'ORD-TEST-A',
            status: OrderStatus.Processing,
            snapshotCurrency: 'YER',
            snapshotRetailPrice: 5000,
            snapshotCostPrice: 4500,
            snapshotBeneficiaryFields: {},
            product: null,
            statusHistory: [],
          });
        }
        if (where.id === 'ord-cust-b') {
          return Promise.resolve({
            id: 'ord-cust-b',
            userId: 'user-cust-b',
            orderNumber: 'ORD-TEST-B',
            status: OrderStatus.Completed,
            snapshotCurrency: 'USD',
            snapshotRetailPrice: 10,
            snapshotCostPrice: 8,
            snapshotBeneficiaryFields: {},
            product: null,
            statusHistory: [],
          });
        }
        return Promise.resolve(null);
      }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportService,
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    supportService = module.get<SupportService>(SupportService);
    notificationsService = module.get<NotificationsService>(NotificationsService);

    supportService.clearMemoryTickets();
    notificationsService.clearMemoryNotifications();
  });

  describe('AR-01: Support Ticket Creation & Weak Network Idempotency', () => {
    it('creates a support ticket linked to an order and sends confirmed notification', async () => {
      const ticket = await supportService.createTicket('user-cust-a', {
        subject: 'مشكلة في وصول شدات ببجي',
        description: 'رصيد الشحن لم يصل بعد مرور ساعة كاملة من الدفع',
        category: TicketCategory.ORDER_ISSUE,
        priority: TicketPriority.HIGH,
        orderId: 'ord-cust-a',
        idempotencyKey: 'IDEMP-TCK-001',
      });

      expect(ticket.id).toBeDefined();
      expect(ticket.ticketNumber).toContain('TCK-');
      expect(ticket.status).toBe(TicketStatus.OPEN);
      expect(ticket.messagesCount).toBe(1);
      expect(ticket.messages?.[0].message).toContain('رصيد الشحن لم يصل');

      // Verify notification was dispatched to customer
      const userNotifs = await notificationsService.getUserNotifications('user-cust-a');
      expect(userNotifs.unreadCount).toBeGreaterThanOrEqual(1);
      expect(userNotifs.notifications[0].title).toContain('تم إنشاء تذكرة الدعم');
    });

    it('enforces idempotency: duplicate network retries return the same ticket without duplication', async () => {
      const idempotencyKey = 'IDEMP-TCK-RETRY-99';

      const first = await supportService.createTicket('user-cust-a', {
        subject: 'استفسار عن طريقة الإيداع',
        description: 'هل يمكن الإيداع عبر الكريمي إكسبرس؟',
        category: TicketCategory.GENERAL_INQUIRY,
        idempotencyKey,
      });

      const second = await supportService.createTicket('user-cust-a', {
        subject: 'استفسار عن طريقة الإيداع',
        description: 'هل يمكن الإيداع عبر الكريمي إكسبرس؟',
        category: TicketCategory.GENERAL_INQUIRY,
        idempotencyKey,
      });

      expect(second.id).toBe(first.id);
      expect(second.ticketNumber).toBe(first.ticketNumber);
    });

    it('validates mandatory ticket subject and description', async () => {
      await expect(
        supportService.createTicket('user-cust-a', {
          subject: '',
          description: 'تفاصيل المشكلة',
          category: TicketCategory.ORDER_ISSUE,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        supportService.createTicket('user-cust-a', {
          subject: 'عنوان سليم',
          description: '   ',
          category: TicketCategory.ORDER_ISSUE,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Security & Privacy Gate: BOLA Protection & Internal Note Redaction', () => {
    it('prevents BOLA: customer cannot link an order belonging to another customer', async () => {
      await expect(
        supportService.createTicket('user-cust-a', {
          subject: 'محاولة ربط طلب عميل آخر',
          description: 'أريد معرفة تفاصيل هذا الطلب',
          category: TicketCategory.ORDER_ISSUE,
          orderId: 'ord-cust-b', // Belongs to user-cust-b!
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('prevents BOLA: customer cannot view a ticket belonging to another customer', async () => {
      const ticket = await supportService.createTicket('user-cust-a', {
        subject: 'تذكرة خاصة بالعميل أ',
        description: 'سري للعميل أ',
        category: TicketCategory.ACCOUNT_ISSUE,
      });

      // Customer B attempts to access Customer A's ticket
      await expect(
        supportService.getTicketById(ticket.id, 'user-cust-b', UserRole.CUSTOMER),
      ).rejects.toThrow(ForbiddenException);

      // Support agent CAN view it
      const agentView = await supportService.getTicketById(ticket.id, 'support-agent-1', UserRole.SUPPORT);
      expect(agentView.id).toBe(ticket.id);
    });

    it('strictly redacts internal notes from customer view (Staff-only privacy)', async () => {
      const ticket = await supportService.createTicket('user-cust-a', {
        subject: 'فحص فني',
        description: 'مشكلة فنية',
        category: TicketCategory.ORDER_ISSUE,
      });

      // 1. Support agent adds an internal confidential note
      await supportService.addMessage(
        ticket.id,
        'support-agent-1',
        UserRole.SUPPORT,
        {
          message: 'ملاحظة داخلية سرية: العميل يشتبه بوجود احتيال في حسابه المصرفي',
          isInternalNote: true,
        },
        'مشرف الدعم',
      );

      // 2. Support agent adds a public message to customer
      await supportService.addMessage(
        ticket.id,
        'support-agent-1',
        UserRole.SUPPORT,
        {
          message: 'أهلاً بك، تم استلام طلبك وجاري الفحص الفني.',
          isInternalNote: false,
        },
        'الدعم الفني',
      );

      // 3. Customer views ticket: internal note MUST be filtered out!
      const customerView = await supportService.getTicketById(ticket.id, 'user-cust-a', UserRole.CUSTOMER);
      const customerMsgs = customerView.messages || [];
      expect(customerMsgs.some((m) => m.message.includes('ملاحظة داخلية سرية'))).toBe(false);
      expect(customerMsgs.some((m) => m.message.includes('جاري الفحص الفني'))).toBe(true);

      // 4. Staff views ticket: internal note IS visible
      const staffView = await supportService.getTicketById(ticket.id, 'support-agent-1', UserRole.SUPPORT);
      const staffMsgs = staffView.messages || [];
      expect(staffMsgs.some((m) => m.message.includes('ملاحظة داخلية سرية'))).toBe(true);
    });

    it('prevents customer from creating internal notes', async () => {
      const ticket = await supportService.createTicket('user-cust-a', {
        subject: 'استفسار',
        description: 'رسالة عادية',
        category: TicketCategory.GENERAL_INQUIRY,
      });

      // Customer attempts to post with isInternalNote: true
      const msg = await supportService.addMessage(
        ticket.id,
        'user-cust-a',
        UserRole.CUSTOMER,
        {
          message: 'رسالة عميل تحاول التحايل',
          isInternalNote: true,
        },
      );

      // Must be forced to false
      expect(msg.isInternalNote).toBe(false);
    });
  });

  describe('AR-07: In-App Notifications Center & BOLA Isolation', () => {
    it('dispatches confirmed notifications and correctly updates unread counters', async () => {
      await notificationsService.emitNotification(
        'user-cust-a',
        NotificationType.ORDER_UPDATE,
        'تم اكتمال الطلب',
        'تم شحن طلبك بنجاح',
      );
      await notificationsService.emitNotification(
        'user-cust-a',
        NotificationType.DEPOSIT_CONFIRMED,
        'إيداع مؤكد',
        'تم إيداع 10,000 ريال',
      );

      const notifs = await notificationsService.getUserNotifications('user-cust-a');
      expect(notifs.unreadCount).toBe(2);
      expect(notifs.notifications.length).toBe(2);

      // Mark first as read
      await notificationsService.markAsRead('user-cust-a', notifs.notifications[0].id);
      const afterRead = await notificationsService.getUserNotifications('user-cust-a');
      expect(afterRead.unreadCount).toBe(1);

      // Mark all as read
      await notificationsService.markAllAsRead('user-cust-a');
      const allRead = await notificationsService.getUserNotifications('user-cust-a');
      expect(allRead.unreadCount).toBe(0);
    });

    it('enforces multi-tenant isolation: customer cannot view or read another user notification', async () => {
      const notif = await notificationsService.emitNotification(
        'user-cust-a',
        NotificationType.SECURITY_ALERT,
        'تنبيه أمان خاص',
        'محاولة تسجيل دخول جديدة',
      );

      // Customer B cannot read Customer A's notification
      await expect(
        notificationsService.markAsRead('user-cust-b', notif.id),
      ).rejects.toThrow(ForbiddenException);

      // Customer B querying notifications does NOT see Customer A's notification
      const custBNotifs = await notificationsService.getUserNotifications('user-cust-b');
      expect(custBNotifs.notifications.some((n) => n.id === notif.id)).toBe(false);
    });
  });

  describe('AR-15 & AR-01: Order Diagnostics & Dispute Refund Resolution', () => {
    it('diagnoses linked order status and provides support staff with action guidance', async () => {
      const ticket = await supportService.createTicket('user-cust-a', {
        subject: 'فشل شحن شدات',
        description: 'الطلب عالق',
        category: TicketCategory.ORDER_ISSUE,
        orderId: 'ord-cust-a',
      });

      const diag = await supportService.diagnoseOrder(ticket.id, 'support-agent-1');
      expect(diag.hasLinkedOrder).toBe(true);
      expect(diag.orderId).toBe('ord-cust-a');
      expect(diag.diagnosis).toBeDefined();
    });

    it('resolves dispute refund request with audit log, updates status, and notifies customer', async () => {
      const ticket = await supportService.createTicket('user-cust-a', {
        subject: 'طلب استرداد مالي',
        description: 'تم خصم المبلغ ولم يصل الرصيد',
        category: TicketCategory.REFUND_REQUEST,
      });

      const resolution = await supportService.resolveDisputeRefund(ticket.id, 'finance-mgr-1', {
        approved: true,
        refundAmount: 5500,
        reason: 'فشل تسليم المزود وتم تأكيد الخطأ من تقرير بوابة الشحن',
      });

      expect(resolution.success).toBe(true);
      expect(resolution.ticket.status).toBe(TicketStatus.RESOLVED);

      // Verify customer was notified of approved refund
      const notifs = await notificationsService.getUserNotifications('user-cust-a');
      expect(notifs.notifications.some((n) => n.title.includes('الموافقة على طلب الاسترداد'))).toBe(true);
    });
  });
});
