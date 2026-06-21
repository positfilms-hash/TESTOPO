// Servicio de analisis de patrones de examen (SPEC 028-F).
//
// Analiza SOLO documentos `old_exam_or_test` USABLES (extraccion completada, no
// escaneados/corruptos/obsoletos) y deriva agregados de estilo + huellas
// anti-copia (sin contenido verbatim). Persiste un `ExamPatternAnalysisRun`, un
// `QuestionStyleProfile` en `draft` (activacion humana obligatoria, fase
// posterior) y `TopicExamPattern` por tema vinculado. "Sin examenes" es WARNING,
// no fallo. Deterministico, sin red (analizador puro).

import { randomUUID } from 'node:crypto';
import type { Material } from '../models/material.js';
import type {
  ExamPatternAnalysisRun,
  QuestionStyleProfile,
  TopicExamPattern,
} from '../models/examPatternLearning.js';
import type { MaterialRepository } from '../repository/materialRepository.js';
import type { MaterialSectionRepository } from '../repository/materialSectionRepository.js';
import type { TopicMaterialLinkRepository } from '../repository/topicMaterialLinkRepository.js';
import type { ExamPatternLearningRepository } from '../repository/examPatternLearningRepository.js';
import type { DocumentClassificationService } from './documentClassificationService.js';
import { analyzeExamText } from '../analysis/examPatternAnalyzer.js';

export interface ExamPatternAnalysisResult {
  run: ExamPatternAnalysisRun;
  /** Perfil draft creado (null si no habia exámenes analizables). */
  profile: QuestionStyleProfile | null;
  topicPatterns: TopicExamPattern[];
  warnings: string[];
}

export interface ExamPatternAnalysisServiceDeps {
  materials: MaterialRepository;
  sections: MaterialSectionRepository;
  topicMaterialLinks: TopicMaterialLinkRepository;
  repository: ExamPatternLearningRepository;
  /** Para filtrar a `old_exam_or_test`; si falta, se usa `material.type`. */
  documentClassification?: DocumentClassificationService;
  generateId?: () => string;
  now?: () => Date;
}

const PROVIDER = 'heuristic-exam-pattern-analyzer-1';

export class ExamPatternAnalysisService {
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(private readonly deps: ExamPatternAnalysisServiceDeps) {
    this.generateId = deps.generateId ?? (() => randomUUID());
    this.now = deps.now ?? (() => new Date());
  }

