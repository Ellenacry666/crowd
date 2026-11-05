# Menyiapkan Lingkungan Flutter (Windows)

Dibutuhkan sebelum Tahap 5 (APK petugas). Lewati langkah yang sudah Anda lakukan.

## 1. Pasang
1. **Android Studio** (developer.android.com/studio). Ini sekaligus memasang Android SDK dan JDK. Jalankan sekali sampai wizard awal selesai.
2. **Flutter SDK** (docs.flutter.dev/get-started/install/windows): unduh ZIP versi stable, ekstrak ke `C:\src\flutter` (jangan di `Program Files` atau folder yang butuh hak admin).
3. Tambahkan `C:\src\flutter\bin` ke variabel lingkungan **Path** (Edit the system environment variables, Environment Variables, Path, New). Tutup dan buka ulang CMD.
4. Di Android Studio: **More Actions, SDK Manager**, tab *SDK Tools*, centang **Android SDK Command-line Tools**, **Android SDK Platform-Tools**, lalu Apply.

## 2. Periksa
```cmd
flutter doctor
flutter doctor --android-licenses
flutter doctor -v
```
Tekan `y` pada setiap lisensi. Target: bagian **Flutter**, **Android toolchain**, dan **Connected device** bertanda centang. Peringatan Visual Studio, Chrome, atau Edge boleh diabaikan (tidak dipakai untuk APK).

## 3. Siapkan perangkat uji (pilih salah satu)
**A. HP fisik (disarankan, karena kamera dan pemindaian QR lebih mudah diuji)**
1. Aktifkan *Developer options* (Settings, About phone, ketuk *Build number* 7 kali), lalu aktifkan **USB debugging**.
2. Sambungkan dengan kabel USB dan izinkan pada pop-up di HP.
3. `flutter devices` harus menampilkan HP Anda.

**B. Emulator**
1. Android Studio, **Device Manager, Create device** (mis. Pixel 6, gambar sistem *Google APIs*).
2. Agar kamera emulator dapat memindai QR: Advanced Settings, Camera, pilih *Webcam0* atau *VirtualScene*.

## 4. Menghubungkan APK ke backend lokal
Backend sudah mendengarkan di `0.0.0.0:3000`.

| Perangkat | Alamat API |
|---|---|
| Emulator Android | `http://10.0.2.2:3000/api/v1` (`10.0.2.2` = komputer Anda; `localhost` di emulator adalah emulator itu sendiri) |
| HP fisik | `http://<IP-komputer>:3000/api/v1` |

Untuk HP fisik:
1. Komputer dan HP harus pada **Wi-Fi yang sama**.
2. Cari IP komputer: `ipconfig`, lihat *IPv4 Address* adapter Wi-Fi (mis. `192.168.1.23`).
3. Izinkan port 3000 di Windows Firewall (CMD sebagai Administrator):
   ```cmd
   netsh advfirewall firewall add rule name="CrowdPulse API" dir=in action=allow protocol=TCP localport=3000
   ```
4. Uji dari browser HP: `http://192.168.1.23:3000/api/v1/health` harus menampilkan `"database":"up"`. Jika gagal, periksa profil jaringan Windows (harus *Private*) dan pastikan backend sedang berjalan.

Catatan: lalu lintas HTTP (bukan HTTPS) diblokir Android secara bawaan. APK debug akan dikonfigurasi mengizinkannya hanya untuk pengembangan lokal.

## 5. Kirim ke saya
Output `flutter doctor -v` (ringkasan) dan `flutter devices`.
