import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/app_controller.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../widgets/common.dart';
import '../scanner/scanner_screen.dart';

class EventsScreen extends StatefulWidget {
  const EventsScreen({super.key});

  @override
  State<EventsScreen> createState() => _EventsScreenState();
}

class _EventsScreenState extends State<EventsScreen> {
  List<StaffEvent>? _events;
  ApiException? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final events = await AppScope.read(context).api.staffEvents();
      if (!mounted) return;
      setState(() {
        _events = events;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  Future<void> _open(StaffEvent event) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => ScannerScreen(event: event)),
    );
    if (mounted) _load(); // perbarui statistik check-in
  }

  @override
  Widget build(BuildContext context) {
    final user = AppScope.of(context).user;
    return Scaffold(
      appBar: AppBar(title: const Text('Pilih acara')),
      body: _body(user?.name ?? ''),
    );
  }

  Widget _body(String name) {
    if (_loading && _events == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null && _events == null) {
      return ErrorPanel(
        title: 'Gagal memuat acara',
        message: _error!.message,
        onRetry: _load,
      );
    }
    final events = _events ?? const <StaffEvent>[];
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          Text('Halo, $name', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          const Text('Pilih acara yang sedang Anda jaga untuk mulai memindai tiket.'),
          const SizedBox(height: 16),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!.message, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
          if (events.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Belum ada acara yang ditugaskan kepada Anda. Minta admin menugaskan Anda pada acara yang akan dijaga.',
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          for (final e in events) _EventCard(event: e, onTap: () => _open(e)),
        ],
      ),
    );
  }
}

class _EventCard extends StatelessWidget {
  const _EventCard({required this.event, required this.onTap});

  final StaffEvent event;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final s = event.stats;
    final progress = s.issued == 0 ? 0.0 : s.checkedIn / s.issued;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(event.title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text(event.location),
              Text(formatShortDateTime(event.startAt), style: TextStyle(color: Theme.of(context).hintColor)),
              const SizedBox(height: 12),
              LinearProgressIndicator(value: progress, minHeight: 8, borderRadius: BorderRadius.circular(4)),
              const SizedBox(height: 6),
              Text('Check-in ${s.checkedIn} dari ${s.issued} tiket'),
              const SizedBox(height: 12),
              const Align(
                alignment: Alignment.centerRight,
                child: Chip(avatar: Icon(Icons.qr_code_scanner, size: 18), label: Text('Mulai memindai')),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
