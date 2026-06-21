# Claude Implementation Brief - SPEC 029

Implement `docs/specs/029-navigation-visual-simplification.md`.

Frontend only: preserve the modified
`app/backend/src/service/aiErrorMemoryService.ts` and untracked `.claude/`.
Do not change backend, Supabase migrations, RLS, permissions, or business rules.

Set a navy application background and keep cards, forms, modals, empty states,
and working surfaces white. Preserve contrast, Georgia headings, compact UI,
and pastel-blue actions. Do not add gradients or decorative effects.

Remove `Resumen` from the admin sidebar. Admin defaults to `Material` after
entering an opposition, changing workspace/opposition, or switching from
Student. Keep Student `Inicio` unchanged.

Clicking an active navigation item or a CTA that targets the current section
must reset it to its root view and refetch normal data without browser reload or
loss of session/workspace/opposition/zone. Use a navigation revision/key or
equivalent explicit reset mechanism, not identical state assignment. This applies
to navigation only: Upload, Generate, Approve, Save, Delete, and Submit must not
repeat mutations on repeated clicks.

Add focused frontend tests for active-section reset, admin default Material, and
Student Inicio. Run frontend tests and production build. Check desktop and
mobile for contrast, overflow, and overlap before reporting.
