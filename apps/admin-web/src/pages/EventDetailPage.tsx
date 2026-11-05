import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { AssignStaffModal } from '../components/AssignStaffModal';
import { Alert, CameraBadge, Card, Empty, EventBadge, Field, Modal, PhaseBadge, Spinner } from '../components/ui';
import { API_BASE, api, errMsg } from '../lib/api';
import { ago, dateTime, fromLocalInput, num, rupiah, timeOnly, toLocalInput } from '../lib/format';
import type { Camera, CameraType, EventItem, Lineup, StaffMember } from '../lib/types';

export default function EventDetailPage() {
  const { id = '' } = useParams();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [e, c, l] = await Promise.all([
        api<EventItem>(`/admin/events/${id}`),
        api<Camera[]>(`/admin/events/${id}/cameras`),
        api<Lineup[]>(`/admin/events/${id}/lineups`),
      ]);
      setEvent(e); setCameras(c); setLineups(l); setError('');
    } catch (e) {
      setError(errMsg(e));
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (!event) return error ? <Alert>{error}</Alert> : <Spinner />;
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="row">{event.title} <EventBadge status={event.status} /></h1>
          <p>{event.location} · {dateTime(event.startAt)} – {dateTime(event.endAt)}</p>
        </div>
        <div className="row">
          <Link className="btn" to={`/dashboard?event=${id}`}>Buka dashboard</Link>
          <Link className="btn secondary" to={`/events/${id}/edit`}>Ubah acara</Link>
          <Link className="btn ghost" to="/events">← Daftar acara</Link>
        </div>
      </div>
      {error && <Alert>{error}</Alert>}
      <div className="grid">
        <StaffCard event={event} />
        <CamerasCard eventId={id} cameras={cameras} reload={load} />
        <LineupCard event={event} lineups={lineups} hasCrowdCamera={cameras.some((c) => c.type === 'CROWD')} reload={load} />
        <TicketsCard event={event} reload={load} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Kamera
const TYPE_LABEL: Record<CameraType, string> = { GATE: 'Kamera Gate', CROWD: 'Kamera Crowd' };
const TYPE_HELP: Record<CameraType, string> = {
  GATE: 'Menghitung orang masuk/keluar di pintu gerbang.',
  CROWD: 'Menghitung kepadatan di area penonton/panggung. Dipakai untuk analisis saat penampil tampil.',
};

function CamerasCard({ eventId, cameras, reload }: { eventId: string; cameras: Camera[]; reload: () => Promise<void> }) {
  const [form, setForm] = useState<{ type: CameraType; camera?: Camera } | null>(null);
  const [key, setKey] = useState<Camera | null>(null);
  const [error, setError] = useState('');

  async function act(fn: () => Promise<unknown>) {
    setError('');
    try { await fn(); await reload(); } catch (e) { setError(errMsg(e)); }
  }

  return (
    <Card icon="camera" title="Kamera monitoring" action={<small>1 kamera gate + 1 kamera crowd per acara</small>}>
      {error && <Alert>{error}</Alert>}
      {(['GATE', 'CROWD'] as CameraType[]).map((type) => {
        const cam = cameras.find((c) => c.type === type);
        return cam ? (
          <div className="cam" key={type}>
            <div>
              <b>{TYPE_LABEL[type]}: {cam.name}</b> <CameraBadge status={cam.status} />
              <div className="meta">
                Terakhir kirim data: {ago(cam.lastSeenAt)}
                {cam.type === 'CROWD' && ` · Kapasitas: ${cam.capacity ? num(cam.capacity) : 'belum diatur'}`}
                {cam.streamUrl && <> · <a href={cam.streamUrl} target="_blank" rel="noreferrer">Stream</a></>}
              </div>
            </div>
            <div className="row">
              <button className="btn secondary sm" onClick={() => setForm({ type, camera: cam })}>Ubah</button>
              <button className="btn secondary sm" onClick={() => act(() => api(`/admin/cameras/${cam.id}`, { method: 'PATCH', body: { isActive: !cam.isActive } }))}>
                {cam.isActive ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
              <button className="btn secondary sm" onClick={async () => {
                if (!window.confirm('Buat ulang API key? Key lama langsung tidak berlaku dan layanan analisis harus diperbarui.')) return;
                try { setKey(await api<Camera>(`/admin/cameras/${cam.id}/rotate-key`, { method: 'POST' })); await reload(); } catch (e) { setError(errMsg(e)); }
              }}>API key baru</button>
              <button className="btn danger sm" onClick={() => {
                if (window.confirm(`Hapus ${TYPE_LABEL[type]} beserta seluruh data hitungnya?`)) void act(() => api(`/admin/cameras/${cam.id}`, { method: 'DELETE' }));
              }}>Hapus</button>
            </div>
          </div>
        ) : (
          <div className="cam" key={type}>
            <div><b>{TYPE_LABEL[type]}</b> <span className="badge muted">Belum ada</span><div className="meta">{TYPE_HELP[type]}</div></div>
            <button className="btn sm" onClick={() => setForm({ type })}>+ Tambah</button>
          </div>
        );
      })}
      {form && (
        <CameraForm eventId={eventId} type={form.type} camera={form.camera} onClose={() => setForm(null)}
          onSaved={async (created) => { setForm(null); if (created) setKey(created); await reload(); }} />
      )}
      {key?.apiKey && <KeyModal camera={key} onClose={() => setKey(null)} />}
    </Card>
  );
}

function CameraForm({ eventId, type, camera, onClose, onSaved }: {
  eventId: string; type: CameraType; camera?: Camera; onClose: () => void; onSaved: (created?: Camera) => Promise<void>;
}) {
  const [name, setName] = useState(camera?.name ?? TYPE_LABEL[type]);
  const [streamUrl, setStreamUrl] = useState(camera?.streamUrl ?? '');
  const [capacity, setCapacity] = useState(camera?.capacity?.toString() ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (camera) {
        await api(`/admin/cameras/${camera.id}`, { method: 'PATCH', body: { name, streamUrl: streamUrl.trim() || undefined, ...(type === 'CROWD' && capacity ? { capacity: Number(capacity) } : {}) } });
        await onSaved();
      } else {
        const created = await api<Camera>(`/admin/events/${eventId}/cameras`, {
          method: 'POST',
          body: { type, name, ...(streamUrl.trim() ? { streamUrl: streamUrl.trim() } : {}), ...(type === 'CROWD' && capacity ? { capacity: Number(capacity) } : {}) },
        });
        await onSaved(created);
      }
    } catch (err) { setError(errMsg(err)); setBusy(false); }
  }

  return (
    <Modal title={`${camera ? 'Ubah' : 'Tambah'} ${TYPE_LABEL[type]}`} onClose={onClose}>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={submit}>
        <Field label="Nama kamera"><input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={100} required autoFocus /></Field>
        <Field label="URL stream (opsional)" hint="rtsp://, http:// atau https://. Hanya sebagai referensi; video tidak diproses di web ini."><input value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="rtsp://192.168.1.20/stream" /></Field>
        {type === 'CROWD' && (
          <Field label="Kapasitas aman area (orang)" hint="Dipakai menghitung persentase okupansi dan level kepadatan."><input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} /></Field>
        )}
        <div className="row"><button className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button><button type="button" className="btn ghost" onClick={onClose}>Batal</button></div>
      </form>
    </Modal>
  );
}

