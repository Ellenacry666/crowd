import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv';
import { generatePassword, passwordError } from './password';

describe('passwordError (aturan sama dengan backend)', () => {
  it.each([
    ['abc12', 'minimal 8'],
    ['abcdefgh', 'huruf dan satu angka'],
    ['12345678', 'huruf dan satu angka'],
  ])('menolak %s', (p, msg) => expect(passwordError(p)).toContain(msg));
  it('menerima huruf+angka ≥ 8 karakter', () => expect(passwordError('Petugas123')).toBeNull());
});

describe('generatePassword', () => {
  it('selalu memenuhi aturan dan tidak berulang', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const p = generatePassword();
      expect(p).toHaveLength(12);
      expect(passwordError(p)).toBeNull();
      seen.add(p);
    }
    expect(seen.size).toBe(300);
  });
});

describe('CSV', () => {
  it('melindungi dari CSV injection pada teks, bukan pada angka negatif', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell(-5)).toBe('-5');
  });
  it('meng-escape koma, kutip, dan baris baru', () => {
    expect(csvCell('Konser, Live "Demo"')).toBe('"Konser, Live ""Demo"""');
    expect(csvCell('a\nb')).toBe('"a\nb"');
    expect(csvCell(null)).toBe('');
  });
  it('baris dipisah CRLF', () => expect(toCsv([['a', 1], ['b', 2]])).toBe('a,1\r\nb,2'));
});
