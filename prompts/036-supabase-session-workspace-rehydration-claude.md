# Claude implementation prompt - SPEC 036

Read in full before editing:

1. `docs/constitution/CODEX.md`
2. `docs/constitution/CLAUDE.md`
3. `docs/specs/036-supabase-session-workspace-rehydration.md`
4. existing `StoreContext`, `App`, Auth helpers, workspace/opposition gates,
   corresponding frontend tests, and the existing workspace/opposition services.

Implement SPEC 036 narrowly. Reuse the current Supabase Auth session and
workspace/opposition service/repository patterns; do not replace Auth or create
a second context system.

Build an explicit rehydration state machine: session -> profile -> authorised
workspaces -> valid workspace selection -> authorised oppositions -> valid
opposition selection -> resolved role/zone -> ready. Gate Material, Temario,
Preguntas, and Tests until ready so a pending request never appears as a false
empty state.

Persist only user-namespaced workspace/opposition ID hints. Treat them as
untrusted: validate them against current authorised Supabase results, clear
invalid/revoked values, and never query/use an old scope before validation.
Do not auto-pick a first item if multiple valid choices have no stored valid
selection; show a clear selector. Preserve existing deterministic InMemory
fallback behaviour.

Student must not restore an admin zone or page. Do not change RLS, permissions,
OCR, question generation, AI/provider code, Edge Functions, schema, or
rehydrate by service role. Preserve unrelated changes.

Add focused tests and documentation, run frontend tests/build and desktop/mobile
visual smoke. Report state transitions, changed files, test/build results, and
manual staging reload checks. Do not include tokens or user data in logs/docs.
