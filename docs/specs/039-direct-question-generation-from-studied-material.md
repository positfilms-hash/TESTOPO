# SPEC 039 — Direct Question Generation from Studied Material

**Estado:** propuesta de implementación  
**Rama:** `feature/direct-question-generation-from-studied-material`  
**Depende de:** SPEC 038 (material estudiado internamente) y las garantías de seguridad de SPEC 033/034/035/036.  
**No sustituye:** la generación histórica por tema puede mantenerse por compatibilidad, pero deja de ser el flujo principal.

## Decisión de producto

El flujo principal de generación deja de depender de un índice visible, de aplicar un temario o de un `topic_id`.

```text
Material leído/OCR
  -> Estudiar material (SPEC 038)
  -> unidades, conceptos y referencias internas trazables
  -> Generar preguntas desde material estudiado (esta SPEC)
  -> candidatas para revisión humana
```

Los elementos de temario que existan son opcionales y no pueden bloquear este flujo. Las correcciones fallidas centradas en índice visible (035–037, cuando aplique) no son una base para esta implementación. Las garantías de secretos, autenticación y rehidratación de las SPEC previas siguen vigentes.

## Objetivo

Permitir que un gestor autorizado genere candidatas de pregunta directamente desde material previamente estudiado. Cada candidata debe tener evidencia factual concreta, explicación y una única opción correcta; queda lista para revisión humana, nunca validada automáticamente.

## Alcance

### Nuevo endpoint autenticado

Crear una Edge Function independiente: `generate-questions-from-studied-material`.

No modificar el contrato de `generate-questions` para forzar compatibilidad con temas. El nuevo endpoint acepta solo un alcance estructurado:

```json
{
  "workspace_id": "uuid",
  "opposition_id": "uuid",
  "material_study_run_id": "uuid opcional",
  "scope": "all_studied_material | selected_materials | selected_units | selected_concepts",
  "material_ids": ["uuid"],
  "material_study_unit_ids": ["uuid"],
  "material_study_concept_ids": ["uuid"],
  "question_count": 5,
  "difficulty": "easy | medium | hard | mixed"
}
```

Los arrays solo son válidos cuando correspondan a `scope`; tienen límites pequeños y se validan contra datos existentes. El cliente **no** puede enviar texto fuente, extractos, prompt, URLs arbitrarias, IDs de usuario, claves ni una respuesta correcta propuesta.

### Autorización y selección de evidencia (servidor)

Antes de cualquier llamada al proveedor, la función debe:

1. Validar JWT y obtener el usuario en servidor.
2. Comprobar acceso de gestión al workspace y oposición (Admin/Teacher/gestor autorizado según la política existente). Student, usuarios revocados o de otro scope reciben error de autorización.
3. Verificar que la oposición pertenece al workspace y que todos los IDs seleccionados pertenecen al mismo scope.
4. Exigir un estudio de material completado o completado con avisos, y materiales elegibles/estudiados.
5. Resolver la evidencia exclusivamente desde `material_study_units`, `material_study_concepts`, `material_sections` y/o `source_references` existentes y trazables.
6. Excluir material fallido, obsoleto, OCR fallido, evidencia ambigua o referencias sin texto utilizable.
7. Fallar de forma clara sin crear preguntas si no queda evidencia factual suficiente.

Los exámenes o preguntas antiguas pueden orientar el estilo, nunca ser la fuente factual principal. No se usa un `topic_id` como requisito. Para compatibilidad con controles históricos de calidad, una candidata puede conservar un campo descriptivo de tema derivado de la unidad/concepto; `topic_id` permanece nulo en el flujo directo.

### IA y secretos

La llamada real a IA ocurre únicamente en la Edge Function. La función reutiliza exclusivamente secretos/configuración de servidor aprobados (`AI_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL` o equivalente) y límites explícitos de preguntas, caracteres, tokens, coste y timeout.

