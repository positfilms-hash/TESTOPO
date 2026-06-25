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
import { LoadingState, ErrorState } from './components/ui.js';
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
    currentOpposition,
    isWorkspaceManager,
    canStudy,
    effectiveZone,
    phase,
    selectZone,
  } = useStore();

  // Restablecer contrasena: si venimos de un enlace de recuperacion, esta
  // pantalla tiene prioridad sobre todo lo demas.
  if (isSupabaseConfigured() && isRecoveryRedirect()) {
    return <ResetPasswordPage />;
  }

  // SPEC 036: la maquina de rehidratacion decide la pantalla. NUNCA se muestra
  // Login ni una pagina vacia mientras el contexto se esta resolviendo.
  switch (phase) {
    case 'booting':
      return <LoadingState message="Cargando sesión…" />;
    case 'error':
      return (
        <ErrorState message="No se pudo cargar tu sesión. Recarga la página o vuelve a iniciar sesión." />
      );
    case 'signed_out':
      return <LoginPage />;
    case 'loading_workspaces':
      return <LoadingState message="Preparando tu espacio…" />;
    case 'selecting_workspace':
      return <WorkspacesGate />;
    case 'resolving_access':
      return <LoadingState message="Preparando tu espacio…" />;
    case 'no_access':
      // Workspace sin rol util (ni gestion ni matricula): gate de estudio vacio.
      return <OppositionsGate zone="student" />;
    case 'selecting_zone':
      return <ZoneChooser />;
    case 'loading_oppositions':
      return <LoadingState message="Cargando oposición…" />;
    case 'selecting_opposition':
      return <OppositionsGate zone={(effectiveZone ?? 'student') as Zone} />;
    case 'ready':
      break;
  }

  // phase === 'ready': hay usuario, workspace, zona efectiva y oposicion validos.
  const zoneForShell = (effectiveZone ?? 'student') as Zone;
  const switchZone = () => {
    // Cambiar de zona remonta el shell (key por zona): la seccion vuelve al
    // destino por defecto de la nueva zona (admin -> material, alumno -> inicio).
    selectZone(zoneForShell === 'admin' ? 'student' : 'admin');
  };

  // El shell se remonta al cambiar de zona u oposicion (SPEC 029): asi la
  // navegacion vuelve a su destino por defecto y recarga datos sin reload.
  return (
    <AppShell
      key={`${zoneForShell}:${currentOpposition?.id ?? ''}`}
      zone={zoneForShell}
      canSwitchZone={isWorkspaceManager && canStudy}
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
          {section === 'preguntas' && isAdminZone && <QuestionsPage onNavigate={navigate} />}
          {section === 'ia' && isAdminZone && <OppositionAIPanel />}
          {section === 'alumnos' && isAdminZone && <AlumnosPage />}
          {section === 'tests' && <TestsPage />}
          {section === 'resultados' && !isAdminZone && <ResultadosPage />}
        </div>
      )}
    </AppLayout>
  );
}
