import { useState } from 'react';
import { AppLayout, type Section } from './components/AppLayout.js';
import { LoginPage } from './pages/LoginPage.js';
import { WorkspacesGate } from './pages/WorkspacesGate.js';
import { OppositionsGate } from './pages/OppositionsGate.js';
import { ZoneChooser } from './pages/ZoneChooser.js';
import { HomePage } from './pages/HomePage.js';
import { MaterialPage } from './pages/MaterialPage.js';
import { TopicPage } from './pages/TopicPage.js';
import { QuestionsPage } from './pages/QuestionsPage.js';
import { OppositionAIPanel } from './pages/OppositionAIPanel.js';
import { TestsPage } from './pages/TestsPage.js';
import { AlumnosPage } from './pages/AlumnosPage.js';
import { ResultadosPage } from './pages/ResultadosPage.js';
import { ResetPasswordPage } from './pages/ResetPasswordPage.js';
import { AccountPage } from './pages/AccountPage.js';
import { isSupabaseConfigured } from './auth/supabaseClient.js';
import { LoadingState } from './components/ui.js';
import { useStore, type Zone } from './store/StoreContext.js';

// El enlace de recuperacion de Supabase vuelve con `type=recovery` en el hash.
function isRecoveryRedirect(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.location.hash.includes('type=recovery')
  );
}

export function App() {
  const {
    currentUser,
    currentWorkspace,
    currentOpposition,
    isWorkspaceManager,
    canStudy,
    accessReady,
    zone,
    selectZone,
  } = useStore();

  // Restablecer contrasena: si venimos de un enlace de recuperacion, esta
  // pantalla tiene prioridad sobre todo lo demas.
  if (isSupabaseConfigured() && isRecoveryRedirect()) {
    return <ResetPasswordPage />;
  }

  if (!currentUser) {
    return <LoginPage />;
  }
  if (!currentWorkspace) {
    return <WorkspacesGate />;
  }
  // Esperar a que se resuelvan rol/acceso del workspace (async, SPEC 018.3).
  if (!accessReady) {
    return <LoadingState />;
  }

  // Redireccion inicial por rol (SPEC 014, 13): si solo puede una cosa, entra
  // directo; si puede gestionar Y estudiar, elige zona; el gestor puro va a
  // administracion, el estudiante a estudio.
  const canManage = isWorkspaceManager;
  const effectiveZone: Zone | null =
    zone ??
    (canManage && canStudy ? null : canManage ? 'admin' : canStudy ? 'student' : null);

  // Sin rol util en este workspace (ni gestor ni matricula): nada que mostrar.
  if (!canManage && !canStudy) {
    return <OppositionsGate zone="student" />;
  }
  if (!effectiveZone) {
    return <ZoneChooser />;
  }

  const switchZone = () => {
    // Cambiar de zona remonta el shell (key por zona): la seccion vuelve al
    // destino por defecto de la nueva zona (admin -> material, alumno -> inicio).
    selectZone(effectiveZone === 'admin' ? 'student' : 'admin');
  };

  if (!currentOpposition) {
    return <OppositionsGate zone={effectiveZone} />;
  }

  // El shell se remonta al cambiar de zona u oposicion (SPEC 029): asi la
  // navegacion vuelve a su destino por defecto y recarga datos sin reload.
  return (
    <AppShell
      key={`${effectiveZone}:${currentOpposition.id}`}
      zone={effectiveZone}
      canSwitchZone={canManage && canStudy}
      onSwitchZone={switchZone}
    />
  );
}

// Shell de navegacion (SPEC 029). Mantiene la seccion activa y una "revision" de
// navegacion: al pulsar una seccion (o un CTA que apunta a una seccion), aunque
// ya este activa, se incrementa `navRev` y el contenido se remonta (key), de
// modo que la seccion vuelve a su vista raiz y recarga sus datos. NO repite
// mutaciones (eso son otros botones). El alumno conserva `Inicio`; el admin no
// tiene `Resumen` y entra por `Material`.
function AppShell({
  zone,
  canSwitchZone,
  onSwitchZone,
}: {
  zone: Zone;
  canSwitchZone: boolean;
  onSwitchZone: () => void;
}) {
  const isAdminZone = zone === 'admin';
  const [section, setSection] = useState<Section>(
    isAdminZone ? 'material' : 'inicio',
  );
  const [navRev, setNavRev] = useState(0);
  const [showAccount, setShowAccount] = useState(false);

  const navigate = (s: Section) => {
    setShowAccount(false);
    setSection(s);
    setNavRev((r) => r + 1); // siempre: re-entrar en la seccion activa la reinicia
  };

  return (
    <AppLayout
      zone={zone}
      active={section}
      onNavigate={navigate}
      canSwitchZone={canSwitchZone}
      onSwitchZone={onSwitchZone}
      onOpenAccount={() => setShowAccount(true)}
    >
      {showAccount ? (
        <AccountPage onBack={() => setShowAccount(false)} />
      ) : (
        <div key={`${section}-${navRev}`}>
          {section === 'inicio' && !isAdminZone && (
            <HomePage onNavigate={navigate} isAdmin={isAdminZone} />
          )}
          {section === 'material' && <MaterialPage isAdmin={isAdminZone} />}
          {section === 'temario' && isAdminZone && <TopicPage onNavigate={navigate} />}
          {section === 'preguntas' && isAdminZone && <QuestionsPage />}
          {section === 'ia' && isAdminZone && <OppositionAIPanel />}
          {section === 'alumnos' && isAdminZone && <AlumnosPage />}
          {section === 'tests' && <TestsPage />}
          {section === 'resultados' && !isAdminZone && <ResultadosPage />}
        </div>
      )}
    </AppLayout>
  );
}
