# Claude implementation prompt - SPEC 034

Before changing code, read in full:

1. `docs/constitution/CODEX.md`
2. `docs/constitution/CLAUDE.md`
3. `docs/specs/034-server-side-ocr-scanned-pdfs.md`
4. `docs/setup/migrations-runbook.md`
5. the existing SPEC 030 Material/OCR models, repositories, service tests,
   Material UI, private Storage code, and `supabase/functions/ocr-material`.

Implement SPEC 034 with one server-owned, authenticated `ocr-material` Edge
Function. Replace its old browser-image request contract: the frontend sends
only workspace/opposition/material IDs plus controlled retry options via
`supabase.functions.invoke`; it never sends images, OCR text, raw text,
provider prompts, API keys, or a user ID.

Validate the JWT actor, management permission, workspace/opposition relation,
and scoped non-obsolete PDF before reading Storage, calling a provider, or
creating a run. Fetch the PDF privately on the server, render it with a
Deno-compatible server-side renderer, process pages in order, and persist only
real page text/confidence/warnings/errors. If server-side rendering is not
available, fail closed - never move rendering to the browser or synthesize
text.

All provider and service-role secrets are Edge Function secrets only. In
Supabase staging/production, a missing real provider must return the honest 501
error and write no OCR run/page/text/mock state; preserve the detected state.
Mocks are only for isolated tests or explicit InMemory local development.

Reuse the existing OCR tables/services and status vocabulary. A successful
run updates ordered `content_text` and `completed_ocr`; warnings/low confidence
produce `completed_ocr_with_warnings`; fatal/no-text outcomes produce
`ocr_failed`. Retries create isolated new runs. Never overwrite good native
text after a failure.

Do not implement classification, index/question/test generation, Auth/session
changes, a broad RLS/schema redesign, embeddings/RAG/fine-tuning, or changes to
the compressed-text mock index. Preserve unrelated changes.

Add required focused no-network tests and documentation. Run focused and
relevant suites, frontend build, and desktop/mobile smoke checks. Report exact
changed files; request/response contract; server secret/deployment steps;
commands/results; and any unresolved real-provider/staging limitation. Do not
claim real OCR works until server secrets are deployed and staging is retested.
