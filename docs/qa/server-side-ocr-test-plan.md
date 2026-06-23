# Plan de pruebas — OCR en servidor (SPEC 034)

Pruebas **sin red** (contrato puro + wrapper) más las comprobaciones de regresión
y los pasos de retest de staging que **no** son codificables hasta desplegar
secretos.

## 1. Contrato compartido (backend, vitest, sin red)

`app/backend/tests/serverOcrMaterialContract.test.ts` cubre la lógica canónica de
`supabase/functions/_shared/ocr-material/contract.ts`:

- **Body válido**: solo `workspace_id`/`opposition_id`/`material_id` + `mode`/
  `force_retry`; `mode` por defecto `auto`, `force_retry` por defecto `false`.
- **Entrada prohibida** → `OCR_ARBITRARY_INPUT_FORBIDDEN`: `user_id`,
  `image_base64`, `image_url`, `ocr_text`, `fake_text`, `raw_text`,
  `provider_prompt`, `api_key` y campos desconocidos.
- **Scope obligatorio**: faltan workspace/opposition/material → códigos
  `*_REQUIRED`. Body no-objeto → `OCR_INVALID_REQUEST`.
- **Elegibilidad/reintento**: solo `scanned_detected`/`ocr_failed`/
  `completed_ocr_with_warnings` son elegibles; los demás se rechazan.
- **Proveedor**: `isOcrProviderReady` exige proveedor compatible **y** clave.
- **Bandas de confianza**: `>=0.70`/`0.40–0.69`/`<0.40|null`.
- **Agregación**: solo texto usable en orden; media a 2 decimales o `null`.
- **Estados honestos**: `mapOcrTerminalOutcome` (sin texto → `ocr_failed`; con
  fallos/advertencias → `completed_ocr_with_warnings`; limpio → `completed_ocr`).

## 2. Wrapper del frontend (vitest, sin red)

`app/frontend/tests/serverOcrMaterial.test.ts` (cliente Supabase y modo de
persistencia mockeados):

- `shouldUseServerOcr()` true en modo Supabase configurado.
- El body invocado contiene **solo** las claves permitidas (sin imagen/texto OCR/
  clave/`user_id`); `mode: "auto"`; `force_retry` propagado.
- El **501 sin proveedor** se mapea a un `ServerOcrError` con mensaje seguro
  ("…no configurado en servidor.").
- Body inválido (p. ej. `material_id` vacío) **no** invoca la función.

## 3. Regresión (debe seguir verde)

- `cd app/backend && npx vitest run` → **570** (incluye material/OCR, plataforma,
  autorización Supabase/InMemory). El servicio en proceso `MaterialOcrService` y su
  proveedor mock siguen intactos para InMemory.
- `cd app/frontend && npx vitest run` → **78** (incluye smoke + labels OCR).
- `cd app/frontend && npx vite build` → OK.
- Subida (PDF/ZIP/carpeta), apertura de PDF firmado y la UI de Material (badges de
  estado, detalle compacto solo-gestor, botón `Reintentar OCR` solo en estados
  elegibles) intactos. No se llama a clasificación/índice/generación.

## 4. Aislamiento del alumno (verificado por diseño + RLS)

El alumno no puede invocar `ocr-material` (verify_jwt + checks de scope + RLS de
`material_ocr_runs`/`material_ocr_pages`), ni ver controles de OCR (la UI los limita
a `isAdmin`), ni runs/páginas/confianza/errores ni referencias internas de imagen.

## 5. Retest de staging (NO codificable; requiere secretos desplegados)

Tras `supabase secrets set OCR_PROVIDER/OPENAI_API_KEY/OCR_MODEL` y
`supabase functions deploy ocr-material` (ver
[`../security/ocr-provider-secrets.md`](../security/ocr-provider-secrets.md)):

1. **Sin proveedor** (antes de fijar la clave): un escaneo real responde 501
   `OCR_PROVIDER_NOT_CONFIGURED`, el material **conserva** `scanned_detected` y no
   aparece run/página/texto en la base de datos.
2. **Con proveedor**: leer un PDF escaneado real produce run + páginas con texto y
   confianza reales, `content_text` agregado en orden y estado terminal honesto.
3. **Reintento** desde `ocr_failed`/`completed_ocr_with_warnings` crea un run nuevo
   aislado (no mezcla páginas previas).
4. **Fail closed** de render/proveedor: estado fallido seguro, sin texto inventado.
5. **No-filtración**: ni la respuesta ni los logs contienen texto OCR completo,
   prompts, claves ni rutas internas/URLs firmadas.
6. **Smoke visual** (runbook de Codex `docs/qa/codex-visual-review-runbook.md`) a
   1366×900 y 390×844: badges de estado y errores seguros, sin secretos en pantalla.

> Una afirmación de "OCR real funciona" **exige** completar §5 en staging. No se
> infiere de los tests mock/unit de §1–2.
