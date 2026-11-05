import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface AuditRecord {
  userId?: string;
  userRole?: string;
  action: string;
  entityName: string;
  entityId?: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(record: AuditRecord) {
    return this.prisma.auditLog.create({
      data: {
        userId: record.userId,
        userRole: record.userRole,
        action: record.action,
        entityName: record.entityName,
        entityId: record.entityId,
        oldValues: record.oldValues,
        newValues: record.newValues,
        ipAddress: record.ipAddress,
        userAgent: record.userAgent,
      },
    });
  }
}
