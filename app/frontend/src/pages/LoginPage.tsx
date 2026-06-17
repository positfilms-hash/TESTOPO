import { useState } from 'react';
import { useStore } from '../store/StoreContext.js';
import { SEED_ADMIN, SEED_STUDENT } from '../store/appStore.js';
import { Button, Field } from '../components/ui.js';

export function LoginPage() {
  const { store, login } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (mail: string, pass: string) => {
    setError(null);
    try {
      login(store.users.authenticate(mail, pass));
    } catch {
      setError('Credenciales no validas.');
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '80px auto' }}>
      <div className="brand" style={{ textAlign: 'center', fontSize: '2rem' }}>
        TESTOPO
      </div>
      <p className="muted" style={{ textAlign: 'center' }}>
        Entra para preparar tus oposiciones.
      </p>
      <div className="card">
        {error && <div className="notice error">{error}</div>}
        <Field label="Email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
        </Field>
        <Field label="Contrasena">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button onClick={() => submit(email, password)}>Entrar</Button>
      </div>
      <div className="card">
        <div className="small muted" style={{ marginBottom: 8 }}>
          Acceso rapido a la demo:
        </div>
        <div className="row">
          <Button
            variant="secondary"
            small
            onClick={() => submit(SEED_ADMIN.email, SEED_ADMIN.password)}
          >
            Entrar como Admin
          </Button>
          <Button
            variant="secondary"
            small
            onClick={() => submit(SEED_STUDENT.email, SEED_STUDENT.password)}
          >
            Entrar como Estudiante
          </Button>
        </div>
      </div>
    </div>
  );
}
