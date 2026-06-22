// Abstraccion de almacenamiento de archivos (SPEC 012 + 029). Separa el guardado
// fisico de la logica de negocio. El backend corre en Node (tests) y en el
// navegador (frontend), asi que el almacen es inyectable.
//
// SPEC 029: la interfaz es ASINCRONA y permite obtener una URL FIRMADA de corta
// duracion para previsualizar el original sin exponer la ruta interna ni un
// bucket publico. En modo Supabase el almacen real es `SupabaseFileStorage`
// (bucket privado); en memoria/demo se usa `InMemoryFileStorage` (sin URL
// firmada: el frontend construye un object URL desde los bytes).

export interface StoredFile {
  storage_path: string;
  bytes: Uint8Array;
}

export interface FileStorage {
  /** Guarda los bytes en la ruta interna indicada. */
  save(storagePath: string, bytes: Uint8Array): Promise<void>;
  read(storagePath: string): Promise<Uint8Array | null>;
  exists(storagePath: string): Promise<boolean>;
  /** Borra el objeto (best-effort). */
  remove(storagePath: string): Promise<void>;
  /**
   * URL firmada de corta duracion (segundos) para abrir el original. Devuelve
   * `null` cuando el almacen no firma (memoria): en ese caso el llamante usa los
   * bytes directamente.
   */
  getSignedUrl(
    storagePath: string,
    expiresInSeconds?: number,
  ): Promise<string | null>;
}

export class InMemoryFileStorage implements FileStorage {
  private readonly files = new Map<string, Uint8Array>();

  async save(storagePath: string, bytes: Uint8Array): Promise<void> {
    this.files.set(storagePath, bytes.slice());
  }

  async read(storagePath: string): Promise<Uint8Array | null> {
    const bytes = this.files.get(storagePath);
    return bytes ? bytes.slice() : null;
  }

  async exists(storagePath: string): Promise<boolean> {
    return this.files.has(storagePath);
  }

  async remove(storagePath: string): Promise<void> {
    this.files.delete(storagePath);
  }

  async getSignedUrl(): Promise<string | null> {
    return null; // sin firma en memoria: el frontend usa los bytes (object URL).
  }
}
