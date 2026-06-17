import { useState } from 'react';
import type { TopicTreeNode } from '@backend';
import { useStore } from '../store/StoreContext.js';
import { Badge, Button, EmptyState, Field, PageHeader } from '../components/ui.js';

export function TopicPage() {
  const { store, refresh, currentUser, currentOpposition } = useStore();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const oppositionId = currentOpposition?.id;
  const tree = store.topics
    .getTopicTree()
    .filter((node) => node.opposition_id === oppositionId);
  const allTopics = store.topics
    .listTopics()
    .filter((t) => t.opposition_id === oppositionId);

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
        subtitle="Organiza temas y apartados."
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

      {tree.length === 0 ? (
        <EmptyState message="Todavia no hay temas. Anade el primero." />
      ) : (
        <div className="card">
          {tree.map((node) => (
            <TopicNode
              key={node.id}
              node={node}
              onEdit={editTopic}
              onObsolete={markObsolete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TopicNode({
  node,
  onEdit,
  onObsolete,
}: {
  node: TopicTreeNode;
  onEdit: (id: string, title: string) => void;
  onObsolete: (id: string) => void;
}) {
  return (
    <div className="tree-item">
      <div className="row spread">
        <span>
          {node.code ? `${node.code} · ` : ''}
          {node.title}{' '}
          {node.status !== 'active' && <Badge status={node.status} />}
        </span>
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
            <TopicNode key={child.id} node={child} onEdit={onEdit} onObsolete={onObsolete} />
          ))}
        </div>
      )}
    </div>
  );
}
