import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Port 5174 agar tidak bentrok dengan web user (5173). Harus ada di CORS_ORIGINS backend.
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true },
  test: { environment: 'jsdom', globals: true },
});
