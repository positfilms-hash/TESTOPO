# SPEC 030 - OCR & Vision Reading For Scanned PDFs

## Objective

Add a reliable OCR/vision path for scanned PDF material. When the existing
PDF.js text extraction is empty, too short, or fails its quality gate, the app
detects a likely scan, reads its pages with a server-side OCR/vision provider,
and makes the resulting text available to later document-understanding flows.

This spec only covers detection, page rendering, OCR persistence, status, and
manager review. It does not classify documents or generate downstream content.

## Scope

- Detect likely scanned PDFs after the normal `PdfJsTextExtractor` attempt.
- Render PDF pages to private temporary images at a bounded resolution.
- Run OCR/vision page by page through a provider adapter that is invoked only
  from a trusted server or Supabase Edge Function.
- Persist OCR runs, pages, text, confidence, warnings, and errors.
- Aggregate successful OCR text into `materials.content_text` and expose a
  concise operational state in the Material library for managers.
- Allow an authorized manager to retry a detected, warning, or failed OCR run
  and open the original private PDF.
- Keep the Supabase and InMemory implementations behaviorally compatible.

## Explicitly Out Of Scope

- Document classification or inventory changes.
- Material sections, source references, syllabus-index creation, questions,
  tests, answers, or review workflow changes.
- RAG, embeddings, fine-tuning, and automatic content validation.
- Public file URLs, browser-held private provider keys, or service-role keys in
  Vite/frontend code.

## Existing Contracts To Reuse

- Keep `PdfJsTextExtractor` as the normal text-PDF path; OCR is a fallback,
  never a replacement for good native text.
- Reuse `FileStorage`, private Supabase Storage, `MaterialLibraryService`, and
  the manager/Student authorization patterns already used for Material.
- Follow `docs/setup/migrations-runbook.md`. The number `030` is already used
  by `supabase/migrations/030_syllabus_index.sql`; name this additive migration
  `032_ocr_vision_scanned_pdfs.sql` and record it in the runbook table.
- Preserve the existing `materials`, repositories, services, and tests rather
  than creating a parallel material-ingestion path.

## States And Data

Extend the material extraction model without destroying existing values:

- Existing successful native extraction remains `completed` with
  `extraction_method = text`.
- A poor or absent native extraction becomes `scanned_detected`.
- OCR processing uses `ocr_processing`.
- A clean OCR result is `completed_ocr` with `extraction_method = ocr`.
- A usable partial/low-confidence result is `completed_ocr_with_warnings` and
  leaves the material visibly reviewable.
- A failed/no-text result is `ocr_failed` and retains a clear error summary.
- A mixed document may use `extraction_method = mixed`; OCR only blank or
  unusable pages when page-level extraction is available. A full-document OCR
  fallback is acceptable when that distinction is not available yet.

Add nullable material metadata required for operations: `extraction_method`,
`ocr_status`, `ocr_confidence`, `ocr_page_count`, `ocr_processed_pages`,
`ocr_failed_pages`, and `ocr_warning_count`. Do not reinterpret a material as
classified merely because OCR succeeded.

Create two scoped, RLS-protected entities:

1. `material_ocr_runs`: id, workspace_id, opposition_id, material_id,
   created_by, provider/model metadata, status, page/processed/failed counts,
   average_confidence, warnings, errors, timestamps.
2. `material_ocr_pages`: id, workspace_id, opposition_id, material_id,
   ocr_run_id, page_number, private temporary image reference if needed, text,
   confidence, status, warnings, errors, timestamps.

Text is assembled in ascending page order into `materials.content_text`. Do not
store OCR image bytes in Git, a public bucket, or a browser cache. Delete
temporary private render images after completion/retry cleanup unless retaining
them is strictly required for an audited internal review.

## Processing And Quality Rules

`PdfScanDetectionService` must evaluate normal extraction with deterministic,
documented thresholds (for example, text amount per page and total text,
garbled-character ratio, and PDF.js extraction errors). It must not trigger OCR
for material whose native text passes the quality gate.

Use a page-bounded `PdfPageRenderService` and an `OcrProvider` abstraction. A
provider result contains text, confidence when available, and warnings. Include
a no-network mock provider for tests. Any real provider credentials are server
or Edge Function secrets only. The frontend requests an authenticated OCR job;
it never receives a private provider key, service-role key, internal storage
path, or rendered image URL.

Set explicit limits and document them: maximum 300 pages, maximum 10 MB image,
at most 3 concurrent pages, and a per-page timeout. Use confidence bands:

