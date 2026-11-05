import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/models.dart';
import '../../widgets/common.dart';
import 'review_screen.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key, required this.event});

  final StaffEvent event;

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> with WidgetsBindingObserver {
  // autoStart: false agar siklus hidup kamera (mulai/berhenti) sepenuhnya kita kendalikan.
  final MobileScannerController _controller = MobileScannerController(
    autoStart: false,
    detectionSpeed: DetectionSpeed.noDuplicates,
    formats: const [BarcodeFormat.qrCode],
  );

  bool _starting = false;
  bool _running = false;
  bool _reviewOpen = false;
  bool _handling = false;
  bool _torchOn = false;
  String? _cameraError;
  String? _lastPayload;
  DateTime? _lastAt;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
    unawaited(_controller.dispose());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        if (!_reviewOpen) _start();
      case AppLifecycleState.inactive:
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
      case AppLifecycleState.detached:
        _stop();
    }
  }

  Future<void> _start() async {
    if (_running || _starting || !mounted) return;
    _starting = true;
    try {
      await _controller.start();
      _running = true;
      if (mounted) setState(() => _cameraError = null);
    } on MobileScannerException catch (e) {
      if (mounted) setState(() => _cameraError = _describe(e));
    } catch (_) {
      if (mounted) setState(() => _cameraError = 'Kamera tidak dapat dibuka.');
    } finally {
      _starting = false;
    }
  }

  Future<void> _stop() async {
    if (!_running) return;
    _running = false;
    try {
      await _controller.stop();
    } catch (_) {
      // abaikan
    }
  }

  String _describe(MobileScannerException e) {
    if (e.errorCode == MobileScannerErrorCode.permissionDenied) {
      return 'Izin kamera ditolak. Buka Pengaturan HP, pilih Aplikasi, CrowdPulse Gate, '
          'Izin, lalu aktifkan Kamera. Setelah itu tekan "Coba lagi".';
    }
    if (e.errorCode == MobileScannerErrorCode.unsupported) {
      return 'Perangkat ini tidak mendukung pemindaian kamera.';
    }
    return 'Kamera tidak dapat dibuka. Tutup aplikasi lain yang memakai kamera lalu coba lagi.';
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handling) return;
    final raw = capture.barcodes.isEmpty ? null : capture.barcodes.first.rawValue;
    if (raw == null || raw.trim().isEmpty) return;
    final payload = raw.trim();

    // Abaikan QR yang sama yang baru saja diproses (mencegah pemindaian berulang).
    final now = DateTime.now();
    if (payload == _lastPayload &&
        _lastAt != null &&
        now.difference(_lastAt!) < const Duration(seconds: 3)) {
      return;
    }
    _handling = true;
    _lastPayload = payload;
    _lastAt = now;
    _openReview(payload);
  }

  Future<void> _openReview(String payload) async {
    await _stop();
    if (!mounted) {
      _handling = false;
      return;
    }

    // Filter awal: QR yang bukan tiket CrowdPulse tidak perlu dikirim ke server.
    if (!payload.startsWith('CP1.')) {
      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(const SnackBar(content: Text('QR ini bukan tiket CrowdPulse.')));
      await Future<void>.delayed(const Duration(milliseconds: 1500));
      _lastAt = DateTime.now();
      _handling = false;
      await _start();
      return;
    }

    _reviewOpen = true;
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ReviewScreen(event: widget.event, payload: payload),
      ),
    );
    _reviewOpen = false;
    _lastAt = DateTime.now();
    _handling = false;
    if (mounted) await _start();
  }

  Future<void> _toggleTorch() async {
    try {
      await _controller.toggleTorch();
      if (mounted) setState(() => _torchOn = !_torchOn);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Lampu senter tidak tersedia di perangkat ini.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.event.title, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            tooltip: 'Lampu senter',
            icon: Icon(_torchOn ? Icons.flash_on : Icons.flash_off),
            onPressed: _cameraError == null ? _toggleTorch : null,
          ),
        ],
      ),
      body: _cameraError != null
          ? ErrorPanel(
              icon: Icons.no_photography,
              title: 'Kamera belum dapat dipakai',
              message: _cameraError!,
              onRetry: _start,
            )
          : Stack(
              fit: StackFit.expand,
              children: [
                MobileScanner(controller: _controller, onDetect: _onDetect),
                const _ScanOverlay(),
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 24,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Text(
                      'Arahkan kamera ke QR Code tiket.\nFoto pemegang akan ditampilkan sebelum Anda mengizinkan masuk.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}

class _ScanOverlay extends StatelessWidget {
  const _ScanOverlay();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Center(
        child: Container(
          width: 250,
          height: 250,
          decoration: BoxDecoration(
            border: Border.all(color: Colors.white, width: 3),
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
    );
  }
}