  async analyze(input: {
    opposition_id: string;
    created_by?: string | null;
  }): Promise<ExamPatternAnalysisResult> {
    if (!input.opposition_id || input.opposition_id.trim().length === 0) {
      throw new Error('opposition_id requerido para el análisis de patrones.');
    }
    const oppositionId = input.opposition_id;
    const warnings: string[] = [];

    const materials = (
      await this.deps.materials.findAll({ opposition_id: oppositionId })
    ).filter((m) => m.status === 'active');

    const usable: Material[] = [];
    for (const material of materials) {
      if (
        material.extraction_status &&
        material.extraction_status !== 'completed'
      ) {
        continue; // gate de extraccion (SPEC 028-F prerequisito)
      }
      if (await this.isUsableOldExam(material)) {
        usable.push(material);
      }
    }

    // Recoge el texto de los examenes (secciones de tipo bloque de preguntas).
    const blocks: string[] = [];
    const usedMaterialIds: string[] = [];
    for (const material of usable) {
      const sections = await this.deps.sections.listByMaterial(material.id);
      const examSections = sections.filter(
        (s) => s.section_type === 'exam_question_block',
      );
      const texts = (examSections.length ? examSections : sections)
        .map((s) => s.content_text)
        .filter((t) => t && t.trim().length > 0);
      if (texts.length === 0 && material.content_text) {
        texts.push(material.content_text);
      }
      if (texts.length > 0) {
        blocks.push(...texts);
        usedMaterialIds.push(material.id);
      }
    }

    if (usable.length === 0) {
      warnings.push(
        'No hay exámenes antiguos analizables en esta oposición (clasificados, con texto y no obsoletos).',
      );
    }

    const analysis = analyzeExamText(blocks);
    warnings.push(...analysis.warnings);

    const status: ExamPatternAnalysisRun['status'] =
      warnings.length > 0 ? 'completed_with_warnings' : 'completed';
    const timestamp = this.now();
    const run = await this.deps.repository.createRun({
      id: this.generateId(),
      workspace_id: null,
      opposition_id: oppositionId,
      created_by: input.created_by ?? null,
      status,
      provider: PROVIDER,
      model: null,
      input_material_ids: usedMaterialIds,
      input_section_ids: [],
      old_exam_count: usable.length,
      analyzed_question_count: analysis.analyzed_question_count,
      warnings,
      errors: [],
      created_at: timestamp,
      updated_at: timestamp,
    });

    // Solo se crea perfil si hay material que aprender.
    let profile: QuestionStyleProfile | null = null;
    if (analysis.analyzed_question_count > 0) {
      const existing =
        await this.deps.repository.listProfilesByOpposition(oppositionId);
      const nextVersion =
        existing.reduce((max, p) => Math.max(max, p.version), 0) + 1;
      profile = await this.deps.repository.createProfile({
        id: this.generateId(),
        workspace_id: null,
        opposition_id: oppositionId,
        version: nextVersion,
        status: 'draft',
        selected_summary_ids: [],
        rules: analysis.rules,
        fingerprints: analysis.fingerprints,
        coverage_notes: null,
        confidence: round2(Math.min(1, analysis.analyzed_question_count / 50)),
        warnings,
        created_by: input.created_by ?? null,
        approved_by: null,
        approved_at: null,
        created_at: timestamp,
        updated_at: timestamp,
      });
    }

    const topicPatterns = await this.buildTopicPatterns(
      oppositionId,
      usable,
      profile,
      analysis.rules.common_question_types,
      analysis.rules.trap_patterns,
      timestamp,
    );
    if (usable.length > 0 && topicPatterns.length === 0) {
      warnings.push(
        'Los exámenes no están vinculados a temas; no se han creado patrones por tema.',
      );
    }

    return { run, profile, topicPatterns, warnings };
  }

  private async isUsableOldExam(material: Material): Promise<boolean> {
    if (this.deps.documentClassification) {
      const classification =
        await this.deps.documentClassification.getClassificationForMaterial(
          material.id,
        );
      return classification?.classification === 'old_exam_or_test';
    }
    return material.type === 'old_test';
  }

  private async buildTopicPatterns(
    oppositionId: string,
    usable: Material[],
    profile: QuestionStyleProfile | null,
    commonTypes: string[],
    trapPatterns: string[],
    timestamp: Date,
  ): Promise<TopicExamPattern[]> {
    const countByTopic = new Map<string, number>();
    for (const material of usable) {
      const links = await this.deps.topicMaterialLinks.findAll({
        material_id: material.id,
      });
      for (const link of links) {
        countByTopic.set(
          link.topic_id,
          (countByTopic.get(link.topic_id) ?? 0) + 1,
        );
      }
    }
    const total = usable.length || 1;
    const created: TopicExamPattern[] = [];
    for (const [topicId, count] of countByTopic) {
      created.push(
        await this.deps.repository.createTopicPattern({
          id: this.generateId(),
          workspace_id: null,
          opposition_id: oppositionId,
          topic_id: topicId,
          style_profile_id: profile?.id ?? null,
          frequency_score: round2(count / total),
          difficulty_score: null,
          common_question_types: commonTypes,
          trap_patterns: trapPatterns,
          style_notes: null,
          coverage_notes: null,
          created_at: timestamp,
          updated_at: timestamp,
        }),
      );
    }
    return created;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
