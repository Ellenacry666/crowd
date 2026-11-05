import * as dotenv from 'dotenv';
import { tmpdir } from 'os';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.test'), override: true });

// Banyak spec lama membeli lebih dari 5 tiket dengan akun dan acara yang sama untuk menguji hal lain.
// Batas per akun per acara diuji khusus di ticket-limit.e2e-spec.ts (dengan nilai bawaan 5).
process.env.MAX_TICKETS_PER_USER_PER_EVENT = '1000';

// Foto uji ditulis ke folder sementara, bukan ke storage pengembangan.
process.env.UPLOAD_DIR = resolve(tmpdir(), 'crowdpulse-test-photos');

if (!process.env.DATABASE_URL?.includes('_test')) {
  throw new Error('Refusing to run e2e tests: DATABASE_URL must point to a *_test database.');
}
