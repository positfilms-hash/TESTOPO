// Segmentacion basica de texto en secciones (SPEC 028-C, 13-19). Funcion pura y
// determinista (sin red, sin OCR/embeddings). Estrategia simple y robusta:
//
//   1. Tests antiguos -> bloques de preguntas numeradas (exam_question_block).
//   2. Resto -> epigrafes (TEMA/Articulo/Capitulo/Titulo) si hay >= 2;
//   3. Fallback -> chunks de tamano razonable.
//
// NOTA: el extractor PDF colapsa los saltos de linea, asi que los epigrafes se
// detectan por marcadores INLINE (no por inicio de linea). Las paginas no se
// conservan, por eso `page_start`/`page_end` quedan null aqui.

import type { DocumentClass } from '../models/documentClassification.js';
import type { SectionType } from '../models/materialSection.js';
import {
  loadSegmentConfig,
  type SegmentConfig,
} from './segmentConfig.js';

export interface TextSegment {
  section_title: string;
  section_type: SectionType;
  content_text: string;
  content_excerpt: string;
  order_index: number;
}

const EXCERPT_CHARS = 200;

// Epigrafes inline: "Tema 3", "Articulo 14", "Capitulo II", "Titulo I".
const HEADING_RE =
  /(?:tema|art[ií]culo|art\.|cap[ií]tulo|t[ií]tulo)\s+[ivxlcdm\d]+/gi;

// Marcadores de pregunta numerada: "1)", "12.", al inicio o tras espacio.
const QUESTION_RE = /(?:^|\s)(\d{1,3})[).]\s/g;

export function segmentText(
  text: string,
  documentClass: DocumentClass,
  config: SegmentConfig = loadSegmentConfig(),
): TextSegment[] {
  const trimmed = (text ?? '').trim();
  if (trimmed.length === 0) {
    return [];
  }

  let raw: { title: string; type: SectionType; content: string }[];

  if (documentClass === 'old_exam_or_test') {
    raw = segmentExam(trimmed, config);
    if (raw.length === 0) {
      raw = chunk(trimmed, 'exam_question_block', 'Bloque', config);
    }
  } else {
    const headingType: SectionType =
      documentClass === 'index_or_table_of_contents' ? 'toc_block' : 'heading';
    raw = segmentByHeadings(trimmed, headingType);
    if (raw.length < 2) {
      const fallbackType: SectionType =
        documentClass === 'index_or_table_of_contents' ? 'toc_block' : 'chunk';
      raw = chunk(trimmed, fallbackType, 'Fragmento', config);
    }
  }

  return raw.map((seg, index) => ({
    section_title: seg.title,
    section_type: seg.type,
    content_text: seg.content,
    content_excerpt: excerpt(seg.content),
    order_index: index,
  }));
}

function segmentByHeadings(
  text: string,
  type: SectionType,
): { title: string; type: SectionType; content: string }[] {
  const matches = [...text.matchAll(HEADING_RE)];
  if (matches.length < 2) {
    return [];
  }
  const segs: { title: string; type: SectionType; content: string }[] = [];
  for (let k = 0; k < matches.length; k++) {
    const start = matches[k].index ?? 0;
    const end = k + 1 < matches.length ? (matches[k + 1].index ?? text.length) : text.length;
    const content = text.slice(start, end).trim();
    if (content.length === 0) {
      continue;
    }
    segs.push({ title: capitalize(matches[k][0].trim()), type, content });
  }
  return segs;
}

function segmentExam(
  text: string,
  config: SegmentConfig,
): { title: string; type: SectionType; content: string }[] {
  const matches = [...text.matchAll(QUESTION_RE)];
  if (matches.length < 2) {
    return [];
  }
  const per = config.questions_per_block;
  const segs: { title: string; type: SectionType; content: string }[] = [];
  for (let k = 0; k < matches.length; k += per) {
    const startMatch = matches[k];
    const lastInBlock = matches[Math.min(k + per, matches.length) - 1];
    const startIdx = startMatch.index ?? 0;
    const endIdx =
      k + per < matches.length ? (matches[k + per].index ?? text.length) : text.length;
    const content = text.slice(startIdx, endIdx).trim();
    if (content.length === 0) {
      continue;
    }
    segs.push({
      title: `Preguntas ${startMatch[1]}-${lastInBlock[1]}`,
      type: 'exam_question_block',
      content,
    });
  }
  return segs;
}

function chunk(
  text: string,
  type: SectionType,
  titlePrefix: string,
  config: SegmentConfig,
): { title: string; type: SectionType; content: string }[] {
  if (text.length <= config.max_chunk_chars) {
    return [{ title: `${titlePrefix} 1`, type, content: text }];
  }
  const step = Math.max(1, config.max_chunk_chars - config.overlap_chars);
  const segs: { title: string; type: SectionType; content: string }[] = [];
  let n = 1;
  for (let i = 0; i < text.length; i += step) {
    const content = text.slice(i, i + config.max_chunk_chars).trim();
    if (content.length > 0) {
      segs.push({ title: `${titlePrefix} ${n}`, type, content });
      n += 1;
    }
    if (i + config.max_chunk_chars >= text.length) {
      break;
    }
  }
  return segs;
}

function excerpt(content: string): string {
  const clean = content.trim();
  return clean.length <= EXCERPT_CHARS
    ? clean
    : `${clean.slice(0, EXCERPT_CHARS).trim()}...`;
}

function capitalize(value: string): string {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
}
