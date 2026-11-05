import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '../api/types';
import { Spinner } from '../components/ui';
import Forbidden from '../pages/Forbidden';
import { useAuth } from './AuthContext';

/**
 * Pembatas tampilan saja. Keamanan sebenarnya ada di backend (JwtAuthGuard + RolesGuard):
 * menyembunyikan halaman di sini tidak pernah dianggap sebagai kontrol akses.
 */
export default function RequireAuth({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) return <Forbidden role={user.role} />;
  return <Outlet />;
}
