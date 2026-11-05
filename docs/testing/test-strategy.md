# Strategi Pengujian

| Level | Alat | Cakupan |
|---|---|---|
| Unit | Jest | Service: perhitungan harga, transisi status, signer QR, aturan check-in |
| Integrasi/E2E backend | Jest + Supertest + database `crowdpulse_test` terpisah | Auth, RBAC, CRUD, order, pembayaran, tiket, check-in, kepemilikan |
| Concurrency | Jest: `Promise.all` dengan N request paralel | (a) 2 check-in bersamaan pada 1 tiket: tepat 1 SUCCESS. (b) N order paralel pada kuota K: terjual+cadangan tidak melebihi K |
| Web | Pengujian manual terstruktur + Vitest/React Testing Library (opsional) | Navigasi, responsif, form, alur beli, akses data |
| APK | Manual di emulator dan HP fisik + widget test sederhana | Scan valid/invalid/ganda, event berbeda, offline, timeout |
| E2E sistem | Skenario 12 langkah dari prompt | Dicatat dalam tabel test case |

Format test case: ID, prasyarat, langkah, hasil diharapkan, hasil aktual, PASS/FAIL, bukti (screenshot atau log).
Tidak ada klaim "berhasil" tanpa bukti.

## Skenario E2E 12 langkah
1. Admin login.
2. Admin membuat acara dan kategori tiket.
3. Pengunjung mendaftar dan login.
4. Pengunjung membeli tiket.
5. Pembayaran simulasi berhasil.
6. Backend menerbitkan tiket dan QR.
7. Pengunjung membuka "Tiket Saya".
8. Petugas login melalui APK.
9. Petugas memindai QR.
10. Backend menerima check-in pertama.
11. QR yang sama dipindai kembali dan ditolak.
12. Status tiket dan riwayat check-in sesuai hasil yang diharapkan.

## Test otomatis yang sudah ada

| Berkas | Jenis | Cakupan |
|---|---|---|
| `src/auth/auth.service.spec.ts` | Unit (6) | Login, register, hash argon2, email duplikat |
| `src/common/qr/qr-signer.spec.ts` | Unit (6) | Kode tiket acak, payload HMAC, deteksi pemalsuan |
| `test/auth-rbac.e2e-spec.ts` | E2E | Registrasi, login, JWT, token palsu, akun nonaktif, matriks RBAC |
| `test/events-categories.e2e-spec.ts` | E2E | CRUD acara, slug, validasi, akses publik, kategori, kuota, penghapusan |
| `test/orders-payments.e2e-spec.ts` | E2E + concurrency | Harga dari DB, reservasi stok, pembayaran sukses/gagal, tiket terbit, kedaluwarsa, kepemilikan data, overselling paralel, pembayaran ganda paralel |
| `test/checkin.e2e-spec.ts` | E2E + concurrency | Alur lengkap, semua hasil penolakan, otorisasi petugas, check-in ganda paralel, riwayat |
| `test/staff-reports.e2e-spec.ts` | E2E | Akun petugas, penugasan, penonaktifan, laporan |
| `test/checkin-preview.e2e-spec.ts` | E2E | Pratinjau tidak mengubah status/log, data minimal (tanpa email/token), alur dua langkah, penolakan tanpa kebocoran, otorisasi |
| `test/ticket-limit.e2e-spec.ts` | E2E + concurrency | Batas 5 tiket per akun per acara: kumulatif lintas order, PAID dan PENDING dihitung, FAILED/kedaluwarsa mengembalikan jatah, acara dan akun lain tidak terpengaruh, 8 order paralel tidak menembus batas, endpoint jatah |
| `test/photos.e2e-spec.ts` | E2E | Syarat foto per tiket sebelum bayar, validasi unggahan (tipe sejati, ukuran, persetujuan, slot, duplikat), penggantian foto, penghapusan saat gagal/kedaluwarsa, hak akses melihat foto |
| `src/photos/image-validation.spec.ts` | Unit (3) | Deteksi tipe gambar dari magic bytes |

## Pemetaan ke kriteria keberhasilan

| Kriteria | Dicakup oleh |
|---|---|
| SC-01 RBAC admin | auth-rbac (matriks), events-categories, orders-payments, staff-reports |
| SC-02 kepemilikan data | orders-payments "Kepemilikan data" |
| SC-03 harga dari DB | orders-payments "harga selalu dari database" |
| SC-04 tanpa overselling | orders-payments "Concurrency" (2 test) |
| SC-05 tiket hanya setelah PAID | orders-payments (belum bayar, FAILED, EXPIRED) |
| SC-06 check-in ganda paralel | checkin "Concurrency" |
| SC-07 scan kedua tidak mengubah data | checkin "alur lengkap" |
| SC-08 semua penolakan tercatat | checkin "Penolakan" dan "Otorisasi" |
| SC-09 APK offline | Tahap 5 (manual) |
| SC-10 E2E 12 langkah | Bagian backend: checkin "alur lengkap"; Web dan APK di Tahap 4-6 |
| SC-11 flag simulasi | orders-payments "flag PAYMENT_SIMULATION_ENABLED=false" |
| SC-12 tanpa rahasia di repo | Review manual |

## Hasil aktual

**Belum diisi.** Tabel hasil (PASS/FAIL beserta bukti) dibuat setelah test dijalankan di mesin pengembang. Perintah: `npm test` dan `npm run test:e2e` di `apps/backend`.
