import { useState } from 'react';
import { useStore } from '../store/StoreContext.js';
import { Button, EmptyState, PageHeader } from '../components/ui.js';
import { AttemptResultView } from './AttemptResultView.js';

type View = { kind: 'list' } | { kind: 'detail'; attemptId: string };

// "Mis resultados" del estudiante (SPEC 013, 16): historial de tests enviados
// con su puntuacion y acceso a la revision. Solo los intentos del propio
// usuario (el backend filtra por actor).
export function ResultadosPage() {
  const { store, currentUser, currentOpposition, version } = useStore();
  const [view, setView] = useState<View>({ kind: 'list' });
  void version;

  if (view.kind === 'detail') {
    return (
      <AttemptResultView
        attemptId={view.attemptId}
        onBack={() => setView({ kind: 'list' })}
        backLabel="Volver a resultados"
        reviewOpen
      />
    );
  }

  const results = currentUser
    ? store.platform
        .listMyResults(currentUser)
        .filter((r) => {
          // Limitar a la oposicion actual via el test (si se puede resolver).
          try {
            const test = store.platform.getTest(currentUser, r.test_id).test;
            return test.opposition_id === currentOpposition?.id;
          } catch {
            return false;
          }
        })
    : [];

  return (
    <div>
      <PageHeader
        title="Mis resultados"
        subtitle="Tus tests enviados. Abre uno para revisar las explicaciones."
      />
      {results.length === 0 ? (
        <EmptyState message="Todavia no has enviado ningun test. Crea uno en 'Crear test'." />
      ) : (
        results.map((r) => (
          <div className="card" key={r.attempt_id}>
            <div className="row spread">
              <div>
                <strong>{r.test_title ?? 'Test'}</strong>
                <div className="muted small">
                  {r.score} / {r.total_questions} · {r.percentage.toFixed(0)}%
                  {r.submitted_at
                    ? ` · ${new Date(r.submitted_at).toLocaleDateString()}`
                    : ''}
                </div>
              </div>
              <Button
                small
                onClick={() => setView({ kind: 'detail', attemptId: r.attempt_id })}
              >
                Revisar
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
