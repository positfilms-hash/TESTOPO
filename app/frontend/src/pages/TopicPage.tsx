import { useEffect, useState } from 'react';
import type { Material, Topic, TopicTreeNode } from '@backend';
import { useStore } from '../store/StoreContext.js';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  PageHeader,
} from '../components/ui.js';
import { SyllabusIndexPanel } from './SyllabusIndexPanel.js';

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
  const [showSyllabus, setShowSyllabus] = useState(false);
  const [tree, setTree] = useState<TopicTreeNode[]>([]);
  const [allTopics, setAllTopics] = useState<Topic[]>([]);

  const oppositionId = currentOpposition?.id;
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const t = (await store.topics.getTopicTree()).filter(
        (node) => node.opposition_id === oppositionId,
      );
      const a = (await store.topics.listTopics()).filter(
        (x) => x.opposition_id === oppositionId,
      );
      if (!cancelled) {
        setTree(t);
        setAllTopics(a);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store, oppositionId, version]);
  const selected = selectedId
    ? allTopics.find((t) => t.id === selectedId) ?? null
    : null;

  const addTopic = async () => {
    setError(null);
    if (!currentUser) return;
    try {
      await store.platform.createTopic(currentUser, {
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

  const editTopic = async (id: string, current: string) => {
    if (!currentUser) return;
    const next = window.prompt('Nuevo titulo del tema', current);
    if (next && next.trim()) {
      await store.platform.editTopic(currentUser, id, { title: next.trim() });
      refresh();
    }
  };

  const markObsolete = async (id: string) => {
    if (!currentUser) return;
    if (!window.confirm('¿Marcar este tema como obsoleto?')) return;
    await store.platform.markTopicObsolete(currentUser, id);
    refresh();
  };

  return (
    <div>
      <PageHeader
        title="Temario"
        subtitle="Organiza temas y su material en un mismo lugar."
        action={
          <div className="row">
            <Button variant="secondary" onClick={() => setShowSyllabus((v) => !v)}>
              Crear indice con IA
            </Button>
            <Button onClick={() => setAdding((v) => !v)}>Anadir tema</Button>
          </div>
        }
      />

      {showSyllabus && (
        <div style={{ marginBottom: 16 }}>
          <SyllabusIndexPanel onClose={() => setShowSyllabus(false)} />
        </div>
      )}

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

// SPEC 028: la subida de material se centraliza en la seccion "Material"
// (carga masiva por categoria). Aqui el tema solo muestra, en modo lectura, el
// material que ya tiene asociado.
function TopicDetail({ topicId, topicTitle }: { topicId: string; topicTitle: string }) {
  const { store, version } = useStore();
  const [materials, setMaterials] = useState<Material[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const links = await store.topicMaterialLinks.findAll({ topic_id: topicId });
      const list: Material[] = [];
      for (const link of links) {
        const m = await store.materials.getMaterial(link.material_id);
        if (m) list.push(m);
      }
      if (!cancelled) setMaterials(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [store, topicId, version]);

  return (
    <div className="card">
      <PageHeader title={topicTitle} subtitle={`${materials.length} material(es)`} />
      <p className="muted small">
        Para anadir material usa "Subir material" en la seccion Material.
      </p>

      <div style={{ marginTop: 12 }}>
        {materials.length === 0 ? (
          <EmptyState message="Este tema todavia no tiene material asociado." />
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
