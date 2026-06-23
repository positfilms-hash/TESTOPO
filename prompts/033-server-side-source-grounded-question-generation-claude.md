# Claude implementation prompt - SPEC 033

Before changing code, read in full:

1. `docs/constitution/CODEX.md`
2. `docs/constitution/CLAUDE.md`
3. `docs/specs/033-server-side-source-grounded-question-generation.md`
4. `docs/setup/migrations-runbook.md`
5. the existing source-grounded generation, Supabase repository/factory,
   authorization, Question UI, and `supabase/functions/delete-account` and
   `supabase/functions/ocr-material` patterns.

Implement SPEC 033 exactly and keep the change surface narrow. Use a single
authenticated `generate-questions` Supabase Edge Function. The frontend may
send only controlled IDs and bounded parameters through
`supabase.functions.invoke`; it must not send source text, raw text, a custom
prompt, a user ID, or any arbitrary factual context.

The Edge Function must validate the verified JWT actor, workspace membership,
role, opposition access, workspace/opposition relationship, active applied
topic, and every recovered source before calling a provider and again before
saving. Retrieve primary evidence only from existing Supabase topic/source/
section/material records in the requested scope. Tests antiguos/pattern data
may influence style only, never factual content.

All provider and service-role secrets remain in Edge Function secrets. Do not
put private keys in frontend code, `VITE_*`, fixtures, logs, screenshots, or
committed environment files. If no real provider is configured, staging,
production, and Supabase mode must return the documented honest error and
persist no run, question, text, or mock result. Any mock is limited to isolated
tests or explicit InMemory local development.

Persist only source-traceable questions with existing option/validation/run
entities. Generated candidates must always be `pending_review` or `needs_fix`;
they must never be `validated`. Student must not be able to invoke generation
or inspect runs, excerpts, or non-validated candidates.

Do not implement OCR, modify Auth/session rehydration, introduce a broad RLS
rewrite, alter the compressed-text mock index, add embeddings/RAG/fine-tuning,
or create tests/direct student flows. Reuse existing contracts rather than
creating a parallel pipeline. Preserve unrelated local changes.

Add the documentation and focused tests required by the spec. Run the focused
tests, relevant backend/frontend suites, frontend build, and desktop/mobile
smoke checks. Report: changed files; Edge Function request/response contract;
server secret configuration/deployment steps; exact test/build/smoke commands
and results; and any deferred real-provider/staging verification. Do not claim
a real provider works until it is deployed with server secrets and retested.
