// Abstraccion de almacenamiento de archivos (SPEC 012). Separa el guardado
// fisico de la logica de negocio. El backend corre en Node (tests) y en el
// navegador (frontend), asi que el almacen es inyectable; el default es en
// memoria. Una implementacion real escribiria en `/uploads` (fuera del repo,
// ignorado por Git).

export interface StoredFile {
  storage_path: string;
  bytes: Uint8Array;
}

export interface FileStorage {
  /** Guarda los bytes en la ruta interna indicada. */
  save(storagePath: string, bytes: Uint8Array): void;
  read(storagePath: string): Uint8Array | null;
  exists(storagePath: string): boolean;
}

export class InMemoryFileStorage implements FileStorage {
  private readonly files = new Map<string, Uint8Array>();

  save(storagePath: string, bytes: Uint8Array): void {
    this.files.set(storagePath, bytes.slice());
  }

  read(storagePath: string): Uint8Array | null {
    const bytes = this.files.get(storagePath);
    return bytes ? bytes.slice() : null;
  }

  exists(storagePath: string): boolean {
    return this.files.has(storagePath);
  }
}
