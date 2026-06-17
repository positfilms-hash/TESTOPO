// Regresion de SPEC 016 (9.5): la UI nunca debe mostrar valores internos en
// ingles (draft, pending_review, completed, revoked, in_progress...). Estas
// pruebas fijan las etiquetas de estado y dificultad en espanol.

import { describe, expect, it } from 'vitest';
import { statusLabel, difficultyLabel } from '../src/components/ui.js';

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
