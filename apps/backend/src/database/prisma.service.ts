import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to MySQL database!');
    } catch (error: any) {
      this.logger.warn(
        `Database connection to MySQL connection failed (${error?.message || 'Unreachable'}). Application startup will continue in non-production mode only.`,
      );
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
