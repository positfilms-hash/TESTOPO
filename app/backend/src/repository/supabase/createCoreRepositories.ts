// Factory de persistencia del bloque base cuenta/espacios (SPEC 020, 11).
//
// Selecciona repositorios Supabase o InMemory para `profiles`, `workspaces` y
// `workspace_members`. El resto del dominio sigue en InMemory (estado hibrido,
// SPEC 020, 17). Si Supabase no esta configurado, se usa InMemory (fallback).

import type { UserRepository } from '../userRepository.js';
import type { WorkspaceRepository } from '../workspaceRepository.js';
import type { WorkspaceMemberRepository } from '../workspaceMemberRepository.js';
import type { OppositionRepository } from '../oppositionRepository.js';
import type { OppositionAccessRepository } from '../oppositionAccessRepository.js';
import type { MaterialRepository } from '../materialRepository.js';
import type { TopicRepository } from '../topicRepository.js';
import type { TopicMaterialLinkRepository } from '../topicMaterialLinkRepository.js';
import type {
  MaterialImportBatchRepository,
  MaterialImportItemRepository,
} from '../materialImportRepository.js';
import type { QuestionRepository } from '../questionRepository.js';
import type { GenerationRunRepository } from '../generationRunRepository.js';
import type { QuestionReviewRepository } from '../questionReviewRepository.js';
import type { QuestionReviewFeedbackRepository } from '../questionReviewFeedbackRepository.js';
import type { QuestionValidationReportRepository } from '../questionValidationReportRepository.js';
import type { TestRepository } from '../testRepository.js';
import type { TestQuestionRepository } from '../testQuestionRepository.js';
import type { TestAttemptRepository } from '../testAttemptRepository.js';
import type { TestAnswerRepository } from '../testAnswerRepository.js';
import type {
  DocumentUnderstandingRunRepository,
  DocumentClassificationRepository,
} from '../documentClassificationRepository.js';
import type { MaterialSectionRepository } from '../materialSectionRepository.js';
import type { SourceReferenceRepository } from '../sourceReferenceRepository.js';
import type { SyllabusIndexRepository } from '../syllabusIndexRepository.js';
import { InMemoryUserRepository } from '../inMemoryUserRepository.js';
import { InMemoryWorkspaceRepository } from '../inMemoryWorkspaceRepository.js';
import { InMemoryWorkspaceMemberRepository } from '../inMemoryWorkspaceMemberRepository.js';
import { InMemoryOppositionRepository } from '../inMemoryOppositionRepository.js';
import { InMemoryOppositionAccessRepository } from '../inMemoryOppositionAccessRepository.js';
import { InMemoryMaterialRepository } from '../inMemoryMaterialRepository.js';
import { InMemoryTopicRepository } from '../inMemoryTopicRepository.js';
import { InMemoryTopicMaterialLinkRepository } from '../inMemoryTopicMaterialLinkRepository.js';
import {
  InMemoryMaterialImportBatchRepository,
  InMemoryMaterialImportItemRepository,
} from '../inMemoryMaterialImportRepository.js';
import { InMemoryQuestionRepository } from '../inMemoryQuestionRepository.js';
import { InMemoryGenerationRunRepository } from '../inMemoryGenerationRunRepository.js';
import { InMemoryQuestionReviewRepository } from '../inMemoryQuestionReviewRepository.js';
import { InMemoryQuestionReviewFeedbackRepository } from '../inMemoryQuestionReviewFeedbackRepository.js';
import { InMemoryQuestionValidationReportRepository } from '../inMemoryQuestionValidationReportRepository.js';
import { InMemoryTestRepository } from '../inMemoryTestRepository.js';
import { InMemoryTestQuestionRepository } from '../inMemoryTestQuestionRepository.js';
import { InMemoryTestAttemptRepository } from '../inMemoryTestAttemptRepository.js';
import { InMemoryTestAnswerRepository } from '../inMemoryTestAnswerRepository.js';
import {
  InMemoryDocumentUnderstandingRunRepository,
  InMemoryDocumentClassificationRepository,
} from '../inMemoryDocumentClassificationRepository.js';
import {
  InMemoryMaterialSectionRepository,
  InMemorySourceReferenceRepository,
} from '../inMemorySectionsRepositories.js';
import { InMemorySyllabusIndexRepository } from '../inMemorySyllabusIndexRepository.js';
import type { SupabaseClientPort } from './supabaseClientPort.js';
import { SupabaseProfileRepository } from './supabaseProfileRepository.js';
import { SupabaseWorkspaceRepository } from './supabaseWorkspaceRepository.js';
import { SupabaseWorkspaceMemberRepository } from './supabaseWorkspaceMemberRepository.js';
import { SupabaseOppositionRepository } from './supabaseOppositionRepository.js';
import { SupabaseOppositionAccessRepository } from './supabaseOppositionAccessRepository.js';
import { SupabaseMaterialRepository } from './supabaseMaterialRepository.js';
import { SupabaseTopicRepository } from './supabaseTopicRepository.js';
import { SupabaseTopicMaterialLinkRepository } from './supabaseTopicMaterialLinkRepository.js';
import {
  SupabaseMaterialImportBatchRepository,
  SupabaseMaterialImportItemRepository,
} from './supabaseMaterialImportRepositories.js';
import { SupabaseQuestionRepository } from './supabaseQuestionRepository.js';
import {
  SupabaseGenerationRunRepository,
  SupabaseQuestionReviewRepository,
  SupabaseQuestionReviewFeedbackRepository,
  SupabaseQuestionValidationReportRepository,
} from './supabaseQuestionBankRepositories.js';
import {
  SupabaseTestRepository,
  SupabaseTestQuestionRepository,
  SupabaseTestAttemptRepository,
  SupabaseTestAnswerRepository,
} from './supabaseTestRepositories.js';
import {
  SupabaseDocumentUnderstandingRunRepository,
  SupabaseDocumentClassificationRepository,
} from './supabaseDocumentClassificationRepositories.js';
import {
  SupabaseMaterialSectionRepository,
  SupabaseSourceReferenceRepository,
} from './supabaseSectionsRepositories.js';
import { SupabaseSyllabusIndexRepository } from './supabaseSyllabusIndexRepository.js';
import {
  SupabaseRepositoryError,
  SupabaseRepositoryErrorCode,
} from './supabaseRepositoryErrors.js';

