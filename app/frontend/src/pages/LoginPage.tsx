import { useState } from 'react';
import type { User } from '@backend';
import { useStore } from '../store/StoreContext.js';
import { SEED_ADMIN, SEED_STUDENT } from '../store/appStore.js';
import { Button, Field } from '../components/ui.js';
import { isSupabaseConfigured } from '../auth/supabaseClient.js';
import { AuthError, authMessage, AuthErrorCode } from '../auth/authErrors.js';
import * as auth from '../auth/authService.js';
import {
  validateLogin,
  validateRegister,
} from '../auth/authValidation.js';

type Mode = 'login' | 'register' | 'forgot';

export function LoginPage() {
  const { store, login } = useStore();
  const configured = isSupabaseConfigured();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setError(null);
    setInfo(null);
  };

  // Tras un login real, mapea el perfil de Supabase al `User` de sesion que ya
  // usa el resto de la app (Fase 0: identidad real, dominio en memoria).
  const bridgeSupabaseSession = async () => {
    const profile = await auth.getCurrentProfile();
    if (!profile) {
      throw new AuthError([AuthErrorCode.SESSION_REQUIRED]);
    }
    const user: User = {
      id: profile.id,
      name: profile.name ?? profile.email,
      email: profile.email,
      password_hash: '',
      role: profile.role,
      status: profile.status === 'deleted' ? 'inactive' : profile.status,
      created_at: new Date(),
      updated_at: new Date(),
    };
    login(user);
  };

  const submitLogin = async () => {
    reset();
    const codes = validateLogin({ email, password });
    if (codes.length > 0) {
      setError(authMessage(codes[0]!));
      return;
    }
    setBusy(true);
    try {
      if (configured) {
        await auth.login(email, password);
        await bridgeSupabaseSession();
      } else {
        // Modo demo (sin Supabase): autenticacion en memoria.
        login(store.users.authenticate(email, password));
      }
    } catch (err) {
      setError(
        err instanceof AuthError
          ? authMessage(err.codes[0]!)
          : 'Email o contrasena incorrectos.',
      );
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async () => {
    reset();
    const codes = validateRegister({ name, email, password, confirmPassword: confirm });
    if (codes.length > 0) {
      setError(authMessage(codes[0]!));
      return;
    }
    if (!configured) {
      setError(authMessage(AuthErrorCode.SUPABASE_NOT_CONFIGURED));
      return;
    }
    setBusy(true);
    try {
      await auth.register({ name, email, password });
      setInfo('Cuenta creada correctamente. Revisa tu email si se requiere confirmacion e inicia sesion.');
      setMode('login');
    } catch (err) {
      setError(err instanceof AuthError ? authMessage(err.codes[0]!) : 'No se pudo crear la cuenta.');
    } finally {
      setBusy(false);
    }
  };

  const submitForgot = async () => {
    reset();
    if (!email.trim()) {
      setError(authMessage(AuthErrorCode.EMAIL_REQUIRED));
      return;
    }
    if (!configured) {
      setError(authMessage(AuthErrorCode.SUPABASE_NOT_CONFIGURED));
      return;
    }
    setBusy(true);
    try {
      await auth.requestPasswordReset(email, window.location.origin);
    } catch {
      // No revelamos si fallo: mensaje neutral igualmente.
    } finally {
      // Mensaje neutral: no revela si el email existe (SPEC 018.2, 16).
      setInfo('Si existe una cuenta con ese email, recibiras un enlace para restablecer tu contrasena.');
      setBusy(false);
    }
  };

  const demoLogin = (mail: string, pass: string) => {
    reset();
    try {
      login(store.users.authenticate(mail, pass));
    } catch {
      setError('No se pudo entrar en la demo.');
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '72px auto' }}>
      <div className="brand" style={{ textAlign: 'center', fontSize: '2rem' }}>
        TESTOPO
      </div>
      <p className="muted" style={{ textAlign: 'center' }}>
        {mode === 'register'
          ? 'Crea tu cuenta para preparar tus oposiciones.'
          : mode === 'forgot'
            ? 'Te enviaremos un enlace para restablecer tu contrasena.'
            : 'Entra para preparar tus oposiciones.'}
      </p>

      <div className="card">
        {error && <div className="notice error">{error}</div>}
        {info && <div className="notice success">{info}</div>}

        {mode === 'register' && (
          <Field label="Nombre">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
          </Field>
        )}

        {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
          <Field label="Email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
          </Field>
        )}

        {(mode === 'login' || mode === 'register') && (
          <Field label="Contrasena">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        )}

        {mode === 'register' && (
          <Field label="Confirmar contrasena">
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
        )}

        {mode === 'login' && (
          <Button onClick={submitLogin} disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </Button>
        )}
        {mode === 'register' && (
          <Button onClick={submitRegister} disabled={busy}>
            {busy ? 'Creando…' : 'Crear cuenta'}
          </Button>
        )}
        {mode === 'forgot' && (
          <Button onClick={submitForgot} disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar enlace'}
          </Button>
        )}

        <div className="small" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {mode !== 'login' && (
            <button className="nav-item small" onClick={() => { reset(); setMode('login'); }}>
              Volver a iniciar sesion
            </button>
          )}
          {mode === 'login' && (
            <>
              <button className="nav-item small" onClick={() => { reset(); setMode('register'); }}>
                ¿No tienes cuenta? Crear cuenta
              </button>
              <button className="nav-item small" onClick={() => { reset(); setMode('forgot'); }}>
                ¿Has olvidado la contrasena?
              </button>
            </>
          )}
        </div>

        {!configured && (
          <div className="small muted" style={{ marginTop: 8 }}>
            Auth real no configurada: usa el acceso demo de abajo (datos en memoria).
          </div>
        )}
      </div>

      <div className="card">
        <div className="small muted" style={{ marginBottom: 8 }}>
          Acceso rapido a la demo (sin Supabase):
        </div>
        <div className="row">
          <Button variant="secondary" small onClick={() => demoLogin(SEED_ADMIN.email, SEED_ADMIN.password)}>
            Entrar como Admin
          </Button>
          <Button variant="secondary" small onClick={() => demoLogin(SEED_STUDENT.email, SEED_STUDENT.password)}>
            Entrar como Estudiante
          </Button>
        </div>
      </div>
    </div>
  );
}
