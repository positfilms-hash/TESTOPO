import { useEffect, useState } from 'react';
import { MATERIAL_TYPES, type Material, type MaterialType } from '@backend';
import { useStore } from '../store/StoreContext.js';
import { Badge, Button, EmptyState, Field, PageHeader } from '../components/ui.js';

type View =
  | { kind: 'list' }
  // SPEC 028: punto de entrada unico "Subir material" = carga masiva por
  // categoria (ZIP/carpeta/PDFs). "Pegar texto" queda como alta manual (`new`).
  | { kind: 'upload' }
  | { kind: 'new' }
  | { kind: 'detail'; id: string };

// SPEC 028: solo dos categorias de cara al usuario.
type UploadCategory = 'opposition_material' | 'old_tests';

const EXTRACTION_LABELS: Record<string, string> = {
  not_started: 'Sin procesar',
  processing: 'Procesando',
  completed: 'Texto extraido',
  failed: 'Extraccion fallida',
  not_supported: 'Sin texto extraible',
};

const TYPE_LABELS: Record<MaterialType, string> = {
  syllabus: 'Temario',
  old_test: 'Test antiguo',
  official_exam: 'Examen oficial',
  law: 'Norma',
  notes: 'Apuntes',
  other: 'Otro',
};

export function MaterialPage({ isAdmin = false }: { isAdmin?: boolean }) {
  const { store, refresh, currentUser, currentOpposition, version } = useStore();
  const [view, setView] = useState<View>({ kind: 'list' });
  const [materials, setMaterials] = useState<Material[]>([]);
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
  }, [store, currentUser, currentOpposition, version, view]);

  if (view.kind === 'new') {
    return (
      <MaterialForm
        onCancel={() => setView({ kind: 'upload' })}
        onSaved={() => {
          refresh();
          setView({ kind: 'list' });
        }}
      />
    );
  }

  // SPEC 028: un unico CTA "Subir material" abre la carga masiva por categoria
  // (ZIP / carpeta / varios PDFs). "Pegar texto" queda como alta manual.
  if (view.kind === 'upload') {
    return (
      <SmartUploadForm
        onCancel={() => setView({ kind: 'list' })}
        onPasteText={() => setView({ kind: 'new' })}
        onDone={() => {
          refresh();
          setView({ kind: 'list' });
        }}
      />
    );
  }

  if (view.kind === 'detail') {
    return (
      <MaterialDetail
        id={view.id}
        isAdmin={isAdmin}
        onBack={() => setView({ kind: 'list' })}
      />
    );
  }

  // El facade aplica el acceso: el estudiante solo ve material activo de
  // oposiciones autorizadas (SPEC 012/013); el gestor ve todo. Carga async.
  return (
    <div>
      <PageHeader
        title="Material"
        subtitle="Tus temarios, leyes y apuntes."
        action={
          isAdmin ? (
            <div className="row">
              <Button onClick={() => setView({ kind: 'upload' })}>
                Subir material
              </Button>
            </div>
          ) : undefined
        }
      />
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
            <div className="row spread">
              <div>
                <strong>{m.title}</strong>
                <div className="muted small">
                  {TYPE_LABELS[m.type]} - {m.reference || 'sin referencia'}
                </div>
              </div>
              <div className="row">
                <Badge status={m.status} />
                <Button variant="secondary" small onClick={() => setView({ kind: 'detail', id: m.id })}>
                  Ver
                </Button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function MaterialForm({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { store, currentUser, currentOpposition } = useStore();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<MaterialType>('syllabus');
  const [reference, setReference] = useState('');
  const [contentText, setContentText] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!currentUser) return;
    try {
      await store.platform.createMaterial(currentUser, {
        opposition_id: currentOpposition?.id,
        title,
        type,
        status: 'active',
        reference: reference || null,
        content_text: contentText || null,
        description: description || null,
      });
      onSaved();
    } catch {
      setError('Revisa los datos: el titulo y el tipo son obligatorios.');
    }
  };

  return (
    <div>
      <PageHeader title="Anadir material" subtitle="Pega el texto o describe el documento." />
      {error && <div className="notice error">{error}</div>}
      <div className="card" style={{ maxWidth: 560 }}>
        <Field label="Titulo">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tema 1 - Constitucion" />
        </Field>
        <Field label="Tipo">
          <select value={type} onChange={(e) => setType(e.target.value as MaterialType)}>
            {MATERIAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Referencia (opcional)">
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Tema 1, articulo 14..." />
        </Field>
        <Field label="Texto del material (opcional)">
          <textarea value={contentText} onChange={(e) => setContentText(e.target.value)} />
        </Field>
        <Field label="Descripcion (opcional)">
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="row">
          <Button onClick={submit}>Guardar material</Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

// SPEC 028 - Carga masiva inteligente: el usuario elige una categoria (material
// de la oposicion / tests antiguos), sube ZIP / carpeta / varios PDFs, y la app
// desglosa, extrae texto y, opcionalmente, lanza el indice IA (que solo propone).
type SmartSummary = {
  category: UploadCategory;
  batchId: string;
  imported: number;
  analyzed: number;
  skipped: number;
  failed: number;
  warnings: string[];
  folderPaths: Record<string, string>;
};

// Soporte de subida de carpeta (`webkitdirectory`). En navegadores sin soporte
// (o jsdom) recomendamos comprimir en ZIP.
const FOLDER_SUPPORTED =
  typeof document !== 'undefined' &&
  'webkitdirectory' in document.createElement('input');

async function toUploadFiles(
  fileList: FileList,
  useRelativePath: boolean,
): Promise<{ original_path: string; original_filename: string; mime_type: string | null; bytes: Uint8Array }[]> {
  return Promise.all(
    Array.from(fileList).map(async (f) => ({
      original_path:
        useRelativePath && (f as File & { webkitRelativePath?: string }).webkitRelativePath
          ? (f as File & { webkitRelativePath: string }).webkitRelativePath
          : f.name,
      original_filename: f.name,
      mime_type: f.type || null,
      bytes: new Uint8Array(await f.arrayBuffer()),
    })),
  );
}

function SmartUploadForm({
  onCancel,
  onDone,
  onPasteText,
}: {
  onCancel: () => void;
  onDone: () => void;
  onPasteText: () => void;
}) {
  const { store, currentUser, currentOpposition } = useStore();
  const [category, setCategory] = useState<UploadCategory>('opposition_material');
  // SPEC 028, 31: activado por defecto en ambas categorias (indice IA para
  // material; analisis de patrones para tests antiguos).
  const [runAnalysis, setRunAnalysis] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SmartSummary | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  const isOldTests = category === 'old_tests';

  // Lanza el analisis IA del lote: para material propone indice de temario; para
  // tests antiguos analiza estilo/cobertura (patrones). Ambos via SPEC 019; nada
  // se aplica ni se valida sin revision humana.
  const runAnalysisFor = async (s: SmartSummary): Promise<void> => {
    if (!currentUser) return;
    try {
      await store.platform.proposeSyllabusIndex(currentUser, {
        opposition_id: currentOpposition?.id ?? '',
        folder_paths: s.folderPaths,
        batch_id: s.batchId,
      });
      setAiNotice(
        s.category === 'old_tests'
          ? 'Se han analizado los tests antiguos como referencia de estilo y cobertura. No se han generado preguntas.'
          : 'La IA ha propuesto un indice de temario pendiente de revision. Revisalo y aplicalo desde Temario.',
      );
    } catch {
      setError(
        s.category === 'old_tests'
          ? 'No se ha podido analizar los tests antiguos. Intentalo de nuevo desde el resumen.'
          : 'No se ha podido lanzar el indice con IA. Intentalo de nuevo desde Temario.',
      );
    }
  };

  const runUpload = async (
    sourceType: 'zip' | 'folder' | 'multi_file',
    payload:
      | { zip: { original_filename: string; bytes: Uint8Array } }
      | { files: { original_path: string; original_filename: string; mime_type: string | null; bytes: Uint8Array }[] },
  ) => {
    if (!currentUser) return;
    setBusy(true);
    setError(null);
    setAiNotice(null);
    try {
      const { batch, items } = await store.platform.smartUpload(currentUser, {
        opposition_id: currentOpposition?.id,
        upload_category: category,
        source_type: sourceType,
        ...payload,
      });
      const folderPaths: Record<string, string> = {};
      for (const item of items) {
        if (item.material_id) folderPaths[item.material_id] = item.original_path;
      }
      const s: SmartSummary = {
        category,
        batchId: batch.id,
        imported: batch.imported_files,
        analyzed: batch.analyzed_files,
        skipped: batch.skipped_files,
        failed: batch.failed_files,
        warnings: batch.warnings,
        folderPaths,
      };
      setSummary(s);
      // Auto-ejecuta el analisis si el usuario lo dejo marcado (SPEC 028, 31).
      if (runAnalysis && s.imported > 0) {
        await runAnalysisFor(s);
      }
    } catch (err) {
      setError(smartUploadErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onPickZip = async (file: File | null) => {
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await runUpload('zip', { zip: { original_filename: file.name, bytes } });
  };

  const onPickFolder = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    await runUpload('folder', { files: await toUploadFiles(fileList, true) });
  };

  const onPickFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    await runUpload('multi_file', { files: await toUploadFiles(fileList, false) });
  };

  // Boton manual del resumen (si el auto-analisis estaba desmarcado o fallo).
  const manualAnalysis = async () => {
    if (!summary) return;
    setBusy(true);
    setError(null);
    try {
      await runAnalysisFor(summary);
    } finally {
      setBusy(false);
    }
  };

  const analyzeLabel =
    summary?.category === 'old_tests'
      ? 'Analizar tests antiguos'
      : 'Crear indice con IA';

  // --- Pantalla de resumen (SPEC 028, 26) ---
  if (summary) {
    return (
      <div>
        <PageHeader title="Importacion completada" subtitle="Resumen de la subida." />
        <div className="card" style={{ maxWidth: 560 }}>
          <strong>
            {summary.category === 'old_tests'
              ? 'Tests antiguos'
              : 'Material de la oposicion'}
          </strong>
          <ul className="muted small">
            <li>{summary.imported} archivos importados</li>
            <li>{summary.analyzed} con texto extraido</li>
            {summary.imported - summary.analyzed > 0 && (
              <li>{summary.imported - summary.analyzed} sin texto extraible</li>
            )}
            {summary.skipped > 0 && <li>{summary.skipped} omitidos por formato no permitido</li>}
            {summary.failed > 0 && <li>{summary.failed} con error</li>}
          </ul>
          {summary.warnings.length > 0 && (
            <div className="notice error small">
              {summary.warnings.join(' ')}
            </div>
          )}
          {summary.category === 'old_tests' ? (
            <p className="muted small">
              Los tests antiguos se analizan como referencia de estilo y
              cobertura. No se generan preguntas validadas automaticamente.
            </p>
          ) : (
            <p className="muted small">
              Siguiente paso recomendado: deja que la IA proponga un indice de
              temario. Solo es una propuesta; la revisas antes de aplicarla.
            </p>
          )}
          {aiNotice && <div className="notice success">{aiNotice}</div>}
          {error && <div className="notice error">{error}</div>}
          <div className="row" style={{ marginTop: 12 }}>
            {!aiNotice && summary.imported > 0 && (
              <Button onClick={manualAnalysis} disabled={busy}>
                {busy ? 'Analizando...' : analyzeLabel}
              </Button>
            )}
            <Button variant="secondary" onClick={onDone}>
              Volver al material
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Formulario de carga ---
  return (
    <div>
      <PageHeader
        title="Subir material"
        subtitle="Sube un ZIP, una carpeta o varios PDFs de una vez."
      />
      {error && <div className="notice error">{error}</div>}
      <div className="card" style={{ maxWidth: 560 }}>
        <p className="muted">Que vas a subir?</p>
        <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
          <input
            type="radio"
            name="upload-category"
            checked={category === 'opposition_material'}
            onChange={() => {
              setCategory('opposition_material');
              setRunAnalysis(true);
            }}
          />
          <span>
            <strong>Material de la oposicion</strong>
            <div className="muted small">Temario, apuntes, leyes, esquemas, PDFs de estudio.</div>
          </span>
        </label>
        <label className="row" style={{ gap: 8, cursor: 'pointer', marginTop: 8 }}>
          <input
            type="radio"
            name="upload-category"
            checked={category === 'old_tests'}
            onChange={() => {
              setCategory('old_tests');
              setRunAnalysis(true);
            }}
          />
          <span>
            <strong>Tests antiguos</strong>
            <div className="muted small">Examenes oficiales, simulacros, modelos de examen.</div>
          </span>
        </label>

        <label className="row" style={{ gap: 8, marginTop: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={runAnalysis}
            onChange={(e) => setRunAnalysis(e.target.checked)}
          />
          <span className="small">
            {isOldTests
              ? 'Analizar tests antiguos (estilo y cobertura) despues de importar'
              : 'Crear indice con IA despues de importar'}
          </span>
        </label>

        <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          <label className="btn" style={{ cursor: 'pointer' }}>
            {busy ? 'Subiendo...' : 'Subir ZIP'}
            <input
              type="file"
              accept=".zip,application/zip"
              style={{ display: 'none' }}
              disabled={busy}
              onChange={(e) => onPickZip(e.target.files?.[0] ?? null)}
            />
          </label>
          {FOLDER_SUPPORTED && (
            <label className="btn secondary" style={{ cursor: 'pointer' }}>
              Subir carpeta
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
          <label className="btn secondary" style={{ cursor: 'pointer' }}>
            Subir PDFs
            <input
              type="file"
              multiple
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              style={{ display: 'none' }}
              disabled={busy}
              onChange={(e) => onPickFiles(e.target.files)}
            />
          </label>
        </div>

        {!FOLDER_SUPPORTED && (
          <p className="muted small" style={{ marginTop: 8 }}>
            Tambien puedes comprimir la carpeta en ZIP y subirla aqui.
          </p>
        )}

        <div className="row" style={{ marginTop: 16 }}>
          <Button variant="secondary" small onClick={onPasteText}>
            Pegar texto
          </Button>
          <Button variant="secondary" small onClick={onCancel}>
            Volver
          </Button>
        </div>
      </div>
    </div>
  );
}

// Mensaje de usuario a partir de un error de carga masiva (SPEC 028, 32/33).
function smartUploadErrorMessage(err: unknown): string {
  const codes =
    err && typeof err === 'object' && Array.isArray((err as { codes?: unknown }).codes)
      ? ((err as { codes: string[] }).codes)
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

function MaterialDetail({
  id,
  isAdmin,
  onBack,
}: {
  id: string;
  isAdmin: boolean;
  onBack: () => void;
}) {
  const { store, refresh, currentUser, version } = useStore();
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [reference, setReference] = useState('');
  const [topicTitles, setTopicTitles] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // El facade verifica acceso (oposicion autorizada + material activo para el
  // estudiante). Si no procede, no se expone el material (SPEC 013, 20.4).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!currentUser) {
        if (!cancelled) { setMaterial(null); setLoading(false); }
        return;
      }
      let m: Material | null = null;
      try {
        m = await store.platform.getMaterial(currentUser, id);
      } catch {
        m = null;
      }
      const titles: string[] = [];
      if (m) {
        const links = await store.topicMaterialLinks.findAll({ material_id: m.id });
        for (const link of links) {
          const t = await store.topics.getTopic(link.topic_id);
          if (t?.title) titles.push(t.title);
        }
      }
      if (!cancelled) {
        setMaterial(m);
        setTitle(m?.title ?? '');
        setReference(m?.reference ?? '');
        setTopicTitles(titles);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store, currentUser, id, version]);

  const save = async () => {
    if (!currentUser) return;
    await store.platform.editMaterial(currentUser, id, {
      title,
      reference: reference || null,
    });
    setNotice('Cambios guardados.');
    refresh();
  };

  const markObsolete = async () => {
    if (!currentUser) return;
    if (!window.confirm('Marcar este material como obsoleto?')) return;
    await store.platform.markMaterialObsolete(currentUser, id);
    refresh();
    onBack();
  };

  if (loading) {
    return <div className="loading-state">Cargando...</div>;
  }
  if (!material) {
    return (
      <div>
        <PageHeader
          title="Material"
          action={
            <Button variant="secondary" onClick={onBack}>
              Volver
            </Button>
          }
        />
        <EmptyState message="Este material no esta disponible." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={material.title}
        subtitle={TYPE_LABELS[material.type]}
        action={
          <Button variant="secondary" onClick={onBack}>
            Volver
          </Button>
        }
      />
      {notice && <div className="notice success">{notice}</div>}
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="row spread" style={{ marginBottom: 12 }}>
          <Badge status={material.status} />
        </div>
        {isAdmin ? (
          <>
            <Field label="Titulo">
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Referencia">
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </Field>
            <div className="row">
              <Button onClick={save}>Guardar cambios</Button>
              {material.status !== 'obsolete' && (
                <Button variant="danger" onClick={markObsolete}>
                  Marcar obsoleto
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="small muted">
            {material.description && <div>{material.description}</div>}
            <div>Tipo: {TYPE_LABELS[material.type]}</div>
            <div>Referencia: {material.reference || 'sin referencia'}</div>
            {topicTitles.length > 0 && (
              <div>Temas: {topicTitles.join(', ')}</div>
            )}
          </div>
        )}
      </div>
      {material.extraction_status && (
        <div className="card" style={{ maxWidth: 560 }}>
          <div className="row spread">
            <span className="muted small">Extraccion de texto</span>
            <Badge status={material.extraction_status} />
          </div>
          <div className="small muted" style={{ marginTop: 4 }}>
            {EXTRACTION_LABELS[material.extraction_status] ??
              material.extraction_status}
            {material.page_count != null && ` - ${material.page_count} pag.`}
          </div>
          {material.extraction_error && (
            <div className="small muted" style={{ marginTop: 4 }}>
              {material.extraction_error}
            </div>
          )}
        </div>
      )}
      {material.content_text ? (
        <details className="card" style={{ maxWidth: 560 }}>
          <summary className="muted small">Texto extraido</summary>
          <pre
            className="small"
            style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}
          >
            {material.content_text}
          </pre>
        </details>
      ) : (
        material.original_filename && (
          <div className="card small muted" style={{ maxWidth: 560 }}>
            Este material esta disponible como PDF, pero no tiene texto extraido.
          </div>
        )
      )}
      {/* Detalles internos solo para gestores; nunca exponer storage_path al
          estudiante (SPEC 013, 18). */}
      {isAdmin && (
        <details className="card" style={{ maxWidth: 560 }}>
          <summary className="muted small">Detalles tecnicos</summary>
          <div className="small muted" style={{ marginTop: 8 }}>
            <div>original_filename: {material.original_filename ?? '-'}</div>
            <div>mime_type: {material.mime_type ?? '-'}</div>
            <div>size_bytes: {material.size_bytes ?? '-'}</div>
            <div>storage_path: {material.storage_path ?? '-'}</div>
          </div>
        </details>
      )}
    </div>
  );
}

