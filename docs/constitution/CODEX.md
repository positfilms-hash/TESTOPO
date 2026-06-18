# CODEX.md

Codex define, coordina y revisa el trabajo de TESTOPO.

Claude implementa siguiendo specs y prompts preparados por Codex.

## Revisiones visuales

Cuando una spec cambie frontend, navegacion, permisos visibles, autenticacion,
student/admin portal, tests/resultados o QA pre-beta, Codex debe usar:

```text
docs/qa/codex-visual-review-runbook.md
```

Ese runbook formaliza el proceso de smoke visual con Vite/Playwright,
capturas `smoke-*.png` ignoradas por Git y clasificacion de findings en
bloqueantes, recomendados y minimos.
