import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  UserRole,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  NotificationType,
  OrderStatus,
  CreateSupportTicketDto,
  AddTicketMessageDto,
  UpdateTicketStatusDto,
  ResolveDisputeRefundDto,
  SupportTicketDto,
  TicketMessageDto,
} from '@digital-topup/shared';

export interface InMemoryTicketMessage {
  id: string;
  ticketId: string;
  senderUserId: string;
  senderRole: UserRole;
  senderName?: string;
  message: string;
  attachments?: string[];
  isInternalNote: boolean;
  createdAt: Date;
}

export interface InMemorySupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  customerName?: string;
  customerPhone?: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  description: string;
  orderId?: string | null;
  depositId?: string | null;
  assignedToUserId?: string | null;
  assignedAgentName?: string | null;
  idempotencyKey?: string | null;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  messages: InMemoryTicketMessage[];
}

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);
  private memoryTickets: Map<string, InMemorySupportTicket> = new Map();
  private memoryIdempotency: Map<string, string> = new Map(); // idempotencyKey -> ticketId

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {
    if (process.env.NODE_ENV === 'test') this.seedDefaultTickets();
  }

  private seedDefaultTickets() {
    const t1: InMemorySupportTicket = {
      id: 'tck-test-001',
      ticketNumber: 'TCK-20261011-001',
      userId: 'user-cust-001',
      customerName: 'محمد أحمد الراعي',
      customerPhone: '+967770123456',
      category: TicketCategory.ORDER_ISSUE,
      priority: TicketPriority.HIGH,
      status: TicketStatus.OPEN,
      subject: 'تأخر شحن شدات ببجي موبايل',
      description: 'قمت بطلب 325 شدة برقم طلب ORD-20261011-002 ولم يصل الرصيد إلى حساب اللعبة حتى الآن.',
      orderId: 'ord-test-proc-2',
      depositId: null,
      assignedToUserId: 'support-agent-01',
      assignedAgentName: 'فريق الدعم الفني 1',
      idempotencyKey: 'IDEMP-TCK-SEED-01',
      resolvedAt: null,
      closedAt: null,
      createdAt: new Date(Date.now() - 3600000),
      updatedAt: new Date(Date.now() - 1800000),
      messages: [
        {
          id: 'msg-001',
          ticketId: 'tck-test-001',
          senderUserId: 'user-cust-001',
          senderRole: UserRole.CUSTOMER,
          senderName: 'محمد أحمد الراعي',
          message: 'قمت بطلب 325 شدة برقم طلب ORD-20261011-002 ولم يصل الرصيد إلى حساب اللعبة حتى الآن.',
          isInternalNote: false,
          createdAt: new Date(Date.now() - 3600000),
        },
        {
          id: 'msg-002',
          ticketId: 'tck-test-001',
          senderUserId: 'support-agent-01',
          senderRole: UserRole.SUPPORT,
          senderName: 'فريق الدعم الفني',
          message: 'فحص داخلي: استجابة المزود معلقة بسبب ضغط سيرفرات اللعبة (Gateway Timeout)',
          isInternalNote: true, // Internal Note: must be HIDDEN from customer!
          createdAt: new Date(Date.now() - 2400000),
        },
        {
          id: 'msg-003',
          ticketId: 'tck-test-001',
          senderUserId: 'support-agent-01',
          senderRole: UserRole.SUPPORT,
          senderName: 'فريق الدعم الفني',
          message: 'أهلاً بك محمد، جاري التحقق من حالة المعاملة لدى مزود الخدمة، وسنوافيك بالرد فوراً.',
          isInternalNote: false,
          createdAt: new Date(Date.now() - 1800000),
        },
      ],
    };
    this.memoryTickets.set(t1.id, t1);
  }

  clearMemoryTickets() {
    if (process.env.NODE_ENV !== 'test') {
      throw new ServiceUnavailableException('In-memory support records are available only in tests.');
    }
    this.memoryTickets.clear();
    this.memoryIdempotency.clear();
  }

  private allowMemoryFallback(): boolean {
    return process.env.NODE_ENV === 'test';
  }

  /**
   * 1. Create a Support Ticket (AR-01)
   * Supports order/deposit linking, customer verification, and weak network idempotency
   */
  async createTicket(userId: string, dto: CreateSupportTicketDto): Promise<SupportTicketDto> {
    if (!dto.subject || dto.subject.trim().length === 0) {
      throw new BadRequestException('عنوان التذكرة مطلوب');
    }
    if (!dto.description || dto.description.trim().length === 0) {
      throw new BadRequestException('تفاصيل الشكوى أو المشكلة مطلوبة');
    }

    // A. Idempotency verification (Weak Network Protection)
    if (dto.idempotencyKey) {
      if (this.allowMemoryFallback()) {
        const existingId = this.memoryIdempotency.get(dto.idempotencyKey);
        if (existingId) return this.getTicketById(existingId, userId, UserRole.CUSTOMER);
      } else {
        try {
          const existing = await this.prisma.supportTicket.findUnique({
            where: { idempotencyKey: dto.idempotencyKey },
          });
          if (existing) {
            if (existing.userId !== userId) {
              throw new ForbiddenException('مفتاح التذكرة مستخدم من حساب آخر.');
            }
            return this.getTicketById(existing.id, userId, UserRole.CUSTOMER);
          }
        } catch (err: any) {
          if (err instanceof ForbiddenException) throw err;
          this.logger.error(`Support ticket idempotency lookup failed: ${err?.message}`);
          throw new ServiceUnavailableException('Support ticket idempotency could not be verified.');
        }
      }
    }

    // B. Verify linked order ownership if orderId provided
    if (dto.orderId) {
      try {
        const ord = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
        if (ord && ord.userId !== userId) {
          throw new ForbiddenException('لا يمكنك ربط تذكرة بطلب لا يخصك (BOLA Protection)');
        }
      } catch (err: any) {
        if (err instanceof ForbiddenException) throw err;
        if (!this.allowMemoryFallback()) {
          this.logger.error(`Support ticket linked-order verification failed: ${err?.message}`);
          throw new ServiceUnavailableException('The linked order ownership could not be verified.');
        }
      }
    }

    const ticketId = `tck-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const ticketNumber = `TCK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
      1000 + Math.random() * 9000,
    )}`;

    const initialMsg: InMemoryTicketMessage = {
      id: `msg-${Date.now()}-1`,
      ticketId,
      senderUserId: userId,
      senderRole: UserRole.CUSTOMER,
      senderName: 'العميل',
      message: dto.description,
      isInternalNote: false,
      createdAt: new Date(),
    };

    const ticketRecord: InMemorySupportTicket = {
      id: ticketId,
      ticketNumber,
      userId,
      category: dto.category || TicketCategory.GENERAL_INQUIRY,
      priority: dto.priority || TicketPriority.MEDIUM,
      status: TicketStatus.OPEN,
      subject: dto.subject,
      description: dto.description,
      orderId: dto.orderId || null,
      depositId: dto.depositId || null,
      assignedToUserId: null,
      assignedAgentName: null,
      idempotencyKey: dto.idempotencyKey || null,
      resolvedAt: null,
      closedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [initialMsg],
    };

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.supportTicket.create({
          data: {
            id: ticketId,
            ticketNumber,
            userId,
            category: ticketRecord.category,
            priority: ticketRecord.priority,
            status: ticketRecord.status,
            subject: ticketRecord.subject,
            description: ticketRecord.description,
            orderId: ticketRecord.orderId,
            depositId: ticketRecord.depositId,
            idempotencyKey: ticketRecord.idempotencyKey,
          },
        });
        await tx.ticketMessage.create({
          data: {
            id: initialMsg.id,
            ticketId,
            senderUserId: userId,
            senderRole: 'CUSTOMER',
            message: initialMsg.message,
            isInternalNote: false,
          },
        });
      });
    } catch (err: any) {
      if (!this.allowMemoryFallback()) {
        this.logger.error(`Support ticket persistence failed: ${err?.message}`);
        throw new ServiceUnavailableException('The support ticket could not be saved.');
      }
      this.logger.warn(`Test-only in-memory support ticket fallback: ${err?.message}`);
    }

    if (this.allowMemoryFallback()) {
      this.memoryTickets.set(ticketId, ticketRecord);
      if (dto.idempotencyKey) this.memoryIdempotency.set(dto.idempotencyKey, ticketId);
    }

    // Emit in-app notification to customer
    await this.notificationsService.emitNotification(
      userId,
      NotificationType.SUPPORT_REPLY,
      'تم إنشاء تذكرة الدعم بنجاح',
      `تم استلام تذكرتك رقم ${ticketNumber} بعنوان "${dto.subject}". سيتواصل معك فريق الدعم قريباً.`,
      { ticketId, ticketNumber },
    );

    return this.mapToDto(ticketRecord, UserRole.CUSTOMER);
  }

  /**
   * 2. List tickets (BOLA Protection: Customers only see their own)
   */
  async listTickets(
    userId: string,
    userRole: UserRole,
    statusFilter?: TicketStatus,
    categoryFilter?: TicketCategory,
  ): Promise<SupportTicketDto[]> {
    const isStaff = userRole !== UserRole.CUSTOMER;

    try {
      const where: any = {};
      if (!isStaff) {
        where.userId = userId;
      }
      if (statusFilter) where.status = statusFilter;
      if (categoryFilter) where.category = categoryFilter;

      const dbTickets = await this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { messages: true },
      });

      if (Array.isArray(dbTickets)) {
        return dbTickets.map((t) => {
          const mappedMessages = (t.messages || [])
            .filter((m) => isStaff || !m.isInternalNote) // Redact internal notes for customers!
            .map((m) => ({
              id: m.id,
              ticketId: m.ticketId,
              senderUserId: m.senderUserId,
              senderRole: m.senderRole as UserRole,
              message: m.message,
              attachments: m.attachments ? JSON.parse(m.attachments) : [],
              isInternalNote: m.isInternalNote,
              createdAt: m.createdAt.toISOString(),
            }));

          return {
            id: t.id,
            ticketNumber: t.ticketNumber,
            userId: t.userId,
            category: t.category as TicketCategory,
            priority: t.priority as TicketPriority,
            status: t.status as TicketStatus,
            subject: t.subject,
            description: t.description,
            orderId: t.orderId || undefined,
            depositId: t.depositId || undefined,
            assignedToUserId: t.assignedToUserId || undefined,
            messagesCount: mappedMessages.length,
            messages: mappedMessages,
            resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : undefined,
            closedAt: t.closedAt ? t.closedAt.toISOString() : undefined,
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.updatedAt.toISOString(),
          };
        });
      }
    } catch (err: any) {
      if (!this.allowMemoryFallback()) {
        this.logger.error(`Support ticket list failed: ${err?.message}`);
        throw new ServiceUnavailableException('Support tickets are temporarily unavailable.');
      }
    }

    if (!this.allowMemoryFallback()) return [];
    const all = Array.from(this.memoryTickets.values());
    const filtered = all.filter((t) => {
      if (!isStaff && t.userId !== userId) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (categoryFilter && t.category !== categoryFilter) return false;
      return true;
    });

    return filtered
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((t) => this.mapToDto(t, userRole));
  }

  /**
   * 3. Get single ticket by ID (BOLA Enforced + Internal Note Redaction)
   */
  async getTicketById(ticketId: string, userId: string, userRole: UserRole): Promise<SupportTicketDto> {
    const isStaff = userRole !== UserRole.CUSTOMER;

    try {
      const dbTicket = await this.prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });

      if (dbTicket) {
        if (!isStaff && dbTicket.userId !== userId) {
          throw new ForbiddenException('غير مصرح لك باستعراض تذكرة مستخدم آخر (BOLA Protection)');
        }

        const messages = (dbTicket.messages || [])
          .filter((m) => isStaff || !m.isInternalNote) // Redact internal notes
          .map((m) => ({
            id: m.id,
            ticketId: m.ticketId,
            senderUserId: m.senderUserId,
            senderRole: m.senderRole as UserRole,
            message: m.message,
            attachments: m.attachments ? JSON.parse(m.attachments) : [],
            isInternalNote: m.isInternalNote,
            createdAt: m.createdAt.toISOString(),
          }));

        return {
          id: dbTicket.id,
          ticketNumber: dbTicket.ticketNumber,
          userId: dbTicket.userId,
          category: dbTicket.category as TicketCategory,
          priority: dbTicket.priority as TicketPriority,
          status: dbTicket.status as TicketStatus,
          subject: dbTicket.subject,
          description: dbTicket.description,
          orderId: dbTicket.orderId || undefined,
          depositId: dbTicket.depositId || undefined,
          assignedToUserId: dbTicket.assignedToUserId || undefined,
          messagesCount: messages.length,
          messages,
          resolvedAt: dbTicket.resolvedAt ? dbTicket.resolvedAt.toISOString() : undefined,
          closedAt: dbTicket.closedAt ? dbTicket.closedAt.toISOString() : undefined,
          createdAt: dbTicket.createdAt.toISOString(),
          updatedAt: dbTicket.updatedAt.toISOString(),
        };
      }
    } catch (err: any) {
      if (err instanceof ForbiddenException) throw err;
      if (!this.allowMemoryFallback()) {
        this.logger.error(`Support ticket lookup failed: ${err?.message}`);
        throw new ServiceUnavailableException('Support ticket is temporarily unavailable.');
      }
    }

    if (!this.allowMemoryFallback()) {
      throw new NotFoundException(`تذكرة الدعم غير موجودة (${ticketId})`);
    }
    const mem = this.memoryTickets.get(ticketId);
    if (!mem) {
      throw new NotFoundException(`تذكرة الدعم غير موجودة (${ticketId})`);
    }

    if (!isStaff && mem.userId !== userId) {
      throw new ForbiddenException('غير مصرح لك باستعراض تذكرة مستخدم آخر (BOLA Protection)');
    }

    return this.mapToDto(mem, userRole);
  }

  /**
   * 4. Add message to ticket (Customer or Staff)
   */
  async addMessage(
    ticketId: string,
    userId: string,
    userRole: UserRole,
    dto: AddTicketMessageDto,
    senderName?: string,
  ): Promise<TicketMessageDto> {
    if (!dto.message || dto.message.trim().length === 0) {
      throw new BadRequestException('نص الرسالة مطلوب');
    }

    const isStaff = userRole !== UserRole.CUSTOMER;
    const ticket = await this.getTicketById(ticketId, userId, userRole);

    const isInternalNote = isStaff ? Boolean(dto.isInternalNote) : false; // Customers CANNOT create internal notes!

    const msgId = `msg-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const msgRecord: InMemoryTicketMessage = {
      id: msgId,
      ticketId,
      senderUserId: userId,
      senderRole: userRole,
      senderName: senderName || (isStaff ? 'الدعم الفني' : 'العميل'),
      message: dto.message,
      attachments: dto.attachments,
      isInternalNote,
      createdAt: new Date(),
    };

    // Update ticket status depending on who replied
    let newStatus = ticket.status;
    if (!isStaff) {
      // Customer replied -> switch back to IN_PROGRESS
      if (ticket.status === TicketStatus.WAITING_FOR_CUSTOMER || ticket.status === TicketStatus.RESOLVED) {
        newStatus = TicketStatus.IN_PROGRESS;
      }
    } else if (!isInternalNote) {
      // Agent public reply -> switch to WAITING_FOR_CUSTOMER
      newStatus = TicketStatus.WAITING_FOR_CUSTOMER;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.ticketMessage.create({
          data: {
            id: msgId,
            ticketId,
            senderUserId: userId,
            senderRole: userRole,
            message: dto.message,
            attachments: dto.attachments ? JSON.stringify(dto.attachments) : undefined,
            isInternalNote,
          },
        });
        await tx.supportTicket.update({
          where: { id: ticketId },
          data: { status: newStatus, updatedAt: new Date() },
        });
      });
    } catch (err: any) {
      if (!this.allowMemoryFallback()) {
        this.logger.error(`Support message persistence failed: ${err?.message}`);
        throw new ServiceUnavailableException('The support reply could not be saved.');
      }
    }


    const mem = this.memoryTickets.get(ticketId);
    if (mem) {
      mem.messages.push(msgRecord);
      mem.status = newStatus;
      mem.updatedAt = new Date();
    }

    // If agent sent a public message, notify the customer
    if (isStaff && !isInternalNote) {
      await this.notificationsService.emitNotification(
        ticket.userId,
        NotificationType.SUPPORT_REPLY,
        `رد جديد على التذكرة #${ticket.ticketNumber}`,
        `قام موظف الدعم بالرد على تذكرتك: "${dto.message.slice(0, 80)}..."`,
        { ticketId, ticketNumber: ticket.ticketNumber },
      );
    }

    return {
      id: msgRecord.id,
      ticketId: msgRecord.ticketId,
      senderUserId: msgRecord.senderUserId,
      senderRole: msgRecord.senderRole,
      senderName: msgRecord.senderName,
      message: msgRecord.message,
      attachments: msgRecord.attachments,
      isInternalNote: msgRecord.isInternalNote,
      createdAt: msgRecord.createdAt.toISOString(),
    };
  }

  /**
   * 5. Update ticket status (Support Agent / Admin)
   */
  async updateStatus(
    ticketId: string,
    staffUserId: string,
    dto: UpdateTicketStatusDto,
  ): Promise<SupportTicketDto> {
    const current = await this.getTicketById(ticketId, staffUserId, UserRole.SUPPORT);
    const now = new Date();
    const resolvedAt = dto.status === TicketStatus.RESOLVED ? now : current.resolvedAt ? new Date(current.resolvedAt) : null;
    const closedAt = dto.status === TicketStatus.CLOSED ? now : current.closedAt ? new Date(current.closedAt) : null;
    const note = dto.resolutionNotes?.trim();

    if (this.allowMemoryFallback()) {
      const mem = this.memoryTickets.get(ticketId);
      if (!mem) throw new NotFoundException('التذكرة غير موجودة');
      mem.status = dto.status;
      mem.updatedAt = now;
      if (resolvedAt) mem.resolvedAt = resolvedAt;
      if (closedAt) mem.closedAt = closedAt;
      if (note) {
        mem.messages.push({
          id: `msg-res-${Date.now()}`,
          ticketId,
          senderUserId: staffUserId,
          senderRole: UserRole.SUPPORT,
          senderName: 'إدارة الدعم',
          message: `تم تحديث حالة التذكرة إلى (${dto.status}): ${note}`,
          isInternalNote: true,
          createdAt: now,
        });
      }
      return this.mapToDto(mem, UserRole.SUPPORT);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.supportTicket.update({
          where: { id: ticketId },
          data: { status: dto.status, resolvedAt, closedAt, updatedAt: now },
        });
        if (note) {
          await tx.ticketMessage.create({
            data: {
              id: `msg-res-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              ticketId,
              senderUserId: staffUserId,
              senderRole: UserRole.SUPPORT,
              message: `تم تحديث حالة التذكرة إلى (${dto.status}): ${note}`,
              isInternalNote: true,
            },
          });
        }
      });
    } catch (err: any) {
      this.logger.error(`Support status update transaction failed: ${err?.message}`);
      throw new ServiceUnavailableException('Ticket status and resolution note could not be saved.');
    }

    const updated = await this.getTicketById(ticketId, staffUserId, UserRole.SUPPORT);
    await this.notificationsService.emitNotification(
      current.userId,
      NotificationType.SUPPORT_REPLY,
      `تحديث حالة التذكرة #${current.ticketNumber}`,
      `تم تحديث حالة تذكرتك إلى: ${dto.status}.`,
      { ticketId, status: dto.status },
    );
    return updated;
  }

  /**
   * 6. Assign ticket to support staff; persistence is authoritative.
   */
  async assignTicket(
    ticketId: string,
    agentUserId: string,
    agentName?: string,
  ): Promise<SupportTicketDto> {
    if (this.allowMemoryFallback()) {
      const mem = this.memoryTickets.get(ticketId);
      if (!mem) throw new NotFoundException('التذكرة غير موجودة');
      mem.assignedToUserId = agentUserId;
      mem.assignedAgentName = agentName || agentUserId;
      mem.status = TicketStatus.IN_PROGRESS;
      mem.updatedAt = new Date();
      return this.mapToDto(mem, UserRole.SUPPORT);
    }

    try {
      await this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: { assignedToUserId: agentUserId, status: TicketStatus.IN_PROGRESS },
      });
    } catch (err: any) {
      this.logger.error(`Support ticket assignment failed: ${err?.message}`);
      throw new ServiceUnavailableException('The support ticket assignment could not be saved.');
    }
    return this.getTicketById(ticketId, agentUserId, UserRole.SUPPORT);
  }

  /**
   * 7. Order diagnostics always reads the persisted ticket and linked order.
   */
  async diagnoseOrder(ticketId: string, staffUserId: string): Promise<any> {
    let ticket: SupportTicketDto;
    try {
      ticket = await this.getTicketById(ticketId, staffUserId, UserRole.SUPPORT);
    } catch (err) {
      if (!this.allowMemoryFallback()) throw err;
      const mem = this.memoryTickets.get(ticketId);
      if (!mem) throw new NotFoundException('التذكرة غير موجودة');
      ticket = this.mapToDto(mem, UserRole.SUPPORT);
    }

    if (!ticket.orderId) {
      return {
        hasLinkedOrder: false,
        message: 'لا يوجد طلب شحن مرتبط بهذه التذكرة.',
      };
    }

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: ticket.orderId },
        include: { product: true, statusHistory: true },
      });
      if (!order) {
        if (this.allowMemoryFallback()) {
          return {
            hasLinkedOrder: true,
            orderId: ticket.orderId,
            diagnosis: 'الطلب المرتبط غير موجود في قاعدة بيانات الاختبار.',
          };
        }
        throw new NotFoundException('الطلب المرتبط بالتذكرة غير موجود في قاعدة البيانات.');
      }

      const isCompleted = order.status === OrderStatus.Completed;
      const isFailed = order.status === OrderStatus.Failed;
      return {
        hasLinkedOrder: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        currency: order.snapshotCurrency,
        retailPrice: Number(order.snapshotRetailPrice),
        costPrice: Number(order.snapshotCostPrice),
        beneficiaryFields: order.snapshotBeneficiaryFields,
        providerId: order.providerId,
        providerTxId: order.providerTxId,
        errorMessage: order.errorMessage,
        createdAt: order.createdAt,
        diagnosis: isCompleted
          ? 'الطلب مكتمل حسب سجل قاعدة البيانات. يرجى توجيه العميل للتحقق من حسابه.'
          : isFailed
            ? 'فشل تنفيذ الطلب حسب سجل قاعدة البيانات. راجع مسار الاسترداد أو إعادة المحاولة.'
            : 'الطلب قيد التنفيذ أو المراجعة اليدوية؛ يجب مطابقة حالة المزود قبل أي إعادة إرسال.',
      };
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error(`Support order diagnosis failed: ${err?.message}`);
      throw new ServiceUnavailableException('The linked order status could not be verified.');
    }
  }

  /**
   * A support ticket decision is not a financial refund. Only a financial
   * workflow that posts a reversal in the ledger may execute a refund.
   */
  async resolveDisputeRefund(
    ticketId: string,
    staffUserId: string,
    dto: ResolveDisputeRefundDto,
  ): Promise<{ success: boolean; message: string; ticket: SupportTicketDto }> {
    if (!dto.reason?.trim()) {
      throw new BadRequestException('سبب قرار لجنة النزاعات مطلوب.');
    }
    if (!this.allowMemoryFallback()) {
      throw new ServiceUnavailableException(
        'A support decision cannot issue a refund. Use the financial order-refund workflow so that authorization and a reversing ledger entry are posted together.',
      );
    }

    const mem = this.memoryTickets.get(ticketId);
    if (!mem) throw new NotFoundException('التذكرة غير موجودة');
    const resolutionText = dto.approved
      ? `تم قبول طلب المراجعة المالية بقيمة (${dto.refundAmount || 'المبلغ الكامل'}). هذا القرار لا ينفذ استرداداً مالياً.`
      : `تم رفض طلب المراجعة المالية. السبب: ${dto.reason}`;
    mem.status = dto.approved ? TicketStatus.RESOLVED : TicketStatus.CLOSED;
    mem.resolvedAt = new Date();
    mem.updatedAt = new Date();
    mem.messages.push({
      id: `msg-dispute-${Date.now()}`,
      ticketId,
      senderUserId: staffUserId,
      senderRole: UserRole.FINANCE_MANAGER,
      senderName: 'مراجعة مالية',
      message: resolutionText,
      isInternalNote: false,
      createdAt: new Date(),
    });
    await this.notificationsService.emitNotification(
      mem.userId,
      NotificationType.SUPPORT_REPLY,
      dto.approved ? 'الموافقة على طلب الاسترداد للمراجعة المالية' : 'تم رفض طلب الاسترداد',
      resolutionText,
      { ticketId, financialRefundExecuted: false },
    );
    return {
      success: true,
      message: resolutionText,
      ticket: this.mapToDto(mem, UserRole.SUPPORT),
    };
  }

  private mapToDto(ticket: InMemorySupportTicket, viewerRole: UserRole): SupportTicketDto {
    const isStaff = viewerRole !== UserRole.CUSTOMER;
    const messages = (ticket.messages || [])
      .filter((m) => isStaff || !m.isInternalNote) // Strictly redact internal notes for customers!
      .map((m) => ({
        id: m.id,
        ticketId: m.ticketId,
        senderUserId: m.senderUserId,
        senderRole: m.senderRole,
        senderName: m.senderName,
        message: m.message,
        attachments: m.attachments,
        isInternalNote: m.isInternalNote,
        createdAt: m.createdAt.toISOString(),
      }));

    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      userId: ticket.userId,
      customerName: ticket.customerName,
      customerPhone: ticket.customerPhone,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      subject: ticket.subject,
      description: ticket.description,
      orderId: ticket.orderId || undefined,
      depositId: ticket.depositId || undefined,
      assignedToUserId: ticket.assignedToUserId || undefined,
      assignedAgentName: ticket.assignedAgentName || undefined,
      messagesCount: messages.length,
      messages,
      resolvedAt: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : undefined,
      closedAt: ticket.closedAt ? ticket.closedAt.toISOString() : undefined,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }
}
