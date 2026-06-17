import { useEffect, useState } from 'react';
import { useStore } from '../store/StoreContext.js';
import { Badge, Button, EmptyState, Field, PageHeader } from '../components/ui.js';

// Gestion de alumnos de la oposicion (SPEC 014, zona admin): dar y quitar
// acceso de estudio. Reutiliza OppositionService (acceso/matricula) y la lista
// de miembros del workspace; toda la regla real vive en backend/servicios.
interface Person {
  user_id: string;
  name: string;
  status?: string;
}

export function AlumnosPage() {
  const { store, currentUser, currentWorkspace, currentOpposition, refresh, version } =
    useStore();
  const [error, setError] = useState<string | null>(null);
  const [activeStudents, setActiveStudents] = useState<Person[]>([]);
  const [candidates, setCandidates] = useState<Person[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!currentUser || !currentWorkspace || !currentOpposition) {
        return;
      }
      const nameOf = async (userId: string) => {
        const u = await store.users.getUser(userId);
        return u ? `${u.name} · ${u.email}` : userId;
      };
      const access = await safe(() =>
        store.oppositions.listStudents(currentUser, currentOpposition.id),
      );
      const members = await safe(() =>
        store.workspaces.listMembers(currentUser, currentWorkspace.id),
      );
      const active = (access ?? []).filter((a) => a.status === 'active');
      const cand = (members ?? []).filter(
        (m) =>
          m.role === 'student' &&
          m.status === 'active' &&
          !active.some((a) => a.user_id === m.user_id),
      );
      const students: Person[] = [];
      for (const a of active) {
        students.push({ user_id: a.user_id, name: await nameOf(a.user_id), status: a.status });
      }
      const cands: Person[] = [];
      for (const m of cand) {
        cands.push({ user_id: m.user_id, name: await nameOf(m.user_id) });
      }
      if (!cancelled) {
        setActiveStudents(students);
        setCandidates(cands);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store, currentUser, currentWorkspace, currentOpposition, version]);

  if (!currentUser || !currentWorkspace || !currentOpposition) {
    return <EmptyState message="Selecciona una oposicion para gestionar alumnos." />;
  }

  const grant = async (userId: string) => {
    setError(null);
    try {
      await store.oppositions.grantAccess(currentUser, {
        user_id: userId,
        opposition_id: currentOpposition.id,
      });
      refresh();
    } catch {
      setError('No se pudo dar acceso.');
    }
  };

  const revoke = async (userId: string) => {
    setError(null);
    try {
      await store.oppositions.revokeAccess(currentUser, {
        user_id: userId,
        opposition_id: currentOpposition.id,
      });
      refresh();
    } catch {
      setError('No se pudo revocar el acceso.');
    }
  };

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
                <strong>{a.name}</strong>
                <div className="muted small">Acceso de estudio</div>
              </div>
              <div className="row">
                <Badge status={a.status ?? 'active'} />
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
              <strong>{m.name}</strong>
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

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}
