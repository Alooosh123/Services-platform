import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as https from 'https';
import { isIP } from 'net';

export type RouterRecord = Record<string, unknown>;

export class MikroTikReadOnlyError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = 'MikroTikReadOnlyError'; }
}

export interface RouterInterfaceSummary {
  name: string;
  type: string | null;
  running: boolean;
  disabled: boolean;
  mtu: number | null;
}

export interface RouterSnapshot {
  identity: string;
  platform: string | null;
  boardName: string | null;
  routerOsVersion: string | null;
  uptime: string | null;
  cpuLoadPercent: number | null;
  cpuCount: number | null;
  freeMemoryBytes: number | null;
  totalMemoryBytes: number | null;
  interfaces: RouterInterfaceSummary[];
}

@Injectable()
export class MikroTikReadOnlyClient {
  private readonly requestTimeoutMs = 6000;
  private readonly maxResponseBytes = 1024 * 1024;

  isConfigured(): boolean {
    return process.env.MIKROTIK_MONITORING_ENABLED === 'true' &&
      Boolean(process.env.MIKROTIK_BASE_URL && process.env.MIKROTIK_USERNAME && process.env.MIKROTIK_PASSWORD);
  }

  async fetchSnapshot(): Promise<RouterSnapshot> {
    const [identityRows, resourceRows, interfaceRows] = await Promise.all([
      this.get('/system/identity'),
      this.get('/system/resource'),
      this.get('/interface'),
    ]);
    const identity = this.first(identityRows);
    const resource = this.first(resourceRows);
    const interfaces = interfaceRows.slice(0, 128).map((row) => ({
      name: this.asString(row.name) || 'unnamed',
      type: this.asString(row.type),
      running: this.asBoolean(row.running),
      disabled: this.asBoolean(row.disabled),
      mtu: this.asNumber(row.mtu),
    }));
    return {
      identity: this.asString(identity.name) || 'MikroTik',
      platform: this.asString(resource.platform),
      boardName: this.asString(resource['board-name']),
      routerOsVersion: this.asString(resource.version),
      uptime: this.asString(resource.uptime),
      cpuLoadPercent: this.asNumber(resource['cpu-load']),
      cpuCount: this.asNumber(resource['cpu-count']),
      freeMemoryBytes: this.asNumber(resource['free-memory']),
      totalMemoryBytes: this.asNumber(resource['total-memory']),
      interfaces,
    };
  }

  private first(rows: RouterRecord[]): RouterRecord { return rows[0] || {}; }

  private asString(value: unknown): string | null {
    return value === undefined || value === null ? null : String(value);
  }

  private asNumber(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private asBoolean(value: unknown): boolean {
    return value === true || value === 1 || String(value).toLowerCase() === 'true' || String(value) === '1';
  }

  private getBaseUrl(): URL {
    const raw = process.env.MIKROTIK_BASE_URL;
    if (!raw) throw new MikroTikReadOnlyError('CONFIGURATION_MISSING', 'MIKROTIK_BASE_URL is not configured.');
    let url: URL;
    try { url = new URL(raw); } catch { throw new MikroTikReadOnlyError('INVALID_CONFIGURATION', 'MIKROTIK_BASE_URL is invalid.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
      throw new MikroTikReadOnlyError('INSECURE_CONFIGURATION', 'MikroTik URL must be an HTTPS origin without embedded credentials, query, or path.');
    }
    const octets = url.hostname.split('.').map((part) => Number(part));
    const validIpv4 = isIP(url.hostname) === 4 && octets.length === 4 && octets.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
    const privateIpv4 = validIpv4 && (
      octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      (process.env.NODE_ENV === 'test' && octets[0] === 127)
    );
    if (!privateIpv4) throw new MikroTikReadOnlyError('HOST_NOT_ALLOWED', 'MikroTik host must be a private IPv4 address on the management network.');
    return url;
  }

  private async get(resourcePath: string): Promise<RouterRecord[]> {
    const base = this.getBaseUrl();
    const username = process.env.MIKROTIK_USERNAME;
    const password = process.env.MIKROTIK_PASSWORD;
    if (!username || !password) throw new MikroTikReadOnlyError('CONFIGURATION_MISSING', 'MikroTik read-only credentials are not configured.');
    const auth = Buffer.from(username + ':' + password, 'utf8').toString('base64');
    let ca: Buffer | undefined;
    if (process.env.MIKROTIK_CA_FILE) {
      try { ca = fs.readFileSync(process.env.MIKROTIK_CA_FILE); }
      catch { throw new MikroTikReadOnlyError('CA_FILE_UNREADABLE', 'Configured MikroTik CA certificate file cannot be read.'); }
    }
    const url = new URL('/rest' + resourcePath, base);
    return new Promise<RouterRecord[]>((resolve, reject) => {
      const req = https.request({
        protocol: 'https:', hostname: url.hostname, port: url.port || '443',
        path: url.pathname, method: 'GET',
        headers: { Authorization: 'Basic ' + auth, Accept: 'application/json', Connection: 'close' },
        ca, rejectUnauthorized: true, minVersion: 'TLSv1.2', timeout: this.requestTimeoutMs,
      }, (res) => {
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > this.maxResponseBytes) { req.destroy(new Error('RouterOS response exceeded the configured size limit.')); return; }
          chunks.push(chunk);
        });
        res.on('end', () => {
          const status = res.statusCode || 0;
          if (status === 401 || status === 403) return reject(new MikroTikReadOnlyError('AUTHENTICATION_FAILED', 'RouterOS rejected the read-only account or REST permission.'));
          if (status >= 300 && status < 400) return reject(new MikroTikReadOnlyError('REDIRECT_REJECTED', 'RouterOS HTTPS redirects are not followed.'));
          if (status !== 200) return reject(new MikroTikReadOnlyError('REMOTE_ERROR', 'RouterOS returned HTTP status ' + status + '.'));
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
            const rows = Array.isArray(parsed) ? parsed : [parsed];
            resolve(rows.filter((row): row is RouterRecord => Boolean(row) && typeof row === 'object' && !Array.isArray(row)));
          } catch { reject(new MikroTikReadOnlyError('INVALID_RESPONSE', 'RouterOS returned an invalid JSON response.')); }
        });
      });
      req.on('timeout', () => req.destroy(new MikroTikReadOnlyError('TIMEOUT', 'RouterOS request timed out.')));
      req.on('error', (error: Error) => {
        if (error instanceof MikroTikReadOnlyError) return reject(error);
        reject(new MikroTikReadOnlyError('NETWORK_OR_TLS_ERROR', 'Unable to reach RouterOS over verified HTTPS. Check routing, firewall, www-ssl and the trusted CA.'));
      });
      req.end();
    });
  }
}
