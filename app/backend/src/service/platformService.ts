// Facade de acceso (SPEC 011, remediacion de la revision): centraliza el control
// de acceso de las operaciones de contenido y estudio segun el ROL DE WORKSPACE
// y el acceso a la oposicion, delegando despues en los servicios de dominio
// (que se mantienen puros). Es el limite de acceso del MVP: el frontend y
// cualquier consumidor de aplicacion deben pasar por aqui.
//
// - Gestion (material, temas, generacion, revision): requiere gestionar el
//   workspace de la oposicion (owner/admin del workspace) -> habilita Premium
//   personal (owner) y organizacion (owner/admin), no el `User.role` global.
// - Estudio (crear/realizar test, resultados): requiere acceso a la oposicion;
//   un intento solo lo ve/gestiona su propio usuario.

import type { User } from '../models/user.js';
import type { Material } from '../models/material.js';
import {
  STUDENT_HIDDEN_CLASSES,
  type DocumentClass,
} from '../models/documentClassification.js';
import type {
  DocumentClassificationService,
  DocumentInventory,
} from './documentClassificationService.js';
import type { DocumentClassification } from '../models/documentClassification.js';
import {
  DocumentClassificationError,
  DocumentClassificationErrorCode,
} from '../classification/documentClassificationErrors.js';
import type { MaterialSectionService } from './materialSectionService.js';
import type { SourceReferenceService } from './sourceReferenceService.js';
import type {
  SyllabusIndexFromDocumentsService,
  GroundedProposalDetail,
  ApplyGroundedResult,
} from './syllabusIndexFromDocumentsService.js';
import type {
  SourceGroundedQuestionGenerationService,
  GenerateFromTopicInput,
  SourceGroundedResult,
} from './sourceGroundedQuestionGenerationService.js';
import type { RetrievalResult } from './sourceRetrievalService.js';
import type { ExamPatternAnalysisService } from './examPatternAnalysisService.js';
import type { AIErrorMemoryService } from './aiErrorMemoryService.js';
import { formatStyleRules } from '../analysis/examPatternMatching.js';
import type {
  MaterialSection,
  SectionClass,
} from '../models/materialSection.js';
import type { SourceReference } from '../models/sourceReference.js';
import {
  MaterialSectionError,
  MaterialSectionErrorCode,
} from '../sections/sectionErrors.js';
import type { Topic } from '../models/topic.js';
import type { OppositionRepository } from '../repository/oppositionRepository.js';
import type { WorkspaceMemberRepository } from '../repository/workspaceMemberRepository.js';
import { AccessError } from '../access/accessError.js';
import { AccessErrorCode } from '../access/accessErrors.js';
import {
  canManageWorkspace,
  requireManageWorkspace,
  requireUser,
} from '../access/permissions.js';
import type { OppositionService } from './oppositionService.js';
import type {
  CreateMaterialInput,
  EditMaterialInput,
  MaterialService,
} from './materialService.js';
import type {
  PdfMaterialService,
  UploadPdfInput,
} from './pdfMaterialService.js';
import type {
  ImportFilesInput,
  ImportResult,
  ImportZipInput,
  MaterialImportService,
  SmartUploadInput,
  SmartUploadResult,
} from './materialImportService.js';
import type { CreateTopicInput, TopicService } from './topicService.js';
import type {
  EditQuestionInput,
  QuestionService,
} from './questionService.js';
import type { QuestionGenerationService } from './questionGenerationService.js';
import { QuestionGenerationError } from '../generation/questionGenerationError.js';
import { QuestionGenerationErrorCode } from '../generation/generationErrors.js';
import type {
  GenerationResult,
} from './questionGenerationService.js';
import type {
  QuestionReviewService,
  ReviewActionInput,
  ReviewActionResult,
} from './questionReviewService.js';
import type { QuestionFeedbackService } from './questionFeedbackService.js';
import type {
  QuestionGenerationFeedbackSummary,
  QuestionReviewFeedback,
} from '../models/questionReviewFeedback.js';
import type {
  ApplyResult,
  ProposalDetail,
  SyllabusIndexService,
} from './syllabusIndexService.js';
import type {
  MaterialTopicSuggestion,
  SyllabusIndexNodeProposal,
  SyllabusIndexProposal,
  SyllabusNodeStatus,
} from '../models/syllabusIndex.js';
import { SyllabusIndexError, SyllabusIndexErrorCode } from '../syllabus/syllabusIndexErrors.js';
import type {
  GenerateTestRequest,
  GeneratedTest,
  TestGeneratorService,
} from './testGeneratorService.js';
import type {
  AttemptResult,
  AttemptReview,
  TakingView,
  TestAttemptService,
} from './testAttemptService.js';
import type { TestAttempt } from '../models/testAttempt.js';
import type { TestAnswer } from '../models/testAnswer.js';

// Resumen de un resultado para la pantalla "Mis resultados" del estudiante.
export interface MyResultSummary extends AttemptResult {
  test_title: string | null;
}

