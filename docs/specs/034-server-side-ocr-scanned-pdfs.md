# SPEC 034 - Server-side OCR for Scanned PDFs

## Objective

Move real OCR for scanned PDFs to the trusted server boundary. An authenticated
Supabase Edge Function obtains the private material itself, validates the actor
and scope, renders the PDF page by page server-side, calls a configured
OCR/vision provider using server-only secrets, and persists genuine page
results.

The browser never calls the provider, sends arbitrary images/text, holds a
private key, or simulates OCR. Without a configured real provider, staging and
production fail honestly and make no simulated OCR write.

## Scope

Replace the current `ocr-material` scaffold request contract with one
authenticated server-owned operation:

```text
supabase/functions/ocr-material/index.ts
```

It must:

- accept only a material scope and controlled retry option;
- authenticate the bearer JWT and derive the actor from it;
- validate workspace, opposition, material, role, and material eligibility
  before reading the private object or using privileged access;
- fetch the original PDF through private Storage server-side;
- render and process pages server-side in ascending order;
- persist the existing `material_ocr_runs` and `material_ocr_pages` entities,
  confidence, warnings, and errors only from genuine processing;
- aggregate valid page text into `materials.content_text` and update existing
  OCR/extraction metadata honestly;
- allow an authorised retry through the same boundary; and
- return only a safe summary for the current manager UI.

The frontend change is limited to invoking the authenticated Edge Function,
showing the existing material status and safe error, refreshing the material
list, and exposing retry only for eligible terminal states.

## Explicitly Out Of Scope

- Document classification, classification inventory, or source references.
- Syllabus/index generation, question generation, tests, or review workflows.
- Auth, workspace/session rehydration, or role model changes.
- Broad RLS/schema redesign (SPEC 030 already provides the OCR schema).
- Improving `compressed-text` mock index quality.
- Embeddings, RAG, vector search/storage, or fine-tuning.

## Existing Foundation To Reuse

Read and reuse SPEC 030's material extraction states, `MaterialOcrService`,
OCR run/page models and repositories, private storage/material guards, the
existing Material UI, Supabase factory, InMemory fallback, and Edge Function
patterns. Rework the current `supabase/functions/ocr-material` scaffold rather
than adding a parallel endpoint.

The existing `032_ocr_vision_scanned_pdfs.sql` already provides material OCR
columns, runs, pages, and RLS. This SPEC should not add a migration unless a
minimal missing field is demonstrated; do not use a migration to change Auth or
broaden RLS policies.

## Request Contract

Only `POST` is supported. The body may contain only:

```json
{
  "workspace_id": "uuid",
  "opposition_id": "uuid",
  "material_id": "uuid",
  "mode": "auto",
  "force_retry": false
}
```

`force_retry` is optional. Reject unknown fields and reject any request that
contains `user_id`, `image_base64`, `image_url`, `ocr_text`, `fake_text`,
`raw_text`, `provider_prompt`, `api_key`, or equivalent arbitrary OCR
input/secret. Return `OCR_ARBITRARY_INPUT_FORBIDDEN` for prohibited content.

The frontend calls `supabase.functions.invoke('ocr-material', …)` with the
current authenticated session. It does not upload renderings or write OCR text
to a material record.

## Authentication, Authorization, And Material Guard

`verify_jwt` remains enabled. The function must explicitly obtain the actor
from `auth.getUser()` using the bearer token; never trust a body user ID.
Before accessing the storage object, calling a provider, or creating an OCR
run, validate that:

1. the actor is authenticated and not deleted;
2. the actor has the existing owner/admin/authorised-manager (or applicable
   personal premium owner) management permission in the workspace;
3. the actor has access to the opposition, and the opposition belongs to the
   requested workspace;
4. the material belongs to that exact workspace and opposition;
5. it is a non-obsolete PDF in an OCR-eligible state; and
6. retry is limited to `scanned_detected`, `ocr_failed`, or
   `completed_ocr_with_warnings`.

Student, revoked membership/access, deleted users, foreign workspace/
opposition/material requests, non-PDF material, and obsolete material must be
rejected. Use stable safe codes, including:

```text
OCR_AUTH_REQUIRED
OCR_ACCESS_DENIED
OCR_WORKSPACE_REQUIRED
OCR_OPPOSITION_REQUIRED
OCR_MATERIAL_REQUIRED
OCR_MATERIAL_NOT_FOUND
OCR_MATERIAL_NOT_PDF
OCR_MATERIAL_OBSOLETE
OCR_ARBITRARY_INPUT_FORBIDDEN
OCR_PROVIDER_NOT_CONFIGURED
OCR_PROVIDER_FAILED
OCR_RENDER_FAILED
OCR_PAGE_RENDER_FAILED
OCR_PAGE_FAILED
OCR_PAGE_LIMIT_EXCEEDED
OCR_NO_TEXT_EXTRACTED
OCR_LOW_CONFIDENCE
OCR_SAVE_FAILED
OCR_RETRY_FAILED
OCR_STORAGE_FAILED
```

If a service-role client is required for controlled private storage/database
writes, it is server-only and may be created only after the above JWT and
authorization checks.

## Secret And Provider Boundary

Read `OCR_PROVIDER`, `OCR_MODEL`, provider credentials (for example
`OPENAI_API_KEY`), and bounded limits only from Supabase Edge Function secrets.
No key/model is hardcoded. No secret may appear in `VITE_*`, browser code,
fixtures, logs, screenshots, or committed environment files.

