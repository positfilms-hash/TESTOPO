import { useState } from 'react';
import { useStore } from '../store/StoreContext.js';
import { Button, PageHeader } from '../components/ui.js';
import { isSupabaseConfigured } from '../auth/supabaseClient.js';
import { AuthError, authMessage, AuthErrorCode } from '../auth/authErrors.js';
import * as auth from '../auth/authService.js';
import {
  findBlockingWorkspaces,
  type WorkspaceOwnership,
} from '../auth/accountDeletion.js';

// Cuenta y eliminacion (SPEC 018.2, 18-19). Borrado LOGICO en el MVP, con la
// regla de no dejar un workspace de organizacion sin owner/admin.
export function AccountPage({ onBack }: { onBack: () => void }) {
  const { store, currentUser, logout } = useStore();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!currentUser) {
    return null;
  }

  // Propiedad de workspaces del usuario (para la regla de borrado).
  const ownership: WorkspaceOwnership[] = store.workspaces
    .listForUser(currentUser)
    .map((ws) => {
      let owners: string[] = [];
      let admins: string[] = [];
      try {
        const members = store.workspaces.listMembers(currentUser, ws.id);
        owners = members.filter((m) => m.role === 'owner' && m.status === 'active').map((m) => m.user_id);
        admins = members.filter((m) => m.role === 'admin' && m.status === 'active').map((m) => m.user_id);
      } catch {
        // Sin permiso para listar miembros: no es un workspace que el usuario gestione.
      }
      return { id: ws.id, type: ws.type, ownerIds: owners, adminIds: admins };
    });
  const blocking = findBlockingWorkspaces(currentUser.id, ownership);
  const isBlocked = blocking.length > 0;

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
          Esta accion eliminara tu cuenta. Puede que algunos datos asociados se
          conserven de forma anonimizada o por motivos tecnicos. Esta accion no
          se puede deshacer.
        </p>

        {error && <div className="notice error">{error}</div>}

        {isBlocked && (
          <div className="notice error">
            No puedes eliminar tu cuenta porque eres el unico propietario de un
            workspace. Anade otro propietario o administrador antes.
          </div>
        )}

        <label className="row small" style={{ gap: 8, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={isBlocked}
          />
          Confirmo que quiero eliminar mi cuenta.
        </label>

        <Button variant="danger" onClick={deleteAccount} disabled={busy || isBlocked || !confirmed}>
          {busy ? 'Eliminando…' : 'Eliminar cuenta'}
        </Button>
      </div>
    </div>
  );
}
