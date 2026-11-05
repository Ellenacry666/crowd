import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/app_controller.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key, required this.active});

  /// True saat tab Riwayat sedang ditampilkan; dipakai untuk memuat ulang data.
  final bool active;

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  final List<HistoryItem> _items = [];
  int _page = 0;
  bool _hasMore = false;
  bool _loading = false;
  bool _loadingMore = false;
  bool _loaded = false;
  ApiException? _error;

  @override
  void didUpdateWidget(HistoryScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && !oldWidget.active) _reload();
  }

  @override
  void initState() {
    super.initState();
    if (widget.active) _reload();
  }

  Future<void> _reload() async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await AppScope.read(context).api.history(page: 1);
      if (!mounted) return;
      setState(() {
        _items
          ..clear()
          ..addAll(page.items);
        _page = page.page;
        _hasMore = page.hasMore;
        _loading = false;
        _loaded = true;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
        _loaded = true;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore) return;
    setState(() => _loadingMore = true);
    try {
      final page = await AppScope.read(context).api.history(page: _page + 1);
      if (!mounted) return;
      setState(() {
        _items.addAll(page.items);
        _page = page.page;
        _hasMore = page.hasMore;
        _loadingMore = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loadingMore = false;
      });
    }
  }

  Color _color(String result) {
    switch (result) {
      case 'SUCCESS':
        return kSuccess;
      case 'ALREADY_USED':
      case 'CANCELLED_OR_EXPIRED':
        return kWarning;
      default:
        return kDanger;
    }
  }

  IconData _icon(String result) {
    switch (result) {
      case 'SUCCESS':
        return Icons.check_circle;
      case 'ALREADY_USED':
        return Icons.replay;
      case 'NOT_AUTHORIZED':
        return Icons.lock;
      default:
        return Icons.cancel;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Riwayat pemindaian')),
      body: _body(),
    );
  }

  Widget _body() {
    if ((_loading && !_loaded) || (!_loaded && !widget.active)) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null && _items.isEmpty) {
      return ErrorPanel(title: 'Gagal memuat riwayat', message: _error!.message, onRetry: _reload);
    }
    return RefreshIndicator(
      onRefresh: _reload,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          if (_items.isEmpty)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Text(
                'Belum ada pemindaian. Hasil check-in dan penolakan akan muncul di sini.',
                textAlign: TextAlign.center,
              ),
            ),
          for (final item in _items)
            ListTile(
              leading: Icon(_icon(item.result), color: _color(item.result)),
              title: Text(resultLabel(item.result),
                  style: TextStyle(color: _color(item.result), fontWeight: FontWeight.w700)),
              subtitle: Text(
                [
                  item.eventTitle,
                  if (item.categoryName != null) item.categoryName!,
                  formatDateTime(item.scannedAt),
                ].join(' · '),
              ),
              isThreeLine: false,
            ),
          if (_hasMore)
            Padding(
              padding: const EdgeInsets.all(16),
              child: OutlinedButton(
                onPressed: _loadingMore ? null : _loadMore,
                child: Text(_loadingMore ? 'Memuat...' : 'Muat lebih banyak'),
              ),
            ),
          if (_error != null && _items.isNotEmpty)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(_error!.message, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
        ],
      ),
    );
  }
}
