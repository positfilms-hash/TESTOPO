// Tests de SPEC 014 - Admin/Student UI Separation: la decision de zona se basa
// en si el usuario PUEDE GESTIONAR el workspace (owner/admin) y/o ESTUDIAR
// (matricula de estudiante activa). El owner que crea una oposicion queda como
// `owner` de esa oposicion: eso NO cuenta como estudiar.

import { describe, expect, it } from 'vitest';
import {
  InMemoryUserRepository,
  UserService,
  InMemoryWorkspaceRepository,
  InMemoryWorkspaceMemberRepository,
  WorkspaceService,
  InMemoryOppositionRepository,
  InMemoryOppositionAccessRepository,
  OppositionService,
} from '../src/index.js';

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
  const ws = await workspaces.createOrganizationWorkspace(admin, {
    name: 'Academia',
    slug: 'academia',
  });
  await workspaces.addMember(admin, {
    workspace_id: ws.id,
    user_id: student.id,
    role: 'student',
  });
  const opp = await oppositions.createOpposition(admin, {
    workspace_id: ws.id,
    title: 'Auxiliar',
    slug: 'auxiliar',
  });
  await oppositions.grantAccess(admin, { user_id: student.id, opposition_id: opp.id });

  return { users, workspaces, oppositions, admin, student, ws, opp };
}

describe('SPEC 014 - deteccion de zona', () => {
  it('el owner que crea la oposicion NO cuenta como estudiante', async () => {
    const { oppositions, admin, ws } = await makeSetup();
    expect(await oppositions.hasStudyAccess(admin, ws.id)).toBe(false);
    expect(await oppositions.listStudyOppositions(admin)).toHaveLength(0);
  });

  it('el estudiante con matricula activa tiene acceso de estudio', async () => {
    const { oppositions, student, ws, opp } = await makeSetup();
    expect(await oppositions.hasStudyAccess(student, ws.id)).toBe(true);
    expect((await oppositions.listStudyOppositions(student)).map((o) => o.id)).toEqual([
      opp.id,
    ]);
  });

  it('un gestor que ademas recibe matricula de estudiante puede estudiar (multi-rol)', async () => {
    const { users, workspaces, oppositions, admin, ws, opp } = await makeSetup();
    // coadmin gestiona el workspace (rol admin) pero no es owner de `opp`, asi
    // que el owner (admin) puede matricularlo como estudiante de `opp`.
    const coadmin = await users.createUser({
      email: 'coadmin@test.com',
      password: 'k',
      role: 'admin',
    });
    await workspaces.addMember(admin, {
      workspace_id: ws.id,
      user_id: coadmin.id,
      role: 'admin',
    });
    await oppositions.grantAccess(admin, {
      user_id: coadmin.id,
      opposition_id: opp.id,
      role: 'student',
    });
    // Gestiona (admin del workspace) Y estudia (matricula en `opp`).
    expect(await workspaces.getMemberRole(coadmin.id, ws.id)).toBe('admin');
    expect(await oppositions.hasStudyAccess(coadmin, ws.id)).toBe(true);
    expect((await oppositions.listStudyOppositions(coadmin)).map((o) => o.id)).toEqual([
      opp.id,
    ]);
  });

  it('revocar la matricula quita el acceso de estudio', async () => {
    const { oppositions, admin, student, ws } = await makeSetup();
    const opp = (await oppositions.listForUser(admin))[0]!;
    await oppositions.revokeAccess(admin, {
      user_id: student.id,
      opposition_id: opp.id,
    });
    expect(await oppositions.hasStudyAccess(student, ws.id)).toBe(false);
  });
});
