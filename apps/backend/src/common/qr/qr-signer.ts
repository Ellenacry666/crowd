import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PAYLOAD_RE = /^CP1\.([A-Z2-7]{26})\.([0-9a-f]{24})$/;

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

/**
 * Payload QR: CP1.<ticketCode>.<signature>
 * - ticketCode: 128-bit acak (base32, 26 karakter)
 * - signature : 24 hex pertama dari HMAC-SHA256(ticketCode, QR_SECRET)
 * Tidak ada data pribadi di dalam QR.
 */
export class QrSigner {
  constructor(private readonly secret: string) {
    if (!secret || secret.length < 32) {
      throw new Error('QR secret must be at least 32 characters long');
    }
  }

  generateTicketCode(): string {
    return base32Encode(randomBytes(16));
  }

  sign(ticketCode: string): string {
    return createHmac('sha256', this.secret).update(ticketCode).digest('hex').slice(0, 24);
  }

  buildPayload(ticketCode: string): string {
    return `CP1.${ticketCode}.${this.sign(ticketCode)}`;
  }

  /** Mengembalikan null jika format salah atau signature tidak cocok (tanpa menyentuh database). */
  parsePayload(payload: unknown): { ticketCode: string } | null {
    if (typeof payload !== 'string' || payload.length > 100) return null;
    const match = PAYLOAD_RE.exec(payload.trim());
    if (!match) return null;
    const [, ticketCode, signature] = match;
    const expected = Buffer.from(this.sign(ticketCode), 'utf8');
    const actual = Buffer.from(signature, 'utf8');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    return { ticketCode };
  }
}
