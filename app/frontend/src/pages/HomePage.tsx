import { useStore } from '../store/StoreContext.js';
import { Button, PageHeader } from '../components/ui.js';
import type { Section } from '../components/AppLayout.js';

export function HomePage({ onNavigate }: { onNavigate: (s: Section) => void }) {
  const { store } = useStore();
  const materials = store.materials.listMaterials();
  const questions = store.questions.listQuestions();
  const pending = questions.filter((q) =>
    ['draft', 'pending_review', 'needs_fix'].includes(q.status),
  ).length;
  const validated = questions.filter((q) => q.status === 'validated').length;

  const stats = [
    { label: 'Materiales', value: materials.length },
    { label: 'Pendientes de revisar', value: pending },
    { label: 'Preguntas validadas', value: validated },
    { label: 'Tests creados', value: store.createdTests.length },
  ];

  const steps: { title: string; text: string; cta: string; to: Section }[] = [
    {
      title: '1. Anade material',
      text: 'Sube o pega tus temarios, leyes y apuntes.',
      cta: 'Ir a Material',
      to: 'material',
    },
    {
      title: '2. Organiza el temario',
      text: 'Estructura los temas y apartados.',
      cta: 'Ir a Temario',
      to: 'temario',
    },
    {
      title: '3. Revisa preguntas',
      text: 'Genera borradores y aprueba las buenas.',
      cta: 'Ir a Preguntas',
      to: 'preguntas',
    },
    {
      title: '4. Crea un test',
      text: 'Practica con preguntas validadas.',
      cta: 'Ir a Tests',
      to: 'tests',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Prepara tus oposiciones"
        subtitle="Crea tests fiables a partir de tu material, paso a paso."
      />

      <div className="card-grid" style={{ marginBottom: 24 }}>
        {stats.map((s) => (
          <div className="card" key={s.label}>
            <div className="stat">{s.value}</div>
            <div className="muted small">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card-grid">
        {steps.map((step) => (
          <div className="card" key={step.to}>
            <h3 style={{ marginTop: 0 }}>{step.title}</h3>
            <p className="muted">{step.text}</p>
            <Button variant="secondary" small onClick={() => onNavigate(step.to)}>
              {step.cta}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
