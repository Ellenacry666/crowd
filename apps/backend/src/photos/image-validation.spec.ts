import { detectImageType } from './image-validation';

describe('detectImageType', () => {
  it('mengenali JPEG, PNG, dan WebP dari magic bytes', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
    expect(
      detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])),
    ).toEqual({ mime: 'image/png', ext: 'png' });
    expect(detectImageType(Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 2, 3, 4]), Buffer.from('WEBPVP8 ')]))).toEqual({
      mime: 'image/webp',
      ext: 'webp',
    });
  });

  it('menolak GIF, teks, HTML, SVG, PDF, dan buffer kosong atau terlalu pendek', () => {
    for (const bad of [
      Buffer.from('GIF89a....'),
      Buffer.from('hello world, ini bukan gambar'),
      Buffer.from('<html><script>alert(1)</script></html>'),
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      Buffer.from('%PDF-1.4'),
      Buffer.alloc(0),
      Buffer.from([0xff, 0xd8]),
    ]) {
      expect(detectImageType(bad)).toBeNull();
    }
  });

  it('tidak tertipu ekstensi: file berawalan teks tetap ditolak walau berisi JPEG di tengah', () => {
    expect(detectImageType(Buffer.concat([Buffer.from('xx'), Buffer.from([0xff, 0xd8, 0xff])]))).toBeNull();
  });
});
