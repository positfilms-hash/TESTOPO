// Regresion de SPEC 016 (9.5): la UI nunca debe mostrar valores internos en
// ingles (draft, pending_review, completed, revoked, in_progress...). Estas
// pruebas fijan las etiquetas de estado y dificultad en espanol.

import { describe, expect, it } from 'vitest';
import {
  statusLabel,
  difficultyLabel,
  ocrStatusInfo,
  ocrCanRetry,
  ocrIsFirstRun,
  ocrHasOutcome,
} from '../src/components/ui.js';

describe('SPEC 016 - etiquetas de estado en espanol', () => {
  const cases: Array<[string, string]> = [
    ['draft', 'Borrador'],
    ['pending_review', 'Pendiente'],
    ['validated', 'Validada'],
    ['needs_fix', 'Necesita correccion'],
    ['rejected', 'Rechazada'],
    ['obsolete', 'Obsoleta'],
    ['active', 'Activo'],
    ['deprecated', 'Anticuado'],
    ['needs_review', 'Por revisar'],
    ['not_started', 'Sin procesar'],
    ['processing', 'Procesando'],
    ['completed', 'Completado'],
    ['failed', 'Fallido'],
    ['not_supported', 'Sin texto'],
    ['created', 'Creado'],
    ['in_progress', 'En curso'],
    ['submitted', 'Enviado'],
    ['cancelled', 'Cancelado'],
    ['revoked', 'Revocado'],
    ['pending', 'Pendiente'],
    ['suspended', 'Suspendido'],
    ['archived', 'Archivado'],
  ];

  it.each(cases)('estado %s -> %s', (status, label) => {
    expect(statusLabel(status)).toBe(label);
  });

  it('nunca filtra snake_case ni el valor crudo de un estado conocido', () => {
    for (const [status] of cases) {
      const label = statusLabel(status);
      expect(label).not.toContain('_');
      expect(label).not.toBe(status);
    }
  });

  it('humaniza estados desconocidos en vez de mostrar el valor tecnico', () => {
    expect(statusLabel('algun_estado_raro')).toBe('Algun estado raro');
    expect(statusLabel('algun_estado_raro')).not.toContain('_');
  });
});

describe('SPEC 016 - etiquetas de dificultad en espanol', () => {
  it.each([
    ['easy', 'Facil'],
    ['medium', 'Media'],
    ['hard', 'Dificil'],
    ['mixed', 'Mixta'],
  ])('dificultad %s -> %s', (value, label) => {
    expect(difficultyLabel(value)).toBe(label);
  });
});

describe('SPEC 030 - estado OCR por archivo (gestor)', () => {
  it.each([
    ['completed', 'Texto extraido'],
    ['scanned_detected', 'Escaneo detectado'],
    ['ocr_processing', 'Leyendo escaneo'],
    ['completed_ocr', 'Leido con OCR'],
    ['completed_ocr_with_warnings', 'OCR con advertencias'],
    ['ocr_failed', 'No se pudo leer'],
  ])('extraction_status %s -> badge "%s"', (status, label) => {
    expect(ocrStatusInfo(status)?.label).toBe(label);
  });

  it('no muestra badge OCR para estados sin mapa (ni undefined)', () => {
    expect(ocrStatusInfo('not_started')).toBeNull();
    expect(ocrStatusInfo(undefined)).toBeNull();
  });

  it('el boton OCR solo aparece en escaneo/advertencias/fallo', () => {
    expect(ocrCanRetry('scanned_detected')).toBe(true);
    expect(ocrCanRetry('completed_ocr_with_warnings')).toBe(true);
    expect(ocrCanRetry('ocr_failed')).toBe(true);
    // No reintentable: nativo, en proceso, ni OCR limpio.
    expect(ocrCanRetry('completed')).toBe(false);
    expect(ocrCanRetry('ocr_processing')).toBe(false);
    expect(ocrCanRetry('completed_ocr')).toBe(false);
  });

  it('distingue primer OCR (escaneo) de reintento', () => {
    expect(ocrIsFirstRun('scanned_detected')).toBe(true);
    expect(ocrIsFirstRun('ocr_failed')).toBe(false);
  });

  it('el detalle compacto solo aplica a resultados de OCR', () => {
    expect(ocrHasOutcome('completed_ocr')).toBe(true);
    expect(ocrHasOutcome('completed_ocr_with_warnings')).toBe(true);
    expect(ocrHasOutcome('ocr_failed')).toBe(true);
    expect(ocrHasOutcome('scanned_detected')).toBe(false);
    expect(ocrHasOutcome('completed')).toBe(false);
  });
});
