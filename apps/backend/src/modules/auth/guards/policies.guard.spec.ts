import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@digital-topup/shared';
import { PoliciesGuard } from './policies.guard';

describe('PoliciesGuard action authorization matrix', () => {
  const handler = {}; const controller = {};
  let reflector: { getAllAndOverride: jest.Mock };
  let user: { id: string; role?: UserRole } | undefined;
  let guard: PoliciesGuard;
  const context = (): ExecutionContext => ({ getHandler: () => handler, getClass: () => controller, switchToHttp: () => ({ getRequest: () => ({ user }) }) } as unknown as ExecutionContext);
  beforeEach(() => { reflector = { getAllAndOverride: jest.fn() }; guard = new PoliciesGuard(reflector as unknown as Reflector); user = undefined; });
  it('allows routes without policy metadata', () => { reflector.getAllAndOverride.mockReturnValue(undefined); expect(guard.canActivate(context())).toBe(true); });
  it.each([UserRole.CUSTOMER, UserRole.RESELLER, UserRole.SUB_AGENT])('allows %s to create orders', (role) => { user = { id: 'principal-1', role }; reflector.getAllAndOverride.mockReturnValue('orders:create'); expect(guard.canActivate(context())).toBe(true); });
  it.each([UserRole.CUSTOMER, UserRole.RESELLER, UserRole.SUB_AGENT])('allows %s to exchange wallet currency', (role) => { user = { id: 'principal-2', role }; reflector.getAllAndOverride.mockReturnValue('wallet:exchange'); expect(guard.canActivate(context())).toBe(true); });
  it.each([UserRole.SUPPORT, UserRole.FINANCE_MANAGER, UserRole.FULFILLMENT_OPERATOR, UserRole.AUDITOR])('denies %s from customer order creation', (role) => { user = { id: 'staff-1', role }; reflector.getAllAndOverride.mockReturnValue('orders:create'); expect(() => guard.canActivate(context())).toThrow(ForbiddenException); });
  it('denies missing identity and missing role', () => { reflector.getAllAndOverride.mockReturnValue('wallet:exchange'); expect(() => guard.canActivate(context())).toThrow(ForbiddenException); user = { id: 'unknown-role' }; expect(() => guard.canActivate(context())).toThrow(ForbiddenException); });
  it('does not grant owner or super-admin a business-policy bypass', () => { reflector.getAllAndOverride.mockReturnValue('orders:create'); user = { id: 'owner-2', role: UserRole.OWNER }; expect(() => guard.canActivate(context())).toThrow(ForbiddenException); user = { id: 'root-2', role: UserRole.SUPER_ADMIN }; expect(() => guard.canActivate(context())).toThrow(ForbiddenException); });
});
