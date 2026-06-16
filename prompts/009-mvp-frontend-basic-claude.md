# Claude Prompt - SPEC 009 Basic MVP Frontend

## Context

TESTOPO es una aplicacion para preparar oposiciones mediante tests generados desde material aportado por el usuario.

Ya existen las specs de backend/servicios del MVP:

- SPEC 001 - Question Bank.
- SPEC 002 - Material Upload & Source Registry.
- SPEC 003 - Topic Map.
- SPEC 004 - Question Generation Drafts.
- SPEC 005 - Question Validation & Quality Gate.
- SPEC 006 - Admin Review.
- SPEC 007 - Test Generator.
- SPEC 008 - Test Taking & Results.

Esta SPEC 009 no debe crear nuevas funcionalidades de negocio. Debe crear una interfaz basica, elegante y navegable para usar el flujo del MVP sin tocar codigo.

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

## Spec

Implementa estrictamente:

```text
/docs/specs/009-mvp-frontend-basic.md
```

Branch de trabajo:

```text
feature/mvp-frontend-basic
```

## Product Goal

El frontend debe permitir probar el flujo completo:

```text
Material -> Temario -> Preguntas -> Revision -> Test -> Resultado
```

Debe sentirse como una app sencilla para estudiar oposiciones, no como una herramienta tecnica.

Frase guia:

```text
Menos botones, mas claridad.
```

## Critical UX Rules

- Una accion principal por pantalla.
- Pocos botones visibles.
- Textos claros, no tecnicos.
- Formularios cortos.
- Estados visibles y entendibles.
- El usuario siempre debe saber el siguiente paso.
- No mostrar informacion tecnica salvo que sea necesaria.
- No saturar con tablas enormes si tarjetas o listas limpias bastan.
- No mostrar botones que no funcionen.
- Confirmar acciones destructivas como rechazar o marcar obsoleto.

## Critical Business Rules

- No mostrar respuestas correctas antes de enviar un test.
- No mostrar explicaciones antes de enviar un test.
- No indicar si una respuesta es correcta o incorrecta antes de enviar.
- No aprobar preguntas con errores criticos.
- Las preguntas generadas nunca deben aparecer como validadas directamente.
- No reimplementar reglas de negocio importantes en el frontend.
- Consumir servicios/backend/adapters existentes.
- Si no existe API formal, crear una capa frontend simple de adapters que llame a la logica existente sin duplicarla.

## Scope

Implementa un frontend basico con maximo estas 5 secciones principales:

- Inicio
- Material
- Temario
- Preguntas
- Tests

Pantallas minimas:

- Inicio del MVP.
- Gestion basica de material.
- Gestion basica de temario.
- Listado de preguntas.
- Revision de preguntas.
- Generacion de borradores de preguntas.
- Creacion de tests.
- Realizacion de tests.
- Resultados y revision de explicaciones.

## Navigation

La navegacion principal debe tener maximo 5 secciones:

- Inicio
- Material
- Temario
- Preguntas
- Tests

No anadas mas secciones salvo necesidad tecnica muy clara.

## Home

Debe guiar el MVP con 3 o 4 tarjetas:

- Anade material.
- Organiza el temario.
- Revisa preguntas.
- Crea un test.

Cada tarjeta debe tener una accion clara.

Puede mostrar contadores basicos si ya existen:

- Materiales cargados.
- Preguntas pendientes.
- Preguntas validadas.
- Tests creados.

No convertir Inicio en dashboard complejo.

## Material Screen

Debe permitir:

- Ver lista de materiales.
- Anadir material.
- Filtrar por estado o tipo, si ya existe.
- Ver detalle.
- Editar metadatos basicos.
- Marcar como obsoleto.

Formulario simple:

- Titulo.
- Tipo.
- Estado.
- Referencia.
- Texto manual o archivo.
- Descripcion.

No mostrar `mime_type`, `storage_path` ni `size_bytes` salvo seccion secundaria.

## Topic Screen

Debe permitir:

- Ver arbol o lista jerarquica de temas.
- Anadir tema.
- Crear subtema.
- Editar tema.
- Marcar tema como obsoleto.

No implementar drag and drop salvo que sea trivial.

## Questions Screen

Debe incluir dos vistas:

- Pendientes de revision.
- Todas las preguntas.

Filtros basicos:

- Estado.
- Tema.
- Dificultad.

Cada pregunta debe mostrarse como tarjeta o fila clara con:

- Enunciado resumido.
- Tema.
- Dificultad.
- Estado.
- Fuente.
- Indicador de errores o advertencias.

Accion principal:

- Revisar.

Evita muchos botones en la lista.

## Question Review

Debe mostrar:

- Enunciado.
- Opciones.
- Respuesta correcta.
- Explicacion.
- Fuente.
- Tema.
- Dificultad.
- Estado.
- Informe de validacion.
- Advertencias.
- Errores criticos.

Acciones:

- Aprobar como principal.
- Rechazar como secundaria.
- Marcar para corregir como secundaria.
- Editar.

