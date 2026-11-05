import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/app_controller.dart';
import '../../core/theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _server = TextEditingController();

  bool _obscure = true;
  bool _loading = false;
  bool _testing = false;
  String? _error;
  String? _serverStatus;
  bool _serverOk = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_server.text.isEmpty) _server.text = AppScope.read(context).baseUrl;
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _server.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final app = AppScope.read(context);
    final email = _email.text.trim();
    final password = _password.text;
    if (email.isEmpty || password.isEmpty) {
      setState(() => _error = 'Email dan password wajib diisi.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await app.login(email, password);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _saveAndTestServer() async {
    final app = AppScope.read(context);
    setState(() {
      _testing = true;
      _serverStatus = null;
    });
    try {
      await app.setBaseUrl(_server.text);
      _server.text = app.baseUrl;
      await app.api.health();
      if (mounted) {
        setState(() {
          _serverOk = true;
          _serverStatus = 'Terhubung ke server.';
        });
      }
    } on FormatException catch (e) {
      if (mounted) {
        setState(() {
          _serverOk = false;
          _serverStatus = e.message;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _serverOk = false;
          _serverStatus = 'Alamat tersimpan, tetapi server tidak dapat dijangkau: ${e.message}';
        });
      }
    } finally {
      if (mounted) setState(() => _testing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.qr_code_scanner, size: 64, color: kBrand),
                  const SizedBox(height: 12),
                  Text('CrowdPulse Gate',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  const Text('Masuk sebagai petugas gerbang', textAlign: TextAlign.center),
                  const SizedBox(height: 24),
                  if (app.notice != null) ...[
                    _Message(text: app.notice!, color: kWarning),
                    const SizedBox(height: 12),
                  ],
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    autofillHints: const [AutofillHints.username],
                    decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _password,
                    obscureText: _obscure,
                    autofillHints: const [AutofillHints.password],
                    onSubmitted: (_) => _submit(),
                    decoration: InputDecoration(
                      labelText: 'Password',
                      border: const OutlineInputBorder(),
                      suffixIcon: IconButton(
                        tooltip: _obscure ? 'Tampilkan password' : 'Sembunyikan password',
                        icon: Icon(_obscure ? Icons.visibility : Icons.visibility_off),
                        onPressed: () => setState(() => _obscure = !_obscure),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_error != null) ...[
                    _Message(text: _error!, color: kDanger),
                    const SizedBox(height: 12),
                  ],
                  FilledButton(
                    onPressed: _loading ? null : _submit,
                    child: _loading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Masuk'),
                  ),
                  const SizedBox(height: 16),
                  ExpansionTile(
                    title: const Text('Pengaturan server'),
                    subtitle: Text(app.baseUrl, maxLines: 1, overflow: TextOverflow.ellipsis),
                    childrenPadding: const EdgeInsets.only(bottom: 12),
                    children: [
                      TextField(
                        controller: _server,
                        keyboardType: TextInputType.url,
                        autocorrect: false,
                        decoration: const InputDecoration(
                          labelText: 'Alamat API',
                          border: OutlineInputBorder(),
                          helperText: 'Emulator: http://10.0.2.2:3000/api/v1\n'
                              'HP fisik: http://<IP-komputer>:3000/api/v1',
                          helperMaxLines: 3,
                        ),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton(
                        onPressed: _testing ? null : _saveAndTestServer,
                        child: Text(_testing ? 'Menguji...' : 'Simpan dan uji koneksi'),
                      ),
                      if (_serverStatus != null) ...[
                        const SizedBox(height: 8),
                        _Message(text: _serverStatus!, color: _serverOk ? kSuccess : kDanger),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.text, required this.color});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        border: Border.all(color: color.withValues(alpha: 0.5)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(text, style: TextStyle(color: color)),
    );
  }
}
