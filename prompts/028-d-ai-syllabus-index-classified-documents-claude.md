# Claude Implementation Brief - SPEC 028-D

Implement `docs/specs/028-d-ai-syllabus-index-classified-documents.md` on
`feature/ai-syllabus-index-classified-documents`.

First read and follow `docs/setup/migrations-runbook.md`. Do not invent a
parallel Supabase workflow.

Start from the existing SPEC 019 implementation. Reuse/adapt its
`SyllabusIndexRun`, `SyllabusIndexProposal`, `SyllabusIndexNodeProposal`,
service, providers, repositories, factory wiring, and review panel. Connect it
to the `DocumentClassification`, `MaterialSection`, and `SourceReference`
layers delivered by SPEC 028-B and SPEC 028-C. Do not introduce duplicate
models or duplicate tables when an existing one can be extended.

Implement source-grounded index proposals only:

- Primary sources: `syllabus_material`, `legal_text`, `notes_or_summary`, and
  `index_or_table_of_contents`, with active extracted material and sections.
- Secondary context only: `old_exam_or_test`, for coverage/frequency/style.
- Exclude `irrelevant`, `not_analyzable`, obsolete, and uncorrected `ambiguous`
  material.
- Every proposed topic needs a concrete primary source; subtopics need a
  primary source or a clearly inherited parent source.
- Persist node-to-source links and Topic Map source references with workspace
  and opposition scope.

Create/update the actual provider prompt at
`prompts/syllabus-index-from-classified-documents.md`. Require structured
topic/subtopic output with sources, confidence, and warnings. The provider may
organize document evidence only; it must not write syllabus content, invent
topics, generate questions/options, or generate tests.

Preserve the explicit human lifecycle: draft -> pending_review ->
approved/rejected -> applied. Only approved proposals apply to the Topic Map.
Application must reuse or warn on existing matching topics and never delete or
silently overwrite topics.

Add the minimum UI for privileged review: hierarchy, sources, confidence,
warnings, title/order editing, accept/reject node, approve/reject proposal,
and apply only after approval. Student must not see runs, proposals, node
sources, warnings, or review UI.

Use the migration runbook for
`028_d_ai_syllabus_index_from_classified_documents.sql`, adapting existing
SPEC 019 schema rather than duplicating it. Update Supabase repositories and
the InMemory fallback. Enforce RLS and application guards for workspace and
opposition isolation. Never add `SUPABASE_SERVICE_ROLE_KEY` to frontend code
or Vite environment files.

Add focused tests for source selection, corrected classifications, old-exam
secondary-only use, validation failures, human lifecycle, application without
topic duplication, student isolation, Supabase/InMemory coverage, and mock
providers without external calls. Update architecture, user-guide, and QA test
plan docs. Run the relevant backend and frontend tests before reporting.

Out of scope: OCR, RAG, embeddings, vector storage, fine-tuning, written
syllabus generation, question generation, test generation, attempts, answers,
or any automatic student publication.
