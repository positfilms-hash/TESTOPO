# TESTOPO Backend

Modulos funcionales del MVP:

- **Question Bank (SPEC 001):** modelo de pregunta, opciones y fuente, reglas de
  validacion obligatorias y operaciones minimas (crear, listar, ver, editar,
  cambiar estado).
- **Material Upload & Source Registry (SPEC 002):** registro de material de
  estudio (crear manual, registrar archivo, listar, ver, editar, cambiar
  estado, marcar obsoleto) y vinculo trazable entre material y la fuente de una
  pregunta.
- **Topic Map (SPEC 003):** mapa jerarquico del temario (temas y subtemas con
  validacion de ciclos), vinculacion de materiales a temas, asignacion de temas
  a preguntas y cobertura basica por tema.
- **Question Generation Drafts (SPEC 004):** generacion de borradores de
  preguntas desde material, fragmento o texto manual, mediante un proveedor
  desacoplado (mock en el MVP). Las preguntas generadas reutilizan el banco de
  preguntas y quedan en `draft` o `pending_review`, nunca en `validated`.

No incluye validacion automatica avanzada, generacion de tests finales,
simulacros, extraccion de indices, procesamiento avanzado de PDFs/DOCX, OCR,
preguntas multirrespuesta, usuarios, autenticacion, panel complejo ni
estadisticas avanzadas.

## Stack

- TypeScript (logica y tipos).
- Vitest (tests).
- Almacenamiento en memoria (sin base de datos todavia).

## Estructura

```text
src/
  models/        Question, Option, Source, Material, Topic, links y enums
  validation/    validateQuestion() / validateMaterial() / validateTopic()
                 + codigos de error (logica pura, reutilizable)
  repository/    Contratos + implementaciones en memoria
  service/       QuestionService, MaterialService, TopicService, coverage
  index.ts       API publica de los modulos
tests/           Tests de las reglas criticas (Vitest)
```

El material privado real del usuario no se guarda en el repositorio: las
carpetas de subida (`uploads/`, `private-materials/`) estan ignoradas por Git y
`Material.storage_path` debe apuntar a una de ellas.

## Comandos

```bash
npm install        # instala dependencias de desarrollo
npm test           # ejecuta los tests una vez (vitest run)
npm run test:watch # ejecuta los tests en modo watch
npm run typecheck  # comprueba tipos sin emitir (tsc --noEmit)
```

## Regla central

Una pregunta solo puede pasar a `validated` si tiene fuente (no obsoleta),
explicacion, tema, dificultad valida y exactamente una respuesta correcta,
entre el resto de reglas de la SPEC 001. La validacion vive aislada en
`src/validation/validateQuestion.ts` para poder reutilizarse mas adelante en el
panel de administracion, el generador de preguntas con IA, el generador de
tests y el sistema de reportes.
