# SPEC 016 - MVP Fixes & Polish

## 1. Objetivo

Corregir errores, pulir la experiencia de usuario y estabilizar el MVP de TESTOPO despues de las pruebas realizadas con la SPEC 015 - MVP QA & Manual Test Plan.

Esta spec no debe introducir funcionalidades grandes nuevas. Su objetivo es mejorar lo que ya existe.

## 2. Contexto

El MVP ya incluye:

- Workspaces.
- Planes.
- Usuarios.
- Oposiciones.
- Materiales.
- Subida de PDF.
- Temario.
- Banco de preguntas.
- Generacion de preguntas.
- Validacion de preguntas.
- Revision admin.
- Portal estudiante.
- Generacion de tests.
- Realizacion de tests.
- Resultados.
- Separacion admin/student.
- Plan de QA.

Ahora toca corregir fallos y dejar el producto mas solido.

## 3. Branch recomendada

```text
feature/mvp-fixes-polish
```

## 4. Alcance

Claude debe trabajar sobre:

- Bugs detectados en QA.
- Errores de permisos.
- Errores de navegacion.
- Problemas de flujo admin.
- Problemas de flujo student.
- Problemas de generacion de tests.
- Problemas de revision de preguntas.
- Problemas de subida o consulta de material.
- Problemas de PDF.
- Mensajes de error poco claros.
- Estados vacios.
- Ajustes visuales basicos.
- Inconsistencias de idioma.
- Tests automaticos rotos o insuficientes.

## 5. Fuera de alcance

No implementar todavia:

- Pagos.
- Suscripciones.
- Stripe.
- Marketplace.
- Ranking.
- Comunidad.
- Chat.
- Gamificacion.
- Estadisticas avanzadas.
- Plan de estudio inteligente.
- Repeticion espaciada.
- App movil nativa.
- Roles empresariales complejos.
- Analitica avanzada.
- OCR.
- RAG avanzado.
- Indexacion vectorial.
- Generacion automatica sin revision humana.

Esta spec es de correccion y pulido, no de expansion.

## 6. Prioridad de correcciones

Claude debe priorizar en este orden:

### Prioridad 1 - Bloqueantes

Errores que impiden usar el MVP o comprometen seguridad.

Ejemplos:

- Student puede entrar en zona admin.
- Student ve preguntas no validadas.
- Test incluye preguntas no validadas.
- Test muestra respuestas correctas antes de enviar.
- Se mezclan datos entre workspaces.
- Se mezclan datos entre oposiciones.
- Student ve resultados de otro estudiante.
- Pregunta invalida se puede aprobar.
- PDF privado queda accesible sin permisos.
- La app no permite completar el flujo principal.

### Prioridad 2 - Funcionales importantes

Errores que no rompen seguridad, pero afectan al uso.

Ejemplos:

- No se puede subir material correctamente.
- No se puede crear tema.
- No se puede generar pregunta desde material valido.
- No se puede aprobar pregunta valida.
- No se puede crear test con preguntas suficientes.
- No se calculan bien resultados.
- No aparecen explicaciones o fuentes tras enviar.
- No se actualizan estados correctamente.

### Prioridad 3 - UX y claridad

Problemas que hacen la app confusa.

Ejemplos:

- Demasiados botones.
- Acciones duplicadas.
- Mensajes tecnicos.
- Estados vacios poco claros.
- Navegacion confusa.
- Admin y student poco diferenciados.
- Formularios largos o desordenados.
- Etiquetas internas visibles como `pending_review` o `needs_fix`.

### Prioridad 4 - Pulido visual basico

Ajustes de acabado.

Ejemplos:

- Espaciado.
- Jerarquia visual.
- Botones principales.
- Tarjetas.
- Badges.
- Consistencia de colores.
- Consistencia de idioma.

## 7. Reglas de seguridad que no pueden romperse

Deben mantenerse siempre estas reglas:

1. Un estudiante no puede acceder a zona admin.
2. Un estudiante no puede ver preguntas no validadas.
3. Un estudiante no puede generar, editar, revisar ni aprobar preguntas.
4. Un test normal solo puede usar preguntas `validated`.
5. No se muestran respuestas correctas antes de enviar un test.
6. No se muestran explicaciones antes de enviar un test.
7. Un estudiante solo puede ver sus propias oposiciones autorizadas.
8. Un estudiante solo puede ver sus propios resultados.
9. No se mezclan entidades entre oposiciones.
10. No se mezclan entidades entre workspaces.
11. Los PDFs privados no deben exponerse sin permiso.
12. Las preguntas generadas no pueden validarse automaticamente.

## 8. Reglas de producto que deben mantenerse

- Toda pregunta validada debe tener fuente.
- Toda pregunta validada debe tener explicacion.
- Toda pregunta validada debe tener exactamente una respuesta correcta.
- Toda pregunta validada debe tener tema.
- Toda pregunta validada debe tener dificultad.
- Toda pregunta validada debe pertenecer a una oposicion.
- Toda oposicion debe pertenecer a un workspace.
- Todo material debe pertenecer a una oposicion.
- Solo owner/admin puede gestionar contenido.
- Student solo estudia.

## 9. Ajustes UX recomendados

Claude debe revisar y mejorar, si procede:

### 9.1 Navegacion

- Que admin y student esten claramente separados.
- Que el usuario sepa en que workspace esta.
- Que el usuario sepa en que oposicion esta.
- Que el menu no tenga opciones innecesarias.
- Que no haya rutas rotas.

### 9.2 Botones

- Una accion principal por pantalla.
- Botones secundarios menos destacados.
- Acciones destructivas con confirmacion.
- No mostrar botones que el usuario no puede usar.

