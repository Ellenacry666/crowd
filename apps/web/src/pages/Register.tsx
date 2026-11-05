import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { homePathFor, useAuth } from '../auth/AuthContext';
import { Alert, Button, Card, Field, inputClass } from '../components/ui';

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
}

function validate(name: string, email: string, password: string, confirm: string): FormErrors {
  const errors: FormErrors = {};
  if (name.trim().length < 2) errors.name = 'Nama minimal 2 karakter.';
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Format email tidak valid.';
  if (password.length < 8) errors.password = 'Password minimal 8 karakter.';
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = 'Password harus mengandung huruf dan angka.';
  }
  if (confirm !== password) errors.confirm = 'Konfirmasi password tidak sama.';
  return errors;
}

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={homePathFor(user.role)} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const v = validate(name, email, password, confirm);
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-2xl font-bold">Buat akun</h1>
        <p className="mt-1 text-sm text-slate-500">Akun pengunjung untuk membeli tiket.</p>
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="Nama lengkap" error={errors.name}>
            <input className={inputClass} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email" error={errors.email}>
            <input type="email" className={inputClass} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" hint="Minimal 8 karakter, berisi huruf dan angka." error={errors.password}>
            <input type="password" className={inputClass} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Ulangi password" error={errors.confirm}>
            <input type="password" className={inputClass} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Button type="submit" loading={loading} className="w-full">
            Daftar
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Sudah punya akun?{' '}
          <Link to="/login" className="font-semibold text-indigo-600 hover:underline">
            Masuk
          </Link>
        </p>
      </Card>
    </div>
  );
}
