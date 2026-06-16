// Punto de entrada publico del banco de preguntas (SPEC 001).

// SPEC 001 - Question Bank
export * from './models/enums.js';
export * from './models/option.js';
export * from './models/source.js';
export * from './models/question.js';
export * from './validation/errors.js';
export * from './validation/normalizeOptionText.js';
export * from './validation/validateQuestion.js';
export * from './repository/questionRepository.js';
export * from './repository/inMemoryQuestionRepository.js';
export * from './service/questionService.js';
export * from './service/questionValidationError.js';

// SPEC 002 - Material Upload & Source Registry
export * from './models/material.js';
export * from './validation/materialErrors.js';
export * from './validation/validateMaterial.js';
export * from './repository/materialRepository.js';
export * from './repository/inMemoryMaterialRepository.js';
export * from './service/materialService.js';
export * from './service/materialValidationError.js';

// SPEC 003 - Topic Map
export * from './models/topic.js';
export * from './models/topicMaterialLink.js';
export * from './validation/topicErrors.js';
export * from './validation/validateTopic.js';
export * from './repository/topicRepository.js';
export * from './repository/inMemoryTopicRepository.js';
export * from './repository/topicMaterialLinkRepository.js';
export * from './repository/inMemoryTopicMaterialLinkRepository.js';
export * from './service/topicService.js';
export * from './service/topicValidationError.js';
export * from './service/topicCoverage.js';

// SPEC 004 - Question Generation Drafts
export * from './models/generationMetadata.js';
export * from './models/questionGenerationRun.js';
export * from './generation/generationErrors.js';
export * from './generation/generationTypes.js';
export * from './generation/validateGeneration.js';
export * from './generation/questionGenerationError.js';
export * from './generation/mockQuestionGenerationProvider.js';
export * from './repository/generationRunRepository.js';
export * from './repository/inMemoryGenerationRunRepository.js';
export * from './service/questionGenerationService.js';

// SPEC 005 - Question Validation & Quality Gate
export * from './models/questionValidationResult.js';
export * from './quality/qualityCodes.js';
export * from './quality/qualityChecks.js';
export * from './quality/questionValidationProvider.js';
export * from './repository/questionValidationReportRepository.js';
export * from './repository/inMemoryQuestionValidationReportRepository.js';
export * from './service/questionValidationService.js';

// SPEC 006 - Admin Review
export * from './models/questionReview.js';
export * from './review/reviewErrors.js';
export * from './review/questionReviewError.js';
export * from './review/reviewTransitions.js';
export * from './repository/questionReviewRepository.js';
export * from './repository/inMemoryQuestionReviewRepository.js';
export * from './service/questionReviewService.js';

// SPEC 007 - Test Generator
export * from './models/practiceTest.js';
export * from './models/practiceTestQuestion.js';
export * from './test/testErrors.js';
export * from './test/testGenerationError.js';
export * from './repository/testRepository.js';
export * from './repository/inMemoryTestRepository.js';
export * from './repository/testQuestionRepository.js';
export * from './repository/inMemoryTestQuestionRepository.js';
export * from './service/testGeneratorService.js';

// SPEC 008 - Test Taking & Results
export * from './models/testAttempt.js';
export * from './models/testAnswer.js';
export * from './attempt/attemptErrors.js';
export * from './attempt/testAttemptError.js';
export * from './repository/testAttemptRepository.js';
export * from './repository/inMemoryTestAttemptRepository.js';
export * from './repository/testAnswerRepository.js';
export * from './repository/inMemoryTestAnswerRepository.js';
export * from './service/testAttemptService.js';
