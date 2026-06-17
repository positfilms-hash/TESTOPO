import { useState } from 'react';
import { MATERIAL_TYPES, type MaterialType } from '@backend';
import { useStore } from '../store/StoreContext.js';
import { Badge, Button, EmptyState, Field, PageHeader } from '../components/ui.js';

type View =
  | { kind: 'list' }
  | { kind: 'new' }
  | { kind: 'pdf' }
  | { kind: 'detail'; id: string };

const EXTRACTION_LABELS: Record<string, string> = {
  not_started: 'Sin procesar',
  processing: 'Procesando',
  completed: 'Texto extraido',
  failed: 'Extraccion fallida',
  not_supported: 'Sin texto extraible',
};

const TYPE_LABELS: Record<MaterialType, string> = {
  syllabus: 'Temario',
  old_test: 'Test antiguo',
  official_exam: 'Examen oficial',
  law: 'Norma',
  notes: 'Apuntes',
  other: 'Otro',
};

export function MaterialPage() {
  const { store, refresh, currentUser, currentOpposition, isWorkspaceManager } =
    useStore();
  const isAdmin = isWorkspaceManager;
  const [view, setView] = useState<View>({ kind: 'list' });

  if (view.kind === 'new') {
    return (
      <MaterialForm
        onCancel={() => setView({ kind: 'list' })}
        onSaved={() => {
          refresh();
          setView({ kind: 'list' });
        }}
      />
    );
  }

  if (view.kind === 'pdf') {
    return (
      <PdfUploadForm
        onCancel={() => setView({ kind: 'list' })}
        onDone={() => {
          refresh();
          setView({ kind: 'list' });
        }}
      />
    );
  }

  if (view.kind === 'detail') {
    return (
      <MaterialDetail
        id={view.id}
        onBack={() => setView({ kind: 'list' })}
      />
    );
  }

  // El facade aplica el acceso: el estudiante solo ve material activo de
  // oposiciones autorizadas (SPEC 012/013); el gestor ve todo.
  const materials =
    currentUser && currentOpposition
      ? store.platform.listMaterials(currentUser, currentOpposition.id)
      : [];
  return (
    <div>
      <PageHeader
        title="Material"
        subtitle="Tus temarios, leyes y apuntes."
        action={
          isAdmin ? (
            <div className="row">
              <Button onClick={() => setView({ kind: 'pdf' })}>Subir PDF</Button>
              <Button variant="secondary" onClick={() => setView({ kind: 'new' })}>
                Anadir material
              </Button>
            </div>
          ) : undefined
        }
      />
      {materials.length === 0 ? (
        <EmptyState
          message={
            isAdmin
              ? "Todavia no has anadido material. Empieza con 'Anadir material'."
              : 'Todavia no hay material disponible en esta oposicion.'
          }
        />
      ) : (
        materials.map((m) => (
          <div className="card" key={m.id}>
            <div className="row spread">
              <div>
                <strong>{m.title}</strong>
                <div className="muted small">
                  {TYPE_LABELS[m.type]} · {m.reference || 'sin referencia'}
                </div>
              </div>
              <div className="row">
                <Badge status={m.status} />
                <Button variant="secondary" small onClick={() => setView({ kind: 'detail', id: m.id })}>
                  Ver
                </Button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function MaterialForm({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { store, currentUser, currentOpposition } = useStore();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<MaterialType>('syllabus');
  const [reference, setReference] = useState('');
  const [contentText, setContentText] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    if (!currentUser) return;
    try {
      store.platform.createMaterial(currentUser, {
        opposition_id: currentOpposition?.id,
        title,
        type,
        status: 'active',
        reference: reference || null,
        content_text: contentText || null,
        description: description || null,
      });
      onSaved();
    } catch {
      setError('Revisa los datos: el titulo y el tipo son obligatorios.');
    }
  };

  return (
    <div>
      <PageHeader title="Anadir material" subtitle="Pega el texto o describe el documento." />
      {error && <div className="notice error">{error}</div>}
      <div className="card" style={{ maxWidth: 560 }}>
        <Field label="Titulo">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tema 1 - Constitucion" />
        </Field>
        <Field label="Tipo">
          <select value={type} onChange={(e) => setType(e.target.value as MaterialType)}>
            {MATERIAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Referencia (opcional)">
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Tema 1, articulo 14…" />
        </Field>
        <Field label="Texto del material (opcional)">
          <textarea value={contentText} onChange={(e) => setContentText(e.target.value)} />
        </Field>
        <Field label="Descripcion (opcional)">
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="row">
          <Button onClick={submit}>Guardar material</Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

function PdfUploadForm({
  onCancel,
  onDone,
}: {
  onCancel: () => void;
  onDone: () => void;
}) {
  const { store, currentUser, currentOpposition } = useStore();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<MaterialType>('syllabus');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [topicId, setTopicId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; extracted: boolean } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  // Temas de la oposicion actual para vincular opcionalmente.
  const topics = store.topics
    .listTopics()
    .filter((t) => t.opposition_id === currentOpposition?.id);

  const submit = async () => {
    setError(null);
    if (!currentUser) return;
    if (!file) {
      setError('Selecciona un archivo PDF.');
      return;
    }
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const material = store.platform.uploadPdf(currentUser, {
        opposition_id: currentOpposition?.id,
        title,
        type,
        reference: reference || null,
        description: description || null,
        topic_ids: topicId ? [topicId] : [],
        file: {
          original_filename: file.name,
          mime_type: file.type || 'application/pdf',
          bytes,
        },
      });
      setResult({
        ok: true,
        extracted: material.extraction_status === 'completed',
      });
    } catch {
      setError(
        'No se pudo subir el PDF. Revisa el titulo, el tipo y que el archivo sea un PDF valido (max. 50 MB).',
      );
    } finally {
      setBusy(false);
    }
  };

  if (result?.ok) {
    return (
      <div>
        <PageHeader title="Subir PDF" subtitle="Resultado de la subida." />
        <div className="notice success">PDF subido correctamente.</div>
        <div className={`notice ${result.extracted ? 'success' : 'error'}`}>
          {result.extracted
            ? 'Texto extraido correctamente. Ya puedes usar este material para generar preguntas.'
            : 'El PDF se ha subido, pero no se ha podido extraer texto. Puede que sea un PDF escaneado.'}
        </div>
        <div className="row">
          <Button onClick={onDone}>Volver al material</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Subir PDF" subtitle="Sube un temario, ley o examen en PDF." />
      {error && <div className="notice error">{error}</div>}
      <div className="card" style={{ maxWidth: 560 }}>
        <Field label="Titulo">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tema 1 - Constitucion" />
        </Field>
        <Field label="Tipo">
          <select value={type} onChange={(e) => setType(e.target.value as MaterialType)}>
            {MATERIAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tema relacionado (opcional)">
          <select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">Sin tema</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code ? `${t.code} · ` : ''}
                {t.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Referencia (opcional)">
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Tema 1, articulo 14…" />
        </Field>
        <Field label="Archivo PDF">
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
        <Field label="Descripcion (opcional)">
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="row">
          <Button onClick={submit} disabled={busy}>
            {busy ? 'Subiendo…' : 'Subir PDF'}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

function MaterialDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { store, refresh, currentUser, isWorkspaceManager } = useStore();
  const isAdmin = isWorkspaceManager;
  // El facade verifica acceso (oposicion autorizada + material activo para el
  // estudiante). Si no procede, no se expone el material (SPEC 013, 20.4).
  const material = currentUser
    ? safeGetMaterial(() => store.platform.getMaterial(currentUser, id))
    : null;
  const [title, setTitle] = useState(material?.title ?? '');
  const [reference, setReference] = useState(material?.reference ?? '');
  const [notice, setNotice] = useState<string | null>(null);

  if (!material) {
    return (
      <div>
        <PageHeader
          title="Material"
          action={
            <Button variant="secondary" onClick={onBack}>
              Volver
            </Button>
          }
        />
        <EmptyState message="Este material no esta disponible." />
      </div>
    );
  }

  // Temas asociados (SPEC 003/012/013): resueltos via los vinculos guardados.
  const topicTitles = store.topicMaterialLinks
    .findAll({ material_id: material.id })
    .map((link) => store.topics.getTopic(link.topic_id)?.title)
    .filter((t): t is string => Boolean(t));

  const save = () => {
    if (!currentUser) return;
    store.platform.editMaterial(currentUser, id, {
      title,
      reference: reference || null,
    });
    setNotice('Cambios guardados.');
    refresh();
  };

  const markObsolete = () => {
    if (!currentUser) return;
    if (!window.confirm('¿Marcar este material como obsoleto?')) return;
    store.platform.markMaterialObsolete(currentUser, id);
    refresh();
    onBack();
  };

  return (
    <div>
      <PageHeader
        title={material.title}
        subtitle={TYPE_LABELS[material.type]}
        action={
          <Button variant="secondary" onClick={onBack}>
            Volver
          </Button>
        }
      />
      {notice && <div className="notice success">{notice}</div>}
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="row spread" style={{ marginBottom: 12 }}>
          <Badge status={material.status} />
        </div>
        {isAdmin ? (
          <>
            <Field label="Titulo">
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Referencia">
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </Field>
            <div className="row">
              <Button onClick={save}>Guardar cambios</Button>
              {material.status !== 'obsolete' && (
                <Button variant="danger" onClick={markObsolete}>
                  Marcar obsoleto
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="small muted">
            {material.description && <div>{material.description}</div>}
            <div>Tipo: {TYPE_LABELS[material.type]}</div>
            <div>Referencia: {material.reference || 'sin referencia'}</div>
            {topicTitles.length > 0 && (
              <div>Temas: {topicTitles.join(', ')}</div>
            )}
          </div>
        )}
      </div>
      {material.extraction_status && (
        <div className="card" style={{ maxWidth: 560 }}>
          <div className="row spread">
            <span className="muted small">Extraccion de texto</span>
            <Badge status={material.extraction_status} />
          </div>
          <div className="small muted" style={{ marginTop: 4 }}>
            {EXTRACTION_LABELS[material.extraction_status] ??
              material.extraction_status}
            {material.page_count != null && ` · ${material.page_count} pag.`}
          </div>
          {material.extraction_error && (
            <div className="small muted" style={{ marginTop: 4 }}>
              {material.extraction_error}
            </div>
          )}
        </div>
      )}
      {material.content_text ? (
        <details className="card" style={{ maxWidth: 560 }}>
          <summary className="muted small">Texto extraido</summary>
          <pre
            className="small"
            style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}
          >
            {material.content_text}
          </pre>
        </details>
      ) : (
        material.original_filename && (
          <div className="card small muted" style={{ maxWidth: 560 }}>
            Este material esta disponible como PDF, pero no tiene texto extraido.
          </div>
        )
      )}
      {/* Detalles internos solo para gestores; nunca exponer storage_path al
          estudiante (SPEC 013, 18). */}
      {isAdmin && (
        <details className="card" style={{ maxWidth: 560 }}>
          <summary className="muted small">Detalles tecnicos</summary>
          <div className="small muted" style={{ marginTop: 8 }}>
            <div>original_filename: {material.original_filename ?? '—'}</div>
            <div>mime_type: {material.mime_type ?? '—'}</div>
            <div>size_bytes: {material.size_bytes ?? '—'}</div>
            <div>storage_path: {material.storage_path ?? '—'}</div>
          </div>
        </details>
      )}
    </div>
  );
}

// getMaterial lanza AccessError si el usuario no puede ver el material; aqui
// lo convertimos en "no disponible" para la UI.
function safeGetMaterial<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
