# SPEC 019 - AI Syllabus Index Builder

## 1. Objetivo

Implementar un sistema para que TESTOPO pueda analizar el material subido a una oposicion y proponer automaticamente un indice de temario.

La IA debe ayudar a organizar el contenido, pero no debe decidir de forma definitiva sin revision humana.

Flujo deseado:

```text
Material subido
  -> Texto extraido
  -> IA analiza temario, apuntes, leyes y tests anteriores
  -> IA propone indice de temas y subtemas
  -> Admin/owner revisa, edita y aprueba
  -> El indice aprobado se convierte en Topic Map
  -> La generacion de preguntas usa ese Topic Map
```

## 2. Cambio De Numeracion

Esta spec pasa a ser:

```text
SPEC 019 - AI Syllabus Index Builder
```

La spec prevista anteriormente como:

```text
Supabase Repositories: Profiles & Workspaces
```

debe pasar a:

```text
SPEC 020 - Supabase Repositories: Profiles & Workspaces
```

No existe todavia un archivo local `019` de Supabase en `docs/specs` en el momento de crear esta spec. Si aparece en otra rama o PR, debe renumerarse conceptualmente a SPEC 020 antes de continuar.

## 3. Contexto

TESTOPO permite subir materiales como:

- PDFs.
- Apuntes.
- Leyes.
- Temario oficial.
- Tests antiguos.
- Examenes oficiales.
- Archivos TXT/MD.
- ZIPs con carpetas y documentos.

El problema es que una oposicion puede tener muchisimo material. El usuario no deberia estar obligado a crear todo el indice manualmente desde cero.

La app debe poder proponer una estructura inicial inteligente.

## 4. Branch

```text
feature/ai-syllabus-index-builder
```

## 5. Principio Central

La IA no crea el temario definitivo.

La IA solo propone.

Correcto:

```text
IA propone indice
  -> Admin revisa
  -> Admin edita
  -> Admin aprueba
  -> Se crea Topic Map
```

Incorrecto:

```text
IA crea indice definitivo automaticamente
  -> La app genera preguntas sin revision
```

## 6. Alcance

Claude debe implementar:

- Analisis de materiales de una oposicion.
- Seleccion de materiales a analizar.
- Propuesta de indice con temas y subtemas.
- Identificacion de materiales asociados a cada tema.
- Deteccion de materiales sin clasificar.
- Deteccion de posibles duplicados tematicos.
- Analisis basico de tests antiguos/examenes oficiales.
- Registro de una ejecucion de analisis.
- Pantalla o flujo de revision del indice propuesto.
- Edicion humana del indice propuesto.
- Aprobacion humana del indice.
- Conversion del indice aprobado en Topic Map.
- Proveedor IA compatible con la arquitectura de SPEC 018.4 y 018.4-B.
- Modo mock para tests.
- Tests criticos.

## 7. Fuera De Alcance

No implementar todavia:

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

## 8. Materiales Que Puede Analizar

La IA debe poder analizar materiales con texto disponible.

Tipos relevantes:

- `syllabus`
- `notes`
- `law`
- `old_test`
- `official_exam`
- `other`

Debe priorizar:

- Temario oficial.
- Leyes.
- Apuntes estructurados.
- Tests antiguos.
- Examenes oficiales.

Si un PDF no tiene texto extraido, debe ignorarse o marcarse como no analizable.

No implementar OCR en esta spec.

## 9. Diferencia Entre Material De Temario Y Test Antiguo

La app debe tratar los tests antiguos/examenes oficiales como una fuente especial.

### Material De Temario

Sirve para detectar:

- Temas.
- Subtemas.
- Conceptos.
- Normativa.
- Bloques de contenido.

### Tests Antiguos O Examenes Oficiales

Sirven para detectar:

- Estilo de pregunta.
- Nivel de dificultad.
- Temas mas preguntados.
- Forma habitual de redactar preguntas.
- Patrones de opciones.
- Cobertura aproximada del examen.

Pero no deben copiarse automaticamente como preguntas nuevas sin control.

## 10. Flujo Principal

### 10.1 Seleccionar Oposicion

El admin/owner entra en una oposicion.

### 10.2 Ir A Temario

Desde la zona de Temario, debe existir una accion:

```text
Crear indice con IA
```

o:

```text
Analizar material y proponer temario
```

### 10.3 Seleccionar Materiales

La app debe permitir:

- Analizar todo el material activo.
- Analizar materiales seleccionados.
- Analizar solo un ZIP/lote concreto.
- Analizar solo materiales sin tema.

### 10.4 Generar Propuesta

La IA genera una propuesta de indice.

### 10.5 Revisar Propuesta

El admin puede:

- Editar titulos.
- Anadir temas.
- Eliminar temas propuestos.
- Mover subtemas.
- Fusionar duplicados si es sencillo.
- Cambiar orden.
- Asociar/desasociar materiales.
- Marcar un material como sin clasificar.

### 10.6 Aprobar Propuesta

Al aprobar, se crea o actualiza el Topic Map.

### 10.7 Usar Topic Map

