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

function makeSetup() {
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
  const admin = users.createUser({
    email: 'admin@test.com',
    password: 'x',
    role: 'admin',
  });
  const student = users.createUser({
    email: 'student@test.com',
    password: 'y',
    role: 'student',
  });
  return { users, workspaces, oppositions, memberRepo, admin, student };
}

function expectAccessError(fn: () => unknown, code: AccessErrorCode): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AccessError);
    expect((error as AccessError).codes).toContain(code);
    return;
  }
  throw new Error(`Expected AccessError (${code})`);
}

describe('SPEC 011 - creacion de workspaces', () => {
  it('crea workspace personal y de organizacion', () => {
    const { workspaces, admin } = makeSetup();
    const personal = workspaces.createPersonalWorkspace(admin, {
      name: 'Mi preparacion',
      slug: 'mi-preparacion',
      plan: 'premium',
    });
    const org = workspaces.createOrganizationWorkspace(admin, {
      name: 'Academia OpoNorte',
      slug: 'academia-oponorte',
    });
    expect(personal.type).toBe('personal');
    expect(personal.plan).toBe('premium');
    expect(org.type).toBe('organization');
    expect(org.plan).toBe('organization');
  });

  it('el owner queda como miembro activo', () => {
    const { workspaces, memberRepo, admin } = makeSetup();
    const ws = workspaces.createOrganizationWorkspace(admin, {
      name: 'Org',
      slug: 'org',
    });
    const member = memberRepo.find(ws.id, admin.id);
    expect(member?.role).toBe('owner');
    expect(member?.status).toBe('active');
  });

  it('no permite workspace sin nombre', () => {
    const { workspaces, admin } = makeSetup();
    expectAccessError(
      () => workspaces.createOrganizationWorkspace(admin, { slug: 'x' }),
      AccessErrorCode.WORKSPACE_NAME_REQUIRED,
    );
  });

  it('no permite slug duplicado', () => {
    const { workspaces, admin } = makeSetup();
    workspaces.createOrganizationWorkspace(admin, { name: 'A', slug: 'dup' });
    expectAccessError(
      () => workspaces.createOrganizationWorkspace(admin, { name: 'B', slug: 'dup' }),
      AccessErrorCode.WORKSPACE_SLUG_ALREADY_EXISTS,
    );
  });

  it('no permite plan invalido en workspace personal', () => {
    const { workspaces, admin } = makeSetup();
    expectAccessError(
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
  it('lista solo los workspaces donde el usuario es miembro activo', () => {
    const { workspaces, admin, student } = makeSetup();
    const ws = workspaces.createOrganizationWorkspace(admin, {
      name: 'Org',
      slug: 'org',
    });
    expect(workspaces.listForUser(admin).map((w) => w.id)).toContain(ws.id);
    expect(workspaces.listForUser(student)).toHaveLength(0);
    expectAccessError(
      () => workspaces.getWorkspace(student, ws.id),
      AccessErrorCode.WORKSPACE_ACCESS_DENIED,
    );
  });

  it('anade student y admin; rechaza rol invalido', () => {
    const { workspaces, admin, student } = makeSetup();
    const ws = workspaces.createOrganizationWorkspace(admin, {
      name: 'Org',
      slug: 'org',
    });
    workspaces.addMember(admin, {
      workspace_id: ws.id,
      user_id: student.id,
      role: 'student',
    });
    expect(workspaces.listForUser(student).map((w) => w.id)).toContain(ws.id);
    expectAccessError(
      () =>
        workspaces.addMember(admin, {
          workspace_id: ws.id,
          user_id: student.id,
          role: 'owner' as WorkspaceRole,
        }),
      AccessErrorCode.WORKSPACE_MEMBER_INVALID_ROLE,
    );
  });

  it('revoca un miembro y deja de tener acceso', () => {
    const { workspaces, admin, student } = makeSetup();
    const ws = workspaces.createOrganizationWorkspace(admin, {
      name: 'Org',
      slug: 'org',
    });
    workspaces.addMember(admin, {
      workspace_id: ws.id,
      user_id: student.id,
      role: 'student',
    });
    workspaces.revokeMember(admin, { workspace_id: ws.id, user_id: student.id });
    expect(workspaces.listForUser(student)).toHaveLength(0);
    expectAccessError(
      () => workspaces.getWorkspace(student, ws.id),
      AccessErrorCode.WORKSPACE_ACCESS_DENIED,
    );
  });
});

describe('SPEC 011 - oposiciones dentro de workspace', () => {
  it('un owner/admin crea oposicion dentro de su workspace', () => {
    const { workspaces, oppositions, admin } = makeSetup();
    const ws = workspaces.createOrganizationWorkspace(admin, {
      name: 'Org',
      slug: 'org',
    });
    const opp = oppositions.createOpposition(admin, {
      workspace_id: ws.id,
      title: 'Auxiliar',
      slug: 'auxiliar',
    });
    expect(opp.workspace_id).toBe(ws.id);
  });

  it('no se puede crear oposicion sin workspace', () => {
    const { oppositions, admin } = makeSetup();
    expectAccessError(
      () => oppositions.createOpposition(admin, { title: 'X', slug: 'x' }),
      AccessErrorCode.OPPOSITION_WORKSPACE_REQUIRED,
    );
  });

  it('un student no puede crear oposicion', () => {
    const { workspaces, oppositions, admin, student } = makeSetup();
    const ws = workspaces.createOrganizationWorkspace(admin, {
      name: 'Org',
      slug: 'org',
    });
    expectAccessError(
      () =>
        oppositions.createOpposition(student, {
          workspace_id: ws.id,
          title: 'X',
          slug: 'x',
        }),
      AccessErrorCode.WORKSPACE_ACCESS_DENIED,
    );
  });

  it('no se puede crear oposicion en un workspace que no gestionas', () => {
    const { users, workspaces, oppositions, admin } = makeSetup();
    const otroAdmin = users.createUser({
      email: 'admin2@test.com',
      password: 'z',
      role: 'admin',
    });
    const wsAjeno = workspaces.createOrganizationWorkspace(otroAdmin, {
      name: 'Ajeno',
      slug: 'ajeno',
    });
    expectAccessError(
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
