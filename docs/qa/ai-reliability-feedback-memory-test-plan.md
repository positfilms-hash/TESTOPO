# Plan QA — Motor de fiabilidad y memoria de feedback (SPEC 040)

Ámbito: contrato compartido (puro), integración server-side en la generación directa,
migración aditiva y UI de revisión. La capa Deno (lectura de `ai_error_memories` +
proveedor) solo se valida en staging; aquí se cubre toda la lógica determinista en
vitest.

## Cobertura automática

### Backend — `app/backend/tests/serverReliabilityContract.test.ts`

- **Catálogo único:** 23 tipos canónicos + 4 severidades; severidad por defecto y
  `avoidInstructionFor` para cada tipo; `resolveSeverity`.
- **Validación de feedback** (`validateReviewFeedback`):
  - `reject` sin motivos → `REASON_REQUIRED`; tipo inválido → `INVALID_FEEDBACK_TYPE`;
    severidad inválida → `INVALID_SEVERITY`; válido → normaliza (default si falta).
  - `needs_fix`/`validate` sin feedback → válido; acción fuera del catálogo →
    `INVALID_ACTION`.
  - `classifyValidationOutcome` (sin/menor/mayor edición).
- **Memoria — aislamiento + prioridad + límites** (`selectErrorMemories`):
  - **Aísla:** descarta memoria de otro workspace u oposición aunque llegue en la
    lista (aislamiento reforzado en código puro).
  - Prioriza críticas → coincidencia de dificultad → ocurrencias; deduplica por
    instrucción; respeta `maxEntries`.
- **Formato + límites** (`formatAvoidBlock`, `resolveMemoryLimits`): bloque separado
  con cabecera; `null` si vacío; acotado a `maxChars`; los secretos solo **reducen**
  (10/3000 por defecto).
- **Inyección en el prompt** (`buildOpenAIRequest` de SPEC 039): sin memoria el prompt
  **no** incluye el bloque (= SPEC 039); con memoria incluye "errores a evitar"
  **después** de la evidencia, sin perderla (memoria ≠ fuente).
- **Métricas** (`computeReliabilityMetrics`): tasas, media de tiempo, top de errores,
  sin división por cero.

### Backend — `app/backend/tests/reliabilityMemoryFlow.test.ts` (E2E de dominio)

- **Revisión → feedback → memoria → prompt aislado:** rechazar dos candidatas del
  mismo tipo en la oposición A persiste feedback **scoped** (`workspace_id`/
  `opposition_id`) e **incrementa** una única memoria (`occurrences = 2`, severidad
  máxima); una candidata de la oposición B crea su propia memoria. La selección para
  la siguiente generación de A (`selectErrorMemories` + `formatAvoidBlock`) incluye
  **solo** la memoria de A/ws-1 y **no** la de B/ws-2.
- `needs_fix` con feedback puebla memoria; sin feedback no crea memoria.

### Backend — `app/backend/tests/examPatternLearning.test.ts`

- `upsertErrorMemory` por clave de agregación incrementa `occurrences` y sube la
  severidad (InMemory + Supabase).

### Frontend — `app/frontend/tests/reviewFeedback.test.tsx`

- **Reject exige motivo + severidad:** el botón "Rechazar" está deshabilitado sin
  motivo; el selector de severidad es visible; al marcar un motivo se habilita.
- **Métricas básicas:** la cabecera de Preguntas muestra la franja de fiabilidad.

### Regresión

- `smoke.test.tsx` (Temario = Estudiar → Generar; Preguntas) sin regresiones.
- El generador de tests del alumno sigue usando **solo** validadas (cobertura previa
  `testGenerator`/`preBetaInvariants` intacta).

## Mapa criterios SPEC 040 → evidencia

| Criterio | Evidencia |
| --- | --- |
| 1. Reject exige tipo/severidad y persiste feedback scoped | `validateReviewFeedback` + UI reject + flujo `reject(feedback)` |
| 2. Needs fix/edit/validate registran señales; validar sin cambios no obliga feedback | `validateReviewFeedback` + `classifyValidationOutcome` |
| 3. Tipos/severidades inválidos, Student/revocado/cross-scope rechazados | contrato + `evaluateManagementAccess` (Edge) + RLS gestión |
| 4. Feedback crítico/repetido crea/actualiza memoria e incrementa ocurrencias | `QuestionReviewService` upsert POR REVISIÓN + `reliabilityMemoryFlow` e2e |
| 5. Memorias/métricas no se mezclan entre scopes | `selectErrorMemories` aislamiento + query por workspace+opposition |
| 6. La generación recupera solo memoria del mismo scope como calidad, no fuente | Edge Function 6b + `formatAvoidBlock` separado |
| 7. Sin memoria sigue funcionando; sin fuente sigue bloqueada | inyección opcional + `NO_EVIDENCE` (SPEC 039) |
| 8. Ninguna ruta deja `validated` automático; test generator solo validadas | invariante SPEC 039 + regresión |
| 9. Tests backend/frontend de los casos clave | suites anteriores |
| 10. Build + smoke visual 1366×900 / 390×844 | `vite build` + revisión Codex |

## Verificación manual en staging (operador)

Requiere migración 037 aplicada + secretos del proveedor + función desplegada. Sin
retest real **no** se declara PASS.

1. Rechazar varias candidatas con motivos críticos → aparece/incrementa memoria del
   mismo scope.
2. Generar desde material estudiado → el prompt incluye el bloque "errores a evitar"
   (≤10/≤3000), separado de la evidencia; las candidatas siguen `pending_review`/
   `needs_fix`, nunca `validated`.
3. Otra oposición/workspace: su generación no recibe la memoria ajena.
4. Sin memoria: generación idéntica a SPEC 039. Sin fuente: bloqueo `NO_EVIDENCE`.
5. Student/otro scope: no leen ni escriben feedback, memoria, métricas ni candidatas.
