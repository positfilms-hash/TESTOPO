# Claude Prompt - SPEC 019 AI Syllabus Index Builder

## Context

Cambiamos el orden previsto:

```text
SPEC 019 = AI Syllabus Index Builder
SPEC 020 = Supabase Repositories: Profiles & Workspaces
```

No migres todavia Supabase Repositories: Profiles & Workspaces. Eso queda para SPEC 020.

Queremos que TESTOPO pueda analizar el material subido a una oposicion y proponer un indice de temario con IA.

La IA debe analizar:

- Temario.
- PDFs con texto extraido.
- Apuntes.
- Leyes.
- Tests antiguos.
- Examenes oficiales.
- Materiales importados desde ZIP.

Debe proponer:

- Temas.
- Subtemas.
- Materiales asociados a cada tema.
- Materiales sin clasificar.
- Notas sobre tests antiguos y estilo de examen.

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

## Spec

Implementa estrictamente:

```text
/docs/specs/019-ai-syllabus-index-builder.md
```

Branch de trabajo:

```text
feature/ai-syllabus-index-builder
```

## Product Goal

Pasar de "muchos documentos subidos" a "indice de temario organizado y revisable", para que despues la generacion de preguntas tenga una base solida.

La IA debe proponer un indice, pero el admin/owner debe revisarlo, editarlo, aprobarlo y aplicarlo manualmente al Topic Map.

## Non-Negotiable Rules

- La IA solo propone el indice.
- El indice no se aplica sin revision humana.
- Solo una propuesta aprobada puede aplicarse al Topic Map.
- No generes preguntas en esta spec.
- No valides preguntas en esta spec.
- No conviertas tests antiguos en preguntas nuevas.
- No implementes OCR.
- No implementes RAG avanzado.
- No implementes embeddings.
- No implementes fine-tuning.
- OpenAI debe usarse como proveedor principal si esta configurado segun SPEC 018.4-B.
- Mantener proveedor mock para tests.
- La salida IA debe ser estructurada y validable.
- Student no puede crear, aprobar ni aplicar indices.
- Owner/admin si pueden.
- Usuario Premium owner puede hacerlo en su workspace personal.

## Out Of Scope

No implementes:

- OCR.
- RAG avanzado.
- Embeddings.
- Base vectorial.
- Fine-tuning.
- Entrenamiento propio del modelo.
- Generacion automatica de preguntas tras crear el indice.
- Validacion automatica definitiva del indice.
- Importacion desde Google Drive, Dropbox o OneDrive.
- Correccion juridica avanzada.
- Deteccion automatica de normativa derogada.
- Fusion compleja de temarios.
- Versionado avanzado de temario.
- Estadisticas avanzadas.
- Migracion Supabase de repositorios de dominio.

## Required Models

Implementa modelos o entidades equivalentes.

### SyllabusIndexRun

Campos recomendados:

- `id`
- `workspace_id`
- `opposition_id`
- `created_by`
- `status`
- `provider`
- `model`
- `material_ids`
- `input_summary`
- `total_materials`
- `analyzed_materials`
- `ignored_materials`
- `proposed_topics_count`
- `warnings`
- `errors`
- `created_at`
- `updated_at`

Estados:

- `pending`
- `processing`
- `completed`
- `completed_with_warnings`
- `failed`
- `cancelled`

### SyllabusIndexProposal

Campos recomendados:

- `id`
- `run_id`
- `workspace_id`
- `opposition_id`
- `title`
- `status`
- `created_by`
- `approved_by`
- `approved_at`
- `applied_at`
- `created_at`
- `updated_at`

Estados:

- `draft`
- `pending_review`
- `approved`
- `rejected`
- `applied`

Reglas:

- `draft` o `pending_review` puede editarse.
- `approved` puede aplicarse al Topic Map.
- `applied` ya fue convertida en temas reales.
- `rejected` no debe aplicarse.

### SyllabusIndexNodeProposal

Campos recomendados:

- `id`
- `proposal_id`
- `parent_id`
- `title`
- `description`
- `code`
- `order`
- `confidence`
- `source_material_ids`
- `source_references`
- `warnings`
- `status`
- `created_at`
- `updated_at`

Estados:

- `proposed`
- `edited`
- `accepted`
- `rejected`
- `merged`

`confidence` puede existir entre `0` y `1`, pero no puede aprobar nada automaticamente.

