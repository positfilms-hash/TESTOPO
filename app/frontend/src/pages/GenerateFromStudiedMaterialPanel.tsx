import { useState } from 'react';
import type { Material } from '@backend';
import { useStore } from '../store/StoreContext.js';
import { Button, Field, PageHeader } from '../components/ui.js';
import type { Section } from '../components/AppLayout.js';
import {
  shouldUseServerDirectGeneration,
  generateFromStudiedMaterialViaEdgeFunction,
  ServerDirectGenerationError,
  type ServerDirectGenerationSummary,
} from '../generation/serverDirectQuestionGeneration.js';
import type { RequestDifficulty, DirectScope } from '../../../../supabase/functions/_shared/direct-question-generation/contract';

// SPEC 039: flujo PRINCIPAL de generacion de preguntas DIRECTA desde material
// estudiado (SPEC 038). Sin indice visible, sin aplicar temario, sin seleccion de
// tema obligatoria. Solo gestion; el alumno no ve esta pantalla.
//
// La generacion REAL corre en la Edge Function autenticada
// `generate-questions-from-studied-material`; el navegador solo manda IDs de
// alcance + cantidad + dificultad. En InMemory/demo NO se aparenta generacion real:
// es un fallback de desarrollo explicito que avisa de que el flujo vive en servidor.

const STUDIED_STATUSES = new Set(['studied', 'studied_with_warnings']);

type PanelState = 'no_studied' | 'ready' | 'generating' | 'done';

export function GenerateFromStudiedMaterialPanel({
  materials,
  onNavigate,
}: {
  materials: Material[];
  onNavigate?: (section: Section) => void;
}) {
  const { currentUser, currentOpposition, refresh } = useStore();
  const [scope, setScope] = useState<DirectScope>('all_studied_material');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [difficulty, setDifficulty] = useState<RequestDifficulty>('mixed');
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ServerDirectGenerationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const studied = materials.filter((m) => STUDIED_STATUSES.has(m.study_status ?? ''));

  let state: PanelState;
  if (busy) state = 'generating';
  else if (summary) state = 'done';
  else if (studied.length === 0) state = 'no_studied';
  else state = 'ready';

  const generate = async () => {
    if (!currentUser || !currentOpposition) return;
    setError(null);
    setBusy(true);
    try {
      if (shouldUseServerDirectGeneration()) {
        const useSelection = scope === 'selected_materials' && selectedMaterialId;
        const result = await generateFromStudiedMaterialViaEdgeFunction({
          workspace_id: currentOpposition.workspace_id,
          opposition_id: currentOpposition.id,
          scope: useSelection ? 'selected_materials' : 'all_studied_material',
          material_ids: useSelection ? [selectedMaterialId] : [],
          question_count: count,
          difficulty,
        });
        setSummary(result);
      } else {
        // Fallback InMemory/demo: NO se genera nada falso. El flujo directo es
        // server-only; se avisa con honestidad (SPEC 039 "Fallback local").
        setError(
          'La generación desde material estudiado se ejecuta en el servidor. No está disponible en la demo local: despliega la Edge Function para generar candidatas reales.',
        );
        setSummary(null);
        return;
      }
      refresh();
    } catch (err) {
      setError(
        err instanceof ServerDirectGenerationError
          ? err.message
          : 'No se pudieron generar preguntas desde el material estudiado. Inténtalo de nuevo.',
      );
      setSummary(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <PageHeader
        eyebrow="Preguntas"
        title="Generar preguntas"
        subtitle="Crea preguntas tipo test directamente desde tu material estudiado. Cada candidata queda anclada a su fuente y pendiente de tu revisión (nunca se valida ni se publica sola)."
      />
      {error && <div className="notice error">{error}</div>}

      {state === 'no_studied' && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p>
            <strong>Primero estudia el material.</strong>
          </p>
          <p className="muted small">
            La generación de preguntas parte del material ya estudiado. Ve a Temario /
            Análisis, pulsa “Estudiar material” y vuelve aquí.
          </p>
          {onNavigate && (
            <Button onClick={() => onNavigate('temario')}>Ir a estudiar material</Button>
          )}
        </div>
      )}

      {(state === 'ready' || state === 'generating') && (
        <div style={{ maxWidth: 560 }}>
          <p className="muted small">
            {studied.length} documento(s) estudiado(s) disponibles como fuente.
          </p>
          <Field label="Alcance">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as DirectScope)}
              disabled={busy}
            >
              <option value="all_studied_material">Todo el material estudiado</option>
              <option value="selected_materials">Un documento estudiado</option>
            </select>
          </Field>
          {scope === 'selected_materials' && (
            <Field label="Documento">
              <select
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
                disabled={busy}
              >
                <option value="">(Elige un documento)</option>
                {studied.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Dificultad">
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as RequestDifficulty)}
              disabled={busy}
            >
              <option value="easy">Facil</option>
              <option value="medium">Media</option>
              <option value="hard">Dificil</option>
              <option value="mixed">Mixta</option>
            </select>
          </Field>
          <Field label="Numero de preguntas">
            <input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              disabled={busy}
            />
          </Field>
          <Button
            onClick={generate}
            disabled={busy || (scope === 'selected_materials' && !selectedMaterialId)}
          >
            {busy ? 'Generando…' : 'Generar preguntas'}
          </Button>
          {busy && (
            <p className="muted small" style={{ marginTop: 8 }}>
              La IA está preparando candidatas desde tu material estudiado · Anclando
              cada pregunta a su fuente · Guardando para revisión
            </p>
          )}
        </div>
      )}

      {state === 'done' && summary && (
        <div>
          <p>
            <strong>
              {summary.created} pregunta(s) creada(s)
            </strong>{' '}
            pendiente(s) de revisión
            {summary.warnings.length > 0 ? ` · ${summary.warnings.length} aviso(s)` : ''}.
          </p>
          {summary.created === 0 && (
            <p className="muted small">
              No se obtuvieron candidatas válidas con fuente. No se ha creado ninguna pregunta.
            </p>
          )}
          {summary.warnings.length > 0 && (
            <p className="muted small">{summary.warnings[0]}</p>
          )}
          <div className="row">
            {onNavigate && summary.created > 0 && (
              <Button onClick={() => onNavigate('preguntas')}>Ir a revisar</Button>
            )}
            <Button variant="secondary" onClick={() => setSummary(null)}>
              Generar más
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
