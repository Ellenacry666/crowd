import { useState } from 'react';
import { adminApi } from '../../api/endpoints';
import type { OrderStatus } from '../../api/types';
import {
  AsyncView,
  EmptyState,
  inputClass,
  PageHeader,
  Pagination,
  StatusBadge,
  Table,
  td,
  th,
} from '../../components/ui';
import { formatDateTime, formatRupiah } from '../../utils/format';
import { useAsync } from '../../utils/hooks';

export default function AdminOrders() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const { data, loading, error, reload } = useAsync(
    () => adminApi.orders({ page, limit: 15, status: status || undefined }),
    [page, status],
  );

  return (
    <div>
      <PageHeader title="Order" subtitle="Seluruh order dan status pembayaran simulasi." />
      <div className="mb-4 max-w-xs">
        <select
          className={inputClass}
          aria-label="Filter status order"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as OrderStatus | '');
            setPage(1);
          }}
        >
          <option value="">Semua status</option>
          <option value="PENDING">Menunggu pembayaran</option>
          <option value="PAID">Lunas (simulasi)</option>
          <option value="FAILED">Gagal</option>
          <option value="EXPIRED">Kedaluwarsa</option>
          <option value="CANCELLED">Dibatalkan</option>
        </select>
      </div>

      <AsyncView loading={loading && !data} error={error} onRetry={reload}>
        {data && data.items.length > 0 ? (
          <>
            <Table>
              <thead>
                <tr>
                  <th className={th}>No. order</th>
                  <th className={th}>Pemesan</th>
                  <th className={th}>Acara</th>
                  <th className={th}>Item</th>
                  <th className={th}>Total</th>
                  <th className={th}>Status</th>
                  <th className={th}>Pembayaran</th>
                  <th className={th}>Dibuat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((o) => (
                  <tr key={o.id}>
                    <td className={`${td} font-mono text-xs`}>{o.orderNumber}</td>
                    <td className={td}>
                      {o.user.name}
                      <span className="block text-xs text-slate-400">{o.user.email}</span>
                    </td>
                    <td className={td}>{o.event?.title ?? '-'}</td>
                    <td className={td}>{o.items.map((i) => `${i.categoryName} × ${i.quantity}`).join(', ')}</td>
                    <td className={`${td} whitespace-nowrap`}>{formatRupiah(o.totalAmount)}</td>
                    <td className={td}>
                      <StatusBadge status={o.status} />
                    </td>
                    <td className={td}>
                      {o.lastPayment ? (
                        <>
                          <StatusBadge status={o.lastPayment.status} />
                          <span className="mt-1 block font-mono text-[10px] text-slate-400">{o.lastPayment.reference}</span>
                        </>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{formatDateTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination meta={data.meta} onChange={setPage} />
          </>
        ) : (
          <EmptyState title="Tidak ada order" />
        )}
      </AsyncView>
    </div>
  );
}
