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

// SPEC 010 - Oppositions, Users & Access
export * from './models/user.js';
export * from './models/opposition.js';
export * from './models/oppositionAccess.js';
export * from './access/accessErrors.js';
export * from './access/accessError.js';
export * from './access/oppositionGuards.js';
export * from './access/permissions.js';
export * from './auth/password.js';
export * from './repository/userRepository.js';
export * from './repository/inMemoryUserRepository.js';
export * from './repository/oppositionRepository.js';
export * from './repository/inMemoryOppositionRepository.js';
export * from './repository/oppositionAccessRepository.js';
export * from './repository/inMemoryOppositionAccessRepository.js';
export * from './service/userService.js';
export * from './service/oppositionService.js';

// SPEC 011 - Workspaces & Account Plans
export * from './models/workspace.js';
export * from './models/workspaceMember.js';
export * from './repository/workspaceRepository.js';
export * from './repository/inMemoryWorkspaceRepository.js';
export * from './repository/workspaceMemberRepository.js';
export * from './repository/inMemoryWorkspaceMemberRepository.js';
export * from './service/workspaceService.js';
export * from './service/platformService.js';

// SPEC 012 - PDF Material Upload & Basic Text Extraction
export * from './pdf/pdfErrors.js';
export * from './pdf/pdfTextExtractor.js';
export * from './storage/fileStorage.js';
export * from './service/pdfMaterialService.js';

// SPEC 017 - Unified Syllabus & Bulk Material Import
export * from './models/materialImportBatch.js';
export * from './models/materialImportItem.js';
export * from './import/importErrors.js';
export * from './import/zipReader.js';
export * from './repository/materialImportRepository.js';
export * from './repository/inMemoryMaterialImportRepository.js';
export * from './service/materialImportService.js';

// SPEC 028 - Smart Bulk Upload: Materials & Old Exams
export * from './models/uploadCategory.js';
export * from './import/smartUploadErrors.js';

// SPEC 028-B - Document Classification & Import Inventory
export * from './models/documentClassification.js';
export * from './classification/documentClassificationErrors.js';
export * from './classification/documentClassificationConfig.js';
export * from './classification/documentClassificationTypes.js';
export * from './classification/heuristicDocumentClassifier.js';
export * from './classification/openAiDocumentClassifier.js';
export * from './classification/createDocumentClassificationProvider.js';
export * from './repository/documentClassificationRepository.js';
export * from './repository/inMemoryDocumentClassificationRepository.js';
export * from './repository/supabase/supabaseDocumentClassificationRepositories.js';
export * from './service/documentClassificationService.js';

// SPEC 028-C - Material Sections & Source References
export * from './models/materialSection.js';
export * from './models/sourceReference.js';
export * from './sections/sectionErrors.js';
export * from './sections/segmentConfig.js';
export * from './sections/segmentText.js';
export * from './repository/materialSectionRepository.js';
export * from './repository/sourceReferenceRepository.js';
export * from './repository/inMemorySectionsRepositories.js';
export * from './repository/supabase/supabaseSectionsRepositories.js';
export * from './service/materialSectionService.js';
export * from './service/sourceReferenceService.js';

// SPEC 018.4 - AI Question Generation & Review Feedback Loop
export * from './models/questionReviewFeedback.js';
export * from './repository/questionReviewFeedbackRepository.js';
export * from './repository/inMemoryQuestionReviewFeedbackRepository.js';
export * from './generation/generationConfig.js';
export * from './generation/aiProviderErrors.js';
export * from './generation/aiGenerationShared.js';
export * from './generation/anthropicQuestionGenerationProvider.js';
export * from './generation/openAiQuestionGenerationProvider.js';
export * from './generation/createQuestionGenerationProvider.js';
export * from './service/questionFeedbackService.js';

// SPEC 020 - Supabase Repositories: Profiles & Workspaces
export * from './repository/supabase/supabaseClientPort.js';
export * from './repository/supabase/inMemorySupabasePort.js';
export * from './repository/supabase/supabaseRepositoryErrors.js';
export * from './repository/supabase/supabaseProfileRepository.js';
export * from './repository/supabase/supabaseWorkspaceRepository.js';
export * from './repository/supabase/supabaseWorkspaceMemberRepository.js';
// SPEC 021 - Supabase Repositories: Oppositions & Access
export * from './repository/supabase/supabaseOppositionRepository.js';
export * from './repository/supabase/supabaseOppositionAccessRepository.js';
// SPEC 022 - Supabase Repositories: Materials & Topics
export * from './repository/supabase/supabaseMaterialRepository.js';
export * from './repository/supabase/supabaseTopicRepository.js';
export * from './repository/supabase/supabaseTopicMaterialLinkRepository.js';
export * from './repository/supabase/supabaseMaterialImportRepositories.js';
// SPEC 023 - Supabase Repositories: Questions & Options
export * from './repository/supabase/supabaseQuestionRepository.js';
export * from './repository/supabase/supabaseQuestionBankRepositories.js';
// SPEC 024 - Supabase Repositories: Tests, Attempts & Answers
export * from './repository/supabase/supabaseTestRepositories.js';
export * from './repository/supabase/createCoreRepositories.js';

// SPEC 019 - AI Syllabus Index Builder
export * from './models/syllabusIndex.js';
export * from './syllabus/syllabusIndexErrors.js';
export * from './generation/syllabusIndexConfig.js';
export * from './generation/syllabusIndexTypes.js';
export * from './generation/mockSyllabusIndexProvider.js';
export * from './generation/openAiSyllabusIndexProvider.js';
export * from './generation/createSyllabusIndexProvider.js';
export * from './repository/syllabusIndexRepository.js';
export * from './repository/inMemorySyllabusIndexRepository.js';
export * from './service/syllabusIndexService.js';

// SPEC 028-D - AI Syllabus Index From Classified Documents
export * from './generation/documentGroundedIndexTypes.js';
export * from './generation/documentGroundedIndexConfig.js';
export * from './generation/mockDocumentGroundedIndexProvider.js';
export * from './generation/openAiDocumentGroundedIndexProvider.js';
export * from './generation/createDocumentGroundedIndexProvider.js';
export * from './service/syllabusIndexFromDocumentsService.js';
