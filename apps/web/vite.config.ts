import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Port 5173 dikunci karena backend hanya mengizinkan CORS dari http://localhost:5173
// (lihat CORS_ORIGINS di apps/backend/.env).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
