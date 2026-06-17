# SPEC 013 - Student Portal

## 1. Objetivo

Crear la zona del estudiante/opositor dentro de TESTOPO.

El objetivo es que un estudiante pueda:

- Ver las oposiciones a las que tiene acceso.
- Entrar en una oposicion.
- Consultar material activo.
- Crear tests personalizados desde el pool de preguntas validadas.
- Realizar tests.
- Ver resultados.
- Revisar explicaciones y fuentes despues de enviar el test.

La zona del estudiante debe ser sencilla, limpia y separada de la zona de administracion.

## 2. Contexto del producto

TESTOPO tiene dos grandes experiencias:

```text
Admin / Owner / Preparador
  -> Crea workspace
  -> Crea oposicion
  -> Sube material
  -> Genera preguntas
  -> Revisa y valida preguntas
  -> Crea pool de preguntas validado
  -> Da acceso a estudiantes
```

```text
Student / Opositor
  -> Accede a una oposicion permitida
  -> Consulta material
  -> Crea tests desde preguntas validadas
  -> Responde tests
  -> Ve resultados, explicaciones y fuentes
```

Esta spec desarrolla solo el segundo flujo.

## 3. Branch recomendada

```text
feature/student-portal
```

## 4. Principio central

El estudiante consume contenido validado.

No puede:

- Subir material.
- Editar material.
- Generar preguntas.
- Editar preguntas.
- Validar preguntas.
- Revisar preguntas.
- Aprobar preguntas.
- Rechazar preguntas.
- Ver preguntas no validadas.
- Ver respuestas correctas antes de enviar un test.
- Acceder a oposiciones no autorizadas.

## 5. Alcance

Claude debe implementar:

- Portal basico del estudiante.
- Pagina "Mis oposiciones".
- Acceso a una oposicion autorizada.
- Vista de material activo de la oposicion.
- Consulta de material y texto extraido si existe.
- Creacion de tests dentro de una oposicion.
- Realizacion de tests.
- Resultados del test.
- Revision de respuestas con explicacion y fuente.
- Proteccion de acceso por usuario/workspace/oposicion.
- Navegacion simple separada de admin.
- Tests automaticos de reglas criticas.

## 6. Fuera de alcance

No implementar todavia:

- Pagos.
- Suscripciones.
- Ranking.
- Comunidad.
- Chat.
- Gamificacion avanzada.
- Estadisticas avanzadas.
- Plan de estudio inteligente.
- Repeticion espaciada.
- Recomendaciones automaticas.
- Certificados.
- Foros.
- Comentarios sobre preguntas.
- Reportes de preguntas desde estudiante, salvo que ya exista algo muy basico.
- App movil nativa.
- Panel avanzado de progreso.

Esta spec solo crea el portal minimo del estudiante para el MVP.

## 7. Estructura de navegacion del estudiante

La navegacion del estudiante debe ser muy simple.

Secciones recomendadas:

- Mis oposiciones
- Material
- Tests
- Resultados

Dentro de una oposicion:

- Inicio
- Material
- Crear test
- Mis resultados

No mostrar secciones de administracion.

No mostrar:

- Preguntas pendientes
- Validacion
- Revision
- Generacion de preguntas
- Subida de material
- Temario editable
- Usuarios
- Configuracion avanzada

## 8. Pantalla "Mis oposiciones"

Debe mostrar las oposiciones a las que el estudiante tiene acceso activo.

Cada oposicion puede mostrarse como tarjeta:

- Auxiliar Administrativo del Estado
- Academia OpoNorte
- Material disponible: X documentos
- Tests realizados: X
- Accion: Entrar

Reglas:

- Solo mostrar oposiciones autorizadas.
- No mostrar oposiciones archivadas si no corresponde.
- No mostrar workspaces donde el usuario no sea miembro activo.
- Si no tiene oposiciones, mostrar estado vacio claro.

Mensaje recomendado:

```text
Todavia no tienes acceso a ninguna oposicion.
Cuando un administrador te de acceso, aparecera aqui.
```

## 9. Inicio de oposicion para estudiante

Al entrar en una oposicion, mostrar una pantalla simple con:

- Nombre de la oposicion.
- Nombre del workspace o academia.
- Acceso rapido a material.
- Boton principal: Crear test.
- Ultimos resultados, si existen.
- Aviso si no hay suficientes preguntas validadas.

Ejemplo:

