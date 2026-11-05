import { FormEvent, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { useToast } from '../components/toast';
import { Alert, Card, Empty, Field, GradCard, Modal, Spinner } from '../components/ui';
import { api, errMsg } from '../lib/api';
import { downloadCsv } from '../lib/csv';
import { dateTime, num, rupiah } from '../lib/format';
import { useFetch } from '../lib/useFetch';
import type { EventItem, OrderRow, OrderStatus, Paged, ReportSummary, SalesRow } from '../lib/types';

const ORDER_STATUS: Record<OrderStatus, [string, string]> = {
  PAID: ['Dibayar', 'ok'],
  PENDING: ['Menunggu', 'warn'],
  FAILED: ['Gagal', 'bad'],
  EXPIRED: ['Kedaluwarsa', 'muted'],
  CANCELLED: ['Dibatalkan', 'muted'],
};
const PAGE_SIZE = 10;

export default function SalesPage() {
  const toast = useToast();
  const [eventId, setEventId] = useState('');
  const [modal, setModal] = useState<{ row?: SalesRow } | null>(null);
  const events = useFetch<Paged<EventItem>>('/admin/events?limit=100');
  const sales = useFetch<SalesRow[]>(`/admin/reports/sales${eventId ? `?eventId=${eventId}` : ''}`);

  const rows = useMemo(
    () => [...(sales.data ?? [])].sort((a, b) => a.eventTitle.localeCompare(b.eventTitle, 'id')),
    [sales.data],
  );
  const t = useMemo(() => {
    const sum = (f: (r: SalesRow) => number) => rows.reduce((a, r) => a + f(r), 0);
    const quota = sum((r) => r.quota);
    const sold = sum((r) => r.soldCount);
    return {
      revenue: sum((r) => r.simulatedRevenue), quota, sold,
      reserved: sum((r) => r.reservedCount), available: sum((r) => r.available),
      pct: quota > 0 ? Math.round((sold / quota) * 1000) / 10 : 0,
    };
  }, [rows]);

  async function remove(r: SalesRow) {
    if (!window.confirm(`Hapus kategori “${r.name}” (${r.eventTitle})?`)) return;
    try {
      await api(`/admin/ticket-categories/${r.ticketCategoryId}`, { method: 'DELETE' });
      toast.success(`Kategori “${r.name}” dihapus.`);
      sales.reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  function exportCsv() {
    downloadCsv(`penjualan-tiket-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Acara', 'Kategori', 'Harga (Rp)', 'Kuota', 'Terjual', 'Tertahan', 'Tersedia', 'Pendapatan simulasi (Rp)'],
      ...rows.map((r) => [r.eventTitle, r.name, r.price, r.quota, r.soldCount, r.reservedCount, r.available, r.simulatedRevenue]),
    ]);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Penjualan Tiket</h1>
          <p>Hasil penjualan per kategori, kelola harga dan kuota, serta daftar order pembeli.</p>
        </div>
        <div className="row">
          <select aria-label="Filter acara" value={eventId} onChange={(e) => setEventId(e.target.value)} style={{ width: 260 }}>
            <option value="">Semua acara</option>
            {events.data?.items.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </div>
      </div>

      {sales.error && <Alert>Gagal memuat data penjualan: {sales.error}</Alert>}
      <div className="kpis">
        <GradCard tone="pink" icon="wallet" label="Pendapatan (simulasi)" value={rupiah(t.revenue)} foot="Dari order berstatus dibayar" />
        <GradCard tone="blue" icon="ticket" label="Tiket Terjual" value={num(t.sold)} foot={`${t.pct}% dari kuota ${num(t.quota)}`} />
        <GradCard tone="teal" icon="check" label="Tiket Tersedia" value={num(t.available)} foot={`${num(t.reserved)} tertahan order menunggu`} />
      </div>

      <Card icon="ticket" title="Penjualan per kategori"
        action={
          <div className="row">
            <button className="btn secondary sm" onClick={exportCsv} disabled={rows.length === 0}><Icon name="download" size={14} /> Unduh CSV</button>
            <button className="btn sm" onClick={() => setModal({})}><Icon name="plus" size={14} /> Tambah kategori</button>
          </div>
        }>
        {!sales.data ? (sales.error ? null : <Spinner />) : rows.length === 0 ? <Empty>Belum ada kategori tiket{eventId ? ' pada acara ini' : ''}.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Acara</th><th>Kategori</th><th className="num">Harga</th><th className="num">Kuota</th><th className="num">Terjual</th>
                  <th className="num">Tertahan</th><th className="num">Tersedia</th><th>Terjual</th><th className="num">Pendapatan</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const pct = r.quota > 0 ? Math.round((r.soldCount / r.quota) * 100) : 0;
                  return (
                    <tr key={r.ticketCategoryId}>
                      <td>{r.eventTitle}</td>
                      <td><b>{r.name}</b></td>
                      <td className="num">{rupiah(r.price)}</td>
                      <td className="num">{num(r.quota)}</td>
                      <td className="num">{num(r.soldCount)}</td>
                      <td className="num">{num(r.reservedCount)}</td>
                      <td className="num">{num(r.available)}</td>
                      <td style={{ width: 120 }}><div className="bar" title={`${pct}%`}><i style={{ width: `${Math.min(100, pct)}%` }} /></div><small>{pct}%</small></td>
                      <td className="num">{rupiah(r.simulatedRevenue)}</td>
                      <td>
                        <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                          <button className="btn secondary sm" onClick={() => setModal({ row: r })}>Ubah</button>
                          <button className="btn danger sm" onClick={() => remove(r)}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}><b>Total</b></td>
                  <td className="num"><b>{num(t.quota)}</b></td><td className="num"><b>{num(t.sold)}</b></td>
                  <td className="num"><b>{num(t.reserved)}</b></td><td className="num"><b>{num(t.available)}</b></td>
                  <td /><td className="num"><b>{rupiah(t.revenue)}</b></td><td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <small>Pendapatan berasal dari pembayaran simulasi, bukan uang sungguhan. Perubahan harga hanya berlaku untuk pembelian berikutnya.</small>
      </Card>

      <div style={{ height: 18 }} />
      <OrdersCard eventId={eventId} />

      {modal && (
        <CategoryModal row={modal.row} events={events.data?.items ?? []} defaultEventId={eventId}
          onClose={() => setModal(null)} onSaved={sales.reload} />
      )}
    </>
  );
}

function OrdersCard({ eventId }: { eventId: string }) {
  const [status, setStatus] = useState<'' | OrderStatus>('');
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page) });
  if (status) qs.set('status', status);
  if (eventId) qs.set('eventId', eventId);
  const orders = useFetch<Paged<OrderRow>>(`/admin/orders?${qs}`);
  const summary = useFetch<ReportSummary>('/admin/reports/summary');
  const meta = orders.data?.meta;

  // Pindah filter acara dari halaman induk: kembali ke halaman 1.
  const [lastEvent, setLastEvent] = useState(eventId);
  if (lastEvent !== eventId) { setLastEvent(eventId); setPage(1); }

  return (
    <Card icon="wallet" title="Order pembeli"
      action={
        <select aria-label="Filter status order" value={status} onChange={(e) => { setStatus(e.target.value as '' | OrderStatus); setPage(1); }} style={{ width: 170 }}>
          <option value="">Semua status</option>
          {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => <option key={s} value={s}>{ORDER_STATUS[s][0]}</option>)}
        </select>
      }>
      {orders.error && <Alert>Gagal memuat order: {orders.error}</Alert>}
      {summary.data && !eventId && (
        <p style={{ margin: '0 0 12px' }}><small>
          Semua acara: {num(summary.data.orders.total)} order
          {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => ` · ${ORDER_STATUS[s][0]} ${num(summary.data!.orders.byStatus[s] ?? 0)}`).join('')}
        </small></p>
      )}
      {!orders.data ? (orders.error ? null : <Spinner />) : orders.data.items.length === 0 ? <Empty>Tidak ada order.</Empty> : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>No. order</th><th>Pembeli</th><th>Acara</th><th>Tiket</th><th className="num">Total</th><th>Status</th><th>Dibuat</th></tr></thead>
              <tbody>
                {orders.data.items.map((o) => {
                  const [label, tone] = ORDER_STATUS[o.status];
                  return (
                    <tr key={o.id}>
                      <td><code>{o.orderNumber}</code></td>
                      <td><b>{o.user.name}</b><br /><small>{o.user.email}</small></td>
                      <td>{o.event?.title ?? '–'}</td>
                      <td>{o.items.map((i) => `${i.categoryName} ×${i.quantity}`).join(', ')}</td>
                      <td className="num">{rupiah(o.totalAmount)}</td>
                      <td><span className={`badge ${tone}`}>{label}</span></td>
                      <td>{dateTime(o.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {meta && (
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
              <small>{num(meta.total)} order · halaman {meta.page} dari {Math.max(1, meta.totalPages)}</small>
              <div className="row">
                <button className="btn secondary sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Sebelumnya</button>
                <button className="btn secondary sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Berikutnya</button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function CategoryModal({ row, events, defaultEventId, onClose, onSaved }: {
  row?: SalesRow; events: EventItem[]; defaultEventId: string; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const editing = Boolean(row);
  const [evId, setEvId] = useState(row?.eventId ?? defaultEventId ?? '');
  const [name, setName] = useState(row?.name ?? '');
  const [price, setPrice] = useState(row ? String(row.price) : '');
  const [quota, setQuota] = useState(row ? String(row.quota) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const minQuota = row ? Math.max(1, row.soldCount + row.reservedCount) : 1;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!editing && !evId) return setError('Pilih acara terlebih dahulu.');
    const body = { name: name.trim(), price: Number(price), quota: Number(quota) };
    if (!Number.isInteger(body.price) || body.price < 0) return setError('Harga harus bilangan bulat ≥ 0.');
    if (!Number.isInteger(body.quota) || body.quota < minQuota) return setError(`Kuota minimal ${num(minQuota)}${row ? ' (terjual + tertahan)' : ''}.`);
    setBusy(true);
    try {
      if (row) await api(`/admin/ticket-categories/${row.ticketCategoryId}`, { method: 'PATCH', body });
      else await api(`/admin/events/${evId}/ticket-categories`, { method: 'POST', body });
      toast.success(`Kategori “${body.name}” ${editing ? 'diperbarui' : 'ditambahkan'}.`);
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
    <Modal title={editing ? `Ubah kategori — ${row!.name}` : 'Tambah kategori tiket'} onClose={onClose}>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={submit}>
        {!editing && (
          <Field label="Acara">
            <select value={evId} onChange={(e) => setEvId(e.target.value)} required>
              <option value="">Pilih acara…</option>
              {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </Field>
        )}
        <Field label="Nama kategori"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required autoFocus /></Field>
        <div className="form-grid">
          <Field label="Harga (Rp)" hint={editing ? 'Hanya berlaku untuk pembelian berikutnya.' : undefined}>
            <input type="number" min={0} step={1} value={price} onChange={(e) => setPrice(e.target.value)} required />
          </Field>
          <Field label="Kuota" hint={row ? `Minimal ${num(minQuota)} (terjual ${num(row.soldCount)} + tertahan ${num(row.reservedCount)}).` : undefined}>
            <input type="number" min={minQuota} step={1} value={quota} onChange={(e) => setQuota(e.target.value)} required />
          </Field>
        </div>
        <div className="row">
          <button className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
          <button type="button" className="btn ghost" onClick={onClose}>Batal</button>
        </div>
      </form>
    </Modal>
  );
}
