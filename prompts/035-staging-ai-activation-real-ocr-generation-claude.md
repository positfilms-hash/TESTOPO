# Claude implementation prompt - SPEC 035

Read before acting:

1. `docs/constitution/CODEX.md`
2. `docs/constitution/CLAUDE.md`
3. `docs/specs/033-server-side-source-grounded-question-generation.md`
4. `docs/specs/034-server-side-ocr-scanned-pdfs.md`
5. `docs/specs/035-staging-ai-activation-real-ocr-generation.md`
6. current 033/034 code, tests, and provider-secret documentation.

SPEC 035 activates real AI only in the explicitly identified staging project.
It is an integration/QA/security task, not a new product or architecture spec.

Before any staging action, verify and fix/document blockers from 033/034:
- every `topic_source_reference` must be resolved and validated as eligible
  primary same-scope factual material before it reaches the question provider;
- OCR retries must retain previous runs/pages as audit history; and
- the text-PDF reextraction test must be stable under its normal timeout.

Never create, request, paste, commit, log, or expose provider/service-role
keys. Do not configure secrets or deploy until an authorised operator supplies
the secret values directly to Supabase and confirms the staging project ref.
Use server/Edge Function secrets only; do not add `VITE_*` private variables.

When authorised activation occurs, deploy only `ocr-material` and
`generate-questions`, set bounded server-side limits, and run the documented
isolated-QA smoke flow. The scan must visibly contain readable text; a blank
scan fixture proves only detection, not real OCR. If MuPDF fails in Edge
Functions, fail closed and document `BLOCKED`/`FAIL`; never fallback to the
browser or simulate OCR.

Confirm no mock output in staging, real per-page OCR persistence, real
source-grounded candidate traceability, and only `pending_review`/`needs_fix`.
Student isolation, no-provider 501/no-write behaviour, and no frontend secret
exposure remain mandatory. Do not modify Auth, broad RLS, rehydration (now
SPEC 036), index/mock quality, embeddings, RAG, or fine-tuning.

Deliver documentation, tests, build results, visual smoke at desktop/mobile,
and a staging result report with PASS/FAIL/BLOCKED. Include no secret values or
sensitive source/OCR text. Do not claim activation passed without a real
provider retest.
