import { QrSigner } from './qr-signer';

const SECRET = 'unit_test_qr_secret_unit_test_qr_secret_0123456789';

describe('QrSigner', () => {
  const signer = new QrSigner(SECRET);

  it('menolak secret pendek', () => {
    expect(() => new QrSigner('short')).toThrow();
  });

  it('menghasilkan ticketCode base32 26 karakter yang unik', () => {
    const codes = new Set(Array.from({ length: 200 }, () => signer.generateTicketCode()));
    expect(codes.size).toBe(200);
    for (const c of codes) expect(c).toMatch(/^[A-Z2-7]{26}$/);
  });

  it('payload valid dapat di-parse kembali', () => {
    const code = signer.generateTicketCode();
    const payload = signer.buildPayload(code);
    expect(payload).toMatch(/^CP1\.[A-Z2-7]{26}\.[0-9a-f]{24}$/);
    expect(signer.parsePayload(payload)).toEqual({ ticketCode: code });
  });

  it('menolak signature yang diubah', () => {
    const code = signer.generateTicketCode();
    const payload = signer.buildPayload(code);
    const tampered = payload.slice(0, -1) + (payload.endsWith('0') ? '1' : '0');
    expect(signer.parsePayload(tampered)).toBeNull();
  });

  it('menolak payload yang ditandatangani dengan secret lain', () => {
    const other = new QrSigner('another_secret_another_secret_another_secret_99');
    const payload = other.buildPayload(other.generateTicketCode());
    expect(signer.parsePayload(payload)).toBeNull();
  });

  it('menolak input sampah', () => {
    for (const bad of ['', 'abc', 'CP1.x.y', null, undefined, 123, 'CP2.AAAAAAAAAAAAAAAAAAAAAAAAAA.000000000000000000000000', 'x'.repeat(500)]) {
      expect(signer.parsePayload(bad)).toBeNull();
    }
  });
});
