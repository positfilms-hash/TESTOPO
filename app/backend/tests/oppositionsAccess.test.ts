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
  const materialRepository = new InMemoryMaterialRepository();
  const topicRepository = new InMemoryTopicRepository();
  const materials = new MaterialService(materialRepository);
  const topics = new TopicService(topicRepository, { materialRepository });
  const questions = new QuestionService(new InMemoryQuestionRepository(), {
    resolveMaterialOpposition: async (id) => (await materials.getMaterial(id))?.opposition_id ?? null,
    resolveTopicOpposition: async (id) => (await topics.getTopic(id))?.opposition_id ?? null,
  });
  return { users, workspaces, oppositions, materials, topics, questions };
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

describe('SPEC 010 - usuarios y autenticacion', () => {
  it('crea admin y student', async () => {
    const { users } = await makeSetup();
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
    expect(admin.role).toBe('admin');
    expect(student.role).toBe('student');
    expect(admin.password_hash).not.toBe('x');
  });

  it('no permite email duplicado', async () => {
    const { users } = await makeSetup();
    await users.createUser({ email: 'a@test.com', password: 'x', role: 'admin' });
    await expectAccessError(
      () => users.createUser({ email: 'a@test.com', password: 'y', role: 'student' }),
      AccessErrorCode.USER_EMAIL_ALREADY_EXISTS,
    );
  });

  it('no permite rol invalido', async () => {
    const { users } = await makeSetup();
    await expectAccessError(
      () =>
        users.createUser({
          email: 'b@test.com',
          password: 'x',
          role: 'superuser' as 'admin',
        }),
      AccessErrorCode.USER_INVALID_ROLE,
    );
  });

  it('login con credenciales validas e invalidas', async () => {
    const { users } = await makeSetup();
    await users.createUser({ email: 'c@test.com', password: 'secreto', role: 'student' });
    expect((await users.authenticate('c@test.com', 'secreto')).email).toBe('c@test.com');
    await expectAccessError(
      () => users.authenticate('c@test.com', 'mal'),
      AccessErrorCode.AUTH_INVALID_CREDENTIALS,
    );
  });
});

describe('SPEC 010 - oposiciones dentro de workspace (workspace-first)', () => {
  async function withWorkspace() {
    const ctx = await makeSetup();
    const admin = await ctx.users.createUser({
      email: 'admin@test.com',
      password: 'x',
      role: 'admin',
    });
    const student = await ctx.users.createUser({
      email: 'student@test.com',
      password: 'y',
      role: 'student',
    });
    const workspace = await ctx.workspaces.createOrganizationWorkspace(admin, {
      name: 'Academia',
      slug: 'academia',
    });
    return { ...ctx, admin, student, workspace };
  }

  it('quien gestiona el workspace crea oposicion; un no-miembro no', async () => {
    const { oppositions, admin, student, workspace } = await withWorkspace();
    const opp = await oppositions.createOpposition(admin, {
      workspace_id: workspace.id,
      title: 'Auxiliar',
      slug: 'auxiliar',
    });
    expect(opp.workspace_id).toBe(workspace.id);
    await expectAccessError(
      () =>
        oppositions.createOpposition(student, {
          workspace_id: workspace.id,
          title: 'X',
          slug: 'x',
        }),
      AccessErrorCode.WORKSPACE_ACCESS_DENIED,
    );
  });

  it('un estudiante solo ve oposiciones autorizadas de su workspace', async () => {
    const { workspaces, oppositions, admin, student, workspace } =
      await withWorkspace();
    await workspaces.addMember(admin, {
      workspace_id: workspace.id,
      user_id: student.id,
      role: 'student',
    });
    const opp1 = await oppositions.createOpposition(admin, {
      workspace_id: workspace.id,
      title: 'Uno',
      slug: 'uno',
    });
    const opp2 = await oppositions.createOpposition(admin, {
      workspace_id: workspace.id,
      title: 'Dos',
      slug: 'dos',
    });

    expect(await oppositions.listForUser(student)).toHaveLength(0);
    await oppositions.grantAccess(admin, {
      user_id: student.id,
      opposition_id: opp1.id,
    });
    expect((await oppositions.listForUser(student)).map((o) => o.id)).toEqual([opp1.id]);
    await expectAccessError(
      () => oppositions.getOpposition(student, opp2.id),
      AccessErrorCode.ACCESS_DENIED,
    );
  });

  it('revocar acceso a la oposicion deja de mostrarla', async () => {
    const { workspaces, oppositions, admin, student, workspace } =
      await withWorkspace();
    await workspaces.addMember(admin, {
      workspace_id: workspace.id,
      user_id: student.id,
      role: 'student',
    });
    const opp = await oppositions.createOpposition(admin, {
      workspace_id: workspace.id,
      title: 'Uno',
      slug: 'uno',
    });
    await oppositions.grantAccess(admin, { user_id: student.id, opposition_id: opp.id });
    await oppositions.revokeAccess(admin, {
      user_id: student.id,
      opposition_id: opp.id,
    });
    expect(await oppositions.listForUser(student)).toHaveLength(0);
  });
});

describe('SPEC 010 - integridad por oposicion', () => {
  it('no se puede crear material/tema/pregunta sin oposicion', async () => {
    const { materials, topics, questions } = await makeSetup();
    await expectAccessError(
      () => materials.createMaterial({ title: 'X', type: 'notes' }),
      AccessErrorCode.OPPOSITION_REQUIRED,
    );
    await expectAccessError(
      () => topics.createTopic({ title: 'X' }),
      AccessErrorCode.OPPOSITION_REQUIRED,
    );
    await expectAccessError(
      () => questions.createQuestion(validInput({ opposition_id: undefined })),
      AccessErrorCode.OPPOSITION_REQUIRED,
    );
  });

  it('no se puede vincular pregunta a material de otra oposicion', async () => {
    const { materials, questions } = await makeSetup();
    const material = await materials.createMaterial({
      opposition_id: 'opp-A',
      title: 'M',
      type: 'syllabus',
    });
    await expectAccessError(
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

  it('no se puede vincular pregunta a tema de otra oposicion', async () => {
    const { topics, questions } = await makeSetup();
    const topic = await topics.createTopic({ opposition_id: 'opp-A', title: 'T' });
    await expectAccessError(
      () =>
        questions.createQuestion(
          validInput({ opposition_id: 'opp-B', topic_id: topic.id }),
        ),
      AccessErrorCode.OPPOSITION_ENTITY_MISMATCH,
    );
  });
});
