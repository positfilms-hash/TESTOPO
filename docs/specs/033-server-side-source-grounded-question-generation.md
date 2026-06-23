# SPEC 033 - Server-side Source-Grounded Question Generation

## Objective

Move real source-grounded question generation behind an authenticated Supabase
Edge Function. The browser may request generation, but it never supplies
factual source text, calls an AI provider, or holds a private provider or
service-role key.

The server validates the authenticated user and the complete scope of the
request, retrieves approved concrete sources from Supabase, calls a configured
provider, validates the structured result, and persists traceable candidates.
AI never creates a `validated` question.

## Scope

Implement one authenticated Edge Function:

```text
supabase/functions/generate-questions/index.ts
```

It must:

- accept only controlled identifiers and generation parameters;
- authenticate the bearer JWT and derive the acting user from it;
- validate workspace membership, role, opposition access, requested applied
  topic, and source ownership/eligibility before invoking an AI provider;
- retrieve primary factual evidence exclusively from existing Supabase records;
- call a real provider only with server-side secrets;
- validate provider output and persist only traceable candidates plus their
  options, validation result, and `question_generation_run`;
- return a safe summary to the frontend; and
- fail honestly without persisting mock questions when no real provider is
  configured.

The frontend changes are limited to invoking the authenticated function with
IDs/parameters, showing loading and safe human-readable errors, and linking to
the existing review queue.

## Explicitly Out Of Scope

- OCR or changes to `ocr-material`.
- Auth, session/workspace rehydration, or role-model changes.
- New persistence tables, migrations, large RLS changes, or a new source/
  question-generation pipeline.
- Fixing the `compressed-text` mock index.
- Embeddings, vector search/storage, advanced RAG, or fine-tuning.
- Automatic validation/publication, test generation, or student workflows.

## Existing Foundation To Reuse

Read and reuse the contracts introduced by SPEC 023, 025, 028-C, 028-D, 028-E,
028-F, 030, and 032. In particular, reuse the existing question, option,
validation, generation-run, Topic Map, `TopicSourceReference`,
`SourceReference`, `MaterialSection`, classification, authorization, and
Supabase patterns. Do not create a parallel question bank or duplicate the
source-grounded generation domain.

SPEC 028-E already defines the traceability columns in
`028_e_source_grounded_question_generation.sql`; this spec must use them.
Create a migration only if an implementation-discovered, genuinely missing
minimal field is required and document why. It must not alter Auth or broaden
RLS policy semantics.

## Request Contract

`POST` is the only supported method. With `verify_jwt` enabled, the function
also explicitly verifies the bearer token via `auth.getUser()`.

The request body may contain only:

```json
{
  "workspace_id": "uuid",
  "opposition_id": "uuid",
  "topic_id": "uuid",
  "difficulty": "easy | medium | hard",
  "question_count": 1,
  "source_mode": "topic_sources | manual_source_selection",
  "selected_source_reference_ids": ["uuid"],
  "selected_material_section_ids": ["uuid"]
}
```

`question_count` is an integer from 1 to 20. `manual_source_selection` is
optional and is only a selection among existing IDs; it cannot add evidence.
Reject unknown fields and reject any body containing `user_id`, `source_text`,
`raw_text`, `manual_context`, `custom_prompt`, prompt content, or equivalent
arbitrary factual input with `QUESTION_GENERATION_ARBITRARY_TEXT_FORBIDDEN`.

The frontend must call `supabase.functions.invoke('generate-questions', …)`
with the current authenticated session and must never construct questions,
source excerpts, or mock provider output locally.

## Authorization And Scope Validation

Before using a service-role client or calling the provider, the function must:

1. Derive the actor only from the verified JWT; never trust `user_id` from the
   body.
2. Confirm a non-deleted user has the existing management permission for the
   requested workspace and opposition: owner, admin, authorized manager, or
   permitted personal-workspace premium owner. Student and revoked users fail.