Despues, la generacion de preguntas podra usar ese indice.

## 11. Modelo `SyllabusIndexRun`

Crear modelo o entidad equivalente.

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

## 12. Modelo `SyllabusIndexProposal`

Crear modelo o entidad equivalente.

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

- Una propuesta `draft` o `pending_review` puede editarse.
- Una propuesta `approved` puede aplicarse al Topic Map.
- Una propuesta `applied` ya fue convertida en temas reales.
- Una propuesta `rejected` no debe aplicarse.

## 13. Modelo `SyllabusIndexNodeProposal`

Representa cada tema o subtema propuesto.

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

`confidence` es opcional entre `0` y `1`.

No debe usarse como aprobacion automatica.

## 14. Modelo `MaterialTopicSuggestion`

Representa la sugerencia de asociacion entre material y tema.

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

## 15. Analisis De Examenes Anteriores

Opcionalmente crear modelo `ExamPatternSummary` o incluirlo dentro de `SyllabusIndexRun`.

Campos recomendados:

- `id`
- `run_id`
- `material_id`
- `detected_question_count`
- `detected_topics`
- `difficulty_notes`
- `style_notes`
- `warnings`
- `created_at`
- `updated_at`

El analisis de examenes antiguos debe servir como contexto, no como banco automatico de preguntas.

Ejemplos de salida util:

- El examen antiguo contiene muchas preguntas sobre plazos administrativos.
- El estilo habitual es pregunta directa con cuatro opciones.
- Hay preguntas recurrentes sobre derechos fundamentales.

## 16. Salida Estructurada De IA

La IA debe devolver un JSON estructurado o equivalente validable.

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

La salida debe validarse antes de guardarse.

## 17. Reglas De Generacion Del Indice

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

## 18. Prompt Base

Crear:

```text
/prompts/syllabus-index-builder.md
```

Contenido recomendado:

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

## 19. Revision Humana Del Indice

La pantalla de revision debe permitir al admin/owner:

- Ver indice propuesto.
- Ver materiales usados.
- Ver materiales no analizados.
- Ver materiales sin clasificar.
- Editar tema.
- Editar subtema.
- Eliminar tema propuesto.
- Aceptar tema.
- Rechazar tema.
- Mover tema.
- Fusionar temas duplicados si es sencillo.
- Aprobar propuesta completa.
- Aplicar propuesta al Topic Map.

Si fusionar temas complica demasiado, dejarlo como accion futura y permitir eliminar/editar manualmente.

## 20. Aplicacion Al Topic Map

Al aplicar una propuesta aprobada:

- Crear temas que no existan.
- Crear subtemas con `parent_id`.
- Mantener orden.
- Asociar materiales a temas.
- No duplicar temas existentes bajo el mismo padre.
- Si existe un tema con mismo titulo bajo mismo padre, reutilizarlo.
- No borrar temas existentes automaticamente.
- No sobrescribir temas existentes sin confirmacion.

## 21. Material Sin Clasificar

Si la IA no sabe asociar un material, debe marcarlo como:

```text
Material sin clasificar
```

Opciones:

- Asociarlo a un tema automatico.
- O dejarlo pendiente de clasificacion.

Recomendacion MVP:

- Crear o reutilizar un tema "Material sin clasificar" solo si el admin lo confirma.

## 22. Integracion Con Generacion De Preguntas

Esta spec no genera preguntas.

Pero debe dejar preparado el flujo para que despues:

```text
Tema aprobado
  -> Material asociado
  -> IA genera preguntas desde ese tema/material
  -> Preguntas quedan pending_review
```

## 23. Permisos

Puede crear indice con IA:

- `owner`
- `admin`
- Usuario Premium individual si es owner de su workspace personal.

No puede:

- `student`

## 24. Variables De Entorno

Usar la configuracion IA existente de SPEC 018.4-B.

Ejemplo:

```text
AI_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=
MAX_SYLLABUS_INDEX_INPUT_CHARS=50000
MAX_SYLLABUS_TOPICS=100
```

Actualizar `.env.example`.

Mantener proveedor mock para tests.

## 25. Limites Recomendados

Para MVP:

- Maximo materiales por analisis: configurable.
- Maximo caracteres por analisis: configurable.
- Maximo temas propuestos: 100.
- Maximo profundidad del arbol: 4 niveles.

Si hay demasiado material, la app debe:

- Limitar texto.
- Pedir seleccion de materiales.
- Analizar por lotes.
- Mostrar warning claro.

No implementar todavia procesamiento avanzado con embeddings.

## 26. Mensajes De Usuario

Ejemplos:

- La IA ha propuesto un indice de temario pendiente de revision.
- Se han detectado 12 temas y 37 subtemas.
- Algunos materiales no pudieron analizarse porque no tienen texto extraido.
- Hay materiales que la IA no ha podido clasificar con seguridad.
- El indice se ha aplicado al temario correctamente.

## 27. Errores Recomendados

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

## 28. Tests Obligatorios

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

## 29. Criterios De Aceptacion

La tarea se considera completada cuando:

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

