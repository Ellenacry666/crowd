String _two(int n) => n.toString().padLeft(2, '0');

/// 25/10/2026 14:03:09 (waktu perangkat)
String formatDateTime(DateTime d) {
  final l = d.toLocal();
  return '${_two(l.day)}/${_two(l.month)}/${l.year} '
      '${_two(l.hour)}:${_two(l.minute)}:${_two(l.second)}';
}

String formatShortDateTime(DateTime d) {
  final l = d.toLocal();
  return '${_two(l.day)}/${_two(l.month)}/${l.year} ${_two(l.hour)}:${_two(l.minute)}';
}

const Map<String, String> resultLabels = {
  'SUCCESS': 'Berhasil',
  'ALREADY_USED': 'Sudah digunakan',
  'INVALID_TOKEN': 'QR tidak valid',
  'NOT_PAID': 'Belum dibayar',
  'CANCELLED_OR_EXPIRED': 'Dibatalkan / kedaluwarsa',
  'WRONG_EVENT': 'Acara berbeda',
  'NOT_AUTHORIZED': 'Tidak berwenang',
};

String resultLabel(String result) => resultLabels[result] ?? result;
