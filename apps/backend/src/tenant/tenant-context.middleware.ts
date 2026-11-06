import {
  Injectable,
  NestMiddleware,
  ServiceUnavailableException,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../database/prisma.service';
import { runWithTenantContext } from './tenant-context.store';

export interface TenantAwareRequest extends Request {
  tenantId?: string | null;
  tenant?: {
    id: string;
    slug: string;
    domain: string | null;
    customDomain: string | null;
  } | null;
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: TenantAwareRequest, _res: Response, next: NextFunction): Promise<void> {
    const host = (req.hostname || '')
      .toLowerCase()
      .replace(/\.$/, '');

    // Only explicitly configured platform hosts use the global context.
    const platformHosts = new Set(
      (process.env.PLATFORM_HOSTS || '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    );
    if (
      !host ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      platformHosts.has(host)
    ) {
      req.tenantId = null;
      req.tenant = null;
      runWithTenantContext(null, next);
      return;
    }

    try {
      const tenant = await this.prisma.saaSTenant.findFirst({
        where: {
          status: 'ACTIVE',
          OR: [{ domain: host }, { customDomain: host }],
        },
        select: {
          id: true,
          slug: true,
          domain: true,
          customDomain: true,
        },
      });

      // Unknown hostnames must never silently become the platform/global tenant.
      // The sentinel scopes all tenant-aware queries to an empty context and causes
      // JwtAuthGuard to reject platform and tenant account tokens alike.
      req.tenantId = tenant?.id ?? '__UNRESOLVED_TENANT__';
      req.tenant = tenant ?? null;
      runWithTenantContext(req.tenantId, next);
    } catch {
      next(
        new ServiceUnavailableException(
          'Tenant domain resolution is temporarily unavailable.',
        ),
      );
    }
  }
}
