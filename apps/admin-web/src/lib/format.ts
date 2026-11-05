const nf = new Intl.NumberFormat('id-ID');
export const num = (n: number | null | undefined) => (n === null || n === undefined ? '–' : nf.format(n));
export const rupiah = (n: number) => `Rp${nf.format(n)}`;

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const timeOnly = (iso: string | number) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO -> nilai <input type="datetime-local"> (waktu lokal browser). */
export function toLocalInput(iso: string | Date): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Nilai <input type="datetime-local"> -> ISO UTC. */
export const fromLocalInput = (v: string) => new Date(v).toISOString();

export function ago(iso: string | null): string {
  if (!iso) return 'belum pernah';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} dtk lalu`;
  if (s < 3600) return `${Math.round(s / 60)} mnt lalu`;
  return `${Math.round(s / 3600)} jam lalu`;
}
