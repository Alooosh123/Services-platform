import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MikroTikReadOnlyClient, RouterSnapshot } from './mikrotik-readonly.client';
import { NetworkDiagnosisService, NetworkDiagnostic } from './network-diagnosis.service';

@Injectable()
export class NetworkMonitoringService {
  private readonly logger = new Logger(NetworkMonitoringService.name);

  constructor(
    private readonly client: MikroTikReadOnlyClient,
    private readonly diagnosis: NetworkDiagnosisService,
    private readonly prisma: PrismaService,
  ) {}

  async inspect() {
    const observedAt = new Date();
    if (!this.client.isConfigured()) {
      const finding = this.diagnosis.connectionFailure('CONFIGURATION_MISSING');
      return { status: 'DISABLED', readOnly: true, observedAt: observedAt.toISOString(), diagnostics: [finding], device: null };
    }
    try {
      const snapshot = await this.client.fetchSnapshot();
      const diagnostics = this.diagnosis.diagnose(snapshot);
      const status = diagnostics.some((d) => d.severity !== 'INFO') ? 'DEGRADED' : 'HEALTHY';
      await this.persist(snapshot, status, diagnostics, observedAt);
      return { status, readOnly: true, observedAt: observedAt.toISOString(), device: snapshot, diagnostics };
    } catch (error) {
      const code = (error && typeof error === 'object' && 'code' in error) ? String((error as { code: unknown }).code) : 'NETWORK_OR_TLS_ERROR';
      const finding = this.diagnosis.connectionFailure(code);
      await this.persist(null, 'UNAVAILABLE', [finding], observedAt);
      return { status: 'UNAVAILABLE', readOnly: true, observedAt: observedAt.toISOString(), device: null, diagnostics: [finding] };
    }
  }

  async history(limit?: string) {
    const take = Math.max(1, Math.min(100, Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.floor(Number(limit)) : 20));
    const rows = await this.prisma.networkSnapshot.findMany({ orderBy: { observedAt: 'desc' }, take });
    return rows.map((row) => ({
      id: row.id, status: row.status, deviceIdentity: row.deviceIdentity, routerOsVersion: row.routerOsVersion,
      cpuLoadPercent: row.cpuLoadPercent, freeMemoryBytes: row.freeMemoryBytes === null ? null : Number(row.freeMemoryBytes),
      totalMemoryBytes: row.totalMemoryBytes === null ? null : Number(row.totalMemoryBytes),
      uptime: row.uptime, interfaceCount: row.interfaceCount, diagnostics: row.diagnostics, observedAt: row.observedAt,
    }));
  }

  private async persist(snapshot: RouterSnapshot | null, status: string, diagnostics: NetworkDiagnostic[], observedAt: Date) {
    try {
      await this.prisma.networkSnapshot.create({
        data: {
          status, deviceIdentity: snapshot?.identity ?? null, routerOsVersion: snapshot?.routerOsVersion ?? null,
          cpuLoadPercent: snapshot?.cpuLoadPercent ?? null,
          freeMemoryBytes: snapshot?.freeMemoryBytes === null || snapshot?.freeMemoryBytes === undefined ? null : BigInt(Math.max(0, Math.floor(snapshot.freeMemoryBytes))),
          totalMemoryBytes: snapshot?.totalMemoryBytes === null || snapshot?.totalMemoryBytes === undefined ? null : BigInt(Math.max(0, Math.floor(snapshot.totalMemoryBytes))),
          uptime: snapshot?.uptime ?? null, interfaceCount: snapshot?.interfaces.length ?? 0,
          interfaces: (snapshot?.interfaces ?? []) as unknown as Prisma.InputJsonValue,
          diagnostics: diagnostics as unknown as Prisma.InputJsonValue, observedAt,
        },
      });
    } catch (error) {
      this.logger.warn('Could not persist network observation; live diagnostic response is still available.');
    }
  }
}
