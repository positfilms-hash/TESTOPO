# SPEC 009 - Basic MVP Frontend

## 1. Objetivo

Crear el frontend basico del MVP de TESTOPO.

La interfaz debe ser elegante, clara e intuitiva. El usuario no debe sentir que esta usando una herramienta tecnica, sino una app sencilla para preparar oposiciones mediante tests.

El frontend debe permitir probar el flujo completo del MVP:

```text
Material -> Temario -> Preguntas -> Revision -> Test -> Resultado
```

## 2. Contexto

Ya existen o deben existir las specs:

- SPEC 001 - Question Bank
- SPEC 002 - Material Upload & Source Registry
- SPEC 003 - Topic Map
- SPEC 004 - Question Generation Drafts
- SPEC 005 - Question Validation & Quality Gate
- SPEC 006 - Admin Review
- SPEC 007 - Test Generator
- SPEC 008 - Test Taking & Results

Esta spec no debe crear nuevas funcionalidades de negocio. Solo debe crear una interfaz para usar lo que ya existe.

## 3. Branch recomendada

```text
feature/mvp-frontend-basic
```

## 4. Principio de diseno

La app debe seguir estas reglas:

- Una accion principal por pantalla.
- Pocos botones visibles.
- Textos claros, no tecnicos.
- Diseno limpio, con espacio en blanco.
- Formularios cortos.
- Estados visibles: borrador, pendiente, validada, necesita correccion.
- El usuario siempre debe saber cual es el siguiente paso.
- No mostrar informacion tecnica salvo que sea necesaria.
- No saturar con tablas enormes si se puede usar tarjetas o listas limpias.

Frase guia:

> Menos botones, mas claridad.

## 5. Alcance

Claude debe implementar un frontend basico que permita:

- Ver una pantalla de inicio.
- Gestionar material.
- Ver y gestionar el mapa de temas.
- Ver preguntas.
- Revisar preguntas pendientes.
- Aprobar, rechazar o marcar preguntas.
- Generar preguntas desde material.
- Crear un test.
- Realizar un test.
- Ver resultados.
- Ver explicacion de respuestas tras enviar el test.

## 6. Fuera de alcance

No implementar todavia:

- Login.
- Roles reales.
- Pagos.
- Ranking.
- Comunidad.
- Animaciones complejas.
- Dashboard estadistico avanzado.
- Diseno movil nativo avanzado.
- Graficos complejos.
- Modo oscuro obligatorio.
- Configuracion avanzada.
- Sistema completo de usuarios.

## 7. Estructura de navegacion

La navegacion debe ser simple.

Menu principal recomendado:

- Inicio
- Material
- Temario
- Preguntas
- Tests

No anadir mas secciones en el MVP salvo necesidad clara.

## 8. Pantalla de inicio

Debe funcionar como guia del MVP.

Debe mostrar 3 o 4 tarjetas simples:

1. Anade material
2. Organiza el temario
3. Revisa preguntas
4. Crea un test

Cada tarjeta debe tener una accion clara.

Ejemplos:

- Subir material
- Ver temario
- Revisar preguntas
- Crear test

Tambien puede mostrar contadores basicos si ya existen:

- Materiales cargados.
- Preguntas pendientes.
- Preguntas validadas.
- Tests creados.

No convertir esta pantalla en un dashboard complejo.

## 9. Pantalla de Material

Objetivo: permitir anadir y consultar material.

Debe incluir:

- Lista de materiales.
- Boton principal: Anadir material.
- Filtros simples por estado o tipo, si ya existen.
- Vista de detalle de material.
- Edicion basica de metadatos.
- Marcado como obsoleto.

El formulario de material debe ser simple:

- Titulo
- Tipo
- Estado
- Referencia
- Texto manual o archivo
- Descripcion

No mostrar campos tecnicos como `mime_type`, `storage_path` o `size_bytes` salvo en una seccion secundaria.

## 10. Pantalla de Temario

Objetivo: organizar temas y apartados.

Debe incluir:

- Arbol o lista jerarquica de temas.
- Boton principal: Anadir tema.
- Crear tema.
- Crear subtema.
- Editar tema.
- Marcar tema como obsoleto.

Debe ser visualmente simple.

Ejemplo:

```text
Tema 1 - Constitucion
  Derechos fundamentales
  Organizacion territorial
Tema 2 - Procedimiento administrativo
  Plazos
  Recursos
```

No implementar drag and drop todavia salvo que sea trivial.

## 11. Pantalla de Preguntas

Objetivo: revisar y controlar el banco de preguntas.

Debe incluir dos vistas simples:

- Pendientes de revision
- Todas las preguntas

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

Accion principal para cada pregunta:

- Revisar

Evitar muchos botones directamente en la lista.

## 12. Vista de revision de pregunta

Esta es una de las pantallas mas importantes.

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

Acciones principales:

- Aprobar
- Rechazar
- Marcar para corregir
- Editar

Regla de diseno:

- Aprobar debe ser la accion principal.
- Rechazar y Marcar para corregir deben ser secundarias.
- Si hay errores criticos, Aprobar debe estar bloqueado o mostrar claramente por que no se puede aprobar.
- No aprobar nunca una pregunta saltandose la validacion.

## 13. Generacion de preguntas

Debe existir una forma simple de generar preguntas desde material.

Puede estar dentro de la pantalla de Preguntas o Material.

Formulario recomendado:

- Material
- Tema
- Dificultad
- Numero de preguntas
- Fragmento opcional

Boton principal:

- Generar borradores

Despues de generar, mostrar mensaje claro:

```text
Se han generado X preguntas pendientes de revision.
```

Las preguntas generadas nunca deben aparecer como validadas directamente.

## 14. Pantalla de Tests

