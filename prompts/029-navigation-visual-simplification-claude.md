# Claude Implementation Brief - SPEC 029

Implement `docs/specs/029-navigation-visual-simplification.md`.

Preserve the modified
`app/backend/src/service/aiErrorMemoryService.ts` and untracked `.claude/`.
Do not change unrelated backend, migrations, RLS, permissions, or business rules.

Set the page background to very light blue. Use a medium navy, lighter than the
former dark navy, for cards/panels/list rows; text on them is white. Inputs stay
white. Make titles more elegant and distinct with the existing local serif stack
and a clear heading hierarchy. Preserve contrast and pastel-blue actions; do
not add remote fonts, gradients, or decoration.

Remove `Resumen` from the admin sidebar. Admin defaults to `Material` after
entering an opposition, changing workspace/opposition, or switching from
Student. Keep Student `Inicio` unchanged.

Clicking an active navigation item or a CTA that targets the current section
must reset it to its root view and refetch normal data without browser reload or
loss of session/workspace/opposition/zone. Use a navigation revision/key or
equivalent explicit reset mechanism, not identical state assignment. This applies
to navigation only: Upload, Generate, Approve, Save, Delete, and Submit must not
repeat mutations on repeated clicks.

Rework Material into a simple file library. Remove its subtitle, paste-text,
category radios, auto-classification checkbox, and separate visible ZIP/folder/
PDF buttons. Show one large centered `Subir material` command that opens a
compact choice menu for PDF files, ZIP, or folder. Keep legacy intake metadata
internal/default; classification decides document type later.

Show clear material rows/cards with `Abrir` and `Eliminar`. `Abrir` must safely
preview/open original PDFs for authorized managers via private storage and a
short-lived authenticated URL (or object URL in memory), never `storage_path`
or a public bucket. `Eliminar` deletes unreferenced material and bytes; referenced
source material must be blocked or safely archived so traceability cannot break.

Move classification to Temario. Add `Analizar material`, which classifies every
eligible uploaded document in the current opposition, preserves manual
corrections by default, warns on failed/scanned/garbled extraction, and opens the
existing reviewable inventory. It creates no index, questions, tests, or
validated content. Add/adapt one guarded platform/service method; do not loop
private repositories in the frontend.

Add focused tests for navigation, unified intake, global classification, secure
open/delete, and no automatic downstream generation. Run relevant frontend and
backend tests plus production build. Check desktop and mobile for contrast,
overflow, and overlap before reporting.
