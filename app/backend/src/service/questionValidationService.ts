// Compuerta de calidad de preguntas (SPEC 005).
//
// Reune los hallazgos de todas las capas (formal, fuente, tema, duplicados,
// ambiguedad, info y proveedor opcional) en un informe estructurado y, al
// aplicarlo, mueve la pregunta a `needs_fix` (si hay errores) o `pending_review`
// (si no los hay). NUNCA pasa una pregunta a `validated`.
//
// Reutiliza el banco de preguntas (SPEC 001) y los repos de material (SPEC 002)
// y tema (SPEC 003); no crea un segundo modelo de pregunta.

import { randomUUID } from 'node:crypto';
import type { Question } from '../models/question.js';
import type { QuestionValidationResult } from '../models/questionValidationResult.js';
import type {
  RecommendedStatus,
  ValidationReportStatus,
} from '../models/questionValidationResult.js';
import type { MaterialRepository } from '../repository/materialRepository.js';
import type { TopicRepository } from '../repository/topicRepository.js';
import type { QuestionValidationReportRepository } from '../repository/questionValidationReportRepository.js';
import { InMemoryQuestionValidationReportRepository } from '../repository/inMemoryQuestionValidationReportRepository.js';
import { normalizeOptionText } from '../validation/normalizeOptionText.js';
import { QuestionService } from './questionService.js';
import {
  ambiguityFindings,
  formalFindings,
  infoFindings,
} from '../quality/qualityChecks.js';
import {
  makeFinding,
  QuestionValidationCode,
  type Finding,
} from '../quality/qualityCodes.js';
import type { QuestionValidationProvider } from '../quality/questionValidationProvider.js';

const VALIDATOR_VERSION = 'quality-gate-1';

// Estados que el validador puede revisar de forma masiva (nunca `validated`).
const PENDING_STATUSES = ['draft', 'pending_review', 'needs_fix'] as const;

export interface QuestionValidationServiceOptions {
  questionService: QuestionService;
  materialRepository: MaterialRepository;
  topicRepository: TopicRepository;
  reportRepository?: QuestionValidationReportRepository;
  provider?: QuestionValidationProvider;
  generateId?: () => string;
  now?: () => Date;
}

export interface ApplyValidationResult {
  question: Question;
  result: QuestionValidationResult;
}

