import { useEffect, useState } from 'react';
import type {
  ProposalDetail,
  SyllabusIndexNodeProposal,
} from '@backend';
import { useStore } from '../store/StoreContext.js';
import { Badge, Button, EmptyState, Field, PageHeader } from '../components/ui.js';

// SPEC 019: flujo "Crear indice con IA". La IA SOLO propone; el admin revisa,
// edita, aprueba y aplica al temario. Proveedor mock en el navegador.
export function SyllabusIndexPanel({ onClose }: { onClose: () => void }) {
  const { store, refresh, currentUser, currentOpposition } = useStore();
  const [scope, setScope] = useState<'all' | 'unclassified'>('all');
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const reload = async (proposalId: string) => {
    if (!currentUser) return;
    const fresh = await store.platform.getSyllabusProposal(currentUser, proposalId);
    setDetail(fresh);
  };

  const analyze = async () => {
    if (!currentUser || !currentOpposition) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await store.platform.proposeSyllabusIndex(currentUser, {
        opposition_id: currentOpposition.id,
        only_unclassified: scope === 'unclassified',
      });
      setDetail(result);
      const topics = result.nodes.length;
      setNotice({
        type: 'success',
        text: `La IA ha propuesto un indice con ${topics} tema(s), pendiente de revision.`,
      });
    } catch {
      setNotice({
        type: 'error',
        text: 'No se pudo generar el indice. Revisa que haya material con texto extraido.',
      });
    } finally {
      setBusy(false);
    }
  };

  if (!detail) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <PageHeader
          title="Crear indice con IA"
          subtitle="Analiza el material y propon un temario. La propuesta se revisa antes de aplicarse."
          action={
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          }
        />
        {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
        <Field label="Material a analizar">
          <select value={scope} onChange={(e) => setScope(e.target.value as 'all' | 'unclassified')}>
            <option value="all">Todo el material activo</option>
            <option value="unclassified">Solo material sin tema</option>
          </select>
        </Field>
        <Button onClick={analyze} disabled={busy}>
          {busy ? 'Analizando…' : 'Analizar material y proponer temario'}
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

function ProposalReview({
  detail,
  onReload,
  onApplied,
  onClose,
  notice,
  setNotice,
}: {
  detail: ProposalDetail;
  onReload: (proposalId: string) => Promise<void>;
  onApplied: () => void;
  onClose: () => void;
  notice: { type: 'error' | 'success'; text: string } | null;
  setNotice: (n: { type: 'error' | 'success'; text: string } | null) => void;
}) {
  const { store, currentUser } = useStore();
  const proposal = detail.proposal;
  const byId = new Map(detail.nodes.map((n) => [n.id, n]));
  const unclassified = detail.suggestions.filter((s) => s.status === 'unclassified');
  const isEditable = proposal.status === 'draft' || proposal.status === 'pending_review';

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
        subtitle={`Estado: ${proposal.status}. ${detail.nodes.length} tema(s) propuestos.`}
        action={
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        }
      />
      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

      {detail.nodes.length === 0 ? (
        <EmptyState message="La IA no ha propuesto temas con el material seleccionado." />
      ) : (
        detail.nodes.map((node) => (
          <div
            className="row spread"
            key={node.id}
            style={{ marginLeft: depthOf(node, byId) * 20, padding: '6px 0' }}
          >
            <div>
              {node.code ? `${node.code} · ` : ''}
              {node.title} <Badge status={node.status} />
            </div>
            {isEditable && (
              <div className="row">
                <Button variant="secondary" small onClick={() => editNode(node)}>
                  Editar
                </Button>
                <Button
                  small
                  onClick={() =>
                    currentUser &&
                    act(
                      () =>
                        store.platform.setSyllabusNodeStatus(
                          currentUser,
                          proposal.id,
                          node.id,
                          'accepted',
                        ),
                      'Tema aceptado.',
                    )
                  }
                >
                  Aceptar
                </Button>
                <Button
                  variant="danger"
                  small
                  onClick={() =>
                    currentUser &&
                    act(
                      () =>
                        store.platform.setSyllabusNodeStatus(
                          currentUser,
                          proposal.id,
                          node.id,
                          'rejected',
                        ),
                      'Tema rechazado.',
                    )
                  }
                >
                  Rechazar
                </Button>
              </div>
            )}
          </div>
        ))
      )}

      {unclassified.length > 0 && (
        <p className="muted small">
          {unclassified.length} material(es) sin clasificar (no se asociaran a ningun tema).
        </p>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        {isEditable && (
          <Button
            onClick={() =>
              currentUser &&
              act(
                () => store.platform.approveSyllabusProposal(currentUser, proposal.id),
                'Propuesta aprobada. Ya puedes aplicarla al temario.',
              )
            }
          >
            Aprobar propuesta
          </Button>
        )}
        <Button
          disabled={proposal.status !== 'approved'}
          title={proposal.status !== 'approved' ? 'Aprueba la propuesta primero' : undefined}
          onClick={async () => {
            if (!currentUser) return;
            try {
              const result = await store.platform.applySyllabusProposal(
                currentUser,
                proposal.id,
              );
              setNotice({
                type: 'success',
                text: `Indice aplicado: ${result.created_topic_ids.length} tema(s) creados, ${result.reused_topic_ids.length} reutilizados.`,
              });
              onApplied();
            } catch {
              setNotice({ type: 'error', text: 'No se pudo aplicar la propuesta.' });
            }
          }}
        >
          Aplicar al temario
        </Button>
      </div>
    </div>
  );
}
