import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@digital-topup/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { setSaaSFinanceContext } from '../../../tenant/tenant-context.store';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Only the platform Super Admin bypasses role checks. Tenant Owner is not platform admin.
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException(`Access denied. Required roles: ${requiredRoles.join(', ')}`);
    }

    // The Finance Manager may cross tenant boundaries only for the explicitly
    // role-protected SaaS invoice confirmation handler, not for customer data.
    setSaaSFinanceContext(
      user.role === UserRole.FINANCE_MANAGER &&
      requiredRoles.includes(UserRole.FINANCE_MANAGER),
    );

    return true;
  }
}
