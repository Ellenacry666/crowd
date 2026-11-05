import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { Icon } from './components/Icon';
import { ThemeToggle } from './components/ThemeToggle';
import { Spinner } from './components/ui';
import { useAuth } from './lib/auth';
import DashboardPage from './pages/DashboardPage';
import EventDetailPage from './pages/EventDetailPage';
import EventFormPage from './pages/EventFormPage';
import EventsPage from './pages/EventsPage';
import LoginPage from './pages/LoginPage';
import SalesPage from './pages/SalesPage';
import StaffAccountsPage from './pages/StaffAccountsPage';
import StaffPage from './pages/StaffPage';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'home' },
  { to: '/events', label: 'Acara & Lineup', icon: 'calendar' },
  { to: '/sales', label: 'Penjualan Tiket', icon: 'wallet' },
  { to: '/staff/accounts', label: 'Akun Petugas', icon: 'user-plus' },
  { to: '/staff', label: 'Penugasan Petugas', icon: 'shield', end: true },
] as const;

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'A';

function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><span className="logo"><Icon name="layers" size={20} /></span>CrowdPulse</div>
        <div className="profile">
          <span className="avatar" aria-hidden="true">{initials(user?.name ?? '')}</span>
          <div><b>{user?.name}</b><small>Administrator</small></div>
        </div>
        <nav className="nav" aria-label="Menu utama">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={'end' in n}>
              <span>{n.label}</span>
              <Icon name={n.icon} size={18} />
            </NavLink>
          ))}
        </nav>
        <div className="spacer" />
        <button className="btn ghost nav-out" onClick={logout}><span>Keluar</span><Icon name="log-out" size={18} /></button>
      </aside>
      <div className="content">
        <header className="topbar">
          <span className="greet">Selamat datang, <b>{user?.name}</b></span>
          <span className="user-chip">
            <ThemeToggle />
            <span className="avatar sm" aria-hidden="true">{initials(user?.name ?? '')}</span>
            <span className="who-mail">{user?.email}</span>
            <button className="icon-btn" onClick={logout} aria-label="Keluar" title="Keluar"><Icon name="log-out" size={18} /></button>
          </span>
        </header>
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <Layout /> : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route element={<Protected />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/staff/accounts" element={<StaffAccountsPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/events/new" element={<EventFormPage />} />
        <Route path="/events/:id" element={<EventDetailPage />} />
        <Route path="/events/:id/edit" element={<EventFormPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
