# Test Case APK Petugas (manual)

Prasyarat umum: backend berjalan, seed terpasang, akun `staff@crowdpulse.test` / `Staff123!` ditugaskan ke acara demo, ada tiket lunas dengan foto (beli lewat website; QR tampil di Tiket Saya), HP/emulator terhubung ke server.
Isi **Hasil aktual** dan **PASS/FAIL** saat menguji; sertakan screenshot untuk bukti.

| ID | Area | Prasyarat | Langkah | Hasil yang diharapkan | Hasil aktual | PASS/FAIL |
|---|---|---|---|---|---|---|
| M-01 | Konfigurasi server | HP fisik | Layar login, buka Pengaturan server, isi `http://<IP>:3000/api/v1`, Simpan dan uji | "Terhubung ke server." | | |
| M-02 | Login petugas | M-01 lulus | Masuk dengan akun petugas | Masuk ke daftar acara | | |
| M-03 | Login salah | - | Password salah | Pesan "Email atau password salah." | | |
| M-04 | Akun non-petugas | - | Masuk dengan akun customer atau admin | Ditolak: "hanya untuk akun petugas gerbang"; tidak ada sesi tersimpan | | |
| M-05 | Daftar acara | Login | Lihat daftar | Hanya acara yang ditugaskan; statistik check-in tampil | | |
| M-06 | Izin kamera | Pertama kali | Buka scanner, tekan Izinkan | Kamera aktif | | |
| M-07 | Izin kamera ditolak | Cabut izin kamera di Pengaturan | Buka scanner | Pesan jelas dan tombol Coba lagi; aplikasi tidak crash | | |
| M-08 | Pratinjau valid | Tiket aktif | Pindai QR dari website | "TIKET VALID"; foto pemegang, nama pembeli, kategori, kode tampil; **status tiket di database masih ACTIVE** | | |
| M-09 | Perbesar foto | M-08 | Ketuk foto | Foto tampil penuh dan dapat di-zoom | | |
| M-10 | Izinkan masuk | M-08 | Tekan "Izinkan masuk" | "BERHASIL CHECK-IN" hijau dengan waktu; tiket USED; riwayat bertambah | | |
| M-11 | Tolak | Tiket aktif baru | Pindai, tekan Tolak lalu konfirmasi | Kembali ke scanner; tiket **tetap ACTIVE** dan dapat dipakai lagi | | |
| M-12 | Tiket terpakai | Tiket dari M-10 | Pindai ulang | Merah "TIKET SUDAH DIGUNAKAN" dengan waktu check-in pertama; data check-in pertama tidak berubah | | |
| M-13 | QR bukan CrowdPulse | - | Pindai QR sembarang (mis. URL) | Pesan "QR ini bukan tiket CrowdPulse" tanpa pemanggilan server | | |
| M-14 | QR palsu | Ubah satu karakter payload CP1 (buat QR dari generator) | Pindai | Merah "TIKET TIDAK VALID" | | |
| M-15 | Acara berbeda | Dua acara; tiket acara A | Pilih acara B lalu pindai tiket A | Merah "TIKET BUKAN UNTUK ACARA INI"; tiket A tetap ACTIVE | | |
| M-16 | Tidak ditugaskan | Cabut penugasan petugas dari acara lewat dashboard | Pindai | Pesan tidak berwenang; upaya tercatat di log server | | |
| M-17 | Server mati (pratinjau) | Hentikan backend | Pindai QR | "Validasi belum dapat dilakukan" + "Jangan izinkan masuk"; tombol Coba lagi; **tidak ada** tombol masuk | | |
| M-18 | Timeout | Putuskan Wi-Fi HP | Pindai QR | Pesan timeout/koneksi dalam kurang lebih 12 detik; tidak meloloskan | | |
| M-19 | Koneksi putus saat konfirmasi | Pada layar pratinjau, matikan Wi-Fi lalu tekan Izinkan masuk | Amati | "STATUS BELUM PASTI"; nyalakan Wi-Fi, tekan Periksa lagi; hasil SUCCESS atau ALREADY_USED, tidak pernah tiket ganda | | |
| M-20 | Pemindaian berulang | Tiket aktif | Tahan kamera pada QR yang sama saat layar pemeriksaan terbuka/baru ditutup | Layar pemeriksaan tidak terbuka berulang-ulang | | |
| M-21 | Tanpa foto | Tiket lama tanpa foto (data uji) | Pindai | Peringatan "TIDAK ADA FOTO", verifikasi manual | | |
| M-22 | Riwayat | Beberapa pemindaian | Buka tab Riwayat | Daftar milik petugas ini saja (SUCCESS, ALREADY_USED, dst.), terbaru di atas; "Muat lebih banyak" bekerja | | |
| M-23 | Sesi berakhir | Nonaktifkan akun petugas lewat dashboard | Lakukan aksi di APK | Kembali ke layar login dengan pesan sesi berakhir | | |
| M-24 | Keluar | Login | Profil, Keluar | Kembali ke login; membuka ulang aplikasi tidak masuk otomatis | | |
| M-25 | Lampu senter | Ruangan gelap | Tekan ikon senter | Senter menyala dan mati | | |
