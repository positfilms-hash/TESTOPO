import { useState } from 'react';
import { MATERIAL_TYPES, type MaterialType } from '@backend';
import { useStore } from '../store/StoreContext.js';
import { Badge, Button, EmptyState, Field, PageHeader } from '../components/ui.js';

type View = { kind: 'list' } | { kind: 'new' } | { kind: 'detail'; id: string };

const TYPE_LABELS: Record<MaterialType, string> = {
  syllabus: 'Temario',
  old_test: 'Test antiguo',
  official_exam: 'Examen oficial',
  law: 'Norma',
  notes: 'Apuntes',
  other: 'Otro',
};

export function MaterialPage() {
  const { store, refresh, currentUser, currentOpposition } = useStore();
  const isAdmin = currentUser?.role === 'admin';
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

  if (view.kind === 'detail') {
    return (
      <MaterialDetail
        id={view.id}
        onBack={() => setView({ kind: 'list' })}
      />
    );
  }

  const materials = store.materials
    .listMaterials()
    .filter((m) => m.opposition_id === currentOpposition?.id)
    // El estudiante solo ve material activo (SPEC 010, 13.3).
    .filter((m) => isAdmin || m.status === 'active');
  return (
    <div>
      <PageHeader
        title="Material"
        subtitle="Tus temarios, leyes y apuntes."
        action={
          isAdmin ? (
            <Button onClick={() => setView({ kind: 'new' })}>Anadir material</Button>
          ) : undefined
        }
      />
      {materials.length === 0 ? (
        <EmptyState message="Todavia no has anadido material. Empieza con 'Anadir material'." />
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
  const { store, currentOpposition } = useStore();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<MaterialType>('syllabus');
  const [reference, setReference] = useState('');
  const [contentText, setContentText] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    try {
      store.materials.createMaterial({
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

function MaterialDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { store, refresh, currentUser } = useStore();
  const isAdmin = currentUser?.role === 'admin';
  const material = store.materials.getMaterial(id);
  const [title, setTitle] = useState(material?.title ?? '');
  const [reference, setReference] = useState(material?.reference ?? '');
  const [notice, setNotice] = useState<string | null>(null);

  if (!material) {
    return <EmptyState message="Material no encontrado." />;
  }

  const save = () => {
    store.materials.editMaterial(id, { title, reference: reference || null });
    setNotice('Cambios guardados.');
    refresh();
  };

  const markObsolete = () => {
    if (!window.confirm('Marcar este material como obsoleto?')) return;
    store.materials.markObsolete(id);
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
        <Field label="Titulo">
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Referencia">
          <input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        {isAdmin && (
          <div className="row">
            <Button onClick={save}>Guardar cambios</Button>
            {material.status !== 'obsolete' && (
              <Button variant="danger" onClick={markObsolete}>
                Marcar obsoleto
              </Button>
            )}
          </div>
        )}
      </div>
      <details className="card" style={{ maxWidth: 560 }}>
        <summary className="muted small">Detalles tecnicos</summary>
        <div className="small muted" style={{ marginTop: 8 }}>
          <div>mime_type: {material.mime_type ?? '—'}</div>
          <div>size_bytes: {material.size_bytes ?? '—'}</div>
          <div>storage_path: {material.storage_path ?? '—'}</div>
        </div>
      </details>
    </div>
  );
}
