import { useState } from 'react';
import { adminApi } from '../../api/endpoints';
import type { TicketStatus } from '../../api/types';
import HolderThumb from '../../components/HolderThumb';
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
import { formatDateTime } from '../../utils/format';
import { useAsync } from '../../utils/hooks';

export default function AdminTickets() {
  const [page, setPage] = useState(1);
  const [eventId, setEventId] = useState('');
  const [status, setStatus] = useState<TicketStatus | ''>('');

  const events = useAsync(() => adminApi.events({ limit: 100 }), []);
  const { data, loading, error, reload } = useAsync(
    () => adminApi.tickets({ page, limit: 15, eventId: eventId || undefined, status: status || undefined }),
    [page, eventId, status],
  );

  return (
    <div>
      <PageHeader title="Tiket terbit" subtitle="Tiket yang sudah diterbitkan setelah pembayaran berhasil." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 md:max-w-xl">
        <select
          className={inputClass}
          aria-label="Filter acara"
          value={eventId}
          onChange={(e) => {
            setEventId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Semua acara</option>
          {events.data?.items.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        <select
          className={inputClass}
          aria-label="Filter status tiket"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as TicketStatus | '');
            setPage(1);
          }}
        >
          <option value="">Semua status</option>
          <option value="ACTIVE">Aktif</option>
          <option value="USED">Sudah digunakan</option>
          <option value="CANCELLED">Dibatalkan</option>
          <option value="EXPIRED">Kedaluwarsa</option>
        </select>
      </div>

      <AsyncView loading={loading && !data} error={error} onRetry={reload}>
        {data && data.items.length > 0 ? (
          <>
            <Table>
              <thead>
                <tr>
                  <th className={th}>Foto</th>
                  <th className={th}>Kode tiket</th>
                  <th className={th}>Acara</th>
                  <th className={th}>Kategori</th>
                  <th className={th}>Pemilik</th>
                  <th className={th}>Status</th>
                  <th className={th}>Check-in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((t) => (
                  <tr key={t.id}>
                    <td className={td}>
                      {t.hasHolderPhoto ? (
                        <HolderThumb ticketId={t.id} sizeClass="h-12 w-12" />
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className={`${td} break-all font-mono text-xs`}>{t.ticketCode}</td>
                    <td className={td}>{t.event.title}</td>
                    <td className={td}>{t.categoryName}</td>
                    <td className={td}>
                      {t.owner.name}
                      <span className="block text-xs text-slate-400">{t.owner.email}</span>
                    </td>
                    <td className={td}>
                      <StatusBadge status={t.status} />
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{t.checkedInAt ? formatDateTime(t.checkedInAt) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination meta={data.meta} onChange={setPage} />
          </>
        ) : (
          <EmptyState title="Tidak ada tiket" />
        )}
      </AsyncView>
    </div>
  );
}
