import { vi } from 'vitest';

type Handler = (req: { url: string; method: string; body: any }) => { status?: number; body: unknown };

/** Mengganti fetch global dengan router sederhana berdasarkan "METHOD path-tanpa-host". */
export function mockApi(routes: Record<string, Handler>) {
  const calls: Array<{ key: string; body: any }> = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const full = String(input);
    const path = full.replace(/^https?:\/\/[^/]+\/api\/v1/, '');
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const key = `${method} ${path}`;
    calls.push({ key, body });
    const handler = routes[key] ?? routes[`${method} ${path.split('?')[0]}`];
    if (!handler) return new Response(JSON.stringify({ message: `tidak ada mock untuk ${key}` }), { status: 404 });
    const r = handler({ url: full, method, body });
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fn);
  return { calls, fn };
}