export class QuestionValidationService {
  private readonly questions: QuestionService;
  private readonly materials: MaterialRepository;
  private readonly topics: TopicRepository;
  private readonly reports: QuestionValidationReportRepository;
  private readonly provider?: QuestionValidationProvider;
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(options: QuestionValidationServiceOptions) {
    this.questions = options.questionService;
    this.materials = options.materialRepository;
    this.topics = options.topicRepository;
    this.reports =
      options.reportRepository ??
      new InMemoryQuestionValidationReportRepository();
    this.provider = options.provider;
    this.generateId = options.generateId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  // 10.1 Validar una pregunta y guardar el informe.
  validateQuestion(questionId: string): QuestionValidationResult {
    const question = this.questions.getQuestion(questionId);
    if (!question) {
      throw new Error(`Question not found: ${questionId}`);
    }
    const findings = this.collectFindings(question);
    const result = this.buildResult(question.id, findings);
    return this.reports.save(result);
  }

  // 10.2 Validar un lote sin detener el proceso por un fallo. Las preguntas
  // inexistentes se omiten.
  validateMany(questionIds: string[]): QuestionValidationResult[] {
    const results: QuestionValidationResult[] = [];
    for (const id of questionIds) {
      if (this.questions.getQuestion(id)) {
        results.push(this.validateQuestion(id));
      }
    }
    return results;
  }

  // 10.3 Validar todas las preguntas pendientes (no toca `validated`).
  validatePending(): QuestionValidationResult[] {
    const pending = this.questions
      .listQuestions()
      .filter((question) =>
        (PENDING_STATUSES as readonly string[]).includes(question.status),
      );
    return this.validateMany(pending.map((question) => question.id));
  }

  // 10.4 Aplicar el resultado: errores -> needs_fix; sin errores -> pending_review.
  applyValidation(questionId: string): ApplyValidationResult {
    const result = this.validateQuestion(questionId);
    const question = this.questions.changeStatus(
      questionId,
      result.recommended_status,
    );
    return { question, result };
  }

  // 10.5 Ultimo informe guardado para una pregunta.
  getLastReport(questionId: string): QuestionValidationResult | null {
    return this.reports.findLastByQuestion(questionId);
  }

  private collectFindings(question: Question): Finding[] {
    return [
      ...formalFindings(question),
      ...this.sourceFindings(question),
      ...this.topicFindings(question),
      ...this.duplicateFindings(question),
      ...ambiguityFindings(question),
      ...infoFindings(question),
      ...(this.provider ? this.provider.review(question) : []),
    ];
  }

  // Capa de fuente (SPEC 005, 7.2). La presencia de fuente la cubre la capa
  // formal; aqui se resuelve el material y la obsolescencia.
  private sourceFindings(question: Question): Finding[] {
    const findings: Finding[] = [];
    const source = question.source;
    if (!source) {
      return findings;
    }

    if (source.status === 'obsolete') {
      findings.push(makeFinding(QuestionValidationCode.SOURCE_OBSOLETE));
    }

    if (source.material_id) {
      const material = this.materials.findById(source.material_id);
      if (!material) {
        findings.push(
          makeFinding(QuestionValidationCode.SOURCE_MATERIAL_NOT_FOUND),
        );
      } else if (material.status === 'obsolete') {
        findings.push(
          makeFinding(QuestionValidationCode.SOURCE_MATERIAL_OBSOLETE),
        );
      } else {
        findings.push(makeFinding(QuestionValidationCode.INFO_SOURCE_LINKED));
      }
    }

    if (!isNonEmptyString(source.reference)) {
      findings.push(
        makeFinding(QuestionValidationCode.SOURCE_REFERENCE_MISSING),
      );
    }
    if (!isNonEmptyString(source.excerpt)) {
      findings.push(makeFinding(QuestionValidationCode.SOURCE_EXCERPT_MISSING));
    }

    return findings;
  }

  // Capa de tema (SPEC 005, 7.3). La presencia de tema la cubre la capa formal;
  // aqui se resuelve el `topic_id` y su obsolescencia.
  private topicFindings(question: Question): Finding[] {
    const findings: Finding[] = [];
    if (!question.topic_id) {
      return findings;
    }
    const topic = this.topics.findById(question.topic_id);
    if (!topic) {
      findings.push(makeFinding(QuestionValidationCode.TOPIC_NOT_FOUND));
    } else if (topic.status === 'obsolete') {
      findings.push(makeFinding(QuestionValidationCode.TOPIC_OBSOLETE));
    }
    return findings;
  }

  // Capa de duplicados (SPEC 005, 7.5): enunciado normalizado igual a otra.
  private duplicateFindings(question: Question): Finding[] {
    if (!isNonEmptyString(question.statement)) {
      return [];
    }
    const normalized = normalizeOptionText(question.statement);
    const duplicate = this.questions
      .listQuestions()
      .some(
        (other) =>
          other.id !== question.id &&
          isNonEmptyString(other.statement) &&
          normalizeOptionText(other.statement) === normalized,
      );
    return duplicate
      ? [makeFinding(QuestionValidationCode.DUPLICATE_STATEMENT)]
      : [];
  }

  private buildResult(
    questionId: string,
    findings: Finding[],
  ): QuestionValidationResult {
    const errors = findings.filter((f) => f.severity === 'error');
    const warnings = findings.filter((f) => f.severity === 'warning');
    const info = findings.filter((f) => f.severity === 'info');

    const passed = errors.length === 0;
    const status: ValidationReportStatus = !passed
      ? 'failed'
      : warnings.length > 0
        ? 'passed_with_warnings'
        : 'passed';
    const recommendedStatus: RecommendedStatus = passed
      ? 'pending_review'
      : 'needs_fix';

    return {
      id: this.generateId(),
      question_id: questionId,
      status,
      passed,
      errors,
      warnings,
      info,
      validated_at: this.now(),
      validator_version: VALIDATOR_VERSION,
      recommended_status: recommendedStatus,
    };
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
