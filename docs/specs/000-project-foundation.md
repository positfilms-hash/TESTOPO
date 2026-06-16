# SPEC 000 - Project Foundation

## 1. Objetivo

Crear la estructura inicial del repositorio del proyecto TESTOPO.

Esta tarea no debe implementar funcionalidades de la aplicacion. Solo debe preparar una base ordenada para que futuras specs puedan desarrollarse de forma clara y controlada.

Repositorio local:

```text
C:\Users\migue\Documents\TESTOPO
```

Branch recomendada:

```text
feature/project-foundation
```

## 2. Contexto

TESTOPO sera una aplicacion para generar tests randomizados de oposiciones a partir de material aportado por el usuario.

El principio central del proyecto es:

> Una pregunta no es valida porque la IA la haya generado.
> Una pregunta solo es valida si tiene fuente, explicacion, una unica respuesta correcta y controles de calidad.

Antes de implementar funcionalidades, el repositorio debe tener una estructura clara para documentacion, specs, prompts, aplicacion, base de datos y tests.

## 3. Alcance

Claude debe crear la estructura inicial de carpetas y archivos del proyecto.

Debe incluir:

```text
/docs
  /constitution
    CODEX.md
    CLAUDE.md
  /specs
    000-project-foundation.md
    001-question-bank.md
/prompts
  claude-implementation-template.md
/app
  /frontend
  /backend
/database
  schema.md
/tests
  acceptance-tests.md
README.md
.gitignore
```

Si alguna carpeta queda vacia, puede incluir un archivo `.gitkeep`.

## 4. Fuera de alcance

Claude no debe implementar todavia:

- Backend real.
- Frontend real.
- Base de datos funcional.
- Autenticacion.
- Subida de documentos.
- Generacion de preguntas.
- Integracion con IA.
- Sistema de tests.
- Panel de administracion.
- Estilos visuales.
- Configuracion compleja de frameworks.

Tampoco debe elegir todavia un stack definitivo salvo que sea estrictamente necesario para crear archivos basicos.

## 5. Archivos esperados

### README.md

Debe explicar brevemente:

- Que es TESTOPO.
- Que problema resuelve.
- Cual es el principio central del proyecto.
- Que el MVP prioriza el banco fiable de preguntas.
- Que el desarrollo se hara mediante specs.

### /docs/constitution/CODEX.md

Debe contener el documento de rol de Codex ya definido por el usuario.

Si el contenido exacto no esta disponible, crear un placeholder claro:

```markdown
# CODEX.md

Pendiente de pegar la constitucion definitiva de Codex.
```

### /docs/constitution/CLAUDE.md

Debe contener el documento de rol de Claude ya definido por el usuario.

Si el contenido exacto no esta disponible, crear un placeholder claro:

```markdown
# CLAUDE.md

Pendiente de pegar la constitucion definitiva de Claude.
```

### /docs/specs/000-project-foundation.md

Debe contener esta spec.

### /docs/specs/001-question-bank.md

Debe crearse como placeholder para la proxima spec:

```markdown
# SPEC 001 - Question Bank

Pendiente de definir.

Esta spec desarrollara el modelo de pregunta, estados, validaciones, banco de preguntas y reglas minimas para que una pregunta pueda considerarse valida.
```

### /prompts/claude-implementation-template.md

Debe incluir una plantilla base para futuros prompts a Claude:

```markdown
# Claude Implementation Prompt Template

## Context

[Breve contexto de la funcionalidad]

## Spec

[Referencia a la spec concreta]

## Scope

[Que debe implementarse]

## Out of Scope

[Que no debe implementarse]

## Business Rules

[Reglas de negocio obligatorias]

## Acceptance Criteria

[Criterios de aceptacion]

## Implementation Notes

[Notas tecnicas relevantes]

## Expected Output

[Que debe entregar Claude]
```

### /database/schema.md

Debe crearse como placeholder:

```markdown
# Database Schema

Pendiente de definir.

El esquema inicial se definira cuando se trabaje la SPEC 001 - Question Bank.
```

### /tests/acceptance-tests.md

Debe crearse como placeholder:

```markdown
# Acceptance Tests

Pendiente de definir.

Los criterios de aceptacion se iran anadiendo por spec.
```

### .gitignore

Debe incluir reglas basicas para evitar subir archivos innecesarios o sensibles.

Debe contemplar, como minimo:

```gitignore
node_modules/
.env
.env.local
.DS_Store
dist/
build/
coverage/
*.log

# Private uploaded materials
/private-materials/
/uploads/
```

## 6. Reglas importantes

- No subir material real de oposiciones al repositorio.
- No crear datos sensibles de ejemplo.
- No implementar logica funcional todavia.
- No crear una arquitectura compleja antes de definir el stack.
- No anadir dependencias innecesarias.
- Mantener la estructura simple y legible.

## 7. Criterios de aceptacion

La tarea estara completada cuando:

- Exista la estructura de carpetas indicada.
- Exista `README.md`.
- Exista `.gitignore`.
- Existan los archivos de constitucion.
- Exista esta spec como `000-project-foundation.md`.
- Exista placeholder para `001-question-bank.md`.
- Exista plantilla base para prompts de Claude.
- No se haya implementado funcionalidad fuera de alcance.
- El repositorio quede preparado para empezar la SPEC 001.

## 8. Prompt para Claude

Claude, implementa la estructura inicial del repositorio TESTOPO siguiendo la SPEC 000 - Project Foundation.

Ruta local del proyecto:

```text
C:\Users\migue\Documents\TESTOPO
```

Debes crear unicamente carpetas y archivos base. No implementes backend, frontend, base de datos funcional, integracion con IA ni ninguna logica de aplicacion.

Crea la estructura indicada en la spec, anade placeholders cuando corresponda y asegurate de incluir un `.gitignore` basico que evite subir materiales privados, archivos `.env`, dependencias y builds.

El objetivo es dejar el repositorio limpio, ordenado y listo para empezar la siguiente spec: `001-question-bank.md`.

No anadas funcionalidades no solicitadas.
