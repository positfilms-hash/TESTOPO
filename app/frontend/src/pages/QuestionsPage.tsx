import { useEffect, useState } from 'react';
import {
  QuestionReviewError,
  QuestionGenerationError,
  type Difficulty,
  type RequestedDifficulty,
  type Question,
  type QuestionValidationResult,
  type QuestionReviewFeedback,
  type FeedbackType,
  type Material,
  type Topic,
} from '@backend';
import { useStore } from '../store/StoreContext.js';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  LoadingState,
  PageHeader,
  difficultyLabel,
} from '../components/ui.js';

type View =
  | { kind: 'list' }
  | { kind: 'review'; id: string }
  | { kind: 'generate' }
  // SPEC 028-E: generar candidatas desde un tema aplicado y sus fuentes.
  | { kind: 'generate-grounded' };

const PENDING = ['draft', 'pending_review', 'needs_fix'];

// Motivos de rechazo/correccion ofrecidos en revision (SPEC 018.4, 17).
const REASON_OPTIONS: { type: FeedbackType; label: string }[] = [
  { type: 'ambiguous_statement', label: 'Ambigua' },
  { type: 'multiple_correct_answers', label: 'Varias respuestas correctas' },
  { type: 'wrong_correct_answer', label: 'Respuesta correcta incorrecta' },
  { type: 'weak_explanation', label: 'Explicacion insuficiente' },
  { type: 'missing_source', label: 'Fuente insuficiente' },
  { type: 'off_topic', label: 'Fuera de tema' },
  { type: 'invented_content', label: 'Contenido inventado' },
  { type: 'bad_options', label: 'Opciones mal planteadas' },
  { type: 'other', label: 'Otro' },
];

export function QuestionsPage() {
  const [view, setView] = useState<View>({ kind: 'list' });

  if (view.kind === 'review') {
    return <QuestionReview id={view.id} onBack={() => setView({ kind: 'list' })} />;
  }
  if (view.kind === 'generate') {
    return <GenerateForm onBack={() => setView({ kind: 'list' })} />;
  }
  if (view.kind === 'generate-grounded') {
    return <GenerateFromTopicForm onBack={() => setView({ kind: 'list' })} />;
  }
  return (
    <QuestionsList
      onReview={(id) => setView({ kind: 'review', id })}
      onGenerate={() => setView({ kind: 'generate' })}
      onGenerateGrounded={() => setView({ kind: 'generate-grounded' })}
    />
  );
}