```text
Auxiliar Administrativo del Estado

Acciones:
- Crear test
- Ver material
- Ver resultados
```

Debe haber una accion principal clara: Crear test.

## 10. Material para estudiante

El estudiante debe poder ver materiales activos de la oposicion.

Debe mostrar:

- Titulo.
- Tipo de material.
- Referencia.
- Tema relacionado, si existe.
- Estado de extraccion de texto.
- Accion para ver material.

Solo mostrar materiales con estado:

- `active`

No mostrar materiales:

- `obsolete`
- `deprecated`
- `needs_review`

salvo que una spec futura indique lo contrario.

## 11. Consulta de material

Al abrir un material, el estudiante debe poder ver:

- Titulo.
- Descripcion.
- Tipo.
- Referencia.
- Temas asociados.
- Texto extraido si existe.
- Enlace o accion para abrir/descargar PDF si el sistema lo permite.

Si el PDF no tiene texto extraido, mostrar mensaje claro:

```text
Este material esta disponible como PDF, pero no tiene texto extraido.
```

Si no existe visor o descarga controlada todavia, mostrar solo los metadatos y dejar documentado.

## 12. Crear test como estudiante

El estudiante debe poder crear tests dentro de una oposicion autorizada.

Formulario simple:

- Numero de preguntas
- Tema opcional
- Dificultad
- Modo

### Numero de preguntas

Opciones rapidas:

- 10
- 20
- 30
- 50

Tambien puede permitirse numero personalizado si ya existe en SPEC 007.

### Tema

Opcional.

Debe listar solo temas activos de esa oposicion.

### Dificultad

Valores:

- Facil
- Media
- Dificil
- Mixta

Internamente:

- `easy`
- `medium`
- `hard`
- `mixed`

### Modo

Valores visibles:

- Aleatorio
- Por tema
- Por dificultad
- Mixto

No mostrar detalles tecnicos de filtros.

## 13. Reglas para crear test

El test del estudiante debe:

- Pertenecer a la oposicion actual.
- Pertenecer al usuario o intento del estudiante.
- Usar solo preguntas `validated`.
- Usar solo preguntas de la oposicion actual.
- Excluir preguntas obsoletas.
- Excluir fuentes/materiales obsoletos.
- Excluir temas obsoletos.
- No mostrar respuestas correctas antes de enviar.

Si no hay suficientes preguntas:

```text
No hay suficientes preguntas validadas para crear este test.
Prueba con menos preguntas o cambia los filtros.
```

## 14. Realizar test

La pantalla de test debe ser limpia.

Debe mostrar:

- Pregunta actual.
- Opciones.
- Progreso.
- Boton siguiente/anterior.
- Boton enviar test.

Ejemplo:

```text
Pregunta 3 de 20
```

Reglas:

- El estudiante puede cambiar respuestas antes de enviar.
- El estudiante puede dejar preguntas sin responder.
- No mostrar explicacion antes de enviar.
- No mostrar respuesta correcta antes de enviar.
- No mostrar si una opcion es correcta o incorrecta antes de enviar.

## 15. Enviar test

Al enviar:

- Confirmar la accion.
- Finalizar intento.
- Calcular resultado.
- Mostrar pantalla de resultado.

Mensaje de confirmacion recomendado:

```text
Quieres enviar el test? Despues de enviarlo no podras cambiar tus respuestas.
```

## 16. Resultados

Despues de enviar, mostrar:

- Puntuacion.
- Porcentaje.
- Aciertos.
- Fallos.
- No respondidas.
- Boton para revisar respuestas.

Ejemplo:

```text
Resultado: 16 / 20
Porcentaje: 80%
Aciertos: 16
Fallos: 3
Sin responder: 1
```

No implementar estadisticas avanzadas todavia.

## 17. Revision de respuestas

El estudiante debe poder revisar cada pregunta despues de enviar.

Debe ver:

- Enunciado.
- Opciones.
- Respuesta elegida.
- Respuesta correcta.
- Explicacion.
- Tema.
- Dificultad.
- Fuente o referencia.
- Material asociado si existe.

Distinguir claramente:

- Correcta
- Incorrecta
- Sin responder

La explicacion es clave para el aprendizaje.

## 18. Fuentes en revision

Cada pregunta revisada debe mostrar la fuente de forma entendible.

Ejemplos:

- `Fuente: Tema 1 - Constitucion Espanola, apartado 2.1`
- `Fuente: Ley 39/2015, articulo 14`
- `Fuente: PDF Temario Administrativo, pagina 23`

