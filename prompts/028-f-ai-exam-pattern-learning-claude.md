# Claude Implementation Brief - SPEC 028-F

Implement `docs/specs/028-f-ai-exam-pattern-learning.md` on
`feature/ai-exam-pattern-learning`, following
`docs/setup/migrations-runbook.md`.

Preserve current user changes, including grounded-excerpt validation work and
untracked `.claude/`. Reuse existing exam summaries, source-grounded generation,
structured review feedback, validation, review, and repository factory; do not
create parallel systems.

Analyze only usable `old_exam_or_test` documents. Produce an
`ExamPatternAnalysisRun`, aggregate style/difficulty/option-format/coverage
signals, optional `TopicExamPattern`s, and anti-copy fingerprints. Detect common
option counts, negatives/except forms, wording, traps, legal precision, and
topic frequency. Do not persist or place verbatim old-exam questions/options in
a generation prompt. Exclude garbled, failed, scanned, forbidden, obsolete, or
ambiguous documents; no old tests is a warning, not a failure.

Create a human-activated, versioned `QuestionStyleProfile` only if needed. Add
separate context blocks to `SourceGroundedQuestionGenerationService`: primary
factual evidence, aggregate pattern/profile rules, and aggregate feedback rules.
Only the first supports facts.

Create `prompts/adaptive-source-grounded-question-generator.md`. Forbid external
knowledge, copying, questions without concrete sources, and `validated` status.
Add deterministic anti-copy checks; reject risky candidates or set `needs_fix`
with `copying_risk`. Add auditable quality scores, never auto-approval.

Reuse persisted review feedback, review outcomes, validation results, rejected
questions, needs-fix questions, and edits before approval as scoped error memory.
Create `AIErrorMemoryService` or an equivalent adapter that produces auditable
summaries and avoid-instructions. Record profile/pattern/feedback use in runs.
Persist per-candidate `[0,1]` quality components and overall score if no
equivalent storage exists; low score may mean warning or `needs_fix`, never
approval. Add only minimal schema in
`028_f_ai_exam_pattern_learning.sql`; wire Supabase/InMemory, RLS, and guards.
Students cannot access internal learning data. Never expose service-role
credentials in frontend code or Vite env.

Add focused tests, privileged review/activation UI, review quality warnings, and
architecture/user-guide/QA docs. Do not implement fine-tuning, training, OCR,
RAG, embeddings, vector storage, copied questions, automatic validation, or
direct student tests.
