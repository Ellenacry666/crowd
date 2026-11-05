const MAX_SIDE = 1024; // sisi terpanjang setelah diperkecil (px)
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

/**
 * Menyiapkan foto sebelum diunggah: memvalidasi, memperkecil, dan menyimpan ulang sebagai JPEG.
 * Menggambar ulang ke canvas juga membuang metadata EXIF (mis. koordinat GPS) dari foto asli.
 */
export async function prepareSelfie(file: Blob): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Berkas harus berupa gambar (JPG, PNG, atau WebP).');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('Ukuran foto terlalu besar (maksimum 15 MB).');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Format foto tidak didukung. Gunakan JPG, PNG, atau WebP.');
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Browser tidak dapat memproses foto.');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Gagal memproses foto. Coba foto lain.');
  return blob;
}

/** Kamera langsung hanya tersedia pada konteks aman (HTTPS atau localhost). */
export function canUseLiveCamera(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    !!navigator.mediaDevices?.getUserMedia
  );
}
