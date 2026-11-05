import axios from 'axios';

export const TOKEN_KEY = 'cp_token';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export const api = axios.create({ baseURL, timeout: 15000 });

// Token disimpan di localStorage. Untuk proyek akademik ini cukup; pada produksi
// sebaiknya memakai cookie httpOnly agar tidak dapat dibaca skrip XSS.
export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* penyimpanan tidak tersedia */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* penyimpanan tidak tersedia */
    }
  },
};

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Sesi tidak valid atau kedaluwarsa: bersihkan token. Login yang gagal bukan sesi kedaluwarsa.
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      tokenStore.get() &&
      !error.config?.url?.includes('/auth/login')
    ) {
      tokenStore.clear();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Email atau password salah.',
  EMAIL_ALREADY_REGISTERED: 'Email sudah terdaftar.',
  INSUFFICIENT_STOCK: 'Stok tiket tidak mencukupi. Kurangi jumlah atau pilih kategori lain.',
  EVENT_NOT_AVAILABLE: 'Acara ini tidak tersedia untuk pembelian.',
  EVENT_NOT_FOUND: 'Acara tidak ditemukan.',
  CATEGORY_NOT_FOUND: 'Kategori tiket tidak ditemukan.',
  TOO_MANY_TICKETS: 'Maksimum 5 tiket per order.',
  DUPLICATE_ITEM: 'Kategori tiket yang sama tidak boleh dipilih dua kali.',
  MIXED_EVENTS: 'Satu order hanya boleh berisi tiket dari satu acara.',
  ORDER_NOT_FOUND: 'Order tidak ditemukan.',
  ORDER_NOT_PENDING: 'Order ini sudah diproses sebelumnya.',
  ORDER_EXPIRED: 'Waktu pembayaran telah habis. Silakan buat order baru.',
  TICKET_NOT_FOUND: 'Tiket tidak ditemukan.',
  SLUG_TAKEN: 'Slug sudah dipakai acara lain.',
  INVALID_TIME_RANGE: 'Waktu selesai harus setelah waktu mulai.',
  CATEGORY_NAME_TAKEN: 'Nama kategori sudah dipakai pada acara ini.',
  QUOTA_BELOW_SOLD: 'Kuota tidak boleh lebih kecil dari jumlah tiket terjual dan dicadangkan.',
  CATEGORY_HAS_ORDERS: 'Kategori sudah dipakai di order dan tidak dapat dihapus.',
  EVENT_HAS_ORDERS: 'Acara sudah memiliki order. Ubah statusnya menjadi CANCELLED, jangan dihapus.',
  INVALID_STAFF: 'Beberapa akun yang dipilih bukan petugas.',
  STAFF_NOT_FOUND: 'Petugas tidak ditemukan.',
  FORBIDDEN: 'Anda tidak memiliki izin untuk tindakan ini.',
  INVALID_SESSION: 'Sesi Anda tidak valid. Silakan masuk kembali.',
  CONSENT_REQUIRED: 'Centang persetujuan penggunaan foto terlebih dahulu.',
  INVALID_IMAGE: 'Berkas bukan gambar JPG, PNG, atau WebP yang valid.',
  PHOTO_REQUIRED: 'Pilih atau ambil foto terlebih dahulu.',
  INVALID_SLOT: 'Nomor foto tidak sesuai dengan jumlah tiket.',
  PHOTO_NOT_FOUND: 'Foto tidak ditemukan.',
};

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Tidak dapat terhubung ke server. Pastikan backend berjalan dan periksa koneksi Anda.';
    }
    const data = error.response.data as { code?: string; message?: string | string[] } | undefined;
    if (data?.code && MESSAGES[data.code]) return MESSAGES[data.code];
    if (error.response.status === 413) return 'Ukuran foto terlalu besar (maksimum 5 MB).';
    if (error.response.status === 429) return 'Terlalu banyak permintaan. Coba lagi sebentar lagi.';
    if (error.response.status === 404) return 'Data tidak ditemukan.';
    if (Array.isArray(data?.message)) return data.message.join(', ');
    if (typeof data?.message === 'string') return data.message;
  }
  return 'Terjadi kesalahan yang tidak terduga.';
}
