// Validacion de calidad del texto extraido de un PDF.
//
// El extractor real (`PdfJsTextExtractor`) puede devolver texto cuando el PDF
// tiene una capa de texto, pero esa capa puede estar corrupta (fuentes sin
// ToUnicode, codificaciones rotas) y producir simbolos ilegibles. Esta funcion
// decide si el texto es lo bastante legible para guardarse como `completed`.
// Si no lo es, el material NO queda `completed` (pasa a `not_supported`/`failed`
// + `needs_review`) y por tanto NUNCA llega a clasificacion, secciones, indice
// ni generacion de preguntas. Sin OCR.

export interface TextQualityVerdict {
  ok: boolean;
  /** Motivo legible cuando `ok` es false; null cuando es aceptable. */
  reason: string | null;
  /** Proporcion [0,1] de caracteres legibles sobre el total no-espacio. */
  legible_ratio: number;
  /** Proporcion [0,1] de caracteres de reemplazo/control sobre el total. */
  bad_ratio: number;
  /** Numero absoluto de caracteres legibles no-espacio. */
  legible_chars: number;
}

// Umbrales conservadores: preferimos marcar `needs_review` antes que contaminar
// el pipeline con texto basura.
const MIN_LEGIBLE_CHARS = 16; // por debajo no hay texto util que clasificar
const MIN_LEGIBLE_RATIO = 0.6; // al menos el 60% de lo no-espacio debe ser legible
const MAX_BAD_RATIO = 0.1; // como mucho el 10% de basura (control/reemplazo)

// Caracteres legibles: letras y numeros Unicode, espacios y puntuacion habitual.
const LEGIBLE_RE = /[\p{L}\p{N}\s.,;:!?¿¡()«»"'\-–—/%º°ª&@#+*=\[\]{}]/u;

// "Basura": caracter de reemplazo U+FFFD y controles C0/C1 (salvo \t \n \r \f).
function isBadChar(code: number): boolean {
  if (code === 0xfffd) {
    return true;
  }
  if (code === 0x09 || code === 0x0a || code === 0x0d || code === 0x0c) {
    return false;
  }
  return code < 0x20 || (code >= 0x7f && code <= 0x9f);
}

export function assessTextQuality(text: string): TextQualityVerdict {
  const total = text.length;
  if (total === 0) {
    return {
      ok: false,
      reason: 'texto vacio',
      legible_ratio: 0,
      bad_ratio: 0,
      legible_chars: 0,
    };
  }

  let nonSpace = 0;
  let legible = 0;
  let bad = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (isBadChar(code)) {
      bad += 1;
    }
    if (!/\s/u.test(ch)) {
      nonSpace += 1;
      if (LEGIBLE_RE.test(ch)) {
        legible += 1;
      }
    }
  }

  const legibleRatio = nonSpace === 0 ? 0 : legible / nonSpace;
  const badRatio = bad / total;

  let reason: string | null = null;
  if (legible < MIN_LEGIBLE_CHARS) {
    reason = 'apenas hay texto legible';
  } else if (legibleRatio < MIN_LEGIBLE_RATIO) {
    reason = 'demasiados caracteres ilegibles';
  } else if (badRatio > MAX_BAD_RATIO) {
    reason = 'demasiados caracteres de control o de reemplazo';
  }

  return {
    ok: reason === null,
    reason,
    legible_ratio: legibleRatio,
    bad_ratio: badRatio,
    legible_chars: legible,
  };
}
