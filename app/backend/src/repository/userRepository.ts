import type { User } from '../models/user.js';

export interface UserRepository {
  create(user: User): User;
  findById(id: string): User | null;
  findByEmail(email: string): User | null;
  save(user: User): User;
}
