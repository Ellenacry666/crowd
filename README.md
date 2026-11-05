# CrowdPulse Ticketing — Tahap 1 sampai 4 (Backend + Website)

Monorepo: `apps/backend` (NestJS + Prisma + PostgreSQL). `apps/web` (React + Vite + Tailwind, Tahap 4, lihat `apps/web/README.md`) dan `apps/mobile` (Flutter, Tahap 5, belum dibuat).

Dokumen perencanaan Tahap 1: `docs/architecture/tahap-1-perencanaan.md`, `docs/api/endpoints.md`, `docs/testing/test-strategy.md`.

> Status: kode belum diverifikasi di mesin pengembang. Jalankan checklist di bawah dan laporkan hasilnya.

## Prasyarat
- Node.js 20 LTS atau 22 LTS
- Docker Desktop (berjalan)
- PowerShell (Windows)

## Cara cepat (otomatis)
```powershell
cd crowdpulse
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```
Skrip ini: menjalankan PostgreSQL (port 5433), membuat `.env` dengan secret acak, `npm install`, migration, seed, dan migration database test.

## Cara manual
```powershell
cd crowdpulse
Copy-Item .env.example .env
docker compose up -d
cd apps\backend
Copy-Item .env.example .env
Copy-Item .env.test.example .env.test
# Isi JWT_SECRET dan QR_SECRET di .env (min. 32 karakter acak):
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run test:db:migrate
```
Jika database `crowdpulse_test` belum ada (volume lama):
`docker exec crowdpulse-db psql -U crowdpulse -d crowdpulse -c "CREATE DATABASE crowdpulse_test;"`

## Menjalankan
```powershell
cd apps\backend
npm run build
npm test
npm run test:e2e
npm run start:dev
```
- Swagger: http://localhost:3000/api/docs
- Health: http://localhost:3000/api/v1/health

## Akun demo (hanya pengembangan)
| Role | Email | Password |
|---|---|---|
| ADMIN | admin@crowdpulse.test | Admin123! |
| GATE_STAFF | staff@crowdpulse.test | Staff123! |
| CUSTOMER | customer@crowdpulse.test | Customer123! |

## Catatan
- Endpoint sementara `/admin/ping`, `/staff/ping`, `/customer/ping` sudah dihapus; RBAC diuji pada endpoint asli.
- Tahap 3 tidak menambah dependensi baru dan tidak menambah migration. Cukup salin kode baru, lalu jalankan build dan test.
- Kontrak API untuk web dan APK: `docs/api/contract.md`.
- Setelah mengubah `schema.prisma`, gunakan `npm run db:migrate` (bukan `migrate deploy`).
- Migration `init` ditulis tangan (termasuk CHECK constraint). Jika `prisma migrate dev` meminta membuat migration tambahan karena perbedaan kecil, kirimkan outputnya.

## Pembaruan: foto pemegang tiket (anti-calo)
Dokumen keputusan dan batasannya: `docs/architecture/fitur-foto-pemegang-tiket.md`.
Menambah migration baru, jadi **hentikan backend lebih dulu** (agar file Prisma tidak terkunci di Windows), lalu di `apps\backend`:
```cmd
npx prisma migrate deploy
npx prisma generate
npm run test:db:migrate
```
Opsional: tambahkan `UPLOAD_DIR=./storage/photos` ke `.env` (nilai bawaan sudah sama). Folder `storage/` tidak boleh di-commit.

## Website (Tahap 4)
Lihat `apps/web/README.md`. Test case manual: `docs/testing/web-test-cases.md`.

## Aplikasi petugas (Tahap 5)
Lihat `apps/mobile/README.md` (setup: `scripts\setup-mobile.cmd`). Test case manual: `docs/testing/mobile-test-cases.md`.
