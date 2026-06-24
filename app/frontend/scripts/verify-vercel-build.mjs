// Verificacion del build de Vercel (Root Directory = app/frontend).
//
// Vercel solo instala las dependencias de app/frontend; NO instala
// app/backend/node_modules. Como el bundle incluye ficheros de app/backend/src
// (via el alias `@backend`) que importan dependencias compartidas (pdfjs-dist,
// fflate), el build solo es correcto si Vite las resuelve desde app/frontend
// (resolve.dedupe en vite.config.ts).
//
// Esta verificacion REPRODUCE ese entorno de forma deterministica y SIN red:
//   1) oculta temporalmente app/backend/node_modules (simula "solo frontend
//      instalado"),
//   2) limpia la cache del optimizador de Vite,
//   3) ejecuta `vite build`,
//   4) restaura app/backend/node_modules pase lo que pase.
// Si el build pasa sin app/backend/node_modules, el deploy de Vercel tambien lo
// hara. No modifica el comportamiento de extraccion PDF ni de lectura de ZIP.

import { spawnSync } from 'node:child_process';
import { existsSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const frontendDir = join(here, '..');
const repoRoot = join(frontendDir, '..', '..');
const backendNodeModules = join(repoRoot, 'app', 'backend', 'node_modules');
const hidden = `${backendNodeModules}.verify-hidden`;
const viteCache = join(frontendDir, 'node_modules', '.vite');

let movedBackend = false;

function restore() {
  if (movedBackend && existsSync(hidden) && !existsSync(backendNodeModules)) {
    renameSync(hidden, backendNodeModules);
    movedBackend = false;
  }
}

process.on('exit', restore);
process.on('SIGINT', () => {
  restore();
  process.exit(1);
});

try {
  if (existsSync(hidden)) {
    // Restos de una ejecucion previa interrumpida: recuperalos antes de empezar.
    if (!existsSync(backendNodeModules)) renameSync(hidden, backendNodeModules);
    else rmSync(hidden, { recursive: true, force: true });
  }
  if (existsSync(backendNodeModules)) {
    renameSync(backendNodeModules, hidden);
    movedBackend = true;
  }
  rmSync(viteCache, { recursive: true, force: true });

  console.log('[verify-vercel-build] Construyendo SIN app/backend/node_modules…');
  // Ejecuta el binario JS de Vite con el propio Node (sin shell ni npx): es
  // deterministico y multiplataforma.
  const viteBin = join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [viteBin, 'build'], {
    cwd: frontendDir,
    stdio: 'inherit',
  });
  restore();

  if (result.status !== 0) {
    console.error(
      '\n[verify-vercel-build] FALLO: el build no resuelve alguna dependencia sin ' +
        'app/backend/node_modules. Revisa resolve.dedupe en vite.config.ts.',
    );
    process.exit(result.status ?? 1);
  }
  console.log('\n[verify-vercel-build] OK: el build de Vercel (solo frontend) pasa.');
} finally {
  restore();
}
