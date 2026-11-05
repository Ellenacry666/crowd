import 'package:flutter/material.dart';

import 'core/app_controller.dart';
import 'core/theme.dart';
import 'features/auth/login_screen.dart';
import 'features/home_shell.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

class CrowdPulseGateApp extends StatefulWidget {
  const CrowdPulseGateApp({super.key, required this.controller});

  final AppController controller;

  @override
  State<CrowdPulseGateApp> createState() => _CrowdPulseGateAppState();
}

class _CrowdPulseGateAppState extends State<CrowdPulseGateApp> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onChanged);
    super.dispose();
  }

  // Saat sesi berakhir (logout atau token ditolak), tutup semua layar di atas layar utama.
  void _onChanged() {
    if (widget.controller.user == null) {
      navigatorKey.currentState?.popUntil((route) => route.isFirst);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppScope(
      controller: widget.controller,
      child: MaterialApp(
        title: 'CrowdPulse Gate',
        debugShowCheckedModeBanner: false,
        navigatorKey: navigatorKey,
        theme: buildTheme(),
        home: ListenableBuilder(
          listenable: widget.controller,
          builder: (context, _) =>
              widget.controller.user == null ? const LoginScreen() : const HomeShell(),
        ),
      ),
    );
  }
}
