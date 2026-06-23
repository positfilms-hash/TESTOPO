# SPEC 035 - Staging AI Activation: Real OCR & Question Generation

## Planning Change

SPEC 035 is now the staging activation of real AI. The previously planned
"Supabase Session & Workspace Rehydration" work is deferred and reserved for
SPEC 036. No rehydration work belongs in this SPEC.

## Objective

Activate and verify real, server-side AI in the staging Supabase project for:

1. OCR of a genuinely scanned PDF with legible visible text; and
2. source-grounded question generation from existing approved concrete sources.

Staging must use a real provider or fail honestly. It must never present mock
OCR, mock questions, or simulated provider output as real.

## Preconditions And Stop Conditions

This work depends on SPEC 033 and SPEC 034 being deployed and passing their
security/traceability checks. Before activation, confirm:

- `generate-questions` validates concrete factual sources, including every
  `topic_source_reference`, against material status, classification, workspace,
  and opposition;
- `ocr-material` preserves prior OCR runs/pages when retrying rather than
  deleting audit history;
- the tests and frontend build are green; and
- the Edge Function renderer is ready for a real staging check.

If a precondition fails, document `BLOCKED` with the evidence. Do not configure
a mock as a substitute, invent results, or claim a partial implementation is
active.

## Scope

- Document exact staging secret names, safe limits, deployment, rollback, and
  smoke-test procedure.
- Configure server-side Supabase secrets only when an authorised operator has
  supplied the real secret values outside source control.
- Deploy the already-reviewed `ocr-material` and `generate-questions` Edge
  Functions to the explicitly identified staging project.
- Run a restricted QA flow in an isolated QA workspace/opposition using a small
  scanned PDF with visible text and approved source material.
- Verify server-only provider use, no-mock behaviour, stored traceability,
  statuses, Student isolation, and no frontend-secret exposure.
- Update setup, security, QA, and activation-result documentation without
  recording secret values, sensitive material text, signed URLs, or raw prompts.

## Explicitly Out Of Scope

- New UI/product flows, automatic validation, direct test creation, or changing
  test eligibility.
- Auth/session/workspace rehydration, broad RLS/schema changes, classification,
  syllabus-index algorithm/quality, embeddings, RAG, or fine-tuning.
- Altering the `compressed-text` mock index or treating it as real AI output.
- Placing keys in frontend/Vite, committed files, logs, screenshots, or docs.

## Server Secret Configuration

Use one real server-side provider for both flows where possible (OpenAI is the
MVP reference). Configure only Supabase Edge Function secrets, never browser
environment values:

```text
AI_PROVIDER=openai
OPENAI_API_KEY=<operator-supplied secret>
OPENAI_MODEL=<approved structured-output model>
OCR_PROVIDER=openai
OCR_MODEL=<approved vision model>
MAX_GENERATED_QUESTIONS=20
MAX_QUESTION_SOURCE_CHARS=20000
OCR_MAX_PAGES_PER_DOCUMENT=300
OCR_MAX_CONCURRENT_PAGES=3
OCR_PAGE_TIMEOUT_SECONDS=60
```

The exact model names and a staging cost cap must be approved by the operator.
Do not commit values, paste them in issue/PR text, output them in logs, or put
them in `VITE_*`. Activation commands and deployment target may be documented
with placeholders only. The person operating staging supplies secrets directly
to Supabase and confirms the target project; Claude/Codex must not guess,
generate, recover, or transmit keys.

## Deployment And Rollback

After preconditions and secret configuration are confirmed, deploy only:

```text
supabase functions deploy ocr-material
supabase functions deploy generate-questions
```

Verify the project ref is staging immediately before each deployment. Rollback
is operational rather than a frontend fallback: remove/unset `AI_PROVIDER` and
`OCR_PROVIDER` (and rotate/remove provider key if necessary), then redeploy as
needed. The functions must return their existing 501 honest errors, preserve
`scanned_detected` in the no-provider OCR case, and create no mock writes.

## Required Staging Smoke Flow

Use an isolated QA workspace/opposition and a small scanned PDF whose rendered
page visibly contains readable text. A blank/image-only placeholder fixture is
not enough to prove real OCR.

1. Login as owner/admin; record workspace/opposition identifiers privately in
   the QA log, not secret values.
2. Upload the scanned PDF and verify it becomes `scanned_detected`.
3. Request OCR through the UI. Confirm only IDs are sent by the browser.
4. Verify one new `material_ocr_run`; one `material_ocr_page` per processed
   page; real non-empty OCR text; confidence/warnings/errors; ordered aggregate
   `materials.content_text`; and an honest terminal state:
   `completed_ocr`, `completed_ocr_with_warnings`, or `ocr_failed`.
5. If OCR succeeds, use the existing Temario flow to create and explicitly
   apply a source-supported index. SPEC 035 does not change the index pipeline.
6. Select an active applied topic with eligible concrete sources and request
   question generation through the UI.
7. Verify a `question_generation_run`, questions, options, validation results,
   topic/material/section-or-reference/excerpt traceability, and states only
   `pending_review` or `needs_fix`. No generated question may be `validated`.
8. Confirm the existing human review is still required before a question can be
   used in a normal test.

Run negative checks first or in a separate isolated opposition:

- without provider secrets, OCR/generation return their safe 501 code and make
  no simulated writes;
- Student, revoked users, cross-workspace/opposition IDs, arbitrary source/OCR
  input, forbidden sources, and non-applied topics are rejected; and
- provider failure produces only honest failed states/runs, never mock text or
  questions.

## Security And No-Mock Checks

- Scan frontend source and production build for `OPENAI_API_KEY`, provider keys,
  `SUPABASE_SERVICE_ROLE_KEY`, and forbidden `VITE_*` private values.
- Confirm React invokes only authenticated `ocr-material` and
  `generate-questions`, never OpenAI/provider URLs directly.
- Confirm staging mode cannot select the InMemory mock provider.
- Do not log full prompt/source/OCR text, API keys, signed URLs, or internal
  storage paths. Record only run IDs, counts, terminal status, and safe errors.

## Documentation Deliverables

Create or update:

- `docs/setup/staging-ai-activation.md`
- `docs/qa/staging-ai-activation-smoke-test.md`
- `docs/security/ai-provider-secrets.md`
- `docs/security/ocr-provider-secrets.md`
- `docs/qa/staging-ai-activation-result.md` after a real retest.

The result document must distinguish `PASS`, `FAIL`, and `BLOCKED`; include
the deployed commit/function versions, safe QA scope, commands without secret
values, findings, and rollback status. It must never claim real OCR/generation
from unit tests, mock fixtures, or no-provider tests.

## Acceptance Criteria

- Staging secrets exist only at the server/Edge Function boundary.
- With no provider, both flows fail honestly with no simulated persistence.
- With a configured provider, a genuine scanned PDF produces per-page real OCR
  data and an honest terminal material state.
- Source-grounded generation reads only existing eligible server-side evidence,
  creates traceable candidates, and never validates automatically.
- Student cannot use or inspect either internal flow.
- No private key/mocks are present in frontend or represented as real staging
  results.
- Setup, smoke, security, cost/limit, rollback, and result documentation are
  complete and visual smoke is run at 1366x900 and 390x844.
