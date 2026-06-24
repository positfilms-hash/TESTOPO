# Claude Prompt - SPEC 037 Fix Syllabus Index & Question Generation Flow

Read first, in full:

1. `docs/constitution/CODEX.md`
2. `docs/constitution/CLAUDE.md`
3. `docs/specs/037-fix-syllabus-index-question-generation-flow.md`
4. SPEC 028-C, 028-D, 028-E, 030, 032, 033, 034, 035, and 036
5. Current Temario/Questions code, source-readiness code, relevant tests, and
   `docs/qa/codex-visual-review-runbook.md`.

Implement SPEC 037 on branch `fix/syllabus-index-question-generation-flow`.
Preserve unrelated working-tree files.

First diagnose this staging observation with safe evidence; do not guess:

```text
Questions UI: "2 fuentes disponibles"
generate-questions: "Este tema no tiene fuentes elegibles"
```

Trace the selected applied Topic, `topic_source_references`, linked source
references/sections, material classification/status, request scope, and Edge
Function response. Document the exact root cause. Do not relax the server
source guard just to make the UI pass.

Then implement the minimum coherent repair:

- compact semantic index, never article/page/micro-heading transcription;
- target 5-15 root topics, hard cap 20, normally depth 1-2;
- source articles remain internal evidence, not default topic titles;
- one whole-index review and one explicit apply action, no mandatory per-topic
  approval;
- apply creates/reuses active scoped Topics and concrete source links;
- visible source readiness uses the same authoritative eligible-source rule as
  `generate-questions`;
- call only the existing authenticated Edge Function with IDs/parameters;
- candidates remain `pending_review` or `needs_fix`, never `validated`;
- safe Spanish errors explain no-source, unapplied, provider, access, and save
  failures without leaking internals.

Hard constraints:

- No provider key in frontend, no browser provider call, no arbitrary source
  text, no mocked staging/production output.
- Do not implement OCR, embeddings/RAG, fine-tuning, payments, metrics,
  gamification, large Auth/RLS changes, or a parallel question pipeline.
- Preserve workspace/opposition boundaries, Student isolation, private material,
  existing RLS, and InMemory fallback.

Add the focused tests and documents required by SPEC 037. Run relevant
backend/frontend suites, frontend build, `git diff --check`, and desktop/mobile
visual smoke. Report the root cause, changed files, commands/results, visual
evidence, and any real staging blocker. Do not claim real provider success
without a real staging retest.
