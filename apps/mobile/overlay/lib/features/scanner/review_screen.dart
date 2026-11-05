import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/app_controller.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

enum _Stage { loading, error, preview, confirming, confirmError, done }

/// Alur dua langkah di gerbang:
/// 1. Pratinjau (tidak mengubah status tiket): tampil foto pemegang dan nama pembeli.
/// 2. Petugas mencocokkan wajah lalu menekan "Izinkan masuk" (check-in atomik) atau "Tolak".
class ReviewScreen extends StatefulWidget {
  const ReviewScreen({super.key, required this.event, required this.payload});

  final StaffEvent event;
  final String payload;

  @override
  State<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends State<ReviewScreen> {
  _Stage _stage = _Stage.loading;
  ApiException? _error;
  ScanResponse? _preview;
  ScanResponse? _final;

  Uint8List? _photo;
  bool _photoLoading = false;
  bool _photoFailed = false;

  @override
  void initState() {
    super.initState();
    _runPreview();
  }

  AppController get _app => AppScope.read(context);

  Future<void> _runPreview() async {
    setState(() {
      _stage = _Stage.loading;
      _error = null;
    });
    try {
      final r = await _app.api.preview(widget.event.id, widget.payload);
      if (!mounted) return;
      setState(() {
        _preview = r;
        _stage = _Stage.preview;
      });
      final t = r.ticket;
      if (t != null && t.hasHolderPhoto) _loadPhoto(t.id);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _stage = _Stage.error;
      });
    }
  }

  Future<void> _loadPhoto(String ticketId) async {
    setState(() {
      _photoLoading = true;
      _photoFailed = false;
    });
    try {
      final bytes = await _app.api.ticketPhoto(ticketId);
      if (!mounted) return;
      setState(() {
        _photo = bytes;
        _photoLoading = false;
      });
    } on ApiException {
      if (!mounted) return;
      setState(() {
        _photoFailed = true;
        _photoLoading = false;
      });
    }
  }

  Future<void> _confirm() async {
    setState(() {
      _stage = _Stage.confirming;
      _error = null;
    });
    try {
      final r = await _app.api.checkIn(widget.event.id, widget.payload);
      if (!mounted) return;
      setState(() {
        _final = r;
        _stage = _Stage.done;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _stage = _Stage.confirmError;
      });
    }
  }

  Future<void> _reject() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Tolak masuk?'),
        content: const Text(
          'Tiket TIDAK akan ditandai terpakai, sehingga pemilik sah masih dapat menggunakannya. '
          'Arahkan orang ini ke petugas atau panitia.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: kDanger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Tolak masuk'),
          ),
        ],
      ),
    );
    if (ok == true && mounted) Navigator.of(context).pop();
  }

  void _zoomPhoto() {
    final bytes = _photo;
    if (bytes == null) return;
    showDialog<void>(
      context: context,
      builder: (ctx) => Dialog.fullscreen(
        backgroundColor: Colors.black,
        child: Stack(
          children: [
            Positioned.fill(
              child: InteractiveViewer(
                minScale: 1,
                maxScale: 5,
                child: Image.memory(bytes, fit: BoxFit.contain),
              ),
            ),
            SafeArea(
              child: Align(
                alignment: Alignment.topRight,
                child: IconButton(
                  tooltip: 'Tutup',
                  color: Colors.white,
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pemeriksaan tiket')),
      body: SafeArea(child: _body()),
    );
  }

  Widget _body() {
    switch (_stage) {
      case _Stage.loading:
        return const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text('Memeriksa tiket...'),
            ],
          ),
        );
      case _Stage.error:
        return ErrorPanel(
          title: _error!.isConnectionProblem ? 'Validasi belum dapat dilakukan' : 'Pemeriksaan gagal',
          message: _error!.message,
          hint: 'Jangan izinkan masuk sampai validasi berhasil.',
          onRetry: _runPreview,
          secondaryLabel: 'Kembali',
          onSecondary: () => Navigator.of(context).pop(),
        );
      case _Stage.preview:
        return _resultView(_preview!, _Mode.decide);
      case _Stage.confirming:
        return _resultView(_preview!, _Mode.confirming);
      case _Stage.confirmError:
        return _resultView(_preview!, _Mode.confirmError);
      case _Stage.done:
        return _resultView(_final!, _Mode.close, fallbackTicket: _preview?.ticket);
    }
  }

  Widget _resultView(ScanResponse r, _Mode mode, {TicketInfo? fallbackTicket}) {
    final ticket = r.ticket ?? fallbackTicket;
    final ok = r.isReady || r.isCheckedIn;
    final color = ok ? kSuccess : kDanger;

    final String headline;
    if (r.isCheckedIn) {
      headline = 'BERHASIL CHECK-IN';
    } else if (r.isReady) {
      headline = 'TIKET VALID';
    } else {
      headline = r.message.toUpperCase();
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _Banner(
          color: color,
          icon: ok ? Icons.check_circle : Icons.cancel,
          title: headline,
          subtitle: r.isReady ? 'Cocokkan wajah pemegang dengan foto di bawah.' : null,
        ),
        if (r.result == 'ALREADY_USED' && r.firstCheckedInAt != null) ...[
          const SizedBox(height: 8),
          Text(
            'Check-in pertama: ${formatDateTime(r.firstCheckedInAt!)}',
            textAlign: TextAlign.center,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          if (mode == _Mode.close)
            const Padding(
              padding: EdgeInsets.only(top: 4),
              child: Text(
                'Jika Anda baru saja menekan "Izinkan masuk" dan koneksi sempat terputus, '
                'status ini berarti check-in tadi sudah tercatat.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12),
              ),
            ),
        ],
        if (ticket != null) ...[
          const SizedBox(height: 16),
          _photoSection(ticket, showWarning: r.isReady),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  if ((ticket.buyerName ?? fallbackTicket?.buyerName) != null)
                    InfoRow(label: 'Pembeli', value: (ticket.buyerName ?? fallbackTicket?.buyerName)!),
                  InfoRow(label: 'Kategori', value: ticket.categoryName),
                  InfoRow(label: 'Acara', value: ticket.eventTitle),
                  InfoRow(label: 'Kode tiket', value: ticket.ticketCode, mono: true),
                  if (r.isCheckedIn && ticket.checkedInAt != null)
                    InfoRow(label: 'Waktu masuk', value: formatDateTime(ticket.checkedInAt!)),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        ..._actions(mode),
      ],
    );
  }

  Widget _photoSection(TicketInfo ticket, {required bool showWarning}) {
    if (!ticket.hasHolderPhoto) {
      return showWarning
          ? const _Banner(
              color: kWarning,
              icon: Icons.warning_amber,
              title: 'TIDAK ADA FOTO',
              subtitle: 'Tiket ini tidak memiliki foto pemegang. Verifikasi identitas secara manual.',
              compact: true,
            )
          : const SizedBox.shrink();
    }
    if (_photoLoading || (_photo == null && !_photoFailed)) {
      return const SizedBox(
        height: 240,
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (_photoFailed || _photo == null) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              const Icon(Icons.broken_image, size: 40),
              const SizedBox(height: 8),
              const Text('Foto tidak dapat dimuat.'),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () => _loadPhoto(ticket.id),
                icon: const Icon(Icons.refresh),
                label: const Text('Muat ulang foto'),
              ),
            ],
          ),
        ),
      );
    }
    return GestureDetector(
      onTap: _zoomPhoto,
      child: Stack(
        children: [
          Container(
            height: 320,
            width: double.infinity,
            decoration: BoxDecoration(
              color: Colors.black,
              borderRadius: BorderRadius.circular(12),
            ),
            clipBehavior: Clip.antiAlias,
            child: Image.memory(_photo!, fit: BoxFit.contain, gaplessPlayback: true),
          ),
          Positioned(
            right: 8,
            bottom: 8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.zoom_in, color: Colors.white, size: 18),
                  SizedBox(width: 4),
                  Text('Ketuk untuk memperbesar', style: TextStyle(color: Colors.white, fontSize: 12)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _actions(_Mode mode) {
    switch (mode) {
      case _Mode.decide:
        return [
          FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: kSuccess,
              minimumSize: const Size.fromHeight(56),
            ),
            onPressed: _confirm,
            icon: const Icon(Icons.login),
            label: const Text('Izinkan masuk', style: TextStyle(fontSize: 18)),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: kDanger,
              minimumSize: const Size.fromHeight(48),
            ),
            onPressed: _reject,
            icon: const Icon(Icons.block),
            label: const Text('Tolak (wajah tidak cocok)'),
          ),
        ];
      case _Mode.confirming:
        return const [
          Center(
            child: Column(
              children: [
                CircularProgressIndicator(),
                SizedBox(height: 8),
                Text('Mencatat check-in...'),
              ],
            ),
          ),
        ];
      case _Mode.confirmError:
        return [
          _Banner(
            color: kWarning,
            icon: Icons.cloud_off,
            title: 'STATUS BELUM PASTI',
            subtitle: '${_error?.message ?? 'Koneksi bermasalah.'}\n'
                'Jangan izinkan masuk dulu. Tekan "Periksa lagi" untuk memastikan status tiket.',
            compact: true,
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
            onPressed: _confirm,
            icon: const Icon(Icons.refresh),
            label: const Text('Periksa lagi'),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Kembali ke pemindai'),
          ),
        ];
      case _Mode.close:
        return [
          FilledButton.icon(
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
            onPressed: () => Navigator.of(context).pop(),
            icon: const Icon(Icons.qr_code_scanner),
            label: const Text('Pindai berikutnya'),
          ),
        ];
    }
  }
}

enum _Mode { decide, confirming, confirmError, close }

class _Banner extends StatelessWidget {
  const _Banner({
    required this.color,
    required this.icon,
    required this.title,
    this.subtitle,
    this.compact = false,
  });

  final Color color;
  final IconData icon;
  final String title;
  final String? subtitle;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(vertical: compact ? 12 : 20, horizontal: 16),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(12)),
      child: Column(
        children: [
          Icon(icon, color: Colors.white, size: compact ? 28 : 48),
          const SizedBox(height: 6),
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white,
              fontSize: compact ? 16 : 24,
              fontWeight: FontWeight.w800,
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 4),
            Text(subtitle!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white)),
          ],
        ],
      ),
    );
  }
}