export const PERSISTENCE_MODES = ['memory', 'supabase'] as const;
export type PersistenceMode = (typeof PERSISTENCE_MODES)[number];

export interface CoreRepositories {
  users: UserRepository;
  workspaces: WorkspaceRepository;
  workspaceMembers: WorkspaceMemberRepository;
  /** SPEC 021: oposiciones y accesos tambien viajan a Supabase con el bloque. */
  oppositions: OppositionRepository;
  oppositionAccess: OppositionAccessRepository;
  /** SPEC 022: materiales, temario e importaciones tambien viajan al bloque. */
  materials: MaterialRepository;
  topics: TopicRepository;
  topicMaterialLinks: TopicMaterialLinkRepository;
  importBatches: MaterialImportBatchRepository;
  importItems: MaterialImportItemRepository;
  /** SPEC 023: banco de preguntas (questions+options), generacion, revision,
   * feedback e informes de validacion. Tests/attempts siguen en memoria. */
  questions: QuestionRepository;
  generationRuns: GenerationRunRepository;
  questionReviews: QuestionReviewRepository;
  questionFeedback: QuestionReviewFeedbackRepository;
  questionValidationReports: QuestionValidationReportRepository;
  /** SPEC 024: tests, preguntas de test, intentos y respuestas (cierra el MVP). */
  tests: TestRepository;
  testQuestions: TestQuestionRepository;
  testAttempts: TestAttemptRepository;
  testAnswers: TestAnswerRepository;
  /** SPEC 028-B: clasificacion documental e inventario de importacion. */
  documentRuns: DocumentUnderstandingRunRepository;
  documentClassifications: DocumentClassificationRepository;
  /** SPEC 028-C: secciones de material y referencias de fuente. */
  materialSections: MaterialSectionRepository;
  sourceReferences: SourceReferenceRepository;
  /** SPEC 029-b: indice de temario IA (SPEC 019 + 028-D), ultimo dominio del MVP
   * que quedaba InMemory. Runs/propuestas/nodos/sugerencias/patrones/fuentes. */
  syllabusIndex: SyllabusIndexRepository;
  /** Modo efectivo usado (tras aplicar fallback). */
  mode: PersistenceMode;
}

export interface CreateCoreRepositoriesOptions {
  /** Modo deseado. Por defecto `memory`. */
  persistence?: PersistenceMode | string | null;
  /** Puerto Supabase; obligatorio si el modo efectivo es `supabase`. */
  supabase?: SupabaseClientPort | null;
}

