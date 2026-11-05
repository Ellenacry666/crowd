import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from './ui';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
  }`;

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      CrowdPulse
    </Link>
  );
}

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate('/');
  };

  const links = (
    <>
      <NavLink to="/events" className={navClass} onClick={() => setOpen(false)}>
        Acara
      </NavLink>
      {user?.role === 'CUSTOMER' && (
        <>
          <NavLink to="/orders" className={navClass} onClick={() => setOpen(false)}>
            Pesanan Saya
          </NavLink>
          <NavLink to="/tickets" className={navClass} onClick={() => setOpen(false)}>
            Tiket Saya
          </NavLink>
        </>
      )}
      {user?.role === 'ADMIN' && (
        <NavLink to="/admin" className={navClass} onClick={() => setOpen(false)}>
          Dashboard Admin
        </NavLink>
      )}
    </>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">{links}</nav>
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <Link to="/profile" className="text-sm font-medium text-slate-700 hover:text-indigo-700">
                  {user.name}
                </Link>
                <Button variant="secondary" onClick={handleLogout}>
                  Keluar
                </Button>
              </>
            ) : (
              <>
                <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  Masuk
                </Link>
                <Link to="/register" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                  Daftar
                </Link>
              </>
            )}
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            aria-label="Buka menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
        {open && (
          <div className="space-y-1 border-t border-slate-200 bg-white px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">{links}</div>
            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
              {user ? (
                <>
                  <Link to="/profile" onClick={() => setOpen(false)} className="text-sm font-medium text-slate-700">
                    {user.name}
                  </Link>
                  <Button variant="secondary" onClick={handleLogout}>
                    Keluar
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-center text-sm font-semibold">
                    Masuk
                  </Link>
                  <Link to="/register" onClick={() => setOpen(false)} className="rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-semibold text-white">
                    Daftar
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-slate-500">
          <p className="font-semibold text-slate-600">CrowdPulse Ticketing: proyek capstone</p>
          <p className="mt-1">
            Pembayaran bersifat simulasi untuk demonstrasi akademik. Tidak ada transaksi uang sungguhan.
          </p>
        </div>
      </footer>
    </div>
  );
}
