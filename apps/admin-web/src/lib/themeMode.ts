export type ThemeMode = 'system' | 'light' | 'dark';
const KEY = 'crowdpulse.admin.theme';
const MODES: ThemeMode[] = ['system', 'light', 'dark'];

export function getThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    return MODES.includes(v as ThemeMode) ? (v as ThemeMode) : 'system';
  } catch {
    return 'system'; // penyimpanan diblokir (mode privat, dsb.)
  }
}

/** 'system' = tanpa atribut, sehingga CSS mengikuti prefers-color-scheme. */
export function applyThemeMode(mode: ThemeMode) {
  const el = document.documentElement;
  if (mode === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', mode);
}

export function setThemeMode(mode: ThemeMode) {
  applyThemeMode(mode);
  try { localStorage.setItem(KEY, mode); } catch { /* tetap berlaku untuk sesi ini */ }
}

export const nextThemeMode = (m: ThemeMode): ThemeMode => MODES[(MODES.indexOf(m) + 1) % MODES.length]!;
