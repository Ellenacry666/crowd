import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Card, Empty, EventBadge, Spinner } from '../components/ui';
import { api, errMsg } from '../lib/api';
import { dateTime } from '../lib/format';
import type { EventItem, EventStatus, Paged } from '../lib/types';

export default function EventsPage() {
  const [items, setItems] = useState<EventItem[] | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | EventStatus>('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const q = new URLSearchParams({ limit: '100' });
    if (search.trim()) q.set('search', search.trim());
    if (status) q.set('status', status);
    api<Paged<EventItem>>(`/admin/events?${q}`)
      .then((r) => { setItems(r.items); setError(''); })
      .catch((e) => setError(errMsg(e)));
  }, [search, status]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce pencarian
    return () => clearTimeout(t);
  }, [load]);

  async function remove(e: EventItem) {
    if (!window.confirm(`Hapus acara "${e.title}" beserta kamera, data crowd, dan lineup-nya? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await api(`/admin/events/${e.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Acara &amp; Lineup</h1>
          <p>Buat acara, lalu atur kamera monitoring dan jadwal penampil.</p>
        </div>
        <Link className="btn" to="/events/new">+ Tambah acara</Link>
      </div>
      {error && <Alert>{error}</Alert>}
      <Card>
        <div className="row" style={{ marginBottom: 12 }}>
          <input placeholder="Cari judul acara…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 280 }} aria-label="Cari acara" />
          <select value={status} onChange={(e) => setStatus(e.target.value as '' | EventStatus)} style={{ width: 160 }} aria-label="Filter status">
            <option value="">Semua status</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Terbit</option>
            <option value="FINISHED">Selesai</option>
            <option value="CANCELLED">Dibatalkan</option>
          </select>
        </div>
        {!items ? <Spinner /> : items.length === 0 ? <Empty>Tidak ada acara.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Acara</th><th>Waktu</th><th>Lokasi</th><th>Status</th><th /></tr></thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id}>
                    <td><Link to={`/events/${e.id}`}><b>{e.title}</b></Link><br /><small>{e.category}</small></td>
                    <td>{dateTime(e.startAt)}</td>
                    <td>{e.location}</td>
                    <td><EventBadge status={e.status} /></td>
                    <td>
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <Link className="btn secondary sm" to={`/dashboard?event=${e.id}`}>Dashboard</Link>
                        <Link className="btn secondary sm" to={`/events/${e.id}`}>Kelola</Link>
                        <Link className="btn ghost sm" to={`/events/${e.id}/edit`}>Ubah</Link>
                        <button className="btn danger sm" onClick={() => remove(e)}>Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