export interface PlatformServiceDeps {
  oppositionRepository: OppositionRepository;
  workspaceMembers: WorkspaceMemberRepository;
  oppositions: OppositionService;
  materials: MaterialService;
  pdfMaterials: PdfMaterialService;
  materialImport: MaterialImportService;
  topics: TopicService;
  questions: QuestionService;
  generation: QuestionGenerationService;
  review: QuestionReviewService;
  /** Resumen de feedback de revision (SPEC 018.4). Opcional. */
  feedback?: QuestionFeedbackService;
  /** Constructor de indice de temario con IA (SPEC 019). Opcional. */
  syllabus?: SyllabusIndexService;
  /** Clasificacion documental e inventario (SPEC 028-B). Opcional. */
  documentClassification?: DocumentClassificationService;
  /** Secciones de material y referencias de fuente (SPEC 028-C). Opcional. */
  materialSections?: MaterialSectionService;
  sourceReferences?: SourceReferenceService;
  /** Indice de temario anclado a documentos (SPEC 028-D). Opcional. */
  syllabusFromDocuments?: SyllabusIndexFromDocumentsService;
  /** Generacion de preguntas anclada a fuentes (SPEC 028-E). Opcional. */
  sourceGroundedGeneration?: SourceGroundedQuestionGenerationService;
  /** Aprendizaje de patrones de examen (SPEC 028-F). Opcional. */
  examPatternAnalysis?: ExamPatternAnalysisService;
  aiErrorMemory?: AIErrorMemoryService;
  testGenerator: TestGeneratorService;
  attempts: TestAttemptService;
}

export class PlatformService {
  constructor(private readonly deps: PlatformServiceDeps) {}

  // --- Gestion (owner/admin del workspace de la oposicion) -----------------

  async createMaterial(actor: User, input: CreateMaterialInput): Promise<Material> {
    await this.requireManageOpposition(actor, input.opposition_id);
    return this.deps.materials.createMaterial(input);
  }

  // Subir PDF: solo owner/admin del workspace de la oposicion (SPEC 012).
  async uploadPdf(actor: User, input: UploadPdfInput): Promise<Material> {
    await this.requireManageOpposition(actor, input.opposition_id);
    return this.deps.pdfMaterials.uploadPdf({
      ...input,
      uploaded_by: actor.id,
    });
  }

  // Reprocesa la extraccion de texto de un PDF ya subido (p. ej. un material que
  // quedo `needs_review` por una extraccion fallida). Solo owner/admin.
  async reextractMaterial(actor: User, materialId: string): Promise<Material> {
    const material = await this.deps.materials.getMaterial(materialId);
    if (material) {
      await this.requireManageOpposition(actor, material.opposition_id);
    }
    return this.deps.pdfMaterials.reextractMaterial(materialId);
  }

  // Importar varios archivos a un tema (SPEC 017). Solo owner/admin.
  async importFilesToTopic(
    actor: User,
    input: ImportFilesInput,
  ): Promise<ImportResult> {
    await this.requireManageOpposition(actor, input.opposition_id);
    return this.deps.materialImport.importFiles({
      ...input,
      uploaded_by: actor.id,
    });
  }

  // Importar un ZIP a una oposicion (SPEC 017). Solo owner/admin.
  async importZip(actor: User, input: ImportZipInput): Promise<ImportResult> {
    await this.requireManageOpposition(actor, input.opposition_id);
    return this.deps.materialImport.importZip({
      ...input,
      uploaded_by: actor.id,
    });
  }

  // Carga masiva inteligente (SPEC 028): punto de entrada unico `Subir material`.
  // Solo owner/admin del workspace de la oposicion. El estudiante nunca sube.
  async smartUpload(
    actor: User,
    input: SmartUploadInput,
  ): Promise<SmartUploadResult> {
    await this.requireManageOpposition(actor, input.opposition_id);
    return this.deps.materialImport.smartUpload({
      ...input,
      uploaded_by: actor.id,
    });
  }

  // Consultar un lote de importacion (resumen + items). Solo owner/admin.
  async getImportBatch(
    actor: User,
    batchId: string,
  ): Promise<ImportResult | null> {
    const result = await this.deps.materialImport.getBatch(batchId);
    if (!result) {
      return null;
    }
    await this.requireManageOpposition(actor, result.batch.opposition_id);
    return result;
  }

  // --- Clasificacion documental e inventario (SPEC 028-B). Solo gestion. ----

  // Clasifica los documentos de un lote y crea el inventario. Solo owner/admin.
  async classifyImportBatch(
    actor: User,
    batchId: string,
  ): Promise<DocumentInventory> {
    const classifier = this.requireDocumentClassification();
    const batch = await this.deps.materialImport.getBatch(batchId);
    if (!batch) {
      throw new AccessError([AccessErrorCode.ACCESS_DENIED]);
    }
    await this.requireManageOpposition(actor, batch.batch.opposition_id);
    return classifier.classifyBatch({ batch_id: batchId, created_by: actor.id });
  }

