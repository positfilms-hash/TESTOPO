import { useEffect, useState } from 'react';
import {
  isUsableExtraction,
  type GroundedProposalDetail,
  type Material,
  type SyllabusIndexProposal,
  type Topic,
  type TopicTreeNode,
} from '@backend';
import { useStore } from '../store/StoreContext.js';
import type { Section } from '../components/AppLayout.js';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  LoadingState,
  PageHeader,
} from '../components/ui.js';
import { ProposalReview } from './SyllabusIndexPanel.js';
import { StudyMaterialPanel } from './StudyMaterialPanel.js';
import { GenerateFromStudiedMaterialPanel } from './GenerateFromStudiedMaterialPanel.js';

// SPEC 032: Temario es una pantalla enfocada. Si la oposicion no tiene temario
// aplicado, la experiencia principal es UNA accion: "Generar temario", que compone
// el flujo existente (clasificar -> seccionar -> proponer indice con fuentes) para
// todo el material elegible. La IA solo PROPONE; nada se aplica sin un clic humano
// explicito. (Temario es solo de gestion; el alumno nunca ve esta pantalla.)

// Estados de extraccion cuyo material aun se esta leyendo (no elegible todavia).
const PROCESSING_STATUSES = new Set([
  'not_started',
  'processing',
  'ocr_processing',
  'scanned_detected',
]);

type ActiveProposal = SyllabusIndexProposal | null;