// Resuelve el modo: 'supabase' solo si se pide explicitamente Y hay puerto; en
// otro caso 'memory'. Un valor de modo desconocido es un error claro.
export function resolvePersistenceMode(
  requested: PersistenceMode | string | null | undefined,
  hasSupabase: boolean,
): PersistenceMode {
  const mode = (requested ?? 'memory').toString().trim().toLowerCase();
  if (mode === '' || mode === 'memory') {
    return 'memory';
  }
  if (mode === 'supabase') {
    // Fallback a memoria si no hay puerto configurado (SPEC 020, 11).
    return hasSupabase ? 'supabase' : 'memory';
  }
  throw new SupabaseRepositoryError(
    SupabaseRepositoryErrorCode.PERSISTENCE_MODE_INVALID,
    `APP_PERSISTENCE_MODE invalido: ${mode}`,
  );
}

export function createCoreRepositories(
  options: CreateCoreRepositoriesOptions = {},
): CoreRepositories {
  const port = options.supabase ?? null;
  const mode = resolvePersistenceMode(options.persistence, port !== null);

  if (mode === 'supabase') {
    if (!port) {
      throw new SupabaseRepositoryError(
        SupabaseRepositoryErrorCode.SUPABASE_NOT_CONFIGURED,
      );
    }
    return {
      users: new SupabaseProfileRepository(port),
      workspaces: new SupabaseWorkspaceRepository(port),
      workspaceMembers: new SupabaseWorkspaceMemberRepository(port),
      oppositions: new SupabaseOppositionRepository(port),
      oppositionAccess: new SupabaseOppositionAccessRepository(port),
      materials: new SupabaseMaterialRepository(port),
      topics: new SupabaseTopicRepository(port),
      topicMaterialLinks: new SupabaseTopicMaterialLinkRepository(port),
      importBatches: new SupabaseMaterialImportBatchRepository(port),
      importItems: new SupabaseMaterialImportItemRepository(port),
      questions: new SupabaseQuestionRepository(port),
      generationRuns: new SupabaseGenerationRunRepository(port),
      questionReviews: new SupabaseQuestionReviewRepository(port),
      questionFeedback: new SupabaseQuestionReviewFeedbackRepository(port),
      questionValidationReports: new SupabaseQuestionValidationReportRepository(port),
      tests: new SupabaseTestRepository(port),
      testQuestions: new SupabaseTestQuestionRepository(port),
      testAttempts: new SupabaseTestAttemptRepository(port),
      testAnswers: new SupabaseTestAnswerRepository(port),
      documentRuns: new SupabaseDocumentUnderstandingRunRepository(port),
      documentClassifications: new SupabaseDocumentClassificationRepository(port),
      materialSections: new SupabaseMaterialSectionRepository(port),
      sourceReferences: new SupabaseSourceReferenceRepository(port),
      syllabusIndex: new SupabaseSyllabusIndexRepository(port),
      mode,
    };
  }

  return {
    users: new InMemoryUserRepository(),
    workspaces: new InMemoryWorkspaceRepository(),
    workspaceMembers: new InMemoryWorkspaceMemberRepository(),
    oppositions: new InMemoryOppositionRepository(),
    oppositionAccess: new InMemoryOppositionAccessRepository(),
    materials: new InMemoryMaterialRepository(),
    topics: new InMemoryTopicRepository(),
    topicMaterialLinks: new InMemoryTopicMaterialLinkRepository(),
    importBatches: new InMemoryMaterialImportBatchRepository(),
    importItems: new InMemoryMaterialImportItemRepository(),
    questions: new InMemoryQuestionRepository(),
    generationRuns: new InMemoryGenerationRunRepository(),
    questionReviews: new InMemoryQuestionReviewRepository(),
    questionFeedback: new InMemoryQuestionReviewFeedbackRepository(),
    questionValidationReports: new InMemoryQuestionValidationReportRepository(),
    tests: new InMemoryTestRepository(),
    testQuestions: new InMemoryTestQuestionRepository(),
    testAttempts: new InMemoryTestAttemptRepository(),
    testAnswers: new InMemoryTestAnswerRepository(),
    documentRuns: new InMemoryDocumentUnderstandingRunRepository(),
    documentClassifications: new InMemoryDocumentClassificationRepository(),
    materialSections: new InMemoryMaterialSectionRepository(),
    sourceReferences: new InMemorySourceReferenceRepository(),
    syllabusIndex: new InMemorySyllabusIndexRepository(),
    mode,
  };
}
