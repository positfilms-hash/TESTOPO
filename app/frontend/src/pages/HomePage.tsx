import { useEffect, useState } from 'react';
import type { MyResultSummary } from '@backend';
import { useStore } from '../store/StoreContext.js';
import { Button, EmptyState, PageHeader } from '../components/ui.js';
import type { Section } from '../components/AppLayout.js';

export function HomePage({
  onNavigate,
  isAdmin,
}: {
  onNavigate: (s: Section) => void;
  isAdmin: boolean;
}) {
  return isAdmin ? (
    <AdminHome onNavigate={onNavigate} />
  ) : (
    <StudentHome onNavigate={onNavigate} />
  );
}

// Inicio del estudiante (SPEC 013, 9): accion principal "Crear test", accesos
// a material y resultados, ultimos resultados y aviso si no hay preguntas.
function StudentHome({ onNavigate }: { onNavigate: (s: Section) => void }) {
  const { store, currentUser, currentWorkspace, currentOpposition, version } =
    useStore();
  const oppositionId = currentOpposition?.id;
  const [validated, setValidated] = useState(0);
  const [recent, setRecent] = useState<MyResultSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const questions = await store.questions.listQuestions();
      const validatedCount = questions.filter(
        (q) => q.opposition_id === oppositionId && q.status === 'validated',
      ).length;
      const results = currentUser
        ? await store.platform.listMyResults(currentUser)
        : [];
      if (!cancelled) {
        setValidated(validatedCount);
        setRecent(results.slice(0, 3));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store, currentUser, oppositionId, version]);

  return (
    <div>
      <PageHeader
        title={currentOpposition?.title ?? 'Oposicion'}
        subtitle={currentWorkspace?.name ?? undefined}
      />

      {validated === 0 && (
        <div className="notice error">
          Todavia no hay preguntas validadas en esta oposicion. Cuando las haya,
          podras crear tests.
        </div>
      )}

      <div className="card-grid" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Crear test</h3>
          <p className="muted">Practica con preguntas validadas.</p>
          <Button onClick={() => onNavigate('tests')} disabled={validated === 0}>
            Crear test
          </Button>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Material</h3>
          <p className="muted">Consulta tus temarios y apuntes.</p>
          <Button variant="secondary" onClick={() => onNavigate('material')}>
            Ver material
          </Button>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Mis resultados</h3>
          <p className="muted">Revisa tus tests y explicaciones.</p>
          <Button variant="secondary" onClick={() => onNavigate('resultados')}>
            Ver resultados
          </Button>
        </div>
      </div>

      <h3>Ultimos resultados</h3>
      {recent.length === 0 ? (
        <EmptyState message="Aun no has enviado ningun test." />
      ) : (
        recent.map((r) => (
          <div className="card" key={r.attempt_id}>
            <div className="row spread">
              <strong>{r.test_title ?? 'Test'}</strong>
              <span className="muted small">
                {r.score} / {r.total_questions} · {r.percentage.toFixed(0)}%
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// Inicio del gestor (owner/admin): guia de los pasos de preparacion.
function AdminHome({ onNavigate }: { onNavigate: (s: Section) => void }) {
  const { store, currentOpposition, version } = useStore();
  const oppositionId = currentOpposition?.id;
  const [stats, setStats] = useState({
    materials: 0,
    pending: 0,
    validated: 0,
    tests: 0,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const materials = (await store.materials.listMaterials()).filter(
        (m) => m.opposition_id === oppositionId,
      );
      const questions = (await store.questions.listQuestions()).filter(
        (q) => q.opposition_id === oppositionId,
      );
      const next = {
        materials: materials.length,
        pending: questions.filter((q) =>
          ['draft', 'pending_review', 'needs_fix'].includes(q.status),
        ).length,
        validated: questions.filter((q) => q.status === 'validated').length,
        tests: store.createdTests.filter((t) => t.opposition_id === oppositionId)
          .length,
      };
      if (!cancelled) setStats(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [store, oppositionId, version]);

  const statCards = [
    { label: 'Materiales', value: stats.materials },
    { label: 'Pendientes de revisar', value: stats.pending },
    { label: 'Preguntas validadas', value: stats.validated },
    { label: 'Tests creados', value: stats.tests },
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
        {statCards.map((s) => (
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
