# Plan de pruebas manuales - Source-Grounded Question Generation (SPEC 028-E)

Pruebas manuales tras los tests automáticos
(`app/backend/tests/sourceGroundedQuestionGeneration.test.ts`). Usa **datos
ficticios**. La revisión visual/Playwright la ejecuta Codex.

## Preparación

- Login como admin/owner con una oposición ficticia.
- Tener el flujo previo hecho: material **clasificado** (028-B) + **seccionado**
  (028-C) + **índice aplicado** (028-D), con al menos un tema con fuentes. Tener
  también algún examen antiguo (para el caso de contexto secundario).

> Para validar contra Supabase real, arrancar con `npm run dev -- --mode staging`.

## Casos

| # | Caso | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| 1 | Generar desde tema | Preguntas → Generar desde tema → elegir tema con fuentes → generar | Candidatas con fuente/excerpt en Pendientes de revisión |
| 2 | Trazabilidad | Revisar una candidata | Muestra material/fuente; estado `pending_review` o `needs_fix`, nunca `validated` |
| 3 | Preview de fuentes | Elegir distintos temas | Muestra nº de fuentes; "0 fuentes" en temas sin material seccionado |
| 4 | Sin fuentes | Tema sin material seccionado → generar | Mensaje claro; no se crea ninguna pregunta |
| 5 | Examen secundario | Tema con material + examen antiguo | El examen no es fuente; solo influye en estilo |
| 6 | Solo examen | Tema cuyo único material es un examen | No genera (examen no es fuente primaria) |
| 7 | Revisión | Aprobar una candidata | Pasa a `validated` solo tras aprobación humana |
| 8 | Test de alumno | Crear un test de estudiante | Usa solo preguntas `validated` (las candidatas no aparecen) |
| 9 | Permisos student | Login como alumno | No ve "Generar desde tema", ni candidatas, ni fuentes internas |
| 10 | No cruce | Gestor de otra oposición | No puede generar/inspeccionar fuentes ajenas |

## Checklist de seguridad

- [ ] Cada candidata persistida tiene tema, material, excerpt y al menos un puntero
      de fuente.
- [ ] Ninguna candidata nace `validated`; la validación automática no aprueba.
- [ ] El alumno no genera ni ve runs/candidatas/excerpts internos.
- [ ] Los tests de estudiante usan solo `validated`.
- [ ] Sin `VITE_SUPABASE_SERVICE_ROLE_KEY`; RLS de 023 intacta; mock sin red.
- [ ] Sin OCR/RAG/embeddings; sin copiar preguntas de exámenes antiguos.

## Verificación de la migración 028-E

- Aplicar `supabase/migrations/028_e_source_grounded_question_generation.sql`
  (runbook). Comprobar columnas nuevas en `questions`
  (`material_section_id`/`source_reference_id`/`topic_source_reference_id`) y
  `question_generation_runs` (`source_strategy`/`source_reference_ids`/
  `material_section_ids`). Re-ejecutar: idempotente.
