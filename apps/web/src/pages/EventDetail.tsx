import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { eventsApi, ordersApi } from '../api/endpoints';
import type { EventQuota } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import PosterImage from '../components/PosterImage';
import { Alert, AsyncView, Button, Card } from '../components/ui';
import { formatDate, formatRupiah, formatTime } from '../utils/format';
import { useAsync } from '../utils/hooks';

const MAX_TICKETS = 5;

export default function EventDetail() {
  const { slug = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: event, loading, error, reload } = useAsync(() => eventsApi.detail(slug), [slug]);

  // Sisa jatah akun untuk acara ini (PAID + PENDING). Hanya relevan untuk pengunjung yang login.
  const isCustomer = user?.role === 'CUSTOMER';
  const quota = useAsync<EventQuota | null>(
    () => (isCustomer ? ordersApi.quota(slug) : Promise.resolve(null)),
    [slug, user?.id, isCustomer],
  );
  const remainingQuota = quota.data ? quota.data.remaining : MAX_TICKETS;
  // Batas pilihan = batas per order, tetapi tidak boleh melebihi sisa jatah acara.
  const limit = Math.min(MAX_TICKETS, remainingQuota);

  const [qty, setQty] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const total = Object.values(qty).reduce((a, b) => a + b, 0);

  const change = (id: string, delta: number, available: number) => {
    setQty((prev) => {
      const current = prev[id] ?? 0;
      const next = Math.max(0, Math.min(current + delta, available));
      const others = total - current;
      if (others + next > limit) return prev;
      return { ...prev, [id]: next };
    });
  };

  const estimate = event
    ? event.ticketCategories.reduce((sum, c) => sum + (qty[c.id] ?? 0) * c.price, 0)
    : 0;

  const buy = async () => {
    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }
    const items = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([ticketCategoryId, quantity]) => ({ ticketCategoryId, quantity: Number(quantity) }));
    if (items.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const order = await ordersApi.create(items);
      navigate(`/checkout/${order.id}`);
    } catch (e) {
      setSubmitError(getErrorMessage(e));
      setQty({}); // pilihan lama mungkin sudah tidak valid
      reload(); // stok mungkin berubah; muat ulang ketersediaan
      quota.reload(); // jatah mungkin berubah (mis. order dari tab lain)
    } finally {
      setSubmitting(false);
    }
  };

  const canBuy = !user || user.role === 'CUSTOMER';

  return (
    <AsyncView loading={loading} error={error} onRetry={reload}>
      {event && (
        <div className="space-y-6">
          <Link to="/events" className="text-sm font-semibold text-indigo-600 hover:underline">
            &larr; Semua acara
          </Link>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <PosterImage src={event.posterUrl} alt={event.title} className="h-56 w-full md:h-80" />
            <div className="p-6">
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                {event.category}
              </span>
              <h1 className="mt-3 text-2xl font-extrabold md:text-3xl">{event.title}</h1>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase text-slate-400">Tanggal</dt>
                  <dd className="font-medium">{formatDate(event.startAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-400">Waktu</dt>
                  <dd className="font-medium">
                    {formatTime(event.startAt)} - {formatTime(event.endAt)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase text-slate-400">Lokasi</dt>
                  <dd className="font-medium">{event.location}</dd>
                </div>
              </dl>
              <p className="mt-5 whitespace-pre-line text-slate-700">{event.description}</p>
            </div>
          </div>

          <Card>
            <h2 className="text-lg font-bold">Pilih tiket</h2>
            {isCustomer && quota.data && (
              <div className="mt-3">
                {quota.data.remaining === 0 ? (
                  <Alert tone="warning">
                    Anda sudah mencapai batas {quota.data.limit} tiket untuk acara ini ({quota.data.used} tiket
                    sudah dimiliki atau dipesan, termasuk yang menunggu pembayaran). Lihat{' '}
                    <Link to="/orders" className="font-semibold underline">
                      Pesanan Saya
                    </Link>
                    . Pesanan yang gagal atau kedaluwarsa mengembalikan jatah Anda.
                  </Alert>
                ) : (
                  <p className="text-sm text-slate-600">
                    Jatah pembelian Anda untuk acara ini: <strong>sisa {quota.data.remaining}</strong> dari{' '}
                    {quota.data.limit} tiket
                    {quota.data.used > 0 ? ` (${quota.data.used} sudah dimiliki atau dipesan)` : ''}.
                  </p>
                )}
              </div>
            )}
            {event.ticketCategories.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Tiket untuk acara ini belum tersedia.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {event.ticketCategories.map((c) => {
                  const q = qty[c.id] ?? 0;
                  const soldOut = c.available === 0;
                  return (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                      <div>
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-sm text-slate-500">
                          {c.price === 0 ? 'Gratis' : formatRupiah(c.price)} ·{' '}
                          {soldOut ? (
                            <span className="font-semibold text-red-600">Habis</span>
                          ) : (
                            <span>Tersisa {c.available}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="secondary"
                          aria-label={`Kurangi ${c.name}`}
                          disabled={q === 0}
                          onClick={() => change(c.id, -1, c.available)}
                        >
                          -
                        </Button>
                        <span className="w-6 text-center font-semibold" aria-live="polite">
                          {q}
                        </span>
                        <Button
                          variant="secondary"
                          aria-label={`Tambah ${c.name}`}
                          disabled={soldOut || q >= c.available || total >= limit}
                          onClick={() => change(c.id, 1, c.available)}
                        >
                          +
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {event.ticketCategories.length > 0 && (
              <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">
                  Maksimum {MAX_TICKETS} tiket per order dan {quota.data?.limit ?? MAX_TICKETS} tiket per akun untuk
                  setiap acara. Harga final dihitung dan diverifikasi oleh server.
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase text-slate-400">Estimasi total ({total} tiket)</p>
                    <p className="text-xl font-extrabold">{formatRupiah(estimate)}</p>
                  </div>
                  <Button disabled={!canBuy || total === 0 || limit === 0} loading={submitting} onClick={buy}>
                    {user ? 'Beli tiket' : 'Masuk untuk membeli'}
                  </Button>
                </div>
                {user && !canBuy && (
                  <Alert tone="info">
                    Pembelian tiket hanya tersedia untuk akun pengunjung. Anda masuk sebagai{' '}
                    {user.role === 'ADMIN' ? 'admin' : 'petugas'}.
                  </Alert>
                )}
                {submitError && <Alert tone="error">{submitError}</Alert>}
              </div>
            )}
          </Card>
        </div>
      )}
    </AsyncView>
  );
}
