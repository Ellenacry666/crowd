import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';

function describeCameraError(error: unknown): string {
  const name = (error as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Izin kamera ditolak. Izinkan akses kamera di pengaturan browser, atau pilih foto dari galeri.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'Kamera tidak ditemukan di perangkat ini. Pilih foto dari galeri.';
  }
  if (name === 'NotReadableError') {
    return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut atau pilih foto dari galeri.';
  }
  return 'Kamera tidak dapat dibuka. Pilih foto dari galeri.';
}

export default function CameraCapture({
  title,
  onCapture,
  onClose,
}: {
  title: string;
  onCapture: (photo: Blob) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setReady(true);
      })
      .catch((e) => {
        if (!cancelled) setError(describeCameraError(e));
      });
    return () => {
      cancelled = true;
      // Selalu matikan kamera saat modal ditutup.
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
      },
      'image/jpeg',
      0.92,
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
        <h2 className="mb-3 text-lg font-bold">{title}</h2>
        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl bg-slate-900">
            {/* Pratinjau dicerminkan agar terasa seperti cermin; hasil jepretan tidak dicerminkan. */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-[4/3] w-full -scale-x-100 object-cover"
            />
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">Pastikan wajah pemegang tiket terlihat jelas dan cukup terang.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {error ? 'Tutup' : 'Batal'}
          </Button>
          {!error && (
            <Button onClick={capture} disabled={!ready}>
              Ambil foto
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
