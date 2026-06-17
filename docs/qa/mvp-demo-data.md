# Datos demo del MVP (SPEC 015)

> Todos los datos son **ficticios** y existen solo para probar la app. La
> constitución del proyecto prohíbe usar temarios reales o contenido legal
> sensible. No introduzcas material real durante el QA.

El frontend siembra estos datos automáticamente al arrancar (ver
`app/frontend/src/store/appStore.ts`, función `seedFixtures`). Como el MVP corre
en memoria por sesión (SPEC 009), **recargar la página restaura este estado**.

## Usuarios (login)

En la pantalla de login hay accesos rápidos "Entrar como Admin" y "Entrar como
Estudiante". Credenciales sembradas:

| Rol | Email | Contraseña |
| --- | --- | --- |
| Admin / owner del workspace | `admin@testopo.dev` | `admin1234` |
| Estudiante con matrícula activa | `alumno@testopo.dev` | `alumno1234` |

> La SPEC 015 sugería los emails `admin@testopo.local`, `student@testopo.local`
> y `premium@testopo.local`. El seed real usa los `*.dev` de la tabla. No hay
> pantalla de registro en el MVP; para probar otros usuarios/roles, créalos en
> el seed o, para el caso **Premium individual**, crea desde "Mis espacios" un
> workspace **Personal (Premium)** con el usuario admin (queda como owner).

## Workspace

- `Workspace MVP` — tipo organización. El admin es `owner`; el estudiante es
  miembro con rol `student`.

Para el caso Premium individual se puede crear adicionalmente:

- `Mi preparacion personal` — tipo personal, plan premium (creándolo en la app).

## Oposición

- `Oposicion MVP` (slug `oposicion-mvp`). El estudiante tiene acceso activo.

## Material

- `Tema 1 - Constitucion (ficticio)` — tipo temario, estado activo, con texto
  de ejemplo. Material claramente inventado.

## Temas

- `T1 - Tema 1 - Constitucion` (raíz)
  - `T1.1 - Derechos fundamentales` (subtema)
- `T2 - Tema 2 - Procedimiento administrativo` (raíz)

## Preguntas

10 preguntas ficticias, claramente inventadas (sin contenido legal real):

- 8 en estado `validated` (disponibles para tests).
- 2 en estado `pending_review` (visibles solo para el admin, no para tests).

Los enunciados y opciones son neutros ("opción A/B/C/D") para no revelar la
respuesta correcta antes de enviar un test.

## Notas para QA

- El material/PDF subido durante las pruebas se almacena con una capa de
  `FileStorage` en memoria (en el navegador) y/o en una ruta interna del tipo
  `uploads/materials/<uuid>.pdf`. Las carpetas `/uploads` y `private-materials`
  están en `.gitignore`: **ningún PDF real debe acabar en el repositorio**.
- Al ser datos en memoria, cualquier creación/edición se pierde al recargar.
  Esto es esperado en el MVP y útil para repetir pruebas desde cero.
