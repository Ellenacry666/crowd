# Fitur Crowd Monitoring — ringkasan perubahan

## Menjalankan
```bash
# 1) Backend
cd backend
npm install
npx prisma migrate deploy      # menerapkan migration 20260401000000_crowd_monitoring
npm run db:seed                # membuat event demo "Konser Live Demo" (kamera + lineup + riwayat)
npm run start:dev

# 2) Simulator kamera (opsional, agar dashboard bergerak live)
npm run sim:crowd

# 3) Web admin
cd ../admin-web
npm install && npm run dev     # http://localhost:5174
```
Login: `admin@crowdpulse.test` / `Admin123!`

## Endpoint baru (backend)
| Method | Path | Auth |
|---|---|---|
| POST | `/crowd/ingest` | header `x-camera-key` (dari layanan analisis kamera) |
| GET | `/admin/events/:id/crowd/dashboard?minutes=60` | ADMIN |
| GET/POST | `/admin/events/:id/cameras` | ADMIN |
| PATCH/DELETE | `/admin/cameras/:id` | ADMIN |
| POST | `/admin/cameras/:id/rotate-key` | ADMIN |
| GET/POST | `/admin/events/:id/lineups` | ADMIN |
| PATCH/DELETE | `/admin/lineups/:id` | ADMIN |

Payload ingest: kamera CROWD → `{"peopleCount": 842}`; kamera GATE → `{"inCount": 12, "outCount": 3}`; opsional `capturedAt`, `density`.

## File backend yang berubah
- `prisma/schema.prisma` (+ model Camera, CrowdSnapshot, Lineup) dan migration baru
- `src/crowd/*`, `src/lineups/*` (baru), `src/app.module.ts`, `src/events/events.service.ts` (hapus event ikut membersihkan data baru)
- `prisma/seed.ts`, `scripts/simulate-crowd.ts`, `package.json` (script `sim:crowd`), `.env.example`, `test/helpers.ts`

## Penugasan petugas & statistik check-in (pembaruan)
- Menu admin **Penugasan Petugas** (`/staff`) dan kartu **Petugas gerbang** di halaman kelola acara memakai
  `GET /admin/staff` dan `PUT /admin/events/:id/staff` (PUT mengganti seluruh daftar, jadi UI selalu mengirim daftar lengkap).
- Acara baru muncul di APK petugas hanya jika: berstatus **Terbit (PUBLISHED)** DAN ditugaskan ke akun petugas tsb.
- Statistik tiket: `GET /admin/reports/events/:eventId/checkin-stats` (sumber: tabel tiket saja).
- Monitoring kamera: `GET /admin/events/:id/crowd/dashboard` (sumber: kamera saja; tidak lagi memuat data tiket).

## Halaman admin baru: Akun Petugas & Penjualan Tiket
- **Akun Petugas** (`/staff/accounts`): `GET/POST /admin/staff`, `PATCH /admin/staff/:id` (ubah nama, ganti password, aktif/nonaktif).
- **Penjualan Tiket** (`/sales`): `GET /admin/reports/sales`, `GET /admin/reports/summary`, `GET /admin/orders`,
  `POST /admin/events/:id/ticket-categories`, `PATCH/DELETE /admin/ticket-categories/:id`. Pendapatan berasal dari pembayaran simulasi.
- Tidak ada perubahan backend untuk kedua halaman ini.
