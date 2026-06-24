import { useState } from 'react';
import type {
  GroundedProposalDetail,
  SyllabusIndexNodeProposal,
  SyllabusIndexNodeSource,
} from '@backend';
import { useStore } from '../store/StoreContext.js';
import { Badge, Button, EmptyState, PageHeader } from '../components/ui.js';

// SPEC 028-D: "Crear indice con IA" anclado a documentos clasificados (028-B) y
// sus secciones (028-C). La IA SOLO organiza evidencia con FUENTES concretas; el
// admin revisa, edita, aprueba y aplica al temario. Nada se aplica ni se publica
// al alumno automaticamente. Proveedor mock en el navegador.
export function SyllabusIndexPanel({ onClose }: { onClose: () => void }) {
  const { store, refresh, currentUser, currentOpposition } = useStore();
  const [detail, setDetail] = useState<GroundedProposalDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const reload = async (proposalId: string) => {
    if (!currentUser) return;
    const fresh = await store.platform.getSyllabusIndexProposalDetail(
      currentUser,
      proposalId,
    );
    setDetail(fresh);
  };

  const analyze = async () => {
    if (!currentUser || !currentOpposition) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await store.platform.proposeSyllabusIndexFromDocuments(
        currentUser,
        { opposition_id: currentOpposition.id },
      );
      setDetail(result);
      setNotice({
        type: 'success',
        text: `La IA ha propuesto un indice con ${result.nodes.length} tema(s) con fuente, pendiente de revision.`,
      });
    } catch {
      setNotice({
        type: 'error',
        text: 'No se pudo generar el indice. Asegurate de tener documentos clasificados y seccionados (clasifica y crea secciones primero).',
      });
    } finally {
      setBusy(false);
    }
  };

  if (!detail) {
    return (
      <div className="card" style={{ maxWidth: 600 }}>
        <PageHeader
          title="Crear indice con IA"
          subtitle="Organiza tus documentos clasificados en un temario con fuentes. La propuesta se revisa antes de aplicarse."
          action={
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          }
        />
        {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
        <p className="muted small">
          Usa los documentos de estudio ya clasificados (temario, leyes, apuntes,
          indices) y sus secciones. Los tests antiguos solo aportan contexto. No se
          generan preguntas ni se escribe el temario.
        </p>
        <Button onClick={analyze} disabled={busy}>
          {busy ? 'Analizando...' : 'Analizar documentos y proponer temario'}
        </Button>
      </div>
    );
  }

  return (
    <ProposalReview
      detail={detail}
      onReload={reload}
      onApplied={() => {
        refresh();
        onClose();
      }}
      onClose={onClose}
      notice={notice}
      setNotice={setNotice}
    />
  );
}

function depthOf(
  node: SyllabusIndexNodeProposal,
  byId: Map<string, SyllabusIndexNodeProposal>,
): number {
  let depth = 0;
  let current = node.parent_id;
  const seen = new Set<string>();
  while (current && byId.has(current) && !seen.has(current)) {
    seen.add(current);
    depth += 1;
    current = byId.get(current)?.parent_id ?? null;
  }
  return depth;
}

