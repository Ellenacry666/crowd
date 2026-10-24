import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.test'), override: true });

if (!process.env.DATABASE_URL?.includes('_test')) {
  throw new Error('Refusing to run e2e tests: DATABASE_URL must point to a *_test database.');
}
