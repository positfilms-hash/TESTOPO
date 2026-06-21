# SPEC 029 - Navigation & Visual Simplification

## Objective

Simplify TESTOPO and make navigation reliable:

- Navy-blue application background.
- White cards, forms, and working surfaces.
- Re-entering an active navigation section refreshes that section.
- Remove the Administration `Resumen` tab.

This is frontend UX only. Do not change business rules, Supabase schema, RLS,
permissions, AI behavior, or persisted data.

## Visual Foundation

Use a stable accessible navy background such as `#071a33` for the app shell and
main page background. Cards, form controls, modals, empty states, and framed
tools remain white with dark readable text.

Keep the restrained pastel-blue action accent and zone distinction. Text placed
directly on navy must meet contrast requirements. Preserve Georgia headings and
the current compact operational style. Do not introduce gradients, decorative
effects, or a new design system.

Review desktop and mobile: no overflow, overlap, or contrast regression.

## Navigation Refresh

Main navigation and section-changing CTAs must work as navigation even if their
target is already selected.

Clicking the active section must:

1. Return it to its root view: Material list rather than material detail;
   Questions list rather than generation/review form; equivalent behavior for
   other sectional views.
2. Re-run its normal initial data loading.
3. Keep current workspace, opposition, user, and zone.
4. Avoid a full browser reload.

Use a navigation revision/key or equivalent explicit page-reset contract.
`setSection(currentSection)` is insufficient because it does not reset React
state.

This applies only to navigation controls and navigation CTAs. It must not repeat
mutating commands such as Upload, Generate, Approve, Save, Delete, or Submit.

## Remove Administration Summary

Remove `Resumen` from `ADMIN_NAV`; `Material` becomes the first admin
destination. After an admin enters an opposition, changes workspace/opposition,
or switches from Student to Administration, the selected section is `material`.

Keep the Student `Inicio` dashboard. The old admin Home/Resumen must not be
reachable from admin navigation or admin CTAs. Remove dead admin-only routing
only when it is genuinely unused; preserve shared/student Home behavior.

## Expected Changes

- `app/frontend/src/App.tsx`
- `app/frontend/src/components/AppLayout.tsx`
- `app/frontend/src/styles.css`
- Focused frontend tests for navigation reset/default destination and Student
  preservation.

Avoid unrelated refactors and backend changes.

## Acceptance Criteria

- App background is navy; cards and tools are white.
- Admin sidebar has no `Resumen` and defaults to `Material`.
- Student keeps `Inicio`.
- Clicking an active section resets/refetches it without full reload or context
  loss.
- A CTA targeting the current section has the same reset behavior.
- Action buttons do not repeat mutations merely because they are clicked again.
- Desktop/mobile screenshots have no overflow, overlap, or contrast failure.
- Frontend tests and production build pass.

## Instructions For Claude

Implement only this frontend spec. Preserve current user changes. Do not modify
backend, Supabase, RLS, permissions, or workflows. Add concise tests for active
section reset, admin default Material, and Student Inicio. Run frontend tests,
production build, and desktop/mobile visual checks before reporting.
