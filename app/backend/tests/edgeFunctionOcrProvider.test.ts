// Proveedor OCR via Edge Function (SPEC 030, Fase 2). SIN red real: se inyecta un
// `fetch` simulado. Verifica el contrato HTTP (envia pagina + imagen en base64,
// adjunta el Bearer), el parseo de la respuesta, el manejo de errores (transporte
// y estado no-2xx) y que el factory selecciona mock vs Edge Function.

import { describe, expect, it, vi } from 'vitest';
import {
  EdgeFunctionOcrProvider,
  MockOcrProvider,
  createOcrProvider,
  OcrError,
  OcrErrorCode,
  type RenderedPage,
} from '../src/index.js';

const page: RenderedPage = {
  page_number: 2,
  image: new Uint8Array([1, 2, 3, 4]),
  image_ref: null,
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('EdgeFunctionOcrProvider', () => {
  it('envia pagina + imagen base64 con Bearer y parsea la respuesta', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ text: 'Texto OCR', confidence: 0.82, warnings: ['rev'] }),
    );
    const provider = new EdgeFunctionOcrProvider({
      url: 'https://example.test/functions/v1/ocr-material',
      getAuthToken: async () => 'tok-123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await provider.recognizePage(page);

    expect(result).toEqual({
      page_number: 2,
      text: 'Texto OCR',
      confidence: 0.82,
      warnings: ['rev'],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('ocr-material');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
    const sent = JSON.parse(init.body as string);
    expect(sent.page_number).toBe(2);
    expect(typeof sent.image_base64).toBe('string');
    expect(sent.image_base64.length).toBeGreaterThan(0);
    // La clave del proveedor NUNCA viaja en la peticion del frontend.
    expect(JSON.stringify(init)).not.toMatch(/service_role|api[_-]?key/i);
  });

  it('confidence ausente o no numerico -> null', async () => {
    const provider = new EdgeFunctionOcrProvider({
      url: 'https://example.test/ocr',
      fetchImpl: (async () => jsonResponse({ text: 'x' })) as unknown as typeof fetch,
    });
    const result = await provider.recognizePage(page);
    expect(result.confidence).toBeNull();
    expect(result.warnings).toEqual([]);
  });

  it('estado no-2xx lanza OcrError(PAGE_FAILED)', async () => {
    const provider = new EdgeFunctionOcrProvider({
      url: 'https://example.test/ocr',
      fetchImpl: (async () => jsonResponse({}, false, 502)) as unknown as typeof fetch,
    });
    await expect(provider.recognizePage(page)).rejects.toMatchObject({
      code: OcrErrorCode.PAGE_FAILED,
    });
  });

  it('fallo de transporte lanza OcrError(PAGE_FAILED)', async () => {
    const provider = new EdgeFunctionOcrProvider({
      url: 'https://example.test/ocr',
      fetchImpl: (async () => {
        throw new Error('network down');
      }) as unknown as typeof fetch,
    });
    await expect(provider.recognizePage(page)).rejects.toBeInstanceOf(OcrError);
  });
});

describe('createOcrProvider', () => {
  it('sin edgeFunctionUrl devuelve el mock (demo/tests)', () => {
    expect(createOcrProvider()).toBeInstanceOf(MockOcrProvider);
  });

  it('con edgeFunctionUrl devuelve el proveedor Edge Function', () => {
    const provider = createOcrProvider({ edgeFunctionUrl: 'https://example.test/ocr' });
    expect(provider).toBeInstanceOf(EdgeFunctionOcrProvider);
    expect(provider.name).toBe('edge-function-ocr');
  });
});