  // Consulta el inventario (clasificaciones de la ultima ejecucion) de un lote.
  async getDocumentInventory(
    actor: User,
    batchId: string,
  ): Promise<DocumentInventory> {
    const classifier = this.requireDocumentClassification();
    const batch = await this.deps.materialImport.getBatch(batchId);
    if (!batch) {
      throw new AccessError([AccessErrorCode.ACCESS_DENIED]);
    }
    await this.requireManageOpposition(actor, batch.batch.opposition_id);
    return classifier.getInventory(batchId);
  }

  // Corrige manualmente la clasificacion de un documento. La correccion humana
  // prevalece sobre la IA (SPEC 028-B, 16). Solo owner/admin.
  async correctDocumentClassification(
    actor: User,
    classificationId: string,
    classification: DocumentClass,
  ): Promise<DocumentClassification> {
    const classifier = this.requireDocumentClassification();
    const existing = await classifier.getClassificationById(classificationId);
    if (!existing) {
      throw new AccessError([AccessErrorCode.ACCESS_DENIED]);
    }
    await this.requireManageOpposition(actor, existing.opposition_id ?? undefined);
    return classifier.correctClassification({
      classification_id: classificationId,
      classification,
      corrected_by: actor.id,
    });
  }

  // --- Secciones de material y referencias de fuente (SPEC 028-C). Solo gestion. --

  // Crea (o reprocesa) las secciones de un material util y prepara una referencia
  // de fuente por seccion. Solo owner/admin de la oposicion del material.
  async createMaterialSections(
    actor: User,
    materialId: string,
  ): Promise<MaterialSection[]> {
    const sectionsSvc = this.requireMaterialSections();
    const material = await this.deps.materials.getMaterial(materialId);
    if (!material) {
      throw new MaterialSectionError([
        MaterialSectionErrorCode.MATERIAL_NOT_FOUND,
      ]);
    }
    await this.requireManageOpposition(actor, material.opposition_id);
    const sections = await sectionsSvc.createSectionsForMaterial(materialId);
    // Prepara una referencia `material_section` por seccion (SPEC 028-C, 11).
    if (this.deps.sourceReferences) {
      for (const section of sections) {
        await this.deps.sourceReferences.createFromSection(section.id);
      }
    }
    return sections;
  }

  async listMaterialSections(
    actor: User,
    materialId: string,
  ): Promise<MaterialSection[]> {
    const sectionsSvc = this.requireMaterialSections();
    const material = await this.deps.materials.getMaterial(materialId);
    if (!material) {
      throw new MaterialSectionError([
        MaterialSectionErrorCode.MATERIAL_NOT_FOUND,
      ]);
    }
    await this.requireManageOpposition(actor, material.opposition_id);
    return sectionsSvc.listByMaterial(materialId);
  }

  async reprocessMaterialSections(
    actor: User,
    materialId: string,
  ): Promise<MaterialSection[]> {
    return this.createMaterialSections(actor, materialId);
  }

  async searchMaterialSections(
    actor: User,
    input: {
      opposition_id: string;
      query: string;
      classification?: SectionClass;
      material_ids?: string[];
      limit?: number;
    },
  ): Promise<MaterialSection[]> {
    const sectionsSvc = this.requireMaterialSections();
    await this.requireManageOpposition(actor, input.opposition_id);
    return sectionsSvc.search(input);
  }

  async listSourceReferencesByMaterial(
    actor: User,
    materialId: string,
  ): Promise<SourceReference[]> {
    const refsSvc = this.requireSourceReferences();
    const material = await this.deps.materials.getMaterial(materialId);
    if (!material) {
      throw new MaterialSectionError([
        MaterialSectionErrorCode.MATERIAL_NOT_FOUND,
      ]);
    }
    await this.requireManageOpposition(actor, material.opposition_id);
    return refsSvc.listByMaterial(materialId);
  }

  // Listar materiales de una oposicion. Gestor: todos. Estudiante con acceso:
  // solo `active` y NO los tipos de fuente interna (SPEC 012/028).
  async listMaterials(actor: User, oppositionId: string): Promise<Material[]> {
    // getOpposition exige membresia + acceso (gestor o estudiante activo).
    await this.deps.oppositions.getOpposition(actor, oppositionId);
    const all = await this.deps.materials.listMaterials({
      opposition_id: oppositionId,
    });
    if (await this.canManageOppositionWorkspace(actor, oppositionId)) {
      return all;
    }
    // Estudiante: filtro por tipo/estado (SPEC 028) + por clasificacion documental
    // (SPEC 028-B, 17.1): oculta tests antiguos, irrelevantes, no analizables y
    // dudosos aunque esten `active`.
    const visible: Material[] = [];
    for (const material of all) {
      if (await this.isStudentVisibleMaterialDeep(material)) {
        visible.push(material);
      }
    }
    return visible;
  }

