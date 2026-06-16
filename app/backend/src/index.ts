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
