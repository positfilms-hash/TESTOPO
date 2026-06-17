import type { User } from '../models/user.js';
import type { UserRepository } from './userRepository.js';

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  create(user: User): User {
    this.users.set(user.id, clone(user));
    return clone(user);
  }

  findById(id: string): User | null {
    const user = this.users.get(id);
    return user ? clone(user) : null;
  }

  findByEmail(email: string): User | null {
    const needle = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === needle) {
        return clone(user);
      }
    }
    return null;
  }

  save(user: User): User {
    this.users.set(user.id, clone(user));
    return clone(user);
  }
}

function clone(user: User): User {
  return structuredClone(user);
}
