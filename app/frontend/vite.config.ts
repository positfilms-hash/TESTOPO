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
    // Deploy de Vercel (Root Directory app/frontend): el bundle incluye ficheros de
    // `app/backend/src` (via el alias `@backend`) que importan dependencias
    // COMPARTIDAS (`pdfjs-dist` en pdfTextExtractor, `fflate` en zipReader). Sin
    // esto, Vite/Rollup resuelve esos paquetes RELATIVO al importador (arbol
    // app/backend), que en Vercel no tiene node_modules -> "failed to resolve
    // import". `dedupe` fuerza a resolverlos desde la raiz del proyecto
    // (app/frontend), donde SI estan instalados. No cambia el comportamiento de
    // extraccion PDF ni de lectura de ZIP. (Rollup falla en el primer import sin
    // resolver, por eso deben estar TODOS los paquetes compartidos.)
    dedupe: ['pdfjs-dist', 'fflate'],
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
