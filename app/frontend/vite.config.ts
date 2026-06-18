import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const frontendDir = fileURLToPath(new URL('.', import.meta.url));
const appDir = fileURLToPath(new URL('..', import.meta.url));
const backendEntry = fileURLToPath(
  new URL('../backend/src/index.ts', import.meta.url),
);
const cryptoShim = fileURLToPath(
  new URL('./src/shims/nodeCrypto.ts', import.meta.url),
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@backend': backendEntry,
      'node:crypto': cryptoShim,
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: [frontendDir, appDir],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
