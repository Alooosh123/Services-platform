import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@digital-topup/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { setSaaSFinanceContext } from '../../../tenant/tenant-context.store';
import { SAAS_INVOICE_FINANCE_ACCESS_KEY } from '../../saas/decorators/saas-invoice-finance.decorator';

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

    // Cross-tenant SaaS billing access requires both the explicit Finance
    // Manager role and the dedicated invoice-confirmation handler marker.
    const isSaaSInvoiceFinanceHandler =
      this.reflector.get<boolean>(SAAS_INVOICE_FINANCE_ACCESS_KEY, context.getHandler()) === true;
    setSaaSFinanceContext(
      user.role === UserRole.FINANCE_MANAGER &&
      requiredRoles.includes(UserRole.FINANCE_MANAGER) &&
      isSaaSInvoiceFinanceHandler,
    );

    return true;
  }
}
