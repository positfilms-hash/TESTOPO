// Repositorio Supabase de perfiles (SPEC 020). Implementa `UserRepository`
// mapeando el modelo `User` a la tabla `profiles`.
//
// La contrasena la gestiona Supabase Auth: NUNCA se guarda en `profiles`. Al
// leer, `password_hash` queda vacio (la autenticacion real vive en Auth).

import type { User, UserRole, UserStatus } from '../../models/user.js';
import type { UserRepository } from '../userRepository.js';
import type { SupabaseClientPort, SupabaseRow } from './supabaseClientPort.js';

const TABLE = 'profiles';

export class SupabaseProfileRepository implements UserRepository {
  constructor(private readonly port: SupabaseClientPort) {}

  async create(user: User): Promise<User> {
    const row = await this.port.table(TABLE).insert({
      id: user.id,
      email: user.email,
      name: user.name || null,
      role: user.role,
      status: user.status,
      created_at: iso(user.created_at),
      updated_at: iso(user.updated_at),
    });
    return toUser(row);
  }

  async findById(id: string): Promise<User | null> {
    const rows = await this.port.table(TABLE).selectMatch({ id });
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.port.table(TABLE).selectMatch({ email });
    return rows[0] ? toUser(rows[0]) : null;
  }

  async save(user: User): Promise<User> {
    const row = await this.port.table(TABLE).updateById(user.id, {
      email: user.email,
      name: user.name || null,
      role: user.role,
      status: user.status,
      updated_at: iso(user.updated_at),
    });
    return toUser(row);
  }
}

function toUser(row: SupabaseRow): User {
  return {
    id: String(row.id),
    name: typeof row.name === 'string' ? row.name : '',
    email: String(row.email ?? ''),
    // La contrasena vive en Supabase Auth, no en `profiles`.
    password_hash: '',
    role: (row.role as UserRole) ?? 'student',
    status: (row.status as UserStatus) ?? 'active',
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

export function iso(date: Date): string {
  return date instanceof Date ? date.toISOString() : new Date().toISOString();
}

export function parseDate(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d;
    }
  }
  return new Date();
}
