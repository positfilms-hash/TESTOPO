// Primitivas de UI reutilizables (SPEC 009, 19). Simples, sin design system.

import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header row spread">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
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

export function EmptyState({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>;
}

export function LoadingState() {
  return <div className="loading-state">Cargando…</div>;
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
