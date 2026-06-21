# Claude Implementation Brief - SPEC 028-E

Implement `docs/specs/028-e-source-grounded-question-generation.md` on
`feature/source-grounded-question-generation`.

Read and follow `docs/setup/migrations-runbook.md` first. Do not introduce a
parallel Supabase migration or repository pattern.

This is an evolution of the existing question generator, not a replacement.
Reuse `QuestionGenerationService`, its providers and mock provider,
`QuestionGenerationRun`, `QuestionValidationService`, feedback service, admin
review, question repositories, and factory wiring. Reuse the document
classification of 028-B, section/reference models of 028-C, and the applied
`TopicSourceReference` data from 028-D.

Implement source-grounded generation from an applied, accessible Topic Map
topic. Add `SourceRetrievalService` or an equivalent focused component and a
clearly separated source-grounded entry point. Retrieve primary evidence in
this order: topic-source references, linked source references/sections,
eligible material sections, then basic text matching. Enforce workspace and
opposition isolation everywhere.

Primary evidence is limited to active, usable `syllabus_material`, `legal_text`,
`notes_or_summary`, and `index_or_table_of_contents`. Reject irrelevant,
not-analyzable, obsolete, needs-review, and uncorrected ambiguous documents.
Old exams and `ExamPatternSummary` may only contribute style, difficulty,
coverage, and frequency context; they must never be the only factual source or
be copied into a candidate.

No source means no candidate: return a clear source-required/no-sources error
and persist nothing. Bound the AI input to source excerpts/sections and do not
add RAG, embeddings, vector storage, OCR, or fine-tuning.

Create/update `prompts/source-grounded-question-generator.md`. The provider
must return structured candidates with statement, options, one correct answer,
brief explanation, difficulty, topic id, material id, source excerpt, and
available section/reference IDs. It must use only supplied sources and must
never return or imply `validated`.

Persist source linkage on questions and source strategy/ids on generation runs
only when fields are missing, using the runbook migration
`028_e_source_grounded_question_generation.sql`. Reuse equivalent fields;
never duplicate schema. Validate all output before saving: source exists and
is local to workspace/opposition, classifications are allowed, exactly one
correct option, valid difficulty, source excerpt, and no validated status.

Run the existing automatic validator after creation. Candidates end only in
`pending_review` or `needs_fix`; human review alone can validate. Keep tests
for students limited to validated questions.

Provide the minimal privileged UI to select an applied topic, inspect available
sources, select difficulty/count, optionally choose sources manually, generate,
and reach the review queue. Student cannot generate, read generation runs,
see pending/needs-fix questions, or see internal source excerpts. Preserve
Supabase RLS, application guards, InMemory fallback, and keep
`SUPABASE_SERVICE_ROLE_KEY` entirely out of frontend code and Vite env.

Add focused tests for source selection/exclusion, mandatory source linkage,
old-exam secondary-only behavior, output validation, no AI validation,
automatic quality state, admin review, student isolation, validated-only test
selection, Supabase/InMemory behavior, and mock-provider/no-network tests.
Update architecture, user guide, QA plan, and run relevant test suites.