### 9.3 Mensajes

Sustituir errores tecnicos por mensajes entendibles.

Ejemplos:

Incorrecto:

```text
QUESTION_SOURCE_REQUIRED
```

Correcto para usuario:

```text
Esta pregunta no puede aprobarse porque no tiene fuente asociada.
```

Incorrecto:

```text
TEST_NOT_ENOUGH_VALIDATED_QUESTIONS
```

Correcto para usuario:

```text
No hay suficientes preguntas validadas para crear este test. Prueba con menos preguntas o cambia los filtros.
```

### 9.4 Estados vacios

Asegurar estados claros:

- Todavia no has subido material.
- No hay preguntas pendientes de revision.
- No hay suficientes preguntas validadas para crear un test.
- Todavia no tienes acceso a ninguna oposicion.
- Todavia no has realizado ningun test.

### 9.5 Idioma

La interfaz visible debe estar en espanol.

Evitar mostrar al usuario final:

- `draft`
- `pending_review`
- `needs_fix`
- `validated`
- `source object`
- `attempt`
- `payload`

Usar:

- Borrador
- Pendiente de revision
- Necesita correccion
- Validada
- Fuente
- Intento
- Resultado

## 10. Revision de flujo admin

Claude debe comprobar y corregir:

- Crear workspace.
- Crear oposicion.
- Subir material.
- Subir PDF.
- Ver texto extraido.
- Crear temas.
- Generar preguntas.
- Validar preguntas.
- Revisar preguntas.
- Aprobar preguntas validas.
- Bloquear aprobacion de preguntas invalidas.
- Dar acceso a estudiante.
- Revocar acceso a estudiante.

## 11. Revision de flujo student

Claude debe comprobar y corregir:

- Ver solo oposiciones autorizadas.
- Entrar en oposicion.
- Ver material activo.
- No ver material obsoleto.
- Crear test.
- Realizar test.
- Cambiar respuestas antes de enviar.
- Enviar test.
- Ver resultado.
- Ver explicacion.
- Ver fuente.
- No acceder a zona admin.

## 12. Revision de tests automaticos

Claude debe:

- Ejecutar o revisar tests existentes.
- Corregir tests rotos.
- Anadir tests para bugs corregidos.
- Asegurar que no se rompen specs anteriores.
- Anadir tests de regresion para errores bloqueantes.

Cada bug corregido deberia tener, si es posible, un test que evite que reaparezca.

## 13. Documento de bugs corregidos

Crear o actualizar:

```text
/docs/qa/mvp-fixes-log.md
```

Debe incluir:

```markdown
# MVP Fixes Log

## Bug corregido

### Resumen
[Descripcion breve]

### Gravedad
Bloqueante / Alta / Media / Baja

### Area afectada
Admin / Student / Material / Preguntas / Tests / Resultados / Permisos / UX

### Causa
[Breve explicacion tecnica o funcional]

### Solucion
[Que se cambio]

### Test añadido
[Si/No - descripcion]
```

## 14. Validaciones minimas despues de corregir

Al finalizar, deben seguir funcionando:

- Tests automaticos existentes.
- Flujo admin completo.
- Flujo student completo.
- Subida de PDF.
- Generacion de preguntas.
- Revision humana.
- Generacion de tests.
- Realizacion de tests.
- Resultados.
- Permisos.
- Separacion admin/student.

## 15. Criterios de aceptacion

La tarea se considera completada cuando:

- Los errores bloqueantes detectados en QA estan corregidos.
- No se han anadido funcionalidades fuera del MVP.
- La navegacion admin/student es clara.
- El estudiante no puede acceder a funciones admin.
- El estudiante solo ve contenido autorizado.
- Los tests solo usan preguntas validadas.
- No se muestran respuestas antes de enviar.
- Los resultados se calculan correctamente.
- Los mensajes de error son mas claros.
- Los estados vacios son utiles.
- La interfaz esta mas limpia.
- Los tests automaticos pasan.
- Existe `/docs/qa/mvp-fixes-log.md`.
- Los bugs corregidos quedan documentados.

## 16. Prompt para Claude

Claude, implementa la SPEC 016 - MVP Fixes & Polish.

Esta spec no debe añadir funcionalidades grandes nuevas. Su objetivo es corregir bugs, mejorar UX basica y estabilizar el MVP de TESTOPO.

Debes:

- Revisar los resultados de QA de la SPEC 015.
- Corregir errores bloqueantes.
- Corregir problemas de permisos.
- Corregir problemas de navegacion.
- Corregir problemas del flujo admin.
- Corregir problemas del flujo student.
- Corregir errores de generacion de tests.
- Corregir errores de resultados.
- Mejorar mensajes de error visibles.
- Mejorar estados vacios.
- Pulir interfaz basica.
- Anadir tests de regresion para bugs corregidos.
- Crear o actualizar `/docs/qa/mvp-fixes-log.md`.

No implementes:

- Pagos.
- Suscripciones.
- Marketplace.
- Ranking.
- Comunidad.
- Chat.
- Gamificacion.
- Estadisticas avanzadas.
- OCR.
- RAG.
- App movil nativa.
- Nuevas funcionalidades grandes fuera del MVP.

Reglas centrales:

1. No romper specs anteriores.
2. No anadir alcance nuevo.
3. Priorizar errores bloqueantes.
4. Mantener separacion admin/student.
5. Mantener seguridad de permisos.
6. Mantener preguntas no validadas fuera del estudiante.
7. Mantener respuestas correctas ocultas hasta enviar el test.

El objetivo es dejar el MVP estable, claro y usable para pruebas mas amplias.
