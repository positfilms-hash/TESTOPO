// Errores de persistencia Supabase (SPEC 020, 18). Los errores de NO_FOUND y de
// reglas de negocio se mantienen en la capa de servicios; aqui solo los de
// configuracion/consulta/persistencia.

export enum SupabaseRepositoryErrorCode {
  SUPABASE_NOT_CONFIGURED = 'SUPABASE_NOT_CONFIGURED',
  SUPABASE_QUERY_FAILED = 'SUPABASE_QUERY_FAILED',
  PERSISTENCE_MODE_INVALID = 'PERSISTENCE_MODE_INVALID',
  PROFILE_CREATE_FAILED = 'PROFILE_CREATE_FAILED',
  PROFILE_UPDATE_FAILED = 'PROFILE_UPDATE_FAILED',
  WORKSPACE_CREATE_FAILED = 'WORKSPACE_CREATE_FAILED',
  WORKSPACE_UPDATE_FAILED = 'WORKSPACE_UPDATE_FAILED',
  WORKSPACE_MEMBER_CREATE_FAILED = 'WORKSPACE_MEMBER_CREATE_FAILED',
  WORKSPACE_MEMBER_UPDATE_FAILED = 'WORKSPACE_MEMBER_UPDATE_FAILED',
}

export class SupabaseRepositoryError extends Error {
  readonly code: SupabaseRepositoryErrorCode;

  constructor(code: SupabaseRepositoryErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'SupabaseRepositoryError';
    this.code = code;
  }
}
