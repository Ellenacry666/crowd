class StaffUser {
  const StaffUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
  });

  final String id;
  final String name;
  final String email;
  final String role;

  factory StaffUser.fromJson(Map<String, dynamic> json) => StaffUser(
        id: json['id'] as String,
        name: json['name'] as String,
        email: json['email'] as String,
        role: json['role'] as String,
      );

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'email': email, 'role': role};
}

class LoginResult {
  const LoginResult({required this.accessToken, required this.user});
  final String accessToken;
  final StaffUser user;

  factory LoginResult.fromJson(Map<String, dynamic> json) => LoginResult(
        accessToken: json['accessToken'] as String,
        user: StaffUser.fromJson(json['user'] as Map<String, dynamic>),
      );
}

class EventStats {
  const EventStats({required this.issued, required this.checkedIn});
  final int issued;
  final int checkedIn;

  factory EventStats.fromJson(Map<String, dynamic>? json) => EventStats(
        issued: (json?['issued'] as num?)?.toInt() ?? 0,
        checkedIn: (json?['checkedIn'] as num?)?.toInt() ?? 0,
      );
}

class StaffEvent {
  const StaffEvent({
    required this.id,
    required this.title,
    required this.location,
    required this.startAt,
    required this.endAt,
    required this.stats,
  });

  final String id;
  final String title;
  final String location;
  final DateTime startAt;
  final DateTime endAt;
  final EventStats stats;

  factory StaffEvent.fromJson(Map<String, dynamic> json) => StaffEvent(
        id: json['id'] as String,
        title: json['title'] as String,
        location: json['location'] as String,
        startAt: DateTime.parse(json['startAt'] as String).toLocal(),
        endAt: DateTime.parse(json['endAt'] as String).toLocal(),
        stats: EventStats.fromJson(json['stats'] as Map<String, dynamic>?),
      );
}

class TicketInfo {
  const TicketInfo({
    required this.id,
    required this.ticketCode,
    required this.categoryName,
    required this.eventTitle,
    required this.hasHolderPhoto,
    this.buyerName,
    this.status,
    this.checkedInAt,
  });

  final String id;
  final String ticketCode;
  final String categoryName;
  final String eventTitle;
  final bool hasHolderPhoto;
  final String? buyerName;
  final String? status;
  final DateTime? checkedInAt;

  factory TicketInfo.fromJson(Map<String, dynamic> json) => TicketInfo(
        id: json['id'] as String,
        ticketCode: (json['ticketCode'] as String?) ?? '',
        categoryName: (json['categoryName'] as String?) ?? '-',
        eventTitle: (json['eventTitle'] as String?) ?? '-',
        hasHolderPhoto: json['hasHolderPhoto'] == true,
        buyerName: json['buyerName'] as String?,
        status: json['status'] as String?,
        checkedInAt: DateTime.tryParse((json['checkedInAt'] as String?) ?? '')?.toLocal(),
      );
}

/// Respons /checkin/preview dan /checkin. `result` dapat berupa READY (hanya pratinjau)
/// atau salah satu hasil check-in (SUCCESS, ALREADY_USED, INVALID_TOKEN, ...).
class ScanResponse {
  const ScanResponse({
    required this.success,
    required this.result,
    required this.message,
    this.ticket,
    this.firstCheckedInAt,
  });

  final bool success;
  final String result;
  final String message;
  final TicketInfo? ticket;
  final DateTime? firstCheckedInAt;

  bool get isReady => success && result == 'READY';
  bool get isCheckedIn => success && result == 'SUCCESS';

  factory ScanResponse.fromJson(Map<String, dynamic> json) {
    final ticket = json['ticket'];
    return ScanResponse(
      success: json['success'] == true,
      result: (json['result'] as String?) ?? 'UNKNOWN',
      message: (json['message'] as String?) ?? '',
      ticket: ticket is Map<String, dynamic> ? TicketInfo.fromJson(ticket) : null,
      firstCheckedInAt: DateTime.tryParse((json['firstCheckedInAt'] as String?) ?? '')?.toLocal(),
    );
  }
}

class HistoryItem {
  const HistoryItem({
    required this.id,
    required this.result,
    required this.scannedAt,
    required this.eventId,
    required this.eventTitle,
    this.reason,
    this.ticketCode,
    this.categoryName,
  });

  final String id;
  final String result;
  final String? reason;
  final DateTime scannedAt;
  final String eventId;
  final String eventTitle;
  final String? ticketCode;
  final String? categoryName;

  factory HistoryItem.fromJson(Map<String, dynamic> json) {
    final ticket = json['ticket'];
    return HistoryItem(
      id: json['id'] as String,
      result: json['result'] as String,
      reason: json['reason'] as String?,
      scannedAt: DateTime.parse(json['scannedAt'] as String).toLocal(),
      eventId: json['eventId'] as String,
      eventTitle: (json['eventTitle'] as String?) ?? '-',
      ticketCode: ticket is Map<String, dynamic> ? ticket['ticketCode'] as String? : null,
      categoryName: ticket is Map<String, dynamic> ? ticket['categoryName'] as String? : null,
    );
  }
}

class HistoryPage {
  const HistoryPage({required this.items, required this.page, required this.totalPages});
  final List<HistoryItem> items;
  final int page;
  final int totalPages;

  bool get hasMore => page < totalPages;

  factory HistoryPage.fromJson(Map<String, dynamic> json) {
    final meta = (json['meta'] as Map<String, dynamic>?) ?? const <String, dynamic>{};
    final raw = (json['items'] as List<dynamic>?) ?? const <dynamic>[];
    return HistoryPage(
      items: raw.map((e) => HistoryItem.fromJson(e as Map<String, dynamic>)).toList(),
      page: (meta['page'] as num?)?.toInt() ?? 1,
      totalPages: (meta['totalPages'] as num?)?.toInt() ?? 1,
    );
  }
}
