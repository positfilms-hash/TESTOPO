// Usuarios y autenticacion basica del MVP (SPEC 010, 7-8, 14.1-14.3).

import { randomUUID } from 'node:crypto';
import {
  isUserRole,
  isUserStatus,
  type User,
  type UserRole,
  type UserStatus,
} from '../models/user.js';
import type { UserRepository } from '../repository/userRepository.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { AccessError } from '../access/accessError.js';
import { AccessErrorCode } from '../access/accessErrors.js';

export interface CreateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface UserServiceOptions {
  generateId?: () => string;
  now?: () => Date;
}

export class UserService {
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(
    private readonly repository: UserRepository,
    options: UserServiceOptions = {},
  ) {
    this.generateId = options.generateId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async createUser(input: CreateUserInput): Promise<User> {
    if (!isNonEmptyString(input.email)) {
      throw new AccessError([AccessErrorCode.USER_EMAIL_REQUIRED]);
    }
    if (!isNonEmptyString(input.password)) {
      throw new AccessError([AccessErrorCode.USER_PASSWORD_REQUIRED]);
    }
    if (!isUserRole(input.role)) {
      throw new AccessError([AccessErrorCode.USER_INVALID_ROLE]);
    }
    const status: UserStatus = input.status ?? 'active';
    if (!isUserStatus(status)) {
      throw new AccessError([AccessErrorCode.USER_INVALID_STATUS]);
    }
    if (await this.repository.findByEmail(input.email)) {
      throw new AccessError([AccessErrorCode.USER_EMAIL_ALREADY_EXISTS]);
    }

    const timestamp = this.now();
    return this.repository.create({
      id: this.generateId(),
      name: input.name ?? input.email,
      email: input.email,
      password_hash: hashPassword(input.password),
      role: input.role,
      status,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  // 14.2 Login. Devuelve el usuario si las credenciales son validas.
  async authenticate(email: string, password: string): Promise<User> {
    const user = await this.repository.findByEmail(email ?? '');
    if (
      !user ||
      user.status !== 'active' ||
      !verifyPassword(password ?? '', user.password_hash)
    ) {
      throw new AccessError([AccessErrorCode.AUTH_INVALID_CREDENTIALS]);
    }
    return user;
  }

  // 14.3 Usuario actual.
  async getUser(id: string): Promise<User | null> {
    return this.repository.findById(id);
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
