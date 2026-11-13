import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to MySQL 8.4 database.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unreachable';
      this.logger.error(`MySQL database connection failed: ${message}`);
      // Unit tests may mock this service; any real runtime fails closed.
      if (process.env.NODE_ENV !== 'test') throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch {
      // ignore
    }
  }
}