### MaterialTopicSuggestion

Campos recomendados:

- `id`
- `run_id`
- `proposal_node_id`
- `material_id`
- `confidence`
- `reason`
- `status`
- `created_at`
- `updated_at`

Estados:

- `suggested`
- `accepted`
- `rejected`
- `unclassified`

### ExamPatternSummary

Opcional, o incluido dentro de `SyllabusIndexRun`.

Debe tratar tests antiguos/examenes como contexto, no como banco de preguntas.

## AI Provider

Usa la arquitectura de SPEC 018.4 y SPEC 018.4-B.

Reglas:

- OpenAI es proveedor principal si esta configurado.
- Anthropic puede quedar como alternativa si ya existe.
- Mock debe funcionar para tests.
- No hardcodees claves.
- No hagas llamadas reales en tests.

Variables recomendadas:

```text
AI_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=
MAX_SYLLABUS_INDEX_INPUT_CHARS=50000
MAX_SYLLABUS_TOPICS=100
```

Actualiza `.env.example`.

## Structured AI Output

La IA debe devolver JSON estructurado o equivalente validable.

Estructura conceptual:

```ts
type AISyllabusIndexOutput = {
  title: string
  summary: string
  topics: AISyllabusTopicNode[]
  materialSuggestions: AIMaterialTopicSuggestion[]
  examPatternSummary?: AIExamPatternSummary[]
  unclassifiedMaterials?: string[]
  warnings?: string[]
}

type AISyllabusTopicNode = {
  title: string
  description?: string
  code?: string
  order: number
  confidence?: number
  sourceMaterialIds?: string[]
  sourceReferences?: string[]
  children?: AISyllabusTopicNode[]
  warnings?: string[]
}
```

Valida la salida antes de guardarla.

Rechaza salida incompleta, temas sin titulo, referencias a materiales inexistentes o estructuras que excedan limites.

## Generation Rules

La IA debe:

- Usar solo materiales proporcionados.
- No inventar temas sin base.
- Proponer temas claros y estudiables.
- Evitar temas excesivamente amplios.
- Evitar temas duplicados.
- Respetar nombres de carpetas si vienen de ZIP.
- Usar titulos comprensibles.
- Indicar materiales fuente de cada tema.
- Marcar dudas con warnings.
- Separar temas y subtemas de forma razonable.
- Tener en cuenta tests antiguos como senal de cobertura, no como unica fuente.
- No generar preguntas.

## Prompt

Crear:

```text
/prompts/syllabus-index-builder.md
```

Debe incluir:

```text
# TESTOPO Syllabus Index Builder Prompt

Eres un asistente especializado en organizar temarios de oposiciones.

Tu tarea es analizar el material proporcionado y proponer un indice de temas y subtemas.

Reglas obligatorias:
1. Usa unicamente el material proporcionado.
2. No inventes temas sin base textual.
3. Diferencia entre material de temario y tests/examenes anteriores.
4. Usa tests antiguos para detectar estilo, cobertura y dificultad, no para copiar preguntas.
5. Propon un indice claro, estudiable y revisable.
6. Indica que materiales respaldan cada tema.
7. Marca como dudosos los temas con poca evidencia.
8. No generes preguntas.
9. No apruebes el indice automaticamente.
10. Devuelve salida estructurada compatible con TESTOPO.

La propuesta debe poder ser revisada por un humano antes de aplicarse.
```

## Main Flow

Implementa:

1. Admin/owner selecciona oposicion.
2. Desde Temario aparece accion "Crear indice con IA" o "Analizar material y proponer temario".
3. Admin selecciona materiales:
   - Todo material activo.
   - Materiales seleccionados.
   - Solo lote/ZIP concreto.
   - Solo materiales sin tema.
4. IA genera propuesta estructurada.
5. Admin revisa propuesta.
6. Admin puede editar, anadir, eliminar, aceptar, rechazar y ordenar nodos.
7. Admin aprueba propuesta.
8. Solo despues puede aplicarla al Topic Map.
9. Al aplicar, se crean/reutilizan temas y asociaciones material-tema.

## Applying To Topic Map

Al aplicar una propuesta aprobada:

- Crear temas que no existan.
- Crear subtemas con `parent_id`.
- Mantener orden.
- Asociar materiales a temas.
- No duplicar temas existentes bajo el mismo padre.
- Si existe un tema con mismo titulo bajo mismo padre, reutilizarlo.
- No borrar temas existentes automaticamente.
- No sobrescribir temas existentes sin confirmacion.

