// Extraccion de texto de PDF (SPEC 012). SIN OCR.
//
// `PdfJsTextExtractor` (default de produccion) usa PDF.js (`pdfjs-dist`), que SI
// resuelve streams comprimidos (FlateDecode), fuentes embebidas y mapas
// ToUnicode, asi que recupera texto real de PDFs normales. Extrae pagina a
// pagina (conservando saltos de linea/separadores de pagina para 028-C) y
// aplica una validacion de calidad: si el texto es ilegible o el PDF no tiene
// capa de texto (escaneado), NO se guarda como `completed` (queda
// `not_supported`/`failed`), de modo que el texto corrupto nunca llega a
// clasificacion, secciones, indice ni generacion de preguntas.
//
// `StubPdfTextExtractor` es un extractor deterministico SOLO para tests/dev
// (JS puro, sin dependencias): lee literales de PDFs sin comprimir. NO debe
// usarse en produccion porque no entiende streams comprimidos ni fuentes
// embebidas (era el antiguo `NaivePdfTextExtractor`, causa del bug de extraccion
// corrupta). El cableado de produccion (appStore) usa `PdfJsTextExtractor`.

import type { ExtractionStatus } from '../models/material.js';
import { assessTextQuality } from './pdfQuality.js';

/** Separador entre el texto de paginas distintas en `text`. */
export const PDF_PAGE_SEPARATOR = '\n\n';

export interface PdfPageText {
  page_number: number;
  text: string;
}

export interface PdfExtractionResult {
  /** Texto completo (paginas unidas por `PDF_PAGE_SEPARATOR`). */
  text: string;
  /** Texto por pagina, para segmentacion con rangos (028-C). */
  pages: PdfPageText[];
  page_count: number | null;
  status: Extract<ExtractionStatus, 'completed' | 'failed' | 'not_supported'>;
  /** Mensaje legible cuando no es `completed`; null cuando lo es. */
  message: string | null;
}

export interface PdfTextExtractor {
  readonly name: string;
  extract(bytes: Uint8Array): Promise<PdfExtractionResult>;
}

// --- Tipado minimo de la parte de PDF.js que usamos. Evita depender de la
// resolucion de tipos del subpath `legacy` y deja claro el contrato. ---
interface PdfjsTextItem {
  str?: string;
  hasEOL?: boolean;
}
interface PdfjsPage {
  getTextContent(): Promise<{ items: PdfjsTextItem[] }>;
  cleanup?(): void;
}
interface PdfjsDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfjsPage>;
  cleanup?(): Promise<void>;
  destroy?(): Promise<void>;
}
interface PdfjsModule {
  getDocument(src: {
    data: Uint8Array;
    isEvalSupported?: boolean;
    disableFontFace?: boolean;
    useSystemFonts?: boolean;
    verbosity?: number;
  }): { promise: Promise<PdfjsDocument> };
  GlobalWorkerOptions: { workerSrc: string };
}

export interface PdfJsTextExtractorOptions {
  // En el navegador (Vite) se inyecta la URL del worker de pdfjs. En Node se
  // deja vacio: pdfjs usa su "fake worker" en el hilo principal.
  workerSrc?: string;
}

export class PdfJsTextExtractor implements PdfTextExtractor {
  readonly name = 'pdfjs-text-extractor-1';
  private workerConfigured = false;

  constructor(private readonly options: PdfJsTextExtractorOptions = {}) {}

