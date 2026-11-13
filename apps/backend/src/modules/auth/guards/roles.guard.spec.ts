import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@digital-topup/shared';
import { RolesGuard } from './roles.guard';

describe('RolesGuard authorization matrix', () => {
  const handler = {}; const controller = {};
  let reflector: { getAllAndOverride: jest.Mock };
  let user: { id: string; role: UserRole } | undefined;
  let guard: RolesGuard;
  const context = (): ExecutionContext => ({ getHandler: () => handler, getClass: () => controller, switchToHttp: () => ({ getRequest: () => ({ user }) }) } as unknown as ExecutionContext);
  beforeEach(() => { reflector = { getAllAndOverride: jest.fn() }; guard = new RolesGuard(reflector as unknown as Reflector); user = undefined; });
  it('allows routes without role metadata', () => { reflector.getAllAndOverride.mockReturnValue(undefined); expect(guard.canActivate(context())).toBe(true); });
  it('denies missing identity when roles are required', () => { reflector.getAllAndOverride.mockReturnValue([UserRole.FINANCE_MANAGER]); expect(() => guard.canActivate(context())).toThrow(ForbiddenException); });
  it('allows the explicitly required role', () => { user = { id: 'finance-1', role: UserRole.FINANCE_MANAGER }; reflector.getAllAndOverride.mockReturnValue([UserRole.FINANCE_MANAGER]); expect(guard.canActivate(context())).toBe(true); });
  it('rejects customers from staff-only routes', () => { user = { id: 'customer-1', role: UserRole.CUSTOMER }; reflector.getAllAndOverride.mockReturnValue([UserRole.FINANCE_MANAGER, UserRole.AUDITOR]); expect(() => guard.canActivate(context())).toThrow(ForbiddenException); });
  it('allows owner and super-admin bypasses only at the generic RBAC layer', () => { reflector.getAllAndOverride.mockReturnValue([UserRole.FINANCE_MANAGER]); user = { id: 'owner-1', role: UserRole.OWNER }; expect(guard.canActivate(context())).toBe(true); user = { id: 'root-1', role: UserRole.SUPER_ADMIN }; expect(guard.canActivate(context())).toBe(true); });
  it('denies unrelated roles and checks handler/class metadata', () => { user = { id: 'support-1', role: UserRole.SUPPORT }; reflector.getAllAndOverride.mockReturnValue([UserRole.AUDITOR]); expect(() => guard.canActivate(context())).toThrow(ForbiddenException); expect(reflector.getAllAndOverride).toHaveBeenCalledWith('roles', [handler, controller]); });
});
