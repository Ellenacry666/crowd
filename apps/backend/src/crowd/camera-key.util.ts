import { createHash, randomBytes } from 'crypto';

export const CAMERA_KEY_HEADER = 'x-camera-key';

export function generateCameraKey(): string {
  return `cpk_${randomBytes(24).toString('hex')}`;
}

/** Key bersifat acak 192-bit, sehingga SHA-256 sudah cukup (tidak perlu hash lambat seperti password). */
export function hashCameraKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
