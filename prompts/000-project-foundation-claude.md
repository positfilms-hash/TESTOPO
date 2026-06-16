# Claude Prompt - SPEC 000 Project Foundation

## Context

TESTOPO sera una aplicacion para generar tests randomizados de oposiciones a partir de material aportado por el usuario.

El principio central del producto es que una pregunta solo es valida si tiene fuente concreta, explicacion verificable, una unica respuesta correcta y controles de calidad.

En esta tarea no debes construir la aplicacion. Solo debes cimentar el repositorio.

## Spec

Sigue estrictamente la spec:

```text
/docs/specs/000-project-foundation.md
```

Ruta local del proyecto:

```text
C:\Users\migue\Documents\TESTOPO
```

Branch de trabajo:

```text
feature/project-foundation
```

## Scope

Crea la estructura inicial de carpetas y archivos base:

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

Si una carpeta queda vacia, puedes anadir un `.gitkeep`.

## Out of Scope

No implementes:

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
- Dependencias o seleccion definitiva de stack.

## Business Rules

- No subir material real de oposiciones al repositorio.
- No crear datos sensibles de ejemplo.
- No implementar logica funcional.
- Mantener la estructura simple, clara y preparada para futuras specs.
- El desarrollo del proyecto se guiara por specs dentro de `/docs/specs`.

## Acceptance Criteria

- Existe la estructura de carpetas indicada.
- Existe `README.md`.
- Existe `.gitignore`.
- Existen `/docs/constitution/CODEX.md` y `/docs/constitution/CLAUDE.md`.
- Existe `/docs/specs/000-project-foundation.md`.
- Existe placeholder para `/docs/specs/001-question-bank.md`.
- Existe `/prompts/claude-implementation-template.md`.
- Existe `/database/schema.md`.
- Existe `/tests/acceptance-tests.md`.
- No se ha implementado funcionalidad fuera de alcance.
- El repositorio queda listo para empezar la SPEC 001.

## Implementation Notes

Usa placeholders claros cuando el contenido definitivo no este disponible.

Para `CODEX.md`, si no tienes el texto definitivo, usa:

```markdown
# CODEX.md

Pendiente de pegar la constitucion definitiva de Codex.
```

Para `CLAUDE.md`, si no tienes el texto definitivo, usa:

```markdown
# CLAUDE.md

Pendiente de pegar la constitucion definitiva de Claude.
```

El `.gitignore` debe incluir, como minimo:

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

## Expected Output

Entrega un resumen breve de:

- Archivos y carpetas creados.
- Confirmacion de que no se implemento logica de aplicacion.
- Cualquier decision minima tomada para mantener la estructura versionable.
