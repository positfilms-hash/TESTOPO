// Contrato de persistencia del aprendizaje de patrones de examen (SPEC 028-F).
// Una sola interfaz agrupa las 5 entidades por simplicidad (como
// SyllabusIndexRepository): runs de analisis, perfiles de estilo, patrones por
// tema, memoria de errores IA y puntuaciones de calidad por candidata.

import type {
  AIErrorMemory,
  AIQuestionQualityScore,
  ErrorMemoryUpsertInput,
  ExamPatternAnalysisRun,
  QuestionStyleProfile,
  TopicExamPattern,
} from '../models/examPatternLearning.js';

export interface ExamPatternLearningRepository {
  // --- Analysis runs ---
  createRun(run: ExamPatternAnalysisRun): Promise<ExamPatternAnalysisRun>;
  getRun(id: string): Promise<ExamPatternAnalysisRun | null>;
  updateRun(run: ExamPatternAnalysisRun): Promise<ExamPatternAnalysisRun>;
  listRunsByOpposition(oppositionId: string): Promise<ExamPatternAnalysisRun[]>;

  // --- Style profiles (versionado; 1 activo por oposicion) ---
  createProfile(profile: QuestionStyleProfile): Promise<QuestionStyleProfile>;
  getProfile(id: string): Promise<QuestionStyleProfile | null>;
  updateProfile(profile: QuestionStyleProfile): Promise<QuestionStyleProfile>;
  listProfilesByOpposition(
    oppositionId: string,
  ): Promise<QuestionStyleProfile[]>;
  /** Perfil ACTIVO de la oposicion (a lo sumo uno). */
  getActiveProfile(oppositionId: string): Promise<QuestionStyleProfile | null>;

  // --- Topic exam patterns ---
  createTopicPattern(pattern: TopicExamPattern): Promise<TopicExamPattern>;
  listTopicPatternsByProfile(
    profileId: string,
  ): Promise<TopicExamPattern[]>;
  listTopicPatternsByOpposition(
    oppositionId: string,
  ): Promise<TopicExamPattern[]>;

  // --- AI error memory ---
  createErrorMemory(entry: AIErrorMemory): Promise<AIErrorMemory>;
  updateErrorMemory(entry: AIErrorMemory): Promise<AIErrorMemory>;
  /**
   * UPSERT por clave de agregacion (workspace + oposicion + tipo + ambito +
   * dificultad). Si existe, incrementa `occurrences`, refresca severidad (max),
   * `last_seen_at`, `avoid_instruction` y `example_question_id`; si no, crea con
   * `occurrences = 1`. Es el mecanismo de poblado de memoria POR REVISION
   * (SPEC 040): la memoria no depende de la siguiente generacion.
   */
  upsertErrorMemory(input: ErrorMemoryUpsertInput): Promise<AIErrorMemory>;
  listErrorMemoriesByOpposition(
    oppositionId: string,
  ): Promise<AIErrorMemory[]>;
  /** Limpia la memoria de una oposicion para regenerarla (refresh). */
  deleteErrorMemoriesByOpposition(oppositionId: string): Promise<void>;

  // --- AI question quality scores ---
  createQualityScore(
    score: AIQuestionQualityScore,
  ): Promise<AIQuestionQualityScore>;
  getQualityScoreByQuestion(
    questionId: string,
  ): Promise<AIQuestionQualityScore | null>;
  listQualityScoresByRun(runId: string): Promise<AIQuestionQualityScore[]>;
}
