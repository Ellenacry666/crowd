@echo off
REM Menyiapkan proyek Flutter apps\mobile (Windows CMD).
REM Jalankan dari folder root: scripts\setup-mobile.cmd
setlocal
cd /d "%~dp0..\apps\mobile" || (echo Folder apps\mobile tidak ditemukan & exit /b 1)

where flutter >nul 2>nul
if errorlevel 1 (
  echo [GAGAL] Flutter tidak ditemukan di PATH. Lihat docs\mobile\setup-flutter.md
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo [GAGAL] Node.js tidak ditemukan di PATH.
  exit /b 1
)

if not exist android (
  echo.
  echo === 1/5 flutter create ===
  call flutter create --org com.crowdpulse --project-name crowdpulse_gate --platforms android .
  if errorlevel 1 exit /b 1
) else (
  echo === 1/5 proyek Android sudah ada, dilewati ===
)

echo.
echo === 2/5 menambah paket (versi mengikuti SDK Anda) ===
call flutter pub add http flutter_secure_storage mobile_scanner
if errorlevel 1 exit /b 1

echo.
echo === 3/5 menyalin kode aplikasi ===
xcopy /E /Y /I /Q overlay\lib lib >nul
xcopy /E /Y /I /Q overlay\test test >nul

echo.
echo === 4/5 menyesuaikan Android (izin, minSdk, HTTP lokal untuk debug) ===
node "%~dp0patch-android.js"
if errorlevel 1 exit /b 1

REM Folder overlay hanya sumber salinan; jangan ikut dianalisis.
findstr /C:"overlay/**" analysis_options.yaml >nul 2>nul
if errorlevel 1 (
  >>analysis_options.yaml echo.
  >>analysis_options.yaml echo analyzer:
  >>analysis_options.yaml echo   exclude:
  >>analysis_options.yaml echo     - overlay/**
)

echo.
echo === 5/5 analisis kode ===
call flutter pub get
call flutter analyze
echo.
echo Selesai. Jalankan: cd apps\mobile ^&^& flutter run
endlocal
