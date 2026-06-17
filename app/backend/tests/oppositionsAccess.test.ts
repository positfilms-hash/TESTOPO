import { describe, expect, it } from 'vitest';
import { InMemoryUserRepository } from '../src/repository/inMemoryUserRepository.js';
import { InMemoryOppositionRepository } from '../src/repository/inMemoryOppositionRepository.js';
import { InMemoryOppositionAccessRepository } from '../src/repository/inMemoryOppositionAccessRepository.js';
import { InMemoryWorkspaceRepository } from '../src/repository/inMemoryWorkspaceRepository.js';
import { InMemoryWorkspaceMemberRepository } from '../src/repository/inMemoryWorkspaceMemberRepository.js';
import { InMemoryMaterialRepository } from '../src/repository/inMemoryMaterialRepository.js';
import { InMemoryTopicRepository } from '../src/repository/inMemoryTopicRepository.js';
import { InMemoryQuestionRepository } from '../src/repository/inMemoryQuestionRepository.js';
import { UserService } from '../src/service/userService.js';
import { WorkspaceService } from '../src/service/workspaceService.js';
import { OppositionService } from '../src/service/oppositionService.js';
import { MaterialService } from '../src/service/materialService.js';
import { TopicService } from '../src/service/topicService.js';
import { QuestionService } from '../src/service/questionService.js';
import { AccessError } from '../src/access/accessError.js';
import { AccessErrorCode } from '../src/access/accessErrors.js';
import { validInput } from './helpers.js';

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
  const materialRepository = new InMemoryMaterialRepository();
  const topicRepository = new InMemoryTopicRepository();
  const materials = new MaterialService(materialRepository);
  const topics = new TopicService(topicRepository, { materialRepository });
  const questions = new QuestionService(new InMemoryQuestionRepository(), {
    resolveMaterialOpposition: (id) =>
      materials.getMaterial(id)?.opposition_id ?? null,
    resolveTopicOpposition: (id) => topics.getTopic(id)?.opposition_id ?? null,
  });
  return { users, workspaces, oppositions, materials, topics, questions };
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

describe('SPEC 010 - usuarios y autenticacion', () => {
  it('crea admin y student', () => {
    const { users } = makeSetup();
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
    expect(admin.role).toBe('admin');
    expect(student.role).toBe('student');
    expect(admin.password_hash).not.toBe('x');
  });

  it('no permite email duplicado', () => {
    const { users } = makeSetup();
    users.createUser({ email: 'a@test.com', password: 'x', role: 'admin' });
    expectAccessError(
      () => users.createUser({ email: 'a@test.com', password: 'y', role: 'student' }),
      AccessErrorCode.USER_EMAIL_ALREADY_EXISTS,
    );
  });

  it('no permite rol invalido', () => {
    const { users } = makeSetup();
    expectAccessError(
      () =>
        users.createUser({
          email: 'b@test.com',
          password: 'x',
          role: 'superuser' as 'admin',
        }),
      AccessErrorCode.USER_INVALID_ROLE,
    );
  });

  it('login con credenciales validas e invalidas', () => {
    const { users } = makeSetup();
    users.createUser({ email: 'c@test.com', password: 'secreto', role: 'student' });
    expect(users.authenticate('c@test.com', 'secreto').email).toBe('c@test.com');
    expectAccessError(
      () => users.authenticate('c@test.com', 'mal'),
      AccessErrorCode.AUTH_INVALID_CREDENTIALS,
    );
  });
});

