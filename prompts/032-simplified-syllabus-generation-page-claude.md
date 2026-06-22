# Claude Brief - SPEC 032 Simplified Syllabus Generation Page

Implement only `docs/specs/032-simplified-syllabus-generation-page.md` on
`feature/simplified-syllabus-generation-page`.

Before code, read in this order:

1. `docs/constitution/CODEX.md`.
2. `docs/constitution/CLAUDE.md`.
3. `docs/specs/032-simplified-syllabus-generation-page.md`.
4. The current TopicPage, Material UI, syllabus-index/classification services,
   platform facade, and their tests.
5. `docs/qa/codex-visual-review-runbook.md`.

Make Temario a clean entry point: when an opposition has no applied syllabus,
show a sparse page and one large `Generar temario` action. It must compose the
existing document-classification, material-section/source-reference, and
syllabus-index proposal flows for all eligible material in the current
opposition. Native extracted text and usable OCR text are eligible; failed,
unsupported, unreadable, and obsolete material are not. OCR warnings remain
warnings, not silent approval.

The result is a source-supported proposal tree for human review. Never create
full syllabus prose, questions, tests, or validated content. Never apply the
proposal automatically or silently remove an applied Topic Map. Student must
not initiate or see internal runs, classifications, proposals, sources,
warnings, or raw errors.

Reuse existing services/repositories/RLS and InMemory behavior. Only add one
narrow facade/orchestration method if composition is genuinely missing; do not
create tables, migrations, repositories, new AI algorithms, or a parallel
pipeline. Do not change Material upload/open/delete/OCR behavior.

Add focused tests and requested docs, run relevant tests and production build,
then perform `1366x900` and `390x844` visual smoke checks. Report the existing
orchestration reused, changed files, test/build outcomes, screenshots, and any
limitation.
