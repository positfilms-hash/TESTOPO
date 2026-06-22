# Claude Brief - SPEC 031 Modern Drive-like Frontend Refresh

Implement only `docs/specs/031-modern-drive-like-frontend-refresh.md` on
`feature/modern-drive-like-frontend-refresh`.

Before touching code, read:

1. `docs/constitution/CODEX.md`.
2. `docs/constitution/CLAUDE.md`.
3. `docs/specs/031-modern-drive-like-frontend-refresh.md`.
4. `docs/qa/codex-visual-review-runbook.md`.
5. The existing frontend components, styles, and focused tests.

Use the `design frontend` plugin/tool, or an equivalent available design tool,
to inspect current screens and plan the visual system first. If it is not
available, continue manually and state that in your final report.

This is frontend presentation only. Refresh the app shell, navigation, page
headers, typography, controls, badges, file-list treatment, and
empty/loading/error states into a polished, original file-manager-inspired
TESTOPO experience. Material should look like a clean document library and
must retain exactly the current upload, open, and delete behavior. Restyle
existing OCR/extraction statuses only; do not create or wire new status logic.

Do not modify any backend, Supabase, RLS, Storage, permissions, authentication,
AI, OCR, models, repositories, services, migrations, Edge Functions, or
business rule. Do not add functionality, new routes, dependencies, data
fetching, or upload/delete/retry behavior. Preserve Student/Admin separation
and do not expose internal content to Student.

Limit changes to `app/frontend/` plus focused frontend tests or a small design
note if necessary. Run relevant frontend tests and production build, then use
the visual-review runbook for desktop `1366x900` and mobile `390x844` smoke
checks. Report changed files, plugin availability, commands/results, screenshots,
and any remaining limitation.