  // Ver detalle/texto de un material. Estudiante solo si es material de estudio
  // `active` y su clasificacion no es interna (SPEC 028/028-B).
  async getMaterial(actor: User, materialId: string): Promise<Material> {
    const material = await this.deps.materials.getMaterial(materialId);
    if (!material) {
      throw new AccessError([AccessErrorCode.ACCESS_DENIED]);
    }
    await this.deps.oppositions.getOpposition(actor, material.opposition_id);
    if (
      !(await this.isStudentVisibleMaterialDeep(material)) &&
      !(await this.canManageOppositionWorkspace(actor, material.opposition_id))
    ) {
      throw new AccessError([AccessErrorCode.ACCESS_DENIED]);
    }
    return material;
  }

  // Visibilidad del alumno: filtro base por tipo/estado (SPEC 028) y, si la
  // clasificacion documental esta cableada (SPEC 028-B), tambien oculta los
  // materiales cuya clasificacion vigente es interna (old_exam_or_test,
  // irrelevant, not_analyzable, ambiguous). Si no hay servicio de clasificacion,
  // se queda en el filtro base (no rompe configuraciones previas).
  private async isStudentVisibleMaterialDeep(
    material: Material,
  ): Promise<boolean> {
    if (!isStudentVisibleMaterial(material)) {
      return false;
    }
    const classifier = this.deps.documentClassification;
    if (!classifier) {
      return true;
    }
    const classification = await classifier.getClassificationForMaterial(
      material.id,
    );
    if (classification && STUDENT_HIDDEN_CLASSES.has(classification.classification)) {
      return false;
    }
    return true;
  }

  async editMaterial(
    actor: User,
    materialId: string,
    changes: EditMaterialInput,
  ): Promise<Material> {
    const material = await this.deps.materials.getMaterial(materialId);
    await this.requireManageOpposition(actor, material?.opposition_id);
    return this.deps.materials.editMaterial(materialId, changes);
  }

  async markMaterialObsolete(actor: User, materialId: string): Promise<Material> {
    const material = await this.deps.materials.getMaterial(materialId);
    await this.requireManageOpposition(actor, material?.opposition_id);
    return this.deps.materials.markObsolete(materialId);
  }

  async createTopic(actor: User, input: CreateTopicInput): Promise<Topic> {
    await this.requireManageOpposition(actor, input.opposition_id);
    return this.deps.topics.createTopic(input);
  }

  async editTopic(
    actor: User,
    topicId: string,
    changes: Parameters<TopicService['editTopic']>[1],
  ): Promise<Topic> {
    const topic = await this.deps.topics.getTopic(topicId);
    await this.requireManageOpposition(actor, topic?.opposition_id);
    return this.deps.topics.editTopic(topicId, changes);
  }

  async markTopicObsolete(actor: User, topicId: string): Promise<Topic> {
    const topic = await this.deps.topics.getTopic(topicId);
    await this.requireManageOpposition(actor, topic?.opposition_id);
    return this.deps.topics.markObsolete(topicId);
  }

  // SPEC 028-E (cierre de elusion): NO se expone la generacion desde el texto
  // completo del material (sin fuente concreta). Toda generacion debe partir de
  // una fuente concreta y trazable: un fragmento pegado (`generateFromExcerpt`)
  // o un tema aplicado con sus fuentes (`generateQuestionsFromTopic`). El metodo
  // base `QuestionGenerationService.generateFromMaterial` sigue existiendo como
  // motor interno, pero el facade no lo ofrece a la UI/API.
  async generateFromExcerpt(
    actor: User,
    input: Parameters<QuestionGenerationService['generateFromExcerpt']>[0],
  ): Promise<GenerationResult> {
    const material = await this.deps.materials.getMaterial(input.material_id);
    await this.requireManageOpposition(actor, material?.opposition_id);
    return this.deps.generation.generateFromExcerpt(input);
  }

  async approve(
    actor: User,
    questionId: string,
    input?: ReviewActionInput,
  ): Promise<ReviewActionResult> {
    await this.requireManageQuestion(actor, questionId);
    return this.deps.review.approve(questionId, input);
  }

  async reject(
    actor: User,
    questionId: string,
    input?: ReviewActionInput,
  ): Promise<ReviewActionResult> {
    await this.requireManageQuestion(actor, questionId);
    return this.deps.review.reject(questionId, input);
  }

  async markNeedsFix(
    actor: User,
    questionId: string,
    input?: ReviewActionInput,
  ): Promise<ReviewActionResult> {
    await this.requireManageQuestion(actor, questionId);
    return this.deps.review.markNeedsFix(questionId, input);
  }

  async editFromReview(
    actor: User,
    questionId: string,
    changes: EditQuestionInput,
    input?: ReviewActionInput,
  ): Promise<ReviewActionResult> {
    await this.requireManageQuestion(actor, questionId);
    return this.deps.review.editFromReview(questionId, changes, input);
  }

  // Feedback estructurado de una pregunta (SPEC 018.4). Solo gestion.
  async listQuestionFeedback(
    actor: User,
    questionId: string,
  ): Promise<QuestionReviewFeedback[]> {
    await this.requireManageQuestion(actor, questionId);
    return this.deps.review.listFeedback(questionId);
  }

