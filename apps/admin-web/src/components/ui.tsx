import { ReactNode, useEffect } from 'react';
import { Icon, IconName } from './Icon';
import type { CameraStatus, CrowdLevel, EventStatus, LineupPhase, MonitoringStatus } from '../lib/types';

export function Card({ title, icon, action, children, className = '' }: { title?: ReactNode; icon?: IconName; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-head">
          <h2>{icon && <span className="ti"><Icon name={icon} size={16} /></span>}{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** Kartu KPI gradasi. Berdiri sendiri: nilainya berasal dari prop, bukan dari sumber data tertentu. */
export function GradCard({ tone, icon, label, value, foot }: { tone: 'pink' | 'blue' | 'teal'; icon: IconName; label: string; value: ReactNode; foot?: ReactNode }) {
  return (
    <div className={`kpi ${tone}`}>
      <div className="kpi-top"><span>{label}</span><Icon name={icon} size={20} /></div>
      <div className="kpi-value">{value}</div>
      {foot && <div className="kpi-foot">{foot}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'ok' | 'warn' | 'bad' }) {
  return (
    <div className={`stat ${tone ? `tone-${tone}` : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

const LEVEL: Record<CrowdLevel, [string, string]> = {
  LOW: ['Lengang', 'ok'],
  MODERATE: ['Sedang', 'info'],
  HIGH: ['Padat', 'warn'],
  CRITICAL: ['Kritis', 'bad'],
};
export const levelLabel = (l: CrowdLevel) => LEVEL[l][0];
export const levelTone = (l: CrowdLevel) => LEVEL[l][1];

export function LevelBadge({ level }: { level: CrowdLevel | null }) {
  if (!level) return <span className="badge muted">Kapasitas belum diatur</span>;
  return <span className={`badge ${levelTone(level)}`}>{levelLabel(level)}</span>;
}

const CAM: Record<CameraStatus, [string, string]> = {
  ONLINE: ['Online', 'ok'],
  OFFLINE: ['Offline', 'bad'],
  NEVER: ['Belum terhubung', 'muted'],
  DISABLED: ['Nonaktif', 'muted'],
};
export function CameraBadge({ status }: { status: CameraStatus }) {
  const [label, tone] = CAM[status];
  return <span className={`badge ${tone}`}>{status === 'ONLINE' && <i className="dot" />}{label}</span>;
}

const EV: Record<EventStatus, [string, string]> = {
  DRAFT: ['Draft', 'muted'],
  PUBLISHED: ['Terbit', 'ok'],
  CANCELLED: ['Dibatalkan', 'bad'],
  FINISHED: ['Selesai', 'info'],
};
export function EventBadge({ status }: { status: EventStatus }) {
  const [label, tone] = EV[status];
  return <span className={`badge ${tone}`}>{label}</span>;
}

const MON: Record<MonitoringStatus, [string, string]> = {
  NOT_STARTED: ['Belum Dimulai', 'muted'],
  ACTIVE: ['Aktif', 'ok'],
  INACTIVE: ['Tidak Aktif', 'bad'],
};
export function MonitoringBadge({ status }: { status: MonitoringStatus }) {
  const [label, tone] = MON[status];
  return <span className={`badge ${tone}`}>{status === 'ACTIVE' && <i className="dot" />}{label}</span>;
}

const PH: Record<LineupPhase, [string, string]> = {
  LIVE: ['Sedang tampil', 'bad'],
  UPCOMING: ['Akan tampil', 'info'],
  DONE: ['Selesai', 'muted'],
};
export function PhaseBadge({ phase }: { phase: LineupPhase }) {
  const [label, tone] = PH[phase];
  return <span className={`badge ${tone}`}>{phase === 'LIVE' && <i className="dot" />}{label}</span>;
}

export function Alert({ tone = 'bad', children }: { tone?: 'bad' | 'warn' | 'ok' | 'info'; children: ReactNode }) {
  return <div className={`alert ${tone}`} role={tone === 'bad' ? 'alert' : 'status'}>{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="card-head">
          <h2>{title}</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="Tutup"><Icon name="x" size={16} /></button>
        </header>
        {children}
      </div>
    </div>
  );
}

export const Spinner = () => <div className="spinner" aria-label="Memuat" />;
export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;
