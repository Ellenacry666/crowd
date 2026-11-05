import { useState } from 'react';
import { adminApi } from '../../api/endpoints';
import {
  AsyncView,
  Card,
  EmptyState,
  inputClass,
  PageHeader,
  StatusBadge,
  Table,
  td,
  th,
} from '../../components/ui';
import { formatDateTime, formatRupiah } from '../../utils/format';
import { useAsync } from '../../utils/hooks';

const resultLabel: Record<string, string> = {
  SUCCESS: 'Berhasil',
  ALREADY_USED: 'Sudah digunakan',
  INVALID_TOKEN: 'QR tidak valid',
  NOT_PAID: 'Belum dibayar',
  CANCELLED_OR_EXPIRED: 'Dibatalkan/kedaluwarsa',
  WRONG_EVENT: 'Acara berbeda',
  NOT_AUTHORIZED: 'Petugas tidak berwenang',
};

export default function AdminReports() {
  const [eventId, setEventId] = useState('');
  const events = useAsync(() => adminApi.events({ limit: 100 }), []);
  const { data, loading, error, reload } = useAsync(async () => {
    const id = eventId || undefined;
    const [sales, checkins] = await Promise.all([adminApi.sales(id), adminApi.checkins(id)]);
    return { sales, checkins };
  }, [eventId]);

  const totals = data?.sales.reduce(
    (acc, r) => ({ paid: acc.paid + r.ticketsPaid, revenue: acc.revenue + r.simulatedRevenue }),
    { paid: 0, revenue: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Laporan" subtitle="Penjualan simulasi dan check-in per acara." />
      <div className="max-w-sm">
        <select className={inputClass} aria-label="Pilih acara" value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">Semua acara</option>
          {events.data?.items.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      </div>

      <AsyncView loading={loading && !data} error={error} onRetry={reload}>
        {data && (
          <>
            <section>
              <h2 className="mb-3 text-lg font-bold">Penjualan per kategori</h2>
              {data.sales.length > 0 ? (
                <Table>
                  <thead>
                    <tr>
                      <th className={th}>Acara</th>
                      <th className={th}>Kategori</th>
                      <th className={th}>Harga</th>
                      <th className={th}>Kuota</th>
                      <th className={th}>Terjual</th>
                      <th className={th}>Dicadangkan</th>
                      <th className={th}>Sisa</th>
                      <th className={th}>Pendapatan (simulasi)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.sales.map((r) => (
                      <tr key={r.ticketCategoryId}>
                        <td className={td}>{r.eventTitle}</td>
                        <td className={`${td} font-medium`}>{r.name}</td>
                        <td className={td}>{formatRupiah(r.price)}</td>
                        <td className={td}>{r.quota}</td>
                        <td className={td}>{r.soldCount}</td>
                        <td className={td}>{r.reservedCount}</td>
                        <td className={td}>{r.available}</td>
                        <td className={td}>{formatRupiah(r.simulatedRevenue)}</td>
                      </tr>
                    ))}
                    {totals && (
                      <tr className="bg-slate-50 font-bold">
                        <td className={td} colSpan={4}>Total</td>
                        <td className={td}>{totals.paid}</td>
                        <td className={td} colSpan={2}></td>
                        <td className={td}>{formatRupiah(totals.revenue)}</td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              ) : (
                <EmptyState title="Belum ada data penjualan" />
              )}
            </section>

            <section>
              <h2 className="mb-3 text-lg font-bold">Check-in</h2>
              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <Card>
                  <p className="text-xs uppercase text-slate-400">Tiket terbit</p>
                  <p className="mt-1 text-2xl font-extrabold">{data.checkins.ticketsIssued}</p>
                </Card>
                <Card>
                  <p className="text-xs uppercase text-slate-400">Sudah check-in</p>
                  <p className="mt-1 text-2xl font-extrabold">{data.checkins.ticketsCheckedIn}</p>
                </Card>
                <Card>
                  <p className="text-xs uppercase text-slate-400">Hasil pemindaian</p>
                  <ul className="mt-1 space-y-0.5 text-sm">
                    {Object.entries(data.checkins.byResult).map(([k, v]) => (
                      <li key={k} className="flex justify-between">
                        <span>{resultLabel[k] ?? k}</span>
                        <span className="font-semibold">{v}</span>
                      </li>
                    ))}
                    {Object.keys(data.checkins.byResult).length === 0 && <li className="text-slate-400">Belum ada pemindaian</li>}
                  </ul>
                </Card>
              </div>

              {data.checkins.recent.length > 0 && (
                <Table>
                  <thead>
                    <tr>
                      <th className={th}>Waktu</th>
                      <th className={th}>Acara</th>
                      <th className={th}>Petugas</th>
                      <th className={th}>Hasil</th>
                      <th className={th}>Kode tiket</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.checkins.recent.map((l) => (
                      <tr key={l.id}>
                        <td className={`${td} whitespace-nowrap`}>{formatDateTime(l.scannedAt)}</td>
                        <td className={td}>{l.eventTitle}</td>
                        <td className={td}>{l.staffName}</td>
                        <td className={td}>
                          <StatusBadge status={l.result} label={resultLabel[l.result] ?? l.result} />
                        </td>
                        <td className={`${td} break-all font-mono text-xs`}>{l.ticketCode ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </section>
          </>
        )}
      </AsyncView>
    </div>
  );
}
