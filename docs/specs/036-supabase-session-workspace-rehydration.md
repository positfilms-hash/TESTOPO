# SPEC 036 - Supabase Session & Workspace Rehydration

## Objective

Make app startup deterministic after a reload or return with a valid Supabase
session. The app must restore, in order, the authenticated user, profile,
accessible workspace, applicable role/access, and selected opposition before
loading a context-dependent page.

Local selection is a convenience only. Supabase-authorised data remains the
authority. Material, Temario, Preguntas, and Tests must not render false empty
states while this context is unresolved.

## Scope

Adapt the existing frontend store/bootstrap and gate components to:

1. resolve Supabase session, including no-session, expired, and logout cases;
2. load the current public profile and handle missing/deleted/blocked profiles
   clearly without creating a duplicate profile;
3. list accessible workspaces through existing services/repositories;
4. restore a valid persisted `last_workspace_id`, auto-select the only valid
   workspace, or show the existing/new focused workspace selector;
5. load oppositions only for the selected authorised workspace;
6. restore a valid persisted `last_opposition_id`, auto-select the only valid
   opposition, or show a clear opposition selector/no-opposition state;
7. clear invalid local selections and navigation context on logout, revoked
   access, deleted/blocked profile, workspace change, or opposition change;
8. keep loading/error states explicit until the context state machine reaches a
   safe ready state; and
9. preserve equivalent InMemory/demo behaviour.

The expected narrow change surface is `StoreContext`, existing auth bootstrap
helpers, `App`, `WorkspacesGate`, `OppositionsGate`, and focused tests/styles.
Reuse `WorkspaceService.listForUser`, `OppositionService.listForUser`/
`listStudyOppositions`, existing role/access checks, and current gate patterns.

## Explicitly Out Of Scope

- Replacing Supabase Auth, changing auth provider, or changing the profile
  trigger/account lifecycle.
- RLS, permission, membership, opposition-access, or role-model changes.
- OCR, question generation, syllabus/index generation, AI provider/secrets, or
  Edge Function changes.
- New product capabilities, routes, persistence tables, embeddings, RAG, or
  fine-tuning.

## Rehydration State Machine

Model startup explicitly; do not represent a loading state as `null` user or an
empty workspace/opposition list.

```text
booting
  -> signed_out
  -> loading_profile
  -> loading_workspaces
  -> selecting_workspace
  -> loading_oppositions
  -> selecting_opposition
  -> resolving_access
  -> ready
  -> error
```

The app may render Login only after `signed_out`. It may render Material,
Temario, Preguntas, or Tests only after `ready` with a valid user, workspace,
opposition, and resolved effective zone/access. During intermediate states show
short, human-readable progress such as `Cargando sesión…`, `Preparando tu
espacio…`, or `Cargando oposición…`.

## Persisted Selection Rules

Use namespaced localStorage keys, for example:

```text
testopo:last_workspace_id:<user_id>
testopo:last_opposition_id:<user_id>
```

Never store tokens, roles as authority, profile data, or any secret.

- A persisted workspace is restored only if it appears in the authorised
  workspace list for the current session. Otherwise remove it.
- A persisted opposition is restored only if it belongs to the chosen workspace
  and is visible to the actor under the existing service/RLS rules. Otherwise
  remove it.
- Selecting a workspace clears the active opposition and any stale zone as the
  current store already expects. Selecting an opposition persists only its ID.
- Logout clears current context and this user's persisted selection hints.
- Do not automatically choose the first item when several valid workspaces or
  oppositions exist and there is no valid prior selection; show a selector.

## Roles, Zone, And Navigation

Recompute workspace role and study access after restoring a workspace, using
the existing services. The restored zone is never authoritative: it must be
compatible with current access.

- Student cannot restore or navigate to admin Material/Temario/Preguntas/AI/
  Alumnos pages.
- Revoked/deleted/blocked users do not restore a workspace or opposition.
- A route/section request needing context is held at a gate/loading state until
  it is valid; it must not issue a broad unscoped repository query.
- If no workspace exists, show `No tienes ningún workspace disponible.`
- If no opposition exists in an authorised workspace, show `Todavía no hay
  oposiciones en este workspace.` and use only existing authorised actions.

## Data-Isolation Invariants

- Never use an old workspace/opposition ID merely because localStorage contains
  it.
- Never show data from another workspace/opposition during a transition.
- Clear or remount context-sensitive pages on a validated workspace/opposition
  switch.
- Existing RLS remains a backstop; this SPEC adds no service-role client and no
  client-side bypass.

## Required Tests

Add focused tests covering:

- initial boot/loading does not render Login or false empty states prematurely;
- no/expired session -> Login; valid session -> profile -> authorised
  workspaces;
- missing/deleted/blocked profile and logout clear context safely;
- one workspace/opposition auto-selection; multiple choices with and without a
  valid stored selection; invalid stored values are removed;
- opposition belongs to restored workspace and cross-workspace IDs are rejected;
- owner/admin and student zone restoration; Student cannot restore admin
  navigation; revoked membership/opposition access fails safely;
- Material, Temario, Preguntas, and Tests stay gated until ready and receive the
  correct opposition after hydration; and
- InMemory/demo starts with its existing deterministic user/workspace/opposition
  behaviour and current tests remain green.

Run frontend tests/build and the Codex visual runbook at 1366x900 and 390x844,
including reload with a valid session, invalid stored selection, no workspace,
no opposition, Student, and manager paths.

## Documentation

Create or update:

- `docs/architecture/session-workspace-rehydration.md`
- `docs/qa/session-workspace-rehydration-test-plan.md`

Document the state machine, localStorage keys as non-authoritative hints,
invalid-selection cleanup, authorised selection rules, and manual staging
retest steps. Do not include session tokens or real user data.

## Acceptance Criteria

- Reloading with a valid session restores profile plus only an authorised
  workspace/opposition context.
- Invalid/revoked/stale local values are removed and never queried as trusted
  scope.
- Multiple choices use a clear selector; zero choices use a clear state.
- No false empty Material/Temario/Preguntas/Tests page appears while hydration
  is pending.
- Student cannot restore admin context or data; no workspace/opposition data
  crosses scope.
- Auth architecture, RLS, permissions, OCR, question generation, provider
  configuration, and Edge Functions are unchanged.
- InMemory fallback, focused tests, build, and visual smoke stay green.
