# Plan de pruebas: flujo temario → generación de preguntas (SPEC 037)

Cubre el flujo `material legible → índice compacto → aplicar → Topics con fuentes →
preguntas en servidor`. Sin red real salvo el retest de proveedor en staging.

## 1. Readiness de fuentes == elegibilidad del servidor (fase 1)

`app/backend/tests/sourceReadinessEligibility.test.ts`:

- una fuente limpia (material legible + clase primaria + sección activa) cuenta;
- **no** cuenta: clasificación `needs_review`, material no legible
  (`failed`/`ocr_failed`/`not_supported`), obsoleto, ni puntero inválido (sección
  inactiva sin referencia);
- una referencia de fuente válida (sin sección) sí cuenta.

Garantía: la readiness visible **no puede contradecir** la elegibilidad del Edge
(`evaluateTopicSourceReference`). No se relaja la guarda del servidor.

## 2. Índice compacto (fase 2)

`app/backend/tests/validateCompactIndex.test.ts`:

- acepta un índice compacto (5–15 raíces, profundidad 1–2, con fuentes);
- `needs_regeneration` si: > 20 raíces, profundidad > 3, títulos vacíos, dominado
  por artículos/páginas (transcripción), o ningún tema con fuente;
- aviso (no bloqueante) si las raíces están fuera del objetivo 5–15;
- `isMicroHeadingTitle` detecta `Artículo N`/`Pág. N`/`1.2.3`/`Anexo`/`Disposición`.

Regresión: `syllabusIndexFromDocuments`/`syllabusIndexPlatform`/
`supabaseSyllabusIndex` verdes con la config más estricta (`max_topics=60`,
`max_depth=3`).

## 3. Revisión y aplicación global

- `Generar temario` crea **una** propuesta revisable; revisión **global**; un solo
  `Aplicar índice completo` (sin gate por tema).
- `applyProposal` crea/reutiliza `topics` activos del scope y persiste
  `topic_source_references`; **no duplica** al reaplicar; no borra el mapa aplicado
  sin la confirmación segura existente. (`syllabusIndexFromDocuments.test.ts`.)

## 4. Generación de preguntas y errores seguros

- Tema aplicado con evidencia elegible → `generate-questions` crea un run y solo
  candidatas `pending_review`/`needs_fix`, nunca `validated` (cobertura
  `serverGroundedFlowContract`/`serverQuestionGenerationContract`).
- Mensajes seguros en español (sin filtrar internals): sin fuente, tema no
  aplicado, proveedor ausente, acceso denegado, fallo genérico
  (`serverQuestionGeneration.ts`).

## 5. Aislamiento y regresión

- Student/cross-workspace/cross-opposition rechazados (guardas del Edge + RLS).
- Material/OCR y fallback InMemory intactos.

## 6. Retest de staging (proveedor real)

La generación real con proveedor solo se valida en staging (SPEC 035): índice
aplicado con fuentes reales → preguntas trazables. No se afirma éxito del proveedor
sin ese retest.

## 7. Smoke visual

Runbook de Codex a 1366×900 y 390×844: Temario (propuesta compacta, avisos de
`needs_regeneration`, un solo botón de aplicar), y Preguntas (readiness coherente +
mensajes seguros). No ejecutable sin navegador/sesión de staging.
