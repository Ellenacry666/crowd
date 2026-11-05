import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, PageHeader } from '../components/ui';

const roleLabel = { ADMIN: 'Admin / EO', CUSTOMER: 'Pengunjung', GATE_STAFF: 'Petugas gerbang' } as const;

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Profil" />
      <Card>
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-xs uppercase text-slate-400">Nama</dt>
            <dd className="font-medium">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Email</dt>
            <dd className="font-medium">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Peran</dt>
            <dd className="font-medium">{roleLabel[user.role]}</dd>
          </div>
        </dl>
        <Button
          variant="secondary"
          className="mt-6"
          onClick={() => {
            logout();
            navigate('/');
          }}
        >
          Keluar
        </Button>
      </Card>
    </div>
  );
}
