// SPEC 021 - Supabase Repositories: Oppositions & Access.
//
// Los repos Supabase se ejercitan contra un puerto en memoria (sin red): se
// prueba el mapeo fila<->modelo y los contratos async. El factory incluye ahora
// oppositions/opposition_access. La integracion con OppositionService valida las
// reglas de negocio sobre workspaces reales (puerto en memoria).

import { describe, expect, it } from 'vitest';
import { InMemorySupabasePort } from '../src/repository/supabase/inMemorySupabasePort.js';
import { SupabaseOppositionRepository } from '../src/repository/supabase/supabaseOppositionRepository.js';
import { SupabaseOppositionAccessRepository } from '../src/repository/supabase/supabaseOppositionAccessRepository.js';
import { createCoreRepositories } from '../src/repository/supabase/createCoreRepositories.js';
import { InMemoryOppositionRepository } from '../src/repository/inMemoryOppositionRepository.js';
import { InMemoryOppositionAccessRepository } from '../src/repository/inMemoryOppositionAccessRepository.js';
import { WorkspaceService } from '../src/service/workspaceService.js';
import { OppositionService } from '../src/service/oppositionService.js';
import { AccessError, AccessErrorCode } from '../src/index.js';
import type { User } from '../src/models/user.js';
import type { Opposition } from '../src/models/opposition.js';
import type { OppositionAccess } from '../src/models/oppositionAccess.js';

const NOW = new Date('2026-06-18T00:00:00.000Z');

