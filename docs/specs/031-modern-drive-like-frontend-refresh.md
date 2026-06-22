# SPEC 031 - Modern Drive-like Frontend Refresh

## Objective

Refresh the TESTOPO frontend so it feels modern, calm, professional, and easy
to scan. The visual reference is the clarity of a contemporary file manager:
open space, obvious hierarchy, readable lists, restrained actions, and a
Material area that feels like a trustworthy document library. It must be an
original TESTOPO design, not a copy of Google Drive or another product.

TESTOPO may be complex internally, but it should look simple before the user
understands every workflow.

## Scope

This is a visual and superficial frontend UX refresh only. It may change React
layout, presentational components, CSS/tokens, existing icon usage, labels,
empty/loading/error presentation, and responsive layout. It may reuse and
restyle existing flows and actions.

It must not add or alter functionality, data contracts, routes with new
behavior, backend code, Supabase, Storage, RLS, permissions, authentication,
AI, OCR, test generation, question validation, repositories, domain services,
or migrations. Do not add dependencies unless one is already approved and
present in the frontend.

## Required Preparation

Before editing, Claude must read:

1. `docs/constitution/CODEX.md`.
2. `docs/constitution/CLAUDE.md`.
3. This spec.
4. The current frontend structure and relevant existing component tests.
5. `docs/qa/codex-visual-review-runbook.md` for the final visual verification.

Claude must use the `design frontend` plugin/tool, or its equivalent, if it is
available in its environment. Use it to inspect the present screens and shape a
coherent design proposal before implementation. If unavailable, continue with
the existing design system and explicitly state that limitation in the report.

## Visual Direction

- Use a very light blue app canvas and mostly white or pale-blue reading
  surfaces. Keep medium elegant navy for selected/emphasized cards, sidebar
  anchors, and primary actions; it must not make the interface feel heavy.
- Keep text dark on light surfaces and near-white on navy ones. Maintain
  accessible contrast and visible keyboard focus.
- Use an elegant local serif stack for headings only (for example, the existing
  Georgia-based choice) and a clean system sans-serif for body, forms, buttons,
  tables, and lists. Make page titles, panel headings, labels, and body copy
  visibly distinct without oversized typography.
- Establish a compact, consistent spacing scale, border treatment, shadows,
  control heights, badge shapes, and icon alignment. Do not introduce rounded
  card-inside-card compositions, gradients, decorative blobs, or a marketing
  landing-page style.
- Keep action language short and human. Translate technical failure messages
  already produced by the UI into clear user-facing presentation where a
  display mapping already exists; do not change error handling or codes.

## Application Shell And Navigation

Improve the sidebar, top bar, page headers, context indicators, and section
layout using current navigation behavior only.

- Make the active section unmistakable, without making every navigation item a
  large button.
- Keep Material, Temario, Preguntas, Tests, Resultados, and any existing
  account/settings destination easy to identify and scan.
- Preserve the current Admin/Student visibility rules exactly. The Student
  portal must remain calmer and must not gain OCR, classification, generation,
  review, source, or other internal-management views.
- Do not change navigation state/reset semantics introduced by prior work. This
  spec changes how navigation looks, not what clicking it does.

## Material As A File Library

Restyle the existing Material screen as a clean file-management surface.

- Preserve the existing prominent centered `Subir material` action and its
  current one-flow upload behavior. Do not add input types or upload logic.
- Show existing material as simple, scan-friendly file rows or cards: file-type
  icon, title, existing extraction/OCR status, available date/metadata, and
  existing `Abrir` and `Eliminar` actions.
- Use concise accessible status badges. Present only statuses the existing UI
  already receives; do not invent OCR state, polling, or a retry flow.
- `Abrir` and `Eliminar` must continue to invoke their existing handlers,
  confirmation, authorization, and errors unchanged. Improve hierarchy and
  affordance only.
- Do not show paste-text, separate competing upload CTAs, document
  classification controls, raw storage paths, technical OCR details, or new
  controls. Material remains upload/open/review/delete; Temario remains the
  existing place for analysis and organization.

## Existing Screens

Improve visual hierarchy without changing each screen's data or actions:

- **Temario:** make material analysis, classification/inventory, and index
  actions that already exist feel clearly separate from Material intake.
- **Preguntas and review:** make existing statuses, source/excerpt blocks,
  warnings, and review actions readable. Approval should look intentional, not
  automatic.
- **Tests and results:** make existing creation, recent-test, score, and review
  surfaces calmer and easier to scan, without exposing answers before submit or
  changing test behavior.
- **Empty, loading, and error states:** use a consistent existing-component
  treatment with short, clear copy. Do not add a new asynchronous state or
  modify underlying requests.

Prefer improving reusable presentational components such as the application
layout, page header, file list/row, status badge, empty state, loading state,
error state, confirmation dialog, and review card when they already exist or
when a small presentational extraction eliminates repetition. Do not introduce
duplicate component systems.

## Responsive And Accessibility Requirements

- Verify desktop `1366x900`, laptop/tablet-width layout, and mobile `390x844`.
- No horizontal overflow, clipped actions, overlapping text, inaccessible
  focus, color-only status communication, or unreadable navy-on-dark text.
- Use familiar Lucide icons where the frontend already supports them, with
  tooltips/accessible names for icon-only commands. Keep text labels for core
  commands such as upload, open, and delete.
- Stable row/control dimensions must prevent layout shifts when state labels or
  metadata change.

## Out Of Scope Guardrails

Claude must not:

- Change any backend, model, repository, service, migration, Edge Function, or
  Supabase configuration.
- Touch RLS, permissions, authentication, OCR execution, AI behavior,
  classification, indexes, question generation, test rules, or validation.
- Add a new upload capability, deletion behavior, retry capability, dashboard,
  analytics, ranking, payment, gamification, or new functional route.
- Expose internal Student data or weaken existing Admin/Student separation.
- Replace functional tests with visual assertions or remove tests to make the
  redesign pass.

## Expected Change Surface

Frontend-only files under `app/frontend/`, focused component tests if already
supported, and optionally a concise design note under `docs/` explaining tokens
or component conventions. Do not modify `app/backend/`, `supabase/`, Edge
Functions, migrations, persistence documents, or domain tests.

## Acceptance Criteria

- The app has a coherent light-blue, navy, white, and neutral visual language
  with clearly differentiated typography.
- App shell, navigation, cards/rows, buttons, badges, forms, empty/loading/error
  states, and page headers look like one product.
- Material visually reads as a modern file library while retaining precisely its
  existing upload, open, and delete behavior.
- Temario remains visually and conceptually separate from Material.
- Admin and Student continue to see only their current permitted views; no
  internal management data appears for Student.
- Existing Material, Temario, Questions, Tests, Results, and account flows
  remain reachable and behaviorally unchanged.
- Desktop and mobile visual smoke checks show no overflow, overlap, contrast,
  focus, or interaction regressions.
- Relevant frontend tests and production build pass. No backend/Supabase/RLS/
  domain implementation file is changed.

## Instructions For Claude

Implement only this frontend refresh. First read both constitution documents,
this spec, the current frontend, and the visual-review runbook. Use `design
frontend` when available; otherwise work manually and report that it was not
available. Preserve every existing flow, handler, permission boundary, and
data contract. Before reporting completion, run focused frontend tests and the
production build, then inspect desktop and mobile visual smoke screenshots.
Report the plugin result, files changed, tests/build, viewports checked, and
any remaining visual limitation.
