import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// El frontend reutiliza la logica del backend importandola directamente (SPEC
// 009: adapter en el navegador, sin API). Se aliasa `node:crypto` a un shim de
// Web Crypto para poder ejecutar los servicios en el navegador.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@backend': fileURLToPath(
        new URL('../backend/src/index.ts', import.meta.url),
      ),
      'node:crypto': fileURLToPath(
        new URL('./src/shims/nodeCrypto.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    // Permite servir la carpeta hermana app/backend (importada por alias).
    fs: { allow: ['..', '../..'] },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