  // Resumen de feedback para alimentar la generacion (SPEC 018.4, 16). Solo
  // gestion del workspace de la oposicion.
  async getGenerationFeedbackSummary(
    actor: User,
    oppositionId: string,
  ): Promise<QuestionGenerationFeedbackSummary[]> {
    await this.requireManageOpposition(actor, oppositionId);
    if (!this.deps.feedback) {
      return [];
    }
    return this.deps.feedback.getFeedbackSummaryForGeneration({
      opposition_id: oppositionId,
    });
  }

  // --- Indice de temario con IA (SPEC 019). Solo gestion (owner/admin). -----

  async proposeSyllabusIndex(
    actor: User,
    input: {
      opposition_id: string;
      material_ids?: string[];
      only_unclassified?: boolean;
      // SPEC 028: lote de carga masiva + pistas de carpeta por material para que
      // las sugerencias de tema reflejen la estructura subida.
      batch_id?: string | null;
      folder_paths?: Record<string, string>;
    },
  ): Promise<ProposalDetail> {
    await this.requireManageOpposition(actor, input.opposition_id);
    const syllabus = this.requireSyllabus();
    const opposition = await this.deps.oppositionRepository.findById(
      input.opposition_id,
    );
    return syllabus.proposeIndex({
      opposition_id: input.opposition_id,
      workspace_id: opposition?.workspace_id ?? null,
      opposition_title: opposition?.title ?? null,
      created_by: actor.id,
      material_ids: input.material_ids,
      only_unclassified: input.only_unclassified,
      batch_id: input.batch_id ?? null,
      folder_paths: input.folder_paths,
    });
  }

  async listSyllabusProposals(
    actor: User,
    oppositionId: string,
  ): Promise<SyllabusIndexProposal[]> {
    await this.requireManageOpposition(actor, oppositionId);
    return this.requireSyllabus().listProposals(oppositionId);
  }

  async getSyllabusProposal(
    actor: User,
    proposalId: string,
  ): Promise<ProposalDetail> {
    await this.requireManageProposal(actor, proposalId);
    return this.requireSyllabus().getProposalDetail(proposalId);
  }

  async editSyllabusNode(
    actor: User,
    proposalId: string,
    nodeId: string,
    changes: Parameters<SyllabusIndexService['updateNode']>[1],
  ): Promise<SyllabusIndexNodeProposal> {
    await this.requireManageProposal(actor, proposalId);
    return this.requireSyllabus().updateNode(nodeId, changes);
  }

  async addSyllabusNode(
    actor: User,
    proposalId: string,
    input: Parameters<SyllabusIndexService['addNode']>[1],
  ): Promise<SyllabusIndexNodeProposal> {
    await this.requireManageProposal(actor, proposalId);
    return this.requireSyllabus().addNode(proposalId, input);
  }

  async setSyllabusNodeStatus(
    actor: User,
    proposalId: string,
    nodeId: string,
    status: SyllabusNodeStatus,
  ): Promise<SyllabusIndexNodeProposal> {
    await this.requireManageProposal(actor, proposalId);
    return this.requireSyllabus().setNodeStatus(nodeId, status);
  }

  async setSyllabusSuggestionStatus(
    actor: User,
    proposalId: string,
    suggestionId: string,
    status: MaterialTopicSuggestion['status'],
  ): Promise<MaterialTopicSuggestion> {
    await this.requireManageProposal(actor, proposalId);
    return this.requireSyllabus().setSuggestionStatus(suggestionId, status);
  }

  async approveSyllabusProposal(
    actor: User,
    proposalId: string,
  ): Promise<SyllabusIndexProposal> {
    await this.requireManageProposal(actor, proposalId);
    return this.requireSyllabus().approveProposal(proposalId, actor.id);
  }

  async rejectSyllabusProposal(
    actor: User,
    proposalId: string,
  ): Promise<SyllabusIndexProposal> {
    await this.requireManageProposal(actor, proposalId);
    return this.requireSyllabus().rejectProposal(proposalId);
  }

  async applySyllabusProposal(
    actor: User,
    proposalId: string,
  ): Promise<ApplyResult> {
    await this.requireManageProposal(actor, proposalId);
    return this.requireSyllabus().applyProposal(proposalId);
  }

  // --- Indice anclado a documentos (SPEC 028-D). Solo gestion. -------------
  // Reutiliza el ciclo de revision de SPEC 019 (editSyllabusNode/
  // setSyllabusNodeStatus/approveSyllabusProposal/rejectSyllabusProposal), que
  // operan sobre el mismo repositorio.

