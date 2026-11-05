import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Card, Field, Spinner } from '../components/ui';
import { api, errMsg } from '../lib/api';
import { fromLocalInput, toLocalInput } from '../lib/format';
import type { EventItem, EventStatus } from '../lib/types';

const CATEGORIES = ['Music', 'Education', 'Exhibition', 'Sports', 'Festival'];

interface FormState {
  title: string; category: string; location: string; description: string;
  startAt: string; endAt: string; posterUrl: string; status: EventStatus; slug: string;
}

function defaults(): FormState {
  const start = new Date(Date.now() + 7 * 24 * 3600_000);
  start.setMinutes(0, 0, 0);
  return {
    title: '', category: 'Music', location: '', description: '',
    startAt: toLocalInput(start), endAt: toLocalInput(new Date(start.getTime() + 6 * 3600_000)),
    posterUrl: '', status: 'DRAFT', slug: '',
  };
}

export default function EventFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const nav = useNavigate();
  const [f, setF] = useState<FormState>(defaults);
  const [loading, setLoading] = useState(editing);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<EventItem>(`/admin/events/${id}`)
      .then((e) => setF({
        title: e.title, category: e.category, location: e.location, description: e.description,
        startAt: toLocalInput(e.startAt), endAt: toLocalInput(e.endAt), posterUrl: e.posterUrl ?? '',
        status: e.status, slug: e.slug,
      }))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [id]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (new Date(f.endAt) <= new Date(f.startAt)) return setError('Waktu selesai harus setelah waktu mulai.');
    setBusy(true);
    const body = {
      title: f.title, category: f.category, location: f.location, description: f.description,
      startAt: fromLocalInput(f.startAt), endAt: fromLocalInput(f.endAt), status: f.status,
      ...(f.slug.trim() ? { slug: f.slug.trim() } : {}),
      ...(editing ? { posterUrl: f.posterUrl.trim() || null } : f.posterUrl.trim() ? { posterUrl: f.posterUrl.trim() } : {}),
    };
    try {
      const saved = await api<EventItem>(editing ? `/admin/events/${id}` : '/admin/events', { method: editing ? 'PATCH' : 'POST', body });
      nav(`/events/${saved.id}`);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{editing ? 'Ubah acara' : 'Tambah acara'}</h1>
          <p>{editing ? 'Perbarui detail acara.' : 'Setelah disimpan, Anda dapat menambah kamera dan lineup.'}</p>
        </div>
      </div>
      <Card>
        {error && <Alert>{error}</Alert>}
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="full"><Field label="Judul acara"><input value={f.title} onChange={(e) => set('title', e.target.value)} minLength={3} maxLength={150} required /></Field></div>
            <Field label="Kategori">
              <input list="cats" value={f.category} onChange={(e) => set('category', e.target.value)} minLength={2} maxLength={50} required />
              <datalist id="cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label="Status" hint="Hanya acara “Terbit” yang tampil di aplikasi pengguna.">
              <select value={f.status} onChange={(e) => set('status', e.target.value as EventStatus)}>
                <option value="DRAFT">Draft</option><option value="PUBLISHED">Terbit</option>
                <option value="FINISHED">Selesai</option><option value="CANCELLED">Dibatalkan</option>
              </select>
            </Field>
            <div className="full"><Field label="Lokasi"><input value={f.location} onChange={(e) => set('location', e.target.value)} minLength={2} maxLength={200} required /></Field></div>
            <Field label="Mulai"><input type="datetime-local" value={f.startAt} onChange={(e) => set('startAt', e.target.value)} required /></Field>
            <Field label="Selesai"><input type="datetime-local" value={f.endAt} onChange={(e) => set('endAt', e.target.value)} required /></Field>
            <div className="full"><Field label="Deskripsi"><textarea value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={5000} required /></Field></div>
            <Field label="URL poster (opsional)"><input type="url" placeholder="https://…" value={f.posterUrl} onChange={(e) => set('posterUrl', e.target.value)} /></Field>
            <Field label="Slug (opsional)" hint="Kosongkan agar dibuat otomatis dari judul."><input value={f.slug} onChange={(e) => set('slug', e.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" title="Huruf kecil, angka, dan tanda hubung" /></Field>
          </div>
          <div className="row">
            <button className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
            <Link className="btn ghost" to={editing ? `/events/${id}` : '/events'}>Batal</Link>
          </div>
        </form>
      </Card>
    </>
  );
}
