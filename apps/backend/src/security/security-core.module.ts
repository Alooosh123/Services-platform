import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditModule } from '../modules/audit/audit.module';
import { EncryptionService } from './encryption.service';
import { HmacSignatureService } from './hmac-signature.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { RedisIdempotencyStore } from './redis-idempotency.store';
import { SensitiveAuditInterceptor } from './sensitive-audit.interceptor';

@Global()
@Module({
  imports: [AuditModule],
  providers: [
    EncryptionService,
    HmacSignatureService,
    RedisIdempotencyStore,
    IdempotencyInterceptor,
    SensitiveAuditInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: SensitiveAuditInterceptor },
    { provide: APP_INTERCEPTOR, useExisting: IdempotencyInterceptor },
  ],
  exports: [EncryptionService, HmacSignatureService, RedisIdempotencyStore],
})
export class SecurityCoreModule {}
