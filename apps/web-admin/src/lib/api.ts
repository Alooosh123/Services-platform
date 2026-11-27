const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

if (process.env.NODE_ENV === 'production' && !configuredApiUrl) {
  throw new Error('NEXT_PUBLIC_API_URL is required for production builds.');
}

if (
  process.env.NODE_ENV === 'production' &&
  configuredApiUrl &&
  !configuredApiUrl.startsWith('https://')
) {
  throw new Error('NEXT_PUBLIC_API_URL must use HTTPS in production.');
}

const API_BASE_URL = (
  configuredApiUrl || 'http://localhost:4000/api'
).replace(/\/+$/, '');

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : '/' + path;
  return API_BASE_URL + normalizedPath;
}

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('admin_token');
}

export function getAdminAuthHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  const token = getAdminToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

/**
 * UI guard for staging safety only. Backend authorization, dual approval and
 * ledger invariants remain mandatory and must never rely on this client flag.
 */
export const FINANCIAL_ADMIN_WRITES_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_FINANCIAL_ADMIN_WRITES === 'true';
