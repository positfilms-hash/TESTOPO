import { useState } from 'react';
import { useStore } from '../store/StoreContext.js';
import { Badge, Button, EmptyState, Field, PageHeader } from '../components/ui.js';

// Gestion de alumnos de la oposicion (SPEC 014, zona admin): dar y quitar
// acceso de estudio. Reutiliza OppositionService (acceso/matricula) y la lista
// de miembros del workspace; toda la regla real vive en backend/servicios.
export function AlumnosPage() {
  const { store, currentUser, currentWorkspace, currentOpposition, refresh, version } =
    useStore();
  const [error, setError] = useState<string | null>(null);
  void version;

  if (!currentUser || !currentWorkspace || !currentOpposition) {
    return <EmptyState message="Selecciona una oposicion para gestionar alumnos." />;
  }

  const access = safe(() =>
    store.oppositions.listStudents(currentUser, currentOpposition.id),
  );
  const grantedIds = new Set((access ?? []).map((a) => a.user_id));
  const members = safe(() =>
    store.workspaces.listMembers(currentUser, currentWorkspace.id),
  );
  // Candidatos: miembros del workspace con rol student y sin acceso activo aun.
  const candidates = (members ?? []).filter(
    (m) =>
      m.role === 'student' &&
      m.status === 'active' &&
      !(access ?? []).some((a) => a.user_id === m.user_id && a.status === 'active'),
  );

  const grant = (userId: string) => {
    setError(null);
    try {
      store.oppositions.grantAccess(currentUser, {
        user_id: userId,
        opposition_id: currentOpposition.id,
      });
      refresh();
    } catch {
      setError('No se pudo dar acceso.');
    }
  };

  const revoke = (userId: string) => {
    setError(null);
    try {
      store.oppositions.revokeAccess(currentUser, {
        user_id: userId,
        opposition_id: currentOpposition.id,
      });
      refresh();
    } catch {
      setError('No se pudo revocar el acceso.');
    }
  };

  const nameOf = (userId: string) => {
    const u = store.users.getUser(userId);
    return u ? `${u.name} · ${u.email}` : userId;
  };

  const activeStudents = (access ?? []).filter((a) => a.status === 'active');

  return (
    <div>
      <PageHeader
        title="Alumnos"
        subtitle="Da acceso de estudio a los miembros de tu espacio."
      />
      {error && <div className="notice error">{error}</div>}

      <h3>Con acceso</h3>
      {activeStudents.length === 0 ? (
        <EmptyState message="Todavia no has dado acceso a ningun alumno." />
      ) : (
        activeStudents.map((a) => (
          <div className="card" key={a.user_id}>
            <div className="row spread">
              <div>
                <strong>{nameOf(a.user_id)}</strong>
                <div className="muted small">Acceso de estudio</div>
              </div>
              <div className="row">
                <Badge status={a.status} />
                <Button variant="danger" small onClick={() => revoke(a.user_id)}>
                  Quitar acceso
                </Button>
              </div>
            </div>
          </div>
        ))
      )}

      <h3>Dar acceso</h3>
      {candidates.length === 0 ? (
        <Field label="">
          <span className="muted small">
            No hay miembros pendientes de dar acceso en este espacio.
          </span>
        </Field>
      ) : (
        candidates.map((m) => (
          <div className="card" key={m.user_id}>
            <div className="row spread">
              <strong>{nameOf(m.user_id)}</strong>
              <Button small onClick={() => grant(m.user_id)}>
                Dar acceso
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
