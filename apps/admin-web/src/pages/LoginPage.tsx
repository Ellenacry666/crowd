import { FormEvent, useState } from 'react';
import { Icon } from '../components/Icon';
import { Alert, Field } from '../components/ui';
import { errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <div className="login-logo"><span className="logo"><Icon name="layers" size={22} /></span></div>
        <h1>CrowdPulse Admin</h1>
        <p style={{ color: 'var(--muted)', margin: '6px 0 18px' }}>Masuk untuk memantau kerumunan konser.</p>
        {error && <Alert>{error}</Alert>}
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus />
        </Field>
        <Field label="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Masuk…' : 'Masuk'}</button>
      </form>
    </div>
  );
}
