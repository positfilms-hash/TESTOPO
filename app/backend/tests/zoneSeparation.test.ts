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
  const ws = workspaces.createOrganizationWorkspace(admin, {
    name: 'Academia',
    slug: 'academia',
  });
  workspaces.addMember(admin, {
    workspace_id: ws.id,
    user_id: student.id,
    role: 'student',
  });
  const opp = oppositions.createOpposition(admin, {
    workspace_id: ws.id,
    title: 'Auxiliar',
    slug: 'auxiliar',
  });
  oppositions.grantAccess(admin, { user_id: student.id, opposition_id: opp.id });

  return { users, workspaces, oppositions, admin, student, ws, opp };
}

describe('SPEC 014 - deteccion de zona', () => {
  it('el owner que crea la oposicion NO cuenta como estudiante', () => {
    const { oppositions, admin, ws } = makeSetup();
    expect(oppositions.hasStudyAccess(admin, ws.id)).toBe(false);
    expect(oppositions.listStudyOppositions(admin)).toHaveLength(0);
  });

  it('el estudiante con matricula activa tiene acceso de estudio', () => {
    const { oppositions, student, ws, opp } = makeSetup();
    expect(oppositions.hasStudyAccess(student, ws.id)).toBe(true);
    expect(oppositions.listStudyOppositions(student).map((o) => o.id)).toEqual([
      opp.id,
    ]);
  });

  it('un gestor que ademas recibe matricula de estudiante puede estudiar (multi-rol)', () => {
    const { users, workspaces, oppositions, admin, ws, opp } = makeSetup();
    // coadmin gestiona el workspace (rol admin) pero no es owner de `opp`, asi
    // que el owner (admin) puede matricularlo como estudiante de `opp`.
    const coadmin = users.createUser({
      email: 'coadmin@test.com',
      password: 'k',
      role: 'admin',
    });
    workspaces.addMember(admin, {
      workspace_id: ws.id,
      user_id: coadmin.id,
      role: 'admin',
    });
    oppositions.grantAccess(admin, {
      user_id: coadmin.id,
      opposition_id: opp.id,
      role: 'student',
    });
    // Gestiona (admin del workspace) Y estudia (matricula en `opp`).
    expect(workspaces.getMemberRole(coadmin.id, ws.id)).toBe('admin');
    expect(oppositions.hasStudyAccess(coadmin, ws.id)).toBe(true);
    expect(oppositions.listStudyOppositions(coadmin).map((o) => o.id)).toEqual([
      opp.id,
    ]);
  });

  it('revocar la matricula quita el acceso de estudio', () => {
    const { oppositions, admin, student, ws } = makeSetup();
    const opp = oppositions.listForUser(admin)[0]!;
    oppositions.revokeAccess(admin, {
      user_id: student.id,
      opposition_id: opp.id,
    });
    expect(oppositions.hasStudyAccess(student, ws.id)).toBe(false);
  });
});
