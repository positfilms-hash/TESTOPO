// Almacen de archivos sobre Supabase Storage (SPEC 029). Bucket PRIVADO: el
// original solo se abre con una URL FIRMADA de corta duracion emitida por la
// sesion del gestor (respeta las politicas del bucket). Nunca expone la ruta ni
// una URL publica, ni usa la service-role key.

import type { FileStorage } from './fileStorage.js';
import type { SupabaseClientPort } from '../repository/supabase/supabaseClientPort.js';

export const MATERIALS_BUCKET = 'materials';
const DEFAULT_SIGNED_URL_TTL = 300; // 5 minutos

export class SupabaseFileStorage implements FileStorage {
  constructor(
    private readonly port: SupabaseClientPort,
    private readonly bucket: string = MATERIALS_BUCKET,
  ) {}

  async save(storagePath: string, bytes: Uint8Array): Promise<void> {
    await this.port.storage(this.bucket).upload(storagePath, bytes, 'application/pdf');
  }

  async read(storagePath: string): Promise<Uint8Array | null> {
    return this.port.storage(this.bucket).download(storagePath);
  }

  async exists(storagePath: string): Promise<boolean> {
    return (await this.read(storagePath)) != null;
  }

  async remove(storagePath: string): Promise<void> {
    await this.port.storage(this.bucket).remove(storagePath);
  }

  async getSignedUrl(
    storagePath: string,
    expiresInSeconds: number = DEFAULT_SIGNED_URL_TTL,
  ): Promise<string | null> {
    return this.port
      .storage(this.bucket)
      .createSignedUrl(storagePath, expiresInSeconds);
  }
}
