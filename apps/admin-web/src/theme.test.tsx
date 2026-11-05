import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from './components/ThemeToggle';
import { applyThemeMode, getThemeMode, nextThemeMode, setThemeMode } from './lib/themeMode';

const attr = () => document.documentElement.getAttribute('data-theme');
beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-theme'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('themeMode', () => {
  it('default "system" tanpa atribut; nilai tersimpan yang tidak valid diabaikan', () => {
    expect(getThemeMode()).toBe('system');
    localStorage.setItem('crowdpulse.admin.theme', 'neon');
    expect(getThemeMode()).toBe('system');
  });

  it('light/dark memasang atribut, system menghapusnya, dan pilihan tersimpan', () => {
    setThemeMode('dark');
    expect(attr()).toBe('dark');
    expect(getThemeMode()).toBe('dark');
    setThemeMode('light');
    expect(attr()).toBe('light');
    setThemeMode('system');
    expect(attr()).toBeNull();
    applyThemeMode('dark');
    expect(attr()).toBe('dark');
  });

  it('siklus: system → light → dark → system', () => {
    expect(nextThemeMode('system')).toBe('light');
    expect(nextThemeMode('light')).toBe('dark');
    expect(nextThemeMode('dark')).toBe('system');
  });

  it('penyimpanan diblokir: tidak error, tema tetap berlaku untuk sesi ini', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(getThemeMode()).toBe('system');
    expect(() => setThemeMode('dark')).not.toThrow();
    expect(attr()).toBe('dark');
  });
});

describe('ThemeToggle', () => {
  it('klik berganti Sistem → Terang → Gelap dan memasang atribut tema', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(attr()).toBe('light');
    expect(screen.getByRole('button').getAttribute('aria-label')).toContain('Tema: Terang');
    fireEvent.click(screen.getByRole('button'));
    expect(attr()).toBe('dark');
    fireEvent.click(screen.getByRole('button'));
    expect(attr()).toBeNull();
  });

  it('memulihkan pilihan tersimpan saat dibuka kembali', () => {
    setThemeMode('dark');
    render(<ThemeToggle />);
    expect(screen.getByRole('button').getAttribute('aria-label')).toContain('Tema: Gelap');
  });
});
