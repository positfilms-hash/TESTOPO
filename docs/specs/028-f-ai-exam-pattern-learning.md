# SPEC 028-F - AI Exam Pattern Learning & Adaptive Question Generation

## Objective

Improve existing source-grounded generation with reviewable learning from old
exam patterns and structured human feedback. Questions should better match the
opposition's format, difficulty, style, and coverage while approved material
remains their sole factual source.

This is adaptive prompt context, not fine-tuning, model training, OCR, RAG,
embeddings, or vector storage. Candidates never start as `validated`.

## Branch And Foundation

Use `feature/ai-exam-pattern-learning` and follow
`docs/setup/migrations-runbook.md`.

Reuse `ExamPatternSummary`, document classification, material sections, source
references, applied topic sources, `SourceGroundedQuestionGenerationService`,
`QuestionReviewFeedback`, `QuestionFeedbackService`, validation, review, and
generation runs. Do not build a parallel generator or feedback database.

Extraction quality is a prerequisite: failed, scanned, garbled, irrelevant,
obsolete, or uncorrected ambiguous documents cannot enter analysis or generation.

## Rules

- Primary opposition material is the sole factual source.
- Old exams are aggregate style, difficulty, option-format, and coverage context.
- Every candidate retains the concrete source pointers/excerpt required by 028-E.
- Old-exam questions/options cannot be copied or near-copied.
- Automatic checks result only in `pending_review` or `needs_fix`.
- Only human review may make a question `validated`.
- Student cannot access patterns, profiles, feedback memory, quality details,
  pending candidates, or internal excerpts.

## Pattern Analysis And Profiles

Create `ExamPatternAnalysisService` or adapt the existing pattern path. For
usable `old_exam_or_test` documents derive only aggregates: option counts,
difficulty, statement length/structure, wording/distractor patterns, recurring
approved-topic coverage, legal versus conceptual frequency, confidence, and
warnings. Store structural data and fingerprints for anti-copy checks, never a
copyable question bank or verbatim old-exam prompt content.

Reuse or extend `ExamPatternSummary`. Add a versioned `QuestionStyleProfile`
only when needed; it is scoped to workspace/opposition and holds selected
summaries, aggregate rules, distributions, coverage, confidence, warnings, and
audit fields. Lifecycle: `draft`, `pending_review`, `active`, `rejected`, and
`superseded`. Human activation is mandatory and only one profile is active per
opposition.

Persist an `ExamPatternAnalysisRun` when existing runs cannot represent the
operation. It records workspace, opposition, creator, status, provider/model,
input material/section ids, old-exam count, analyzed-question count, warnings,
errors, and timestamps. Supported statuses are `pending`, `processing`,
`completed`, `completed_with_warnings`, and `failed`.

Create `TopicExamPattern` where sufficient data exists. It scopes frequency and
difficulty scores, common question types/traps, style notes, and coverage notes
to one topic and style profile. Lack of old exams is a warning, not a failure.

## Feedback And Adaptive Generation

`QuestionReviewFeedback` remains the source of truth. Extend its taxonomy only
for real gaps: `style_mismatch`, `difficulty_mismatch`, `coverage_mismatch`,
`source_mismatch`, `copying_risk`, or `legal_precision`.

Extend `QuestionFeedbackService` or add an aggregate adapter. It must produce
bounded, non-factual rules by workspace, opposition, topic, material, and
profile version. Record profile/pattern/feedback use in generation runs.
Feedback improves instructions but never replaces concrete factual evidence.

Expose this aggregate through `AIErrorMemoryService` or an equivalent service.
It must derive auditable error-memory entries from feedback/review/validation
outcomes, including type, severity, summary, and an `avoid_instruction`, then
summarize the most common errors and style/legal-precision rules by opposition,
topic, and material. Feedback from rejections, `needs_fix`, and edits before
approval must be eligible inputs.

Extend `SourceGroundedQuestionGenerationService`, not a new generator. Provider
context must separate: primary material evidence, aggregate profile/pattern
rules, and aggregate feedback rules. Only primary evidence supports facts.

Create `prompts/adaptive-source-grounded-question-generator.md`; it must forbid
external knowledge, copying, unsupported facts, questions without sources, and
`validated` status.

## Anti-Copy And Quality Gates

Compare normalized candidate statements/options against old-exam fingerprints
before persistence. High matches are rejected or saved as `needs_fix` with an
auditable `copying_risk`; never silently `pending_review`.

Compute transparent quality scores/warnings from source completeness, output
validation, factual fit, profile fit, recurring feedback risks, and copy risk.
Scores never approve or validate a candidate.

When no equivalent metadata exists, persist an `AIQuestionQualityScore` per
candidate with values in `[0, 1]`: source grounding, exam-style similarity,
clarity, single-answer confidence, difficulty fit, overall score, warnings, and
timestamps. A configurable low score may set `needs_fix` or add a warning; a
high score never sets `validated`.

## Persistence, Security, UI

Add only missing schema via idempotent
`028_f_ai_exam_pattern_learning.sql`: style profiles, pattern-analysis runs,
generation-run profile metadata, or quality metadata where needed. Do not
duplicate existing exam-summary or feedback tables.

Expected tables or equivalent existing storage are
`exam_pattern_analysis_runs`, `exam_pattern_profiles`, `topic_exam_patterns`,
`ai_error_memories`, and `ai_question_quality_scores`. Index workspace,
opposition, topic, material, question, run, status, and creator fields. Apply
the same manager-only RLS pattern as other internal AI records.

Wire Supabase and InMemory via the factory. Enforce workspace/opposition RLS and
guards for owner/admin/authorized manager and supported personal premium owner.
Student has no internal access. Never expose `SUPABASE_SERVICE_ROLE_KEY` to
frontend or Vite variables.

Add privileged profile/pattern review and activation UI, visibility of the
context to be used for generation, and quality warnings in question review. Do
not expose old exams as a copyable bank.

The admin area should include an "IA de la oposicion" surface with exam-style
analysis, error memory, and adaptive generation. Generation defaults to using
the active style profile and error memory, with explicit Yes/No controls. Review
shows factual source, style applied, quality score/warnings, and feedback the
generator attempted to address.

## Tests And Acceptance

Test eligible pattern inputs, aggregate-only analysis, profile lifecycle,
primary-source requirement despite a profile, feedback/run metadata, anti-copy,
no automatic validation, Student isolation, validated-only student tests,
Supabase/InMemory behavior, and mock providers without network calls.

Also cover usual option-count detection, negative/"except"/legal-reference
patterns, topic frequency, no-old-exam warnings, memory refresh after new human
feedback, low-score behavior, and a future mock generation that avoids the
recorded error. Add error contracts for missing old tests, invalid analysis
output, absent profile, memory failure, missing factual source, old-test factual
use, possible copy, ignored critical feedback, and quality-score failure.

Update `docs/architecture/ai-exam-pattern-learning.md`,
`docs/user-guides/ai-question-generation.md`,
`docs/qa/ai-exam-pattern-learning-test-plan.md`, and the adaptive prompt. The work is done
when an authorized reviewer activates an aggregate profile, later generation
uses it plus feedback memory without copying old exams or bypassing review.

## Instructions For Claude

Use the runbook and existing factory/repositories. Keep material evidence,
old-exam patterns, and feedback rules separate in services and prompts. Do not
add fine-tuning, training jobs, copied questions, automatic validation, or
direct student tests.
