import { useState } from 'react';
import { getThemeMode, nextThemeMode, setThemeMode, ThemeMode } from '../lib/themeMode';
import { Icon } from './Icon';

const META: Record<ThemeMode, { icon: string; label: string }> = {
  system: { icon: 'monitor', label: 'Ikuti sistem' },
  light: { icon: 'sun', label: 'Terang' },
  dark: { icon: 'moon', label: 'Gelap' },
};

/** Satu tombol bersiklus: Ikuti sistem → Terang → Gelap. */
export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(getThemeMode);
  const next = nextThemeMode(mode);
  return (
    <button className="icon-btn" title={`Tema: ${META[mode].label} (klik untuk ${META[next].label})`}
      aria-label={`Tema: ${META[mode].label}. Ganti ke ${META[next].label}`}
      onClick={() => { setThemeMode(next); setMode(next); }}>
      <Icon name={META[mode].icon} size={18} />
    </button>
  );
}
