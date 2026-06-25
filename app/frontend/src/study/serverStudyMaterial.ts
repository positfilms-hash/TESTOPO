// SPEC 038: cliente del frontend para el ESTUDIO de material en SERVIDOR. En modo
// Supabase, el estudio real corre en la Edge Function autenticada `study-material`.
// El navegador SOLO envia scope (workspace/oposicion) + opciones; jamas texto, OCR,
// prompts, imagenes, `user_id` ni claves. La clave del proveedor vive solo en el
// servidor. NO crea preguntas ni nada `validated`.
//
// Reutiliza el contrato COMPARTIDO para que la forma del body y los codigos de
// error sean una unica fuente de verdad con la Edge Function.

import { getSupabase, isSupabaseConfigured } from '../auth/supabaseClient.js';
import { requestedPersistenceMode } from '../store/supabaseGateway.js';
import {
  STUDY_ERROR,
  STUDY_INELIGIBLE_REASON,
  validateStudyRequest,
} from '../../../../supabase/functions/_shared/material-study/contract';

export function shouldUseServerStudy(): boolean {
  return (
    requestedPersistenceMode().toLowerCase() === 'supabase' && isSupabaseConfigured()
  );
}

export interface ServerStudyInput {
  workspace_id: string;
  opposition_id: string;
  force_retry?: boolean;
}

// Motivo exacto por el que un material legible NO se estudió (lo decide el
// servidor tras autoclasificar). Permite a la UI explicar el bloqueo real.
export interface StudyIneligibleDetail {
  material_id: string;
  reason: string;
}

export interface ServerStudySummary {
  run_id: string | null;
  materials: number;
  studied: number;
  units: number;
  warnings: string[];
  ineligible: StudyIneligibleDetail[];
}

export class ServerStudyError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly ineligible: StudyIneligibleDetail[] = [],
  ) {
    super(message);
    this.name = 'ServerStudyError';
  }
}

// Mensaje humano EXACTO por motivo de inelegibilidad (codigos del contrato).
export function studyIneligibleReasonMessage(reason: string): string {
  switch (reason) {
    case STUDY_INELIGIBLE_REASON.OBSOLETE:
      return 'El documento está marcado como obsoleto.';
    case STUDY_INELIGIBLE_REASON.NOT_READABLE:
      return 'El documento aún no se ha leído por completo (extracción u OCR pendiente).';
    case STUDY_INELIGIBLE_REASON.UNCLASSIFIED:
      return 'No se ha podido determinar el tipo de documento.';
    case STUDY_INELIGIBLE_REASON.NEEDS_REVIEW:
      return 'El tipo de documento es dudoso y necesita revisión manual antes de estudiarlo.';
    case STUDY_INELIGIBLE_REASON.NOT_PRIMARY:
      return 'El documento no es material de estudio (p. ej. examen antiguo, índice o contenido no apto como fuente factual).';
    case STUDY_INELIGIBLE_REASON.COMPLETED_WITHOUT_TEXT:
      return 'El documento se marcó como leído pero no contiene texto extraíble. Vuelve a subirlo o reprocesa la extracción.';
    default:
      return 'El documento no es apto para estudiar.';
  }
}

const MESSAGES: Record<string, string> = {
  [STUDY_ERROR.AUTH_REQUIRED]: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  [STUDY_ERROR.ACCESS_DENIED]: 'No tienes permisos para estudiar material en esta oposición.',
  [STUDY_ERROR.NO_ELIGIBLE_MATERIAL]:
    'No hay material legible y clasificado para estudiar. Sube material de estudio y espera a que se lea.',
  [STUDY_ERROR.ARBITRARY_INPUT_FORBIDDEN]:
    'Petición no válida: no se permite enviar texto ni contenido desde el navegador.',
  [STUDY_ERROR.PROVIDER_NOT_CONFIGURED]:
    'El estudio de material todavía no está configurado en servidor.',
  [STUDY_ERROR.PROVIDER_FAILED]:
    'El proveedor no pudo completar el estudio. Inténtalo de nuevo más tarde.',
  [STUDY_ERROR.NO_VALID_UNITS]:
    'No se pudo preparar material de estudio con fuente. Revisa que el material sea legible.',
  [STUDY_ERROR.SAVE_FAILED]: 'No se pudo guardar el estudio. Inténtalo de nuevo.',
  [STUDY_ERROR.PREP_FAILED]:
    'No se pudo preparar la fuente del material (lectura/escritura). Inténtalo de nuevo; si persiste, reprocesa el material.',
  [STUDY_ERROR.INVALID_REQUEST]: 'Petición no válida.',
};

function safeMessage(code: string | undefined): string {
  return (code && MESSAGES[code]) || 'No se pudo estudiar el material. Inténtalo de nuevo.';
}

export async function studyMaterialViaEdgeFunction(
  input: ServerStudyInput,
): Promise<ServerStudySummary> {
  const body = {
    workspace_id: input.workspace_id,
    opposition_id: input.opposition_id,
    mode: 'all_eligible' as const,
    force_retry: input.force_retry ?? false,
  };
  const check = validateStudyRequest(body);
  if (!check.ok) {
    throw new ServerStudyError(check.code, safeMessage(check.code));
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke('study-material', { body });
  if (error) {
    const parsed = await readErrorBody(error);
    throw new ServerStudyError(parsed.code ?? 'UNKNOWN', safeMessage(parsed.code), parsed.ineligible);
  }
  const summary = (data ?? {}) as Partial<ServerStudySummary>;
  return {
    run_id: typeof summary.run_id === 'string' ? summary.run_id : null,
    materials: typeof summary.materials === 'number' ? summary.materials : 0,
    studied: typeof summary.studied === 'number' ? summary.studied : 0,
    units: typeof summary.units === 'number' ? summary.units : 0,
    warnings: Array.isArray(summary.warnings) ? summary.warnings.map(String) : [],
    ineligible: normalizeIneligible(summary.ineligible),
  };
}

function normalizeIneligible(value: unknown): StudyIneligibleDetail[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is StudyIneligibleDetail => !!v && typeof v === 'object')
    .map((v) => ({
      material_id: String((v as StudyIneligibleDetail).material_id ?? ''),
      reason: String((v as StudyIneligibleDetail).reason ?? ''),
    }));
}

async function readErrorBody(
  error: unknown,
): Promise<{ code?: string; ineligible: StudyIneligibleDetail[] }> {
  try {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const payload = (await ctx.json()) as { error?: string; ineligible?: unknown };
      return { code: payload?.error, ineligible: normalizeIneligible(payload?.ineligible) };
    }
  } catch {
    // cuerpo no JSON
  }
  return { ineligible: [] };
}
