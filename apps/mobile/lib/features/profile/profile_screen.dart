import 'package:flutter/material.dart';

import '../../core/app_controller.dart';
import '../../core/config.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  Future<void> _logout(BuildContext context) async {
    final app = AppScope.read(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Keluar?'),
        content: const Text('Anda harus masuk lagi untuk memindai tiket.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Keluar')),
        ],
      ),
    );
    if (ok == true) await app.logout();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final user = app.user;
    return Scaffold(
      appBar: AppBar(title: const Text('Profil')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  InfoRow(label: 'Nama', value: user?.name ?? '-'),
                  InfoRow(label: 'Email', value: user?.email ?? '-'),
                  const InfoRow(label: 'Peran', value: 'Petugas gerbang'),
                  InfoRow(label: 'Server', value: app.baseUrl, mono: true),
                  const InfoRow(label: 'Versi', value: appVersion),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(foregroundColor: kDanger, minimumSize: const Size.fromHeight(48)),
            onPressed: () => _logout(context),
            icon: const Icon(Icons.logout),
            label: const Text('Keluar'),
          ),
          const SizedBox(height: 16),
          Text(
            'Foto pemegang tiket adalah data pribadi. Gunakan hanya untuk mencocokkan wajah di gerbang '
            'dan jangan memotret atau membagikan layar ini.',
            style: TextStyle(color: Theme.of(context).hintColor, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
