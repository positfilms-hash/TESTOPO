import { useState } from 'react';
import { useStore } from '../store/StoreContext.js';
import { Badge, Button, EmptyState, Field, PageHeader } from '../components/ui.js';

export function OppositionsGate() {
  const {
    store,
    currentUser,
    selectOpposition,
    logout,
    refresh,
    version,
  } = useStore();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';
  // `version` fuerza recalcular tras crear una oposicion.
  void version;
  const oppositions = currentUser
    ? store.oppositions.listForUser(currentUser)
    : [];

  const create = () => {
    if (!currentUser) return;
    setError(null);
    try {
      const opposition = store.oppositions.createOpposition(currentUser, {
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
        title="Mis oposiciones"
        subtitle={`Hola, ${currentUser?.name}. Elige una oposicion para entrar.`}
        action={
          <Button variant="secondary" onClick={logout}>
            Salir
          </Button>
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
              ? 'Todavia no gestionas ninguna oposicion. Crea la primera.'
              : 'Aun no tienes acceso a ninguna oposicion. Pide acceso a un administrador.'
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
