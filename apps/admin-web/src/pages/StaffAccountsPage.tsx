import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useToast } from '../components/toast';
import { Alert, Card, Empty, Field, Modal, Spinner } from '../components/ui';
import { api, errMsg } from '../lib/api';
import { dateTime } from '../lib/format';
import { generatePassword, passwordError } from '../lib/password';
import { useFetch } from '../lib/useFetch';
import type { StaffMember } from '../lib/types';

export default function StaffAccountsPage() {
  const toast = useToast();
  const { data: staff, error, reload } = useFetch<StaffMember[]>('/admin/staff');
  const [form, setForm] = useState<{ staff?: StaffMember } | null>(null);

  async function setActive(s: StaffMember, isActive: boolean) {
    if (!isActive && !window.confirm(`Nonaktifkan ${s.name}? Petugas tidak dapat masuk sampai diaktifkan kembali.`)) return;
    try {
      await api(`/admin/staff/${s.id}`, { method: 'PATCH', body: { isActive } });
      toast.success(`${s.name} ${isActive ? 'diaktifkan' : 'dinonaktifkan'}.`);
      reload();
    } catch (e) {
      toast.error(`Gagal mengubah status: ${errMsg(e)}`);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Akun Petugas Gerbang</h1>
          <p>Buat akun petugas untuk aplikasi pemindai. Setelah dibuat, <Link to="/staff">tugaskan ke acara</Link> agar acara muncul di aplikasi mereka.</p>
        </div>
        <button className="btn" onClick={() => setForm({})}><Icon name="user-plus" size={16} /> Tambah petugas</button>
      </div>
      {error && <Alert>{error}</Alert>}
      <Card>
        {!staff ? (error ? null : <Spinner />) : staff.length === 0 ? <Empty>Belum ada akun petugas. Klik “Tambah petugas”.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nama</th><th>Email</th><th>Status</th><th className="num">Acara</th><th>Dibuat</th><th /></tr></thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td><b>{s.name}</b></td>
                    <td>{s.email}</td>
                    <td><span className={`badge ${s.isActive ? 'ok' : 'muted'}`}>{s.isActive ? 'Aktif' : 'Nonaktif'}</span></td>
                    <td className="num">{s.eventIds.length}</td>
                    <td>{s.createdAt ? dateTime(s.createdAt) : '–'}</td>
                    <td>
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn secondary sm" onClick={() => setForm({ staff: s })}>Ubah</button>
                        {s.isActive
                          ? <button className="btn danger sm" onClick={() => setActive(s, false)}>Nonaktifkan</button>
                          : <button className="btn secondary sm" onClick={() => setActive(s, true)}>Aktifkan</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {form && <StaffFormModal staff={form.staff} onClose={() => setForm(null)} onSaved={reload} />}
    </>
  );
}

function StaffFormModal({ staff, onClose, onSaved }: { staff?: StaffMember; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const editing = Boolean(staff);
  const [name, setName] = useState(staff?.name ?? '');
  const [email, setEmail] = useState(staff?.email ?? '');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) return setError('Nama minimal 2 karakter.');
    // Saat membuat, password wajib; saat mengubah, kosong berarti password tidak diganti.
    const pwErr = !editing || password ? passwordError(password) : null;
    if (pwErr) return setError(pwErr);
    setBusy(true);
    try {
      if (staff) {
        await api(`/admin/staff/${staff.id}`, { method: 'PATCH', body: { name: name.trim(), ...(password ? { password } : {}) } });
        toast.success(`Akun ${name.trim()} diperbarui${password ? ' (password diganti)' : ''}.`);
      } else {
        await api('/admin/staff', { method: 'POST', body: { name: name.trim(), email: email.trim(), password } });
        toast.success(`Akun petugas ${name.trim()} dibuat. Berikan email dan password kepada petugas.`);
      }
      onSaved();
      onClose();
    } catch (err) {
      const m = errMsg(err);
      setError(m);
      toast.error(`Gagal menyimpan: ${m}`);
      setBusy(false);
    }
  }

  return (
    <Modal title={editing ? `Ubah petugas — ${staff!.name}` : 'Tambah petugas gerbang'} onClose={onClose}>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={submit}>
        <Field label="Nama lengkap"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required autoFocus /></Field>
        <Field label="Email" hint={editing ? 'Email tidak dapat diubah.' : 'Dipakai petugas untuk masuk di aplikasi.'}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} disabled={editing} required autoComplete="off" />
        </Field>
        <Field label={editing ? 'Password baru (opsional)' : 'Password'} hint="Minimal 8 karakter, mengandung huruf dan angka.">
          <div className="keybox">
            <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} maxLength={128}
              autoComplete="new-password" required={!editing} aria-label="Password" />
            <button type="button" className="btn secondary" onClick={() => setShow((v) => !v)}>{show ? 'Sembunyikan' : 'Tampilkan'}</button>
            <button type="button" className="btn secondary" onClick={() => { setPassword(generatePassword()); setShow(true); }}>Acak</button>
          </div>
        </Field>
        <div className="row">
          <button className="btn" disabled={busy}>{busy ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Buat akun'}</button>
          <button type="button" className="btn ghost" onClick={onClose}>Batal</button>
        </div>
      </form>
    </Modal>
  );
}
