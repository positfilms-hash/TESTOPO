// Lectura de archivos ZIP (SPEC 017). Inyectable para poder sustituir el motor
// en el futuro; el default usa `fflate` (sincrono, funciona en Node y en el
// navegador, sin dependencias transitivas) y soporta entradas comprimidas
// (DEFLATE) ademas de las almacenadas (STORED).
//
// La SEGURIDAD (Zip Slip, rutas `../`, ZIP anidado, limites) NO se aplica aqui:
// la decide `MaterialImportService` sobre las entradas devueltas. Este lector
// solo descomprime y entrega rutas + bytes tal cual vienen.

import { unzipSync } from 'fflate';
import { ImportError, ImportErrorCode } from './importErrors.js';

export interface ZipEntry {
  /** Ruta tal cual aparece en el ZIP (las carpetas terminan en `/`). */
  path: string;
  bytes: Uint8Array;
}

export interface ZipReader {
  read(bytes: Uint8Array): ZipEntry[];
}

export class FflateZipReader implements ZipReader {
  read(bytes: Uint8Array): ZipEntry[] {
    let map: Record<string, Uint8Array>;
    try {
      map = unzipSync(bytes);
    } catch {
      throw new ImportError([ImportErrorCode.ZIP_INVALID]);
    }
    return Object.entries(map).map(([path, content]) => ({
      path,
      bytes: content,
    }));
  }
}
