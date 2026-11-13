import { NetworkMonitoringService } from './network-monitoring.service';
import { RouterSnapshot } from './mikrotik-readonly.client';

describe('NetworkMonitoringService status and persistence', () => {
  const snapshot: RouterSnapshot = {
    identity: 'router-lab', platform: 'MikroTik', boardName: 'test-board', routerOsVersion: '7.20',
    uptime: '1d', cpuLoadPercent: 92, cpuCount: 4, freeMemoryBytes: 500, totalMemoryBytes: 1000, interfaces: [],
  };
  const persist = jest.fn().mockResolvedValue({ id: 'snapshot-1' });
  const prisma = { networkSnapshot: { create: persist, findMany: jest.fn().mockResolvedValue([]) } };
  const client = { isConfigured: jest.fn(), fetchSnapshot: jest.fn() };
  const diagnosis = {
    diagnose: jest.fn(),
    connectionFailure: jest.fn().mockReturnValue({ code: 'MIKROTIK_CONFIGURATION_MISSING', severity: 'WARNING' }),
  };
  const service = new NetworkMonitoringService(client as any, diagnosis as any, prisma as any);

  beforeEach(() => { jest.clearAllMocks(); persist.mockResolvedValue({ id: 'snapshot-1' }); });
  it('reports DEGRADED for warning-level findings, not only critical findings', async () => {
    client.isConfigured.mockReturnValue(true);
    client.fetchSnapshot.mockResolvedValue(snapshot);
    diagnosis.diagnose.mockReturnValue([{ code: 'ROUTER_CPU_HIGH', severity: 'WARNING' }]);
    const result = await service.inspect();
    expect(result.status).toBe('DEGRADED');
    expect(result.readOnly).toBe(true);
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'DEGRADED' }) }));
  });
  it('reports HEALTHY only when no rule beyond INFO matched', async () => {
    client.isConfigured.mockReturnValue(true);
    client.fetchSnapshot.mockResolvedValue({ ...snapshot, cpuLoadPercent: 10 });
    diagnosis.diagnose.mockReturnValue([{ code: 'NO_RULE_MATCH', severity: 'INFO' }]);
    const result = await service.inspect();
    expect(result.status).toBe('HEALTHY');
  });
  it('reports DISABLED when no RouterOS endpoint is configured', async () => {
    client.isConfigured.mockReturnValue(false);
    const result = await service.inspect();
    expect(result.status).toBe('DISABLED');
    expect(client.fetchSnapshot).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });
  it('reports UNAVAILABLE and persists the failure finding when TLS/network fails', async () => {
    client.isConfigured.mockReturnValue(true);
    client.fetchSnapshot.mockRejectedValue(Object.assign(new Error('private details'), { code: 'NETWORK_OR_TLS_ERROR' }));
    const result = await service.inspect();
    expect(result.status).toBe('UNAVAILABLE');
    expect(JSON.stringify(result)).not.toContain('private details');
    expect(persist).toHaveBeenCalled();
  });
});
