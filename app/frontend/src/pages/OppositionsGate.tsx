import { useState } from 'react';
import { useStore, type Zone } from '../store/StoreContext.js';
import { Badge, Button, EmptyState, Field, PageHeader } from '../components/ui.js';

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
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isAdmin = zone === 'admin';
  // `version` fuerza recalcular tras crear una oposicion.
  void version;
  // Admin: oposiciones que puede gestionar. Estudiante: solo donde tiene
  // matricula activa (SPEC 014, 12).
  const oppositions = currentUser
    ? (isAdmin
        ? store.oppositions.listForUser(currentUser)
        : store.oppositions.listStudyOppositions(currentUser)
      ).filter((o) => o.workspace_id === currentWorkspace?.id)
    : [];
  const canSwitchZone = isAdmin && canStudy;

  const create = () => {
    if (!currentUser) return;
    setError(null);
    try {
      const opposition = store.oppositions.createOpposition(currentUser, {
        workspace_id: currentWorkspace?.id,
        title,
        slug,
      });
      refresh();
      setCreating(false);
      setTitle('');
      setSlug('');
      selectOpposition(opposition);
    } catch {
      setError('Revisa el titulo y el slug (el slug debe ser unico).');
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
            <div className="card">
              {error && <div className="notice error">{error}</div>}
              <Field label="Titulo">
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Auxiliar Administrativo" />
              </Field>
              <Field label="Slug (unico)">
                <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auxiliar-administrativo" />
              </Field>
              <div className="row">
                <Button onClick={create}>Crear oposicion</Button>
                <Button variant="secondary" onClick={() => setCreating(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
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