function KeyModal({ camera, onClose }: { camera: Camera; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const key = camera.apiKey ?? '';
  const sample = camera.type === 'CROWD'
    ? `{"peopleCount": 842}`
    : `{"inCount": 12, "outCount": 3}`;
  return (
    <Modal title="API key kamera" onClose={onClose}>
      <Alert tone="warn">Simpan key ini sekarang. Demi keamanan, key tidak akan ditampilkan lagi.</Alert>
      <div className="keybox">
        <input readOnly value={key} onFocus={(e) => e.currentTarget.select()} aria-label="API key" />
        <button className="btn secondary" onClick={async () => { await navigator.clipboard.writeText(key); setCopied(true); }}>{copied ? 'Tersalin ✓' : 'Salin'}</button>
      </div>
      <p>Layanan analisis kamera mengirim hasil hitung ke:</p>
      <pre>{`curl -X POST ${API_BASE}/crowd/ingest \\
  -H "x-camera-key: ${key}" \\
  -H "Content-Type: application/json" \\
  -d '${sample}'`}</pre>
      <button className="btn" onClick={onClose}>Selesai</button>
    </Modal>
  );
}

// ---------------------------------------------------------------- Lineup
function LineupCard({ event, lineups, hasCrowdCamera, reload }: { event: EventItem; lineups: Lineup[]; hasCrowdCamera: boolean; reload: () => Promise<void> }) {
  const [form, setForm] = useState<{ lineup?: Lineup } | null>(null);
  const [error, setError] = useState('');

  async function remove(l: Lineup) {
    if (!window.confirm(`Hapus ${l.artistName} dari lineup?`)) return;
    try { await api(`/admin/lineups/${l.id}`, { method: 'DELETE' }); await reload(); } catch (e) { setError(errMsg(e)); }
  }

  return (
    <Card icon="mic" title="Lineup penampil" action={<button className="btn sm" onClick={() => setForm({})}>+ Tambah lineup</button>}>
      {!hasCrowdCamera && <Alert tone="warn">Belum ada kamera crowd. Lineup tetap tersimpan, tetapi analisis kerumunan per penampil baru berjalan setelah kamera crowd ditambahkan dan mengirim data.</Alert>}
      {error && <Alert>{error}</Alert>}
      {lineups.length === 0 ? <Empty>Belum ada lineup.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Penampil</th><th>Jadwal</th><th>Status</th><th>Catatan</th><th /></tr></thead>
            <tbody>
              {lineups.map((l) => (
                <tr key={l.id}>
                  <td><b>{l.isGuestStar && <Icon name="star" size={14} className="star" />}{l.artistName}</b>{l.isGuestStar && <><br /><small>Guest star</small></>}</td>
                  <td>{timeOnly(l.startAt)} – {timeOnly(l.endAt)}<br /><small>{new Date(l.startAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</small></td>
                  <td><PhaseBadge phase={l.phase} /></td>
                  <td>{l.notes ?? '–'}</td>
                  <td><div className="row" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn secondary sm" onClick={() => setForm({ lineup: l })}>Ubah</button>
                    <button className="btn danger sm" onClick={() => remove(l)}>Hapus</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <small>Jadwal tidak boleh bertabrakan karena satu kamera crowd memantau satu panggung.</small>
      {form && <LineupForm event={event} lineups={lineups} lineup={form.lineup} onClose={() => setForm(null)} onSaved={async () => { setForm(null); await reload(); }} />}
    </Card>
  );
}

function LineupForm({ event, lineups, lineup, onClose, onSaved }: {
  event: EventItem; lineups: Lineup[]; lineup?: Lineup; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const initial = () => {
    if (lineup) return { start: toLocalInput(lineup.startAt), end: toLocalInput(lineup.endAt) };
    const lastEnd = lineups.reduce((m, l) => Math.max(m, Date.parse(l.endAt)), Date.parse(event.startAt));
    const start = new Date(lastEnd + (lineups.length ? 5 * 60_000 : 0));
    const end = new Date(Math.min(start.getTime() + 60 * 60_000, Date.parse(event.endAt)));
    return { start: toLocalInput(start), end: toLocalInput(end) };
  };
  const [artistName, setArtist] = useState(lineup?.artistName ?? '');
  const [isGuestStar, setGuest] = useState(lineup?.isGuestStar ?? false);
  const [start, setStart] = useState(initial().start);
  const [end, setEnd] = useState(initial().end);
  const [notes, setNotes] = useState(lineup?.notes ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (new Date(end) <= new Date(start)) return setError('Waktu selesai harus setelah waktu mulai.');
    setBusy(true);
    const body = { artistName, isGuestStar, startAt: fromLocalInput(start), endAt: fromLocalInput(end), ...(notes.trim() || lineup ? { notes: notes.trim() } : {}) };
    try {
      await api(lineup ? `/admin/lineups/${lineup.id}` : `/admin/events/${event.id}/lineups`, { method: lineup ? 'PATCH' : 'POST', body });
      await onSaved();
    } catch (err) { setError(errMsg(err)); setBusy(false); }
  }

  return (
    <Modal title={lineup ? 'Ubah lineup' : 'Tambah lineup'} onClose={onClose}>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={submit}>
        <Field label="Nama penampil"><input value={artistName} onChange={(e) => setArtist(e.target.value)} minLength={2} maxLength={120} required autoFocus /></Field>
        <label className="check"><input type="checkbox" checked={isGuestStar} onChange={(e) => setGuest(e.target.checked)} /> <Icon name="star" size={14} className="star" /> Guest star</label>
        <div className="form-grid">
          <Field label="Mulai tampil"><input type="datetime-local" value={start} min={toLocalInput(event.startAt)} max={toLocalInput(event.endAt)} onChange={(e) => setStart(e.target.value)} required /></Field>
          <Field label="Selesai tampil"><input type="datetime-local" value={end} min={toLocalInput(event.startAt)} max={toLocalInput(event.endAt)} onChange={(e) => setEnd(e.target.value)} required /></Field>
        </div>
        <small style={{ display: 'block', marginBottom: 12 }}>Harus dalam waktu acara: {dateTime(event.startAt)} – {dateTime(event.endAt)}.</small>
        <Field label="Catatan (opsional)"><input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></Field>
        <div className="row"><button className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button><button type="button" className="btn ghost" onClick={onClose}>Batal</button></div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- Kategori tiket
function TicketsCard({ event, reload }: { event: EventItem; reload: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quota, setQuota] = useState('');
  const [error, setError] = useState('');

  async function add(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api(`/admin/events/${event.id}/ticket-categories`, { method: 'POST', body: { name, price: Number(price), quota: Number(quota) } });
      setName(''); setPrice(''); setQuota('');
      await reload();
    } catch (err) { setError(errMsg(err)); }
  }

  async function remove(id: string, label: string) {
    if (!window.confirm(`Hapus kategori tiket "${label}"?`)) return;
    try { await api(`/admin/ticket-categories/${id}`, { method: 'DELETE' }); await reload(); } catch (err) { setError(errMsg(err)); }
  }

  return (
    <Card icon="ticket" title="Kategori tiket">
      {error && <Alert>{error}</Alert>}
      {event.ticketCategories.length === 0 ? <Empty>Belum ada kategori tiket.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Kategori</th><th className="num">Harga</th><th className="num">Kuota</th><th className="num">Terjual</th><th /></tr></thead>
            <tbody>
              {event.ticketCategories.map((c) => (
                <tr key={c.id}>
                  <td><b>{c.name}</b></td><td className="num">{rupiah(c.price)}</td><td className="num">{num(c.quota)}</td>
                  <td className="num">{num(c.soldCount ?? 0)}</td>
                  <td style={{ textAlign: 'right' }}><button className="btn danger sm" onClick={() => remove(c.id, c.name)}>Hapus</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form onSubmit={add} className="row" style={{ marginTop: 14, alignItems: 'flex-end' }}>
        <Field label="Nama"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required /></Field>
        <Field label="Harga (Rp)"><input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} required /></Field>
        <Field label="Kuota"><input type="number" min={1} value={quota} onChange={(e) => setQuota(e.target.value)} required /></Field>
        <button className="btn secondary" style={{ marginBottom: 12 }}>+ Tambah kategori</button>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------- Petugas gerbang
function StaffCard({ event }: { event: EventItem }) {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    api<StaffMember[]>('/admin/staff').then((s) => { setStaff(s); setError(''); }).catch((e) => setError(errMsg(e)));
  }, []);
  useEffect(load, [load]);

  const assigned = (staff ?? []).filter((s) => s.eventIds.includes(event.id));
  return (
    <Card icon="shield" title="Petugas gerbang" action={<button className="btn sm" onClick={() => setOpen(true)}>Atur petugas</button>}>
      {error && <Alert>{error}</Alert>}
      {!staff && !error ? <Spinner /> : assigned.length === 0 ? (
        <Empty>Belum ada petugas yang ditugaskan. Acara ini belum muncul di aplikasi petugas.</Empty>
      ) : (
        <div className="chips">{assigned.map((s) => <span className="chip" key={s.id}>{s.name} · {s.email}</span>)}</div>
      )}
      {event.status !== 'PUBLISHED' && <small>Acara berstatus bukan “Terbit”, sehingga tidak tampil di aplikasi petugas walaupun sudah ditugaskan.</small>}
      {open && <AssignStaffModal event={event} onClose={() => setOpen(false)} onSaved={load} />}
    </Card>
  );
}
