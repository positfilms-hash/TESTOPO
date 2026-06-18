// SPEC 020 - Supabase Repositories: Profiles & Workspaces.
//
// Los repos Supabase se ejercitan contra un puerto en memoria (sin red): se
// prueba el mapeo fila<->modelo y los contratos async. El factory elige
// Supabase o InMemory. La integracion con WorkspaceService valida owner/student.

import { describe, expect, it } from 'vitest';
import { InMemorySupabasePort } from '../src/repository/supabase/inMemorySupabasePort.js';
import { SupabaseProfileRepository } from '../src/repository/supabase/supabaseProfileRepository.js';
import { SupabaseWorkspaceRepository } from '../src/repository/supabase/supabaseWorkspaceRepository.js';
import { SupabaseWorkspaceMemberRepository } from '../src/repository/supabase/supabaseWorkspaceMemberRepository.js';
import {
  createCoreRepositories,
  resolvePersistenceMode,
} from '../src/repository/supabase/createCoreRepositories.js';
import { SupabaseRepositoryErrorCode } from '../src/repository/supabase/supabaseRepositoryErrors.js';
import { InMemoryUserRepository } from '../src/repository/inMemoryUserRepository.js';
import { InMemoryWorkspaceRepository } from '../src/repository/inMemoryWorkspaceRepository.js';
import { WorkspaceService } from '../src/service/workspaceService.js';
import { AccessError, AccessErrorCode } from '../src/index.js';
import type { User } from '../src/models/user.js';
import type { Workspace } from '../src/models/workspace.js';
import type { WorkspaceMember } from '../src/models/workspaceMember.js';

const NOW = new Date('2026-06-18T00:00:00.000Z');

