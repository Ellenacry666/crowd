export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api/v1';
const BASE = API_BASE;
const TOKEN_KEY = 'crowdpulse.admin.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

interface Opts {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Login: 401 berarti kredensial salah, bukan sesi habis. */
  skipAuthRedirect?: boolean;
}

export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? 'GET',
      signal: opts.signal,
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError('Tidak dapat terhubung ke server. Periksa koneksi dan URL API.', 0);
  }

  if (res.status === 401 && !opts.skipAuthRedirect) {
    tokenStore.clear();
    onUnauthorized?.();
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const raw = data?.message;
    const message = Array.isArray(raw) ? raw.join(', ') : (raw ?? `Permintaan gagal (${res.status})`);
    throw new ApiError(message, res.status, data?.code);
  }
  return data as T;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Terjadi kesalahan');
export const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';
