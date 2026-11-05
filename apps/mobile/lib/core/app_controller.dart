import 'package:flutter/widgets.dart';

import 'api_client.dart';
import 'config.dart';
import 'models.dart';
import 'secure_store.dart';

/// Status aplikasi: sesi petugas dan alamat server. Satu instance untuk seluruh aplikasi.
class AppController extends ChangeNotifier {
  AppController({SecureStore? store}) : _store = store ?? SecureStore() {
    api = ApiClient(
      baseUrl: () => _baseUrl,
      token: () => _token,
      onUnauthorized: _handleUnauthorized,
    );
  }

  final SecureStore _store;
  late final ApiClient api;

  StaffUser? user;
  String? _token;
  String _baseUrl = defaultApiBaseUrl;
  String? notice;

  String get baseUrl => _baseUrl;

  Future<void> init() async {
    final savedUrl = await _store.readBaseUrl();
    if (savedUrl != null && savedUrl.isNotEmpty) _baseUrl = savedUrl;

    _token = await _store.readToken();
    final cached = await _store.readUser();
    if (_token != null && cached != null && cached.role == 'GATE_STAFF') {
      user = cached;
      await _validateSession();
    } else if (_token != null) {
      await _store.clearSession();
      _token = null;
    }
  }

  /// Memastikan token masih berlaku. Bila server tidak terjangkau, sesi tetap dipertahankan
  /// (layar akan menampilkan galat koneksi); izin masuk tidak pernah diberikan secara offline.
  Future<void> _validateSession() async {
    try {
      final me = await api.me();
      if (me.role != 'GATE_STAFF') await logout(message: 'Akun ini bukan akun petugas gerbang.');
    } on ApiException catch (e) {
      if (e.kind == ApiErrorKind.unauthorized) {
        // onUnauthorized sudah membersihkan sesi
      }
    }
  }

  Future<void> login(String email, String password) async {
    final result = await api.login(email, password);
    if (result.user.role != 'GATE_STAFF') {
      throw const ApiException(
        ApiErrorKind.forbidden,
        'Aplikasi ini hanya untuk akun petugas gerbang.',
      );
    }
    _token = result.accessToken;
    user = result.user;
    notice = null;
    await _store.saveSession(result.accessToken, result.user);
    notifyListeners();
  }

  Future<void> logout({String? message}) async {
    _token = null;
    user = null;
    notice = message;
    await _store.clearSession();
    notifyListeners();
  }

  void _handleUnauthorized() {
    if (user == null && _token == null) return;
    // Jangan menunggu; segera bersihkan agar UI kembali ke layar login.
    logout(message: 'Sesi berakhir. Silakan masuk kembali.');
  }

  /// Menyimpan alamat server. Melempar [FormatException] bila tidak valid.
  Future<void> setBaseUrl(String raw) async {
    final normalized = normalizeBaseUrl(raw);
    _baseUrl = normalized;
    await _store.saveBaseUrl(normalized);
    notifyListeners();
  }
}

/// Menyediakan [AppController] ke seluruh pohon widget (tanpa paket tambahan).
class AppScope extends InheritedNotifier<AppController> {
  const AppScope({super.key, required AppController controller, required super.child})
      : super(notifier: controller);

  /// Berlangganan perubahan (dipakai di build).
  static AppController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'AppScope tidak ditemukan di pohon widget');
    return scope!.notifier!;
  }

  /// Tanpa berlangganan (aman dipakai di initState dan event handler).
  static AppController read(BuildContext context) {
    final scope = context.getInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'AppScope tidak ditemukan di pohon widget');
    return scope!.notifier!;
  }
}
