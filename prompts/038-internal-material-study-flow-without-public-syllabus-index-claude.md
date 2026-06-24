# Claude Prompt - SPEC 038 Internal Material Study Flow

Read first, in full:

1. `docs/constitution/CODEX.md`
2. `docs/constitution/CLAUDE.md`
3. `docs/specs/038-internal-material-study-flow-without-public-syllabus-index.md`
4. SPEC 030, 032, 033, 034, 035, 036, and 037
5. Existing Material/OCR/Temario code, migrations, source/classification
   repositories, tests, and `docs/qa/codex-visual-review-runbook.md`.

Implement this on branch `feature/internal-material-study-flow`. Preserve all
unrelated files and current security fixes.

This is a product reset for the primary material path:

```text
Material -> Estudiar material -> internal source-backed study data -> ready for SPEC 039
```

Do not make a public syllabus index, applying an index, Topics, or per-topic
approval a requirement. Do not build the new flow on the old visible-index
dependency. Keep legacy Topics/proposals/tables for compatibility; do not delete
them aggressively. SPEC 036 rehydration and SPEC 035 server-secret/no-mock
principles remain valid and must not be marked obsolete.

Implement the smallest safe server-side study flow:

- authenticated `study-material` Edge Function (or an existing equivalent only
  if it already meets every security requirement);
- browser sends scope IDs/bounded options only, never text/prompt/image/user ID
  or keys;
- verify JWT, actor, management permission, workspace, opposition, and each
  eligible material before provider/database access;
- reuse sections/references/classification where sufficient; add minimal
  idempotent study-run/unit/concept schema only where lifecycle/source-backed
  preparation requires it;
- read only eligible native/OCR material; exclude failed, obsolete, irrelevant,
  unreadable, and unreviewed ambiguous material;
- create only source-grounded units/concepts with concrete pointers and bounded
  excerpts; real provider secrets stay server-only;
- missing provider is an honest 501 with no mock completed runs/units/status;
- no question candidates and no validated records in this SPEC.

UI requirements:

- Temario/analysis route presents `Estudiar material`, honest coarse progress,
  and `Material estudiado` summary; no false percentages.
- New material must not require a visible index, apply action, per-topic review,
  or topic selection.
- Material route remains upload/open/delete/OCR only.
- Student cannot start study or view internal runs/units/concepts.

Add focused tests and docs from SPEC 038. Run relevant backend/frontend tests,
frontend build, `git diff --check`, and desktop/mobile visual smoke. Report
data-model rationale, migrations/RLS, changed paths, command results, visual
evidence, and real staging blockers. Do not claim real provider success without
an actual staging retest.
