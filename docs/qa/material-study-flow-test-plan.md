# Plan de pruebas: estudio interno del material (SPEC 038)

Sin red real salvo el retest de staging. La Edge Function (`study-material`) corre
en Deno y **no** la ejecuta vitest; su lógica determinista está cubierta por el
contrato compartido.

## 1. Contrato compartido (vitest) — `app/backend/tests/serverMaterialStudyContract.test.ts`

- **Body**: solo `workspace_id`/`opposition_id` + `mode`/`force_retry`; `mode` por
  defecto `all_eligible`. Rechaza `user_id`/`material_text`/`ocr_text`/`prompt`/
  `concepts`/`image_base64`/`api_key`/desconocidos → `ARBITRARY_INPUT_FORBIDDEN`.
- **Elegibilidad**: legible + clase primaria sin `needs_review` (incl. OCR con
  avisos); rechaza no legible/obsoleto/needs_review/clase no primaria/sin clasificar.
- **Proveedor**: `resolveStudyProvider` OpenAI-only; mensaje honesto sin proveedor.
- **Unidad anclada**: `validateStudyUnit` exige título/resumen, material y puntero
  del scope, y excerpt **contenido** en la evidencia (cita inventada → se sustituye).
- **Estados**: `mapStudyRunStatus` (0 → failed; avisos → completed_with_warnings) y
  `mapMaterialStudyStatus` (sin unidades → study_failed; OCR avisos →
  studied_with_warnings; limpio → studied).

## 2. Wrapper del frontend (vitest) — `app/frontend/tests/serverStudyMaterial.test.ts`

- `shouldUseServerStudy` true en modo Supabase.
- El body invocado contiene **solo** scope + opciones (sin texto/clave/`user_id`).
- El **501 sin proveedor** se mapea a `ServerStudyError` con mensaje seguro.

## 3. Migración / RLS (operador, en staging)

`035_material_study.sql` (aditiva, idempotente): 3 tablas + `materials.study_status`
+ RLS de **solo gestión** (`can_manage_workspace`) + grants de la Data API.
Verificar: un Student no ve `material_study_*` (0 filas por RLS); owner/admin sí.

## 4. Regresión

- Material upload/open/delete/OCR intactos; **no** se crean preguntas ni nada
  `validated`; sin secretos ni llamadas a proveedor desde el frontend.
- Legacy de índice/Topics/propuestas sigue compilando y pasando sus tests (no se
  borra nada).

## 5. Retest de staging (proveedor real, SPEC 035) — flujo completo

Con `supabase secrets set STUDY_PROVIDER=openai OPENAI_API_KEY=… STUDY_MODEL=…` +
`supabase functions deploy study-material`, en una oposición de QA con material
legible y clasificado:

1. **Sin proveedor** (antes de fijar STUDY_PROVIDER): `Estudiar material` →
   **501** `MATERIAL_STUDY_PROVIDER_NOT_CONFIGURED`, **0** runs/units/estado.
2. **Con proveedor**: `Estudiar material` → un `material_study_run`; ≥1
   `material_study_unit` **anclado** (material + sección/referencia + excerpt);
   material → `studied`/`studied_with_warnings`. **Sin** crear preguntas ni
   `validated`.
3. **Negativos**: Student/revocado/cross-scope/input arbitrario rechazados; material
   no elegible → `NO_ELIGIBLE_MATERIAL`; fallo de proveedor → run failed honesto.

No se afirma éxito del proveedor sin este retest.

## 6. Smoke visual (fase 2 de UI)

Cuando exista la UI de `Estudiar material`/`Material estudiado`: runbook de Codex a
1366×900 y 390×844 (progreso honesto, sin índice visible ni `topic_id`).
