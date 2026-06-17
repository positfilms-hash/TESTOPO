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
import { TestsPage } from './pages/TestsPage.js';
import { AlumnosPage } from './pages/AlumnosPage.js';
import { ResultadosPage } from './pages/ResultadosPage.js';
import { useStore, type Zone } from './store/StoreContext.js';

export function App() {
  const {
    currentUser,
    currentWorkspace,
    currentOpposition,
    isWorkspaceManager,
    canStudy,
    zone,
    selectZone,
  } = useStore();
  const [section, setSection] = useState<Section>('inicio');

  if (!currentUser) {
    return <LoginPage />;
  }
  if (!currentWorkspace) {
    return <WorkspacesGate />;
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
    selectZone(effectiveZone === 'admin' ? 'student' : 'admin');
    setSection('inicio');
  };

  if (!currentOpposition) {
    return <OppositionsGate zone={effectiveZone} />;
  }

  const isAdminZone = effectiveZone === 'admin';
  return (
    <AppLayout
      zone={effectiveZone}
      active={section}
      onNavigate={setSection}
      canSwitchZone={canManage && canStudy}
      onSwitchZone={switchZone}
    >
      {section === 'inicio' && (
        <HomePage onNavigate={setSection} isAdmin={isAdminZone} />
      )}
      {section === 'material' && <MaterialPage isAdmin={isAdminZone} />}
      {section === 'temario' && isAdminZone && <TopicPage />}
      {section === 'preguntas' && isAdminZone && <QuestionsPage />}
      {section === 'alumnos' && isAdminZone && <AlumnosPage />}
      {section === 'tests' && <TestsPage />}
      {section === 'resultados' && !isAdminZone && <ResultadosPage />}
    </AppLayout>
  );
}
