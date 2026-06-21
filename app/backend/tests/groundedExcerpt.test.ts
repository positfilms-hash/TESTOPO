// SPEC 028-E (recomendacion de la review): trazabilidad fiable del excerpt.
// La fuente guardada solo conserva el `source_excerpt` de la IA si esta
// realmente contenido en el fragmento recuperado; si la IA inventa una cita,
// se guarda el fragmento recuperado.

import { describe, expect, it } from 'vitest';
import { groundedExcerpt } from '../src/index.js';

const RETRIEVED =
  'Articulo 14. Los espanoles son iguales ante la ley, sin que pueda prevalecer discriminacion alguna.';

describe('groundedExcerpt', () => {
  it('conserva el excerpt de la IA si esta contenido en el recuperado', () => {
    expect(groundedExcerpt('iguales ante la ley', RETRIEVED)).toBe(
      'iguales ante la ley',
    );
  });

  it('ignora espacios y mayusculas al comprobar la contencion', () => {
    expect(groundedExcerpt('  Iguales   ante  la LEY ', RETRIEVED)).toBe(
      'Iguales   ante  la LEY',
    );
  });

  it('cae al recuperado si la IA inventa una cita que no esta en el fragmento', () => {
    expect(
      groundedExcerpt('el plazo de recurso es de 30 dias habiles', RETRIEVED),
    ).toBe(RETRIEVED);
  });

  it('cae al recuperado si la IA no devuelve excerpt', () => {
    expect(groundedExcerpt(null, RETRIEVED)).toBe(RETRIEVED);
    expect(groundedExcerpt('   ', RETRIEVED)).toBe(RETRIEVED);
  });

  it('devuelve null si no hay recuperado y la cita no es verificable', () => {
    expect(groundedExcerpt('cualquier cosa', null)).toBeNull();
    expect(groundedExcerpt(null, '')).toBeNull();
  });
});
