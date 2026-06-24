import { useState } from 'react';
import type { Material } from '@backend';
import { isUsableExtraction, extractionHasOcrWarnings } from '@backend';
import { useStore } from '../store/StoreContext.js';
import { Button, EmptyState, PageHeader } from '../components/ui.js';
import type { Section } from '../components/AppLayout.js';
import {
  shouldUseServerStudy,
  studyMaterialViaEdgeFunction,
  studyIneligibleReasonMessage,
  ServerStudyError,
  type ServerStudySummary,
} from '../study/serverStudyMaterial.js';

// Resume los motivos de inelegibilidad en mensajes humanos UNICOS (deduplicados).
function reasonMessages(ineligible: { reason: string }[]): string[] {
  return [...new Set(ineligible.map((d) => studyIneligibleReasonMessage(d.reason)))];
}

// SPEC 038: la accion PRIMARIA del analisis de material es "Estudiar material".
// No hay indice visible, ni aplicar indice, ni seleccion de tema. Solo gestion.
// En modo Supabase el estudio REAL corre en la Edge Function `study-material`; en
// memoria/demo se hace un resumen LOCAL deterministico (nunca presentado como real
// en Supabase). El alumno no ve esta pantalla.

const PROCESSING_STATUSES = new Set([
  'not_started',
  'processing',
  'ocr_processing',
  'scanned_detected',
]);

type StudyState = 'no_material' | 'reading' | 'ready' | 'studying' | 'studied' | 'failed';

export function StudyMaterialPanel({
  materials,
  onNavigate,
}: {
  materials: Material[];
  onNavigate?: (section: Section) => void;
}) {
  const { currentUser, currentOpposition, refresh } = useStore();
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ServerStudySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Motivos EXACTOS por los que un documento legible no se pudo estudiar (servidor).
  const [blocked, setBlocked] = useState<string[]>([]);

  const eligible = materials.filter(
    (m) => isUsableExtraction(m.extraction_status) && m.status !== 'obsolete',
  );
  const reading = materials.filter((m) => PROCESSING_STATUSES.has(m.extraction_status ?? ''));
  const ocrWarnings = eligible.some((m) => extractionHasOcrWarnings(m.extraction_status));

  // Estado derivado (sin porcentajes falsos).
  let state: StudyState;
  if (busy) state = 'studying';
  else if (summary) state = summary.units > 0 || summary.studied > 0 ? 'studied' : 'failed';
  else if (materials.length === 0) state = 'no_material';
  else if (eligible.length === 0 && reading.length > 0) state = 'reading';
  else if (eligible.length === 0) state = 'no_material';
  else state = 'ready';

  const study = async () => {
    if (!currentUser || !currentOpposition) return;
    setError(null);
    setBlocked([]);
    setBusy(true);
    try {
      if (shouldUseServerStudy()) {
        const result = await studyMaterialViaEdgeFunction({
          workspace_id: currentOpposition.workspace_id,
          opposition_id: currentOpposition.id,
        });
        setSummary(result);
        setBlocked(reasonMessages(result.ineligible));
      } else {
        // Demo/memoria: resumen LOCAL deterministico (no es un proveedor real).
        setSummary({
          run_id: null,
          materials: eligible.length,
          studied: eligible.length,
          units: eligible.length,
          warnings: ocrWarnings
            ? ['Algún documento se leyó por OCR con avisos; revísalo.']
            : [],
          ineligible: [],
        });
      }
      refresh();
    } catch (err) {
      // Si el servidor rechazo por inelegibilidad, mostramos el MOTIVO exacto por
      // documento (p. ej. "examen antiguo", "necesita revisión") en vez de un error
      // generico: el flujo no depende de una clasificacion/indice previo del usuario.
      if (err instanceof ServerStudyError) {
        setError(err.message);
        setBlocked(reasonMessages(err.ineligible));
      } else {
        setError('No se pudo estudiar el material. Inténtalo de nuevo.');
      }
      setSummary(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Material"
        title="Estudiar material"
        subtitle="La app analiza tu material legible y prepara, por dentro, bloques de estudio con sus fuentes. No genera preguntas todavía."
      />
      {error && <div className="notice error">{error}</div>}

      {blocked.length > 0 && (
        <div className="notice" style={{ marginBottom: 12 }}>
          <strong>Algún documento legible no se pudo estudiar:</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {blocked.map((m) => (
              <li key={m} className="small">
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {state === 'no_material' && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p>
            {materials.length === 0
              ? 'Todavía no has subido material. Empieza en la sección Material.'
              : 'No hay material de estudio legible todavía. Sube documentos de estudio y espera a que se lean.'}
          </p>
          {onNavigate && <Button onClick={() => onNavigate('material')}>Ir a Material</Button>}
        </div>
      )}

      {state === 'reading' && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p>
            <strong>Tu material todavía se está leyendo.</strong>
          </p>
          <p className="muted small">
            Espera a que termine la lectura (o el OCR de los escaneos) antes de estudiarlo.
          </p>
        </div>
      )}

      {state === 'ready' && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="muted">
            {eligible.length} documento(s) listo(s) para estudiar
            {reading.length > 0 ? ` · ${reading.length} aún leyéndose` : ''}.
          </p>
          <Button onClick={study}>Estudiar material</Button>
        </div>
      )}

      {state === 'studying' && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p>
            <strong>La IA está estudiando tus documentos…</strong>
          </p>
          <p className="muted small">
            Revisando documentos elegibles · Leyendo el texto · Preparando bloques con fuente ·
            Guardando el estudio
          </p>
        </div>
      )}

      {state === 'studied' && summary && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p>
            <strong>Material estudiado</strong>
          </p>
          <p className="muted">
            {summary.studied}/{summary.materials} documento(s) preparado(s) ·{' '}
            {summary.units} bloque(s) de estudio
            {summary.warnings.length > 0 ? ` · ${summary.warnings.length} aviso(s)` : ''}.
          </p>
          {summary.warnings.length > 0 && (
            <p className="muted small">{summary.warnings[0]}</p>
          )}
          <Button variant="secondary" onClick={study}>
            Volver a estudiar
          </Button>
        </div>
      )}

      {state === 'failed' && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p>No se pudo preparar material de estudio. Revisa que el material sea legible.</p>
          <Button onClick={study}>Reintentar</Button>
        </div>
      )}

      {eligible.length === 0 && materials.length > 0 && state !== 'reading' && (
        <EmptyState message="Recuerda: solo el material de estudio legible (no exámenes antiguos ni escaneos sin leer) se puede estudiar." />
      )}
    </div>
  );
}
