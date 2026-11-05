import { Link } from 'react-router-dom';
import type { Role } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Button, Card } from '../components/ui';

export default function Forbidden({ role }: { role?: Role }) {
  const { logout } = useAuth();
  return (
    <div className="mx-auto max-w-lg">
      <Card className="text-center">
        <h1 className="text-xl font-bold">Halaman tidak tersedia untuk akun ini</h1>
        <p className="mt-2 text-sm text-slate-600">
          {role === 'GATE_STAFF'
            ? 'Akun petugas gerbang digunakan pada aplikasi Android untuk memindai tiket, bukan di website.'
            : 'Akun Anda tidak memiliki izin untuk membuka halaman ini.'}
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link to="/" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50">
            Ke beranda
          </Link>
          <Button variant="secondary" onClick={logout}>
            Keluar
          </Button>
        </div>
      </Card>
    </div>
  );
}
