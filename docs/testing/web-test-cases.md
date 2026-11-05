# Test Case Website (manual)

Prasyarat umum: backend berjalan (`apps/backend`, `npm run start:dev`), database sudah di-seed, web berjalan di http://localhost:5173.
Kolom **Hasil aktual** dan **PASS/FAIL** diisi saat pengujian; jangan menandai PASS tanpa bukti (screenshot atau catatan).

| ID | Area | Prasyarat | Langkah | Hasil yang diharapkan | Hasil aktual | PASS/FAIL |
|---|---|---|---|---|---|---|
| W-01 | Navigasi | Belum login | Buka `/`, klik Acara, Masuk, Daftar, logo | Setiap tautan membuka halaman yang benar tanpa error | | |
| W-02 | Responsif | Belum login | Perkecil jendela ke lebar ~375 px (DevTools mobile) | Menu berubah menjadi tombol hamburger; kartu acara satu kolom; tidak ada scroll horizontal pada halaman | | |
| W-03 | Daftar acara | Seed terpasang | Buka `/events` | Tampil 2 acara terbit (Music Fest, Tech Talk); acara DRAFT tidak tampil | | |
| W-04 | Pencarian | Seed terpasang | Ketik "tech" di kotak cari | Setelah jeda singkat hanya Campus Tech Talk tampil; URL memuat `?search=tech` | | |
| W-05 | Filter kategori/tanggal | Seed terpasang | Isi kategori "Music"; lalu pilih tanggal setelah acara Music | Kategori menyaring hasil; tanggal yang lewat menghasilkan "Acara tidak ditemukan" | | |
| W-06 | Detail acara | Seed terpasang | Klik acara Music Fest | Tampil poster, tanggal, jam, lokasi, deskripsi, kategori Regular dan VIP dengan harga dan sisa tiket | | |
| W-07 | Registrasi | Email belum terdaftar | Isi form dengan data valid | Akun dibuat dan pengguna langsung masuk | | |
| W-08 | Validasi registrasi | - | Kirim form dengan password "abc" dan email "x" | Pesan validasi tampil di bawah kolom; permintaan tidak dikirim | | |
| W-09 | Email duplikat | Akun customer demo ada | Daftar dengan `customer@crowdpulse.test` | Pesan "Email sudah terdaftar." | | |
| W-10 | Login/logout | - | Masuk dengan password salah, lalu benar, lalu Keluar | Salah: pesan galat; benar: masuk; Keluar: kembali ke beranda sebagai tamu | | |
| W-11 | Akses tanpa login | Belum login | Buka langsung `/tickets` dan `/admin` | Diarahkan ke `/login`; setelah login kembali ke halaman tujuan | | |
| W-12 | Beli tiket | Login customer | Pilih 2 tiket Regular, klik Beli tiket | Diarahkan ke `/checkout/...`; total sesuai harga server; status Menunggu pembayaran | | |
| W-13 | Batas jumlah | Login customer | Tambahkan tiket sampai 5 | Tombol + nonaktif setelah total 5 | | |
| W-14 | Label simulasi | Di halaman checkout | Perhatikan halaman | Banner "SIMULASI PEMBAYARAN ... bukan transaksi uang sungguhan" tampil jelas | | |
| W-15 | Bayar berhasil | Order PENDING dengan semua foto terunggah (lihat W-32 sampai W-34) | Klik "Simulasikan pembayaran berhasil" | Status Lunas (simulasi); tampil tautan Lihat Tiket Saya | | |
| W-16 | Bayar gagal | Order PENDING baru | Klik "Simulasikan pembayaran gagal" | Status Gagal; tidak ada tiket baru di Tiket Saya; stok kembali tersedia di detail acara | | |
| W-17 | Order kedaluwarsa | Order PENDING; ubah `expiresAt` ke masa lalu lewat database atau tunggu 15 menit | Muat ulang checkout lalu klik bayar | Pesan waktu habis; tidak ada tiket | | |
| W-18 | Tiket Saya | Ada order lunas | Buka `/tickets` | Kartu tiket menampilkan QR, kode tiket, nama acara, tanggal, lokasi, kategori, status bayar, status penggunaan | | |
| W-19 | QR dapat dipindai | Tiket aktif | Pindai QR dengan aplikasi pembaca QR di ponsel | Isi berformat `CP1.<kode>.<signature>`; tidak memuat nama atau email | | |
| W-20 | Status setelah dipindai | Tiket sudah di-check-in (via Swagger atau APK) | Fokus ulang tab atau klik Muat ulang | Tiket berstatus Sudah digunakan; QR diberi cap dan diredupkan | | |
| W-21 | Data pengguna lain | Dua akun customer | Salin ID tiket milik A, login sebagai B, buka API `/tickets/{id}` atau coba lewat Swagger | Respons 404; B tidak melihat tiket A di Tiket Saya | | |
| W-22 | Akses admin ditolak | Login customer | Buka `/admin` | Halaman "tidak tersedia untuk akun ini" | | |
| W-23 | Akun petugas di web | Login staff | Buka `/tickets` | Halaman informasi bahwa petugas memakai aplikasi Android | | |
| W-24 | Dashboard admin | Login admin | Buka `/admin` | Kartu ringkasan (acara, order lunas, tiket, check-in) dan 5 order terbaru dari database | | |
| W-25 | CRUD acara | Login admin | Buat acara baru (status Terbit), ubah lokasi, hapus acara tanpa order | Acara tampil di daftar publik saat Terbit; perubahan tersimpan; hapus berhasil | | |
| W-26 | Kategori dan kuota | Acara baru | Tambah kategori; ubah kuota; coba kuota di bawah jumlah terjual | Kuota valid tersimpan; kuota terlalu kecil ditolak dengan pesan jelas | | |
| W-27 | Hapus acara berorder | Acara yang sudah punya order | Klik Hapus | Ditolak dengan pesan agar memakai status CANCELLED | | |
| W-28 | Penugasan petugas | Ada akun petugas | Centang petugas pada halaman acara, simpan | Pesan berhasil; petugas melihat acara di APK/`/staff/events` | | |
| W-29 | Order dan tiket admin | Ada order lunas | Buka `/admin/orders` dan `/admin/tickets`, gunakan filter | Data sesuai; tiket admin tidak menampilkan QR | | |
| W-30 | Laporan | Ada penjualan dan check-in | Buka `/admin/reports`, pilih acara | Tabel penjualan dan ringkasan check-in sesuai database | | |
| W-31 | Backend mati | Hentikan backend | Muat ulang halaman acara | Pesan "Tidak dapat terhubung ke server" dengan tombol Coba lagi; tidak ada layar kosong | | |
| W-32 | Foto wajib | Order PENDING dengan 3 tiket | Buka checkout tanpa mengunggah foto | Tampil 3 kartu "Pemegang tiket"; tombol "Simulasikan pembayaran berhasil" nonaktif dengan pesan "0 dari 3" | | |
| W-33 | Persetujuan | Checkout dengan foto kosong | Sebelum mencentang persetujuan, coba klik "Ambil selfie" atau "Pilih dari galeri" | Tombol nonaktif sampai persetujuan dicentang | | |
| W-34 | Unggah dari galeri dan kamera | Persetujuan dicentang | Pilih foto dari galeri untuk slot 1; ambil selfie lewat kamera untuk slot 2; ulangi sampai semua slot terisi | Pratinjau tampil di setiap slot; progres bertambah; setelah semua terisi tombol bayar aktif | | |
| W-35 | Izin kamera ditolak | Browser | Tolak izin kamera saat diminta | Pesan jelas dan opsi galeri tetap dapat dipakai; kamera mati saat modal ditutup (lampu kamera padam) | | |
| W-36 | Berkas bukan gambar | Checkout | Pilih berkas PDF atau .txt dari galeri | Pesan "Berkas harus berupa gambar"; tidak ada unggahan | | |
| W-37 | Foto identik | Checkout dengan 2 tiket | Unggah berkas yang sama persis ke slot 1 dan 2 | Slot 2 ditolak dengan pesan foto identik | | |
| W-38 | Ganti foto | Slot terisi | Klik "Selfie ulang" dan unggah foto lain | Pratinjau berganti; jumlah terunggah tetap | | |
| W-39 | Foto tampil di tiket | Order lunas | Buka Tiket Saya | Setiap kartu tiket menampilkan foto pemegangnya | | |
| W-40 | Foto dihapus saat gagal | Order PENDING dengan sebagian foto | Klik "Simulasikan pembayaran gagal" | Status Gagal; foto tidak lagi dapat dibuka (cek lewat Swagger: `GET /orders/{id}/photos` menunjukkan 0 terunggah) | | |
| W-41 | Foto tidak publik | Order lunas | Buka tab baru ke `http://localhost:3000/api/v1/tickets/{id}/photo` tanpa token | 401; foto tidak tampil | | |
| W-42 | Foto di dashboard admin | Order lunas | Buka `/admin/tickets` | Kolom Foto menampilkan miniatur pemegang | | |
| W-43 | Batas per akun per acara | Customer baru, acara dengan stok cukup | Beli 5 tiket sampai lunas, lalu buka kembali halaman acara yang sama | Tampil peringatan batas 5 tiket tercapai; tombol + dan Beli tiket nonaktif; tautan ke Pesanan Saya | | |
| W-44 | Batas kumulatif | Customer baru | Beli 2 tiket (biarkan menunggu pembayaran), kembali ke halaman acara | Tampil "sisa 3 dari 5"; hanya bisa memilih sampai 3 tiket | | |
| W-45 | Dua tab | Customer dengan sisa jatah 1 | Buka halaman acara di dua tab, beli 1 di tab A, lalu beli 1 di tab B tanpa memuat ulang | Tab B menampilkan pesan batas tercapai dari server, pilihan di-reset, dan jatah diperbarui | | |
| W-46 | Jatah kembali | Order 5 tiket menunggu pembayaran | Klik "Simulasikan pembayaran gagal", lalu buka halaman acara | Sisa jatah kembali 5 dan pembelian bisa dilakukan lagi | | |
| W-47 | Acara lain | Sudah memiliki 5 tiket di acara A | Buka acara B | Jatah acara B penuh (5 dari 5) | | |

