import 'package:flutter/material.dart';

/// Panel galat dengan tombol coba lagi.
class ErrorPanel extends StatelessWidget {
  const ErrorPanel({
    super.key,
    required this.title,
    required this.message,
    this.icon = Icons.cloud_off,
    this.onRetry,
    this.retryLabel = 'Coba lagi',
    this.secondaryLabel,
    this.onSecondary,
    this.hint,
  });

  final String title;
  final String message;
  final IconData icon;
  final VoidCallback? onRetry;
  final String retryLabel;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 56, color: scheme.error),
            const SizedBox(height: 12),
            Text(title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center),
            if (hint != null) ...[
              const SizedBox(height: 8),
              Text(hint!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: scheme.error, fontWeight: FontWeight.w600)),
            ],
            const SizedBox(height: 20),
            if (onRetry != null)
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: Text(retryLabel),
              ),
            if (onSecondary != null && secondaryLabel != null) ...[
              const SizedBox(height: 8),
              OutlinedButton(onPressed: onSecondary, child: Text(secondaryLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}

class InfoRow extends StatelessWidget {
  const InfoRow({super.key, required this.label, required this.value, this.mono = false});

  final String label;
  final String value;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label, style: TextStyle(color: Theme.of(context).hintColor)),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                fontFamily: mono ? 'monospace' : null,
                fontSize: mono ? 13 : null,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
