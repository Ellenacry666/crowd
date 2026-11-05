import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { adminApi } from '../../api/endpoints';
import type { EventItem, EventStatus, Staff } from '../../api/types';
import {
  Alert,
  AsyncView,
  Button,
  Card,
  Field,
  inputClass,
  PageHeader,
} from '../../components/ui';
import { formatRupiah, fromDateTimeLocal, toDateTimeLocal } from '../../utils/format';
import { useAsync } from '../../utils/hooks';
import { CATEGORY_SUGGESTIONS } from '../Events';

interface FormState {
  title: string;
  slug: string;
  category: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  posterUrl: string;
  status: EventStatus;
}

const emptyForm: FormState = {
  title: '',
  slug: '',
  category: '',
  description: '',
  location: '',
  startAt: '',
  endAt: '',
  posterUrl: '',
  status: 'DRAFT',
};

function fromEvent(e: EventItem): FormState {
  return {
    title: e.title,
    slug: e.slug,
    category: e.category,
    description: e.description,
    location: e.location,
    startAt: toDateTimeLocal(e.startAt),
    endAt: toDateTimeLocal(e.endAt),
    posterUrl: e.posterUrl ?? '',
    status: e.status,
  };
}

// ---------------------------------------------------------------- Kategori tiket
function CategoriesPanel({ event, onChanged }: { event: EventItem; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', price: '', quota: '' });
  const [neu, setNeu] = useState({ name: '', price: '', quota: '' });
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
      return true;
    } catch (e) {
      setError(getErrorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const toBody = (v: { name: string; price: string; quota: string }) => ({
    name: v.name.trim(),
    price: Number(v.price),
    quota: Number(v.quota),
  });
  const valid = (v: { name: string; price: string; quota: string }) =>
    v.name.trim() !== '' &&
    Number.isInteger(Number(v.price)) && Number(v.price) >= 0 && v.price !== '' &&
    Number.isInteger(Number(v.quota)) && Number(v.quota) >= 1 && v.quota !== '';

  return (
    <Card>
      <h2 className="text-lg font-bold">Kategori tiket dan kuota</h2>
      <p className="mb-4 text-sm text-slate-500">
        Harga dalam Rupiah. Kuota tidak boleh lebih kecil dari jumlah terjual + dicadangkan.
      </p>
      {error && (
        <div className="mb-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-400">
              <th className="py-2 pr-3">Nama</th>
              <th className="py-2 pr-3">Harga</th>
              <th className="py-2 pr-3">Kuota</th>
              <th className="py-2 pr-3">Terjual</th>
              <th className="py-2 pr-3">Dicadangkan</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {event.ticketCategories.map((c) =>
              editingId === c.id ? (
                <tr key={c.id}>
                  <td className="py-2 pr-3">
                    <input className={inputClass} aria-label="Nama kategori" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  </td>
                  <td className="py-2 pr-3">
                    <input className={inputClass} type="number" min={0} aria-label="Harga" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
                  </td>
                  <td className="py-2 pr-3">
                    <input className={inputClass} type="number" min={1} aria-label="Kuota" value={draft.quota} onChange={(e) => setDraft({ ...draft, quota: e.target.value })} />
                  </td>
                  <td className="py-2 pr-3">{c.soldCount ?? 0}</td>
                  <td className="py-2 pr-3">{c.reservedCount ?? 0}</td>
                  <td className="whitespace-nowrap py-2 text-right">
                    <Button
                      className="mr-2"
                      loading={busy}
                      disabled={!valid(draft)}
                      onClick={async () => {
                        if (await run(() => adminApi.updateCategory(c.id, toBody(draft)))) setEditingId(null);
                      }}
                    >
                      Simpan
                    </Button>
                    <Button variant="ghost" onClick={() => setEditingId(null)}>
                      Batal
                    </Button>
                  </td>
                </tr>
              ) : (
                <tr key={c.id}>
                  <td className="py-3 pr-3 font-medium">{c.name}</td>
                  <td className="py-3 pr-3">{formatRupiah(c.price)}</td>
                  <td className="py-3 pr-3">{c.quota}</td>
                  <td className="py-3 pr-3">{c.soldCount ?? 0}</td>
                  <td className="py-3 pr-3">{c.reservedCount ?? 0}</td>
                  <td className="whitespace-nowrap py-3 text-right">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditingId(c.id);
                        setDraft({ name: c.name, price: String(c.price), quota: String(c.quota) });
                      }}
                    >
                      Ubah
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-red-600"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Hapus kategori "${c.name}"?`)) run(() => adminApi.deleteCategory(c.id));
                      }}
                    >
                      Hapus
                    </Button>
                  </td>
                </tr>
              ),
            )}
            {event.ticketCategories.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-400">
                  Belum ada kategori tiket.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form
        className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4"
        onSubmit={async (e: FormEvent) => {
          e.preventDefault();
          if (!valid(neu)) return;
          if (await run(() => adminApi.createCategory(event.id, toBody(neu)))) {
            setNeu({ name: '', price: '', quota: '' });
          }
        }}
      >
        <input className={inputClass} placeholder="Nama (mis. VIP)" aria-label="Nama kategori baru" value={neu.name} onChange={(e) => setNeu({ ...neu, name: e.target.value })} />
        <input className={inputClass} type="number" min={0} placeholder="Harga (Rp)" aria-label="Harga baru" value={neu.price} onChange={(e) => setNeu({ ...neu, price: e.target.value })} />
        <input className={inputClass} type="number" min={1} placeholder="Kuota" aria-label="Kuota baru" value={neu.quota} onChange={(e) => setNeu({ ...neu, quota: e.target.value })} />
        <Button type="submit" loading={busy} disabled={!valid(neu)}>
          Tambah kategori
        </Button>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------- Penugasan petugas
function StaffPanel({ eventId }: { eventId: string }) {
  const { data: staff, loading, error, reload } = useAsync(() => adminApi.staff(), []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (staff) setSelected(new Set(staff.filter((s: Staff) => s.eventIds.includes(eventId)).map((s) => s.id)));
  }, [staff, eventId]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await adminApi.assignStaff(eventId, Array.from(selected));
      setMessage({ tone: 'success', text: 'Penugasan petugas disimpan.' });
      reload();
    } catch (e) {
      setMessage({ tone: 'error', text: getErrorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <h2 className="text-lg font-bold">Petugas gerbang</h2>
      <p className="mb-4 text-sm text-slate-500">
        Hanya petugas yang dicentang yang dapat melakukan check-in untuk acara ini.
      </p>
      <AsyncView loading={loading && !staff} error={error} onRetry={reload}>
        {staff && staff.length > 0 ? (
          <ul className="space-y-2">
            {staff.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                  />
                  <span className="text-sm">
                    <span className="font-medium">{s.name}</span>{' '}
                    <span className="text-slate-500">({s.email})</span>
                    {!s.isActive && <span className="ml-2 text-xs font-semibold text-red-600">nonaktif</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            Belum ada akun petugas.{' '}
            <Link to="/admin/staff" className="font-semibold text-indigo-600 hover:underline">
              Buat akun petugas
            </Link>
          </p>
        )}
      </AsyncView>
      {message && (
        <div className="mt-3">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}
      {staff && staff.length > 0 && (
        <Button className="mt-4" loading={saving} onClick={save}>
          Simpan penugasan
        </Button>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- Halaman
export default function AdminEventForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const { data: event, loading, error, reload } = useAsync(
    async () => (id ? adminApi.event(id) : null),
    [id],
  );

  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (event) setForm(fromEvent(event));
  }, [event]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaved(false);

    if (!form.startAt || !form.endAt) {
      setSaveError('Waktu mulai dan selesai wajib diisi.');
      return;
    }
    const startIso = fromDateTimeLocal(form.startAt);
    const endIso = fromDateTimeLocal(form.endAt);
    if (new Date(endIso) <= new Date(startIso)) {
      setSaveError('Waktu selesai harus setelah waktu mulai.');
      return;
    }

    const payload = {
      title: form.title.trim(),
      category: form.category.trim(),
      description: form.description,
      location: form.location.trim(),
      startAt: startIso,
      endAt: endIso,
      status: form.status,
      ...(form.posterUrl.trim() ? { posterUrl: form.posterUrl.trim() } : {}),
      ...(isNew && form.slug.trim() ? { slug: form.slug.trim() } : {}),
    };

    setSaving(true);
    try {
      if (isNew) {
        const created = await adminApi.createEvent(payload);
        navigate(`/admin/events/${created.id}`, { replace: true });
      } else {
        await adminApi.updateEvent(id!, payload);
        setSaved(true);
        reload();
      }
    } catch (err) {
      setSaveError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={isNew ? 'Buat acara' : 'Kelola acara'}
        subtitle={isNew ? 'Setelah disimpan, Anda dapat menambah kategori tiket.' : event?.title}
        actions={
          <Link to="/admin/events" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50">
            Kembali
          </Link>
        }
      />

      <AsyncView loading={loading && !event && !isNew} error={error} onRetry={reload}>
        <Card>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2" noValidate>
            <div className="md:col-span-2">
              <Field label="Judul acara">
                <input required className={inputClass} value={form.title} onChange={(e) => set('title', e.target.value)} />
              </Field>
            </div>

            <Field label="Kategori acara" hint="Contoh: Music, Education, Exhibition">
              <input list="admin-category-suggestions" required className={inputClass} value={form.category} onChange={(e) => set('category', e.target.value)} />
              <datalist id="admin-category-suggestions">
                {CATEGORY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>

            <Field label="Status" hint="Hanya acara berstatus Terbit yang tampil di website.">
              <select className={inputClass} value={form.status} onChange={(e) => set('status', e.target.value as EventStatus)}>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Terbit</option>
                <option value="CANCELLED">Dibatalkan</option>
                <option value="FINISHED">Selesai</option>
              </select>
            </Field>

            <Field label="Lokasi">
              <input required className={inputClass} value={form.location} onChange={(e) => set('location', e.target.value)} />
            </Field>

            <Field label="URL poster (opsional)" hint="Alamat gambar yang diawali https://">
              <input type="url" className={inputClass} value={form.posterUrl} onChange={(e) => set('posterUrl', e.target.value)} />
            </Field>

            <Field label="Mulai">
              <input type="datetime-local" required className={inputClass} value={form.startAt} onChange={(e) => set('startAt', e.target.value)} />
            </Field>
            <Field label="Selesai">
              <input type="datetime-local" required className={inputClass} value={form.endAt} onChange={(e) => set('endAt', e.target.value)} />
            </Field>

            {isNew && (
              <div className="md:col-span-2">
                <Field label="Slug (opsional)" hint="Dibuat otomatis dari judul bila dikosongkan. Huruf kecil, angka, dan tanda hubung.">
                  <input className={inputClass} value={form.slug} onChange={(e) => set('slug', e.target.value)} />
                </Field>
              </div>
            )}

            <div className="md:col-span-2">
              <Field label="Deskripsi">
                <textarea required rows={5} className={inputClass} value={form.description} onChange={(e) => set('description', e.target.value)} />
              </Field>
            </div>

            <div className="space-y-3 md:col-span-2">
              {saveError && <Alert tone="error">{saveError}</Alert>}
              {saved && <Alert tone="success">Perubahan disimpan.</Alert>}
              <Button type="submit" loading={saving}>
                {isNew ? 'Buat acara' : 'Simpan perubahan'}
              </Button>
            </div>
          </form>
        </Card>

        {!isNew && event && (
          <>
            <CategoriesPanel event={event} onChanged={reload} />
            <StaffPanel eventId={event.id} />
          </>
        )}
      </AsyncView>
    </div>
  );
}
