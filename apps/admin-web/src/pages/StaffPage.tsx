import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AssignStaffModal } from '../components/AssignStaffModal';
import { Alert, Card, Empty, EventBadge, Spinner } from '../components/ui';
import { api, errMsg } from '../lib/api';
import { dateTime } from '../lib/format';
import type { EventItem, Paged, StaffMember } from '../lib/types';

export default function StaffPage() {
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<EventItem | null>(null);

  const load = useCallback(async () => {
    try {
      const [e, s] = await Promise.all([api<Paged<EventItem>>('/admin/events?limit=100'), api<StaffMember[]>('/admin/staff')]);
      setEvents(e.items);
      setStaff(s);
      setError('');
    } catch (err) {
      setError(errMsg(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const assignedTo = (eventId: string) => (staff ?? []).filter((s) => s.eventIds.includes(eventId));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Penugasan Petugas Gerbang</h1>
          <p>Petugas hanya melihat acara <b>Terbit</b> yang ditugaskan kepadanya di aplikasi.</p>
        </div>
        <Link className="btn secondary" to="/staff/accounts">Kelola akun petugas</Link>
      </div>
      {error && <Alert>{error}</Alert>}
      <Card>
        {!events || !staff ? (error ? null : <Spinner />) : events.length === 0 ? <Empty>Belum ada acara.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Acara</th><th>Status</th><th>Petugas ditugaskan</th><th /></tr></thead>
              <tbody>
                {events.map((e) => {
                  const list = assignedTo(e.id);
                  return (
                    <tr key={e.id}>
                      <td><b>{e.title}</b><br /><small>{dateTime(e.startAt)}</small></td>
                      <td>
                        <EventBadge status={e.status} />
                        {e.status !== 'PUBLISHED' && list.length > 0 && <><br /><small>belum tampil di aplikasi</small></>}
                      </td>
                      <td>
                        {list.length === 0 ? <small>Belum ada petugas</small> : (
                          <div className="chips">{list.map((s) => <span className="chip" key={s.id}>{s.name}</span>)}</div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn secondary sm" onClick={() => setEditing(e)}>Atur petugas ({list.length})</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {staff && staff.length === 0 && <Alert tone="warn">Belum ada akun petugas. <Link to="/staff/accounts">Buat akun petugas</Link> terlebih dahulu.</Alert>}
      </Card>
      {editing && <AssignStaffModal event={editing} onClose={() => setEditing(null)} onSaved={() => void load()} />}
    </>
  );
}
