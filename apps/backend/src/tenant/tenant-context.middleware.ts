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

    // Platform-local hosts intentionally use the platform-wide context.
    if (
      !host ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1'
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

      req.tenantId = tenant?.id ?? null;
      req.tenant = tenant ?? null;

      // Unknown hosts stay in the platform context. Tenant JWTs are rejected
      // by JwtAuthGuard unless their tenant membership matches the resolved host.
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