function makeUser(id: string, overrides: Partial<User> = {}): User {
  return {
    id,
    name: `User ${id}`,
    email: `${id}@test.com`,
    password_hash: 'should-not-persist',
    role: 'student',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeWorkspace(id: string, overrides: Partial<Workspace> = {}): Workspace {
  return {
    id,
    name: 'WS',
    slug: `ws-${id}`,
    type: 'personal',
    plan: 'free',
    status: 'active',
    owner_id: 'owner',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeMember(id: string, overrides: Partial<WorkspaceMember> = {}): WorkspaceMember {
  return {
    id,
    workspace_id: 'ws-1',
    user_id: 'u-1',
    role: 'student',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

describe('SPEC 020 - SupabaseProfileRepository', () => {
  it('crea, busca por id/email y actualiza sin persistir la contrasena', async () => {
    const repo = new SupabaseProfileRepository(new InMemorySupabasePort());
    const created = await repo.create(makeUser('u-1', { role: 'admin' }));
    expect(created.password_hash).toBe(''); // la contrasena vive en Auth

    expect((await repo.findById('u-1'))?.email).toBe('u-1@test.com');
    expect((await repo.findByEmail('u-1@test.com'))?.id).toBe('u-1');
    expect(await repo.findById('nope')).toBeNull();

    const saved = await repo.save({ ...created, role: 'student', status: 'inactive' });
    expect(saved.role).toBe('student');
    expect(saved.status).toBe('inactive');
  });
});

describe('SPEC 020 - SupabaseWorkspaceRepository', () => {
  it('crea, busca por id/slug, lista y actualiza', async () => {
    const repo = new SupabaseWorkspaceRepository(new InMemorySupabasePort());
    await repo.create(makeWorkspace('w1', { slug: 'alpha' }));
    await repo.create(makeWorkspace('w2', { slug: 'beta' }));

    expect((await repo.findById('w1'))?.slug).toBe('alpha');
    expect((await repo.findBySlug('beta'))?.id).toBe('w2');
    expect(await repo.findAll()).toHaveLength(2);

    const updated = await repo.save({ ...makeWorkspace('w1', { slug: 'alpha' }), status: 'archived' });
    expect(updated.status).toBe('archived');
  });
});

describe('SPEC 020 - SupabaseWorkspaceMemberRepository', () => {
  it('crea, busca membership, lista por usuario/workspace y revoca', async () => {
    const repo = new SupabaseWorkspaceMemberRepository(new InMemorySupabasePort());
    await repo.create(makeMember('m1', { workspace_id: 'ws-1', user_id: 'u-1', role: 'owner' }));
    await repo.create(makeMember('m2', { workspace_id: 'ws-1', user_id: 'u-2' }));

    expect((await repo.find('ws-1', 'u-1'))?.role).toBe('owner');
    expect(await repo.findByWorkspace('ws-1')).toHaveLength(2);
    expect(await repo.findByUser('u-2')).toHaveLength(1);

    const revoked = await repo.save({ ...makeMember('m2', { workspace_id: 'ws-1', user_id: 'u-2' }), status: 'revoked' });
    expect(revoked.status).toBe('revoked');
  });
});

describe('SPEC 020 - factory de persistencia', () => {
  it('usa InMemory por defecto (sin Supabase)', () => {
    const core = createCoreRepositories();
    expect(core.mode).toBe('memory');
    expect(core.users).toBeInstanceOf(InMemoryUserRepository);
    expect(core.workspaces).toBeInstanceOf(InMemoryWorkspaceRepository);
  });

  it('usa Supabase cuando hay puerto y modo supabase', () => {
    const core = createCoreRepositories({
      persistence: 'supabase',
      supabase: new InMemorySupabasePort(),
    });
    expect(core.mode).toBe('supabase');
    expect(core.users).toBeInstanceOf(SupabaseProfileRepository);
    expect(core.workspaceMembers).toBeInstanceOf(SupabaseWorkspaceMemberRepository);
  });

  it('cae a memoria si se pide supabase sin puerto', () => {
    expect(resolvePersistenceMode('supabase', false)).toBe('memory');
    const core = createCoreRepositories({ persistence: 'supabase' });
    expect(core.mode).toBe('memory');
  });

  it('modo invalido lanza error claro', () => {
    expect(() => resolvePersistenceMode('postgres', false)).toThrow();
    try {
      createCoreRepositories({ persistence: 'postgres' });
      throw new Error('deberia haber lanzado');
    } catch (error) {
      expect((error as { code?: string }).code).toBe(
        SupabaseRepositoryErrorCode.PERSISTENCE_MODE_INVALID,
      );
    }
  });
});

describe('SPEC 020 - integracion WorkspaceService sobre Supabase (puerto en memoria)', () => {
  function makeService() {
    const core = createCoreRepositories({
      persistence: 'supabase',
      supabase: new InMemorySupabasePort(),
    });
    return new WorkspaceService(core.workspaces, core.workspaceMembers);
  }

  it('crea workspace personal inicial con owner como miembro owner', async () => {
    const service = makeService();
    const owner = makeUser('owner-1');
    const ws = await service.createPersonalWorkspace(owner, {
      name: 'Mi espacio',
      slug: 'mi-espacio',
      plan: 'free',
    });
    expect(ws.owner_id).toBe('owner-1');
    expect(await service.getMemberRole('owner-1', ws.id)).toBe('owner');
    expect((await service.listForUser(owner)).map((w) => w.id)).toContain(ws.id);
  });

  it('owner gestiona miembros; no duplica membership', async () => {
    const service = makeService();
    const owner = makeUser('owner-2');
    const student = makeUser('stu-1');
    const ws = await service.createOrganizationWorkspace(owner, {
      name: 'Academia',
      slug: 'academia',
    });
    await service.addMember(owner, {
      workspace_id: ws.id,
      user_id: student.id,
      role: 'student',
    });
    expect(await service.getMemberRole('stu-1', ws.id)).toBe('student');

    await expect(
      service.addMember(owner, { workspace_id: ws.id, user_id: student.id, role: 'student' }),
    ).rejects.toBeInstanceOf(AccessError);
  });

  it('un student no puede gestionar el workspace', async () => {
    const service = makeService();
    const owner = makeUser('owner-3');
    const student = makeUser('stu-2');
    const ws = await service.createOrganizationWorkspace(owner, {
      name: 'Academia 2',
      slug: 'academia-2',
    });
    await service.addMember(owner, { workspace_id: ws.id, user_id: student.id, role: 'student' });

    try {
      await service.addMember(student, { workspace_id: ws.id, user_id: 'x', role: 'student' });
      throw new Error('deberia haber lanzado');
    } catch (error) {
      expect(error).toBeInstanceOf(AccessError);
      expect((error as AccessError).codes).toContain(
        AccessErrorCode.WORKSPACE_ACCESS_DENIED,
      );
    }
  });
});
