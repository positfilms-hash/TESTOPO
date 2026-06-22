# Claude Brief - SPEC 030 OCR & Vision Reading For Scanned PDFs

Implement only `docs/specs/030-ocr-vision-scanned-pdfs.md` on branch
`feature/ocr-vision-scanned-pdfs`.

Before writing code, read in this order:

1. `docs/constitution/CLAUDE.md`.
2. `docs/constitution/CODEX.md`.
3. `docs/specs/030-ocr-vision-scanned-pdfs.md`.
4. `docs/setup/migrations-runbook.md`.
5. Existing Material, PDF extraction, storage, Supabase repository, RLS, and
   InMemory tests.

This is an OCR fallback only. Reuse `PdfJsTextExtractor` for normal PDFs and
run OCR only after a deterministic scan/quality detector. Render and process
pages privately, save page-level text/confidence/warnings/errors, and aggregate
usable text back into the existing material record. Use an adapter and mock for
tests. A real vision/OCR call must run from a trusted server or Supabase Edge
Function boundary, never from Vite/React, and no private key or service role
may appear in frontend code.

There is already a `030_syllabus_index.sql`, so create the idempotent migration
as `supabase/migrations/032_ocr_vision_scanned_pdfs.sql`, then update the
migration runbook. Keep RLS scoped to manager access and maintain InMemory
fallback parity. Student must not see or query OCR status, pages, errors, image
references, or retry controls.

Do not implement document classification, a syllabus index, source sections,
question generation, tests, RAG, embeddings, or fine-tuning. OCR completion may
make text eligible for a later Temario analysis flow, but it must not invoke
that flow.

Add focused tests, architecture/user/QA documentation, execute relevant tests
and build, and report the results, migration/deployment steps, any limitation,
and every file changed. Preserve unrelated local modifications.
