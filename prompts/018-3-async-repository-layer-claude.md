# Claude Prompt - SPEC 018.3 Async Repository Layer

## Context

Claude recomendo preparar la capa de repositorios para Supabase antes de migrar datos reales.

Esta spec convierte repositorios, servicios y llamadas del frontend a un modelo asincrono con `Promise` y `async/await`, manteniendo por ahora las implementaciones `InMemory`.

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

## Spec

Implementa estrictamente:

```text
/docs/specs/018-3-async-repository-layer.md
```

Branch de trabajo:

```text
feature/pre-beta-async-repositories
```

## Product Goal

Preparar TESTOPO para migrar posteriormente a Supabase sin cambiar comportamiento funcional.

Antes:

```ts
const question = questionRepository.findById(id)
```

Despues:

```ts
const question = await questionRepository.findById(id)
```

La app debe comportarse igual para el usuario, pero la arquitectura debe quedar lista para repositorios asincronos.

## Non-Negotiable Scope Boundary

No implementes todavia:

- Repositorios reales de Supabase.
- Migracion completa de datos de dominio.
- RLS.
- Edge Functions.
- Cambios de modelo de datos.
- Nuevas funcionalidades.
- Cambios visuales.
- Pagos.
- OAuth.
- Operaciones con `service_role`.
- Logica nueva de permisos.

Esta tarea es solo un refactor asincrono.

## Required Changes

Convierte a asincrono:

- Interfaces de repositorios.
- Implementaciones `InMemory`.
- Servicios de dominio.
- `PlatformService`, `AppService`, `TestopoService` o facade principal si existe.
- Hooks, adapters o servicios usados por frontend.
- Llamadas desde componentes frontend.
- Tests afectados.

## Repository Interfaces

Todas las interfaces de repositorio deben devolver `Promise`.

Ejemplo:

```ts
interface QuestionRepository {
  findById(id: string): Promise<Question | null>
  list(filters?: QuestionFilters): Promise<Question[]>
  create(input: CreateQuestionInput): Promise<Question>
  update(id: string, input: UpdateQuestionInput): Promise<Question>
  delete?(id: string): Promise<void>
}
```

Aplica el mismo patron a los repositorios reales del proyecto, incluyendo cuando existan:

- Users / Profiles.
- Workspaces.
- Workspace members.
- Oppositions.
- Opposition access.
- Materials.
- Topics.
- Questions.
- Question options.
- Validation results.
- Review logs.
- Tests.
- Test questions.
- Test attempts.
- Test answers.
- Import batches.
- Import items.

## InMemory Implementations

Mantener las implementaciones actuales `InMemory`, pero hacer sus metodos asincronos.

Antes:

```ts
findById(id: string): Question | null {
  return this.questions.get(id) ?? null
}
```

Despues:

```ts
async findById(id: string): Promise<Question | null> {
  return this.questions.get(id) ?? null
}
```

Reglas:

- No anadir `setTimeout`.
- No simular latencia.
- No cambiar datos seed.
- No cambiar reglas de negocio.
- No cambiar permisos.
- No cambiar validaciones.

## Services And Facade

Todos los servicios que consumen repositorios deben usar `await`.

Aplica a servicios de:

- Material.
- Topic.
- Question Bank.
- Question Generation.
- Question Validation.
- Admin Review.
- Test Generator.
- Test Taking.
- Student Portal.
- Workspace/Access.
- PDF/Bulk Import.
- Auth/Profile, si aplica.

Si existe `PlatformService`, `AppService`, `TestopoService` o facade central, sus metodos publicos deben devolver `Promise`.

Ejemplos:

```ts
createQuestion(input): Promise<Question>
generateTest(input): Promise<Test>
submitAttempt(input): Promise<TestResult>
```

## Frontend

El frontend debe consumir operaciones de dominio con `async/await`.

Adapta componentes, hooks o adapters que ahora reciban `Promise`.

Debe contemplar estados basicos:

- Loading.
- Success.
- Error.

No redisenes UX en esta spec. Haz solo los ajustes necesarios para que las llamadas asincronas funcionen correctamente.

## Tests

Actualiza tests existentes para usar `await`.

Antes:

```ts
const question = service.createQuestion(input)
expect(question.status).toBe("draft")
```

Despues:

```ts
const question = await service.createQuestion(input)
expect(question.status).toBe("draft")
```

Errores:

```ts
await expect(service.approveQuestion(id)).rejects.toThrow(...)
```

No elimines tests salvo que esten duplicados o haya una justificacion clara.

Todos los tests deben seguir comprobando el mismo comportamiento.

## Functional Rules That Must Not Break

Verifica que siguen cumpliendose:

- Preguntas generadas no pasan automaticamente a `validated`.
- Solo preguntas `validated` entran en tests normales.
- Student no accede a zona admin.
- Student no ve preguntas no validadas.
- Student no ve respuestas correctas antes de enviar.
- No se mezclan workspaces.
- No se mezclan oposiciones.
- Pregunta validada requiere fuente, explicacion, tema, dificultad y una unica respuesta correcta.
- Material y preguntas siguen asociados a oposicion/workspace.

## Supabase Compatibility

Esta spec debe dejar preparado el proyecto para una futura sustitucion:

```ts
const repository = isSupabaseConfigured()
  ? new SupabaseQuestionRepository(...)
  : new InMemoryQuestionRepository(...)
```

Pero no implementes repositorios Supabase reales en esta spec salvo que ya exista una estructura clara y sea solo preparatoria. La prioridad es que las interfaces sean asincronas.

## Required Verification

Ejecuta:

- Tests automatizados existentes.
- Build frontend si existe.
- Cualquier check de tipos/lint configurado si existe.

Ademas revisa manualmente que:

- Frontend compila sin errores de `Promise`.
- Servicios usan `await`.
- `PlatformService` o facade principal expone metodos asincronos.
- Los repositorios siguen siendo `InMemory`.
- No se ha anadido persistencia real de Supabase para entidades de dominio.

## PR Expectations

En la descripcion del PR incluye:

- Resumen del refactor async.
- Lista de capas tocadas.
- Confirmacion explicita de que los repositorios siguen siendo `InMemory`.
- Confirmacion explicita de que no se implemento migracion real a Supabase.
- Confirmacion explicita de que no cambiaron reglas de negocio.
- Tests/checks ejecutados.
- Riesgos o zonas que conviene revisar.

## Acceptance Criteria

- Todas las interfaces de repositorio devuelven `Promise`.
- Todas las implementaciones `InMemory` son asincronas.
- Todos los servicios usan `await`.
- El facade principal usa metodos asincronos.
- El frontend consume operaciones con `async/await`.
- Los tests se han actualizado.
- El comportamiento funcional no cambia.
- No se implementa persistencia real de Supabase para entidades de dominio.
- No se anaden funcionalidades nuevas.
- Todos los tests siguen pasando.

