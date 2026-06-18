// Categorias de carga masiva (SPEC 028). La UX solo expone DOS categorias
// principales al usuario: `Material de la oposicion` y `Tests antiguos`. La
// tercera (`mixed`) describe un ZIP/carpeta combinado y se resuelve por carpeta.
//
// `upload_category` = lo que el usuario eligio (o `mixed` para combinado).
// `detected_category` = lo que la app infiere por archivo (puede ser `unknown`).

export const UPLOAD_CATEGORIES = [
  'opposition_material',
  'old_tests',
  'mixed',
] as const;
export type UploadCategory = (typeof UPLOAD_CATEGORIES)[number];

export const DETECTED_CATEGORIES = [
  'opposition_material',
  'old_tests',
  'unknown',
] as const;
export type DetectedCategory = (typeof DETECTED_CATEGORIES)[number];

export function isUploadCategory(value: unknown): value is UploadCategory {
  return (
    typeof value === 'string' &&
    (UPLOAD_CATEGORIES as readonly string[]).includes(value)
  );
}

export function isDetectedCategory(value: unknown): value is DetectedCategory {
  return (
    typeof value === 'string' &&
    (DETECTED_CATEGORIES as readonly string[]).includes(value)
  );
}