No exponer rutas internas como:

```text
/uploads/private/uuid.pdf
```

## 19. Permisos

### Estudiante puede

- Ver sus workspaces autorizados.
- Ver sus oposiciones autorizadas.
- Ver material activo.
- Crear tests.
- Responder tests.
- Ver sus resultados.
- Ver explicaciones tras enviar.
- Ver fuentes de preguntas respondidas.

### Estudiante no puede

- Entrar en oposiciones no autorizadas.
- Ver material no activo.
- Ver preguntas no validadas.
- Ver preguntas pendientes de revision.
- Ver informes internos de validacion.
- Subir material.
- Generar preguntas.
- Editar preguntas.
- Aprobar preguntas.
- Rechazar preguntas.
- Ver resultados de otros estudiantes.

## 20. Operaciones minimas

Claude debe implementar estas operaciones segun el stack actual.

### 20.1 Listar oposiciones del estudiante

Entrada:

- `current_user`

Salida:

- `oppositions[]`

Solo oposiciones autorizadas.

### 20.2 Ver oposicion del estudiante

Entrada:

- `opposition_id`
- `current_user`

Debe verificar acceso.

### 20.3 Listar material visible

Entrada:

- `opposition_id`
- `current_user`

Debe devolver solo material activo.

### 20.4 Ver material

Entrada:

- `material_id`
- `current_user`

Debe verificar:

- Acceso a la oposicion.
- Material activo.

### 20.5 Crear test de estudiante

Entrada:

- `opposition_id`
- `question_count`
- `topic_id`
- `difficulty`
- `mode`
- `current_user`

Debe reutilizar SPEC 007 y filtrar por oposicion.

### 20.6 Iniciar intento

Debe reutilizar SPEC 008.

### 20.7 Guardar respuesta

Debe reutilizar SPEC 008.

### 20.8 Enviar test

Debe reutilizar SPEC 008.

### 20.9 Ver resultado

Debe reutilizar SPEC 008.

Solo para el propietario del intento.

### 20.10 Ver revision

Debe reutilizar SPEC 008.

Solo despues de enviar.

## 21. Cambios frontend

Crear o adaptar rutas/pantallas para estudiante.

Rutas sugeridas:

- `/student`
- `/student/oppositions`
- `/student/oppositions/:oppositionId`
- `/student/oppositions/:oppositionId/material`
- `/student/oppositions/:oppositionId/tests/new`
- `/student/attempts/:attemptId`
- `/student/attempts/:attemptId/result`
- `/student/attempts/:attemptId/review`

Si el stack usa otra estructura, adaptar manteniendo separacion clara.

## 22. Diseno UX

La zona estudiante debe ser todavia mas simple que la zona admin.

Reglas:

- Pocas opciones.
- Un boton principal por pantalla.
- Lenguaje de estudiante, no lenguaje tecnico.
- Nada de estados internos como `pending_review` o `needs_fix`.
- Nada de validaciones tecnicas visibles.
- Explicaciones claras.
- Fuentes visibles despues de responder.
- Material facil de encontrar.
- Crear test debe ser rapido.

Frase guia:

```text
El estudiante entra para estudiar, no para administrar.
```

## 23. Validaciones minimas

Errores recomendados:

- `STUDENT_ACCESS_REQUIRED`
- `STUDENT_OPPOSITION_NOT_FOUND`
- `STUDENT_OPPOSITION_ACCESS_DENIED`
- `STUDENT_MATERIAL_NOT_FOUND`
- `STUDENT_MATERIAL_ACCESS_DENIED`
- `STUDENT_MATERIAL_NOT_AVAILABLE`
- `STUDENT_TEST_CREATION_DENIED`
- `STUDENT_NOT_ENOUGH_VALIDATED_QUESTIONS`
- `STUDENT_ATTEMPT_NOT_FOUND`
- `STUDENT_ATTEMPT_ACCESS_DENIED`
- `STUDENT_REVIEW_NOT_AVAILABLE`
- `STUDENT_CANNOT_ACCESS_ADMIN_AREA`

## 24. Tests automaticos obligatorios

Deben existir tests para comprobar:

