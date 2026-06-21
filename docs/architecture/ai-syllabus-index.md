# Índice de temario con IA, anclado a documentos (SPEC 028-D)

Cierra la serie de ingestión: a partir de los **documentos clasificados** (SPEC
028-B) y sus **secciones/fragmentos** (SPEC 028-C), la IA propone un **índice de
temas y subtemas con fuentes concretas**, que un gestor revisa, aprueba y aplica
explícitamente al Topic Map. La IA **solo organiza evidencia**: no escribe
temario, no inventa temas, no genera preguntas ni tests. Sin OCR/RAG/embeddings.
Nada se aplica ni se publica al alumno automáticamente.

## Pipeline

```text
Documentos clasificados (028-B) + secciones/fuentes (028-C)
  -> Seleccion de fuentes elegibles (primarias / secundarias)
  -> Proveedor IA propone temas/subtemas CON fuentes (material/seccion/referencia)
  -> Validacion estricta de la salida
  -> Propuesta (pending_review) + node sources
  -> Revision humana (editar/aceptar/rechazar) -> aprobar
  -> Aplicar -> crea/reutiliza temas + topic-source references
```

Reutiliza el subsistema de SPEC 019 (`SyllabusIndexRun/Proposal/NodeProposal`,
`SyllabusIndexRepository`, `SyllabusIndexService` para el ciclo de revisión,
`SyllabusIndexPanel`) y lo conecta a las capas 028-B/028-C.

## Reglas de fuentes

- **Primarias** (pueden originar un tema): `syllabus_material`, `legal_text`,
  `notes_or_summary`, `index_or_table_of_contents` — material `active`, con texto
  extraído y **con secciones**.
- **Secundarias** (solo contexto de cobertura/estilo, **nunca** fuente única de un
  tema): `old_exam_or_test`.
- **Excluidas**: `irrelevant`, `not_analyzable`, obsoletos y `ambiguous` — salvo
  que una **corrección humana** los haya reclasificado a una clase primaria.
- Cada **tema raíz** necesita ≥ 1 fuente primaria; un subtema, fuente propia o
  heredada del padre. Todo material/sección/referencia se valida y se sella al
  mismo workspace + oposición.

## Modelos (nuevos)

- **`SyllabusIndexNodeSource`**: enlaza un nodo propuesto con su fuente concreta
  (material + sección + referencia, excerpt, confianza, `is_primary`, scope).
- **`TopicSourceReference`**: para temas **ya aplicados** — de qué material/
  sección/fragmento salió cada tema del Topic Map.

## Validación de la salida del proveedor

`validateGroundedOutput` rechaza: nodos sin fuentes, fuentes **ajenas/inexistentes**,
raíces **sin fuente primaria**, nodos cuya única fuente es un examen, y **contenido
prohibido** (opciones de test, textos largos = temario escrito). Si la salida es
inválida → el run queda **failed** con errores y **no se crea propuesta aplicable**.

## Aplicación

Solo una propuesta `approved` puede aplicarse. Aplicar **crea o reutiliza** temas
(sin borrar ni sobrescribir; avisa si ya existe el mismo título bajo el mismo
padre) y persiste un **`TopicSourceReference`** por tema desde sus node sources.
No crea preguntas ni tests.

## Permisos

Ven/gestionan propuestas: `owner`, `admin`, manager autorizado, premium owner en
workspace personal. El alumno **no** ve runs/propuestas/nodos/fuentes/warnings ni
la UI de revisión. Guards `requireManageOpposition`/`requireManageProposal` en el
facade. Aislamiento por workspace + oposición.

## Persistencia: migrado a Supabase (migración 030)

El dominio del índice (runs/propuestas/nodos/sugerencias/patrones + node sources
y topic source references de 028-D) **ya persiste en Supabase** vía
`SupabaseSyllabusIndexRepository`, seleccionado por el factory
`createCoreRepositories` (`core.syllabusIndex`) según el modo, con fallback
InMemory en modo `memory`/demo. Era el **último dominio del MVP que quedaba
InMemory**; lo cierra la migración `030_syllabus_index.sql` (7 tablas, RLS de
**solo gestión** — el alumno nunca ve el índice; scope derivado de la oposición
del padre run/propuesta/tema). Verificación de RLS: manual en staging. Histórico:
028-D mantuvo el índice InMemory porque las tablas de SPEC 019 no existían; esta
migración las crea (como se migraron 020-024).

## Proveedor IA

- `MockDocumentGroundedIndexProvider`: determinista, sin red (default/tests).
- `OpenAiDocumentGroundedIndexProvider`: real, JSON estructurado con fuentes.
- `createDocumentGroundedIndexProvider(env)` + `prompts/syllabus-index-from-classified-documents.md`.

## Mapa de código

| Capa | Archivo |
| --- | --- |
| Modelos | `app/backend/src/models/syllabusIndex.ts` (NodeSource, TopicSourceReference) |
| Proveedor | `app/backend/src/generation/documentGroundedIndex*` + `prompts/syllabus-index-from-classified-documents.md` |
| Servicio | `app/backend/src/service/syllabusIndexFromDocumentsService.ts` |
| Repo | `inMemorySyllabusIndexRepository.ts` (InMemory) + `supabase/supabaseSyllabusIndexRepository.ts` (Supabase, migración 030) vía `createCoreRepositories` |
| Facade | `platformService.ts` (`proposeSyllabusIndexFromDocuments`, `getSyllabusIndexProposalDetail`, `applySyllabusIndexFromDocuments`) |
| UI | `app/frontend/src/pages/SyllabusIndexPanel.tsx` |
| Tests | `app/backend/tests/syllabusIndexFromDocuments.test.ts` |

## Próximo

Con índice anclado a fuentes, la siguiente spec lógica es **028-E — Source-Grounded
Question Generation** (preguntas que citan su sección/fragmento). No se implementa
aquí.
