import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { homePathFor, useAuth } from '../auth/AuthContext';
import { Alert, Button, Card, Field, inputClass } from '../components/ui';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string; search?: string } } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={from?.pathname ?? homePathFor(user.role)} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const u = await login(email.trim(), password);
      navigate(from ? `${from.pathname}${from.search ?? ''}` : homePathFor(u.role), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-2xl font-bold">Masuk</h1>
        <p className="mt-1 text-sm text-slate-500">Masuk untuk membeli dan melihat tiket Anda.</p>
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="Email">
            <input
              type="email"
              autoComplete="email"
              required
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              autoComplete="current-password"
              required
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={loading} disabled={!email || !password} className="w-full">
            Masuk
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Belum punya akun?{' '}
          <Link to="/register" className="font-semibold text-indigo-600 hover:underline">
            Daftar
          </Link>
        </p>
      </Card>
    </div>
  );
}
