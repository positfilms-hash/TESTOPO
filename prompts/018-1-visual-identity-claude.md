# Claude Prompt - SPEC 018.1 Visual Identity: Typography & Colors

## Context

TESTOPO ya tiene el MVP funcional con admin, student portal, oposiciones, workspaces, materiales, preguntas, tests y resultados.

Antes de la beta queremos ajustar la identidad visual. Esta tarea es puramente visual.

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

## Spec

Implementa estrictamente:

```text
/docs/specs/018-1-visual-identity.md
```

Branch de trabajo:

```text
feature/pre-beta-visual-identity
```

## Product Goal

Hacer que TESTOPO se vea mas:

- Limpio.
- Elegante.
- Profesional.
- Intuitivo.
- Facil de usar.

El estilo deseado es:

- Azul pastel.
- Blanco.
- Lineas negras finas.
- Titulos elegantes con Georgia.
- Texto general muy legible con sans-serif del sistema.

## Non-Negotiable Scope Boundary

Esta tarea no puede cambiar funcionalidad.

No cambies:

- Permisos.
- Rutas.
- Modelos.
- Schemas.
- Migraciones.
- Endpoints.
- Servicios.
- Stores de negocio.
- Logica de generacion de preguntas.
- Logica de validacion.
- Logica de revision admin.
- Logica de tests.
- Logica de resultados.
- Logica de subida/importacion de materiales.
- Separacion admin/student.

Si necesitas tocar archivos de logica para aplicar estilos, justificalo en el PR y manten el cambio estrictamente visual.

## Palette

Usa una paleta simple y coherente:

```text
Background principal: #FFFFFF
Background secundario: #F7FBFF
Azul pastel principal: #BFDDF7
Azul pastel suave: #EAF5FF
Azul activo/hover: #A8CFF0
Texto principal: #111111
Texto secundario: #4B5563
Bordes/lineas principales: #111111
Bordes suaves opcionales: #D1D5DB
Error: #DC2626
Exito: #16A34A
Advertencia: #D97706
```

Reglas:

- Blanco como base.
- Azul pastel como acento.
- Lineas negras finas para personalidad visual.
- Evitar bordes negros gruesos.
- Evitar sombras fuertes.
- No saturar con color.

## Typography

Titulos y encabezados principales:

```css
Georgia, "Times New Roman", serif
```

Texto general:

```css
system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Reglas:

- Georgia solo para titulos y encabezados.
- No usar Georgia en botones, inputs, navegacion, tablas, badges ni textos pequenos.
- Usar sans-serif del sistema para formularios, botones, navegacion, parrafos, badges, tablas, mensajes y estados vacios.
- Mantener jerarquia visual clara.
- Evitar texto demasiado pequeno.

## Components To Style

Aplica la identidad visual a:

- Layout general.
- Sidebar.
- Header.
- Botones.
- Tarjetas.
- Formularios.
- Inputs.
- Badges de estado.
- Tablas o listas.
- Pantallas vacias.
- Panel admin.
- Portal estudiante.

## Buttons

Boton principal:

- Fondo azul pastel.
- Texto negro.
- Borde negro fino.
- Hover azul pastel activo.

Boton secundario:

- Fondo blanco.
- Texto negro.
- Borde negro fino.

Botones destructivos:

- Fondo blanco.
- Texto rojo.
- Borde rojo.

No cambies handlers, acciones ni navegacion de botones.

## Cards And Containers

Usa:

```text
Fondo: blanco
Borde: 1px solid #111111
Radio: medio
Sombra: ninguna o muy sutil
```

Mantener aire visual y legibilidad.

No crear nuevas pantallas ni reorganizar flujos funcionales.

## Status Badges

Los estados deben ser legibles y suaves:

- Validada: verde suave.
- Pendiente: azul suave.
- Necesita correccion: amarillo suave.
- Obsoleta: gris suave.
- Rechazada: rojo suave.

No mostrar codigos internos como `pending_review` al usuario final si ya hay una capa de presentacion para traducir estados.

No cambies los valores internos de estado.

## UX Rules

- No anadir animaciones innecesarias.
- No saturar con botones.
- Mantener mucho espacio blanco.
- Mantener acciones claras y pocas.
- Mantener coherencia entre admin y student.
- La app debe sentirse sencilla, profesional e intuitiva.

## Implementation Guidance

1. Identifica el sistema actual de estilos.
2. Si existen variables/tokens globales, actualizalos ahi.
3. Si no existen, centraliza la identidad visual de forma simple y coherente.
4. Ajusta componentes reutilizables antes que pantallas individuales.
5. Evita refactors grandes.
6. Evita cambios de estructura salvo que sean necesarios para aplicar estilos.
7. No cambies funcionalidad.

## Required Verification

Ejecuta los checks existentes relevantes:

- Tests automatizados si existen.
- Build frontend.
- Smoke visual local si el proyecto lo permite.

Revisa al menos:

- Pantalla admin principal.
- Pantalla student principal.
- Formularios.
- Botones primarios/secundarios/destructivos.
- Tarjetas.
- Badges de estado.
- Estados vacios.

## PR Expectations

En la descripcion del PR incluye:

- Resumen de cambios visuales.
- Archivos principales tocados.
- Confirmacion explicita de que no se modificaron funcionalidades, permisos, rutas, modelos ni reglas de negocio.
- Checks ejecutados.
- Capturas o notas de smoke visual si aplica.

## Acceptance Criteria

- La app usa azul pastel, blanco y lineas negras finas de forma coherente.
- Los titulos usan Georgia.
- El texto general usa sans-serif del sistema.
- Botones, tarjetas, inputs y badges tienen estilo uniforme.
- Admin y Student comparten identidad visual.
- La interfaz se ve mas limpia, elegante y profesional.
- No hay cambios funcionales.
- No se rompen tests existentes.

