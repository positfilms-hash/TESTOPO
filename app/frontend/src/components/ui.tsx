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

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  pending_review: 'Pendiente',
  validated: 'Validada',
  needs_fix: 'Necesita correccion',
  rejected: 'Rechazada',
  obsolete: 'Obsoleta',
  active: 'Activa',
  deprecated: 'Anticuada',
  needs_review: 'Revisar',
};

export function Badge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{STATUS_LABELS[status] ?? status}</span>;
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