export function ProposalReview({
  detail,
  onReload,
  onApplied,
  onClose,
  notice,
  setNotice,
}: {
  detail: GroundedProposalDetail;
  onReload: (proposalId: string) => Promise<void>;
  onApplied: () => void;
  onClose: () => void;
  notice: { type: 'error' | 'success'; text: string } | null;
  setNotice: (n: { type: 'error' | 'success'; text: string } | null) => void;
}) {
  const { store, currentUser } = useStore();
  const [busy, setBusy] = useState(false);
  const proposal = detail.proposal;
  const byId = new Map(detail.nodes.map((n) => [n.id, n]));
  const sourcesByNode = new Map<string, SyllabusIndexNodeSource[]>();
  for (const source of detail.node_sources) {
    const list = sourcesByNode.get(source.node_id) ?? [];
    list.push(source);
    sourcesByNode.set(source.node_id, list);
  }
  const isEditable = proposal.status === 'draft' || proposal.status === 'pending_review';
  const runWarnings = detail.run?.warnings ?? [];

  const act = async (fn: () => Promise<unknown>, okText: string) => {
    if (!currentUser) return;
    try {
      await fn();
      await onReload(proposal.id);
      setNotice({ type: 'success', text: okText });
    } catch {
      setNotice({ type: 'error', text: 'No se pudo completar la accion.' });
    }
  };

  const editNode = (node: SyllabusIndexNodeProposal) => {
    if (!currentUser) return;
    const next = window.prompt('Nuevo titulo del tema', node.title);
    if (next && next.trim()) {
      void act(
        () =>
          store.platform.editSyllabusNode(currentUser, proposal.id, node.id, {
            title: next.trim(),
          }),
        'Tema actualizado.',
      );
    }
  };

  return (
    <div className="card">
      <PageHeader
        title={proposal.title}
        subtitle={`Estado: ${proposal.status}. ${detail.nodes.length} tema(s) con fuente.`}
        action={
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        }
      />
      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
      {runWarnings.length > 0 && (
        <div className="notice error small">{runWarnings.join(' ')}</div>
      )}

      {detail.nodes.length === 0 ? (
        <EmptyState message="La IA no ha propuesto temas con fuente a partir del material seleccionado." />
      ) : (
        detail.nodes.map((node) => {
          const sources = sourcesByNode.get(node.id) ?? [];
          return (
            <div
              key={node.id}
              style={{ marginLeft: depthOf(node, byId) * 20, padding: '6px 0' }}
            >
              <div className="row spread">
                <div>
                  {node.title} <Badge status={node.status} />
                  {node.confidence != null && (
                    <span className="muted small">
                      {' '}
                      confianza {(node.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                {/* SPEC 037: revisión GLOBAL; no hay aceptar/rechazar por tema.
                    Solo edición puntual del título (cambio soportado globalmente). */}
                {isEditable && (
                  <div className="row">
                    <Button variant="secondary" small onClick={() => editNode(node)}>
                      Editar
                    </Button>
                  </div>
                )}
              </div>
              {sources.length > 0 && (
                <ul className="muted small" style={{ margin: '2px 0 0 0' }}>
                  {sources.map((s) => (
                    <li key={s.id}>
                      Fuente{s.is_primary ? ' (primaria)' : ' (contexto)'}:{' '}
                      {s.excerpt ? `"${s.excerpt}"` : s.material_section_id ?? s.material_id}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })
      )}

      {/* SPEC 037: UNA sola acción explícita. "Aplicar índice completo" aprueba (si
          hace falta) y aplica el índice entero de una vez; no hay paso de aprobar
          por separado ni gate por tema. Si el índice no es compacto, el servidor
          bloquea con needs_regeneration y se pide regenerar. */}
      <div className="row" style={{ marginTop: 12 }}>
        <Button
          disabled={busy || proposal.status === 'applied'}
          onClick={async () => {
            if (!currentUser) return;
            setBusy(true);
            try {
              if (proposal.status !== 'approved') {
                await store.platform.approveSyllabusProposal(currentUser, proposal.id);
              }
              const result = await store.platform.applySyllabusIndexFromDocuments(
                currentUser,
                proposal.id,
              );
              setNotice({
                type: 'success',
                text: `Índice aplicado: ${result.created_topic_ids.length} tema(s) creados, ${result.reused_topic_ids.length} reutilizados, ${result.topic_source_references} fuente(s) registradas.`,
              });
              onApplied();
            } catch (err) {
              const codes = (err as { codes?: string[] })?.codes ?? [];
              setNotice({
                type: 'error',
                text: codes.includes('SYLLABUS_INDEX_NEEDS_REGENERATION')
                  ? 'El índice no es un temario de estudio compacto (parece una transcripción). Regenera el temario antes de aplicarlo.'
                  : 'No se pudo aplicar el índice. Inténtalo de nuevo.',
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Aplicando…' : 'Aplicar índice completo'}
        </Button>
      </div>
    </div>
  );
}
