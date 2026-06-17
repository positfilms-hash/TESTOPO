# SPEC 018.3 - Async Repository Layer

## 1. Objetivo

Convertir la capa de repositorios, servicios y llamadas del frontend de TESTOPO a un modelo asincrono basado en `Promise` y `async/await`.

Esta spec prepara el proyecto para una futura migracion a Supabase sin cambiar todavia el almacenamiento real del dominio.

Las implementaciones actuales `InMemory` deben seguir existiendo, pero sus metodos deben pasar a ser asincronos.

## 2. Contexto

Actualmente parte del dominio funciona con repositorios en memoria.

Ejemplo actual:

```ts
findById(id): Entity
save(entity): Entity
list(): Entity[]
```

Pero Supabase sera asincrono, por lo que la arquitectura debe prepararse para:

```ts
findById(id): Promise<Entity | null>
save(entity): Promise<Entity>
list(): Promise<Entity[]>
```

Esta spec es un refactor tecnico necesario antes de migrar datos reales a Supabase.

## 3. Branch

```text
feature/pre-beta-async-repositories
```

## 4. Alcance

Claude debe convertir a asincrono:

- Interfaces de repositorios.
- Implementaciones `InMemory`.
- Servicios de dominio.
- `PlatformService` o facade principal.
- Hooks, adapters o servicios usados por frontend.
- Llamadas desde componentes frontend.
- Tests afectados.

Debe mantener el mismo comportamiento funcional.

## 5. Fuera De Alcance

No implementar todavia:

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

Esta spec es solo un refactor asincrono.

## 6. Regla Principal

El comportamiento del producto no debe cambiar.

Antes:

```text
El repositorio devuelve datos en memoria de forma sincrona.
```

Despues:

```text
El repositorio devuelve los mismos datos en memoria, pero mediante Promise.
```

La app debe funcionar igual para el usuario.

## 7. Repositorios Afectados

Actualizar todas las interfaces de repositorio existentes.

Ejemplo esperado:

```ts
interface QuestionRepository {
  findById(id: string): Promise<Question | null>
  list(filters?: QuestionFilters): Promise<Question[]>
  create(input: CreateQuestionInput): Promise<Question>
  update(id: string, input: UpdateQuestionInput): Promise<Question>
  delete?(id: string): Promise<void>
}
```

Aplicar el mismo patron a repositorios de:

- Users / Profiles, si existen.
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

La lista exacta debe adaptarse a los repositorios reales del proyecto.

## 8. Implementaciones InMemory

Las implementaciones actuales en memoria deben mantenerse.

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

- No hace falta simular latencia.
- No anadir `setTimeout`.
- No cambiar datos.
- No cambiar reglas de negocio.
- No cambiar validaciones.
- No cambiar permisos.

## 9. Servicios De Dominio

Actualizar todos los servicios que consumen repositorios.

Antes:

```ts
const question = questionRepository.findById(id)
```

Despues:

```ts
const question = await questionRepository.findById(id)
```

Aplicar a servicios de:

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

## 10. PlatformService / Facade

Si existe un `PlatformService`, `AppService`, `TestopoService` o facade central, debe convertirse tambien a metodos asincronos.

Ejemplos:

```ts
createQuestion(input): Promise<Question>
generateTest(input): Promise<Test>
submitAttempt(input): Promise<TestResult>
```

El objetivo es que el frontend siempre trate las operaciones de dominio como asincronas.

## 11. Frontend

Actualizar llamadas desde frontend para usar `async/await`.

Debe contemplar estados:

- Loading.
- Success.
- Error.

No hace falta redisenar UX en esta spec. Solo adaptar llamadas que ahora pasan a ser asincronas.

Ejemplo:

```ts
const handleSubmit = async () => {
  setLoading(true)

  try {
    await service.createQuestion(input)
  } catch (error) {
    setError(error)
  } finally {
    setLoading(false)
  }
}
```

## 12. Tests

Actualizar tests existentes.

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

Todos los tests deben seguir comprobando lo mismo.

No eliminar tests salvo que esten duplicados o rotos por razones justificadas.

## 13. Errores Y Excepciones

Mantener el sistema actual de errores.

Si antes una operacion lanzaba error, ahora debe seguir lanzandolo, pero dentro de una `Promise`.

Ejemplo:

```ts
await expect(service.approveQuestion(id)).rejects.toThrow(...)
```

## 14. Compatibilidad Con Supabase Futura

Esta spec debe dejar preparado el proyecto para que en una spec posterior se pueda hacer:

```ts
const repository = isSupabaseConfigured()
  ? new SupabaseQuestionRepository(...)
  : new InMemoryQuestionRepository(...)
```

Pero ese factory no es obligatorio en esta spec salvo que ya exista una estructura clara.

La prioridad ahora es que las interfaces sean asincronas.

## 15. Reglas Que No Deben Romperse

Deben seguir cumpliendose:

- Preguntas generadas no pasan automaticamente a `validated`.
- Solo preguntas `validated` entran en tests normales.
- Student no accede a zona admin.
- Student no ve preguntas no validadas.
- Student no ve respuestas correctas antes de enviar.
- No se mezclan workspaces.
- No se mezclan oposiciones.
- Pregunta validada requiere fuente, explicacion, tema, dificultad y una unica respuesta correcta.
- Material y preguntas siguen asociados a oposicion/workspace.
- Tests existentes deben seguir pasando.

## 16. Criterios De Aceptacion

La tarea se considera completada cuando:

- Todas las interfaces de repositorio devuelven `Promise`.
- Todas las implementaciones `InMemory` son asincronas.
- Todos los servicios usan `await`.
- El facade principal usa metodos asincronos.
- El frontend consume operaciones con `async/await`.
- Los tests se han actualizado.
- El comportamiento funcional no cambia.
- No se ha implementado todavia persistencia real de Supabase para entidades de dominio.
- No se han anadido funcionalidades nuevas.
- No se han roto tests existentes.

