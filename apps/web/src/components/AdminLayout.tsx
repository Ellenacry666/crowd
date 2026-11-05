import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Logo } from './MainLayout';
import { Button } from './ui';

const items: { to: string; label: string; end?: boolean }[] = [
  { to: '/admin', label: 'Ringkasan', end: true },
  { to: '/admin/events', label: 'Acara' },
  { to: '/admin/orders', label: 'Order' },
  { to: '/admin/tickets', label: 'Tiket' },
  { to: '/admin/staff', label: 'Petugas' },
  { to: '/admin/reports', label: 'Laporan' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-100'
  }`;

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const menu = (
    <nav className="space-y-1">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} className={linkClass} onClick={() => setOpen(false)}>
          {i.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <Logo />
        <p className="mb-4 mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Admin / EO</p>
        {menu}
        <div className="mt-auto space-y-2 border-t border-slate-100 pt-4 text-sm">
          <p className="truncate font-medium text-slate-700">{user?.name}</p>
          <Button variant="secondary" className="w-full" onClick={() => navigate('/')}>
            Lihat website
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Keluar
          </Button>
        </div>
      </aside>

      <div className="flex-1">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <Logo />
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Buka menu admin"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
        {open && (
          <div className="space-y-3 border-b border-slate-200 bg-white p-4 md:hidden">
            {menu}
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              Keluar
            </Button>
          </div>
        )}
        <main className="mx-auto max-w-6xl p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
