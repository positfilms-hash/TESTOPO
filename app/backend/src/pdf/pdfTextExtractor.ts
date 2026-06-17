// Extraccion basica de texto de PDF (SPEC 012, 10). SIN OCR.
//
// Interfaz inyectable para poder enchufar en el futuro un extractor real
// (p. ej. pdfjs) sin cambiar la logica. El default (`NaivePdfTextExtractor`) es
// JS puro, sin dependencias y funciona en Node y en el navegador: extrae texto
// de PDFs con capa de texto SIN comprimir y marca `not_supported` cuando no
// encuentra texto extraible (PDFs comprimidos o escaneados). No finge.

import type { ExtractionStatus } from '../models/material.js';

export interface PdfExtractionResult {
  text: string;
  page_count: number | null;
  status: Extract<ExtractionStatus, 'completed' | 'failed' | 'not_supported'>;
}

export interface PdfTextExtractor {
  readonly name: string;
  extract(bytes: Uint8Array): PdfExtractionResult;
}

export class NaivePdfTextExtractor implements PdfTextExtractor {
  readonly name = 'naive-pdf-extractor-1';

  extract(bytes: Uint8Array): PdfExtractionResult {
    try {
      const raw = latin1Decode(bytes);
      const pageCount = countPages(raw);
      const text = extractTextLiterals(raw);
      if (text.trim().length === 0) {
        // Probablemente comprimido (FlateDecode) o escaneado: sin OCR no se puede.
        return { text: '', page_count: pageCount, status: 'not_supported' };
      }
      return { text, page_count: pageCount, status: 'completed' };
    } catch {
      return { text: '', page_count: null, status: 'failed' };
    }
  }
}

function latin1Decode(bytes: Uint8Array): string {
  let out = '';
  // Por bloques para no reventar el stack en archivos grandes.
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

// Extrae las cadenas de texto (literales entre parentesis) dentro de los bloques
// de texto BT ... ET. Solo funciona con streams de contenido sin comprimir.
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
