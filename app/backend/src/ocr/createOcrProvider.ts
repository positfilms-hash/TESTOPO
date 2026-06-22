// Factory del proveedor OCR (SPEC 030). Por defecto el mock (sin red). El
// proveedor REAL (Edge Function / servidor) se enchufa en Fase 2; su clave es un
// secreto del servidor, NUNCA del frontend/Vite.

import type { OcrProvider } from './ocrProvider.js';
import { MockOcrProvider } from './mockOcrProvider.js';

export function createOcrProvider(): OcrProvider {
  // Fase 1: mock deterministico. Fase 2: seleccionar EdgeFunctionOcrProvider
  // cuando el entorno lo configure (clave del proveedor en la Edge Function).
  return new MockOcrProvider();
}
