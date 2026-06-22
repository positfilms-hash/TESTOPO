import { useEffect, useState } from 'react';
import type { Material, MaterialType } from '@backend';
import { useStore } from '../store/StoreContext.js';
import { Badge, Button, EmptyState, PageHeader } from '../components/ui.js';

// SPEC 029: Material es una biblioteca de archivos simple. Una sola orden
// "Subir material" abre un menu compacto (PDF / ZIP / carpeta). El intake es
// NEUTRO (sin categoria ni auto-clasificacion: la clasificacion vive en Temario,
// "Analizar material"). Cada material se muestra como una fila con `Abrir`
// (previsualiza el PDF de forma segura) y `Eliminar` (borrado con trazabilidad).

const TYPE_LABELS: Record<MaterialType, string> = {
  syllabus: 'Temario',
  old_test: 'Test antiguo',
  official_exam: 'Examen oficial',
  law: 'Norma',
  notes: 'Apuntes',
  other: 'Otro',
};

// Soporte de subida de carpeta (`webkitdirectory`); sin soporte, usar ZIP.
const FOLDER_SUPPORTED =
  typeof document !== 'undefined' &&
  'webkitdirectory' in document.createElement('input');

export function MaterialPage({ isAdmin = false }: { isAdmin?: boolean }) {
  const { store, refresh, currentUser, currentOpposition, version } = useStore();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<
    { type: 'error' | 'success'; text: string } | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    if (currentUser && currentOpposition) {
      void store.platform
        .listMaterials(currentUser, currentOpposition.id)
        .then((list) => {
          if (!cancelled) setMaterials(list);
        });
    } else {
      setMaterials([]);
    }
    return () => {
      cancelled = true;
    };
  }, [store, currentUser, currentOpposition, version]);

  // --- Subida (intake neutro; sin categoria ni clasificacion) ---
  const runUpload = async (
    sourceType: 'zip' | 'folder' | 'multi_file',
    payload:
      | { zip: { original_filename: string; bytes: Uint8Array } }
      | {
          files: {
            original_path: string;
            original_filename: string;
            mime_type: string | null;
            bytes: Uint8Array;
          }[];
        },
  ) => {
    if (!currentUser || !currentOpposition) return;
    setBusy(true);
    setNotice(null);
    try {
      const { batch } = await store.platform.smartUpload(currentUser, {
        opposition_id: currentOpposition.id,
        upload_category: 'opposition_material', // metadato legacy interno
        source_type: sourceType,
        ...payload,
      });
      setMenuOpen(false);
      setNotice({
        type: 'success',
        text: `${batch.imported_files} archivo(s) subido(s). Clasifícalos en Temario → "Analizar material".`,
      });
      refresh();
    } catch (err) {
      setNotice({ type: 'error', text: smartUploadErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const onPickZip = async (file: File | null) => {
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await runUpload('zip', { zip: { original_filename: file.name, bytes } });
  };
  const onPickFolder = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    await runUpload('folder', { files: await toUploadFiles(list, true) });
  };
  const onPickFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    await runUpload('multi_file', { files: await toUploadFiles(list, false) });
  };

  // --- Abrir (URL firmada / object URL; nunca storage_path) ---
  const openMaterial = async (id: string) => {
    if (!currentUser) return;
    setNotice(null);
    try {
      const file = await store.platform.getMaterialFile(currentUser, id);
      const url =
        file.signed_url ??
        (file.bytes
          ? URL.createObjectURL(
              new Blob([file.bytes.slice()], {
                type: file.mime_type ?? 'application/pdf',
              }),
            )
          : null);
      if (!url) {
        setNotice({ type: 'error', text: 'Este material no tiene archivo para abrir.' });
        return;
      }
      window.open(url, '_blank', 'noopener');
    } catch {
      setNotice({ type: 'error', text: 'No se ha podido abrir el material.' });
    }
  };

  // --- Eliminar (seguro; si esta referenciado, ofrece archivar) ---
  const deleteMaterial = async (m: Material) => {
    if (!currentUser) return;
    if (!window.confirm(`Eliminar "${m.title}"? Esta accion no se puede deshacer.`)) {
      return;
    }
    setNotice(null);
    try {
      await store.platform.deleteMaterial(currentUser, m.id);
      setNotice({ type: 'success', text: 'Material eliminado.' });
      refresh();
    } catch (err) {
      // Referenciado: no se borra (no romper una fuente factual). Ofrece archivar.
      const msg = err instanceof Error ? err.message : 'No se ha podido eliminar.';
      if (window.confirm(`${msg}\n\n¿Quieres archivarlo (marcar obsoleto) en su lugar?`)) {
        await store.platform.markMaterialObsolete(currentUser, m.id);
        setNotice({ type: 'success', text: 'Material archivado (obsoleto).' });
        refresh();
      }
    }
  };

  return (
    <div>
      <PageHeader title="Material" />
      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

      {isAdmin && (
        <div className="card" style={{ textAlign: 'center' }}>
          {!menuOpen ? (
            <Button onClick={() => setMenuOpen(true)} disabled={busy}>
              {busy ? 'Subiendo…' : 'Subir material'}
            </Button>
          ) : (
            <div className="row" style={{ justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              <label className="btn" style={{ cursor: 'pointer' }}>
                Archivos PDF
                <input
                  type="file"
                  multiple
                  accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                  style={{ display: 'none' }}
                  disabled={busy}
                  onChange={(e) => onPickFiles(e.target.files)}
                />
              </label>
              <label className="btn" style={{ cursor: 'pointer' }}>
                Archivo ZIP
                <input
                  type="file"
                  accept=".zip,application/zip"
                  style={{ display: 'none' }}
                  disabled={busy}
                  onChange={(e) => onPickZip(e.target.files?.[0] ?? null)}
                />
              </label>
              {FOLDER_SUPPORTED && (
                <label className="btn" style={{ cursor: 'pointer' }}>
                  Carpeta
                  <input
                    type="file"
                    // @ts-expect-error webkitdirectory no esta en los tipos estandar.
                    webkitdirectory=""
                    directory=""
                    multiple
                    style={{ display: 'none' }}
                    disabled={busy}
                    onChange={(e) => onPickFolder(e.target.files)}
                  />
                </label>
              )}
              <Button variant="secondary" small onClick={() => setMenuOpen(false)} disabled={busy}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      )}

      {materials.length === 0 ? (
        <EmptyState
          message={
            isAdmin
              ? "Todavia no has anadido material. Empieza con 'Subir material'."
              : 'Todavia no hay material disponible en esta oposicion.'
          }
        />
      ) : (
        materials.map((m) => (
          <div className="card" key={m.id}>
            <div className="row spread" style={{ alignItems: 'flex-start' }}>
              <div>
                <strong>{m.original_filename ?? m.title}</strong>
                <div className="muted small">
                  {TYPE_LABELS[m.type]}
                  {' · '}
                  {new Date(m.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="row">
                <Badge status={m.status} />
                {isAdmin && (
                  <>
                    <Button variant="secondary" small onClick={() => openMaterial(m.id)}>
                      Abrir
                    </Button>
                    <Button variant="danger" small onClick={() => deleteMaterial(m)}>
                      Eliminar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

async function toUploadFiles(
  fileList: FileList,
  useRelativePath: boolean,
): Promise<
  {
    original_path: string;
    original_filename: string;
    mime_type: string | null;
    bytes: Uint8Array;
  }[]
> {
  return Promise.all(
    Array.from(fileList).map(async (f) => ({
      original_path:
        useRelativePath &&
        (f as File & { webkitRelativePath?: string }).webkitRelativePath
          ? (f as File & { webkitRelativePath: string }).webkitRelativePath
          : f.name,
      original_filename: f.name,
      mime_type: f.type || null,
      bytes: new Uint8Array(await f.arrayBuffer()),
    })),
  );
}

// Mensaje de usuario a partir de un error de carga masiva (SPEC 028, 32/33).
function smartUploadErrorMessage(err: unknown): string {
  const codes =
    err && typeof err === 'object' && Array.isArray((err as { codes?: unknown }).codes)
      ? (err as { codes: string[] }).codes
      : [];
  if (codes.includes('SMART_UPLOAD_TOO_MANY_FILES')) {
    return 'El lote supera el maximo de archivos permitidos (500).';
  }
  if (codes.includes('SMART_UPLOAD_ZIP_TOO_LARGE')) {
    return 'El ZIP o algun archivo supera el tamano maximo permitido.';
  }
  if (codes.includes('SMART_UPLOAD_UNSAFE_PATH')) {
    return 'El ZIP contiene rutas no seguras y se ha rechazado.';
  }
  if (codes.includes('SMART_UPLOAD_NESTED_ZIP_NOT_ALLOWED')) {
    return 'No se permiten ZIP dentro de otro ZIP.';
  }
  if (codes.includes('SMART_UPLOAD_FILE_REQUIRED')) {
    return 'Selecciona al menos un archivo valido.';
  }
  return 'No se ha podido completar la subida. Revisa los archivos (PDF, TXT, MD o ZIP) y vuelve a intentarlo.';
}
