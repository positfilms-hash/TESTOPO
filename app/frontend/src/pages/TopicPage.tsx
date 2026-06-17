import { useState } from 'react';
import type { Material, TopicTreeNode } from '@backend';
import { useStore } from '../store/StoreContext.js';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  PageHeader,
} from '../components/ui.js';

// Temario unificado (SPEC 017): el temario y el material se gestionan juntos.
// Se selecciona un tema en el arbol y, a la derecha, se ven y suben sus
// materiales (individual, multiple o importando un ZIP).
export function TopicPage() {
  const { store, refresh, currentUser, currentOpposition, version } = useStore();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [parentId, setParentId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  void version;

  const oppositionId = currentOpposition?.id;
  const tree = store.topics
    .getTopicTree()
    .filter((node) => node.opposition_id === oppositionId);
  const allTopics = store.topics
    .listTopics()
    .filter((t) => t.opposition_id === oppositionId);
  const selected = selectedId
    ? allTopics.find((t) => t.id === selectedId) ?? null
    : null;

  const addTopic = () => {
    setError(null);
    if (!currentUser) return;
    try {
      store.platform.createTopic(currentUser, {
        opposition_id: oppositionId,
        title,
        parent_id: parentId || null,
      });
      setTitle('');
      setParentId('');
      setAdding(false);
      refresh();
    } catch {
      setError('El titulo es obligatorio.');
    }
  };

  const editTopic = (id: string, current: string) => {
    if (!currentUser) return;
    const next = window.prompt('Nuevo titulo del tema', current);
    if (next && next.trim()) {
      store.platform.editTopic(currentUser, id, { title: next.trim() });
      refresh();
    }
  };

  const markObsolete = (id: string) => {
    if (!currentUser) return;
    if (!window.confirm('¿Marcar este tema como obsoleto?')) return;
    store.platform.markTopicObsolete(currentUser, id);
    refresh();
  };

  return (
    <div>
      <PageHeader
        title="Temario"
        subtitle="Organiza temas y su material en un mismo lugar."
        action={<Button onClick={() => setAdding((v) => !v)}>Anadir tema</Button>}
      />

      {adding && (
        <div className="card" style={{ maxWidth: 520 }}>
          {error && <div className="notice error">{error}</div>}
          <Field label="Titulo del tema">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tema 3 - …" />
          </Field>
          <Field label="Tema padre (opcional)">
            <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">(Tema raiz)</option>
              {allTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="row">
            <Button onClick={addTopic}>Guardar</Button>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '1 1 280px', minWidth: 260 }}>
          <strong>Temas</strong>
          {tree.length === 0 ? (
            <EmptyState message="Todavia no hay temas. Anade el primero." />
          ) : (
            <div style={{ marginTop: 8 }}>
              {tree.map((node) => (
                <TopicNode
                  key={node.id}
                  node={node}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onEdit={editTopic}
                  onObsolete={markObsolete}
                />
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: '2 1 360px', minWidth: 320 }}>
          {selected ? (
            <TopicDetail topicId={selected.id} topicTitle={selected.title} />
          ) : (
            <EmptyState message="Selecciona un tema para ver y subir su material." />
          )}
        </div>
      </div>
    </div>
  );
}

function TopicNode({
  node,
  selectedId,
  onSelect,
  onEdit,
  onObsolete,
}: {
  node: TopicTreeNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (id: string, title: string) => void;
  onObsolete: (id: string) => void;
}) {
  return (
    <div className="tree-item">
      <div className="row spread">
        <button
          className={`nav-item small ${selectedId === node.id ? 'active' : ''}`}
          style={{ textAlign: 'left', flex: 1 }}
          onClick={() => onSelect(node.id)}
        >
          {node.code ? `${node.code} · ` : ''}
          {node.title} {node.status !== 'active' && <Badge status={node.status} />}
        </button>
        <span className="row">
          <Button variant="secondary" small onClick={() => onEdit(node.id, node.title)}>
            Editar
          </Button>
          {node.status !== 'obsolete' && (
            <Button variant="danger" small onClick={() => onObsolete(node.id)}>
              Obsoleto
            </Button>
          )}
        </span>
      </div>
      {node.children.length > 0 && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TopicNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onEdit={onEdit}
              onObsolete={onObsolete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ImportSummary {
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

function TopicDetail({ topicId, topicTitle }: { topicId: string; topicTitle: string }) {
  const { store, refresh, currentUser, currentOpposition, version } = useStore();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  void version;

  const materials: Material[] = store.topicMaterialLinks
    .findAll({ topic_id: topicId })
    .map((link) => store.materials.getMaterial(link.material_id))
    .filter((m): m is Material => Boolean(m));

  const uploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !currentUser) return;
    setBusy(true);
    setNotice(null);
    setSummary(null);
    try {
      const files = await Promise.all(
        Array.from(fileList).map(async (f) => ({
          original_filename: f.name,
          mime_type: f.type || null,
          bytes: new Uint8Array(await f.arrayBuffer()),
        })),
      );
      const { batch } = store.platform.importFilesToTopic(currentUser, {
        opposition_id: currentOpposition?.id,
        topic_id: topicId,
        files,
      });
      setSummary(toSummary(batch));
      refresh();
    } catch {
      setNotice('No se pudo subir el material. Revisa los archivos (PDF, TXT o MD).');
    } finally {
      setBusy(false);
    }
  };

  const importZip = async (file: File | null) => {
    if (!file || !currentUser) return;
    setBusy(true);
    setNotice(null);
    setSummary(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { batch } = store.platform.importZip(currentUser, {
        opposition_id: currentOpposition?.id,
        parent_topic_id: topicId,
        zip: { original_filename: file.name, bytes },
      });
      setSummary(toSummary(batch));
      refresh();
    } catch {
      setNotice(
        'No se pudo importar el ZIP. Puede contener rutas no seguras, ZIP anidados o superar los limites.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <PageHeader title={topicTitle} subtitle={`${materials.length} material(es)`} />

      {notice && <div className="notice error">{notice}</div>}
      {summary && (
        <div className="notice success">
          Importacion: {summary.imported} importados, {summary.skipped} omitidos,{' '}
          {summary.failed} fallidos.
          {summary.errors.length > 0 && (
            <div className="small">Avisos: {summary.errors.join(', ')}</div>
          )}
        </div>
      )}

      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <label className="btn small" style={{ cursor: 'pointer' }}>
          {busy ? 'Subiendo…' : 'Subir material'}
          <input
            type="file"
            multiple
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            style={{ display: 'none' }}
            disabled={busy}
            onChange={(e) => uploadFiles(e.target.files)}
          />
        </label>
        <label className="btn small secondary" style={{ cursor: 'pointer' }}>
          Importar ZIP
          <input
            type="file"
            accept=".zip,application/zip"
            style={{ display: 'none' }}
            disabled={busy}
            onChange={(e) => importZip(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <div style={{ marginTop: 12 }}>
        {materials.length === 0 ? (
          <EmptyState message="Este tema todavia no tiene material. Sube uno o importa un ZIP." />
        ) : (
          materials.map((m) => (
            <div className="card" key={m.id}>
              <div className="row spread">
                <div>
                  <strong>{m.title}</strong>
                  <div className="muted small">
                    {m.original_filename ?? 'sin archivo'}
                  </div>
                </div>
                <div className="row">
                  <Badge status={m.status} />
                  {m.extraction_status && <Badge status={m.extraction_status} />}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function toSummary(batch: {
  imported_files: number;
  skipped_files: number;
  failed_files: number;
  errors: string[];
}): ImportSummary {
  return {
    imported: batch.imported_files,
    skipped: batch.skipped_files,
    failed: batch.failed_files,
    errors: batch.errors,
  };
}
