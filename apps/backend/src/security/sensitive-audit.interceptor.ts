import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, catchError, from, mergeMap, throwError } from 'rxjs';
import { AuditLogService } from '../modules/audit/audit-log.service';

interface AuditedRequest extends Request {
  user?: { id?: string; role?: string };
}

@Injectable()
export class SensitiveAuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuditedRequest>();
    const response = http.getResponse<Response>();
    if (!this.isSensitiveMutation(request.method, request.path)) {
      return next.handle();
    }

    const audit = (success: boolean, statusCode: number) =>
      this.auditLogService.record({
        userId: request.user?.id,
        userRole: request.user?.role,
        action: `HTTP_${request.method.toUpperCase()} ${request.path}`,
        entityName: this.getEntityName(request.path),
        ipAddress: request.ip,
        userAgent: request.get('user-agent'),
        newValues: { success, statusCode },
      });

    return next.handle().pipe(
      mergeMap((result) => from(audit(true, response.statusCode)).pipe(mergeMap(() => [result]))),
      catchError((error: unknown) => {
        const statusCode = typeof error === 'object' && error !== null && 'getStatus' in error
          ? (error as { getStatus: () => number }).getStatus()
          : 500;
        return from(audit(false, statusCode)).pipe(mergeMap(() => throwError(() => error)));
      }),
    );
  }

  private isSensitiveMutation(method: string, path: string): boolean {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
      return false;
    }
    const normalizedPath = path.replace(/^\/api(?=\/|$)/, '');
    return /^\/(orders|wallet|payouts|ledger|deposits|providers|merchant)(?:\/|$)/i.test(normalizedPath);
  }

  private getEntityName(path: string): string {
    return path.replace(/^\/api(?=\/|$)/, '').split('/').filter(Boolean)[0] || 'HTTP';
  }
}
