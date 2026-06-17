import { describe, expect, it } from 'vitest';
import { InMemoryUserRepository } from '../src/repository/inMemoryUserRepository.js';
import { InMemoryWorkspaceRepository } from '../src/repository/inMemoryWorkspaceRepository.js';
import { InMemoryWorkspaceMemberRepository } from '../src/repository/inMemoryWorkspaceMemberRepository.js';
import { InMemoryOppositionRepository } from '../src/repository/inMemoryOppositionRepository.js';
import { InMemoryOppositionAccessRepository } from '../src/repository/inMemoryOppositionAccessRepository.js';
import { UserService } from '../src/service/userService.js';
import { WorkspaceService } from '../src/service/workspaceService.js';
import { OppositionService } from '../src/service/oppositionService.js';
import { AccessError } from '../src/access/accessError.js';
import { AccessErrorCode } from '../src/access/accessErrors.js';
import type { WorkspaceRole } from '../src/models/workspaceMember.js';

async function makeSetup() {
  const users = new UserService(new InMemoryUserRepository());
  const memberRepo = new InMemoryWorkspaceMemberRepository();
  const workspaces = new WorkspaceService(
    new InMemoryWorkspaceRepository(),
    memberRepo,
  );
  const oppositions = new OppositionService(
    new InMemoryOppositionRepository(),
    new InMemoryOppositionAccessRepository(),
    memberRepo,
  );
  const admin = await users.createUser({
    email: 'admin@test.com',
    password: 'x',
    role: 'admin',
  });
  const student = await users.createUser({
    email: 'student@test.com',
    password: 'y',
    role: 'student',
  });
  return { users, workspaces, oppositions, memberRepo, admin, student };
}

async function expectAccessError(fn: () => unknown, code: AccessErrorCode): Promise<void> {
  try {
    await fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AccessError);
    expect((error as AccessError).codes).toContain(code);
    return;
  }
  throw new Error(`Expected AccessError (${code})`);
}

describe('SPEC 011 - creacion de workspaces', () => {
  it('crea workspace personal y de organizacion', async () => {
    const { workspaces, admin } = await makeSetup();
    const personal = await workspaces.createPersonalWorkspace(admin, {
      name: 'Mi preparacion',
      slug: 'mi-preparacion',
      plan: 'premium',
    });
    const org = await workspaces.createOrganizationWorkspace(admin, {
      name: 'Academia OpoNorte',
      slug: 'academia-oponorte',
    });
    expect(personal.type).toBe('personal');
    expect(personal.plan).toBe('premium');
    expect(org.type).toBe('organization');
    expect(org.plan).toBe('organization');
  });

  it('el owner queda como miembro activo', async () => {
    const { workspaces, memberRepo, admin } = await makeSetup();
    const ws = await workspaces.createOrganizationWorkspace(admin, {
      name: 'Org',
      slug: 'org',
    });
    const member = await memberRepo.find(ws.id, admin.id);
    expect(member?.role).toBe('owner');
    expect(member?.status).toBe('active');
  });

  it('no permite workspace sin nombre', async () => {
    const { workspaces, admin } = await makeSetup();
    await expectAccessError(
      () => workspaces.createOrganizationWorkspace(admin, { slug: 'x' }),
      AccessErrorCode.WORKSPACE_NAME_REQUIRED,
    );
  });

  it('no permite slug duplicado', async () => {
    const { workspaces, admin } = await makeSetup();
    await workspaces.createOrganizationWorkspace(admin, { name: 'A', slug: 'dup' });
    await expectAccessError(
      () => workspaces.createOrganizationWorkspace(admin, { name: 'B', slug: 'dup' }),
      AccessErrorCode.WORKSPACE_SLUG_ALREADY_EXISTS,
    );
  });

  it('no permite plan invalido en workspace personal', async () => {
    const { workspaces, admin } = await makeSetup();
    await expectAccessError(
      () =>
        workspaces.createPersonalWorkspace(admin, {
          name: 'X',
          slug: 'x',
          plan: 'organization',
        }),
      AccessErrorCode.WORKSPACE_INVALID_PLAN,
    );
  });
});