describe('SPEC 010 - oposiciones dentro de workspace (workspace-first)', () => {
  function withWorkspace() {
    const ctx = makeSetup();
    const admin = ctx.users.createUser({
      email: 'admin@test.com',
      password: 'x',
      role: 'admin',
    });
    const student = ctx.users.createUser({
      email: 'student@test.com',
      password: 'y',
      role: 'student',
    });
    const workspace = ctx.workspaces.createOrganizationWorkspace(admin, {
      name: 'Academia',
      slug: 'academia',
    });
    return { ...ctx, admin, student, workspace };
  }

  it('quien gestiona el workspace crea oposicion; un no-miembro no', () => {
    const { oppositions, admin, student, workspace } = withWorkspace();
    const opp = oppositions.createOpposition(admin, {
      workspace_id: workspace.id,
      title: 'Auxiliar',
      slug: 'auxiliar',
    });
    expect(opp.workspace_id).toBe(workspace.id);
    expectAccessError(
      () =>
        oppositions.createOpposition(student, {
          workspace_id: workspace.id,
          title: 'X',
          slug: 'x',
        }),
      AccessErrorCode.WORKSPACE_ACCESS_DENIED,
    );
  });

  it('un estudiante solo ve oposiciones autorizadas de su workspace', () => {
    const { workspaces, oppositions, admin, student, workspace } =
      withWorkspace();
    workspaces.addMember(admin, {
      workspace_id: workspace.id,
      user_id: student.id,
      role: 'student',
    });
    const opp1 = oppositions.createOpposition(admin, {
      workspace_id: workspace.id,
      title: 'Uno',
      slug: 'uno',
    });
    const opp2 = oppositions.createOpposition(admin, {
      workspace_id: workspace.id,
      title: 'Dos',
      slug: 'dos',
    });

    expect(oppositions.listForUser(student)).toHaveLength(0);
    oppositions.grantAccess(admin, {
      user_id: student.id,
      opposition_id: opp1.id,
    });
    expect(oppositions.listForUser(student).map((o) => o.id)).toEqual([opp1.id]);
    expectAccessError(
      () => oppositions.getOpposition(student, opp2.id),
      AccessErrorCode.ACCESS_DENIED,
    );
  });

  it('revocar acceso a la oposicion deja de mostrarla', () => {
    const { workspaces, oppositions, admin, student, workspace } =
      withWorkspace();
    workspaces.addMember(admin, {
      workspace_id: workspace.id,
      user_id: student.id,
      role: 'student',
    });
    const opp = oppositions.createOpposition(admin, {
      workspace_id: workspace.id,
      title: 'Uno',
      slug: 'uno',
    });
    oppositions.grantAccess(admin, { user_id: student.id, opposition_id: opp.id });
    oppositions.revokeAccess(admin, {
      user_id: student.id,
      opposition_id: opp.id,
    });
    expect(oppositions.listForUser(student)).toHaveLength(0);
  });
});

describe('SPEC 010 - integridad por oposicion', () => {
  it('no se puede crear material/tema/pregunta sin oposicion', () => {
    const { materials, topics, questions } = makeSetup();
    expectAccessError(
      () => materials.createMaterial({ title: 'X', type: 'notes' }),
      AccessErrorCode.OPPOSITION_REQUIRED,
    );
    expectAccessError(
      () => topics.createTopic({ title: 'X' }),
      AccessErrorCode.OPPOSITION_REQUIRED,
    );
    expectAccessError(
      () => questions.createQuestion(validInput({ opposition_id: undefined })),
      AccessErrorCode.OPPOSITION_REQUIRED,
    );
  });

  it('no se puede vincular pregunta a material de otra oposicion', () => {
    const { materials, questions } = makeSetup();
    const material = materials.createMaterial({
      opposition_id: 'opp-A',
      title: 'M',
      type: 'syllabus',
    });
    expectAccessError(
      () =>
        questions.createQuestion(
          validInput({
            opposition_id: 'opp-B',
            source: {
              id: 's',
              material_id: material.id,
              title: 'M',
              type: 'syllabus',
              reference: 'r',
              status: 'active',
            },
          }),
        ),
      AccessErrorCode.OPPOSITION_ENTITY_MISMATCH,
    );
  });

  it('no se puede vincular pregunta a tema de otra oposicion', () => {
    const { topics, questions } = makeSetup();
    const topic = topics.createTopic({ opposition_id: 'opp-A', title: 'T' });
    expectAccessError(
      () =>
        questions.createQuestion(
          validInput({ opposition_id: 'opp-B', topic_id: topic.id }),
        ),
      AccessErrorCode.OPPOSITION_ENTITY_MISMATCH,
    );
  });
});
