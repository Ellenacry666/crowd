# CrowdPulse Gate (Flutter, Android)

Aplikasi petugas gerbang: login, pilih acara, pindai QR, **lihat foto pemegang dan nama pembeli**, lalu izinkan atau tolak masuk. Fungsinya hanya ticketing dan pemindaian; tidak ada monitoring kamera atau ML.

## Struktur
`overlay/` berisi kode aplikasi (`lib/`, `test/`). Skrip setup membuat proyek Flutter di folder ini lalu menyalin `overlay/` ke `lib/` dan `test/`. Setelah setup, **edit kode di `lib/`** (bukan di `overlay/`).

## Menyiapkan (sekali saja)
Prasyarat: Flutter dan Android SDK siap (`flutter doctor`, lihat `docs/mobile/setup-flutter.md`), Node.js.
```cmd
cd crowdpulse
scripts\setup-mobile.cmd
```
Skrip ini: `flutter create` (Android saja), `flutter pub add http flutter_secure_storage mobile_scanner` (versi otomatis cocok dengan SDK Anda), menyalin kode, menyesuaikan Android (izin kamera dan internet, minSdk 23, HTTP lokal hanya untuk debug), lalu `flutter analyze`.

## Menjalankan
Backend harus berjalan (`apps\backend`, `npm run start:dev`).
```cmd
cd apps\mobile
flutter devices
flutter run
```
Alamat API dapat diubah tanpa build ulang lewat **Pengaturan server** di layar login.
Bawaan: `http://10.0.2.2:3000/api/v1` (emulator). Untuk HP fisik: `http://<IP-komputer>:3000/api/v1`.
Atau saat build: `flutter run --dart-define=API_BASE_URL=http://192.168.1.23:3000/api/v1`.

## Build APK untuk pengujian
```cmd
flutter build apk --debug
```
Hasil: `build\app\outputs\flutter-apk\app-debug.apk`. Gunakan build **debug** untuk demo lewat HTTP di jaringan lokal. Build release memblokir HTTP; untuk release gunakan server HTTPS.

## Alur gerbang
1. Pilih acara yang ditugaskan, arahkan kamera ke QR.
2. **Pratinjau** (`POST /checkin/preview`): tidak mengubah status tiket. Tampil foto pemegang, nama pembeli, kategori.
3. Cocokkan wajah orang di depan Anda dengan foto (ketuk foto untuk memperbesar).
4. **Izinkan masuk** (`POST /checkin`, atomik, tercatat) atau **Tolak** (tiket tetap aman untuk pemilik sah).

## Perilaku keselamatan
- Server tidak terjangkau, timeout, atau galat: layar "Validasi belum dapat dilakukan"; **tidak pernah** meloloskan otomatis.
- Koneksi putus saat konfirmasi: status "belum pasti"; tombol "Periksa lagi" memanggil ulang check-in (aman, server hanya menerima satu kali).
- Token disimpan di Android Keystore (`flutter_secure_storage`); tidak ada token atau foto yang dicetak ke log. Foto hanya di memori, tidak ditulis ke disk.
- Izin kamera ditolak, kamera tidak tersedia, dan QR yang sama dipindai berulang kali ditangani di layar scanner.

## Pengujian
`flutter test` menjalankan uji unit (normalisasi alamat server, pemetaan respons API). Test case manual: `docs/testing/mobile-test-cases.md`.
