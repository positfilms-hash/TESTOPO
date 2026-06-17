# MVP Checklist (SPEC 015)

Checklist para decidir si el MVP de TESTOPO está listo para una prueba amplia
como usuario real. Marca cada casilla tras verificarla con el
[`mvp-manual-test-plan.md`](./mvp-manual-test-plan.md). Cubre SPEC 001-014.

## Producto
- [ ] El admin puede crear workspace.
- [ ] El admin puede crear oposición.
- [ ] El admin puede subir material (texto manual).
- [ ] El admin puede subir PDF.
- [ ] El admin puede crear temas (raíz y subtemas).
- [ ] El admin puede generar preguntas desde material.
- [ ] Las preguntas generadas NO se validan automáticamente.
- [ ] El admin puede validar/revisar preguntas.
- [ ] El admin puede aprobar preguntas válidas.
- [ ] El admin NO puede aprobar preguntas inválidas.
- [ ] El admin puede dar y revocar acceso a estudiantes.
- [ ] El estudiante solo ve oposiciones autorizadas.
- [ ] El estudiante puede ver material activo.
- [ ] El estudiante puede crear test.
- [ ] El test solo usa preguntas validadas.
- [ ] El estudiante puede responder y enviar el test.
- [ ] No se muestran respuestas correctas antes de enviar.
- [ ] El estudiante puede ver el resultado.
- [ ] El estudiante puede ver explicación y fuente tras enviar.

## Seguridad básica
- [ ] Student no puede entrar en la zona admin.
- [ ] Student no puede subir material.
- [ ] Student no puede generar preguntas.
- [ ] Student no puede revisar/aprobar/rechazar preguntas.
- [ ] Student no puede ver preguntas no validadas (`draft`/`pending_review`/`needs_fix`).
- [ ] Student no puede ver resultados de otros estudiantes.
- [ ] No se mezclan oposiciones.
- [ ] No se mezclan workspaces.
- [ ] Los PDFs no se guardan dentro del repositorio.

## Permisos
- [ ] Admin gestiona su workspace y su oposición.
- [ ] Premium individual gestiona su workspace personal (owner).
- [ ] La capacidad la decide el ROL DE WORKSPACE, no el rol global del usuario.
- [ ] El acceso revocado bloquea la entrada a la oposición.
- [ ] Las reglas reales se aplican en backend/servicios (no solo ocultando botones).

## Integridad de datos
- [ ] Un material pertenece a una oposición.
- [ ] Una oposición pertenece a un workspace.
- [ ] Una pregunta pertenece a una oposición.
- [ ] Un test pertenece a una oposición.
- [ ] Un intento pertenece a un test y a un usuario.
- [ ] No se puede crear test con preguntas de otra oposición.
- [ ] No se puede vincular pregunta a tema de otra oposición.
- [ ] No se puede vincular pregunta a material de otra oposición.
- [ ] No se mezcla contenido entre workspaces.

## Calidad de preguntas
- [ ] Pregunta sin fuente no se aprueba.
- [ ] Pregunta sin explicación no se aprueba.
- [ ] Pregunta con dos respuestas correctas no se aprueba.
- [ ] Pregunta con cero respuestas correctas no se aprueba.
- [ ] Pregunta con fuente obsoleta no se aprueba.
- [ ] Pregunta con tema obsoleto no se aprueba.
- [ ] Pregunta generada por IA queda pendiente de revisión.
- [ ] Solo una acción humana explícita puede aprobar.

## Tests (generación y realización)
- [ ] El test no incluye preguntas no validadas.
- [ ] El test no incluye preguntas obsoletas.
- [ ] El test no incluye preguntas de otra oposición.
- [ ] El test falla (con mensaje claro) si no hay suficientes preguntas.
- [ ] El test no muestra soluciones antes de enviar.
- [ ] El test permite dejar preguntas sin responder.
- [ ] El resultado calcula bien total, aciertos, fallos, no respondidas y porcentaje.

## PDF
- [ ] El PDF se sube correctamente.
- [ ] El PDF queda como material en la oposición.
- [ ] El PDF se guarda fuera del repositorio (carpeta ignorada por Git).
- [ ] Un archivo no PDF se rechaza.
- [ ] Un PDF vacío se rechaza.
- [ ] Un PDF demasiado grande (> 50 MB) se rechaza.
- [ ] Un PDF con texto seleccionable extrae texto.
- [ ] Un PDF escaneado/sin texto muestra aviso claro.
- [ ] Student autorizado puede ver el PDF activo.
- [ ] Student no autorizado no puede verlo.

## UX
- [ ] La navegación admin es clara y orientada a gestión.
- [ ] La navegación student es clara y orientada al estudio.
- [ ] Hay pocas acciones por pantalla (una principal clara).
- [ ] Los mensajes de error son comprensibles.
- [ ] Los estados vacíos son útiles.
- [ ] El estudiante no ve lenguaje técnico.
- [ ] La app se puede usar sin conocer detalles técnicos.

## Tests automáticos
- [ ] `cd app/backend && npm run typecheck` sin errores.
- [ ] `cd app/backend && npm test` en verde.
- [ ] `cd app/frontend && npm run build` OK.
- [ ] `cd app/frontend && npm test` en verde.

---

## Errores bloqueantes (cualquiera invalida el MVP)
- [ ] Student accede a admin.
- [ ] Student ve preguntas no validadas.
- [ ] Un test incluye preguntas no validadas.
- [ ] Un test muestra respuestas antes de enviar.
- [ ] Una pregunta inválida se aprueba sin control.
- [ ] Se mezclan datos entre oposiciones.
- [ ] Se mezclan datos entre workspaces.
- [ ] Student ve resultados de otro usuario.
- [ ] Material privado queda expuesto sin permiso.
- [ ] Un PDF se guarda dentro del repositorio.

## Criterio de "MVP listo"
El MVP está listo para prueba amplia cuando **todas** las casillas de Producto,
Seguridad básica y Permisos están marcadas, los tests automáticos pasan y
**ningún** error bloqueante está presente.
