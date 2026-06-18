import { useEffect, useState } from 'react';
import { useStore } from '../store/StoreContext.js';
import { Button, PageHeader } from '../components/ui.js';
import { isSupabaseConfigured } from '../auth/supabaseClient.js';
import { AuthError, authMessage, AuthErrorCode } from '../auth/authErrors.js';
import * as auth from '../auth/authService.js';
import { ACCOUNT_DELETE_CONFIRMATION } from '../auth/authService.js';
import {
  findBlockingWorkspaces,
  type WorkspaceOwnership,
} from '../auth/accountDeletion.js';

// Cuenta y eliminacion (SPEC 026). El borrado real (revocar accesos, archivar
// workspace personal, soft-delete del perfil y borrar el usuario Auth) lo ejecuta
// la Edge Function `delete-account` con la service role en servidor. Aqui solo se
// confirma (escribir ELIMINAR) y se invoca la funcion.
export function AccountPage({ onBack }: { onBack: () => void }) {
  const { store, currentUser, logout } = useStore();
  const [confirmText, setConfirmText] = useState('');
  const confirmed = confirmText.trim() === ACCOUNT_DELETE_CONFIRMATION;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [ownership, setOwnership] = useState<WorkspaceOwnership[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!currentUser) {
        if (!cancelled) setOwnership([]);
        return;
      }
      const workspaces = await store.workspaces.listForUser(currentUser);
      const result: WorkspaceOwnership[] = [];
      for (const ws of workspaces) {
        let owners: string[] = [];
        let admins: string[] = [];
        try {
          const members = await store.workspaces.listMembers(currentUser, ws.id);
          owners = members
            .filter((m) => m.role === 'owner' && m.status === 'active')
            .map((m) => m.user_id);
          admins = members
            .filter((m) => m.role === 'admin' && m.status === 'active')
            .map((m) => m.user_id);
        } catch {
          // Sin permiso para listar miembros: no es un workspace que gestione.
        }
        result.push({ id: ws.id, type: ws.type, ownerIds: owners, adminIds: admins });
      }
      if (!cancelled) setOwnership(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [store, currentUser]);

  if (!currentUser) {
    return null;
  }

  const isBlocked = findBlockingWorkspaces(currentUser.id, ownership).length > 0;

  const deleteAccount = async () => {
    setError(null);
    if (!confirmed) {
      setError(authMessage(AuthErrorCode.ACCOUNT_DELETE_CONFIRMATION_REQUIRED));
      return;
    }
    if (isBlocked) {
      setError(authMessage(AuthErrorCode.ACCOUNT_DELETE_WORKSPACE_OWNER_BLOCKED));
      return;
    }
    if (!isSupabaseConfigured()) {
      setError(authMessage(AuthErrorCode.SUPABASE_NOT_CONFIGURED));
      return;
    }
    setBusy(true);
    try {
      await auth.requestAccountDeletion({
        userId: currentUser.id,
        confirmed: true,
        workspaces: ownership,
      });
      logout();
    } catch (err) {
      setError(err instanceof AuthError ? authMessage(err.codes[0]!) : 'No se pudo eliminar la cuenta.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Cuenta"
        subtitle={currentUser.email}
        action={
          <Button variant="secondary" onClick={onBack}>
            Volver
          </Button>
        }
      />

      <div className="card" style={{ maxWidth: 560 }}>
        <h3 style={{ marginTop: 0 }}>Eliminar cuenta</h3>
        <p className="muted small">
          Esta accion no se puede deshacer. Si perteneces a una academia, perderas
          el acceso a tus oposiciones. Si eres el unico propietario de un
          workspace, debes transferirlo antes. Algunos datos (como resultados de
          tests) pueden conservarse de forma anonimizada por integridad historica.
        </p>

        {error && <div className="notice error">{error}</div>}

        {isBlocked && (
          <div className="notice error">
            No puedes eliminar tu cuenta porque eres el unico propietario de un
            workspace. Anade o transfiere la propiedad a otro usuario antes de
            eliminarla.
          </div>
        )}

        <label className="small" style={{ display: 'block', marginBottom: 12 }}>
          Escribe <strong>{ACCOUNT_DELETE_CONFIRMATION}</strong> para confirmar:
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={isBlocked}
            placeholder={ACCOUNT_DELETE_CONFIRMATION}
            aria-label="Confirmacion de eliminacion"
            style={{ display: 'block', marginTop: 4 }}
          />
        </label>

        <Button variant="danger" onClick={deleteAccount} disabled={busy || isBlocked || !confirmed}>
          {busy ? 'Eliminando…' : 'Eliminar mi cuenta'}
        </Button>
      </div>
    </div>
  );
}
