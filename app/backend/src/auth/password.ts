// Hash de contrasena para el MVP (SPEC 010, 8). Sincrono y sin dependencias
// para poder ejecutarse tanto en Node (tests) como en el navegador (frontend).
//
// IMPORTANTE: este hash NO es de grado produccion (no usa PBKDF2/bcrypt/argon2).
// Su unico objetivo en el MVP es NO guardar la contrasena en texto plano. Una
// spec posterior debe sustituirlo por un hash fuerte (idealmente asincrono).

import { randomUUID } from 'node:crypto';

function fnv1a(input: string): string {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function hashPassword(plain: string, salt: string = randomUUID()): string {
  return `${salt}$${fnv1a(`${salt}:${plain}`)}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split('$');
  if (!salt || !hash) {
    return false;
  }
  return fnv1a(`${salt}:${plain}`) === hash;
}
