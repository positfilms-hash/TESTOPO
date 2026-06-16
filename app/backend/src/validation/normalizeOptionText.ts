// Normaliza el texto de una opcion para detectar duplicados (SPEC 001, 7.9):
// se ignoran los espacios sobrantes y las diferencias de mayusculas/minusculas.

export function normalizeOptionText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}