function QuestionsList({
  onReview,
  onGenerate,
  onGenerateGrounded,
}: {
  onReview: (id: string) => void;
  onGenerate: () => void;
  onGenerateGrounded: () => void;
}) {
  const { store, currentOpposition, version } = useStore();
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [all, setAll] = useState<Question[]>([]);
  useEffect(() => {
    let cancelled = false;
    void store.questions.listQuestions().then((list) => {
      if (!cancelled) {
        setAll(list.filter((q) => q.opposition_id === currentOpposition?.id));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [store, currentOpposition, version]);
  const questions = tab === 'pending' ? all.filter((q) => PENDING.includes(q.status)) : all;

  return (
    <div>
      <PageHeader
        title="Preguntas"
        subtitle="Revisa y aprueba las preguntas del banco."
        action={
          <div className="row">
            <Button onClick={onGenerateGrounded}>Generar desde tema</Button>
            <Button variant="secondary" onClick={onGenerate}>
              Generar desde fragmento
            </Button>
          </div>
        }
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
  // Motivos estructurados para corregir/rechazar (SPEC 018.4, 17).
  const [reasons, setReasons] = useState<Set<FeedbackType>>(new Set());
  const [reasonComment, setReasonComment] = useState('');

  const [question, setQuestion] = useState<Question | null>(null);
  const [report, setReport] = useState<QuestionValidationResult | null>(null);
  const [pastFeedback, setPastFeedback] = useState<QuestionReviewFeedback[]>([]);
  // Revision Codex (recomendado): mientras se carga la candidata desde Supabase
  // NO debe mostrarse "no encontrada"; ese estado solo aplica al resultado nulo.
  const [loading, setLoading] = useState(true);
  // La validacion (SPEC 005) decide si se puede aprobar.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const q = await store.questions.getQuestion(id);
        const r = q ? await store.validation.validateQuestion(id) : null;
        const f = q ? await store.review.listFeedback(id) : [];
        if (!cancelled) {
          setQuestion(q);
          setReport(r);
          setPastFeedback(f);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store, id, version]);

  const toggleReason = (type: FeedbackType) => {
    setReasons((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Construye el feedback estructurado a registrar con la accion (SPEC 018.4).
  const buildFeedback = () => {
    const comment = reasonComment.trim() || null;
    return [...reasons].map((type) => ({ feedback_type: type, comment }));
  };

  if (loading) {
    return <LoadingState />;
  }
  if (!question || !report) {
    return <EmptyState message="Pregunta no encontrada." />;
  }

  const hasErrors = report.errors.length > 0;

  const approve = async () => {
    if (!currentUser) return;
    try {
      await store.platform.approve(currentUser, id, { reviewer_name: currentUser.name });
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

  const act = async (
    fn: () => unknown,
    confirmMsg: string | null,
    successMsg: string,
  ) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    await fn();
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

      <div className="card">
        <strong>Motivos (al corregir o rechazar)</strong>
        <p className="muted small">
          Marca uno o varios motivos. Ayudan a mejorar futuras generaciones.
        </p>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {REASON_OPTIONS.map((r) => (
            <label key={r.type} className="row small" style={{ gap: 4 }}>
              <input
                type="checkbox"
                checked={reasons.has(r.type)}
                onChange={() => toggleReason(r.type)}
              />
              {r.label}
            </label>
          ))}
        </div>
        <Field label="Comentario (opcional)">
          <textarea
            value={reasonComment}
            onChange={(e) => setReasonComment(e.target.value)}
            placeholder="Detalle del motivo…"
          />
        </Field>
        {pastFeedback.length > 0 && (
          <p className="muted small">
            Motivos registrados: {pastFeedback.map((f) => f.feedback_type).join(', ')}
          </p>
        )}
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
                store.platform.markNeedsFix(currentUser, id, {
                  reviewer_name: currentUser.name,
                  notes: 'Revisar',
                  feedback: buildFeedback(),
                }),
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
                  reviewer_name: currentUser.name,
                  notes: 'Rechazada en revision',
                  feedback: buildFeedback(),
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
  const [statement, setStatement] = useState('');
  const [explanation, setExplanation] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');

  useEffect(() => {
    let cancelled = false;
    void store.questions.getQuestion(id).then((question) => {
      if (!cancelled && question) {
        setStatement(question.statement);
        setExplanation(question.explanation ?? '');
        setDifficulty(question.difficulty ?? 'medium');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [store, id]);

  const save = async () => {
    if (!currentUser) return;
    await store.platform.editFromReview(currentUser, id, {
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
  const [materials, setMaterials] = useState<Material[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [materialId, setMaterialId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [difficulty, setDifficulty] = useState<RequestedDifficulty>('mixed');
  const [count, setCount] = useState(5);
  const [fragment, setFragment] = useState('');
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const m = (await store.materials.listMaterials()).filter(
        (x) => x.opposition_id === currentOpposition?.id && x.status !== 'obsolete',
      );
      const t = (await store.topics.listTopics()).filter(
        (x) => x.opposition_id === currentOpposition?.id && x.status !== 'obsolete',
      );
      if (!cancelled) {
        setMaterials(m);
        setTopics(t);
        setMaterialId((prev) => prev || m[0]?.id || '');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store, currentOpposition]);

  const generate = async () => {
    setNotice(null);
    if (!currentUser) return;
    // SPEC 028-E: fuente concreta obligatoria. No se genera desde el material
    // completo: hay que pegar un fragmento concreto (o usar "Generar desde
    // tema (con fuentes)"). Asi cada candidata queda anclada y trazable.
    const excerpt = fragment.trim();
    if (!excerpt) {
      setNotice({
        type: 'error',
        text: 'Pega un fragmento concreto del material para generar con fuente. Para anclar a un tema y sus fuentes, usa "Generar desde tema (con fuentes)".',
      });
      return;
    }
    try {
      const base = {
        material_id: materialId,
        topic_id: topicId || null,
        difficulty,
        question_count: count,
      };
      const result = await store.platform.generateFromExcerpt(currentUser, {
        ...base,
        excerpt,
      });
      refresh();
      setNotice({
        type: 'success',
        text: `Se han generado ${result.questions.length} preguntas pendientes de revision.`,
      });
    } catch (error) {
      setNotice({
        type: 'error',
        text: generationErrorMessage(
          error,
          'No se pudo generar: revisa el material (con texto y no obsoleto) y los parametros.',
        ),
      });
    }
  };

  return (
    <div>
      <PageHeader
        title="Generar desde un fragmento"
        subtitle="Pega un fragmento concreto del material: la fuente queda anclada y trazable. Las preguntas quedaran pendientes de revision."
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
          <Field label="Fragmento del material (obligatorio)">
            <textarea
              value={fragment}
              onChange={(e) => setFragment(e.target.value)}
              placeholder="Pega aqui el fragmento concreto del material sobre el que generar…"
            />
          </Field>
          <Button onClick={generate} disabled={!fragment.trim()}>
            Generar borradores
          </Button>
        </div>
      )}
    </div>
  );
}

// SPEC 028-E: generar candidatas desde un TEMA APLICADO y sus fuentes concretas.
// Las candidatas conservan la fuente y van a revision (nunca validated).
function GenerateFromTopicForm({ onBack }: { onBack: () => void }) {
  const { store, refresh, currentUser, currentOpposition } = useStore();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [count, setCount] = useState(5);
  const [sourceCount, setSourceCount] = useState<number | null>(null);
  // SPEC 028-F: interruptores de contexto adaptativo (defecto on).
  const [useStyleProfile, setUseStyleProfile] = useState(true);
  const [useErrorMemory, setUseErrorMemory] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const t = (await store.topics.listTopics()).filter(
        (x) => x.opposition_id === currentOpposition?.id && x.status !== 'obsolete',
      );
      if (!cancelled) {
        setTopics(t);
        setTopicId((prev) => prev || t[0]?.id || '');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store, currentOpposition]);

  // Vista previa de fuentes disponibles para el tema elegido.
  useEffect(() => {
    let cancelled = false;
    setSourceCount(null);
    if (!currentUser || !currentOpposition || !topicId) return;
    void (async () => {
      try {
        const preview = await store.platform.previewTopicSources(currentUser, {
          opposition_id: currentOpposition.id,
          topic_id: topicId,
        });
        if (!cancelled) setSourceCount(preview.primary.length);
      } catch {
        if (!cancelled) setSourceCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store, currentUser, currentOpposition, topicId]);

  const generate = async () => {
    setNotice(null);
    if (!currentUser || !currentOpposition) return;
    setBusy(true);
    try {
      const result = await store.platform.generateQuestionsFromTopic(currentUser, {
        opposition_id: currentOpposition.id,
        topic_id: topicId,
        difficulty,
        count,
        use_style_profile: useStyleProfile,
        use_error_memory: useErrorMemory,
      });
      refresh();
      setNotice({
        type: 'success',
        text: `Se han generado ${result.questions.length} preguntas con fuente, pendientes de revision.`,
      });
    } catch (error) {
      setNotice({
        type: 'error',
        text: generationErrorMessage(
          error,
          'No se pudo generar: el tema necesita documentos de estudio clasificados y seccionados con fuente.',
        ),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Generar desde tema (con fuentes)"
        subtitle="Crea preguntas trazables desde un tema aplicado y sus fragmentos de fuente. Quedan pendientes de revision."
        action={
          <Button variant="secondary" onClick={onBack}>
            Volver
          </Button>
        }
      />
      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
      {topics.length === 0 ? (
        <EmptyState message="Necesitas temas aplicados. Crea y aplica un indice de temario primero." />
      ) : (
        <div className="card" style={{ maxWidth: 560 }}>
          <Field label="Tema">
            <select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </Field>
          {sourceCount != null && (
            <p className={`muted small`}>
              {sourceCount > 0
                ? `${sourceCount} fuente(s) disponible(s) para este tema.`
                : 'Este tema no tiene fuentes elegibles todavia (clasifica y crea secciones del material).'}
            </p>
          )}
          <Field label="Dificultad">
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              <option value="easy">Facil</option>
              <option value="medium">Media</option>
              <option value="hard">Dificil</option>
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
          {/* SPEC 028-F: contexto adaptativo (no factual). */}
          <label className="small" style={{ display: 'block', marginTop: 4 }}>
            <input
              type="checkbox"
              checked={useStyleProfile}
              onChange={(e) => setUseStyleProfile(e.target.checked)}
            />{' '}
            Usar estilo de exámenes (perfil activo)
          </label>
          <label className="small" style={{ display: 'block', marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={useErrorMemory}
              onChange={(e) => setUseErrorMemory(e.target.checked)}
            />{' '}
            Usar memoria de errores (feedback)
          </label>
          <Button onClick={generate} disabled={busy || sourceCount === 0}>
            {busy ? 'Generando...' : 'Generar desde tema'}
          </Button>
        </div>
      )}
    </div>
  );
}

// Mensaje de usuario a partir de un error de generacion (SPEC 028-E / revision
// Codex). `QuestionGenerationError` expone `.errors` (codigos). Distingue el caso
// de IA no configurada (staging sin proveedor real) y el de fragmento ajeno.
function generationErrorMessage(error: unknown, fallback: string): string {
  const codes =
    error && typeof error === 'object' && Array.isArray((error as { errors?: unknown }).errors)
      ? (error as { errors: string[] }).errors
      : [];
  if (codes.some((c) => c.includes('AI_NOT_CONFIGURED'))) {
    return 'La generación con IA no está configurada en este entorno: no se han creado preguntas. Configura el proveedor de IA en el servidor para generar candidatas reales.';
  }
  if (codes.some((c) => c.includes('EXCERPT_NOT_IN_SOURCE'))) {
    return 'El fragmento no pertenece al material seleccionado. Copia y pega un texto que aparezca en ese documento.';
  }
  if (codes.length > 0) {
    return fallback;
  }
  return 'No se pudo generar.';
}
