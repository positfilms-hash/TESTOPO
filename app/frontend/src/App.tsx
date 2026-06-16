import { useState } from 'react';
import { AppLayout, type Section } from './components/AppLayout.js';
import { HomePage } from './pages/HomePage.js';
import { MaterialPage } from './pages/MaterialPage.js';
import { TopicPage } from './pages/TopicPage.js';
import { QuestionsPage } from './pages/QuestionsPage.js';
import { TestsPage } from './pages/TestsPage.js';

export function App() {
  const [section, setSection] = useState<Section>('inicio');

  return (
    <AppLayout active={section} onNavigate={setSection}>
      {section === 'inicio' && <HomePage onNavigate={setSection} />}
      {section === 'material' && <MaterialPage />}
      {section === 'temario' && <TopicPage />}
      {section === 'preguntas' && <QuestionsPage />}
      {section === 'tests' && <TestsPage />}
    </AppLayout>
  );
}
