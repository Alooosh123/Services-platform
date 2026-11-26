import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to PostgreSQL database!');
    } catch (error: any) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(
          'CRITICAL: PostgreSQL connection failed in production. Refusing to start in Demo/Simulation Mode.',
        );
        throw error;
      }

      this.logger.warn(
        `PostgreSQL connection failed (${error?.message || 'Unreachable'}). Non-production server will continue in Demo/Simulation Mode.`,
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