export function TopicPage({ onNavigate }: { onNavigate?: (section: Section) => void }) {
  const { store, refresh, currentUser, currentOpposition, version } = useStore();
  const oppositionId = currentOpposition?.id;

  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [tree, setTree] = useState<TopicTreeNode[]>([]);
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [proposalDetail, setProposalDetail] = useState<GroundedProposalDetail | null>(null);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [reviewNotice, setReviewNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Carga el estado de la oposicion: material, temas aplicados y propuesta activa.
  useEffect(() => {
    let cancelled = false;
    if (!currentUser || !oppositionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      const mats = await store.platform.listMaterials(currentUser, oppositionId);
      const t = (await store.topics.getTopicTree()).filter((n) => n.opposition_id === oppositionId);
      const a = (await store.topics.listTopics()).filter((x) => x.opposition_id === oppositionId);
      // Propuesta activa (pendiente de revision/aprobada) para retomar la revision.
      let detail: GroundedProposalDetail | null = null;
      try {
        const proposals = await store.platform.listSyllabusProposals(currentUser, oppositionId);
        const active = pickActiveProposal(proposals);
        if (active) {
          detail = await store.platform.getSyllabusIndexProposalDetail(currentUser, active.id);
        }
      } catch {
        detail = null;
      }
      if (!cancelled) {
        setMaterials(mats);
        setTree(t);
        setAllTopics(a);
        setProposalDetail(detail);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store, currentUser, oppositionId, version]);

  const eligibleCount = materials.filter(
    (m) => isUsableExtraction(m.extraction_status) && m.status !== 'obsolete',
  ).length;
  const processingCount = materials.filter((m) =>
    PROCESSING_STATUSES.has(m.extraction_status ?? ''),
  ).length;
  const hasAppliedSyllabus = tree.length > 0;

  const generate = async () => {
    if (!currentUser || !oppositionId) return;
    setGenerating(true);
    setNotice(null);
    try {
      const detail = await store.platform.generateSyllabusForOpposition(currentUser, oppositionId);
      setProposalDetail(detail);
      setReviewNotice({
        type: 'success',
        text: `Temario propuesto: ${detail.nodes.length} tema(s) con fuente, pendiente de tu revisión.`,
      });
    } catch (err) {
      setNotice({ type: 'error', text: syllabusErrorMessage(err) });
    } finally {
      setGenerating(false);
    }
  };

  const reloadProposal = async (proposalId: string) => {
    if (!currentUser) return;
    const fresh = await store.platform.getSyllabusIndexProposalDetail(currentUser, proposalId);
    setProposalDetail(fresh);
  };

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Temario" title="Temario" />
        <LoadingState />
      </div>
    );
  }

  // SPEC 038 P0 #3: "Estudiar material" es SIEMPRE la accion PRIMARIA. Una propuesta
  // legacy pendiente NUNCA bloquea con early return; el indice de temario clasico
  // (Topics/propuestas) queda como flujo SECUNDARIO y opcional dentro del desplegable
  // (no se borra; sigue funcionando para quien ya lo use).
  return (
    <div>
      <StudyMaterialPanel materials={materials} onNavigate={onNavigate} />

      {/* SPEC 039: tras el estudio, generar preguntas DIRECTO desde el material
          estudiado (sin indice ni tema). El panel se autorregula: si no hay
          material estudiado, invita a estudiarlo primero. */}
      <GenerateFromStudiedMaterialPanel materials={materials} onNavigate={onNavigate} />

      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

      <details style={{ marginTop: 16 }} open={proposalDetail !== null}>
        <summary className="muted small" style={{ cursor: 'pointer' }}>
          Temario clásico (índice de temas) — opcional
        </summary>
        <div style={{ marginTop: 8 }}>
          {proposalDetail ? (
            <ProposalReview
              detail={proposalDetail}
              onReload={reloadProposal}
              onApplied={() => {
                setProposalDetail(null);
                setReviewNotice(null);
                refresh();
              }}
              onClose={() => {
                setProposalDetail(null);
                setReviewNotice(null);
                refresh();
              }}
              notice={reviewNotice}
              setNotice={setReviewNotice}
            />
          ) : hasAppliedSyllabus ? (
            <TopicMap tree={tree} allTopics={allTopics} />
          ) : (
            <div className="card" style={{ textAlign: 'center' }}>
              <Button
                variant="secondary"
                onClick={generate}
                disabled={generating || eligibleCount === 0}
              >
                {generating ? 'Generando…' : 'Generar índice de temario'}
              </Button>
              <p className="muted small" style={{ marginTop: 8 }}>
                Flujo anterior (índice de temas con revisión y aplicación). No es
                necesario para estudiar el material.
                {eligibleCount === 0 ? ' Necesitas material legible primero.' : ''}
              </p>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

// La propuesta a retomar: la mas reciente que aun no esta aplicada ni rechazada.
function pickActiveProposal(proposals: SyllabusIndexProposal[]): ActiveProposal {
  const active = proposals.filter((p) =>
    ['draft', 'pending_review', 'approved'].includes(p.status),
  );
  if (active.length === 0) return null;
  return active.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];
}

// --- Topic Map (temario aplicado): arbol + alta manual de temas ---------------
function TopicMap({ tree, allTopics }: { tree: TopicTreeNode[]; allTopics: Topic[] }) {
  const { store, refresh, currentUser, currentOpposition } = useStore();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addTopic = async () => {
    setError(null);
    if (!currentUser) return;
    try {
      await store.platform.createTopic(currentUser, {
        opposition_id: currentOpposition?.id,
        title,
        parent_id: parentId || null,
      });
      setTitle('');
      setParentId('');
      setAdding(false);
      refresh();
    } catch {
      setError('El titulo es obligatorio.');
    }
  };

  const editTopic = async (id: string, current: string) => {
    if (!currentUser) return;
    const next = window.prompt('Nuevo titulo del tema', current);
    if (next && next.trim()) {
      await store.platform.editTopic(currentUser, id, { title: next.trim() });
      refresh();
    }
  };

  const markObsolete = async (id: string) => {
    if (!currentUser) return;
    if (!window.confirm('¿Marcar este tema como obsoleto?')) return;
    await store.platform.markTopicObsolete(currentUser, id);
    refresh();
  };

  return (
    <div className="card">
      <div className="row spread">
        <strong>Temas</strong>
        <Button variant="secondary" small onClick={() => setAdding((v) => !v)}>
          Añadir tema
        </Button>
      </div>

      {adding && (
        <div style={{ marginTop: 12, maxWidth: 520 }}>
          {error && <div className="notice error">{error}</div>}
          <Field label="Titulo del tema">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tema 3 - …" />
          </Field>
          <Field label="Tema padre (opcional)">
            <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">(Tema raiz)</option>
              {allTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="row">
            <Button onClick={addTopic}>Guardar</Button>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        {tree.map((node) => (
          <TopicNode
            key={node.id}
            node={node}
            onEdit={editTopic}
            onObsolete={markObsolete}
          />
        ))}
      </div>
    </div>
  );
}

function TopicNode({
  node,
  onEdit,
  onObsolete,
}: {
  node: TopicTreeNode;
  onEdit: (id: string, title: string) => void;
  onObsolete: (id: string) => void;
}) {
  return (
    <div className="tree-item">
      <div className="row spread">
        <span style={{ flex: 1 }}>
          {node.code ? `${node.code} · ` : ''}
          {node.title} {node.status !== 'active' && <Badge status={node.status} />}
        </span>
        <span className="row">
          <Button variant="secondary" small onClick={() => onEdit(node.id, node.title)}>
            Editar
          </Button>
          {node.status !== 'obsolete' && (
            <Button variant="danger" small onClick={() => onObsolete(node.id)}>
              Obsoleto
            </Button>
          )}
        </span>
      </div>
      {node.children.length > 0 && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TopicNode key={child.id} node={child} onEdit={onEdit} onObsolete={onObsolete} />
          ))}
        </div>
      )}
    </div>
  );
}

// Mensaje de usuario a partir de un error de generacion de temario (SPEC 032).
function syllabusErrorMessage(err: unknown): string {
  const codes =
    err && typeof err === 'object' && Array.isArray((err as { codes?: unknown }).codes)
      ? (err as { codes: string[] }).codes
      : [];
  if (codes.some((c) => /NO_MATERIALS|NO_SOURCES/.test(c))) {
    return 'No hay documentos de estudio legibles con fuente suficiente. Sube temario o apuntes y vuelve a intentarlo.';
  }
  return 'No se ha podido generar el temario. Revisa el material e inténtalo de nuevo.';
}