If no compatible real provider is configured, return HTTP 501 with
`OCR_PROVIDER_NOT_CONFIGURED` and show:

> OCR no disponible todavía: proveedor OCR no configurado en servidor.

In this no-provider case, preserve the detected material state (normally
`scanned_detected`), and create no OCR run/page, `content_text`, simulated
confidence, or fake error result. This preserves the verified staging
no-provider behaviour. Mocks are allowed only in isolated unit tests or an
explicit in-memory local-development path; they must be impossible in Supabase
staging/production mode.

## Server-side Page Processing

The Edge Function fetches the original private PDF from Storage. It does not
accept browser-rendered page data and does not return temporary image bytes,
internal paths, or signed object URLs.

Use a Deno-compatible server-side renderer. The implementation must verify it
runs in Supabase Edge Functions. If such rendering cannot initialise or fails,
fail closed with `OCR_RENDER_FAILED`/`OCR_PAGE_RENDER_FAILED`; never fall back
to browser rendering or invented text. Temporary page images are bounded,
private, and deleted after processing unless audited retention is explicitly
required by a later spec.

Process pages in ascending `page_number`, with at most three concurrent pages,
a 60-second per-page timeout, maximum 300 pages, and maximum 10 MB temporary
image per page. Each processed page creates/updates exactly one scoped
`material_ocr_pages` record with real text, confidence where the provider
returns it, status, warnings, and safe errors. Preserve ordering when joining
text. Do not represent skipped/failed pages as completed pages.

For this MVP, scanned/insufficient native text is the only supported entry
condition. Mixed-PDF selective OCR is deferred; if later supported it must use
the existing `mixed` extraction method and never overwrite good native text.

## Runs, Results, And Honest States

After all guards and provider configuration checks pass, create a new
`material_ocr_runs` row and move the material to `ocr_processing`. A retry
always creates a new run; it does not reuse or mingle pages from an earlier
run.

Persist run status (`pending`, `processing`, `completed`,
`completed_with_warnings`, `failed`, or `cancelled`), provider/model metadata,
page/processed/failed counts, average confidence, warnings, errors, and
timestamps. Logs are limited to IDs, counts, status, and error codes; never
full OCR text, prompts, API keys, or internal paths.

Use confidence bands from SPEC 030:

- `>= 0.70`: usable;
- `0.40 - 0.69`: usable with warning; and
- `< 0.40`: failed/needs review unless a documented provider-specific reason
  permits a warning.

Terminal material state is determined only by stored real page outcomes:

- usable ordered text with no material warning -> `completed_ocr`,
  `extraction_method = ocr`;
- usable text with low confidence or partial warnings ->
  `completed_ocr_with_warnings` and material `needs_review`;
- no usable OCR text or fatal processing failure -> `ocr_failed` and material
  `needs_review`.

Only successful/usable page text is concatenated into `materials.content_text`.
A failed run never overwrites good native text. Do not mark `completed_ocr` or
write fake pages/text/confidence when no OCR was actually performed.

## Frontend And Student Isolation

Managers retain a compact Material UI: existing open/upload/delete actions,
one status badge (`Escaneo detectado`, `Leyendo escaneo`, `Leído con OCR`,
`OCR con advertencias`, `No se pudo leer`, or `OCR no configurado`), safe error
copy, and `Reintentar OCR` only where permitted. The material list must refresh
after a completed or failed request.

Student cannot invoke the function, retry OCR, inspect runs/pages/confidence/
errors, see internal image/storage references, or access OCR controls. Do not
add classification, index, or question controls to Material.

## Tests And Documentation

Add focused no-network tests for:

- missing/invalid JWT; Student, deleted/revoked user; workspace/opposition/
  material crossing; non-PDF and obsolete material;
- prohibited/arbitrary request fields and invalid retry state;
- absent provider -> HTTP 501 with no run, page, text, or simulated state;
- renderer/provider failure -> safe failed run/material state with no invented
  text; and explicit proof mocks cannot run in Supabase staging/production;
- page order, real text persistence, confidence aggregation/bands, warnings,
  partial/fatal failures, page/document limits, timeouts, and temporary-image
  cleanup;
- retry creates an isolated new run; and
- frontend authenticated invocation, honest error/status refresh, no secrets,
  and Student isolation.

Run the existing material, OCR, Supabase/InMemory authorization, and frontend
tests; ensure upload, ZIP upload, signed PDF open, and Material UI remain
intact. Confirm no classification/index/question generation path is called.

Create or update:

- `docs/architecture/server-side-ocr.md`
- `docs/security/ocr-provider-secrets.md`
- `docs/qa/server-side-ocr-test-plan.md`

Run focused tests, relevant suites, frontend build, and the Codex visual smoke
runbook at 1366x900 and 390x844. A real-provider staging claim requires
deployed server secrets and a separate real staging retest; do not infer it
from mock/unit tests.

## Acceptance Criteria

- OCR is triggered only through authenticated `ocr-material`; the client sends
  IDs/options, never OCR content or images.
- The server validates actor/workspace/opposition/material before access or
  processing and fetches only the private scoped PDF.
- OCR is rendered and persisted per page, with genuine text, confidence,
  warnings, errors, ordered aggregation, runs, and honest terminal material
  states.
- Missing provider fails honestly with no simulated persistence in staging/
  production.
- Secrets remain server-only; Student cannot generate, retry, or inspect OCR
  internals.
- No classification, index, question, Auth, large-RLS, embeddings, RAG, or
  fine-tuning work is introduced.
