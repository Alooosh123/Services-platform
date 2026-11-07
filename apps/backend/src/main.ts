import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { PrismaService } from './database/prisma.service';

/**
 * Validates critical production secrets and environment integrity (SG-05).
 */
export function validateProductionSecrets(logger: Logger) {
  const isProduction = process.env.NODE_ENV === 'production';
  const defaultJwt = 'digital-topup-jwt-access-token-secret-replace-in-production-key-998877';
  const defaultRefresh = 'digital-topup-jwt-refresh-token-secret-replace-in-production-key-112233';

  if (isProduction) {
    const jwtSecret = process.env.JWT_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!jwtSecret || jwtSecret === defaultJwt || jwtSecret.trim().length < 32) {
      const msg = 'CRITICAL SECURITY GATE FAILURE: Missing or insecure JWT_SECRET in production (must be >= 32 characters and non-default).';
      logger.error(msg);
      throw new Error(msg);
    }

    if (!refreshSecret || refreshSecret === defaultRefresh || refreshSecret.trim().length < 32) {
      const msg = 'CRITICAL SECURITY GATE FAILURE: Missing or insecure JWT_REFRESH_SECRET in production (must be >= 32 characters and non-default).';
      logger.error(msg);
      throw new Error(msg);
    }

    if (!/^[0-9a-f]{64}$/i.test(process.env.ENCRYPTION_KEY || '')) {
      const msg = 'CRITICAL SECURITY GATE FAILURE: ENCRYPTION_KEY must be 32 bytes encoded as 64 hexadecimal characters.';
      logger.error(msg);
      throw new Error(msg);
    }

    if (!process.env.WEBHOOK_HMAC_SECRET || Buffer.byteLength(process.env.WEBHOOK_HMAC_SECRET, 'utf8') < 32) {
      const msg = 'CRITICAL SECURITY GATE FAILURE: WEBHOOK_HMAC_SECRET must contain at least 32 bytes.';
      logger.error(msg);
      throw new Error(msg);
    }

    if (!process.env.REDIS_URL) {
      const msg = 'CRITICAL SECURITY GATE FAILURE: REDIS_URL is required for financial idempotency.';
      logger.error(msg);
      throw new Error(msg);
    }
  }
}

export function createGlobalValidationPipe() {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true },
  });
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // SG-05: Enforce secrets validation on startup
  validateProductionSecrets(logger);

  const app = await NestFactory.create(AppModule, { rawBody: true });

  const apiPrefix = process.env.API_PREFIX || 'api';
  app.setGlobalPrefix(apiPrefix);

  app.use(
    helmet({
      hsts: process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );

  // CORS configuration
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];

  const prisma = app.get(PrismaService);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      let hostname: string;
      try {
        hostname = new URL(origin).hostname.toLowerCase();
      } catch {
        callback(null, false);
        return;
      }

      // Custom storefront origins are allowed only when they resolve to an
      // active tenant domain already registered in PostgreSQL.
      void prisma.saaSTenant.findFirst({
        where: {
          status: 'ACTIVE',
          OR: [{ domain: hostname }, { customDomain: hostname }],
        },
        select: { id: true },
      }).then((tenant) => callback(null, Boolean(tenant)))
        .catch(() => callback(null, false));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Tenant-Domain',
      'Idempotency-Key',
      'X-Transaction-Pin',
      'X-Device-Fingerprint',
      'X-CSRF-Token',
    ],
    credentials: true,
    maxAge: 600,
  });

  // Global validation pipe
  app.useGlobalPipes(createGlobalValidationPipe());

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('Digital TopUp & Services Platform API')
    .setDescription(
      'Enterprise-grade Modular Monolith REST API for Gaming recharges, Digital Gift Cards, Immutable Ledger Wallets, and Provider Integrations.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Authentication', 'User sign up, login, OTP simulation, JWT tokens')
    .addTag('Catalog & Products', 'Games, Gift cards, Dynamic form schemas, and Packages')
    .addTag('Orders', 'Order placement, Idempotency, and fulfillment lifecycle')
    .addTag('Wallet', 'Customer balance and deposit management')
    .addTag('Financial Ledger & Auditing', 'Immutable double-entry ledger & admin adjustments')
    .addTag('TopUp Providers', 'Provider adapter integrations and Mock testing')
    .addTag('Admin Analytics & Reports', 'Executive dashboard KPIs and financial performance')
    .addTag('Audit & Compliance', 'Immutable staff audit trail logs')
    .addTag('Operations & Monitoring', 'Health probes, Prometheus telemetry, and Automated alerts')
    .addTag('Database Backups & Disaster Recovery', 'Backup snapshots, SHA-256 verification, and AT-20 DR drills')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    customSiteTitle: 'Digital TopUp Platform API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);

  logger.log(`====================================================`);
  logger.log(`🚀 Digital TopUp Platform Backend API is running!`);
  logger.log(`📡 URL: http://localhost:${port}/${apiPrefix}`);
  logger.log(`📚 Swagger Docs: http://localhost:${port}/${apiPrefix}/docs`);
  logger.log(`🛡️ Security Gate: ACTIVE (MFA: TOTP RFC 6238, BOLA: ENFORCED, SSRF: BLOCKED)`);
  logger.log(`====================================================`);
}

if (require.main === module) {
  void bootstrap();
}