No incluir claves, nombres de modelos hardcodeados, ni proveedores privados en frontend, repositorio, logs, respuestas HTTP o documentación con valores reales. Si no hay proveedor/configuración compatible, devolver un bloqueo honesto (por ejemplo, `501`) y no escribir mocks, runs engañosos ni candidatas simuladas en staging/producción.

### Persistencia y trazabilidad

Implementar solo la migración mínima necesaria para enlazar el run y la pregunta con el estudio/unidad/concepto, sin migraciones destructivas ni cambios amplios de RLS.

Cada candidata persistida debe contener:

- enunciado;
- opciones estructuradas y exactamente una correcta;
- explicación;
- dificultad;
- `material_id` y un puntero concreto a unidad estudiada, sección o referencia;
- extracto fuente limitado que corresponda a ese puntero, no a una bolsa global de texto;
- metadatos del run/proveedor necesarios para auditarla.

Aplicar validación estructural y de trazabilidad por candidata. Las candidatas incompletas se descartan o se guardan como `needs_fix`; las aptas se guardan como `pending_review`. Ninguna ruta de esta SPEC puede escribir `validated`, publicar preguntas ni crear un test automático. El generador de tests continúa usando exclusivamente preguntas ya validadas por humanos.

### Frontend

En Material/Análisis, después de que exista material estudiado, mostrar el flujo principal **Generar preguntas** con selector de material/alcance, cantidad y dificultad. No pedir un tema, índice ni identificador técnico al usuario. Mostrar:

- estado honesto mientras se prepara/genera;
- bloqueo comprensible cuando no hay estudio, fuentes utilizables, proveedor o permisos;
- resumen de candidatas creadas y enlace a revisión humana.

Student no ve controles de generación, runs internos, fuentes internas ni candidatas. El frontend solo invoca la función autenticada con el contrato reducido anterior.

### Fallback local

Mantener el fallback InMemory para desarrollo/pruebas locales de forma explícita y separada. Nunca debe aparentar generación real, ni activarse en staging/producción.

## Fuera de alcance

- Embeddings, RAG avanzado o fine-tuning.
- Métricas avanzadas, dashboard de fiabilidad, pagos, ranking o gamificación.
- Generación automática de tests finales para Student.
- OCR, clasificación, estudio de material o índice visible (son responsabilidades de otras SPEC).
- Cambios grandes de Auth, RLS o permisos.

## Criterios de aceptación

1. Un gestor con material estudiado puede generar candidatas sin crear/aplicar/validar un índice y sin `topic_id` obligatorio.
2. La Edge Function valida JWT, usuario, workspace, oposición, estudio, selección y evidencia antes de llamar a IA.
3. El cliente no puede enviar texto arbitrario ni suplantar material/fuentes de otro scope.
4. Cada candidata tiene evidencia concreta, extracto coherente, explicación y una sola respuesta correcta.
5. Todas las candidatas quedan `pending_review` o `needs_fix`; ninguna queda `validated` ni pasa a test automáticamente.
6. Student y accesos cross-workspace/cross-opposition son rechazados y no pueden listar internas.
7. Sin proveedor o sin evidencia, el bloqueo es honesto y no deja filas mock/simuladas en staging/producción.
8. La generación histórica por tema, si permanece, no bloquea ni se invoca desde el nuevo flujo principal.
9. Tests backend/frontend cubren positivo, no-provider, sin estudio/fuentes, selección cruzada, Student y la invariante de no-validación.
10. Build pasa y el smoke visual desktop (1366×900) y móvil (390×844) no revela regresiones.

## Entregables de implementación

- Edge Function y contrato tipado para generación desde material estudiado.
- Migración mínima y pruebas asociadas.
- UI de generación directa y revisión enlazada.
- `docs/architecture/direct-question-generation-from-studied-material.md`.
- `docs/user-guides/generate-questions-from-material.md`.
- `docs/qa/direct-question-generation-from-studied-material-test-plan.md`.
- Actualización honesta del runbook de staging, sin declarar PASS hasta ejecutar el smoke real.
