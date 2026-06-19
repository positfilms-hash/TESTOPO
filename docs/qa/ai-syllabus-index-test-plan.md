# Plan de pruebas manuales - AI Syllabus Index (SPEC 028-D)

Pruebas manuales del índice anclado a documentos, tras los tests automáticos
(`app/backend/tests/syllabusIndexFromDocuments.test.ts`). Usa **datos ficticios**.
La revisión visual/Playwright la ejecuta Codex.

## Preparación

- Login como admin/owner con una oposición ficticia.
- Tener documentos **clasificados** (028-B) y **seccionados** (028-C): al menos un
  temario y/o ley de estudio, y opcionalmente un examen antiguo.

> El índice (runs/propuestas) corre **InMemory** (paridad con SPEC 019); para QA
> funcional el modo demo (`memory`) es suficiente. La migración Supabase del índice
> está diferida a una spec futura.

## Casos

| # | Caso | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| 1 | Proponer | Temario → "Crear índice con IA" → Analizar | Propuesta `pending_review` con temas y **fuentes** por nodo |
| 2 | Solo exámenes | Con solo tests antiguos (sin primario seccionado) → Analizar | Aviso: no hay primarios; no se proponen temas |
| 3 | Exámenes secundarios | Con temario + examen → Analizar | Los temas salen del temario; el examen no es fuente; aviso de contexto |
| 4 | Dudoso corregido | Corregir un `ambiguous` a "Temario", seccionar → Analizar | Ese documento entra como fuente |
| 5 | Confianza/fuentes | Revisar la propuesta | Cada nodo muestra confianza y de qué documento/fragmento sale |
| 6 | Editar/aceptar/rechazar | Editar título, aceptar/rechazar nodos | Cambios reflejados |
| 7 | Aprobar | Aprobar propuesta | Se habilita "Aplicar"; antes estaba deshabilitado |
| 8 | Aplicar | Aplicar al temario | Temas creados + fuentes registradas; sin preguntas ni tests |
| 9 | Reaplicar | Volver a proponer/aprobar/aplicar | Reutiliza temas existentes, no duplica (avisa) |
| 10 | Permisos student | Login como alumno | No ve el panel ni propuestas/fuentes/warnings |
| 11 | No cruce | Gestor de otra oposición/workspace | No puede proponer/ver propuestas ajenas |

## Checklist de seguridad

- [ ] El alumno no ve runs/propuestas/nodos/fuentes/warnings ni la UI de revisión.
- [ ] Nada se aplica ni publica al alumno automáticamente.
- [ ] No se generan preguntas ni tests; sin OCR/RAG/embeddings.
- [ ] Sin `VITE_SUPABASE_SERVICE_ROLE_KEY` en frontend; mock sin llamadas externas.
- [ ] Aislamiento por workspace + oposición (guards del facade).

## Nota de persistencia

El índice es **InMemory** en esta spec (paridad SPEC 019). La RLS de Supabase para
el índice llegará con la migración diferida; hasta entonces el aislamiento es por
guards de aplicación (ya verificados en los tests de permisos).
