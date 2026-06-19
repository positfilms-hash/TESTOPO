# Referencias de fuente (SPEC 028-C)

Una `SourceReference` apunta a una **fuente concreta** dentro de un material: una
sección, un rango de páginas o un fragmento. Es la pieza que usarán specs
posteriores para decir *"este tema sale de esta página"* o *"esta pregunta sale de
este fragmento"*. En esta spec **solo se preparan**: no se asocian todavía a
preguntas ni a índice.

## Fuente vs referencia

- **Fuente**: el material y su sección (`material_sections`, SPEC 028-C) — el
  contenido real.
- **Referencia** (`source_references`): un puntero ligero a esa fuente, con la
  etiqueta y el extracto necesarios para citarla sin cargar todo el texto.

## Campos

`material_id`, `material_section_id`, `reference_type`, `label`, `page_start`/
`page_end`, `source_excerpt`, `confidence`.

- **`reference_type`**: `material_section` · `page_range` · `excerpt` · `manual` ·
  `ai_suggested`. En esta spec se usa principalmente `material_section`.
- **`page_start`/`page_end`**: rango de páginas si se conoce. Hoy quedan `null`
  porque el extractor no conserva páginas (ver
  [material-sections.md](./material-sections.md)); un extractor que las preserve
  los rellenaría.
- **`content_excerpt` / `source_excerpt`**: fragmento corto para mostrar la cita en
  la UI o pasarlo como contexto a la IA, sin cargar la sección entera.

## Cómo se crean

Al crear las secciones de un material (`createMaterialSections`), el facade prepara
automáticamente **una `SourceReference` `material_section` por sección**
(`SourceReferenceService.createFromSection`): `label = section_title`,
`source_excerpt = content_excerpt`, apuntando a `material_id` + `material_section_id`.

`listByMaterial` / `listBySection` permiten recuperarlas.

## Cómo servirá a índice y preguntas (specs futuras)

- **028-D (índice)**: cada nodo de temario propuesto podrá citar las referencias de
  las secciones que lo respaldan (de qué material y fragmento sale).
- **028-E (generación con fuente)**: cada pregunta generada podrá apoyarse en una
  `SourceReference` concreta (página/sección/fragmento), de modo que la explicación
  cite su origen y la revisión humana pueda verificarlo.

Nada de esto se implementa aquí: 028-C solo deja las referencias preparadas.

## Seguridad

`source_references` tiene **RLS de solo gestión** (`can_manage_workspace`); el
alumno no accede. Sin `service_role` en frontend. Scope por workspace/oposición; no
se cruzan.