  async proposeSyllabusIndexFromDocuments(
    actor: User,
    input: { opposition_id: string; material_ids?: string[] },
  ): Promise<GroundedProposalDetail> {
    await this.requireManageOpposition(actor, input.opposition_id);
    const service = this.requireSyllabusFromDocuments();
    const opposition = await this.deps.oppositionRepository.findById(
      input.opposition_id,
    );
    return service.proposeFromDocuments({
      opposition_id: input.opposition_id,
      workspace_id: opposition?.workspace_id ?? null,
      opposition_title: opposition?.title ?? null,
      created_by: actor.id,
      material_ids: input.material_ids,
    });
  }

  async getSyllabusIndexProposalDetail(
    actor: User,
    proposalId: string,
  ): Promise<GroundedProposalDetail> {
    await this.requireManageProposal(actor, proposalId);
    return this.requireSyllabusFromDocuments().getProposalDetail(proposalId);
  }

  async applySyllabusIndexFromDocuments(
    actor: User,
    proposalId: string,
  ): Promise<ApplyGroundedResult> {
    await this.requireManageProposal(actor, proposalId);
    return this.requireSyllabusFromDocuments().applyProposal(proposalId);
  }

  // --- Generacion de preguntas anclada a fuentes (SPEC 028-E). Solo gestion. --

  // Vista previa de las fuentes disponibles para un tema aplicado.
  async previewTopicSources(
    actor: User,
    input: { opposition_id: string; topic_id: string },
  ): Promise<RetrievalResult> {
    await this.requireManageOpposition(actor, input.opposition_id);
    const opposition = await this.deps.oppositionRepository.findById(
      input.opposition_id,
    );
    return this.requireSourceGrounded().previewSources({
      opposition_id: input.opposition_id,
      workspace_id: opposition?.workspace_id ?? null,
      topic_id: input.topic_id,
    });
  }

  // Genera preguntas candidatas desde un tema aplicado y sus fuentes concretas.
  // Las candidatas quedan en pending_review/needs_fix; nunca validated.
  async generateQuestionsFromTopic(
    actor: User,
    input: Omit<GenerateFromTopicInput, 'workspace_id'>,
  ): Promise<SourceGroundedResult> {
    await this.requireManageOpposition(actor, input.opposition_id);
    const opposition = await this.deps.oppositionRepository.findById(
      input.opposition_id,
    );
    return this.requireSourceGrounded().generateFromTopic({
      ...input,
      workspace_id: opposition?.workspace_id ?? null,
    });
  }

  // --- IA de la oposicion: aprendizaje de patrones (SPEC 028-F). Solo gestion. ---

  // Analiza los examenes antiguos usables y crea un perfil de estilo en draft.
  async analyzeExamPatterns(actor: User, oppositionId: string) {
    await this.requireManageOpposition(actor, oppositionId);
    return this.requireExamPatterns().analyze({
      opposition_id: oppositionId,
      created_by: actor.id,
    });
  }

  async listStyleProfiles(actor: User, oppositionId: string) {
    await this.requireManageOpposition(actor, oppositionId);
    return this.requireExamPatterns().listProfiles(oppositionId);
  }

  async getStyleProfile(actor: User, profileId: string) {
    const profile = await this.requireExamPatterns().getProfile(profileId);
    if (profile) {
      await this.requireManageOpposition(actor, profile.opposition_id);
    }
    return profile;
  }

  async submitStyleProfileForReview(actor: User, profileId: string) {
    await this.requireManageOfProfile(actor, profileId);
    return this.requireExamPatterns().submitForReview(profileId);
  }

  async activateStyleProfile(actor: User, profileId: string) {
    await this.requireManageOfProfile(actor, profileId);
    return this.requireExamPatterns().activate(profileId, actor.id);
  }

  async rejectStyleProfile(actor: User, profileId: string) {
    await this.requireManageOfProfile(actor, profileId);
    return this.requireExamPatterns().reject(profileId);
  }

  // Memoria de errores IA (derivada del feedback humano). Solo gestion. Refresca
  // acotando por TODOS los temas de la oposicion (adaptacion por tema).
  async refreshErrorMemory(actor: User, oppositionId: string) {
    await this.requireManageOpposition(actor, oppositionId);
    const opposition =
      await this.deps.oppositionRepository.findById(oppositionId);
    const topics = (await this.deps.topics.listTopics())
      .filter((t) => t.opposition_id === oppositionId)
      .map((t) => ({ id: t.id }));
    return this.requireErrorMemory().refresh(oppositionId, {
      topics,
      workspaceId: opposition?.workspace_id ?? null,
    });
  }

  async listErrorMemory(actor: User, oppositionId: string) {
    await this.requireManageOpposition(actor, oppositionId);
    return this.requireErrorMemory().list(oppositionId);
  }

