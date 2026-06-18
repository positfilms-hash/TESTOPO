# Claude Prompt - SPEC 028 Smart Bulk Upload: Materials & Old Exams

## Context

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

Estamos en:

```text
SPEC 028 - Smart Bulk Upload: Materials & Old Exams
```

Beta Readiness pasa a SPEC 029. No implementes Beta Readiness en esta rama.

Esta spec refuerza el punto de entrada principal de contenido:

```text
Subir material
```

## Spec

Implementa estrictamente:

```text
docs/specs/028-smart-bulk-material-upload.md
```

Branch de trabajo:

```text
feature/smart-bulk-material-upload
```

Runbooks/documentos que debes respetar:

```text
docs/setup/migrations-runbook.md
docs/architecture/persistence.md
docs/architecture/material-ingestion.md
docs/security/rls-policies.md
docs/qa/codex-visual-review-runbook.md
```

Si alguno no existe todavia, crealo o actualizalo segun la spec. No inventes un proceso paralelo.

## Product Goal

El usuario debe poder subir una carpeta, ZIP o varios PDFs con:

- Material de la oposicion.
- Tests antiguos / examenes anteriores.

La app debe desglosarlo, registrar materiales, extraer texto, proponer temario con IA y analizar los tests antiguos como referencia de estilo/cobertura.

La revision humana sigue siendo obligatoria.

## Required Implementation

### 1. UX principal

Crear o reforzar un boton unico:

```text
Subir material
```

Debe abrir modal/pantalla con solo dos categorias principales:

- `Material de la oposicion`.
- `Tests antiguos`.

No mostrar una lista larga de tipos al usuario en la primera carga.

### 2. Tipos de entrada

Implementar:

- ZIP.
- Multiples PDFs.
- Carpeta si el stack/navegador lo permite de forma estable.

Si carpeta no es estable, mostrar recomendacion clara:

```text
Tambien puedes comprimir la carpeta en ZIP y subirla aqui.
```

### 3. Formatos

Permitir:

- `.pdf`
- `.zip`
- `.txt`
- `.md`

Opcional si ya existe soporte:

- `.docx`

Rechazar:

- ZIP anidado.
- Rutas `../`.
- Rutas absolutas.
- Extensiones peligrosas.
- Archivos corruptos.
- Archivos sin extension.
- Archivos demasiado grandes.
- Lotes demasiado grandes.

### 4. Import batches/items

Reutiliza o adapta:

- `material_import_batches`.
- `material_import_items`.

Asegura campos equivalentes a:

- `upload_category`.
- `detected_category`.
- `ai_classification_confidence`.
- `source_type`.
- contadores de imported/skipped/failed/analyzed.
- warnings/errors.

Valores de categoria:

- `opposition_material`.
- `old_tests`.
- `mixed`.
- `unknown` solo para detected/ambiguous.

### 5. Materials

Cada PDF/TXT/MD aceptado debe crear un material asociado a:

- `workspace_id`.
- `opposition_id`.
- `uploaded_by`.

Reglas:

- Material de oposicion -> `type = syllabus` por defecto.
- Tests antiguos -> `type = old_test` por defecto.
- Si hay problema de extraccion/clasificacion -> `status = needs_review`.
- No guardar archivos en el repo.
- No exponer rutas internas.
- No crear URLs publicas inseguras.

### 6. Extraccion

Extraer texto de PDFs cuando sea posible.

Estados:

- `not_started`
- `processing`
- `completed`
- `failed`
- `not_supported`

PDF escaneado sin texto:

```text
extraction_status = not_supported
```

No implementar OCR en esta spec.

### 7. IA y temario

Para material de oposicion:

- Puede lanzar/proponer indice con IA.
- El indice queda pendiente de revision.
- No se aplica sin aprobacion humana.

Para tests antiguos:

- Analiza estilo, dificultad, cobertura y temas frecuentes.
- Guarda resumen de patrones.
- No crea preguntas validadas.
- No copia preguntas sin revision.

Si hay ambos:

- Material de oposicion = base de temario/conocimiento.
- Tests antiguos = estilo/cobertura/frecuencia.

### 8. Generacion de preguntas y tests

