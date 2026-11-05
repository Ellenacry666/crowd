import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errMsg } from '../lib/api';
import type { EventStatus, StaffMember } from '../lib/types';
import { Alert, Modal, Spinner } from './ui';
import { useToast } from './toast';

interface Props {
  event: { id: string; title: string; status: EventStatus };
  onClose: () => void;
  onSaved: () => void;
}

/**
 * PUT /admin/events/:id/staff MENGGANTI seluruh daftar penugasan acara.
 * Karena itu modal selalu memuat daftar terbaru dari server saat dibuka dan mengirim SELURUH id yang
 * dipilih (yang tetap + yang baru), bukan hanya perubahannya.
 */
export function AssignStaffModal({ event, onClose, onSaved }: Props) {
  const toast = useToast();
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [initial, setInitial] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<StaffMember[]>('/admin/staff')
      .then((list) => {
        const current = new Set(list.filter((s) => s.eventIds.includes(event.id)).map((s) => s.id));
        setStaff(list);
        setInitial(current);
        setSelected(new Set(current));
      })
      .catch((e) => setError(errMsg(e)));
  }, [event.id]);

  const { added, removed } = useMemo(() => ({
    added: [...selected].filter((id) => !initial.has(id)).length,
    removed: [...initial].filter((id) => !selected.has(id)).length,
  }), [selected, initial]);

  const toggle = (id: string) =>
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api(`/admin/events/${event.id}/staff`, { method: 'PUT', body: { staffIds: [...selected] } });
      toast.success(`Penugasan “${event.title}” disimpan (${selected.size} petugas).`);
      onSaved();
      onClose();
    } catch (e) {
      const m = errMsg(e);
      setError(m);
      toast.error(`Gagal menyimpan penugasan: ${m}`);
      setBusy(false);
    }
  }

  return (
    <Modal title={`Petugas gerbang — ${event.title}`} onClose={onClose}>
      {event.status !== 'PUBLISHED' && (
        <Alert tone="warn">
          Acara ini berstatus <b>{event.status === 'DRAFT' ? 'Draft' : event.status === 'FINISHED' ? 'Selesai' : 'Dibatalkan'}</b>.
          Penugasan tetap tersimpan, tetapi acara baru muncul di aplikasi petugas setelah berstatus <b>Terbit</b>.
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}
      {!staff && !error && <Spinner />}
      {staff && staff.length === 0 && <p>Belum ada akun petugas. <Link to="/staff/accounts">Buat akun petugas</Link> terlebih dahulu.</p>}
      {staff && staff.length > 0 && (
        <>
          <p style={{ margin: '0 0 10px' }}>Pilih petugas yang boleh memindai tiket acara ini.</p>
          {staff.map((s) => {
            const on = selected.has(s.id);
            const lockedOut = !s.isActive && !on; // akun nonaktif tidak bisa baru ditugaskan, tetapi tetap bisa dilepas
            return (
              <label key={s.id} className={`pick ${on ? 'on' : ''} ${lockedOut ? 'disabled' : ''}`}>
                <input type="checkbox" checked={on} disabled={lockedOut || busy} onChange={() => toggle(s.id)} />
                <span>
                  <b>{s.name}</b> {!s.isActive && <span className="badge muted">Nonaktif</span>}
                  <br /><small>{s.email} · bertugas di {s.eventIds.length} acara</small>
                </span>
              </label>
            );
          })}
          <p style={{ margin: '8px 0 14px' }}>
            <small>Terpilih: {selected.size} · ditambahkan: {added} · dilepas: {removed}</small>
          </p>
          <div className="row">
            <button className="btn" onClick={save} disabled={busy || (added === 0 && removed === 0)}>{busy ? 'Menyimpan…' : 'Simpan penugasan'}</button>
            <button className="btn ghost" onClick={onClose}>Batal</button>
          </div>
        </>
      )}
    </Modal>
  );
}
