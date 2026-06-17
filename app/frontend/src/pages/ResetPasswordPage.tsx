import { useState } from 'react';
import { Button, Field } from '../components/ui.js';
import { AuthError, authMessage } from '../auth/authErrors.js';
import { validateNewPassword } from '../auth/authValidation.js';
import * as auth from '../auth/authService.js';

// Restablecer contrasena (SPEC 018.2, 17). Se muestra cuando Supabase redirige
// con un enlace de recuperacion (la sesion de recovery ya esta activa).
export function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    const codes = validateNewPassword({ password, confirmPassword: confirm });
    if (codes.length > 0) {
      setError(authMessage(codes[0]!));
      return;
    }
    setBusy(true);
    try {
      await auth.updatePassword(password);
      setDone(true);
    } catch (err) {
      setError(err instanceof AuthError ? authMessage(err.codes[0]!) : 'No se pudo actualizar la contrasena.');
    } finally {
      setBusy(false);
    }
  };

  const goToLogin = () => {
    window.location.hash = '';
    window.location.reload();
  };

  return (
    <div style={{ maxWidth: 420, margin: '72px auto' }}>
      <div className="brand" style={{ textAlign: 'center', fontSize: '2rem' }}>
        TESTOPO
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Restablecer contrasena</h2>
        {done ? (
          <>
            <div className="notice success">
              Tu contrasena se ha actualizado correctamente.
            </div>
            <Button onClick={goToLogin}>Ir a iniciar sesion</Button>
          </>
        ) : (
          <>
            {error && <div className="notice error">{error}</div>}
            <Field label="Nueva contrasena">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label="Confirmar nueva contrasena">
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            <Button onClick={submit} disabled={busy}>
              {busy ? 'Guardando…' : 'Actualizar contrasena'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
