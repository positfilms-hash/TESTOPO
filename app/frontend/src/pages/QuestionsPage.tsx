import { useMemo, useState } from 'react';
import {
  QuestionReviewError,
  QuestionGenerationError,
  type Difficulty,
  type RequestedDifficulty,
} from '@backend';
import { useStore } from '../store/StoreContext.js';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  PageHeader,
  difficultyLabel,
} from '../components/ui.js';

type View =
  | { kind: 'list' }
  | { kind: 'review'; id: string }
  | { kind: 'generate' };

const PENDING = ['draft', 'pending_review', 'needs_fix'];

export function QuestionsPage() {
  const [view, setView] = useState<View>({ kind: 'list' });

  if (view.kind === 'review') {
    return <QuestionReview id={view.id} onBack={() => setView({ kind: 'list' })} />;
  }
  if (view.kind === 'generate') {
    return <GenerateForm onBack={() => setView({ kind: 'list' })} />;
  }
  return (
    <QuestionsList
      onReview={(id) => setView({ kind: 'review', id })}
      onGenerate={() => setView({ kind: 'generate' })}
    />
  );
}

function QuestionsList({
  onReview,
  onGenerate,
}: {
  onReview: (id: string) => void;
  onGenerate: () => void;
}) {
  const { store, currentOpposition } = useStore();
  const [tab, setTab] = useState<'pending' | 'all'>('pending');

  const all = store.questions
    .listQuestions()
    .filter((q) => q.opposition_id === currentOpposition?.id);
  const questions = tab === 'pending' ? all.filter((q) => PENDING.includes(q.status)) : all;

  return (
    <div>
      <PageHeader
        title="Preguntas"
        subtitle="Revisa y aprueba las preguntas del banco."
        action={<Button onClick={onGenerate}>Generar borradores</Button>}
      />
      <div className="tabs">
        <button className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
          Pendientes de revision
        </button>
        <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
          Todas
        </button>
      </div>

      {questions.length === 0 ? (
        <EmptyState
          message={
            tab === 'pending'
              ? 'No hay preguntas pendientes de revision.'
              : 'Todavia no hay preguntas. Genera borradores desde tu material.'
          }
        />
      ) : (
        questions.map((q) => (
          <div className="card" key={q.id}>
            <div className="row spread">
              <div style={{ maxWidth: '70%' }}>
                <div>{q.statement}</div>
                <div className="muted small">
                  {q.topic ?? 'sin tema'} ·{' '}
                  {q.difficulty ? difficultyLabel(q.difficulty) : 'sin dificultad'} ·{' '}
                  {q.source?.title ?? 'sin fuente'}
                </div>
              </div>
              <div className="row">
                <Badge status={q.status} />
                <Button variant="secondary" small onClick={() => onReview(q.id)}>
                  Revisar
                </Button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function QuestionReview({ id, onBack }: { id: string; onBack: () => void }) {
  const { store, version, refresh, currentUser } = useStore();
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [editing, setEditing] = useState(false);

  const question = store.questions.getQuestion(id);
  // La validacion (SPEC 005) decide si se puede aprobar.
  const report = useMemo(
    () => (question ? store.validation.validateQuestion(id) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, version],
  );

  if (!question || !report) {
    return <EmptyState message="Pregunta no encontrada." />;
  }

  const hasErrors = report.errors.length > 0;

  const approve = () => {
    if (!currentUser) return;
    try {
      store.platform.approve(currentUser, id, { reviewer_name: currentUser.name });
      refresh();
      setNotice({ type: 'success', text: 'Pregunta aprobada y validada.' });
    } catch (error) {
      if (error instanceof QuestionReviewError) {
        setNotice({
          type: 'error',
          text: 'No se puede aprobar: hay errores criticos que corregir.',
        });
      } else {
        setNotice({ type: 'error', text: 'No se pudo aprobar la pregunta.' });
      }
      refresh();
    }
  };

  const act = (
    fn: () => void,
    confirmMsg: string | null,
    successMsg: string,
  ) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    fn();
    refresh();
    setNotice({ type: 'success', text: successMsg });
  };

  return (
    <div>
      <PageHeader
        title="Revision de pregunta"
        action={
          <Button variant="secondary" onClick={onBack}>
            Volver
          </Button>
        }
      />
      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

      <div className="card">
        <div className="row spread" style={{ marginBottom: 8 }}>
          <Badge status={question.status} />
          <span className="muted small">
            {question.topic ?? 'sin tema'} ·{' '}
            {question.difficulty ? difficultyLabel(question.difficulty) : 'sin dificultad'}
          </span>
        </div>
        <h3 style={{ marginTop: 0 }}>{question.statement}</h3>
        {question.options.map((o) => (
          <div key={o.id} className={`option ${o.is_correct ? 'correct' : ''}`}>
            {o.is_correct ? '✓ ' : ''}
            {o.text}
          </div>
        ))}
        <p>
          <strong>Explicacion:</strong> {question.explanation ?? '—'}
        </p>
        <p className="muted small">
          Fuente: {question.source?.title ?? 'sin fuente'}
          {question.source?.reference ? ` · ${question.source.reference}` : ''}
        </p>
      </div>

      <div className="card">
        <strong>Informe de validacion</strong>
        {report.errors.length === 0 && report.warnings.length === 0 && (
          <p className="muted small">Sin problemas detectados.</p>
        )}
        {report.errors.map((f) => (
          <div key={f.code} className="notice error" style={{ marginTop: 8 }}>
            {f.message}
          </div>
        ))}
        {report.warnings.map((f) => (
          <div key={f.code} className="notice" style={{ marginTop: 8 }}>
            ⚠ {f.message}
          </div>
        ))}
      </div>

      <div className="row">
        <Button onClick={approve} disabled={hasErrors} title={hasErrors ? 'Hay errores criticos' : undefined}>
          Aprobar
        </Button>
        <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
          Editar
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            act(
              () =>
                currentUser &&
                store.platform.markNeedsFix(currentUser, id, { notes: 'Revisar' }),
              null,
              'Marcada como "necesita correccion".',
            )
          }
        >
          Marcar para corregir
        </Button>
        <Button
          variant="danger"
          onClick={() =>
            act(
              () =>
                currentUser &&
                store.platform.reject(currentUser, id, {
                  notes: 'Rechazada en revision',
                }),
              '¿Rechazar esta pregunta?',
              'Pregunta rechazada.',
            )
          }
        >
          Rechazar
        </Button>
      </div>
      {hasErrors && (
        <p className="muted small">
          No se puede aprobar mientras haya errores criticos. Edita o marca para corregir.
        </p>
      )}

      {editing && <EditForm id={id} onDone={() => { setEditing(false); refresh(); }} />}
    </div>
  );
}

function EditForm({ id, onDone }: { id: string; onDone: () => void }) {
  const { store, currentUser } = useStore();
  const question = store.questions.getQuestion(id)!;
  const [statement, setStatement] = useState(question.statement);
  const [explanation, setExplanation] = useState(question.explanation ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>(question.difficulty ?? 'medium');

  const save = () => {
    if (!currentUser) return;
    store.platform.editFromReview(currentUser, id, {
      statement,
      explanation,
      difficulty,
    });
    onDone();
  };

  return (
    <div className="card" style={{ maxWidth: 600 }}>
      <strong>Editar pregunta</strong>
      <Field label="Enunciado">
        <textarea value={statement} onChange={(e) => setStatement(e.target.value)} />
      </Field>
      <Field label="Explicacion">
        <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      </Field>
      <Field label="Dificultad">
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
          <option value="easy">Facil</option>
          <option value="medium">Media</option>
          <option value="hard">Dificil</option>
        </select>
      </Field>
      <Button onClick={save}>Guardar cambios</Button>
    </div>
  );
}

function GenerateForm({ onBack }: { onBack: () => void }) {
  const { store, refresh, currentUser, currentOpposition } = useStore();
  const materials = store.materials
    .listMaterials()
    .filter((m) => m.opposition_id === currentOpposition?.id && m.status !== 'obsolete');
  const topics = store.topics
    .listTopics()
    .filter((t) => t.opposition_id === currentOpposition?.id && t.status !== 'obsolete');
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? '');
  const [topicId, setTopicId] = useState('');
  const [difficulty, setDifficulty] = useState<RequestedDifficulty>('mixed');
  const [count, setCount] = useState(5);
  const [fragment, setFragment] = useState('');
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const generate = () => {
    setNotice(null);
    if (!currentUser) return;
    try {
      const base = {
        material_id: materialId,
        topic_id: topicId || null,
        difficulty,
        question_count: count,
      };
      const result = fragment.trim()
        ? store.platform.generateFromExcerpt(currentUser, { ...base, excerpt: fragment.trim() })
        : store.platform.generateFromMaterial(currentUser, base);
      refresh();
      setNotice({
        type: 'success',
        text: `Se han generado ${result.questions.length} preguntas pendientes de revision.`,
      });
    } catch (error) {
      const text =
        error instanceof QuestionGenerationError
          ? 'No se pudo generar: revisa el material (con texto y no obsoleto) y los parametros.'
          : 'No se pudo generar.';
      setNotice({ type: 'error', text });
    }
  };

  return (
    <div>
      <PageHeader
        title="Generar borradores"
        subtitle="Crea preguntas desde tu material. Quedaran pendientes de revision."
        action={
          <Button variant="secondary" onClick={onBack}>
            Volver
          </Button>
        }
      />
      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
      {materials.length === 0 ? (
        <EmptyState message="Necesitas material activo para generar preguntas. Anade material primero." />
      ) : (
        <div className="card" style={{ maxWidth: 560 }}>
          <Field label="Material">
            <select value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tema (opcional)">
            <select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              <option value="">(Sin tema)</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dificultad">
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as RequestedDifficulty)}>
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
            />
          </Field>
          <Field label="Fragmento (opcional)">
            <textarea value={fragment} onChange={(e) => setFragment(e.target.value)} placeholder="Pega un fragmento concreto…" />
          </Field>
          <Button onClick={generate}>Generar borradores</Button>
        </div>
      )}
    </div>
  );
}
