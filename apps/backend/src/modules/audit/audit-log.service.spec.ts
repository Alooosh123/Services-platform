import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  it('persists actor, request network metadata, and action details', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'audit-1' });
    const service = new AuditLogService({ auditLog: { create } } as any);

    await service.record({
      userId: 'staff-1',
      userRole: 'FINANCE_MANAGER',
      action: 'HTTP_POST /api/wallet/topup/request',
      entityName: 'wallet',
      ipAddress: '192.0.2.10',
      userAgent: 'test-browser',
      newValues: { success: true, statusCode: 201 },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'staff-1',
        userRole: 'FINANCE_MANAGER',
        action: 'HTTP_POST /api/wallet/topup/request',
        entityName: 'wallet',
        entityId: undefined,
        oldValues: undefined,
        newValues: { success: true, statusCode: 201 },
        ipAddress: '192.0.2.10',
        userAgent: 'test-browser',
      },
    });
  });
});