  // Visibilidad del contexto que usaria la generacion adaptativa (perfil + memoria).
  async getGenerationContextPreview(
    actor: User,
    oppositionId: string,
    topicId?: string,
  ): Promise<{
    profile_id: string | null;
    profile_version: number | null;
    style_rules: string[];
    avoid_instructions: string[];
  }> {
    await this.requireManageOpposition(actor, oppositionId);
    const profile = await this.requireExamPatterns().getActiveProfile(
      oppositionId,
    );
    // Refresca la memoria desde el feedback ACTUAL para que el preview sea fiel.
    let avoid: string[] = [];
    if (this.deps.aiErrorMemory) {
      await this.deps.aiErrorMemory.refresh(oppositionId, {
        topics: topicId ? [{ id: topicId }] : [],
      });
      avoid = await this.deps.aiErrorMemory.getAvoidInstructions(oppositionId, {
        topic_id: topicId ?? null,
      });
    }
    return {
      profile_id: profile?.id ?? null,
      profile_version: profile?.version ?? null,
      style_rules: profile ? formatStyleRules(profile.rules) : [],
      avoid_instructions: avoid,
    };
  }

  // Quality score de una pregunta generada (para mostrar warnings en la revision).
  async getQuestionQualityScore(actor: User, questionId: string) {
    await this.requireManageQuestion(actor, questionId);
    return this.requireExamPatterns().getQualityScoreForQuestion(questionId);
  }

  // --- Estudio (miembro del workspace con acceso a la oposicion) -----------

  async createTest(
    actor: User,
    request: GenerateTestRequest,
  ): Promise<GeneratedTest> {
    // getOpposition exige membresia de workspace + acceso a la oposicion.
    if (!isNonEmptyString(request.opposition_id)) {
      throw new AccessError([AccessErrorCode.OPPOSITION_REQUIRED]);
    }
    await this.deps.oppositions.getOpposition(actor, request.opposition_id);
    return this.deps.testGenerator.generate(request);
  }

  async startAttempt(actor: User, testId: string): Promise<TestAttempt> {
    const view = await this.deps.testGenerator.getTest(testId);
    await this.deps.oppositions.getOpposition(actor, view.test.opposition_id);
    return this.deps.attempts.startAttempt(testId, actor.id);
  }

  async getTestForTaking(actor: User, attemptId: string): Promise<TakingView> {
    await this.requireAttemptOwner(actor, attemptId);
    return this.deps.attempts.getTestForTaking(attemptId);
  }

  async saveAnswer(
    actor: User,
    input: { attempt_id: string; test_question_id: string; selected_option_id: string },
  ): Promise<TestAnswer> {
    await this.requireAttemptOwner(actor, input.attempt_id);
    return this.deps.attempts.saveAnswer(input);
  }

  async clearAnswer(
    actor: User,
    input: { attempt_id: string; test_question_id: string },
  ): Promise<void> {
    await this.requireAttemptOwner(actor, input.attempt_id);
    await this.deps.attempts.clearAnswer(input);
  }

  async submitAttempt(actor: User, attemptId: string): Promise<TestAttempt> {
    await this.requireAttemptOwner(actor, attemptId);
    return this.deps.attempts.submitAttempt(attemptId);
  }

  async getResult(actor: User, attemptId: string): Promise<AttemptResult> {
    await this.requireAttemptOwner(actor, attemptId);
    return this.deps.attempts.getResult(attemptId);
  }

  async getReview(actor: User, attemptId: string): Promise<AttemptReview> {
    await this.requireAttemptOwner(actor, attemptId);
    return this.deps.attempts.getReview(attemptId);
  }

  // "Mis resultados" (SPEC 013): intentos enviados del propio usuario, con
  // resultado y titulo del test. Solo del actor, ordenados por mas reciente.
  async listMyResults(actor: User): Promise<MyResultSummary[]> {
    requireUser(actor);
    const attempts = (await this.deps.attempts.listAttemptsForUser(actor.id))
      .filter((attempt) => attempt.status === 'submitted');
    const summaries: MyResultSummary[] = [];
    for (const attempt of attempts) {
      const result = await this.deps.attempts.getResult(attempt.id);
      let testTitle: string | null = null;
      try {
        testTitle = (await this.deps.testGenerator.getTest(attempt.test_id)).test
          .title;
      } catch {
        testTitle = null;
      }
      summaries.push({ ...result, test_title: testTitle });
    }
    return summaries;
  }

  async getTest(actor: User, testId: string) {
    const view = await this.deps.testGenerator.getTest(testId);
    await this.deps.oppositions.getOpposition(actor, view.test.opposition_id);
    return view;
  }

  async cancelTest(actor: User, testId: string) {
    const view = await this.deps.testGenerator.getTest(testId);
    await this.requireManageOpposition(actor, view.test.opposition_id);
    return this.deps.testGenerator.cancelTest(testId);
  }

  // --- Guards internos ------------------------------------------------------

  private async requireManageOpposition(
    actor: User,
    oppositionId: string | undefined | null,
  ): Promise<void> {
    requireUser(actor);
    if (!isNonEmptyString(oppositionId)) {
      throw new AccessError([AccessErrorCode.OPPOSITION_REQUIRED]);
    }
    const opposition = await this.deps.oppositionRepository.findById(
      oppositionId,
    );
    if (!opposition) {
      throw new AccessError([AccessErrorCode.OPPOSITION_NOT_FOUND]);
    }
    await requireManageWorkspace(
      this.deps.workspaceMembers,
      actor,
      opposition.workspace_id,
    );
  }

