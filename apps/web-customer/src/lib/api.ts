const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

type ApiErrorBody = {
  message?: string | string[];
  error?: string;
};

export function getCustomerToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('customer_token');
}

export function saveCustomerSession(data: {
  tokens?: { accessToken?: string };
  user?: unknown;
}): void {
  const accessToken = data.tokens?.accessToken;
  if (!accessToken || !data.user) {
    throw new Error('استجابة المصادقة غير مكتملة من الخادم');
  }

  window.localStorage.setItem('customer_token', accessToken);
  window.localStorage.setItem('customer_user', JSON.stringify(data.user));
  window.dispatchEvent(new Event('customer-session-changed'));
}

export function clearCustomerSession(): void {
  window.localStorage.removeItem('customer_token');
  window.localStorage.removeItem('customer_user');
  window.dispatchEvent(new Event('customer-session-changed'));
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getCustomerToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(apiUrl(path), {
    ...init,
    headers,
  });
  const responseText = await response.text();
  let data: unknown;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      if (response.ok) {
        throw new Error('استجابة غير صالحة من الخادم');
      }
      data = { message: responseText };
    }
  }

  if (!response.ok) {
    const errorBody = data && typeof data === 'object' ? (data as ApiErrorBody) : {};
    const message = Array.isArray(errorBody.message)
      ? errorBody.message.join('، ')
      : errorBody.message || errorBody.error;
    throw new Error(message || `تعذر إكمال الطلب (${response.status})`);
  }

  return data as T;
}
