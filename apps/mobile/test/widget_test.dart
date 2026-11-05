import 'package:crowdpulse_gate/core/config.dart';
import 'package:crowdpulse_gate/core/format.dart';
import 'package:crowdpulse_gate/core/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('normalizeBaseUrl', () {
    test('menambah skema http dan /api/v1', () {
      expect(normalizeBaseUrl('192.168.1.23:3000'), 'http://192.168.1.23:3000/api/v1');
      expect(normalizeBaseUrl('http://10.0.2.2:3000'), 'http://10.0.2.2:3000/api/v1');
    });

    test('membuang garis miring di akhir dan mempertahankan path yang ada', () {
      expect(normalizeBaseUrl('http://host:3000/api/v1/'), 'http://host:3000/api/v1');
      expect(normalizeBaseUrl('https://api.example.com'), 'https://api.example.com/api/v1');
    });

    test('menolak alamat kosong atau tidak valid', () {
      expect(() => normalizeBaseUrl('   '), throwsFormatException);
      expect(() => normalizeBaseUrl('http://'), throwsFormatException);
    });
  });

  group('ScanResponse.fromJson', () {
    test('pratinjau READY memuat data tiket minimal', () {
      final r = ScanResponse.fromJson({
        'success': true,
        'result': 'READY',
        'message': 'Tiket valid.',
        'ticket': {
          'id': 't1',
          'ticketCode': 'ABC',
          'categoryName': 'VIP',
          'eventTitle': 'Music Fest',
          'buyerName': 'Budi',
          'hasHolderPhoto': true,
          'status': 'ACTIVE',
          'checkedInAt': null,
        },
      });
      expect(r.isReady, isTrue);
      expect(r.isCheckedIn, isFalse);
      expect(r.ticket?.buyerName, 'Budi');
      expect(r.ticket?.hasHolderPhoto, isTrue);
      expect(r.ticket?.checkedInAt, isNull);
    });

    test('penolakan ALREADY_USED membawa waktu check-in pertama', () {
      final r = ScanResponse.fromJson({
        'success': false,
        'result': 'ALREADY_USED',
        'message': 'Tiket sudah digunakan',
        'firstCheckedInAt': '2026-10-25T07:03:09.000Z',
      });
      expect(r.isReady, isFalse);
      expect(r.isCheckedIn, isFalse);
      expect(r.firstCheckedInAt, isNotNull);
      expect(r.ticket, isNull);
    });

    test('hasil SUCCESS dikenali sebagai check-in', () {
      final r = ScanResponse.fromJson({
        'success': true,
        'result': 'SUCCESS',
        'message': 'Check-in berhasil',
      });
      expect(r.isCheckedIn, isTrue);
    });
  });

  group('HistoryPage.fromJson', () {
    test('memetakan item dan penanda halaman', () {
      final p = HistoryPage.fromJson({
        'items': [
          {
            'id': 'h1',
            'result': 'INVALID_TOKEN',
            'reason': 'format',
            'scannedAt': '2026-10-25T07:03:09.000Z',
            'eventId': 'e1',
            'eventTitle': 'Music Fest',
            'ticket': null,
          },
        ],
        'meta': {'page': 1, 'limit': 20, 'total': 45, 'totalPages': 3},
      });
      expect(p.items.single.ticketCode, isNull);
      expect(p.hasMore, isTrue);
    });
  });

  test('resultLabel memberi label Indonesia dan fallback ke kode', () {
    expect(resultLabel('ALREADY_USED'), 'Sudah digunakan');
    expect(resultLabel('SESUATU_BARU'), 'SESUATU_BARU');
  });
}