3. Confirm the opposition belongs to that workspace and the topic belongs to
   that opposition.
4. Confirm the topic is active and part of the applied Topic Map.
5. Resolve all requested/manual and discovered sources within the same
   workspace and opposition, then verify them again immediately before save.

Return stable safe codes, including:

```text
QUESTION_GENERATION_AUTH_REQUIRED
QUESTION_GENERATION_ACCESS_DENIED
QUESTION_GENERATION_WORKSPACE_REQUIRED
QUESTION_GENERATION_OPPOSITION_REQUIRED
QUESTION_GENERATION_TOPIC_REQUIRED
QUESTION_GENERATION_TOPIC_NOT_FOUND
QUESTION_GENERATION_TOPIC_NOT_APPLIED
QUESTION_GENERATION_NO_SOURCES
QUESTION_GENERATION_SOURCE_REQUIRED
QUESTION_GENERATION_SOURCE_FORBIDDEN
QUESTION_GENERATION_SOURCE_WORKSPACE_MISMATCH
QUESTION_GENERATION_SOURCE_OPPOSITION_MISMATCH
QUESTION_GENERATION_ARBITRARY_TEXT_FORBIDDEN
QUESTION_GENERATION_PROVIDER_NOT_CONFIGURED
QUESTION_GENERATION_PROVIDER_FAILED
QUESTION_GENERATION_INVALID_OUTPUT
QUESTION_GENERATION_NO_VALID_CANDIDATES
QUESTION_GENERATION_SAVE_FAILED
```

Do not return prompts, provider errors, complete excerpts, internal storage
paths, or secrets to the client.

## Source Retrieval And Eligibility

The Edge Function retrieves evidence from Supabase, never from the request.
Use this order for `topic_sources`:

1. `topic_source_references` for the active applied topic;
2. their linked `source_references` and `material_sections`;
3. eligible material sections associated with the topic; then
4. existing basic title matching over eligible sections, if that existing
   capability is available.

The factual primary evidence must be active, approved, same-workspace,
same-opposition material effectively classified as `syllabus_material`,
`legal_text`, `notes_or_summary`, or `index_or_table_of_contents`.

Never use `irrelevant`, `not_analyzable`, uncorrected `ambiguous`, `obsolete`,
`needs_review`, `failed`, or `ocr_failed` material. `old_exam_or_test` and
existing pattern/feedback data may supply bounded style/difficulty context only;
they cannot be the only evidence and must not be copied into questions.

Use at most 20 concrete references and 20,000 source characters, prioritising
approved/high-confidence primary evidence. Record trimming as a non-sensitive
warning. If there is no eligible primary evidence, fail with no candidate
question persisted.

## Provider And Secret Boundary

Read `AI_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL`, and optional limits only
from Supabase Edge Function secrets. No model or key is hardcoded. The service
role key, if needed for controlled server persistence, is also server-only and
may be used only after the preceding JWT/authorization checks.

No `VITE_*` variable, frontend source, fixture, log, screenshot, or committed
`.env` may contain an AI provider key or `SUPABASE_SERVICE_ROLE_KEY`.

If the real provider is absent or unsupported, return HTTP 501 with
`QUESTION_GENERATION_PROVIDER_NOT_CONFIGURED` and the safe message:

> La generación de preguntas todavía no está configurada en servidor.

Do not create a run, candidate, simulated text, or mock question in Supabase
mode, staging, or production. A mock provider is permitted only in isolated
unit tests or an explicitly controlled in-memory development mode; its
configuration must be impossible in Supabase staging/production mode.

## Server Prompt And Output Contract

Create `prompts/server-side-source-grounded-question-generator.md`. It must
instruct the provider to use only server-supplied excerpts; never external
knowledge, invented claims, copied old-test questions, or `validated` status.
It requires structured output per candidate:

