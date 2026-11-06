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

    // The platform admin portal uses an explicitly configured platform host.
    // Even platform administrators must not authenticate on a tenant storefront host.
    if (accountTenantId !== resolvedTenantId) {
      throw new ForbiddenException(
        'This account is not a member of the tenant resolved for this domain.',
      );
    }

    return user;
  }
}
