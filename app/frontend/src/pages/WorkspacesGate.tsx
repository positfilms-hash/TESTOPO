import { useState } from 'react';
import { useStore } from '../store/StoreContext.js';
import { Badge, Button, EmptyState, Field, PageHeader } from '../components/ui.js';

export function WorkspacesGate() {
  const { store, currentUser, selectWorkspace, logout, refresh, version } =
    useStore();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [type, setType] = useState<'personal' | 'organization'>('personal');
  const [error, setError] = useState<string | null>(null);

  void version;
  const workspaces = currentUser ? store.workspaces.listForUser(currentUser) : [];

  const create = () => {
    if (!currentUser) return;
    setError(null);
    try {
      const ws =
        type === 'organization'
          ? store.workspaces.createOrganizationWorkspace(currentUser, { name, slug })
          : store.workspaces.createPersonalWorkspace(currentUser, {
              name,
              slug,
              plan: 'premium',
            });
      refresh();
      setCreating(false);
      setName('');
      setSlug('');
      selectWorkspace(ws);
    } catch {
      setError('Revisa el nombre y el slug (debe ser unico).');
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '60px auto' }}>
      <PageHeader
        title="Mis espacios"
        subtitle={`Hola, ${currentUser?.name}. Elige un espacio de trabajo.`}
        action={
          <Button variant="secondary" onClick={logout}>
            Salir
          </Button>
        }
      />

      <div style={{ marginBottom: 16 }}>
        {creating ? (
          <div className="card">
            {error && <div className="notice error">{error}</div>}
            <Field label="Nombre">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mi preparacion personal" />
            </Field>
            <Field label="Slug (unico)">
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="mi-preparacion-personal" />
            </Field>
            <Field label="Tipo">
              <select value={type} onChange={(e) => setType(e.target.value as 'personal' | 'organization')}>
                <option value="personal">Personal (Premium)</option>
                <option value="organization">Organizacion</option>
              </select>
            </Field>
            <div className="row">
              <Button onClick={create}>Crear espacio</Button>
              <Button variant="secondary" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setCreating(true)}>Crear espacio</Button>
        )}
      </div>

      {workspaces.length === 0 ? (
        <EmptyState message="Todavia no tienes ningun espacio de trabajo. Crea tu primer workspace para empezar." />
      ) : (
        workspaces.map((ws) => (
          <div className="card" key={ws.id}>
            <div className="row spread">
              <div>
                <strong>{ws.name}</strong>
                <div className="muted small">
                  {ws.type === 'organization' ? 'Organizacion' : 'Personal'} · plan {ws.plan}
                </div>
              </div>
              <div className="row">
                <Badge status={ws.status} />
                <Button small onClick={() => selectWorkspace(ws)}>
                  Entrar
                </Button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
