import { NetworkDiagnosisService } from './network-diagnosis.service';
import { RouterSnapshot } from './mikrotik-readonly.client';

describe('NetworkDiagnosisService', () => {
  const service = new NetworkDiagnosisService();
  const base: RouterSnapshot = { identity: 'router-test', platform: 'MikroTik', boardName: 'test-board', routerOsVersion: '7.20', uptime: '1d', cpuLoadPercent: 10, cpuCount: 4, freeMemoryBytes: 900, totalMemoryBytes: 1000, interfaces: [] };

  it('reports critical CPU utilization using platform warning thresholds', () => {
    const result = service.diagnose({ ...base, cpuLoadPercent: 98 });
    expect(result.some((item) => item.code === 'ROUTER_CPU_CRITICAL' && item.severity === 'CRITICAL')).toBe(true);
  });

  it('reports low memory without proposing automatic changes', () => {
    const result = service.diagnose({ ...base, freeMemoryBytes: 30 });
    expect(result.some((item) => item.code === 'ROUTER_MEMORY_CRITICAL')).toBe(true);
    expect(result.flatMap((item) => item.recommendedChecks).join(' ')).toContain('لا تنفذ');
  });

  it('reports an unexpected down interface but ignores an administratively disabled one', () => {
    const result = service.diagnose({ ...base, interfaces: [
      { name: 'ether1', type: 'ether', running: false, disabled: false, mtu: 1500 },
      { name: 'ether2', type: 'ether', running: false, disabled: true, mtu: 1500 },
    ] });
    expect(result.filter((item) => item.code === 'INTERFACE_NOT_RUNNING')).toHaveLength(1);
  });

  it('returns bounded, explicit diagnostics for failed authentication', () => {
    const result = service.connectionFailure('AUTHENTICATION_FAILED');
    expect(result.code).toBe('MIKROTIK_AUTHENTICATION_FAILED');
    expect(result.recommendedChecks.join(' ')).toContain('read');
  });
});
