import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { adminApi } from '../../api/endpoints';
import type { EventStatus } from '../../api/types';
import {
  Alert,
  AsyncView,
  Button,
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

export default function AdminEvents() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<EventStatus | ''>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, loading, error, reload } = useAsync(
    () => adminApi.events({ page, limit: 10, status: status || undefined }),
    [page, status],
  );

  const remove = async (id: string, title: string) => {
    if (!window.confirm(`Hapus acara "${title}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    setActionError(null);
    try {
      await adminApi.deleteEvent(id);
      reload();
    } catch (e) {
      setActionError(getErrorMessage(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Acara"
        subtitle="Kelola acara, kategori tiket, dan kuota."
        actions={
          <Link to="/admin/events/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            Buat acara
          </Link>
        }
      />

      <div className="mb-4 max-w-xs">
        <select
          className={inputClass}
          aria-label="Filter status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as EventStatus | '');
            setPage(1);
          }}
        >
          <option value="">Semua status</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Terbit</option>
          <option value="CANCELLED">Dibatalkan</option>
          <option value="FINISHED">Selesai</option>
        </select>
      </div>

      {actionError && (
        <div className="mb-4">
          <Alert tone="error">{actionError}</Alert>
        </div>
      )}

      <AsyncView loading={loading && !data} error={error} onRetry={reload}>
        {data && data.items.length > 0 ? (
          <>
            <Table>
              <thead>
                <tr>
                  <th className={th}>Acara</th>
                  <th className={th}>Jadwal</th>
                  <th className={th}>Status</th>
                  <th className={th}>Tiket (terjual / kuota)</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((e) => {
                  const sold = e.ticketCategories.reduce((s, c) => s + (c.soldCount ?? 0), 0);
                  const quota = e.ticketCategories.reduce((s, c) => s + c.quota, 0);
                  return (
                    <tr key={e.id}>
                      <td className={td}>
                        <p className="font-semibold text-slate-900">{e.title}</p>
                        <p className="text-xs text-slate-500">{e.category} · {e.location}</p>
                      </td>
                      <td className={td}>{formatDateTime(e.startAt)}</td>
                      <td className={td}>
                        <StatusBadge status={e.status} />
                      </td>
                      <td className={td}>
                        {sold} / {quota}
                      </td>
                      <td className={`${td} whitespace-nowrap text-right`}>
                        <Link to={`/admin/events/${e.id}`} className="mr-3 font-semibold text-indigo-600 hover:underline">
                          Kelola
                        </Link>
                        <Button variant="ghost" className="!px-2 !py-1 text-red-600" onClick={() => remove(e.id, e.title)}>
                          Hapus
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination meta={data.meta} onChange={setPage} />
          </>
        ) : (
          <EmptyState title="Belum ada acara">Klik "Buat acara" untuk memulai.</EmptyState>
        )}
      </AsyncView>
    </div>
  );
}
