# SPEC 029 - Navigation & Visual Simplification

## Objective

Simplify TESTOPO and make navigation reliable:

- Very light-blue application background.
- Medium-navy cards, list rows, and panels.
- Re-entering an active navigation section refreshes that section.
- Remove the Administration `Resumen` tab.

This is frontend UX only. Do not change business rules, Supabase schema, RLS,
permissions, AI behavior, or persisted data.

## Visual Foundation

Use a very light-blue page background such as `#eaf4ff`. Cards, list rows,
panels, and framed working surfaces use an accessible medium navy such as
`#163f66`, visibly lighter than the former dark navy. Text on navy surfaces is
white or near-white; form inputs remain white with dark text.

Keep the restrained pastel-blue action accent and zone distinction. Text placed
directly on navy must meet contrast requirements. Give headings a clearly more
elegant hierarchy using the available local serif stack (`Georgia`, `ui-serif`,
`Times New Roman`): larger/heavier page titles, compact panel headings, and
neutral sans-serif body/UI text. Do not add remote font loading, gradients,
decorative effects, or a new design system.

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

## Material Library And Analysis Flow

Material becomes a simple file library, inspired by the clarity of a drive
browser rather than its visual complexity.

### Material

- Remove the subtitle "Tus materiales, leyes y apuntes".
- Make one large, centered `Subir material` command the primary action.
- Remove manual "Pegar texto" and document-category controls from upload.
- A click on `Subir material` opens a compact menu with PDF files, ZIP file, or
  folder. Hidden native file inputs may implement the choices, but there must be
  only one visible upload command before that menu.
- Upload is neutral at intake. Any legacy `upload_category` stays internal; the
  explicit analysis later determines document type.
- Remove automatic classification, its checkbox, and per-upload review action.
- Show material in clear file rows/cards with filename/title, type, status,
  date, and `Abrir`/`Eliminar` actions.

`Abrir` must show the original PDF to an authorized manager in a new tab or a
simple preview. Do not expose `storage_path` or a public bucket URL. Use private
Supabase Storage and an authenticated short-lived signed URL in Supabase mode,
plus an equivalent object URL in the InMemory fallback. Never use a service-role
key in the frontend.

`Eliminar` must preserve traceability. For unreferenced material, remove the
record, derived internal records, and private bytes. If material is already used
by topics, questions, tests, attempts, or source references, block deletion with
a clear reason or use the existing safe obsolete/archive path; never silently
break a factual source.

### Temario

Temario owns document understanding. Add an explicit `Analizar material`
command there. It classifies every eligible uploaded material in the current
opposition, not only the latest batch, then opens/shows the existing reviewable
inventory.

It preserves manual corrections by default, skips failed/scanned/garbled
extraction with a visible warning, remains unavailable to Student, and creates
no index, questions, tests, or validated content. Add/adapt one guarded
platform/service method for opposition-wide classification; do not loop over
private repositories from the frontend or create a parallel process.

## Expected Changes

- `app/frontend/src/App.tsx`
- `app/frontend/src/components/AppLayout.tsx`
- `app/frontend/src/styles.css`
- `app/frontend/src/pages/MaterialPage.tsx`
- `app/frontend/src/pages/TopicPage.tsx`
- Existing storage/upload/classification services only where required for secure
  PDF opening, safe deletion, and opposition-wide classification.
- Focused frontend tests for navigation reset/default destination and Student
  preservation.

Avoid unrelated refactors and backend changes.

## Acceptance Criteria

- App background is light blue; cards, list rows, and tools are medium navy.
- Admin sidebar has no `Resumen` and defaults to `Material`.
- Student keeps `Inicio`.
- Clicking an active section resets/refetches it without full reload or context
  loss.
- A CTA targeting the current section has the same reset behavior.
- Action buttons do not repeat mutations merely because they are clicked again.
- Material has one prominent centered upload command and no paste-text,
  category, or auto-classification controls.
- The one command offers PDF, ZIP, and folder intake without competing CTAs.
- Authorized managers can safely open uploaded PDFs and delete unreferenced
  material; referenced source material retains traceability.
- `Analizar material` classifies all eligible current-opposition uploads and
  opens a human-reviewable inventory without downstream generation.
- Desktop/mobile screenshots have no overflow, overlap, or contrast failure.
- Frontend tests and production build pass.

## Instructions For Claude

Implement this focused UX flow using existing backend patterns. Preserve current
user changes. Do not weaken permissions/RLS or alter unrelated workflows. Add
tests for active-section reset, admin default Material, Student Inicio, unified
intake, global classification, safe open/delete, and no automatic downstream
generation. Run relevant frontend/backend tests, production build, and
desktop/mobile visual checks before reporting.
