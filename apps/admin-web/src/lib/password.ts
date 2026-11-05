/** Aturan sama dengan backend (CreateStaffDto): 8–128 karakter, minimal satu huruf dan satu angka. */
export const passwordError = (p: string): string | null => {
  if (p.length < 8) return 'Password minimal 8 karakter.';
  if (p.length > 128) return 'Password maksimal 128 karakter.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Password harus mengandung minimal satu huruf dan satu angka.';
  return null;
};

// 32 karakter (tanpa I, O, 0, 1 yang mudah tertukar) sehingga `byte & 31` tidak bias.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePassword(length = 12): string {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    const p = Array.from(bytes, (b) => ALPHABET[b & 31]).join('');
    if (passwordError(p) === null) return p;
  }
}
