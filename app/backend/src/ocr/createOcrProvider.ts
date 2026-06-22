// Factory del proveedor OCR (SPEC 030). Por defecto el mock (sin red). El
// proveedor REAL se enchufa en Fase 2 cuando hay una Edge Function configurada:
// `EdgeFunctionOcrProvider` delega el reconocimiento en la funcion de servidor,
// que es quien guarda la CLAVE del proveedor OCR/vision. La clave es un secreto
// del SERVIDOR, NUNCA del frontend/Vite.

import type { OcrProvider } from './ocrProvider.js';
import { MockOcrProvider } from './mockOcrProvider.js';
import { EdgeFunctionOcrProvider } from './edgeFunctionOcrProvider.js';

export interface CreateOcrProviderOptions {
  /** URL de la Edge Function de OCR. Si falta, se usa el mock (demo/tests). */
  edgeFunctionUrl?: string | null;
  /** Modelo informado (metadata). */
  model?: string | null;
  /** Token de sesion del gestor (Bearer) para autenticar la Edge Function. */
  getAuthToken?: () => Promise<string | null> | string | null;
  /** `fetch` inyectable (tests). */
  fetchImpl?: typeof fetch;
}

export function createOcrProvider(
  options: CreateOcrProviderOptions = {},
): OcrProvider {
  // Fase 2: con Edge Function configurada, proveedor real (clave en el servidor).
  if (options.edgeFunctionUrl) {
    return new EdgeFunctionOcrProvider({
      url: options.edgeFunctionUrl,
      model: options.model ?? null,
      getAuthToken: options.getAuthToken,
      fetchImpl: options.fetchImpl,
    });
  }
  // Fase 1 / demo / tests: mock deterministico sin red.
  return new MockOcrProvider();
}
