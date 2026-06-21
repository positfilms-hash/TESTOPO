// Contrato de persistencia del aprendizaje de patrones de examen (SPEC 028-F).
// Una sola interfaz agrupa las 5 entidades por simplicidad (como
// SyllabusIndexRepository): runs de analisis, perfiles de estilo, patrones por
// tema, memoria de errores IA y puntuaciones de calidad por candidata.

import type {
  AIErrorMemory,
  AIQuestionQualityScore,
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
