import type { User } from '../models/user.js';
import type { UserRepository } from './userRepository.js';

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  async create(user: User): Promise<User> {
    this.users.set(user.id, clone(user));
    return clone(user);
  }

  async findById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    return user ? clone(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const needle = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === needle) {
        return clone(user);
      }
    }
    return null;
  }

  async save(user: User): Promise<User> {
    this.users.set(user.id, clone(user));
    return clone(user);
  }
}

function clone(user: User): User {
  return structuredClone(user);
}
