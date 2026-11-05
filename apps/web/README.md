# CrowdPulse Web (React + Vite + TypeScript + Tailwind)

Website pengunjung dan dashboard admin/EO. Semua data berasal dari backend (`apps/backend`); tidak ada data acara yang di-hardcode.

## Menjalankan (Windows CMD)
```cmd
cd apps\web
copy .env.example .env
npm install
npm run typecheck
npm run dev
```
Buka **http://localhost:5173** (gunakan `localhost`, bukan `127.0.0.1`, karena CORS backend hanya mengizinkan `http://localhost:5173`).
Backend harus berjalan di http://localhost:3000 (`npm run start:dev` di `apps\backend`).

Port 5173 dikunci (`strictPort`). Jika port dipakai aplikasi lain, tutup aplikasi itu atau ubah `CORS_ORIGINS` di backend dan port di `vite.config.ts`.

## Akun demo
| Peran | Email | Password |
|---|---|---|
| Admin/EO | admin@crowdpulse.test | Admin123! |
| Pengunjung | customer@crowdpulse.test | Customer123! |
| Petugas | staff@crowdpulse.test | Staff123! (hanya untuk APK; di web akan diarahkan ke halaman informasi) |

## Halaman
| Rute | Akses | Isi |
|---|---|---|
| `/` | Publik | Landing, acara terdekat |
| `/events` | Publik | Daftar acara: pencarian, filter kategori dan tanggal, paginasi (state di URL) |
| `/events/:slug` | Publik | Detail acara, kategori tiket, harga, ketersediaan, pilih jumlah |
| `/login`, `/register` | Tamu | Autentikasi dengan validasi formulir |
| `/checkout/:orderId` | Pengunjung | Ringkasan order, hitung mundur, **simulasi pembayaran** (berlabel jelas) |
| `/orders` | Pengunjung | Riwayat pesanan |
| `/tickets` | Pengunjung | Tiket Saya: QR Code, kode tiket, status bayar, status penggunaan |
| `/profile` | Login | Profil dan keluar |
| `/admin` | Admin | Ringkasan |
| `/admin/events`, `/admin/events/new`, `/admin/events/:id` | Admin | CRUD acara, kategori dan kuota, penugasan petugas |
| `/admin/orders`, `/admin/tickets` | Admin | Daftar order dan tiket terbit |
| `/admin/staff` | Admin | Akun petugas |
| `/admin/reports` | Admin | Penjualan per kategori dan ringkasan check-in |

## Catatan keamanan
- Pembatasan halaman di frontend hanya untuk tampilan. Backend memvalidasi peran dan kepemilikan data di setiap endpoint.
- Frontend tidak pernah mengirim harga atau status pembayaran; harga dan status ditentukan backend.
- Token JWT disimpan di `localStorage` (cukup untuk proyek akademik; produksi sebaiknya cookie httpOnly).
- Semua teks dari server dirender oleh React (di-escape otomatis); tidak ada `dangerouslySetInnerHTML`.