  async extract(bytes: Uint8Array): Promise<PdfExtractionResult> {
    let pdfjs: PdfjsModule;
    try {
      pdfjs = (await import(
        'pdfjs-dist/legacy/build/pdf.mjs'
      )) as unknown as PdfjsModule;
    } catch {
      return fail('No se pudo cargar el motor de extraccion de PDF.');
    }
    this.configureWorker(pdfjs);

    let doc: PdfjsDocument;
    try {
      // Copia los bytes: pdfjs puede transferir/detachar el buffer recibido.
      doc = await pdfjs.getDocument({
        data: bytes.slice(),
        isEvalSupported: false,
        disableFontFace: true,
        useSystemFonts: false,
        verbosity: 0, // solo errores (silencia warnings informativos de pdfjs)
      }).promise;
    } catch {
      return fail('No se pudo procesar el PDF (archivo dañado o no valido).');
    }

    const pageCount = doc.numPages;
    const pages: PdfPageText[] = [];
    try {
      for (let n = 1; n <= pageCount; n++) {
        const page = await doc.getPage(n);
        const content = await page.getTextContent();
        pages.push({ page_number: n, text: joinItems(content.items) });
        page.cleanup?.();
      }
    } catch {
      await safeDestroy(doc);
      return {
        text: '',
        pages: [],
        page_count: pageCount ?? null,
        status: 'failed',
        message: 'Error leyendo el contenido del PDF.',
      };
    }
    await safeDestroy(doc);

    const fullText = pages
      .map((p) => p.text)
      .join(PDF_PAGE_SEPARATOR)
      .trim();

    if (fullText.length === 0) {
      return {
        text: '',
        pages,
        page_count: pageCount,
        status: 'not_supported',
        message:
          'El PDF no contiene texto seleccionable (posible PDF escaneado). No se admite OCR.',
      };
    }

    const quality = assessTextQuality(fullText);
    if (!quality.ok) {
      return {
        text: '',
        pages,
        page_count: pageCount,
        status: 'not_supported',
        message: `El texto extraido del PDF no es legible (${quality.reason}). El material requiere revision.`,
      };
    }

    return {
      text: fullText,
      pages,
      page_count: pageCount,
      status: 'completed',
      message: null,
    };
  }

  private configureWorker(pdfjs: PdfjsModule): void {
    if (this.workerConfigured) {
      return;
    }
    this.workerConfigured = true;
    if (this.options.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = this.options.workerSrc;
    }
    // Sin workerSrc (Node), pdfjs usa el fake worker en el hilo principal.
  }
}

function joinItems(items: PdfjsTextItem[]): string {
  let out = '';
  for (const item of items) {
    if (typeof item.str !== 'string') {
      continue;
    }
    out += item.str;
    out += item.hasEOL ? '\n' : ' ';
  }
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function safeDestroy(doc: PdfjsDocument): Promise<void> {
  try {
    await doc.cleanup?.();
    await doc.destroy?.();
  } catch {
    // Limpieza best-effort.
  }
}

function fail(message: string): PdfExtractionResult {
  return { text: '', pages: [], page_count: null, status: 'failed', message };
}

// --- Stub deterministico SOLO para tests/dev. NO usar en produccion. ---
export class StubPdfTextExtractor implements PdfTextExtractor {
  readonly name = 'stub-pdf-extractor-1';

  async extract(bytes: Uint8Array): Promise<PdfExtractionResult> {
    try {
      const raw = latin1Decode(bytes);
      const pageCount = countPages(raw);
      const text = extractTextLiterals(raw);
      if (text.trim().length === 0) {
        return {
          text: '',
          pages: [],
          page_count: pageCount,
          status: 'not_supported',
          message:
            'El PDF no contiene texto seleccionable (posible PDF escaneado).',
        };
      }
      return {
        text,
        pages: [{ page_number: 1, text }],
        page_count: pageCount,
        status: 'completed',
        message: null,
      };
    } catch {
      return fail('No se pudo procesar el PDF.');
    }
  }
}

function latin1Decode(bytes: Uint8Array): string {
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return out;
}

function countPages(raw: string): number | null {
  const matches = raw.match(/\/Type\s*\/Page(?![s/])/g);
  return matches ? matches.length : null;
}

function extractTextLiterals(raw: string): string {
  const blocks = raw.match(/BT([\s\S]*?)ET/g);
  if (!blocks) {
    return '';
  }
  const parts: string[] = [];
  for (const block of blocks) {
    const literals = block.match(/\((?:\\.|[^()\\])*\)/g);
    if (!literals) {
      continue;
    }
    for (const literal of literals) {
      parts.push(decodePdfString(literal.slice(1, -1)));
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function decodePdfString(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}
