/// Alamat API bawaan. Dapat diubah saat build:
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.23:3000/api/v1
/// atau saat aplikasi berjalan lewat "Pengaturan server" di layar login.
/// Emulator Android memakai 10.0.2.2 untuk menjangkau komputer pengembang.
const String defaultApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000/api/v1',
);

const String appVersion = '0.1.0';

/// Merapikan alamat server yang diketik pengguna:
/// - menambah http:// bila tidak ada skema
/// - membuang garis miring di akhir
/// - menambah /api/v1 bila path kosong
/// Melempar [FormatException] bila alamat tidak valid.
String normalizeBaseUrl(String raw) {
  var value = raw.trim();
  if (value.isEmpty) {
    throw const FormatException('Alamat server tidak boleh kosong.');
  }
  if (!RegExp(r'^https?://', caseSensitive: false).hasMatch(value)) {
    value = 'http://$value';
  }
  final uri = Uri.tryParse(value);
  if (uri == null || uri.host.isEmpty) {
    throw const FormatException('Alamat server tidak valid.');
  }
  var path = uri.path.replaceAll(RegExp(r'/+$'), '');
  if (path.isEmpty) path = '/api/v1';
  return Uri(
    scheme: uri.scheme.toLowerCase(),
    host: uri.host,
    port: uri.hasPort ? uri.port : null,
    path: path,
  ).toString();
}
