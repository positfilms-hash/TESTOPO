import { useEffect, useState } from 'react';
import type { Opposition } from '@backend';
import { useStore, type Zone } from '../store/StoreContext.js';
import { Badge, Button, EmptyState, Field, PageHeader } from '../components/ui.js';
import { slugifyName } from '../workspaces/serverWorkspaceBootstrap.js';

export function OppositionsGate({ zone }: { zone: Zone }) {
  const {
    store,
    currentUser,
    currentWorkspace,
    canStudy,
    selectZone,
    selectOpposition,
    clearWorkspace,
    refresh,
    version,
  } = useStore();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = zone === 'admin';
  // Admin: oposiciones que puede gestionar. Estudiante: solo donde tiene
  // matricula activa (SPEC 014, 12). Carga asincrona (SPEC 018.3).
  const [oppositions, setOppositions] = useState<Opposition[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (currentUser) {
      const load = isAdmin
        ? store.oppositions.listForUser(currentUser)
        : store.oppositions.listStudyOppositions(currentUser);
      void load.then((list) => {
        if (!cancelled) {
          setOppositions(
            list.filter((o) => o.workspace_id === currentWorkspace?.id),
          );
        }
      });
    } else {
      setOppositions([]);
    }
    return () => {
      cancelled = true;
    };
  }, [store, currentUser, currentWorkspace, isAdmin, version]);
  const canSwitchZone = isAdmin && canStudy;

  const create = async () => {
    if (!currentUser || busy) return;
    setError(null);
    if (!title.trim()) {
      setError('Introduce un título para la oposición.');
      return;
    }
    setBusy(true);
    try {
      // Slug INTERNO autogenerado desde el titulo (no editable).
      const opposition = await store.oppositions.createOpposition(currentUser, {
        workspace_id: currentWorkspace?.id,
        title,
        slug: slugifyName(title),
      });
      refresh();
      setCreating(false);
      setTitle('');
      selectOpposition(opposition);
    } catch {
      setError('No se pudo crear la oposición. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '60px auto' }}>
      <PageHeader
        title={isAdmin ? 'Oposiciones' : 'Mis oposiciones'}
        subtitle={`${isAdmin ? 'Espacio' : 'Academia'}: ${currentWorkspace?.name}. Elige una oposicion para entrar.`}
        action={
          <div className="row">
            {canSwitchZone && (
              <Button variant="secondary" onClick={() => selectZone('student')}>
                Cambiar a estudio
              </Button>
            )}
            <Button variant="secondary" onClick={clearWorkspace}>
              Cambiar espacio
            </Button>
          </div>
        }
      />

      {isAdmin && (
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
              <Field label="Titulo">
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Auxiliar Administrativo"
                />
              </Field>
              <div className="row">
                <Button type="submit" disabled={busy}>
                  {busy ? 'Creando…' : 'Crear oposicion'}
                </Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => setCreating(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <Button onClick={() => setCreating(true)}>Crear oposicion</Button>
          )}
        </div>
      )}

      {oppositions.length === 0 ? (
        <EmptyState
          message={
            isAdmin
              ? 'Todavia no has creado ninguna oposicion. Crea una oposicion para subir material y generar preguntas.'
              : 'Todavia no tienes acceso a ninguna oposicion. Cuando un administrador te de acceso, aparecera aqui.'
          }
        />
      ) : (
        oppositions.map((opp) => (
          <div className="card" key={opp.id}>
            <div className="row spread">
              <div>
                <strong>{opp.title}</strong>
                <div className="muted small">{opp.slug}</div>
              </div>
              <div className="row">
                <Badge status={opp.status} />
                <Button small onClick={() => selectOpposition(opp)}>
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
