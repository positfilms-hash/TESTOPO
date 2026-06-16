# TESTOPO Backend - Question Bank (SPEC 001)

Primer modulo funcional: el banco de preguntas. Implementa el modelo de
pregunta, opciones y fuente, las reglas de validacion obligatorias y las
operaciones minimas (crear, listar, ver, editar, cambiar estado).

No incluye IA, generacion de tests, usuarios, autenticacion, reportes ni
estadisticas (fuera del alcance de la SPEC 001).

## Stack

- TypeScript (logica y tipos).
- Vitest (tests).
- Almacenamiento en memoria (sin base de datos todavia).

## Estructura

```text
src/
  models/        Question, Option, Source y enums (estados, dificultades, tipos)
  validation/    validateQuestion() + codigos de error (logica pura, reutilizable)
  repository/    Contrato QuestionRepository + implementacion en memoria
  service/       QuestionService (crear/listar/ver/editar/cambiar estado)
  index.ts       API publica del modulo
tests/           Tests de las reglas criticas (Vitest)
```

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
