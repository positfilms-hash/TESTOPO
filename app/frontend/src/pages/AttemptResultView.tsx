import { useMemo, useState } from 'react';
import { useStore } from '../store/StoreContext.js';
import { Button, PageHeader } from '../components/ui.js';

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Facil',
  medium: 'Media',
  hard: 'Dificil',
};

// Resultado de un intento + revision con explicacion y fuente (SPEC 008/013).
// La revision solo es visible despues de enviar el test (lo garantiza el
// backend: getResult/getReview exigen intento `submitted`).
export function AttemptResultView({
  attemptId,
  onBack,
  backLabel = 'Volver',
  reviewOpen = false,
}: {
  attemptId: string;
  onBack: () => void;
  backLabel?: string;
  reviewOpen?: boolean;
}) {
  const { store, currentUser } = useStore();
  const result = store.platform.getResult(currentUser!, attemptId);
  const [showReview, setShowReview] = useState(reviewOpen);
  const review = useMemo(
    () => (showReview ? store.platform.getReview(currentUser!, attemptId) : null),
    [showReview, store, currentUser, attemptId],
  );

  return (
    <div>
      <PageHeader
        title="Resultado"
        action={
          <Button variant="secondary" onClick={onBack}>
            {backLabel}
          </Button>
        }
      />
      <div className="card">
        <div className="stat">
          {result.score} / {result.total_questions}
        </div>
        <p className="muted">{result.percentage.toFixed(0)}% de aciertos</p>
        <div className="row">
          <span>✅ Aciertos: {result.correct_count}</span>
          <span>❌ Fallos: {result.incorrect_count}</span>
          <span>⚪ Sin responder: {result.unanswered_count}</span>
        </div>
      </div>

      {!showReview ? (
        <Button onClick={() => setShowReview(true)}>Revisar respuestas</Button>
      ) : (
        review?.questions.map((q, index) => (
          <div className="card" key={q.question_id}>
            <div className="muted small">Pregunta {index + 1}</div>
            <h4 style={{ marginTop: 4 }}>{q.statement}</h4>
            {q.options.map((o) => {
              const isCorrect = o.id === q.correct_option_id;
              const isSelected = o.id === q.selected_option_id;
              const cls = isCorrect ? 'correct' : isSelected ? 'wrong' : '';
              return (
                <div key={o.id} className={`option ${cls}`}>
                  {isCorrect ? '✓ ' : isSelected ? '✗ ' : ''}
                  {o.text}
                </div>
              );
            })}
            <p className="small">
              {q.selected_option_id === null
                ? '⚪ No respondida'
                : q.is_correct
                  ? '✅ Correcta'
                  : '❌ Incorrecta'}
            </p>
            <p className="muted small">
              <strong>Explicacion:</strong> {q.explanation ?? '—'}
            </p>
            <div className="muted small">
              {q.topic && <span>Tema: {q.topic} · </span>}
              {q.difficulty && (
                <span>
                  Dificultad: {DIFFICULTY_LABELS[q.difficulty] ?? q.difficulty}
                  {q.source_reference ? ' · ' : ''}
                </span>
              )}
              {q.source_reference && <span>Fuente: {q.source_reference}</span>}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