- Un estudiante ve solo sus oposiciones autorizadas.
- Un estudiante no ve oposiciones no autorizadas.
- Un estudiante puede entrar en una oposicion autorizada.
- Un estudiante no puede entrar en una oposicion no autorizada.
- Un estudiante ve solo material activo.
- Un estudiante no ve material obsoleto.
- Un estudiante no ve material `needs_review`.
- Un estudiante no puede subir material.
- Un estudiante no puede generar preguntas.
- Un estudiante no puede revisar preguntas.
- Un estudiante no puede aprobar preguntas.
- Un estudiante puede crear test en oposicion autorizada.
- Un estudiante no puede crear test en oposicion no autorizada.
- El test usa solo preguntas `validated`.
- El test usa solo preguntas de la oposicion actual.
- No se muestran respuestas correctas antes de enviar.
- No se muestran explicaciones antes de enviar.
- El estudiante puede guardar respuestas.
- El estudiante puede enviar test.
- El estudiante ve resultado despues de enviar.
- El estudiante ve explicacion y fuente despues de enviar.
- El estudiante no puede ver resultados de otro estudiante.
- El estudiante no puede consultar revision antes de enviar.
- No se rompen tests existentes de SPEC 001 a SPEC 012.

## 25. Criterios de aceptacion

La tarea se considera completada cuando:

- Existe una zona de estudiante separada.
- El estudiante puede ver "Mis oposiciones".
- El estudiante solo ve oposiciones autorizadas.
- El estudiante puede entrar en una oposicion.
- El estudiante puede ver material activo.
- El estudiante puede consultar material permitido.
- El estudiante puede crear un test.
- El test solo usa preguntas validadas de esa oposicion.
- El estudiante puede realizar el test.
- No se muestran respuestas correctas antes de enviar.
- El estudiante puede enviar el test.
- El estudiante ve resultado.
- El estudiante ve revision con explicacion.
- El estudiante ve fuentes de las preguntas.
- El estudiante no puede acceder a funciones de administracion.
- Existen tests de permisos y reglas criticas.
- No se anaden funcionalidades fuera del MVP.

## 26. Notas tecnicas para Claude

Claude debe adaptarse al stack actual.

Prioridades:

- Reutilizar SPEC 007 para generacion de tests.
- Reutilizar SPEC 008 para intentos y resultados.
- Reutilizar permisos de SPEC 010 y SPEC 011.
- Conectar con SPEC 012 para consulta de material PDF y texto extraido cuando exista.
- No duplicar logica de negocio en frontend.
- Separar rutas o vistas de estudiante y admin.
- No mostrar informacion interna al estudiante.
- No exponer rutas privadas de archivos.
- Mantener UI clara y simple.
- Anadir tests de acceso.
- Si todavia no existe login completamente estable, usar el sistema actual de usuario autenticado o mock de usuario, pero dejar la logica preparada para autenticacion real.

## 27. Prompt para Claude

Claude, implementa la SPEC 013 - Student Portal.

Queremos crear la zona del estudiante/opositor dentro de TESTOPO.

El estudiante debe poder:

- Ver sus oposiciones autorizadas.
- Entrar en una oposicion.
- Consultar material activo.
- Crear tests desde preguntas validadas.
- Realizar tests.
- Enviar respuestas.
- Ver resultados.
- Revisar explicaciones y fuentes.

Debes implementar:

- Portal o rutas de estudiante.
- Pantalla "Mis oposiciones".
- Pantalla de inicio de oposicion.
- Vista de material activo.
- Vista de detalle de material.
- Creacion de tests para estudiante.
- Realizacion de test.
- Resultado.
- Revision con explicaciones y fuentes.
- Proteccion de permisos.
- Bloqueo de acceso a funciones admin.
- Tests automaticos de reglas criticas.

No implementes todavia:

- Pagos.
- Suscripciones.
- Ranking.
- Comunidad.
- Chat.
- Gamificacion avanzada.
- Estadisticas avanzadas.
- Plan inteligente de estudio.
- Repeticion espaciada.
- Reportes avanzados.
- App movil nativa.

Reglas centrales:

1. El estudiante solo puede ver oposiciones autorizadas.
2. El estudiante solo puede ver material activo.
3. El estudiante solo puede crear tests con preguntas `validated`.
4. El estudiante no puede generar, editar, revisar ni aprobar preguntas.
5. El estudiante no puede ver respuestas correctas antes de enviar un test.
6. Despues de enviar, debe poder ver resultado, explicacion y fuente.
7. El estudiante no puede ver resultados de otros estudiantes.

Manten la implementacion simple, elegante y compatible con SPEC 001 a SPEC 012. No rompas tests existentes.
