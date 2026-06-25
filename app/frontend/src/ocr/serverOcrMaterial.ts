// SPEC 034: cliente del frontend para el OCR de PDFs escaneados en SERVIDOR.
// En modo Supabase, el OCR REAL corre en la Edge Function autenticada
// `ocr-material`. El navegador SOLO envia IDs de scope y la opcion de reintento;
// jamas imagenes, texto OCR, prompts, `user_id` ni secretos. La clave del
// proveedor y la clave de servicio viven exclusivamente en el servidor (nunca en
// el bundle), y el render del PDF ocurre en el servidor.
//
// Reutiliza el contrato COMPARTIDO (`supabase/functions/_shared/ocr-material/...`)
// para que la forma del body y los codigos de error sean una unica fuente de
// verdad con la Edge Function.

import { getSupabase, isSupabaseConfigured } from '../auth/supabaseClient.js';
import { requestedPersistenceMode } from '../store/supabaseGateway.js';
import {
  OCR_ERROR,
  validateOcrRequest,
} from '../../../../supabase/functions/_shared/ocr-material/contract';

// ¿El OCR debe ir al servidor (Supabase) en vez de en proceso (InMemory)?
export function shouldUseServerOcr(): boolean {
  return (
    requestedPersistenceMode().toLowerCase() === 'supabase' && isSupabaseConfigured()
  );
}

export interface ServerOcrInput {
  workspace_id: string;
  opposition_id: string;
  material_id: string;
  /** Reintento explicito (o material en estado terminal revisable). */
  force_retry?: boolean;
}

export interface ServerOcrSummary {
  material_id: string;
  extraction_status: string | null;
  run_id: string | null;
  warnings: string[];
}

export class ServerOcrError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ServerOcrError';
  }
}

// Mensajes SEGUROS y humanos por codigo (sin filtrar texto OCR ni internals).
const MESSAGES: Record<string, string> = {
  [OCR_ERROR.AUTH_REQUIRED]: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  [OCR_ERROR.ACCESS_DENIED]: 'No tienes permisos para leer escaneos en esta oposición.',
  [OCR_ERROR.MATERIAL_NOT_FOUND]: 'El material seleccionado no existe en esta oposición.',
  [OCR_ERROR.MATERIAL_NOT_PDF]: 'Solo se puede aplicar OCR a archivos PDF.',
  [OCR_ERROR.MATERIAL_OBSOLETE]: 'El material está archivado (obsoleto); no se puede leer.',
  [OCR_ERROR.SCAN_NOT_DETECTED]: 'Este material no está marcado como escaneo.',
  [OCR_ERROR.RETRY_NOT_ALLOWED]: 'No se puede reintentar el OCR en el estado actual.',
  [OCR_ERROR.ARBITRARY_INPUT_FORBIDDEN]:
    'Petición no válida: no se permite enviar imágenes ni texto OCR desde el navegador.',
  [OCR_ERROR.PROVIDER_NOT_CONFIGURED]:
    'OCR no disponible todavía: proveedor OCR no configurado en servidor.',
  [OCR_ERROR.PROVIDER_FAILED]:
    'El proveedor de OCR no pudo completar la lectura. Inténtalo de nuevo más tarde.',
  [OCR_ERROR.RENDER_FAILED]: 'No se pudo procesar el PDF del escaneo en el servidor.',
  [OCR_ERROR.PAGE_LIMIT_EXCEEDED]:
    'El documento supera el máximo de páginas admitido para OCR.',
  [OCR_ERROR.BUDGET_EXCEEDED]:
    'El OCR de este documento supera el presupuesto admitido. Reduce el documento o ajusta el límite.',
  [OCR_ERROR.NO_TEXT_EXTRACTED]: 'El OCR no extrajo texto utilizable del escaneo.',
  [OCR_ERROR.STORAGE_FAILED]: 'No se pudo leer el archivo original para el OCR.',
  [OCR_ERROR.SAVE_FAILED]: 'No se pudo guardar el resultado del OCR. Inténtalo de nuevo.',
  [OCR_ERROR.INVALID_REQUEST]: 'Petición no válida.',
};

function safeMessage(code: string | undefined): string {
  return (code && MESSAGES[code]) || 'No se pudo completar el OCR. Inténtalo de nuevo.';
}

// Llama a la Edge Function autenticada. Construye el body SOLO con campos
// permitidos y lo valida con el contrato compartido ANTES de enviarlo (defensa en
// profundidad: el navegador nunca debe mandar imagenes/texto OCR/claves).
export async function runOcrViaEdgeFunction(
  input: ServerOcrInput,
): Promise<ServerOcrSummary> {
  const body = {
    workspace_id: input.workspace_id,
    opposition_id: input.opposition_id,
    material_id: input.material_id,
    mode: 'auto' as const,
    force_retry: input.force_retry ?? false,
  };

  const check = validateOcrRequest(body);
  if (!check.ok) {
    throw new ServerOcrError(check.code, safeMessage(check.code));
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke('ocr-material', { body });

  if (error) {
    const code = await readErrorCode(error);
    throw new ServerOcrError(code ?? 'UNKNOWN', safeMessage(code));
  }

  const summary = (data ?? {}) as Partial<ServerOcrSummary>;
  return {
    material_id:
      typeof summary.material_id === 'string' ? summary.material_id : input.material_id,
    extraction_status:
      typeof summary.extraction_status === 'string' ? summary.extraction_status : null,
    run_id: typeof summary.run_id === 'string' ? summary.run_id : null,
    warnings: Array.isArray(summary.warnings) ? summary.warnings.map(String) : [],
  };
}

// Lee el codigo de error del cuerpo de la respuesta de la Edge Function, si lo
// hay (mismo patron que serverQuestionGeneration / authService.mapDeleteError).
async function readErrorCode(error: unknown): Promise<string | undefined> {
  try {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const payload = (await ctx.json()) as { error?: string };
      return payload?.error;
    }
  } catch {
    // cuerpo no JSON: codigo desconocido -> mensaje generico.
  }
  return undefined;
}
