const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const dateTime = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' });
const timeOnly = new Intl.DateTimeFormat('id-ID', { timeStyle: 'short' });

export const formatRupiah = (n: number) => rupiah.format(n);
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDate = (iso: string) => dateOnly.format(new Date(iso));
export const formatTime = (iso: string) => timeOnly.format(new Date(iso));

/** Mengubah ISO (UTC) menjadi nilai input datetime-local di zona waktu pengguna. */
export function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Mengubah nilai input datetime-local menjadi ISO UTC untuk dikirim ke backend. */
export function fromDateTimeLocal(value: string): string {
  return new Date(value).toISOString();
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
