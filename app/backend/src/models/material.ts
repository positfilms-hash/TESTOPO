// Modelo de material/documento de estudio (SPEC 002, seccion 6).
//
// El material es la base trazable de las fuentes de preguntas: una pregunta
// validada debe poder vincularse, via `Source.material_id`, a un material
// activo y revisable.
//
// Los campos de archivo (original_filename, mime_type, size_bytes,
// storage_path) quedan vacios cuando el material se crea manualmente pegando
// texto. El contenido real privado del usuario NO se guarda en el repositorio:
// `storage_path` apunta a una carpeta ignorada por Git.

import type { MaterialStatus, MaterialType } from './enums.js';

export interface Material {
  id: string;
  /** Oposicion a la que pertenece el material (SPEC 010). Obligatorio. */
  opposition_id: string;
  title: string;
  description: string | null;
  type: MaterialType;
  status: MaterialStatus;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string | null;
  content_text: string | null;
  reference: string | null;
  created_at: Date;
  updated_at: Date;
}
