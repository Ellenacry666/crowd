# CrowdPulse Admin Web

Frontend admin (React + Vite + TypeScript) untuk backend CrowdPulse.

## Fitur
- **Dashboard Crowd Monitoring** — hasil analisis 2 kamera, auto-refresh 5 detik:
  - *Kamera Gate*: total masuk/keluar, perkiraan orang di dalam, arus 5 menit terakhir, perbandingan dengan check-in QR, grafik masuk/keluar.
  - *Kamera Crowd*: jumlah orang saat ini, okupansi vs kapasitas, level (Lengang/Sedang/Padat/Kritis), rata-rata & puncak, grafik dengan penanda jadwal penampil.
  - *Kerumunan per penampil*: rata-rata, puncak, dan kenaikan dibanding 15 menit sebelum tampil.
- **Acara**: daftar, tambah, ubah, hapus.
- **Kelola acara**: kamera (gate/crowd + API key), **lineup** (guest star), kategori tiket.

## Menjalankan
```bash
cp .env.example .env     # sesuaikan VITE_API_URL bila perlu
npm install
npm run dev              # http://localhost:5174
npm test                 # smoke test dashboard
npm run build
```
Origin web ini harus ada di `CORS_ORIGINS` backend (default `http://localhost:5174` sudah sesuai).

Login demo (dari seed): `admin@crowdpulse.test` / `Admin123!`
