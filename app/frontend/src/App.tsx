import { useState } from 'react';
import { AppLayout, type Section } from './components/AppLayout.js';
import { LoginPage } from './pages/LoginPage.js';
import { WorkspacesGate } from './pages/WorkspacesGate.js';
import { OppositionsGate } from './pages/OppositionsGate.js';
import { HomePage } from './pages/HomePage.js';
import { MaterialPage } from './pages/MaterialPage.js';
import { TopicPage } from './pages/TopicPage.js';
import { QuestionsPage } from './pages/QuestionsPage.js';
import { TestsPage } from './pages/TestsPage.js';
import { useStore } from './store/StoreContext.js';

export function App() {
  const { currentUser, currentWorkspace, currentOpposition, isWorkspaceManager } =
    useStore();
  const [section, setSection] = useState<Section>('inicio');

  if (!currentUser) {
    return <LoginPage />;
  }
  if (!currentWorkspace) {
    return <WorkspacesGate />;
  }
  if (!currentOpposition) {
    return <OppositionsGate />;
  }

  // Las capacidades se deciden por el ROL DE WORKSPACE (owner/admin gestionan),
  // no por el User.role global: asi el owner Premium gestiona su propio pool.
  return (
    <AppLayout
      active={section}
      onNavigate={setSection}
      isManager={isWorkspaceManager}
    >
      {section === 'inicio' && <HomePage onNavigate={setSection} />}
      {section === 'material' && <MaterialPage />}
      {section === 'temario' && isWorkspaceManager && <TopicPage />}
      {section === 'preguntas' && isWorkspaceManager && <QuestionsPage />}
      {section === 'tests' && <TestsPage />}
    </AppLayout>
  );
}
