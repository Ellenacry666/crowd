import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import 'models.dart';

enum ApiErrorKind {
  network,
  timeout,
  unauthorized,
  forbidden,
  notFound,
  tooManyRequests,
  server,
  unknown,
}

/// Galat API. Sengaja tidak menyimpan isi permintaan/respons agar token dan data
/// pribadi tidak ikut tercetak ke log.
class ApiException implements Exception {
  const ApiException(this.kind, this.message, {this.code, this.statusCode});

  final ApiErrorKind kind;
  final String message;
  final String? code;
  final int? statusCode;

  bool get isConnectionProblem => kind == ApiErrorKind.network || kind == ApiErrorKind.timeout;

  @override
  String toString() => 'ApiException($kind, status=$statusCode, code=$code)';
}

class ApiClient {
  ApiClient({
    required this.baseUrl,
    required this.token,
    this.onUnauthorized,
    http.Client? client,
    this.timeout = const Duration(seconds: 12),
  }) : _client = client ?? http.Client();

  final String Function() baseUrl;
  final String? Function() token;
  final void Function()? onUnauthorized;
  final Duration timeout;
  final http.Client _client;

  // ------------------------------------------------------------------ endpoint
  Future<void> health() async {
    await _json('GET', '/health', auth: false);
  }

  Future<LoginResult> login(String email, String password) async {
    final data = await _json('POST', '/auth/login',
        body: {'email': email, 'password': password}, auth: false);
    return LoginResult.fromJson(data as Map<String, dynamic>);
  }

  Future<StaffUser> me() async {
    final data = await _json('GET', '/auth/me');
    return StaffUser.fromJson(data as Map<String, dynamic>);
  }

  Future<List<StaffEvent>> staffEvents() async {
    final data = await _json('GET', '/staff/events');
    return (data as List<dynamic>)
        .map((e) => StaffEvent.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Pratinjau: tidak mengubah status tiket dan tidak mencatat check-in.
  Future<ScanResponse> preview(String eventId, String qrPayload) async {
    final data = await _json('POST', '/checkin/preview',
        body: {'eventId': eventId, 'qrPayload': qrPayload});
    return ScanResponse.fromJson(data as Map<String, dynamic>);
  }

  /// Check-in sungguhan (atomik di server).
  Future<ScanResponse> checkIn(String eventId, String qrPayload) async {
    final data = await _json('POST', '/checkin',
        body: {'eventId': eventId, 'qrPayload': qrPayload});
    return ScanResponse.fromJson(data as Map<String, dynamic>);
  }

  Future<HistoryPage> history({int page = 1, int limit = 20, String? eventId}) async {
    final data = await _json('GET', '/staff/checkins', query: {
      'page': '$page',
      'limit': '$limit',
      'eventId': ?eventId,
    });
    return HistoryPage.fromJson(data as Map<String, dynamic>);
  }

  /// Foto pemegang tiket. Hanya disimpan di memori (tidak ditulis ke disk).
  Future<Uint8List> ticketPhoto(String ticketId) async {
    final res = await _send('GET', '/tickets/$ticketId/photo');
    if (res.statusCode == 200) return res.bodyBytes;
    throw _toException(res, auth: true);
  }

  // ------------------------------------------------------------------ internal
  Future<dynamic> _json(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
    bool auth = true,
  }) async {
    final res = await _send(method, path, body: body, query: query, auth: auth);
    if (res.statusCode >= 200 && res.statusCode < 300) return _decode(res);
    throw _toException(res, auth: auth);
  }

  Future<http.Response> _send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
    bool auth = true,
  }) async {
    Uri uri;
    try {
      uri = Uri.parse('${baseUrl()}$path');
      if (query != null && query.isNotEmpty) uri = uri.replace(queryParameters: query);
    } on FormatException {
      throw const ApiException(ApiErrorKind.unknown, 'Alamat server tidak valid.');
    }

    final headers = <String, String>{'Accept': 'application/json'};
    final t = token();
    if (auth && t != null && t.isNotEmpty) headers['Authorization'] = 'Bearer $t';

    try {
      if (method == 'POST') {
        headers['Content-Type'] = 'application/json';
        return await _client
            .post(uri, headers: headers, body: jsonEncode(body ?? <String, dynamic>{}))
            .timeout(timeout);
      }
      return await _client.get(uri, headers: headers).timeout(timeout);
    } on TimeoutException {
      throw const ApiException(
        ApiErrorKind.timeout,
        'Server tidak merespons (timeout). Periksa koneksi lalu coba lagi.',
      );
    } on SocketException {
      throw const ApiException(
        ApiErrorKind.network,
        'Tidak dapat terhubung ke server. Periksa Wi-Fi dan alamat server.',
      );
    } on HandshakeException {
      throw const ApiException(ApiErrorKind.network, 'Koneksi aman ke server gagal.');
    } on http.ClientException {
      throw const ApiException(
        ApiErrorKind.network,
        'Tidak dapat terhubung ke server. Periksa Wi-Fi dan alamat server.',
      );
    }
  }

  dynamic _decode(http.Response res) {
    if (res.bodyBytes.isEmpty) return null;
    try {
      return jsonDecode(utf8.decode(res.bodyBytes));
    } catch (_) {
      return null;
    }
  }

  ApiException _toException(http.Response res, {required bool auth}) {
    final data = _decode(res);
    String? code;
    var message = 'Terjadi kesalahan pada server.';
    if (data is Map) {
      final c = data['code'];
      if (c is String) code = c;
      final m = data['message'];
      if (m is String) {
        message = m;
      } else if (m is List) {
        message = m.join(', ');
      }
    }

    switch (res.statusCode) {
      case 401:
        if (auth) {
          onUnauthorized?.call();
          return ApiException(
            ApiErrorKind.unauthorized,
            'Sesi berakhir. Silakan masuk kembali.',
            code: code,
            statusCode: 401,
          );
        }
        return ApiException(ApiErrorKind.unauthorized, 'Email atau password salah.',
            code: code, statusCode: 401);
      case 403:
        return ApiException(ApiErrorKind.forbidden, message, code: code, statusCode: 403);
      case 404:
        return ApiException(ApiErrorKind.notFound, message, code: code, statusCode: 404);
      case 429:
        return ApiException(
          ApiErrorKind.tooManyRequests,
          'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.',
          code: code,
          statusCode: 429,
        );
      default:
        if (res.statusCode >= 500) {
          return ApiException(
            ApiErrorKind.server,
            'Server sedang bermasalah. Coba lagi nanti.',
            code: code,
            statusCode: res.statusCode,
          );
        }
        return ApiException(ApiErrorKind.unknown, message, code: code, statusCode: res.statusCode);
    }
  }
}
