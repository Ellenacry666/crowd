import { Link } from 'react-router-dom';
import { ordersApi } from '../api/endpoints';
import { AsyncView, Card, EmptyState, PageHeader, StatusBadge } from '../components/ui';
import { formatDateTime, formatRupiah } from '../utils/format';
import { useAsync } from '../utils/hooks';

export default function MyOrders() {
  const { data, loading, error, reload } = useAsync(() => ordersApi.mine(), []);

  return (
    <div>
      <PageHeader title="Pesanan Saya" subtitle="Riwayat pembelian tiket Anda." />
      <AsyncView loading={loading} error={error} onRetry={reload}>
        {data && data.length > 0 ? (
          <div className="space-y-4">
            {data.map((o) => (
              <Card key={o.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{o.event?.title ?? 'Acara'}</p>
                    <p className="font-mono text-xs text-slate-500">{o.orderNumber}</p>
                    <p className="mt-1 text-xs text-slate-400">Dibuat {formatDateTime(o.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={o.status} />
                    <p className="mt-2 font-bold">{formatRupiah(o.totalAmount)}</p>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {o.items.map((i) => `${i.categoryName} × ${i.quantity}`).join(', ')}
                </p>
                <div className="mt-3 flex gap-4 text-sm font-semibold">
                  {o.status === 'PENDING' && (
                    <Link to={`/checkout/${o.id}`} className="text-indigo-600 hover:underline">
                      Lanjutkan pembayaran
                    </Link>
                  )}
                  {o.status === 'PAID' && (
                    <Link to="/tickets" className="text-indigo-600 hover:underline">
                      Lihat tiket
                    </Link>
                  )}
                  <Link to={`/checkout/${o.id}`} className="text-slate-500 hover:underline">
                    Detail
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="Belum ada pesanan">
            <Link to="/events" className="font-semibold text-indigo-600 hover:underline">
              Cari acara
            </Link>
          </EmptyState>
        )}
      </AsyncView>
    </div>
  );
}