Material sin clasificar:

- Marcarlo como `unclassified`.
- Crear/reutilizar "Material sin clasificar" solo si el admin lo confirma.

## Permissions

Puede crear/aprobar/aplicar indice:

- owner.
- admin.
- usuario Premium individual owner de workspace personal.

No puede:

- student.

Usa `PlatformService` o la fachada de permisos existente para exponer operaciones sensibles.

## Limits

Configurable:

- Maximo materiales por analisis.
- Maximo caracteres por analisis.
- Maximo temas propuestos: 100.
- Maximo profundidad de arbol: 4 niveles.

Si hay demasiado material:

- Limitar texto.
- Pedir seleccion.
- Analizar por lotes.
- Mostrar warning claro.

No uses embeddings ni RAG avanzado.

## Errors

Errores recomendados:

- `SYLLABUS_INDEX_ACCESS_DENIED`
- `SYLLABUS_INDEX_OPPOSITION_REQUIRED`
- `SYLLABUS_INDEX_OPPOSITION_NOT_FOUND`
- `SYLLABUS_INDEX_NO_MATERIALS`
- `SYLLABUS_INDEX_NO_EXTRACTED_TEXT`
- `SYLLABUS_INDEX_TOO_MUCH_INPUT`
- `SYLLABUS_INDEX_PROVIDER_NOT_CONFIGURED`
- `SYLLABUS_INDEX_GENERATION_FAILED`
- `SYLLABUS_INDEX_INVALID_OUTPUT`
- `SYLLABUS_INDEX_PROPOSAL_NOT_FOUND`
- `SYLLABUS_INDEX_PROPOSAL_ALREADY_APPLIED`
- `SYLLABUS_INDEX_APPROVAL_REQUIRED`
- `SYLLABUS_INDEX_APPLY_FAILED`
- `SYLLABUS_INDEX_TOPIC_DUPLICATE_SKIPPED`

## Required Tests

Deben existir tests para:

- Admin puede crear propuesta de indice.
- Student no puede crear propuesta de indice.
- La IA no genera preguntas en esta spec.
- Material sin texto extraido se ignora o se reporta.
- La salida IA incompleta se rechaza.
- Se crea `SyllabusIndexRun`.
- Se crea `SyllabusIndexProposal`.
- Se crean nodos propuestos.
- Se crean sugerencias material-tema.
- Se detectan materiales sin clasificar.
- Tests antiguos se tratan como contexto, no como preguntas validadas.
- Una propuesta no se aplica sin aprobacion.
- Una propuesta aprobada puede aplicarse al Topic Map.
- Al aplicar, se crean temas y subtemas.
- No se duplican temas con mismo titulo bajo mismo padre.
- No se borran temas existentes automaticamente.
- Materiales quedan asociados a temas aceptados.
- Mock provider funciona sin API externa.
- No se rompe la generacion de preguntas existente.
- No se rompe la revision humana.
- No se rompe Student Portal.

Ejecuta tambien tests/build existentes.

## PR Expectations

En la descripcion del PR incluye:

- Resumen del flujo de indice con IA.
- Modelos y repositorios creados.
- Estado del proveedor IA usado.
- Confirmacion de que no se generan preguntas en esta spec.
- Confirmacion de que no se aplica indice sin aprobacion humana.
- Confirmacion de que no se implemento OCR, RAG avanzado ni embeddings.
- Tests/checks ejecutados.
- Riesgos o limites pendientes.

## Acceptance Criteria

- Existe flujo para crear indice con IA desde materiales de una oposicion.
- La IA analiza temario, apuntes, leyes y tests antiguos.
- La IA propone temas y subtemas.
- La IA sugiere asociaciones material-tema.
- La IA detecta materiales no clasificables.
- La propuesta queda pendiente de revision humana.
- El admin puede editar la propuesta.
- El admin puede aprobar la propuesta.
- Solo una propuesta aprobada puede aplicarse al Topic Map.
- Al aplicar, se crean temas/subtemas reales.
- Los materiales quedan asociados al tema correspondiente.
- No se generan preguntas automaticamente.
- No se implementa RAG avanzado.
- No se implementan embeddings.
- No se implementa OCR.
- El mock provider permite tests.
- Los tests existentes siguen pasando.

