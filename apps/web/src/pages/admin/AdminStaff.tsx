import { FormEvent, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { adminApi } from '../../api/endpoints';
import {
  Alert,
  AsyncView,
  Button,
  Card,
  EmptyState,
  Field,
  inputClass,
  PageHeader,
  Table,
  td,
  th,
} from '../../components/ui';
import { formatDateTime } from '../../utils/format';
import { useAsync } from '../../utils/hooks';

export default function AdminStaff() {
  const { data, loading, error, reload } = useAsync(() => adminApi.staff(), []);
  const events = useAsync(() => adminApi.events({ limit: 100 }), []);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const titleOf = (id: string) => events.data?.items.find((e) => e.id === id)?.title ?? 'Acara';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setCreated(null);
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      setFormError('Password minimal 8 karakter, berisi huruf dan angka.');
      return;
    }
    setSaving(true);
    try {
      const s = await adminApi.createStaff({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setCreated(`Akun petugas ${s.email} dibuat. Tugaskan ke acara dari halaman Kelola acara.`);
      setForm({ name: '', email: '', password: '' });
      reload();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string, isActive: boolean) => {
    setActionError(null);
    try {
      await adminApi.updateStaff(id, { isActive: !isActive });
      reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Petugas gerbang" subtitle="Akun untuk aplikasi Android pemindai tiket." />

      <Card>
        <h2 className="mb-4 text-lg font-bold">Tambah petugas</h2>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-3" noValidate>
          <Field label="Nama">
            <input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <input type="email" required className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Password awal">
            <input type="password" required autoComplete="new-password" className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <div className="space-y-3 md:col-span-3">
            {formError && <Alert tone="error">{formError}</Alert>}
            {created && <Alert tone="success">{created}</Alert>}
            <Button type="submit" loading={saving} disabled={!form.name || !form.email || !form.password}>
              Buat akun petugas
            </Button>
          </div>
        </form>
      </Card>

      {actionError && <Alert tone="error">{actionError}</Alert>}

      <AsyncView loading={loading && !data} error={error} onRetry={reload}>
        {data && data.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <th className={th}>Nama</th>
                <th className={th}>Email</th>
                <th className={th}>Acara ditugaskan</th>
                <th className={th}>Status</th>
                <th className={th}>Dibuat</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((s) => (
                <tr key={s.id}>
                  <td className={`${td} font-medium`}>{s.name}</td>
                  <td className={td}>{s.email}</td>
                  <td className={td}>
                    {s.eventIds.length === 0 ? <span className="text-slate-400">Belum ada</span> : s.eventIds.map(titleOf).join(', ')}
                  </td>
                  <td className={td}>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {s.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{formatDateTime(s.createdAt)}</td>
                  <td className={`${td} text-right`}>
                    <Button variant="secondary" onClick={() => toggle(s.id, s.isActive)}>
                      {s.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="Belum ada petugas" />
        )}
      </AsyncView>
    </div>
  );
}
