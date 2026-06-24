# Plan QA — Generación directa de preguntas desde material estudiado (SPEC 039)

Ámbito: contrato puro + Edge Function + wrapper + UI. La capa Deno (OpenAI/Supabase)
solo se valida en staging con secretos reales; aquí se cubre toda la lógica
determinista en vitest.

## Cobertura automática

### Backend — `app/backend/tests/serverDirectQuestionGenerationContract.test.ts`

- **Validación del body** (`validateDirectGenerateRequest`): acepta alcance global
  mínimo; rechaza campos prohibidos (`user_id`, `source_text`, `excerpt`, `prompt`,
  `api_key`, `correct_answer`, `options`, `statement`, …) y desconocidos; exige
  workspace/oposición; valida cantidad (1–20), dificultad (incl. `mixed`) y límites
  de arrays; **coherencia scope↔arrays** (`isSelectionCoherent`).
- **Límites** (`resolveDirectLimits`): ausente/ inválido → máximo seguro; un secreto
  solo **endurece**, nunca supera el máximo.
- **Elegibilidad**: `isStudyRunReady` (solo `completed`/`completed_with_warnings`);
  `isUsableStudiedMaterial` (excluye ajeno, obsoleto, failed/ocr_failed).
- **Validación de candidata** (`validateDirectCandidate`):
  - positiva: anclada a unidad, 1 correcta, excerpt contenido → sin avisos;
  - rechaza `validated`, estructura incompleta, <2 opciones, ≠1 correcta, duplicadas;
  - rechaza unidad ajena/ausente y material/sección/referencia que no casan;
  - excerpt inventado → sustituido por el texto de **la unidad citada** + aviso
    (→ `needs_fix`);
  - **anclaje por puntero**: citar `u-1` con texto de `u-2` NO valida contra una
    bolsa global (el excerpt resultante es el de `u-1`);
  - propaga `material_study_concept_id` cuando la evidencia es un concepto.
- **Estados**: `candidateStatus` nunca `validated` (pending_review/needs_fix);
  `mapRunStatus` (failed/partial/completed).
- **Proveedor**: `resolveProvider` null sin proveedor real; mensaje 501 honesto.
- **Orquestador** (`runDirectGeneration`): positivo (completed), proveedor falla
  (failed, 0 escrituras), sin candidatas válidas (`NO_VALID_CANDIDATES`),
  persistencia parcial (partial).

### Frontend — `app/frontend/tests/serverDirectQuestionGeneration.test.ts`

- Invoca `generate-questions-from-studied-material` con **solo** IDs/parámetros
  permitidos (sin texto/fuente/extracto/prompt/clave/correct_answer).
- Incluye `material_study_run_id` solo si se proporciona.
- Mapea el 501 sin proveedor a un mensaje seguro.
- No invoca si el body no pasa el contrato (cantidad fuera de rango, selección
  incoherente con el alcance).

### Frontend — `app/frontend/tests/smoke.test.tsx`

- La pantalla Temario muestra el panel **Generar preguntas** (junto a *Estudiar
  material*), sin índice ni selector de tema.

## Mapa criterios de aceptación → evidencia

| Criterio SPEC 039 | Evidencia |
| --- | --- |
| 1. Generar sin índice/tema obligatorio | UI panel + Edge Function sin `topic_id` |
| 2. Valida JWT/gestión/scope/estudio/evidencia antes de IA | Edge Function pasos 1–5 |
| 3. Cliente no envía texto ni suplanta scope | contrato `validateDirectGenerateRequest` + wrapper |
| 4. Candidata con evidencia, extracto coherente, explicación, 1 correcta | `validateDirectCandidate` |
| 5. Todas pending_review/needs_fix; nunca validated | `candidateStatus` + regla dura |
| 6. Student/cross-scope rechazados | `evaluateManagementAccess` + checks scope/selección |
| 7. Sin proveedor/evidencia → bloqueo honesto, 0 mocks | 501 / `NO_EVIDENCE` / `STUDY_NOT_READY` |
| 8. El flujo por tema no bloquea ni se invoca | contrato/Edge Function independientes |
| 9. Tests backend/frontend de los casos clave | suites anteriores |
| 10. Build OK + smoke visual sin regresiones | `vite build` + revisión 1366×900 / 390×844 |

## Verificación manual en staging (operador)

Requiere migración 036 aplicada + secretos del proveedor + función desplegada
(ver `docs/setup/staging-ai-activation.md`). Sin retest real **no** se declara PASS.

1. Sin proveedor: generar → **501 honesto**, sin filas nuevas en `questions`/
   `question_generation_runs`.
2. Con proveedor y material estudiado: generar → candidatas `pending_review`/
   `needs_fix`, cada una con `material_study_unit_id` y extracto coherente.
3. Comprobar que **ninguna** queda `validated` y que el generador de tests del
   alumno sigue ofreciendo solo preguntas validadas.
4. Student / otro workspace / otra oposición: rechazo; no listan internas.
5. Sin estudio previo: bloqueo `STUDY_NOT_READY` claro, sin escrituras.
