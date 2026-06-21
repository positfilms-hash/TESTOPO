import { useEffect, useState } from 'react';
import type { QuestionStyleProfile, AIErrorMemory } from '@backend';
import { useStore } from '../store/StoreContext.js';
import { Button, EmptyState, PageHeader } from '../components/ui.js';

// SPEC 028-F: "IA de la oposición" (solo gestión). Analiza patrones de examen,
// revisa/activa perfiles de estilo, muestra la memoria de errores y el contexto
// que usará la generación adaptativa. No expone exámenes antiguos como banco
// copiable. La generación sigue anclada a la fuente factual del material.

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  pending_review: 'Pendiente de revisión',
  active: 'Activo',
  rejected: 'Rechazado',
  superseded: 'Reemplazado',
};

export function OppositionAIPanel() {
  const { store, currentUser, currentOpposition } = useStore();
  const [profiles, setProfiles] = useState<QuestionStyleProfile[]>([]);
  const [memory, setMemory] = useState<AIErrorMemory[]>([]);
  const [context, setContext] = useState<{
    profile_version: number | null;
    style_rules: string[];
    avoid_instructions: string[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const oppId = currentOpposition?.id;

  const load = async () => {
    if (!currentUser || !oppId) return;
    try {
      const [p, m, c] = await Promise.all([
        store.platform.listStyleProfiles(currentUser, oppId),
        store.platform.listErrorMemory(currentUser, oppId),
        store.platform.getGenerationContextPreview(currentUser, oppId),
      ]);
      setProfiles(p);
      setMemory(m);
      setContext(c);
    } catch {
      setNotice({ type: 'error', text: 'No se ha podido cargar la información de IA.' });
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, currentUser, oppId]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    if (!currentUser || !oppId) return;
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      await load();
      setNotice({ type: 'success', text: ok });
    } catch {
      setNotice({ type: 'error', text: 'La operación no se ha podido completar.' });
    } finally {
      setBusy(false);
    }
  };

  if (!oppId) {
    return <EmptyState message="Selecciona una oposición para gestionar su IA." />;
  }

  return (
    <div>
      <PageHeader
        title="IA de la oposición"
        subtitle="Analiza el estilo de los exámenes oficiales y el feedback humano. El material primario sigue siendo la única fuente de hechos; nada se valida en automático."
        action={
          <Button
            disabled={busy}
            onClick={() =>
              run(
                () => store.platform.analyzeExamPatterns(currentUser!, oppId),
                'Análisis completado.',
              )
            }
          >
            {busy ? 'Procesando…' : 'Analizar exámenes'}
          </Button>
        }
      />
      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

      {/* Perfiles de estilo */}
      <div className="card">
        <strong>Perfiles de estilo</strong>
        {profiles.length === 0 ? (
          <EmptyState message="Aún no hay perfiles. Analiza los exámenes para generar uno (borrador)." />
        ) : (
          profiles.map((p) => (
            <div key={p.id} className="row spread" style={{ marginTop: 8, alignItems: 'flex-start' }}>
              <div>
                <div>
                  <strong>v{p.version}</strong> — {STATUS_LABEL[p.status] ?? p.status}
                  {p.confidence != null && (
                    <span className="muted small"> · confianza {(p.confidence * 100).toFixed(0)}%</span>
                  )}
                </div>
                <div className="muted small">
                  {p.rules.common_question_types.join(', ') || 'sin tipos detectados'}
                  {p.fingerprints.length > 0 && ` · ${p.fingerprints.length} huellas anti-copia`}
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                {/* Ciclo: draft -> pending_review -> active (activación humana
                    obligatoria; no se activa un draft directamente). */}
                {p.status === 'draft' && (
                  <Button variant="secondary" small disabled={busy}
                    onClick={() => run(() => store.platform.submitStyleProfileForReview(currentUser!, p.id), 'Enviado a revisión.')}>
                    Enviar a revisión
                  </Button>
                )}
                {p.status === 'pending_review' && (
                  <Button small disabled={busy}
                    onClick={() => run(() => store.platform.activateStyleProfile(currentUser!, p.id), 'Perfil activado.')}>
                    Activar
                  </Button>
                )}
                {(p.status === 'draft' || p.status === 'pending_review') && (
                  <Button variant="secondary" small disabled={busy}
                    onClick={() => run(() => store.platform.rejectStyleProfile(currentUser!, p.id), 'Perfil rechazado.')}>
                    Rechazar
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Contexto que usará la generación adaptativa */}
      <div className="card">
        <strong>Contexto de generación (perfil activo)</strong>
        {context && context.profile_version != null ? (
          <>
            <div className="muted small">Perfil activo: v{context.profile_version}</div>
            <ul className="small">
              {context.style_rules.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            {context.avoid_instructions.length > 0 && (
              <>
                <div className="muted small">Errores a evitar (del feedback):</div>
                <ul className="small">
                  {context.avoid_instructions.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </>
            )}
          </>
        ) : (
          <EmptyState message="No hay perfil activo. Activa uno para que la generación lo use." />
        )}
      </div>

      {/* Memoria de errores IA */}
      <div className="card">
        <div className="row spread">
          <strong>Memoria de errores</strong>
          <Button variant="secondary" small disabled={busy}
            onClick={() => run(() => store.platform.refreshErrorMemory(currentUser!, oppId), 'Memoria actualizada.')}>
            Refrescar desde feedback
          </Button>
        </div>
        {memory.length === 0 ? (
          <EmptyState message="Sin memoria de errores todavía (se deriva del feedback de revisión)." />
        ) : (
          <ul className="small" style={{ marginTop: 8 }}>
            {memory.map((m) => (
              <li key={m.id}>
                <strong>{m.type}</strong> ({m.severity}, ×{m.occurrences}) — {m.avoid_instruction}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
