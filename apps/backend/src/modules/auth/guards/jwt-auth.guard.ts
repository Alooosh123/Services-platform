import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@digital-topup/shared';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(error: any, user: any, _info: any, context: ExecutionContext) {
    if (error || !user) {
      throw error || new UnauthorizedException('Authentication required');
    }

    const request = context.switchToHttp().getRequest();
    const resolvedTenantId: string | null = request.tenantId || null;
    const accountTenantId: string | null = user.tenantId || null;

    // The platform Super Admin may access the global domain and tenant domains.
    if (user.role === UserRole.SUPER_ADMIN) {
      return user;
    }

    if (accountTenantId !== resolvedTenantId) {
      throw new ForbiddenException(
        'This account is not a member of the tenant resolved for this domain.',
      );
    }

    return user;
  }
}
