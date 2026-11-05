import type {
  ButtonHTMLAttributes,
  ReactNode,
} from 'react';
import type { PageMeta } from '../api/types';

export function Spinner({ small = false }: { small?: boolean }) {
  const size = small ? 'h-4 w-4 border-2' : 'h-8 w-8 border-4';
  return (
    <span
      role="status"
      aria-label="Memuat"
      className={`inline-block ${size} animate-spin rounded-full border-indigo-200 border-t-indigo-600`}
    />
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-slate-600 hover:bg-slate-100',
};

export function Button({
  variant = 'primary',
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner small />}
      {children}
    </button>
  );
}

export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100';

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

type Tone = 'error' | 'success' | 'info' | 'warning';
const tones: Record<Tone, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-green-200 bg-green-50 text-green-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
};

export function Alert({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}
    >
      {children}
    </div>
  );
}

const badgeStyles: Record<string, [string, string]> = {
  PENDING: ['Menunggu pembayaran', 'bg-amber-100 text-amber-800'],
  PAID: ['Lunas (simulasi)', 'bg-green-100 text-green-800'],
  FAILED: ['Gagal', 'bg-red-100 text-red-800'],
  EXPIRED: ['Kedaluwarsa', 'bg-slate-200 text-slate-700'],
  CANCELLED: ['Dibatalkan', 'bg-slate-200 text-slate-700'],
  ACTIVE: ['Aktif', 'bg-green-100 text-green-800'],
  USED: ['Sudah digunakan', 'bg-indigo-100 text-indigo-800'],
  DRAFT: ['Draft', 'bg-slate-200 text-slate-700'],
  PUBLISHED: ['Terbit', 'bg-green-100 text-green-800'],
  FINISHED: ['Selesai', 'bg-slate-200 text-slate-700'],
  SUCCESS: ['Berhasil', 'bg-green-100 text-green-800'],
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const [text, cls] = badgeStyles[status] ?? [status, 'bg-slate-200 text-slate-700'];
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label ?? text}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      {children && <div className="mt-2 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Pagination({
  meta,
  onChange,
}: {
  meta: PageMeta;
  onChange: (page: number) => void;
}) {
  if (meta.totalPages <= 1) return null;
  return (
    <div className="mt-6 flex items-center justify-center gap-3 text-sm">
      <Button variant="secondary" disabled={meta.page <= 1} onClick={() => onChange(meta.page - 1)}>
        Sebelumnya
      </Button>
      <span className="text-slate-600">
        Halaman {meta.page} dari {meta.totalPages}
      </span>
      <Button
        variant="secondary"
        disabled={meta.page >= meta.totalPages}
        onClick={() => onChange(meta.page + 1)}
      >
        Berikutnya
      </Button>
    </div>
  );
}

/** Pembungkus status memuat/galat/data agar halaman tidak mengulang pola yang sama. */
export function AsyncView({
  loading,
  error,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-3">
        <Alert tone="error">{error}</Alert>
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            Coba lagi
          </Button>
        )}
      </div>
    );
  }
  return <>{children}</>;
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
    </div>
  );
}

export const th = 'bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500';
export const td = 'px-4 py-3 align-top text-slate-700';
