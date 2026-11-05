import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

const KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/**
 * Penyimpanan foto di disk lokal, di luar direktori yang disajikan secara statis.
 * Foto hanya dapat diakses lewat endpoint terautentikasi (lihat PhotosController).
 * Nama file acak (UUID) dan divalidasi ketat sehingga path traversal tidak mungkin.
 */
@Injectable()
export class PhotoStorageService {
  private readonly dir: string;

  constructor() {
    this.dir = path.resolve(process.env.UPLOAD_DIR ?? './storage/photos');
  }

  async save(buffer: Buffer, ext: string): Promise<string> {
    await fs.mkdir(this.dir, { recursive: true });
    const key = `${randomUUID()}.${ext}`;
    await fs.writeFile(path.join(this.dir, key), buffer, { flag: 'wx', mode: 0o600 });
    return key;
  }

  async read(key: string): Promise<Buffer> {
    this.assertKey(key);
    return fs.readFile(path.join(this.dir, key));
  }

  /** Best effort: kegagalan menghapus file tidak boleh menggagalkan alur utama. */
  async remove(key: string): Promise<void> {
    try {
      this.assertKey(key);
      await fs.unlink(path.join(this.dir, key));
    } catch {
      /* file sudah tidak ada */
    }
  }

  private assertKey(key: string) {
    if (!KEY_RE.test(key)) throw new Error('Invalid storage key');
  }
}
