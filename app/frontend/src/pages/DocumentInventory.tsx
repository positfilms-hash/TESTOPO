import { useEffect, useState } from 'react';
import {
  DOCUMENT_CLASSES,
  DOCUMENT_CLASS_LABELS,
  type DocumentClass,
  type DocumentClassification,
} from '@backend';
import { useStore } from '../store/StoreContext.js';
import { Button, EmptyState, PageHeader } from '../components/ui.js';

// SPEC 028-B: inventario documental agrupado por clasificacion. Solo admin/owner
// (el facade aplica el control de acceso). Permite corregir la clase de cada
// documento; la correccion humana prevalece sobre la IA.

// Orden de presentacion: primero material util, luego internos/no aptos.
const GROUP_ORDER: DocumentClass[] = [
  'syllabus_material',
  'legal_text',
  'notes_or_summary',
  'index_or_table_of_contents',
  'old_exam_or_test',
  'ambiguous',
  'irrelevant',
  'not_analyzable',
];

export function DocumentInventory({
  batchId,
  onDone,
}: {
  batchId: string;
  onDone: () => void;
}) {
  const { store, currentUser } = useStore();
  const [items, setItems] = useState<DocumentClassification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!currentUser) return;
    try {
      const inv = await store.platform.getDocumentInventory(currentUser, batchId);
      setItems(inv.classifications);
    } catch {
      setError('No se ha podido cargar el inventario de documentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, currentUser, batchId]);

  const correct = async (id: string, classification: DocumentClass) => {
    if (!currentUser) return;
    setBusyId(id);
    setError(null);
    try {
      await store.platform.correctDocumentClassification(
        currentUser,
        id,
        classification,
      );
      await load();
    } catch {
      setError('No se ha podido corregir la clasificacion.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Documentos importados" subtitle="Cargando inventario..." />
      </div>
    );
  }

  const needsReview = items.filter((i) => i.needs_review).length;
  const groups = GROUP_ORDER.map((cls) => ({
    cls,
    list: items.filter((i) => i.classification === cls),
  })).filter((g) => g.list.length > 0);

  return (
    <div>
      <PageHeader
        title="Documentos importados"
        subtitle={`${items.length} documento(s) clasificados${
          needsReview > 0 ? ` - ${needsReview} necesitan revision` : ''
        }`}
      />
      {error && <div className="notice error">{error}</div>}
      {items.length === 0 ? (
        <EmptyState message="Todavia no hay documentos clasificados en este lote." />
      ) : (
        groups.map((group) => (
          <div className="card" key={group.cls}>
            <strong>
              {DOCUMENT_CLASS_LABELS[group.cls]} ({group.list.length})
            </strong>
            {group.list.map((item) => (
              <div
                key={item.id}
                className="row spread"
                style={{ marginTop: 8, alignItems: 'flex-start' }}
              >
                <div>
                  <div>
                    {item.detected_title ?? 'Documento sin titulo'}
                    {item.needs_review && (
                      <span className="muted small"> - revisar</span>
                    )}
                  </div>
                  <div className="muted small">
                    {item.confidence != null
                      ? `confianza ${(item.confidence * 100).toFixed(0)}%`
                      : 'sin confianza'}
                    {item.detected_question_count != null &&
                      ` - ${item.detected_question_count} preguntas detectadas`}
                    {item.manually_corrected && ' - corregido a mano'}
                  </div>
                  {item.reason && (
                    <div className="muted small">{item.reason}</div>
                  )}
                  {item.warnings.length > 0 && (
                    <div className="notice error small">
                      {item.warnings.join(' ')}
                    </div>
                  )}
                </div>
                <label className="small" style={{ minWidth: 200 }}>
                  Corregir:
                  <select
                    value={item.classification}
                    disabled={busyId === item.id}
                    onChange={(e) =>
                      correct(item.id, e.target.value as DocumentClass)
                    }
                  >
                    {DOCUMENT_CLASSES.map((cls) => (
                      <option key={cls} value={cls}>
                        {DOCUMENT_CLASS_LABELS[cls]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>
        ))
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <Button variant="secondary" onClick={onDone}>
          Volver al material
        </Button>
      </div>
    </div>
  );
}
