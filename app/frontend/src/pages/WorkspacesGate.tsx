import { useEffect, useState } from 'react';
import type { Workspace } from '@backend';
import { useStore } from '../store/StoreContext.js';
import { Badge, Button, EmptyState, Field, PageHeader } from '../components/ui.js';
import {
  shouldUseServerWorkspaceCreate,
  createWorkspaceViaRpc,
  ServerWorkspaceError,
  slugifyName,
} from '../workspaces/serverWorkspaceBootstrap.js';

export function WorkspacesGate() {
  const { store, currentUser, selectWorkspace, logout, refresh, version } =
    useStore();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'personal' | 'organization'>('personal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (currentUser) {
      void store.workspaces.listForUser(currentUser).then((ws) => {
        if (!cancelled) setWorkspaces(ws);
      });
    } else {
      setWorkspaces([]);
    }
    return () => {
      cancelled = true;
    };
  }, [store, currentUser, version]);

  const create = async () => {
    if (!currentUser || busy) return;
    setError(null);
    if (!name.trim()) {
      setError('Introduce un nombre para el espacio.');
      return;
    }
    setBusy(true);
    try {
      // Modo Supabase: la creacion del PRIMER workspace + membership owner es
      // ATOMICA via RPC (la RLS no permite el bootstrap por pasos). El slug es
      // interno (autogenerado, no editable). InMemory/demo: servicio en proceso.
      let ws: Workspace;
      if (shouldUseServerWorkspaceCreate()) {
        ws = await createWorkspaceViaRpc({ name, type });
      } else {
        const slug = slugifyName(name);
        ws =
          type === 'organization'
            ? await store.workspaces.createOrganizationWorkspace(currentUser, { name, slug })
            : await store.workspaces.createPersonalWorkspace(currentUser, {
                name,
                slug,
                plan: 'premium',
              });
      }
      refresh();
      setCreating(false);
      setName('');
      selectWorkspace(ws);
    } catch (err) {
      // Mensaje ESPECIFICO; nunca "slug duplicado" ante un fallo de RLS/otro.
      setError(
        err instanceof ServerWorkspaceError
          ? err.message
          : 'No se pudo crear el espacio. Inténtalo de nuevo.',
      );
    } finally {
      setBusy(false);
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
          <form
            className="card"
            onSubmit={(e) => {
              e.preventDefault(); // Enter envia el formulario
              void create();
            }}
          >
            {error && <div className="notice error">{error}</div>}
            <Field label="Nombre">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mi preparacion personal"
              />
            </Field>
            <Field label="Tipo">
              <select value={type} onChange={(e) => setType(e.target.value as 'personal' | 'organization')}>
                <option value="personal">Personal (Premium)</option>
                <option value="organization">Organizacion</option>
              </select>
            </Field>
            <div className="row">
              <Button type="submit" disabled={busy}>
                {busy ? 'Creando…' : 'Crear espacio'}
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setCreating(false)}>
                Cancelar
              </Button>
            </div>
          </form>
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
