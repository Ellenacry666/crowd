import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'models.dart';

/// Penyimpanan token dan pengaturan di Android Keystore. Kegagalan membaca/menulis
/// tidak boleh menjatuhkan aplikasi: dianggap "tidak ada data".
class SecureStore {
  SecureStore() : _storage = const FlutterSecureStorage();

  static const _kToken = 'cp_token';
  static const _kBaseUrl = 'cp_base_url';
  static const _kUser = 'cp_user';

  final FlutterSecureStorage _storage;

  Future<String?> _read(String key) async {
    try {
      return await _storage.read(key: key);
    } catch (_) {
      return null;
    }
  }

  Future<void> _write(String key, String value) async {
    try {
      await _storage.write(key: key, value: value);
    } catch (_) {
      // penyimpanan tidak tersedia
    }
  }

  Future<void> _delete(String key) async {
    try {
      await _storage.delete(key: key);
    } catch (_) {
      // abaikan
    }
  }

  Future<String?> readToken() => _read(_kToken);
  Future<String?> readBaseUrl() => _read(_kBaseUrl);

  Future<StaffUser?> readUser() async {
    final raw = await _read(_kUser);
    if (raw == null) return null;
    try {
      return StaffUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> saveSession(String token, StaffUser user) async {
    await _write(_kToken, token);
    await _write(_kUser, jsonEncode(user.toJson()));
  }

  Future<void> saveBaseUrl(String url) => _write(_kBaseUrl, url);

  Future<void> clearSession() async {
    await _delete(_kToken);
    await _delete(_kUser);
  }
}
