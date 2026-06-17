import { useEffect, useState } from 'react';
import {
  TestGenerationError,
  type RequestedDifficulty,
  type TestMode,
  type Topic,
  type TakingView,
} from '@backend';
import { useStore } from '../store/StoreContext.js';
import { Badge, Button, EmptyState, Field, PageHeader } from '../components/ui.js';
import { AttemptResultView } from './AttemptResultView.js';

type View =
  | { kind: 'list' }
  | { kind: 'take'; attemptId: string }
  | { kind: 'result'; attemptId: string };

const MODE_LABELS: Record<TestMode, string> = {
  random: 'Aleatorio',
  by_topic: 'Por tema',
  by_difficulty: 'Por dificultad',
  mixed: 'Mixto',
};

export function TestsPage() {
  const [view, setView] = useState<View>({ kind: 'list' });

  if (view.kind === 'take') {
    return (
      <TakeTest
        attemptId={view.attemptId}
        onSubmitted={() => setView({ kind: 'result', attemptId: view.attemptId })}
      />
    );
  }
  if (view.kind === 'result') {
    return (
      <AttemptResultView
        attemptId={view.attemptId}
        onBack={() => setView({ kind: 'list' })}
        backLabel="Volver a tests"
      />
    );
  }
  return <TestsList onStart={(attemptId) => setView({ kind: 'take', attemptId })} />;
}

function TestsList({ onStart }: { onStart: (attemptId: string) => void }) {
  const { store, refresh, currentOpposition, currentUser } = useStore();
  const [count, setCount] = useState(5);
  const [topicId, setTopicId] = useState('');
  const [difficulty, setDifficulty] = useState<RequestedDifficulty | 'any'>('any');
  const [mode, setMode] = useState<TestMode>('random');
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const [topics, setTopics] = useState<Topic[]>([]);
  useEffect(() => {
    let cancelled = false;
    void store.topics.listTopics().then((all) => {
      if (!cancelled) {
        setTopics(
          all.filter(
            (t) => t.opposition_id === currentOpposition?.id && t.status !== 'obsolete',
          ),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [store, currentOpposition]);
  const createdTests = store.createdTests.filter(
    (t) => t.opposition_id === currentOpposition?.id,
  );

  const createTest = async () => {
    setNotice(null);
    try {
      if (!currentUser) return;
      const { test } = await store.platform.createTest(currentUser, {
        mode,
        opposition_id: currentOpposition?.id,
        question_count: count,
        topic_id: topicId || null,
        difficulty: difficulty === 'any' ? null : difficulty,
      });
      store.createdTests.unshift(test);
      refresh();
      setNotice({ type: 'success', text: `Test creado con ${test.question_count} preguntas.` });
    } catch (error) {
      const text =
        error instanceof TestGenerationError
          ? 'No hay suficientes preguntas validadas (o el tema/dificultad no es valido).'
          : 'No se pudo crear el test.';
      setNotice({ type: 'error', text });
    }
  };

  const start = async (testId: string) => {
    if (!currentUser) return;
    const attempt = await store.platform.startAttempt(currentUser, testId);
    refresh();
    onStart(attempt.id);
  };

  return (
    <div>
      <PageHeader title="Tests" subtitle="Crea y realiza tests con preguntas validadas." />
      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

      <div className="card" style={{ maxWidth: 560 }}>
        <strong>Crear test</strong>
        <Field label="Numero de preguntas">
          <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </Field>
        <Field label="Modo">
          <select value={mode} onChange={(e) => setMode(e.target.value as TestMode)}>
            <option value="random">Aleatorio</option>
            <option value="by_topic">Por tema</option>
            <option value="by_difficulty">Por dificultad</option>
            <option value="mixed">Mixto</option>
          </select>
        </Field>
        <Field label="Tema (opcional)">
          <select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">(Cualquier tema)</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Dificultad">
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as RequestedDifficulty | 'any')}>
            <option value="any">Cualquiera</option>
            <option value="easy">Facil</option>
            <option value="medium">Media</option>
            <option value="hard">Dificil</option>
            <option value="mixed">Mixta</option>
          </select>
        </Field>
        <Button onClick={createTest}>Crear test</Button>
      </div>

      <h3>Tus tests</h3>
      {createdTests.length === 0 ? (
        <EmptyState message="Todavia no has creado ningun test." />
      ) : (
        createdTests.map((t) => (
          <div className="card" key={t.id}>
            <div className="row spread">
              <div>
                <strong>{t.title}</strong>
                <div className="muted small">
                  {MODE_LABELS[t.mode]} · {t.question_count} preguntas
                </div>
              </div>
              <div className="row">
                <Badge status={t.status} />
                <Button small onClick={() => start(t.id)}>
                  Empezar
                </Button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function TakeTest({
  attemptId,
  onSubmitted,
}: {
  attemptId: string;
  onSubmitted: () => void;
}) {
  const { store, refresh, currentUser } = useStore();
  const [view, setView] = useState<TakingView | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    if (currentUser) {
      void store.platform.getTestForTaking(currentUser, attemptId).then((v) => {
        if (!cancelled) setView(v);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [store, currentUser, attemptId]);

  const select = (testQuestionId: string, optionId: string) => {
    if (!currentUser) return;
    setAnswers((prev) => ({ ...prev, [testQuestionId]: optionId }));
    void store.platform.saveAnswer(currentUser, {
      attempt_id: attemptId,
      test_question_id: testQuestionId,
      selected_option_id: optionId,
    });
  };

  const submit = async () => {
    if (!currentUser) return;
    if (!window.confirm('¿Enviar el test? No podras cambiar las respuestas.')) return;
    await store.platform.submitAttempt(currentUser, attemptId);
    refresh();
    onSubmitted();
  };

  if (!view) {
    return <div className="loading-state">Cargando…</div>;
  }

  const answered = Object.keys(answers).length;

  return (
    <div>
      <PageHeader
        title="Realizar test"
        subtitle={`Respondidas ${answered} de ${view.questions.length}`}
      />
      {view.questions.map((q, index) => (
        <div className="card" key={q.test_question_id}>
          <div className="muted small">
            Pregunta {index + 1} de {view.questions.length}
          </div>
          <h4 style={{ marginTop: 4 }}>{q.statement}</h4>
          {q.options.map((o) => (
            <label
              key={o.id}
              className={`option ${answers[q.test_question_id] === o.id ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name={q.test_question_id}
                checked={answers[q.test_question_id] === o.id}
                onChange={() => select(q.test_question_id, o.id)}
              />
              {o.text}
            </label>
          ))}
        </div>
      ))}
      <Button onClick={submit}>Enviar test</Button>
    </div>
  );
}

