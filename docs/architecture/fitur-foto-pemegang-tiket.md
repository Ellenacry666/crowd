# Fitur Foto Pemegang Tiket (anti-calo)

Status: diimplementasikan di backend dan website. Tampilan petugas di APK dikerjakan di Tahap 5.
Permintaan pemilik proyek: pembelian tiket mewajibkan foto (selfie atau dari galeri) sejumlah tiket yang dibeli, dengan orang berbeda untuk setiap tiket, untuk meminimalkan calo.

## Apa yang dikerjakan
| Aspek | Implementasi |
|---|---|
| Syarat pembelian | Pembayaran sukses ditolak (409 `PHOTOS_REQUIRED`) sampai ada satu foto untuk setiap tiket. Order tetap PENDING dan stok tetap dicadangkan sampai kedaluwarsa. |
| Sumber foto | Kamera langsung (browser, HTTPS atau localhost), kamera depan ponsel (`capture="user"`), atau galeri |
| Pemrosesan di browser | Diperkecil (sisi terpanjang 1024 px), disimpan ulang sebagai JPEG, metadata EXIF (mis. GPS) dibuang |
| Validasi server | Magic bytes JPEG/PNG/WebP (bukan Content-Type atau ekstensi), maks 5 MB, slot 1..jumlah tiket, hanya order PENDING milik pengunjung dan belum kedaluwarsa |
| Anti-duplikat teknis | Hash SHA-256: foto identik pada dua slot dalam satu order ditolak (409 `DUPLICATE_PHOTO`) |
| Penyimpanan | Disk di luar folder publik (`UPLOAD_DIR`), nama acak UUID, izin file 0600. Tabel `order_photos`; tiket menaut lewat `tickets.holderPhotoId` |
| Akses melihat | Pemilik tiket, admin, dan petugas yang ditugaskan ke acara tersebut. Selain itu 404. Header `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`. Tidak ada URL publik |
| Persetujuan | Checkbox wajib di UI; backend menolak unggahan tanpa `consent=true` (400 `CONSENT_REQUIRED`) dan menyimpan `consentAt` |
| Minimisasi data | Foto dihapus (baris dan berkas) bila pembayaran gagal atau order kedaluwarsa |
| Integritas | Unggahan mengunci baris order sehingga foto yang sudah ditautkan ke tiket tidak dapat berubah; order PAID tidak dapat diubah fotonya |

## Batas yang harus dipahami (jujur)
1. **"Orang yang berbeda" tidak dapat dijamin oleh sistem ini.** Sistem hanya menolak berkas yang identik. Satu orang yang memotret dirinya dua kali, atau memakai foto orang lain, tidak terdeteksi. Memastikan wajah berbeda membutuhkan pengenalan/verifikasi wajah (ML), yang dikecualikan di bagian 14 spesifikasi awal dan menambah risiko privasi dan akurasi (bias, spoofing). Pengamanan yang berlaku: **pencocokan visual oleh petugas di gerbang** (foto pemegang ditampilkan di APK).
2. **Bukan bukti kehadiran langsung (liveness).** Foto dari galeri dapat berupa foto lama atau foto layar. Selfie kamera lebih sulit dipalsukan tetapi tidak dijamin.
3. **Validasi gambar hanya memeriksa byte awal**, bukan mendekode gambar. Browser selalu menyimpan ulang sebagai JPEG sungguhan; klien lain (API langsung) dapat mengirim berkas berawalan JPEG yang rusak. Dampaknya hanya gambar tidak tampil, bukan celah eksekusi, karena berkas tidak pernah dieksekusi dan selalu disajikan dengan tipe gambar dan `nosniff`.
4. **Foto tiket yang sudah dibayar belum dihapus otomatis.** Kebijakan retensi belum ditetapkan (lihat keputusan di bawah).
5. **Penyimpanan disk lokal** cocok untuk demo. Produksi memerlukan penyimpanan terkelola, enkripsi saat disimpan, backup, dan pencadangan yang mematuhi kebijakan privasi.

## Dasar pertimbangan privasi
Foto wajah termasuk data pribadi yang sensitif (di Indonesia diatur UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi; konsultasikan dengan dosen pembimbing atau pihak berwenang untuk penerapan nyata). Prinsip yang dipakai: tujuan terbatas (verifikasi tiket), persetujuan eksplisit, akses minimum, tanpa URL publik, tanpa cache, dan penghapusan bila transaksi tidak selesai.

## Keputusan yang masih menunggu pemilik proyek
1. **Retensi foto tiket PAID**: dihapus otomatis N hari setelah acara selesai (disarankan), atau disimpan selama akun aktif?
2. **Alur gerbang di APK (Tahap 5)**: endpoint pratinjau `POST /checkin/preview` sudah tersedia di backend (tanpa mengubah status). Alur yang disarankan dua langkah, yaitu pindai lalu tampil foto pemegang (belum mengubah status), kemudian petugas menekan "Izinkan masuk" yang baru memanggil check-in. Ini mencegah tiket "terbakar" bila petugas menolak orang yang tidak cocok. Endpoint pratinjau belum ada. Setujui atau pilih alur lain (check-in langsung lalu foto ditampilkan sesudahnya).
3. **Pencocokan wajah otomatis**: tidak dikerjakan. Jika tetap diinginkan, harus disetujui sebagai perubahan ruang lingkup dan memerlukan kajian privasi.
