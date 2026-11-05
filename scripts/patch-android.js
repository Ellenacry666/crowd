// Menyesuaikan proyek Android hasil `flutter create` untuk CrowdPulse Gate:
//  - minSdk minimal 23 (dibutuhkan flutter_secure_storage)
//  - izin INTERNET dan CAMERA, kamera tidak wajib, allowBackup=false (token tidak ikut backup)
//  - HTTP (cleartext) HANYA untuk build debug, lewat manifest debug
// Aman dijalankan berulang kali. Jalankan dari folder root: node scripts/patch-android.js
const fs = require('fs');
const path = require('path');

const app = path.resolve(__dirname, '..', 'apps', 'mobile', 'android', 'app');
const log = (m) => console.log(m);
const warn = (m) => console.log('PERLU TINDAKAN MANUAL: ' + m);

function read(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}
function write(p, s) {
  fs.writeFileSync(p, s, 'utf8');
}

// ---------------------------------------------------------------- minSdk
let patchedGradle = false;
for (const name of ['build.gradle.kts', 'build.gradle']) {
  const p = path.join(app, name);
  let s = read(p);
  if (s === null) continue;
  const kotlin = name.endsWith('.kts');

  if (/maxOf\(flutter\.minSdkVersion,\s*23\)|Math\.max\(flutter\.minSdkVersion,\s*23\)/.test(s)) {
    log(`[${name}] minSdk sudah diatur (>= 23).`);
    patchedGradle = true;
    break;
  }
  const viaFlutter = /(minSdk(?:Version)?)(\s*=\s*|\s+)flutter\.minSdkVersion/;
  const literal = /(minSdk(?:Version)?)(\s*=\s*|\s+)(\d+)/;
  if (viaFlutter.test(s)) {
    s = s.replace(viaFlutter, (_m, key, sep) =>
      kotlin ? `${key}${sep}maxOf(flutter.minSdkVersion, 23)` : `${key}${sep}Math.max(flutter.minSdkVersion, 23)`);
    write(p, s);
    log(`[${name}] minSdk dipastikan minimal 23.`);
    patchedGradle = true;
  } else if (literal.test(s)) {
    s = s.replace(literal, (_m, key, sep, n) => `${key}${sep}${Math.max(Number(n), 23)}`);
    write(p, s);
    log(`[${name}] minSdk dinaikkan menjadi minimal 23.`);
    patchedGradle = true;
  }
  break;
}
if (!patchedGradle) {
  warn('minSdk tidak ditemukan di android/app/build.gradle(.kts). Ubah secara manual menjadi minimal 23.');
}

// ---------------------------------------------------------------- manifest utama
const mainManifest = path.join(app, 'src', 'main', 'AndroidManifest.xml');
let m = read(mainManifest);
if (m === null) {
  warn('android/app/src/main/AndroidManifest.xml tidak ditemukan.');
} else {
  let changed = false;
  const wanted = [
    '<uses-permission android:name="android.permission.INTERNET"/>',
    '<uses-permission android:name="android.permission.CAMERA"/>',
    '<uses-feature android:name="android.hardware.camera" android:required="false"/>',
  ];
  const missing = wanted.filter((line) => {
    const key = /android:name="([^"]+)"/.exec(line)[1];
    return !m.includes(`android:name="${key}"`);
  });
  if (missing.length > 0) {
    m = m.replace(/<manifest[^>]*>/, (tag) => `${tag}\n    ${missing.join('\n    ')}`);
    changed = true;
  }
  if (!/android:allowBackup=/.test(m)) {
    m = m.replace(/<application/, '<application\n        android:allowBackup="false"');
    changed = true;
  }
  if (changed) {
    write(mainManifest, m);
    log('[AndroidManifest.xml] izin INTERNET/CAMERA dan allowBackup=false ditambahkan.');
  } else {
    log('[AndroidManifest.xml] sudah sesuai.');
  }
}

// ---------------------------------------------------------------- manifest debug (HTTP lokal)
const debugManifest = path.join(app, 'src', 'debug', 'AndroidManifest.xml');
let d = read(debugManifest);
if (d === null) {
  warn('android/app/src/debug/AndroidManifest.xml tidak ditemukan; HTTP lokal mungkin diblokir.');
} else if (/usesCleartextTraffic/.test(d)) {
  log('[debug/AndroidManifest.xml] cleartext sudah diatur.');
} else if (/<application/.test(d)) {
  warn('debug/AndroidManifest.xml sudah memiliki <application>; tambahkan android:usesCleartextTraffic="true" secara manual.');
} else {
  d = d.replace(/<\/manifest>/, '    <application android:usesCleartextTraffic="true" />\n</manifest>');
  write(debugManifest, d);
  log('[debug/AndroidManifest.xml] HTTP lokal diizinkan hanya untuk build debug.');
}

log('\nSelesai. Periksa hasilnya dengan: flutter analyze');
