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

## Test yang sudah ada (Tahap 2)
- Unit: `apps/backend/src/auth/auth.service.spec.ts` (6 test)
- E2E: `apps/backend/test/auth-rbac.e2e-spec.ts` (health, registrasi, login/JWT, matriks RBAC)

Hasil aktual: **belum diisi**, menunggu eksekusi di mesin pengembang.
