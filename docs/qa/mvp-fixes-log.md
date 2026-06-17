# MVP Fixes Log (SPEC 016)

Registro de correcciones y pulido del MVP tras el plan de QA (SPEC 015).
Cada entrada documenta un fallo corregido. No se añade funcionalidad nueva.

## Resultado de la revisión de QA

Se revisaron los flujos de `mvp-manual-test-plan.md` y la checklist
(`mvp-checklist.md`) sobre el código actual (SPEC 001-015):

- **Prioridad 1 (bloqueantes/seguridad):** sin hallazgos. El control de acceso
  vive en `PlatformService` y servicios de dominio (gestión por rol de
  workspace, material activo para el estudiante, tests solo con preguntas
  `validated`, resultados propios). Cubierto por la suite de backend
  (216 tests) incluyendo `platformAccess`, `studentPortal` y `zoneSeparation`.
- **Prioridad 2 (funcionales):** sin hallazgos nuevos; los flujos admin y
  student funcionan de punta a punta.
- **Prioridad 3 (UX/idioma):** se detectaron **fugas de etiquetas internas en
  inglés** hacia la interfaz (incumplía SPEC 016 §9.5). Corregidas.
- **Prioridad 4 (visual):** ajuste menor de consistencia de etiquetas.

---

## Bug corregido

### Resumen
La interfaz mostraba valores internos en inglés en varios sitios: estados de
extracción de PDF (`completed`, `failed`, `not_supported`, `processing`,
`not_started`), estados de test (`created`, `in_progress`, `cancelled`),
estado de acceso de alumno (`revoked`, `pending`) y estados de workspace
(`suspended`, `archived`), además de la **dificultad** de las preguntas
(`easy`/`medium`/`hard`) en la pantalla de Preguntas.

### Gravedad
Media (UX / claridad, SPEC 016 §9.5).

### Área afectada
UX — Material (PDF), Tests, Alumnos, Preguntas, Resultados.

### Causa
El componente `Badge` traducía estados con un mapa `STATUS_LABELS` **incompleto**
y caía a mostrar el valor crudo (`status` en inglés con guiones bajos) para los
estados no contemplados. La dificultad se renderizaba directamente con su valor
interno en inglés en `QuestionsPage`.

### Solución
- Se completó `STATUS_LABELS` en `app/frontend/src/components/ui.tsx` con todos
  los estados que pueden mostrarse (preguntas, material, extracción, tests,
  acceso, workspace) y se añadió un *fallback* `humanize()` que elimina guiones
  bajos y capitaliza, para que **nunca** se filtre un valor técnico crudo.
- Se expusieron helpers reutilizables `statusLabel()` y `difficultyLabel()`.
- `QuestionsPage` y `AttemptResultView` usan ahora `difficultyLabel()`
  (se eliminó un mapa duplicado en `AttemptResultView`).

### Test añadido
Sí — `app/frontend/tests/labels.test.ts`: fija las etiquetas en español de
estados y dificultad, verifica que no se filtra `snake_case` ni el valor crudo
de estados conocidos, y comprueba el *fallback* humanizado para estados
desconocidos.

---

## Verificación final

- `cd app/backend && npm run typecheck` — sin errores.
- `cd app/backend && npm test` — 216 tests en verde (sin cambios de backend).
- `cd app/frontend && npm run build` — OK.
- `cd app/frontend && npm test` — smoke + nuevas pruebas de etiquetas en verde.

No se rompió ninguna spec anterior (001-015) y no se añadió alcance fuera del MVP.
