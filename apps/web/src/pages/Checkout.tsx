import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { ordersApi, photosApi } from '../api/endpoints';
import type { PaymentResult } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import HolderPhotos from '../components/HolderPhotos';
import SimulationBanner from '../components/SimulationBanner';
import { Alert, AsyncView, Button, Card, PageHeader, StatusBadge } from '../components/ui';
import { formatCountdown, formatDateTime, formatRupiah } from '../utils/format';
import { useAsync, useNow } from '../utils/hooks';

export default function Checkout() {
  const { orderId = '' } = useParams();
  const { user } = useAuth();
  const { data: order, loading, error, reload } = useAsync(() => ordersApi.get(orderId), [orderId]);
  const photos = useAsync(() => photosApi.status(orderId), [orderId]);
  const now = useNow();

  const [busy, setBusy] = useState<'SUCCESS' | 'FAILED' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);

  const pay = async (outcome: 'SUCCESS' | 'FAILED') => {
    setBusy(outcome);
    setActionError(null);
    try {
      setResult(await ordersApi.simulate(orderId, outcome));
      reload();
      photos.reload();
    } catch (e) {
      setActionError(getErrorMessage(e));
      reload(); // status order mungkin sudah berubah (mis. kedaluwarsa)
      photos.reload();
    } finally {
      setBusy(null);
    }
  };

  const secondsLeft = order ? Math.floor((new Date(order.expiresAt).getTime() - now) / 1000) : 0;
  const payable = order?.status === 'PENDING' && secondsLeft > 0;
  const photosReady = !!photos.data && photos.data.uploaded >= photos.data.required;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Pembayaran" subtitle="Selesaikan pesanan Anda." />
      <AsyncView loading={loading && !order} error={error} onRetry={reload}>
        {order && (
          <div className="space-y-5">
            <SimulationBanner />

            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase text-slate-400">No. order</p>
                  <p className="font-mono text-sm font-semibold">{order.orderNumber}</p>
                </div>
                <StatusBadge status={order.status} />
              </div>

              {order.event && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="font-bold">{order.event.title}</p>
                  <p className="text-sm text-slate-500">
                    {formatDateTime(order.event.startAt)} · {order.event.location}
                  </p>
                </div>
              )}

              <ul className="mt-4 divide-y divide-slate-100 text-sm">
                {order.items.map((i) => (
                  <li key={i.ticketCategoryId} className="flex justify-between py-2">
                    <span>
                      {i.categoryName} × {i.quantity}
                      <span className="block text-xs text-slate-400">{formatRupiah(i.unitPrice)} per tiket</span>
                    </span>
                    <span className="font-medium">{formatRupiah(i.subtotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-lg font-extrabold">
                <span>Total</span>
                <span>{formatRupiah(order.totalAmount)}</span>
              </div>

              {user && (
                <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="text-xs uppercase text-slate-400">Data pemesan</p>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-slate-500">{user.email}</p>
                </div>
              )}
            </Card>

            {payable && (
              <Card>
                {photos.data ? (
                  <HolderPhotos orderId={orderId} status={photos.data} onChanged={photos.reload} />
                ) : photos.error ? (
                  <Alert tone="error">{photos.error}</Alert>
                ) : (
                  <p className="text-sm text-slate-500">Memuat status foto...</p>
                )}
              </Card>
            )}

            {order.status === 'PENDING' && (
              <Card>
                {payable ? (
                  <>
                    <p className="text-sm text-slate-600">
                      Sisa waktu pembayaran:{' '}
                      <span className="font-mono text-lg font-bold text-amber-700">
                        {formatCountdown(secondsLeft)}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Stok tiket ditahan selama waktu ini. Setelah habis, order dibatalkan otomatis.
                    </p>
                    {!photosReady && photos.data && (
                      <p className="mt-3 text-sm font-medium text-amber-700">
                        Unggah foto untuk semua tiket terlebih dahulu ({photos.data.uploaded} dari{' '}
                        {photos.data.required}) agar pembayaran dapat dilanjutkan.
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button
                        loading={busy === 'SUCCESS'}
                        disabled={busy !== null || !photosReady}
                        onClick={() => pay('SUCCESS')}
                      >
                        Simulasikan pembayaran berhasil
                      </Button>
                      <Button
                        variant="danger"
                        loading={busy === 'FAILED'}
                        disabled={busy !== null}
                        onClick={() => pay('FAILED')}
                      >
                        Simulasikan pembayaran gagal
                      </Button>
                    </div>
                  </>
                ) : (
                  <Alert tone="warning">
                    Waktu pembayaran telah habis. Memuat status terbaru...{' '}
                    <button type="button" className="font-semibold underline" onClick={reload}>
                      Muat ulang
                    </button>
                  </Alert>
                )}
              </Card>
            )}

            {actionError && <Alert tone="error">{actionError}</Alert>}

            {order.status === 'PAID' && (
              <Alert tone="success">
                <p className="font-semibold">
                  Pembayaran simulasi berhasil{result ? `. ${result.ticketsIssued} tiket diterbitkan.` : '.'}
                </p>
                <Link to="/tickets" className="mt-2 inline-block rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">
                  Lihat Tiket Saya
                </Link>
              </Alert>
            )}
            {order.status === 'FAILED' && (
              <Alert tone="error">
                Pembayaran simulasi gagal. Tidak ada tiket yang diterbitkan dan stok sudah dilepas.{' '}
                {order.event && (
                  <Link to={`/events/${order.event.slug}`} className="font-semibold underline">
                    Coba beli lagi
                  </Link>
                )}
              </Alert>
            )}
            {(order.status === 'EXPIRED' || order.status === 'CANCELLED') && (
              <Alert tone="warning">
                Order ini sudah {order.status === 'EXPIRED' ? 'kedaluwarsa' : 'dibatalkan'}.{' '}
                {order.event && (
                  <Link to={`/events/${order.event.slug}`} className="font-semibold underline">
                    Buat order baru
                  </Link>
                )}
              </Alert>
            )}
          </div>
        )}
      </AsyncView>
    </div>
  );
}
