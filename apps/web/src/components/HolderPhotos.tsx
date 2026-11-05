import { ChangeEvent, useRef, useState } from 'react';
import { getErrorMessage } from '../api/client';
import { photosApi } from '../api/endpoints';
import type { PhotoSlot, PhotoStatus } from '../api/types';
import { useBlobUrl } from '../utils/hooks';
import { canUseLiveCamera, prepareSelfie } from '../utils/image';
import CameraCapture from './CameraCapture';
import { Alert, Button } from './ui';

function SlotCard({
  orderId,
  slot,
  disabled,
  busy,
  onBlob,
  onOpenCamera,
}: {
  orderId: string;
  slot: PhotoSlot;
  disabled: boolean;
  busy: boolean;
  onBlob: (slot: number, blob: Blob) => void;
  onOpenCamera: (slot: number) => void;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const { url, failed } = useBlobUrl(
    slot.uploaded ? () => photosApi.image(orderId, slot.slot) : null,
    [orderId, slot.slot, slot.uploaded, slot.updatedAt],
  );

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // izinkan memilih berkas yang sama lagi
    if (file) onBlob(slot.slot, file);
  };

  const takeSelfie = () => {
    if (canUseLiveCamera()) onOpenCamera(slot.slot);
    else captureRef.current?.click(); // ponsel: membuka kamera depan lewat atribut capture
  };

  return (
    <li className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
        {url ? (
          <img src={url} alt={`Foto pemegang tiket ${slot.slot}`} className="h-full w-full object-cover" />
        ) : (
          <span className="px-2 text-center text-xs text-slate-400">
            {slot.uploaded ? (failed ? 'Gagal memuat' : '...') : 'Belum ada foto'}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <p className="font-semibold">Pemegang tiket {slot.slot}</p>
          <p className={`text-xs ${slot.uploaded ? 'text-green-700' : 'text-amber-700'}`}>
            {slot.uploaded ? 'Foto terunggah' : 'Foto diperlukan'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="!px-3 !py-1.5" loading={busy} disabled={disabled} onClick={takeSelfie}>
            {slot.uploaded ? 'Selfie ulang' : 'Ambil selfie'}
          </Button>
          <Button
            variant="secondary"
            className="!px-3 !py-1.5"
            disabled={disabled || busy}
            onClick={() => galleryRef.current?.click()}
          >
            Pilih dari galeri
          </Button>
        </div>
        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={pick} />
        <input ref={captureRef} type="file" accept="image/*" capture="user" className="hidden" onChange={pick} />
      </div>
    </li>
  );
}

/**
 * Syarat pembelian anti-calo: satu foto (selfie) pemegang untuk SETIAP tiket.
 * Foto diproses di browser (diperkecil, metadata EXIF dibuang) lalu diunggah ke backend.
 */
export default function HolderPhotos({
  orderId,
  status,
  onChanged,
}: {
  orderId: string;
  status: PhotoStatus;
  onChanged: () => void;
}) {
  const [consent, setConsent] = useState(false);
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [cameraSlot, setCameraSlot] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBlob = async (slot: number, blob: Blob) => {
    setCameraSlot(null);
    setBusySlot(slot);
    setError(null);
    try {
      const prepared = await prepareSelfie(blob);
      await photosApi.upload(orderId, slot, prepared);
      onChanged();
    } catch (e) {
      setError(`Foto ${slot}: ${e instanceof Error && !('response' in e) ? e.message : getErrorMessage(e)}`);
    } finally {
      setBusySlot(null);
    }
  };

  const locked = !consent;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Foto pemegang tiket</h2>
        <p className="mt-1 text-sm text-slate-600">
          Untuk mencegah calo, setiap tiket wajib disertai foto selfie pemegangnya. Gunakan{' '}
          <strong>orang yang berbeda untuk setiap tiket</strong>. Foto yang identik ditolak, dan petugas di gerbang
          dapat mencocokkan wajah pemegang dengan foto ini.
        </p>
        <p className="mt-2 text-sm font-semibold">
          {status.uploaded} dari {status.required} foto terunggah
        </p>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
          <div
            className="h-full bg-indigo-600 transition-all"
            style={{ width: `${(status.uploaded / Math.max(1, status.required)) * 100}%` }}
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          Saya telah mendapat izin dari setiap orang yang difoto, dan menyetujui foto ini digunakan{' '}
          <strong>hanya untuk verifikasi pemegang tiket</strong>. Foto hanya dapat dilihat oleh saya, admin acara, dan
          petugas gerbang acara ini. Foto dihapus otomatis jika pembayaran gagal atau pesanan kedaluwarsa.
        </span>
      </label>

      {error && <Alert tone="error">{error}</Alert>}

      <ul className="grid gap-3 sm:grid-cols-2">
        {status.slots.map((s) => (
          <SlotCard
            key={s.slot}
            orderId={orderId}
            slot={s}
            disabled={locked || busySlot !== null}
            busy={busySlot === s.slot}
            onBlob={handleBlob}
            onOpenCamera={setCameraSlot}
          />
        ))}
      </ul>
      {locked && <p className="text-xs text-slate-500">Centang persetujuan di atas untuk mengaktifkan tombol foto.</p>}

      {cameraSlot !== null && (
        <CameraCapture
          title={`Selfie pemegang tiket ${cameraSlot}`}
          onCapture={(blob) => handleBlob(cameraSlot, blob)}
          onClose={() => setCameraSlot(null)}
        />
      )}
    </div>
  );
}