describe('SPEC 011 - membresia y visibilidad', () => {
  it('lista solo los workspaces donde el usuario es miembro activo', async () => {
    const { workspaces, admin, student } = await makeSetup();
    const ws = await workspaces.createOrganizationWorkspace(admin, {
      name: 'Org',
      slug: 'org',
    });
    expect((await workspaces.listForUser(admin)).map((w) => w.id)).toContain(ws.id);
    expect(await workspaces.listForUser(student)).toHaveLength(0);
    await expectAccessError(
      () => workspaces.getWorkspace(student, ws.id),
      AccessErrorCode.WORKSPACE_ACCESS_DENIED,
    );
  });

  it('anade student y admin; rechaza rol invalido', async () => {
    const { workspaces, admin, student } = await makeSetup();
    const ws = await workspaces.createOrganizationWorkspace(admin, {
      name: 'Org',
      slug: 'org',
    });
    await workspaces.addMember(admin, {
      workspace_id: ws.id,
      user_id: student.id,
      role: 'student',
    });
    expect((await workspaces.listForUser(student)).map((w) => w.id)).toContain(ws.id);
    await expectAccessError(
      () =>
        workspaces.addMember(admin, {
          workspace_id: ws.id,
          user_id: student.id,
          role: 'owner' as WorkspaceRole,
        }),
      AccessErrorCode.WORKSPACE_MEMBER_INVALID_ROLE,
    );
  });

  it('revoca un miembro y deja de tener acceso', async () => {
    const { workspaces, admin, student } = await makeSetup();
    const ws = await workspaces.createOrganizationWorkspace(admin, {
      name: 'Org',
      slug: 'org',
    });
    await workspaces.addMember(admin, {
      workspace_id: ws.id,
      user_id: student.id,
      role: 'student',
    });
    await workspaces.revokeMember(admin, { workspace_id: ws.id, user_id: student.id });
    expect(await workspaces.listForUser(student)).toHaveLength(0);
    await expectAccessError(
      () => workspaces.getWorkspace(student, ws.id),
      AccessErrorCode.WORKSPACE_ACCESS_DENIED,
    );
  });
});

describe('SPEC 011 - oposiciones dentro de workspace', () => {
  it('un owner/admin crea oposicion dentro de su workspace', async () => {
    const { workspaces, oppositions, admin } = await makeSetup();
    const ws = await workspaces.createOrganizationWorkspace(admin, {
      name: 'Org',
      slug: 'org',
    });
    const opp = await oppositions.createOpposition(admin, {
      workspace_id: ws.id,
      title: 'Auxiliar',
      slug: 'auxiliar',
    });
    expect(opp.workspace_id).toBe(ws.id);
  });

  it('no se puede crear oposicion sin workspace', async () => {
    const { oppositions, admin } = await makeSetup();
    await expectAccessError(
      () => oppositions.createOpposition(admin, { title: 'X', slug: 'x' }),
      AccessErrorCode.OPPOSITION_WORKSPACE_REQUIRED,
    );
  });

  it('un student no puede crear oposicion', async () => {
    const { workspaces, oppositions, admin, student } = await makeSetup();
    const ws = await workspaces.createOrganizationWorkspace(admin, {
      name: 'Org',
      slug: 'org',
    });
    await expectAccessError(
      () =>
        oppositions.createOpposition(student, {
          workspace_id: ws.id,
          title: 'X',
          slug: 'x',
        }),
      AccessErrorCode.WORKSPACE_ACCESS_DENIED,
    );
  });

  it('no se puede crear oposicion en un workspace que no gestionas', async () => {
    const { users, workspaces, oppositions, admin } = await makeSetup();
    const otroAdmin = await users.createUser({
      email: 'admin2@test.com',
      password: 'z',
      role: 'admin',
    });
    const wsAjeno = await workspaces.createOrganizationWorkspace(otroAdmin, {
      name: 'Ajeno',
      slug: 'ajeno',
    });
    await expectAccessError(
      () =>
        oppositions.createOpposition(admin, {
          workspace_id: wsAjeno.id,
          title: 'X',
          slug: 'x',
        }),
      AccessErrorCode.WORKSPACE_ACCESS_DENIED,
    );
  });
});
