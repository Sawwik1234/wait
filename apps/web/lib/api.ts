'use client';

export interface Envelope<T> {
  success: boolean;
  data?: T;
  meta?: unknown;
  error?: { code: string; message: string; requestId?: string };
}

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        setTimeout(() => (refreshing = null), 100);
      });
  }
  return refreshing;
}

/** Authenticated fetch against the same-origin /api proxy. Retries once after token refresh. */
export async function api<T>(path: string, init?: RequestInit & { retry?: boolean }): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401 && !init?.retry && !path.startsWith('/auth/')) {
    const ok = await tryRefresh();
    if (ok) return api<T>(path, { ...init, retry: true });
  }

  let body: Envelope<T>;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError('NETWORK', `Request failed (${res.status})`);
  }

  if (!res.ok || !body.success) {
    throw new ApiError(body.error?.code ?? 'ERROR', body.error?.message ?? 'Unknown error');
  }
  return body.data as T;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
export const patch = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) });

/**
 * POST with an idempotency key: retries/double-clicks of the same logical
 * action can never charge twice — the server replays the stored result.
 */
export function postIdem<T>(path: string, body?: unknown): Promise<T> {
  const key = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return api<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'x-idempotency-key': key },
  });
}