  // True si el actor puede gestionar (owner/admin) el workspace de la oposicion.
  // No lanza: se usa para decidir visibilidad de materiales no activos.
  private async canManageOppositionWorkspace(
    actor: User,
    oppositionId: string,
  ): Promise<boolean> {
    const opposition = await this.deps.oppositionRepository.findById(
      oppositionId,
    );
    if (!opposition) {
      return false;
    }
    return canManageWorkspace(
      this.deps.workspaceMembers,
      actor,
      opposition.workspace_id,
    );
  }

  private async requireManageQuestion(
    actor: User,
    questionId: string,
  ): Promise<void> {
    const question = await this.deps.questions.getQuestion(questionId);
    await this.requireManageOpposition(actor, question?.opposition_id);
  }

  private requireSyllabus(): SyllabusIndexService {
    if (!this.deps.syllabus) {
      throw new SyllabusIndexError([
        SyllabusIndexErrorCode.PROVIDER_NOT_CONFIGURED,
      ]);
    }
    return this.deps.syllabus;
  }

  private requireDocumentClassification(): DocumentClassificationService {
    if (!this.deps.documentClassification) {
      throw new DocumentClassificationError([
        DocumentClassificationErrorCode.PROVIDER_NOT_CONFIGURED,
      ]);
    }
    return this.deps.documentClassification;
  }

  private requireSyllabusFromDocuments(): SyllabusIndexFromDocumentsService {
    if (!this.deps.syllabusFromDocuments) {
      throw new SyllabusIndexError([
        SyllabusIndexErrorCode.PROVIDER_NOT_CONFIGURED,
      ]);
    }
    return this.deps.syllabusFromDocuments;
  }

  private requireSourceGrounded(): SourceGroundedQuestionGenerationService {
    if (!this.deps.sourceGroundedGeneration) {
      throw new QuestionGenerationError([
        QuestionGenerationErrorCode.NO_SOURCES,
      ]);
    }
    return this.deps.sourceGroundedGeneration;
  }

  private requireExamPatterns(): ExamPatternAnalysisService {
    if (!this.deps.examPatternAnalysis) {
      throw new Error('Aprendizaje de patrones de examen no configurado.');
    }
    return this.deps.examPatternAnalysis;
  }

  private requireErrorMemory(): AIErrorMemoryService {
    if (!this.deps.aiErrorMemory) {
      throw new Error('Memoria de errores IA no configurada.');
    }
    return this.deps.aiErrorMemory;
  }

  // Guard de gestion derivado del perfil (via su oposicion).
  private async requireManageOfProfile(
    actor: User,
    profileId: string,
  ): Promise<void> {
    const profile = await this.requireExamPatterns().getProfile(profileId);
    if (!profile) {
      throw new Error('Perfil de estilo no encontrado.');
    }
    await this.requireManageOpposition(actor, profile.opposition_id);
  }

  private requireMaterialSections(): MaterialSectionService {
    if (!this.deps.materialSections) {
      throw new MaterialSectionError([
        MaterialSectionErrorCode.CREATE_FAILED,
      ]);
    }
    return this.deps.materialSections;
  }

  private requireSourceReferences(): SourceReferenceService {
    if (!this.deps.sourceReferences) {
      throw new MaterialSectionError([
        MaterialSectionErrorCode.CREATE_FAILED,
      ]);
    }
    return this.deps.sourceReferences;
  }

  // Resuelve la oposicion de una propuesta de indice y exige gestionarla.
  private async requireManageProposal(
    actor: User,
    proposalId: string,
  ): Promise<void> {
    const proposal = await this.requireSyllabus().getProposal(proposalId);
    if (!proposal) {
      throw new SyllabusIndexError([
        SyllabusIndexErrorCode.PROPOSAL_NOT_FOUND,
      ]);
    }
    await this.requireManageOpposition(actor, proposal.opposition_id);
  }

  private async requireAttemptOwner(
    actor: User,
    attemptId: string,
  ): Promise<void> {
    requireUser(actor);
    const attempt = await this.deps.attempts.getAttempt(attemptId);
    // Si el intento tiene dueno y no es el actor, se deniega (resultados ajenos).
    if (attempt && attempt.user_id && attempt.user_id !== actor.id) {
      throw new AccessError([AccessErrorCode.ACCESS_DENIED]);
    }
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// SPEC 028, 29: los tests antiguos / examenes son FUENTE INTERNA de generacion,
// no material de estudio. El alumno nunca los ve, ni siquiera `active`.
const STUDENT_HIDDEN_MATERIAL_TYPES = new Set<Material['type']>([
  'old_test',
  'official_exam',
]);

// Material visible para un alumno con acceso: `active` y de un tipo de estudio.
function isStudentVisibleMaterial(material: Material): boolean {
  return (
    material.status === 'active' &&
    !STUDENT_HIDDEN_MATERIAL_TYPES.has(material.type)
  );
}
