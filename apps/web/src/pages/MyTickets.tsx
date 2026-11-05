import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ticketsApi } from '../api/endpoints';
import TicketCard from '../components/TicketCard';
import { AsyncView, Button, EmptyState, PageHeader } from '../components/ui';
import { useAsync } from '../utils/hooks';

export default function MyTickets() {
  const { data, loading, error, reload } = useAsync(() => ticketsApi.mine(), []);

  // Status tiket (mis. sudah dipindai petugas) diperbarui saat tab kembali difokuskan.
  useEffect(() => {
    window.addEventListener('focus', reload);
    return () => window.removeEventListener('focus', reload);
  }, [reload]);

  return (
    <div>
      <PageHeader
        title="Tiket Saya"
        subtitle="Tunjukkan QR Code ini kepada petugas di gerbang."
        actions={
          <Button variant="secondary" onClick={reload}>
            Muat ulang
          </Button>
        }
      />
      <AsyncView loading={loading && !data} error={error} onRetry={reload}>
        {data && data.length > 0 ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {data.map((t) => (
              <TicketCard key={t.id} ticket={t} />
            ))}
          </div>
        ) : (
          <EmptyState title="Belum ada tiket">
            Tiket muncul di sini setelah pembayaran berhasil.{' '}
            <Link to="/events" className="font-semibold text-indigo-600 hover:underline">
              Cari acara
            </Link>
          </EmptyState>
        )}
      </AsyncView>
    </div>
  );
}
