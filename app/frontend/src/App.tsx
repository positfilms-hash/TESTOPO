import { useState } from 'react';
import { AppLayout, type Section } from './components/AppLayout.js';
import { LoginPage } from './pages/LoginPage.js';
import { OppositionsGate } from './pages/OppositionsGate.js';
import { HomePage } from './pages/HomePage.js';
import { MaterialPage } from './pages/MaterialPage.js';
import { TopicPage } from './pages/TopicPage.js';
import { QuestionsPage } from './pages/QuestionsPage.js';
import { TestsPage } from './pages/TestsPage.js';
import { useStore } from './store/StoreContext.js';

export function App() {
  const { currentUser, currentOpposition } = useStore();
  const [section, setSection] = useState<Section>('inicio');

  if (!currentUser) {
    return <LoginPage />;
  }
  if (!currentOpposition) {
    return <OppositionsGate />;
  }

  const isAdmin = currentUser.role === 'admin';

  return (
    <AppLayout active={section} onNavigate={setSection} isAdmin={isAdmin}>
      {section === 'inicio' && <HomePage onNavigate={setSection} />}
      {section === 'material' && <MaterialPage />}
      {section === 'temario' && isAdmin && <TopicPage />}
      {section === 'preguntas' && isAdmin && <QuestionsPage />}
      {section === 'tests' && <TestsPage />}
    </AppLayout>
  );
}
