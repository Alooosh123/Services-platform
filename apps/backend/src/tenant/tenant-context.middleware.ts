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
    const normalizeHost = (value: string): string =>
      value.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').split('/')[0].split(':')[0].replace(/\.$/, '');

    const requestHost = normalizeHost(req.hostname || '');
    const platformHosts = new Set(
      (process.env.PLATFORM_HOSTS || '')
        .split(',')
        .map(normalizeHost)
        .filter(Boolean),
    );
    const isLocalDevelopmentHost =
      process.env.NODE_ENV !== 'production' &&
      (
        !requestHost ||
        requestHost === 'localhost' ||
        requestHost === '127.0.0.1' ||
        requestHost === '::1'
      );

    let tenantLookupHost = isLocalDevelopmentHost || platformHosts.has(requestHost)
      ? ''
      : requestHost;

    // A central API hostname may receive requests from a tenant storefront.
    // Resolve the tenant using Origin, or an explicit mobile/API tenant-domain header.
    if (!tenantLookupHost && !isLocalDevelopmentHost) {
      const header = (name: string): string => {
        if (typeof req.get === 'function') return req.get(name) || '';
        const value = req.headers?.[name];
        return Array.isArray(value) ? value[0] || '' : value || '';
      };
      const tenantDomainHeader = header('x-tenant-domain');
      const originHeader = header('origin');
      let originHost = '';
      if (originHeader) {
        try {
          originHost = normalizeHost(new URL(originHeader).hostname);
        } catch {
          originHost = '';
        }
      }
      const candidate = normalizeHost(tenantDomainHeader) || originHost;
      if (candidate && !platformHosts.has(candidate)) {
        tenantLookupHost = candidate;
      }
    }

    if (!tenantLookupHost) {
      req.tenantId = null;
      req.tenant = null;
      runWithTenantContext(null, next);
      return;
    }

    try {
      const tenant = await this.prisma.saaSTenant.findFirst({
        where: {
          status: 'ACTIVE',
          OR: [{ domain: tenantLookupHost }, { customDomain: tenantLookupHost }],
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