Si hay errores criticos, Aprobar debe estar bloqueado o explicar claramente por que no se puede aprobar.

No aprobar saltandose validacion.

## Question Generation

Debe existir una forma simple de generar preguntas desde material, dentro de Preguntas o Material.

Formulario:

- Material.
- Tema.
- Dificultad.
- Numero de preguntas.
- Fragmento opcional.

Boton principal:

- Generar borradores.

Tras generar, mostrar mensaje claro:

```text
Se han generado X preguntas pendientes de revision.
```

## Tests Screen

Debe permitir:

- Crear test.
- Ver lista de tests creados.
- Ver estado del test.
- Empezar o continuar test.

Formulario simple:

- Numero de preguntas.
- Tema opcional.
- Dificultad.
- Modo.

Modos visibles:

- Aleatorio.
- Por tema.
- Por dificultad.
- Mixto.

No mostrar detalles tecnicos de filtros.

## Taking Test

Debe ser limpia y enfocada:

- Una pregunta cada vez, o lista sencilla si es mas facil.
- Opciones de respuesta.
- Progreso: Pregunta 3 de 20.
- Boton para avanzar.
- Boton para enviar test.

Antes de enviar no debe mostrarse:

- Respuesta correcta.
- Explicacion.
- Si la respuesta elegida es correcta o incorrecta.

El usuario debe poder cambiar respuestas antes de enviar.

## Results

Despues de enviar debe mostrar:

- Puntuacion.
- Porcentaje.
- Aciertos.
- Fallos.
- No respondidas.
- Acceso a revision de respuestas.

Revision de resultados:

- Enunciado.
- Respuesta elegida.
- Respuesta correcta.
- Explicacion.
- Tema.
- Dificultad.

Debe distinguir claramente:

- Correcta.
- Incorrecta.
- No respondida.

No implementar estadisticas avanzadas.

## Visual Style

Debe ser:

- Limpio.
- Moderno.
- Profesional.
- Con tarjetas.
- Con buen espaciado.
- Con tipografia legible.
- Con colores suaves.
- Sin saturar la pantalla.

Recomendacion:

- Fondo claro.
- Contenedores blancos.
- Bordes suaves.
- Botones claros.
- Estados con etiquetas discretas.

Etiquetas:

- Borrador.
- Pendiente.
- Validada.
- Necesita correccion.
- Obsoleta.

No crees una landing page de marketing. La primera pantalla debe ser la app usable.

## Recommended Components

Crear componentes simples y reutilizables:

- `AppLayout`
- `Sidebar`
- `PageHeader`
- `Card`
- `Button`
- `Badge`
- `EmptyState`
- `LoadingState`
- `ErrorState`
- `QuestionCard`
- `MaterialCard`
- `TopicTree`
- `TestCard`
- `ReviewPanel`

No crear un design system complejo.

## Interface States

Cada pantalla debe contemplar:

- Cargando.
- Sin datos.
- Error.
- Exito.
- Guardando.
- Accion completada.

Ejemplos:

- Todavia no has anadido material.
- No hay preguntas pendientes de revision.
- No hay suficientes preguntas validadas para crear este test.

## Out of Scope

No implementes:

- Login.
- Roles reales.
- Sistema completo de usuarios.
- Pagos.
- Ranking.
- Comunidad.
- Animaciones complejas.
- Dashboard estadistico avanzado.
- Diseno movil nativo avanzado.
- Graficos complejos.
- Modo oscuro obligatorio.
- Configuracion avanzada.
- Funcionalidades fuera del MVP.

## Frontend Testing / Smoke Readiness

Anade lo minimo razonable para tests frontend sin sobredisenar.

Debe quedar claro:

- Comando para instalar dependencias.
- Comando para ejecutar dev server.
- URL local esperada.
- Comando para tests.
- Si se anade Playwright versionado en el repo, explica como ejecutarlo.

Codex revisara visualmente con Browser + Playwright. Asegurate de que la app pueda arrancar localmente sin pasos ocultos.

Checks minimos esperados:

- Renderiza navegacion principal.
- Muestra Inicio.
- Muestra lista de materiales.
- Muestra lista de temas.
- Muestra lista de preguntas.
- No muestra respuesta correcta durante un test.
- Muestra resultado despues de enviar.
- Bloquea o indica aprobacion imposible si hay errores criticos.
- Muestra estados vacios correctamente.

## Expected Output

Entrega:

- Resumen de archivos creados o modificados.
- Stack/frontend elegido si no existia.
- Comandos exactos para:
  - instalar dependencias
  - arrancar dev server
  - ejecutar tests
- URL local para revision visual.
- Confirmacion de que la navegacion tiene maximo 5 secciones.
- Confirmacion de que no se muestran respuestas correctas antes de enviar test.
- Confirmacion de que no se aprueban preguntas con errores criticos.
- Confirmacion de que no se implementaron login, roles, pagos, ranking, comunidad, estadisticas avanzadas ni funcionalidades fuera del MVP.
