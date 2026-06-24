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
  botón `Aplicar índice completo` (aprueba + aplica). **Sin** aceptar/rechazar por
  tema (UI: `SyllabusIndexPanel`).
- `applyProposal` crea/reutiliza `topics` activos del scope y persiste
  `topic_source_references`; **no duplica** al reaplicar; no borra el mapa aplicado
  sin la confirmación segura existente. (`syllabusIndexFromDocuments.test.ts`.)
- **Referencias ELEGIBLES (clave)**: `applyProposal` crea `topic_source_references`
  **solo** para fuentes que el servidor aceptará (material legible, clasificación
  efectiva sin `needs_review`, puntero concreto válido). Una fuente no usable **no**
  se vincula; el tema queda avisado *sin fuentes utilizables*.
  (`syllabusApplyEligibility.test.ts`.)
- **`needs_regeneration` no se aplica**: el apply revalida la compacidad desde los
  nodos persistidos y **bloquea** (`SYLLABUS_INDEX_NEEDS_REGENERATION`) un índice no
  compacto/transcripción. (`syllabusApplyEligibility.test.ts`.)

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

## 6. Retest de staging (proveedor real) — flujo completo de reparación

Con secretos del proveedor configurados (SPEC 035), en una oposición de QA con
material de estudio legible y bien clasificado (sin `needs_review`):

1. **Regenerar** el temario → propuesta **compacta** (5–15 raíces, 1–2 niveles); si
   sale `needs_regeneration`, el botón de aplicar lo bloquea con aviso.
2. **Aplicar índice completo** (un clic) → se crean Topics activos y
   `topic_source_references` **elegibles**. Verifica en SQL que las referencias del
   tema cumplen la elegibilidad (material legible, clasificación sin `needs_review`,
   sección activa / referencia).
3. En **Preguntas**, el tema nuevo muestra fuentes (`N fuente(s) disponible(s)`) y
   el botón **Generar** está habilitado.
4. **Generar** → `generate-questions` crea un `question_generation_run` y al menos
   **una candidata** `pending_review`/`needs_fix` (nunca `validated`), con tema +
   material + puntero de fuente + excerpt.
5. Negativo: un tema **antiguo sin fuentes utilizables** muestra el aviso y **no**
   deja generar (botón desactivado); `generate-questions` respondería el mensaje
   seguro de "sin fuentes".

No se afirma éxito del proveedor sin completar este retest real.

## 7. Smoke visual

Runbook de Codex a 1366×900 y 390×844: Temario (propuesta compacta, avisos de
`needs_regeneration`, un solo botón de aplicar), y Preguntas (readiness coherente +
mensajes seguros). No ejecutable sin navegador/sesión de staging.
