// Primitivas de UI reutilizables (SPEC 009, 19). Simples, sin design system.

import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  action,
}: {
  title: string;
  subtitle?: string;
  /** Etiqueta corta sobre el titulo (mayusculas) para situar la seccion. */
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header row spread">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// Icono de archivo (SVG inline, sin dependencias): da el aire de biblioteca de
// documentos a la lista de Material. Decorativo (aria-hidden).
export function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M6 2.75h7L19.25 9v11.25A1 1 0 0 1 18.25 21.25H6A1 1 0 0 1 5 20.25V3.75A1 1 0 0 1 6 2.75Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M13 3v6h6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function Card({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div className="card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      {children}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
  small?: boolean;
};

export function Button({
  variant = 'primary',
  small,
  className = '',
  ...props
}: ButtonProps) {
  const classes = ['btn', variant === 'primary' ? '' : variant, small ? 'small' : '', className]
    .filter(Boolean)
    .join(' ');
  return <button className={classes} {...props} />;
}

// Etiquetas en espanol para todos los estados que pueden mostrarse en la UI
// (SPEC 016, 9.5): nunca debe verse el valor interno en ingles (`draft`,
// `pending_review`, `completed`, `revoked`...).
const STATUS_LABELS: Record<string, string> = {
  // Preguntas (SPEC 001/006)
  draft: 'Borrador',
  pending_review: 'Pendiente',
  validated: 'Validada',
  needs_fix: 'Necesita correccion',
  rejected: 'Rechazada',
  obsolete: 'Obsoleta',
  // Material / fuentes / temas (SPEC 002/003)
  active: 'Activo',
  deprecated: 'Anticuado',
  needs_review: 'Por revisar',
  // Extraccion de texto de PDF (SPEC 012)
  not_started: 'Sin procesar',
  processing: 'Procesando',
  completed: 'Completado',
  failed: 'Fallido',
  not_supported: 'Sin texto',
  // Tests e intentos (SPEC 007/008)
  created: 'Creado',
  in_progress: 'En curso',
  submitted: 'Enviado',
  cancelled: 'Cancelado',
  // Acceso / workspace / usuario (SPEC 010/011)
  revoked: 'Revocado',
  pending: 'Pendiente',
  inactive: 'Inactivo',
  suspended: 'Suspendido',
  archived: 'Archivado',
  blocked: 'Bloqueado',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Facil',
  medium: 'Media',
  hard: 'Dificil',
  mixed: 'Mixta',
};

// Convierte un valor desconocido en algo legible (sin guiones bajos ni ingles
// crudo) como ultimo recurso, para que nunca se filtre un valor tecnico.
function humanize(value: string): string {
  const text = value.replace(/_/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : value;
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? humanize(status);
}

export function difficultyLabel(difficulty: string): string {
  return DIFFICULTY_LABELS[difficulty] ?? humanize(difficulty);
}

export function Badge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{statusLabel(status)}</span>;
}

// --- OCR de PDFs escaneados (SPEC 030). Estado operativo por archivo, solo para
// gestores. Mapea `extraction_status` a una etiqueta clara en espanol + un tono. ---
export type OcrTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const OCR_STATUS: Record<string, { label: string; tone: OcrTone }> = {
  completed: { label: 'Texto extraido', tone: 'success' },
  scanned_detected: { label: 'Escaneo detectado', tone: 'info' },
  ocr_processing: { label: 'Leyendo escaneo', tone: 'info' },
  completed_ocr: { label: 'Leido con OCR', tone: 'success' },
  completed_ocr_with_warnings: { label: 'OCR con advertencias', tone: 'warning' },
  ocr_failed: { label: 'No se pudo leer', tone: 'danger' },
};

// Estados desde los que un gestor puede (re)lanzar OCR (coinciden con
// MaterialOcrService.OCR_ELIGIBLE en el backend).
const OCR_ELIGIBLE = new Set([
  'scanned_detected',
  'completed_ocr_with_warnings',
  'ocr_failed',
]);

// Estados que son resultado de un run de OCR (procede mostrar el detalle compacto).
const OCR_OUTCOME = new Set([
  'completed_ocr',
  'completed_ocr_with_warnings',
  'ocr_failed',
]);

export function ocrStatusInfo(
  extractionStatus: string | null | undefined,
): { label: string; tone: OcrTone } | null {
  return extractionStatus ? OCR_STATUS[extractionStatus] ?? null : null;
}

export function ocrCanRetry(extractionStatus: string | null | undefined): boolean {
  return OCR_ELIGIBLE.has(extractionStatus ?? '');
}

// Es el PRIMER OCR (boton "Leer escaneo") frente a un reintento ("Reintentar OCR").
export function ocrIsFirstRun(extractionStatus: string | null | undefined): boolean {
  return extractionStatus === 'scanned_detected';
}

export function ocrHasOutcome(extractionStatus: string | null | undefined): boolean {
  return OCR_OUTCOME.has(extractionStatus ?? '');
}

// Revision Codex (R2-2): el OCR es SIMULADO cuando el proveedor es el mock (no hay
// Edge Function real configurada). La UI no debe anunciarlo como OCR real.
export function ocrIsSimulated(provider: string | null | undefined): boolean {
  return provider === 'mock-ocr';
}

export function OcrBadge({ extractionStatus }: { extractionStatus: string | null | undefined }) {
  const info = ocrStatusInfo(extractionStatus);
  if (!info) return null;
  return <span className={`badge ocr-${info.tone}`}>{info.label}</span>;
}

export function EmptyState({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>;
}

export function LoadingState({ message }: { message?: string } = {}) {
  return <div className="loading-state">{message ?? 'Cargando…'}</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="error-state">{message}</div>;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
