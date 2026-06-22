# Plan de pruebas manuales - Página de generación de temario (SPEC 032)

Pruebas manuales para validar la pantalla **Temario** simplificada contra staging,
tras los tests automáticos (`app/backend/tests/simplifiedSyllabusGeneration.test.ts`
y el smoke de `app/frontend/tests/smoke.test.tsx`). Usa siempre **datos ficticios**.
La revisión visual/Playwright la ejecuta Codex
([`codex-visual-review-runbook.md`](./codex-visual-review-runbook.md)).

> Arquitectura reusada: clasificación (028-B), secciones/fuentes (028-C) e índice
> anclado a documentos (028-D/019). La orquestación es
> `PlatformService.generateSyllabusForOpposition`. Ver
> [create-syllabus-index.md](../user-guides/create-syllabus-index.md).

## Preparación

- Login como admin/owner con una oposición ficticia **sin temario aplicado**.
- Tener a mano documentos ficticios: un temario con "Tema 1/Tema 2", una ley, un
  examen antiguo, y (si SPEC 030 está desplegada) un PDF escaneado leído con OCR.

> **Persistencia:** para validar contra Supabase real, arrancar con
> `npm run dev -- --mode staging`.

## Casos funcionales

| # | Caso | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| 1 | Sin material | Oposición nueva, entra en Temario | Mensaje "sube material primero" + **Ir a Material**; sin acción de generar |
| 2 | Material leyéndose | Sube un PDF y entra antes de que termine | Aviso "algunos archivos se están leyendo"; generar deshabilitado |
| 3 | Listo | Con material legible, Temario | **Generar temario** prominente + recuento "N documento(s) listo(s)" |
| 4 | Generar | Pulsa **Generar temario** | Progreso simple (*Analizando… · Generando…*); luego **Índice propuesto** con árbol, fuentes y confianza |
| 5 | Solo exámenes | Sube solo un examen antiguo y genera | No propone temas; mensaje claro (no usa exámenes como fuente principal) |
| 6 | OCR utilizable | Lee un escaneo con OCR en Material, genera | El documento OCR entra como fuente; la propuesta se crea |
| 7 | OCR con avisos | Documento `OCR con advertencias` | Entra, pero la revisión muestra un **aviso** no técnico de revisarlo |
| 8 | Revisar y aplicar | Edita/acepta/rechaza, **Aprobar**, **Aplicar al temario** | Crea temas con fuente; al volver, Temario muestra el árbol aplicado |
| 9 | No auto-aplica | Generar y NO aprobar | Ningún tema en el Topic Map hasta aprobar+aplicar |
| 10 | Regenerar | Con temario aplicado, **Regenerar temario** | Crea una propuesta NUEVA a revisar; no borra la anterior ni el árbol aplicado |
| 11 | Reaplicar seguro | Aplicar una propuesta con temas ya existentes | Reutiliza temas por nombre (sin duplicar); nunca borra el Topic Map |
| 12 | Permisos student | Login como alumno | No ve Temario ni la generación; solo el temario aplicado donde el producto lo permita |
| 13 | No cruce | Generar en oposición de otro workspace (API) | Denegado (AccessError) |
| 14 | Regresión Material | Subir/abrir/eliminar en Material | Material sigue siendo solo biblioteca; sin controles de índice/clasificación |

## Checklist de seguridad

- [ ] El alumno no inicia ni ve runs, propuestas, clasificaciones, fuentes,
      avisos ni errores internos.
- [ ] No se generan preguntas, tests ni contenido `validated` al generar el temario.
- [ ] Nada se aplica automáticamente; aplicar exige aprobación + clic humano.
- [ ] Regenerar/Reaplicar nunca borra el temario aplicado de forma silenciosa.
- [ ] Se respetan los límites de workspace/oposición, RLS Supabase y el fallback
      InMemory (mismos resultados de acceso).
- [ ] No hay nuevas tablas, migraciones ni cambios de esquema/RLS.

## Sin cambios de backend de persistencia

SPEC 032 **no** añade migraciones ni cambia repositorios/RLS. La única adición de
dominio es el método de orquestación `generateSyllabusForOpposition` (compone
servicios existentes) y la ampliación de la elegibilidad de extracción a texto de
**OCR** (`completed_ocr`/`completed_ocr_with_warnings`) en clasificación, secciones
e índice. Verificar en staging que un documento OCR fluye y que el material
`ocr_failed`/`not_supported`/obsoleto se excluye.
