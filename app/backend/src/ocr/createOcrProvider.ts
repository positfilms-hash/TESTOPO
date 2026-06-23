// Factory del proveedor OCR (SPEC 030/034). En proceso (InMemory/demo) el OCR usa
// el proveedor MOCK deterministico (sin red ni claves).
//
// El antiguo seam `EdgeFunctionOcrProvider` (el navegador rendereaba cada pagina a
// imagen y la enviaba a la Edge Function con `{ page_number, image_base64 }`) queda
// EXPLICITAMENTE SUPERADO por SPEC 034: el OCR real es server-owned y corre integro
// en la Edge Function `ocr-material` (descarga del PDF + render + vision en el
// servidor). Por eso el contrato browser-image se elimino y no debe reutilizarse.

import type { OcrProvider } from './ocrProvider.js';
import { MockOcrProvider } from './mockOcrProvider.js';

export function createOcrProvider(): OcrProvider {
  // Solo proceso/demo/tests: mock deterministico sin red. El OCR real vive en la
  // Edge Function server-owned (SPEC 034), no en un proveedor del backend.
  return new MockOcrProvider();
}