Objetivo: crear y realizar tests.

Debe incluir:

- Boton principal: Crear test.
- Lista de tests creados.
- Estado del test.
- Accion para empezar o continuar test.

Formulario para crear test:

- Numero de preguntas
- Tema opcional
- Dificultad
- Modo

Debe ser muy simple.

Ejemplos de modos visibles para usuario:

- Aleatorio
- Por tema
- Por dificultad
- Mixto

No mostrar detalles tecnicos de filtros.

## 15. Pantalla para hacer test

Debe ser limpia y enfocada.

Debe mostrar:

- Una pregunta cada vez, o una lista sencilla si es mas facil.
- Opciones de respuesta.
- Progreso: Pregunta 3 de 20.
- Boton para avanzar.
- Boton para enviar test.

Regla importante:

Antes de enviar el test no debe mostrarse:

- Respuesta correcta.
- Explicacion.
- Si la respuesta elegida es correcta o incorrecta.

El usuario debe poder cambiar respuestas antes de enviar.

## 16. Pantalla de resultados

Despues de enviar el test debe mostrar:

- Puntuacion.
- Porcentaje.
- Aciertos.
- Fallos.
- No respondidas.
- Boton o seccion para revisar respuestas.

Ejemplo visual:

```text
Resultado: 16 / 20
Aciertos: 16
Fallos: 3
Sin responder: 1
```

## 17. Revision de resultados

Debe mostrar cada pregunta con:

- Enunciado.
- Respuesta elegida.
- Respuesta correcta.
- Explicacion.
- Tema.
- Dificultad.

Debe ser facil distinguir:

- Correcta.
- Incorrecta.
- No respondida.

No hace falta implementar estadisticas avanzadas todavia.

## 18. Estilo visual

El diseno debe ser:

- Limpio.
- Moderno.
- Profesional.
- Con tarjetas.
- Con buen espaciado.
- Con tipografia legible.
- Con colores suaves.
- Sin saturar la pantalla.

Recomendacion visual:

- Fondo claro.
- Contenedores blancos.
- Bordes suaves.
- Botones claros.
- Estados con etiquetas discretas.

Ejemplos de etiquetas:

- Borrador
- Pendiente
- Validada
- Necesita correccion
- Obsoleta

## 19. Componentes recomendados

Crear componentes reutilizables simples:

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

No crear un design system complejo todavia.

## 20. Estados de interfaz

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

## 21. Reglas UX importantes

- No mostrar botones que no funcionen.
- No ocultar errores importantes.
- No usar lenguaje tecnico innecesario.
- No pedir al usuario mas informacion de la necesaria.
- No permitir aprobar preguntas invalidas.
- No mostrar soluciones antes de enviar un test.
- No sobrecargar con formularios largos.
- Confirmar acciones destructivas como marcar obsoleto o rechazar.

## 22. Integracion con backend o servicios

Claude debe adaptarse al stack actual.

Si ya existen endpoints o servicios, debe consumirlos.

Si todavia no existe una API formal, debe crear una capa frontend simple de servicios/adapters para conectar con la logica existente sin duplicarla.

No debe reimplementar reglas de negocio en el frontend.

El frontend puede validar formularios basicos, pero las reglas importantes deben seguir estando en backend o servicios.

## 23. Tests minimos

Deben existir tests o comprobaciones basicas para:

- Renderizar navegacion principal.
- Mostrar pantalla de inicio.
- Mostrar lista de materiales.
- Mostrar lista de temas.
- Mostrar lista de preguntas.
- No mostrar respuesta correcta durante un test.
- Mostrar resultado despues de enviar.
- Bloquear o indicar aprobacion imposible si hay errores criticos.
- Mostrar estados vacios correctamente.

Si el stack no tiene testing frontend preparado, Claude debe anadir lo minimo razonable sin sobredisenar.

## 24. Criterios de aceptacion

La tarea se considera completada cuando:

- Existe frontend basico navegable.
- La navegacion principal tiene maximo 5 secciones.
- Se puede acceder a material, temario, preguntas y tests.
- Se puede revisar una pregunta.
- Se puede aprobar una pregunta valida.
- Se puede generar un test.
- Se puede realizar un test.
- No se muestran respuestas correctas antes de enviar.
- Se puede ver resultado despues de enviar.
- Se pueden ver explicaciones tras finalizar.
- La interfaz es clara y no esta saturada de botones.
- No se implementan funcionalidades fuera del MVP.
- No se rompe la logica existente.

## 25. Prompt para Claude

Claude, implementa la SPEC 009 - Basic MVP Frontend.

Estamos creando el frontend basico del MVP de TESTOPO.

La interfaz debe ser elegante, simple e intuitiva. No debe parecer una herramienta tecnica ni estar llena de botones.

Implementa una navegacion basica con estas secciones:

- Inicio
- Material
- Temario
- Preguntas
- Tests

Implementa pantallas minimas para:

- Inicio del MVP.
- Gestion basica de material.
- Gestion basica de temario.
- Listado y revision de preguntas.
- Generacion de borradores de preguntas.
- Creacion de tests.
- Realizacion de tests.
- Resultados y revision de explicaciones.

Reglas principales:

- Una accion principal por pantalla.
- Pocos botones.
- No mostrar respuestas correctas antes de enviar un test.
- No aprobar preguntas con errores criticos.
- No duplicar reglas de negocio en el frontend.
- No anadir funcionalidades fuera del MVP.
- Mantener diseno limpio, moderno y facil de usar.

Adaptate al stack existente. Si no hay frontend definido, crea una base simple, mantenible y compatible con el proyecto actual.

No implementes login, pagos, ranking, comunidad, estadisticas avanzadas ni funcionalidades fuera del MVP.