- `>= 0.70`: usable.
- `0.40 - 0.69`: usable with warning and manager review.
- `< 0.40`: failed/needs review unless a documented provider-specific reason
  justifies retaining it as a warning.

Persist partial results and page errors. A full failure must not overwrite good
native text. OCR text with warnings may feed the normal later classification
entry point, but this spec must not invoke classification itself.

## Security And Permissions

- Enable RLS for both new tables. Scope every policy by workspace and
  opposition, using existing manager helpers/patterns.
- Owner, admin, and existing permitted managers can start/retry/read OCR status
  only for material they manage. Student has no SELECT, INSERT, UPDATE, or
  DELETE access to OCR runs, pages, confidence, errors, images, or controls.
- Opening the original PDF keeps the current private signed-URL/object-URL
  contract. Never reveal `storage_path`.
- Supabase mode must work under RLS; InMemory must enforce the same guards.
- `SUPABASE_SERVICE_ROLE_KEY`, OCR provider keys, and temporary file references
  never appear in frontend source, `VITE_*`, logs, fixtures, or screenshots.

## UI

Keep the Material library simple. Managers see one status badge per file:
`Texto extraido`, `Escaneo detectado`, `Leyendo escaneo`, `Leido con OCR`,
`OCR con advertencias`, or `No se pudo leer`. The existing `Abrir` action stays
available. Show `Reintentar OCR` only for scanned, warning, or failed states.

Do not add classification controls to Material and do not expose OCR internals
to Student. A compact manager-only detail/status view may show page count,
confidence summary, warning count, and actionable error text. It must not turn
the Material page into a new inventory or an index builder.

## Implementation Shape

- Models and repository interfaces for OCR runs/pages, with Supabase and
  InMemory implementations.
- `PdfScanDetectionService`, `PdfPageRenderService`, `OcrService`, and
  `MaterialOcrService`, wired through the existing platform/facade boundary.
- A trusted OCR execution adapter (Edge Function or existing server endpoint)
  for real providers; no privileged OCR calls from React/Vite.
- Idempotent `032_ocr_vision_scanned_pdfs.sql`: additive columns, tables,
  indexes, `updated_at` triggers, RLS, and policies. Update the migration
  runbook and persistence/architecture documentation.

Use clear errors such as `OCR_ACCESS_DENIED`, `OCR_MATERIAL_NOT_FOUND`,
`OCR_MATERIAL_NOT_PDF`, `OCR_SCAN_NOT_DETECTED`, `OCR_RENDER_FAILED`,
`OCR_PAGE_LIMIT_EXCEEDED`, `OCR_PROVIDER_NOT_CONFIGURED`,
`OCR_PAGE_FAILED`, `OCR_NO_TEXT_EXTRACTED`, and `OCR_RETRY_FAILED`.

## Acceptance Criteria

- A real text PDF retains native extraction and does not call OCR.
- A scanned fixture moves from `not_supported`/poor extraction to
  `scanned_detected`, then to a page-based OCR outcome.
- Successful OCR stores ordered page text, references, confidence, and the
  material aggregate; warning and partial failure remain understandable.
- OCR failure does not silently produce garbled content or erase good text.
- Manager can view status, open the original, and retry where appropriate.
- Student cannot access OCR UI, runs, pages, errors, or internal files.
- No document classification, syllabus index, question, test, or validation
  behavior is invoked or changed by this implementation.
- Supabase RLS and InMemory fallback enforce equivalent access outcomes.
- Unit tests cover detection, page ordering, confidence bands, partial/fatal
  failure, retry, authorization, and no-OCR native-text path. Repository and
  migration tests cover scoped persistence/RLS. Existing material, section,
  classification, question, and Student tests remain green.
- Add `docs/architecture/ocr-scanned-pdfs.md`, update the Material user guide,
  and add `docs/qa/ocr-scanned-pdfs-test-plan.md` with successful scan,
  low-confidence, failure, retry, and Student-isolation checks.

## Instructions For Claude

Read `docs/constitution/CLAUDE.md`, `docs/constitution/CODEX.md`, this spec,
`docs/setup/migrations-runbook.md`, and the existing Material/PDF tests before
implementing. Follow existing repository, storage, RLS, and fallback patterns.
Keep OCR entirely separate from classification and generation. Do not add a
real provider key to frontend code or make real-network calls in tests. Preserve
all existing local changes, run focused tests plus the relevant backend suite
and build, then report limitations and the exact migration/deployment steps.