function makeUser(id: string, overrides: Partial<User> = {}): User {
  return {
    id,
    name: `User ${id}`,
    email: `${id}@test.com`,
    password_hash: 'x',
    role: 'student',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeOpposition(id: string, overrides: Partial<Opposition> = {}): Opposition {
  return {
    id,
    workspace_id: 'ws-1',
    title: `Oposicion ${id}`,
    description: null,
    slug: `opo-${id}`,
    status: 'active',
    created_by: 'owner',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeAccess(id: string, overrides: Partial<OppositionAccess> = {}): OppositionAccess {
  return {
    id,
    user_id: 'u-1',
    opposition_id: 'opo-1',
    role_in_opposition: 'student',
    status: 'active',
    granted_by: 'owner',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

describe('SPEC 021 - SupabaseOppositionRepository', () => {
  it('crea, busca por id/slug, lista y actualiza', async () => {
    const repo = new SupabaseOppositionRepository(new InMemorySupabasePort());
    await repo.create(makeOpposition('o1', { slug: 'alpha' }));
    await repo.create(makeOpposition('o2', { slug: 'beta' }));

    expect((await repo.findById('o1'))?.slug).toBe('alpha');
    expect((await repo.findBySlug('beta'))?.id).toBe('o2');
    expect(await repo.findAll()).toHaveLength(2);
    expect(await repo.findById('nope')).toBeNull();

    const archived = await repo.save({ ...makeOpposition('o1', { slug: 'alpha' }), status: 'archived' });
    expect(archived.status).toBe('archived');
  });
});

describe('SPEC 021 - SupabaseOppositionAccessRepository', () => {
  it('crea, busca, lista por usuario/oposicion y revoca', async () => {
    const repo = new SupabaseOppositionAccessRepository(new InMemorySupabasePort());
    await repo.create(makeAccess('a1', { user_id: 'u-1', opposition_id: 'opo-1', role_in_opposition: 'owner' }));
    await repo.create(makeAccess('a2', { user_id: 'u-2', opposition_id: 'opo-1' }));

    expect((await repo.find('u-1', 'opo-1'))?.role_in_opposition).toBe('owner');
    expect(await repo.findByOpposition('opo-1')).toHaveLength(2);
    expect(await repo.findByUser('u-2')).toHaveLength(1);

    const revoked = await repo.save({ ...makeAccess('a2', { user_id: 'u-2', opposition_id: 'opo-1' }), status: 'revoked' });
    expect(revoked.status).toBe('revoked');
  });
});

describe('SPEC 021 - factory incluye oppositions/access', () => {
  it('usa InMemory por defecto', () => {
    const core = createCoreRepositories();
    expect(core.oppositions).toBeInstanceOf(InMemoryOppositionRepository);
    expect(core.oppositionAccess).toBeInstanceOf(InMemoryOppositionAccessRepository);
  });

  it('usa Supabase para oppositions/access cuando hay puerto y modo supabase', () => {
    const core = createCoreRepositories({
      persistence: 'supabase',
      supabase: new InMemorySupabasePort(),
    });
    expect(core.oppositions).toBeInstanceOf(SupabaseOppositionRepository);
    expect(core.oppositionAccess).toBeInstanceOf(SupabaseOppositionAccessRepository);
  });
});

describe('SPEC 021 - integracion OppositionService sobre Supabase (puerto en memoria)', () => {
  function makeStack() {
    const core = createCoreRepositories({
      persistence: 'supabase',
      supabase: new InMemorySupabasePort(),
    });
    const workspaces = new WorkspaceService(core.workspaces, core.workspaceMembers);
    const oppositions = new OppositionService(
      core.oppositions,
      core.oppositionAccess,
      core.workspaceMembers,
    );
    return { workspaces, oppositions };
  }

  it('owner/admin crea oposicion con workspace valido; el creador queda owner', async () => {
    const { workspaces, oppositions } = makeStack();
    const owner = makeUser('owner-1');
    const ws = await workspaces.createOrganizationWorkspace(owner, {
      name: 'Academia',
      slug: 'academia',
    });
    const opo = await oppositions.createOpposition(owner, {
      workspace_id: ws.id,
      title: 'Oposicion A',
      slug: 'opo-a',
    });
    expect(opo.workspace_id).toBe(ws.id);
    expect(opo.created_by).toBe('owner-1');
    expect((await oppositions.listForUser(owner)).map((o) => o.id)).toContain(opo.id);
  });

  it('no crea oposicion sin workspace', async () => {
    const { oppositions } = makeStack();
    const owner = makeUser('owner-2');
    await expect(
      oppositions.createOpposition(owner, { title: 'X', slug: 'x' }),
    ).rejects.toBeInstanceOf(AccessError);
  });

  it('no crea oposicion con slug duplicado (unicidad global)', async () => {
    const { workspaces, oppositions } = makeStack();
    const owner = makeUser('owner-3');
    const wsA = await workspaces.createOrganizationWorkspace(owner, { name: 'A', slug: 'a' });
    const wsB = await workspaces.createOrganizationWorkspace(owner, { name: 'B', slug: 'b' });
    await oppositions.createOpposition(owner, { workspace_id: wsA.id, title: 'A', slug: 'dup' });
    await expect(
      oppositions.createOpposition(owner, { workspace_id: wsB.id, title: 'B', slug: 'dup' }),
    ).rejects.toMatchObject({ codes: [AccessErrorCode.OPPOSITION_SLUG_ALREADY_EXISTS] });
  });

  it('student no puede crear oposicion', async () => {
    const { workspaces, oppositions } = makeStack();
    const owner = makeUser('owner-4');
    const student = makeUser('stu-1');
    const ws = await workspaces.createOrganizationWorkspace(owner, { name: 'C', slug: 'c' });
    await workspaces.addMember(owner, { workspace_id: ws.id, user_id: student.id, role: 'student' });
    await expect(
      oppositions.createOpposition(student, { workspace_id: ws.id, title: 'Z', slug: 'z' }),
    ).rejects.toMatchObject({ codes: [AccessErrorCode.WORKSPACE_ACCESS_DENIED] });
  });

  it('conceder acceso, no duplicar y revocar (revoked no permite entrar)', async () => {
    const { workspaces, oppositions } = makeStack();
    const owner = makeUser('owner-5');
    const student = makeUser('stu-2');
    const ws = await workspaces.createOrganizationWorkspace(owner, { name: 'D', slug: 'd' });
    await workspaces.addMember(owner, { workspace_id: ws.id, user_id: student.id, role: 'student' });
    const opo = await oppositions.createOpposition(owner, { workspace_id: ws.id, title: 'D', slug: 'opo-d' });

    await oppositions.grantAccess(owner, { user_id: student.id, opposition_id: opo.id });
    // El estudiante con acceso activo ve la oposicion.
    expect((await oppositions.listForUser(student)).map((o) => o.id)).toContain(opo.id);

    // No se duplica el acceso activo.
    await expect(
      oppositions.grantAccess(owner, { user_id: student.id, opposition_id: opo.id }),
    ).rejects.toMatchObject({ codes: [AccessErrorCode.OPPOSITION_ACCESS_ALREADY_EXISTS] });

    // Revocado: el estudiante ya no puede entrar.
    await oppositions.revokeAccess(owner, { user_id: student.id, opposition_id: opo.id });
    await expect(oppositions.getOpposition(student, opo.id)).rejects.toBeInstanceOf(AccessError);
  });

  it('student solo ve oposiciones autorizadas y no las de otros workspaces', async () => {
    const { workspaces, oppositions } = makeStack();
    const owner = makeUser('owner-6');
    const student = makeUser('stu-3');
    const ws = await workspaces.createOrganizationWorkspace(owner, { name: 'E', slug: 'e' });
    await workspaces.addMember(owner, { workspace_id: ws.id, user_id: student.id, role: 'student' });
    const visible = await oppositions.createOpposition(owner, { workspace_id: ws.id, title: 'V', slug: 'vis' });
    await oppositions.createOpposition(owner, { workspace_id: ws.id, title: 'H', slug: 'hid' });
    await oppositions.grantAccess(owner, { user_id: student.id, opposition_id: visible.id });

    // Oposicion en otro workspace donde el student no es miembro.
    const other = makeUser('owner-7');
    const wsOther = await workspaces.createOrganizationWorkspace(other, { name: 'F', slug: 'f' });
    await oppositions.createOpposition(other, { workspace_id: wsOther.id, title: 'O', slug: 'other' });

    const ids = (await oppositions.listForUser(student)).map((o) => o.id);
    expect(ids).toEqual([visible.id]);
  });

  it('archiva una oposicion', async () => {
    const { workspaces, oppositions } = makeStack();
    const owner = makeUser('owner-8');
    const ws = await workspaces.createOrganizationWorkspace(owner, { name: 'G', slug: 'g' });
    const opo = await oppositions.createOpposition(owner, { workspace_id: ws.id, title: 'G', slug: 'opo-g' });
    const archived = await oppositions.editOpposition(owner, opo.id, { status: 'archived' });
    expect(archived.status).toBe('archived');
  });
});
