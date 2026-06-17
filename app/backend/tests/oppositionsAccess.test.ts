import { describe, expect, it } from 'vitest';
import { InMemoryUserRepository } from '../src/repository/inMemoryUserRepository.js';
import { InMemoryOppositionRepository } from '../src/repository/inMemoryOppositionRepository.js';
import { InMemoryOppositionAccessRepository } from '../src/repository/inMemoryOppositionAccessRepository.js';
import { InMemoryMaterialRepository } from '../src/repository/inMemoryMaterialRepository.js';
import { InMemoryTopicRepository } from '../src/repository/inMemoryTopicRepository.js';
import { InMemoryQuestionRepository } from '../src/repository/inMemoryQuestionRepository.js';
import { UserService } from '../src/service/userService.js';
import { OppositionService } from '../src/service/oppositionService.js';
import { MaterialService } from '../src/service/materialService.js';
import { TopicService } from '../src/service/topicService.js';
import { QuestionService } from '../src/service/questionService.js';
import { TestGeneratorService } from '../src/service/testGeneratorService.js';
import { AccessError } from '../src/access/accessError.js';
import { AccessErrorCode } from '../src/access/accessErrors.js';
import { validInput } from './helpers.js';

function makeSetup() {
  const users = new UserService(new InMemoryUserRepository());
  const oppositions = new OppositionService(
    new InMemoryOppositionRepository(),
    new InMemoryOppositionAccessRepository(),
  );
  const materialRepository = new InMemoryMaterialRepository();
  const topicRepository = new InMemoryTopicRepository();
  const questionRepository = new InMemoryQuestionRepository();
  const materials = new MaterialService(materialRepository);
  const topics = new TopicService(topicRepository, { materialRepository });
  const questions = new QuestionService(questionRepository, {
    resolveMaterialOpposition: (id) =>
      materials.getMaterial(id)?.opposition_id ?? null,
    resolveTopicOpposition: (id) => topics.getTopic(id)?.opposition_id ?? null,
  });
  const testGenerator = new TestGeneratorService({
    questionService: questions,
    topicRepository,
    materialRepository,
  });
  return { users, oppositions, materials, topics, questions, testGenerator };
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
    expect(admin.password_hash).not.toBe('x'); // nunca texto plano
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

  it('inicia sesion con credenciales validas y falla con invalidas', () => {
    const { users } = makeSetup();
    users.createUser({ email: 'c@test.com', password: 'secreto', role: 'student' });
    expect(users.authenticate('c@test.com', 'secreto').email).toBe('c@test.com');
    expectAccessError(
      () => users.authenticate('c@test.com', 'mal'),
      AccessErrorCode.AUTH_INVALID_CREDENTIALS,
    );
  });
});

describe('SPEC 010 - oposiciones y acceso', () => {
  function withUsers() {
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
    return { ...ctx, admin, student };
  }

  it('un admin crea una oposicion y un student no puede', () => {
    const { oppositions, admin, student } = withUsers();
    const opp = oppositions.createOpposition(admin, { workspace_id: 'ws-test',
      title: 'Auxiliar Administrativo',
      slug: 'auxiliar-administrativo',
    });
    expect(opp.created_by).toBe(admin.id);
    expectAccessError(
      () =>
        oppositions.createOpposition(student, {
          title: 'X',
          slug: 'x',
        }),
      AccessErrorCode.ADMIN_ACCESS_REQUIRED,
    );
  });

  it('da acceso a un estudiante y este solo ve oposiciones autorizadas', () => {
    const { oppositions, admin, student } = withUsers();
    const opp = oppositions.createOpposition(admin, { workspace_id: 'ws-test',
      title: 'Policia',
      slug: 'policia',
    });
    const otra = oppositions.createOpposition(admin, { workspace_id: 'ws-test',
      title: 'Otra',
      slug: 'otra',
    });

    expect(oppositions.listForUser(student)).toHaveLength(0);
    oppositions.grantAccess(admin, {
      user_id: student.id,
      opposition_id: opp.id,
    });
    const visibles = oppositions.listForUser(student);
    expect(visibles).toHaveLength(1);
    expect(visibles[0].id).toBe(opp.id);

    // No puede ver la oposicion no autorizada.
    expectAccessError(
      () => oppositions.getOpposition(student, otra.id),
      AccessErrorCode.ACCESS_DENIED,
    );
  });

  it('revoca acceso sin borrar historico', () => {
    const { oppositions, admin, student } = withUsers();
    const opp = oppositions.createOpposition(admin, { workspace_id: 'ws-test', title: 'T', slug: 't' });
    oppositions.grantAccess(admin, { user_id: student.id, opposition_id: opp.id });
    oppositions.revokeAccess(admin, { user_id: student.id, opposition_id: opp.id });
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

  it('el generador de tests solo usa preguntas de la oposicion indicada', () => {
    const { questions, testGenerator } = makeSetup();
    // 3 validadas en opp-A, 3 en opp-B.
    for (let i = 0; i < 3; i++) {
      const a = questions.createQuestion(
        validInput({ opposition_id: 'opp-A', statement: `A${i}` }),
      );
      questions.changeStatus(a.id, 'validated');
      const b = questions.createQuestion(
        validInput({ opposition_id: 'opp-B', statement: `B${i}` }),
      );
      questions.changeStatus(b.id, 'validated');
    }
    const { questions: items } = testGenerator.createRandomTest({
      opposition_id: 'opp-A',
      question_count: 3,
    });
    const ids = new Set(items.map((i) => i.question_id));
    for (const id of ids) {
      expect(questions.getQuestion(id)?.opposition_id).toBe('opp-A');
    }
  });

  it('no genera test sin oposicion', () => {
    const { questions, testGenerator } = makeSetup();
    const q = questions.createQuestion(validInput({ opposition_id: 'opp-A' }));
    questions.changeStatus(q.id, 'validated');
    expectAccessError(
      () => testGenerator.generate({ mode: 'random', question_count: 1 }),
      AccessErrorCode.OPPOSITION_REQUIRED,
    );
  });
});
