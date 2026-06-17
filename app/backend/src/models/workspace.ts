// Workspace: entidad superior que agrupa oposiciones (SPEC 011). Un workspace
// puede ser el espacio personal de un opositor o la cuenta de una organizacion.

export const WORKSPACE_TYPES = ['personal', 'organization'] as const;
export type WorkspaceType = (typeof WORKSPACE_TYPES)[number];

export const WORKSPACE_PLANS = ['free', 'premium', 'organization'] as const;
export type WorkspacePlan = (typeof WORKSPACE_PLANS)[number];

export const WORKSPACE_STATUSES = [
  'active',
  'inactive',
  'suspended',
  'archived',
] as const;
export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  type: WorkspaceType;
  plan: WorkspacePlan;
  status: WorkspaceStatus;
  owner_id: string;
  created_at: Date;
  updated_at: Date;
}

// Limites por plan (SPEC 011, 16). Estructura preparada; no se aplican pagos ni
// bloqueos complejos en esta spec. `null` = sin limite practico.
export interface PlanLimits {
  max_workspaces: number | null;
  max_oppositions: number | null;
  max_materials: number | null;
  max_generated_questions: number | null;
}

export const PLAN_LIMITS: Record<WorkspacePlan, PlanLimits> = {
  free: {
    max_workspaces: 1,
    max_oppositions: 1,
    max_materials: 3,
    max_generated_questions: 50,
  },
  premium: {
    max_workspaces: 1,
    max_oppositions: 5,
    max_materials: 100,
    max_generated_questions: 5000,
  },
  organization: {
    max_workspaces: null,
    max_oppositions: null,
    max_materials: null,
    max_generated_questions: null,
  },
};

export function isWorkspaceType(value: unknown): value is WorkspaceType {
  return WORKSPACE_TYPES.includes(value as WorkspaceType);
}

export function isWorkspacePlan(value: unknown): value is WorkspacePlan {
  return WORKSPACE_PLANS.includes(value as WorkspacePlan);
}

export function isWorkspaceStatus(value: unknown): value is WorkspaceStatus {
  return WORKSPACE_STATUSES.includes(value as WorkspaceStatus);
}