Prohibido:

- Generar preguntas `validated` automaticamente.
- Crear tests directos para estudiantes desde PDFs.
- Usar tests antiguos como tests activos para estudiantes sin banco validado.

Correcto:

```text
Indice aprobado
  -> Admin pulsa Generar preguntas
  -> IA genera candidatas pending_review/needs_fix
  -> Admin revisa
  -> Preguntas validated
  -> Tests para estudiantes desde banco validated
```

### 9. Permisos

Puede subir:

- owner
- admin
- manager autorizado
- premium owner en workspace personal

No puede subir:

- student
- usuario sin acceso
- usuario deleted

Student solo puede ver:

- material `active`
- topic `active`
- opposition access `active`

Student no debe ver:

- import batches internos
- errores internos de importacion
- material obsolete
- material needs_review
- tests antiguos internos como fuente de generacion

## Required Tests

Anade o refuerza tests para:

- Owner/admin puede subir.
- Student no puede subir.
- Usuario sin acceso no puede subir.
- ZIP valido se procesa.
- Multiples PDFs se procesan.
- Carpeta se acepta si esta soportada.
- UI recomienda ZIP si carpeta no esta soportada.
- Material de oposicion crea `syllabus`.
- Tests antiguos crean `old_test`.
- ZIP combinado detecta `Material de la oposicion`.
- ZIP combinado detecta `Tests antiguos`.
- Clasificacion ambigua genera warning.
- Carpetas de material crean sugerencias de temas.
- Subcarpetas crean sugerencias de subtemas.
- Tests antiguos no crean temas definitivos automaticamente.
- Tests antiguos crean resumen de patrones.
- PDF con texto queda `completed`.
- PDF sin texto queda `not_supported`.
- TXT/MD guarda `content_text`.
- ZIP con `../` se rechaza.
- Ruta absoluta se rechaza.
- ZIP anidado se rechaza.
- Extension peligrosa se rechaza.
- Archivo demasiado grande se rechaza.
- Lote demasiado grande se rechaza.
- Indice IA queda pendiente de revision.
- Indice IA no se aplica sin aprobacion.
- Tests antiguos no generan preguntas validadas.
- No se generan tests directos para estudiantes.
- Materials/batches/items se guardan en Supabase.
- Student no ve batches internos.
- Student solo ve material active autorizado.
- RLS no se rompe.

Los tests unitarios deben seguir pasando sin Supabase real cuando aplique. Los tests que dependan de Supabase real pueden quedar como integration/manual checks claramente documentados.

## Required Documentation

Crear o actualizar:

```text
docs/user-guides/upload-material.md
docs/qa/smart-bulk-upload-test-plan.md
docs/architecture/material-ingestion.md
```

## Security Checklist

Antes de terminar, verifica:

- No hay service role en frontend.
- No hay `VITE_SUPABASE_SERVICE_ROLE_KEY`.
- No se guardan archivos subidos en el repo.
- No se exponen rutas internas.
- ZIP traversal bloqueado.
- ZIP anidado bloqueado.
- Extensiones peligrosas bloqueadas.
- Student no puede subir.
- Student no ve batches/import errors internos.
- RLS y guards de app siguen activos.

## Out Of Scope

No implementes:

- OCR.
- RAG avanzado.
- Embeddings.
- Fine-tuning.
- Supabase Storage grande si complica la spec.
- Beta Readiness.
- Pagos.
- Marketplace.
- Integraciones externas.

Si Supabase Storage privado resulta imprescindible, documenta una spec futura:

```text
SPEC 030 - Supabase Storage for Private Materials
```

## Final Message / PR Notes

En la descripcion de la PR incluye:

- Resumen UX.
- Soporte ZIP/multiples PDFs/carpeta.
- Categorias implementadas.
- Modelo batch/items/materials tocado.
- Estrategia de extraccion.
- Estrategia IA para temario.
- Estrategia IA para tests antiguos.
- Confirmacion de que no se generan preguntas validated automaticamente.
- Confirmacion de que no se generan tests directos para students.
- Tests ejecutados.
- Checks pendientes si hay limitaciones de navegador/storage.
