import 'package:flutter/material.dart';

const Color kBrand = Color(0xFF4F46E5);
const Color kSuccess = Color(0xFF15803D);
const Color kDanger = Color(0xFFB91C1C);
const Color kWarning = Color(0xFFB45309);

ThemeData buildTheme() {
  return ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: kBrand),
  );
}
