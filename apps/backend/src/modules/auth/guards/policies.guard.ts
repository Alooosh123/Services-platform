import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@digital-topup/shared';
import { PolicyAction, REQUIRED_POLICY_KEY } from '../decorators/require-policy.decorator';

const POLICY_ROLES: Record<PolicyAction, UserRole[]> = {
  'orders:create': [UserRole.CUSTOMER, UserRole.RESELLER, UserRole.SUB_AGENT],
  'wallet:exchange': [UserRole.CUSTOMER, UserRole.RESELLER, UserRole.SUB_AGENT],
};

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const policy = this.reflector.getAllAndOverride<PolicyAction>(REQUIRED_POLICY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!policy) {
      return true;
    }

    const user = context.switchToHttp().getRequest<{ user?: { role?: UserRole } }>().user;
    if (!user || !user.role || !POLICY_ROLES[policy].includes(user.role)) {
      throw new ForbiddenException(`The current role is not permitted to perform ${policy}.`);
    }
    return true;
  }
}
