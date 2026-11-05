import { Link } from 'react-router-dom';
import { adminApi } from '../../api/endpoints';
import { AsyncView, Card, PageHeader, StatusBadge, Table, td, th } from '../../components/ui';
import { formatDateTime, formatRupiah } from '../../utils/format';
import { useAsync } from '../../utils/hooks';

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-extrabold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

export default function Dashboard() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [summary, checkins, orders] = await Promise.all([
      adminApi.summary(),
      adminApi.checkins(),
      adminApi.orders({ limit: 5 }),
    ]);
    return { summary, checkins, orders };
  }, []);

  return (
    <div>
      <PageHeader title="Ringkasan" subtitle="Gambaran umum acara, penjualan simulasi, dan check-in." />
      <AsyncView loading={loading} error={error} onRetry={reload}>
        {data && (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Acara"
                value={data.summary.events.total}
                hint={`${data.summary.events.byStatus.PUBLISHED ?? 0} terbit`}
              />
              <Stat
                label="Order lunas"
                value={data.summary.orders.byStatus.PAID ?? 0}
                hint={`${data.summary.orders.total} total order`}
              />
              <Stat label="Tiket terbit" value={data.summary.tickets.issued} />
              <Stat
                label="Check-in"
                value={data.checkins.ticketsCheckedIn}
                hint={`dari ${data.checkins.ticketsIssued} tiket`}
              />
            </div>

            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Pendapatan simulasi
              </p>
              <p className="mt-2 text-3xl font-extrabold">{formatRupiah(data.summary.simulatedRevenue)}</p>
              <p className="mt-1 text-xs text-amber-700">
                Nilai dari pembayaran simulasi, bukan uang sungguhan.
              </p>
            </Card>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold">Order terbaru</h2>
                <Link to="/admin/orders" className="text-sm font-semibold text-indigo-600 hover:underline">
                  Semua order
                </Link>
              </div>
              <Table>
                <thead>
                  <tr>
                    <th className={th}>No. order</th>
                    <th className={th}>Pemesan</th>
                    <th className={th}>Total</th>
                    <th className={th}>Status</th>
                    <th className={th}>Dibuat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.orders.items.map((o) => (
                    <tr key={o.id}>
                      <td className={`${td} font-mono text-xs`}>{o.orderNumber}</td>
                      <td className={td}>{o.user.name}</td>
                      <td className={td}>{formatRupiah(o.totalAmount)}</td>
                      <td className={td}>
                        <StatusBadge status={o.status} />
                      </td>
                      <td className={td}>{formatDateTime(o.createdAt)}</td>
                    </tr>
                  ))}
                  {data.orders.items.length === 0 && (
                    <tr>
                      <td className={`${td} text-center text-slate-400`} colSpan={5}>
                        Belum ada order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </div>
        )}
      </AsyncView>
    </div>
  );
}