```json
{
  "statement": "string",
  "options": [{ "text": "string", "is_correct": true }],
  "explanation": "string",
  "difficulty": "easy | medium | hard",
  "topic_id": "uuid",
  "material_id": "uuid",
  "material_section_id": "uuid or null",
  "source_reference_id": "uuid or null",
  "source_excerpt": "string",
  "warnings": []
}
```

Validate every response before persistence: statement/explanation/excerpt,
two or more distinct options, exactly one correct answer, valid difficulty,
matching topic, existing material, and at least one validated concrete pointer
(`source_reference_id`, `material_section_id`, or an equivalent approved topic
source reference). The excerpt must belong to the retrieved evidence. Reject a
provider-supplied `validated` status and any foreign/forbidden reference.

## Persistence And Status

Create and update the existing `question_generation_runs` record with the
actor, scope, provider/model metadata, requested/generated count, strategy,
concrete source IDs, safe warnings/errors, and status. Statuses are `pending`,
`processing`, `completed`, `completed_with_warnings`, or `failed`.

For each valid result, persist the existing question, options, and automatic
validation result with `generated_by_ai = true`, `generation_run_id`, topic,
material, source excerpt, and concrete source linkage. Run automatic validation
after saving.

The only candidate statuses are:

- `pending_review` when structurally valid and automatic validation has no
  critical finding;
- `needs_fix` when source-backed but warnings/non-critical repair work remain.

Candidates without valid evidence are never saved. No code path in this spec
may persist an AI-generated question as `validated`.

## Frontend And Student Isolation

The current manager UI retains only controlled topic/source selections,
difficulty, and count. It shows a loading state, the safe no-provider/no-source
messages above, and a safe generation summary with a link to the existing
review queue. It does not reveal raw provider errors, complete internal
excerpts, run internals, or secret configuration.

Student, deleted users, users without workspace/opposition access, and revoked
members cannot invoke the function, list generation runs, inspect pending/
needs-fix candidates, or access internal source excerpts. Student tests remain
restricted to existing `validated` questions and retain their current answer
reveal policy.

## Tests And Documentation

Add focused Edge Function/unit tests using no network provider. Cover:

- absent/invalid JWT, Student, deleted/revoked user, workspace/opposition
  crossing, foreign/non-applied topic;
- unknown/arbitrary request fields, invalid difficulty/count, and manual IDs
  outside the resolved scope;
- allowed retrieval and all forbidden classifications/statuses;
- missing provider/no provider failure with no run/candidate/mock persistence;
- provider failure and malformed output with no false candidates;
- output source/pointer/excerpt validation and the hard non-`validated` rule;
- run, question, option, and validation-result traceability;
- frontend uses the authenticated function and contains no provider/service-role
  secret or arbitrary source body; and
- existing test generation remains `validated`-only, while OCR/Auth/RLS
  contracts and InMemory fallback remain unchanged.

Create or update:

- `docs/architecture/server-side-question-generation.md`
- `docs/security/ai-provider-secrets.md`
- `docs/qa/server-side-question-generation-test-plan.md`
- `prompts/server-side-source-grounded-question-generator.md`

Run focused tests, relevant backend/frontend suites, frontend build, and the
visual smoke runbook at 1366x900 and 390x844. Do not claim a staging provider
integration works without configured server secrets and a real staging retest.

## Acceptance Criteria

- An authenticated, authorised manager can request generation only for an
  active applied topic with approved concrete same-scope evidence.
- The browser sends only IDs and bounded parameters; arbitrary source/prompt
  text is rejected.
- Provider credentials and any service role stay server-only.
- Missing provider is an honest no-write failure in staging/production.
- Persisted candidates are source-traceable and only `pending_review` or
  `needs_fix`, never `validated`.
- Student cannot generate or inspect generation internals/non-validated
  candidates.
- Existing Supabase/RLS and InMemory paths still pass their relevant tests, with
  no OCR/Auth/RLS redesign or advanced retrieval work introduced.
