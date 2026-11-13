import { MikroTikReadOnlyClient } from './mikrotik-readonly.client';

describe('MikroTikReadOnlyClient transport guardrails', () => {
  const client = new MikroTikReadOnlyClient();
  const previous = {
    base: process.env.MIKROTIK_BASE_URL,
    username: process.env.MIKROTIK_USERNAME,
    password: process.env.MIKROTIK_PASSWORD,
    nodeEnv: process.env.NODE_ENV,
  };
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.MIKROTIK_USERNAME = 'monitor-api';
    process.env.MIKROTIK_PASSWORD = 'test-only-long-password';
  });
  afterAll(() => {
    if (previous.base === undefined) delete process.env.MIKROTIK_BASE_URL; else process.env.MIKROTIK_BASE_URL = previous.base;
    if (previous.username === undefined) delete process.env.MIKROTIK_USERNAME; else process.env.MIKROTIK_USERNAME = previous.username;
    if (previous.password === undefined) delete process.env.MIKROTIK_PASSWORD; else process.env.MIKROTIK_PASSWORD = previous.password;
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.nodeEnv;
  });
  it('reports not configured without a base URL or credentials', () => {
    delete process.env.MIKROTIK_BASE_URL;
    expect(client.isConfigured()).toBe(false);
  });
  it('rejects plaintext HTTP before making a network request', async () => {
    process.env.MIKROTIK_BASE_URL = 'http://192.168.88.1';
    await expect(client.fetchSnapshot()).rejects.toMatchObject({ code: 'INSECURE_CONFIGURATION' });
  });
  it('rejects public IPv4 endpoints to reduce SSRF risk', async () => {
    process.env.MIKROTIK_BASE_URL = 'https://8.8.8.8';
    await expect(client.fetchSnapshot()).rejects.toMatchObject({ code: 'HOST_NOT_ALLOWED' });
  });
  it('rejects URLs containing embedded credentials, paths or query strings', async () => {
    for (const url of [
      'https://monitor:secret@192.168.88.1',
      'https://192.168.88.1/rest',
      'https://192.168.88.1?debug=true',
    ]) {
      process.env.MIKROTIK_BASE_URL = url;
      await expect(client.fetchSnapshot()).rejects.toMatchObject({ code: 'INSECURE_CONFIGURATION' });
    }
  });
  it('does not allow arbitrary private ranges or invalid IPv4 hostnames', async () => {
    for (const url of ['https://172.15.0.2', 'https://192.0.2.1', 'https://not-a-router.local']) {
      process.env.MIKROTIK_BASE_URL = url;
      await expect(client.fetchSnapshot()).rejects.toMatchObject({ code: 'HOST_NOT_ALLOWED' });
    }
  });
});
