# SPEC 015 - MVP QA & Manual Test Plan

## 1. Objetivo

Crear un plan de pruebas manuales y de control de calidad para validar el MVP de TESTOPO.

Esta spec no debe anadir funcionalidades nuevas de producto. Su objetivo es documentar y preparar como probar la app de principio a fin.

El MVP debe poder validar estos flujos principales:

```text
Admin/Owner
  -> Crea workspace
  -> Crea oposicion
  -> Sube material
  -> Organiza temario
  -> Genera preguntas
  -> Valida/revisa preguntas
  -> Aprueba preguntas
  -> Da acceso a estudiante
```

```text
Student/Opositor
  -> Accede a oposicion autorizada
  -> Consulta material
  -> Crea test
  -> Responde test
  -> Envia test
  -> Ve resultado
  -> Revisa explicacion y fuente
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
- SPEC 009 - Basic MVP Frontend
- SPEC 010 - Oppositions, Users & Access
- SPEC 011 - Workspaces & Account Plans
- SPEC 012 - PDF Material Upload
- SPEC 013 - Student Portal
- SPEC 014 - Admin/Student UI Separation & Navigation

Esta SPEC 015 debe comprobar que todas funcionan juntas.

## 3. Branch recomendada

```text
feature/mvp-qa-test-plan
```

## 4. Alcance

Claude debe crear:

- Documento de checklist QA.
- Plan de pruebas manuales.
- Lista de flujos criticos.
- Casos positivos.
- Casos negativos.
- Pruebas de permisos.
- Pruebas de interfaz.
- Pruebas de seguridad basica.
- Pruebas de no regresion.
- Datos ficticios de prueba, si el proyecto lo permite.
- Instrucciones para ejecutar tests automaticos existentes.
- Recomendaciones para registrar bugs.

## 5. Fuera de alcance

No implementar:

- Nuevas funcionalidades.
- Sistema real de pagos.
- Estadisticas avanzadas.
- Gamificacion.
- Ranking.
- Comunidad.
- Chat.
- App movil nativa.
- Marketplace.
- Roles empresariales complejos.
- Automatizaciones comerciales.

Esta spec es de QA, no de producto.

## 6. Archivos esperados

Claude debe crear, como minimo:

- `/docs/qa/mvp-manual-test-plan.md`
- `/docs/qa/mvp-checklist.md`
- `/docs/qa/bug-report-template.md`

Opcional, si encaja con el stack:

- `/tests/fixtures/mvp-demo-data.md`

o datos ficticios equivalentes.

## 7. Documento: `/docs/qa/mvp-manual-test-plan.md`

Debe incluir los flujos de prueba paso a paso.

### 7.1 Flujo Admin - Workspace y oposicion

Probar:

1. Crear usuario admin.
2. Iniciar sesion como admin.
3. Crear workspace.
4. Crear oposicion.
5. Entrar en la oposicion.
6. Comprobar que el contexto muestra workspace y oposicion actual.
7. Comprobar que el admin ve navegacion de administracion.

Resultado esperado:

- El admin puede gestionar la oposicion.
- No se mezclan datos de otros workspaces.
- La UI es clara.

### 7.2 Flujo Admin - Material PDF

Probar:

1. Subir PDF dentro de una oposicion.
2. Confirmar que se registra como material.
3. Confirmar que pertenece a la oposicion correcta.
4. Ver estado de extraccion.
5. Ver texto extraido si existe.
6. Asociar material a tema.
7. Marcar material como obsoleto.

Resultado esperado:

- PDF subido correctamente.
- El archivo no se guarda en el repositorio.
- El material queda trazable.
- Material obsoleto no se usa para nuevas preguntas.

### 7.3 Flujo Admin - Temario

Probar:

1. Crear tema raiz.
2. Crear subtema.
3. Editar tema.
4. Marcar tema como obsoleto.
5. Ver arbol de temas.

Resultado esperado:

- La jerarquia funciona.
- No se permiten ciclos.
- Los temas pertenecen a la oposicion correcta.

### 7.4 Flujo Admin - Preguntas

Probar:

1. Crear pregunta manual en borrador.
2. Generar preguntas desde material.
3. Confirmar que las generadas quedan en `draft` o `pending_review`.
4. Ejecutar validacion.
5. Ver errores o advertencias.
6. Editar pregunta.
7. Aprobar pregunta valida.
8. Rechazar pregunta invalida.
9. Marcar pregunta como `needs_fix`.
10. Marcar pregunta como `obsolete`.

Resultado esperado:

- Ninguna pregunta generada queda automaticamente como `validated`.
- Solo preguntas validas pueden aprobarse.
- Todas las preguntas tienen fuente, tema, dificultad y explicacion.

### 7.5 Flujo Admin - Acceso de estudiante

Probar:

1. Crear usuario estudiante.
2. Dar acceso a una oposicion.
3. Ver lista de estudiantes de la oposicion.
4. Revocar acceso.
5. Comprobar que el estudiante pierde acceso.

Resultado esperado:

- El estudiante solo ve oposiciones autorizadas.
- Acceso revocado bloquea entrada.

### 7.6 Flujo Student - Entrada

Probar:

1. Iniciar sesion como estudiante.
2. Ver "Mis oposiciones".
3. Entrar en oposicion autorizada.
4. Intentar acceder a oposicion no autorizada.

Resultado esperado:

- Solo ve oposiciones permitidas.
- No puede acceder a zona admin.

### 7.7 Flujo Student - Material

Probar:

1. Ver material activo.
2. Abrir material permitido.
3. Ver texto extraido si existe.
4. Confirmar que no ve material obsoleto.
5. Confirmar que no ve material `needs_review`.

Resultado esperado:

- Solo material activo y autorizado es visible.

### 7.8 Flujo Student - Test

Probar:

1. Crear test desde oposicion autorizada.
2. Elegir numero de preguntas.
3. Elegir tema opcional.
4. Elegir dificultad.
5. Iniciar test.
6. Responder algunas preguntas.
7. Cambiar una respuesta.
8. Dejar una pregunta sin responder.
9. Enviar test.

Resultado esperado:

- El test usa solo preguntas `validated`.
- No se muestra respuesta correcta antes de enviar.
- No se muestra explicacion antes de enviar.
- El usuario puede cambiar respuestas antes de enviar.

### 7.9 Flujo Student - Resultados

Probar:

1. Ver puntuacion.
2. Ver porcentaje.
3. Ver aciertos.
4. Ver fallos.
5. Ver no respondidas.
6. Revisar respuestas.
7. Ver explicacion.
8. Ver fuente.

Resultado esperado:

- La correccion es correcta.
- Las explicaciones aparecen despues de enviar.
- Las fuentes son legibles y no muestran rutas internas.

## 8. Documento: `/docs/qa/mvp-checklist.md`

Debe incluir una checklist sencilla para validar si el MVP esta listo.

Checklist recomendada:

```markdown
# MVP Checklist

## Producto
- [ ] El admin puede crear workspace.
- [ ] El admin puede crear oposicion.
- [ ] El admin puede subir material.
- [ ] El admin puede subir PDF.
- [ ] El admin puede crear temas.
- [ ] El admin puede generar preguntas.
- [ ] Las preguntas generadas no se validan automaticamente.
- [ ] El admin puede revisar preguntas.
- [ ] El admin puede aprobar preguntas validas.
- [ ] El admin no puede aprobar preguntas invalidas.
- [ ] El admin puede dar acceso a estudiantes.
- [ ] El estudiante solo ve oposiciones autorizadas.
- [ ] El estudiante puede ver material activo.
- [ ] El estudiante puede crear test.
- [ ] El test solo usa preguntas validadas.
- [ ] El estudiante puede responder test.
- [ ] No se muestran respuestas correctas antes de enviar.
- [ ] El estudiante puede ver resultado.
- [ ] El estudiante puede ver explicacion y fuente.

## Seguridad basica
- [ ] Student no puede entrar en admin.
- [ ] Student no puede subir material.
- [ ] Student no puede generar preguntas.
- [ ] Student no puede aprobar preguntas.
- [ ] Student no puede ver preguntas no validadas.
- [ ] Student no puede ver resultados de otros estudiantes.
- [ ] No se mezclan oposiciones.
- [ ] No se mezclan workspaces.
- [ ] Los PDFs no se guardan dentro del repositorio.

## UX
- [ ] La navegacion admin es clara.
- [ ] La navegacion student es clara.
- [ ] Hay pocas acciones por pantalla.
- [ ] Los mensajes de error son comprensibles.
- [ ] Los estados vacios son utiles.
- [ ] La app se puede usar sin conocer detalles tecnicos.
```

## 9. Documento: `/docs/qa/bug-report-template.md`

Debe incluir una plantilla simple.

Contenido recomendado:

```markdown
# Bug Report

## Resumen
[Describe el problema en una frase]

## Tipo
- [ ] Error funcional
- [ ] Error visual
- [ ] Error de permisos
- [ ] Error de datos
- [ ] Error de rendimiento
- [ ] Otro

## Rol usado
- [ ] Admin
- [ ] Student
- [ ] Premium individual
- [ ] Organization owner

## Pasos para reproducir
1.
2.
3.

## Resultado esperado
[Que deberia haber pasado]

## Resultado real
[Que paso realmente]

## Capturas o detalles
[Opcional]

## Gravedad
- [ ] Bloqueante
- [ ] Alta
- [ ] Media
- [ ] Baja

## Notas
[Informacion adicional]
```

## 10. Datos ficticios de prueba

Si el proyecto permite crear fixtures o seed data, preparar datos ficticios.

No usar temarios reales.

Datos recomendados:

### Usuarios

- Admin Demo: `admin@testopo.local`
- Student Demo: `student@testopo.local`
- Premium Demo: `premium@testopo.local`

### Workspace

- Academia Demo
- Mi preparacion personal

### Oposicion

- Oposicion Demo - Administrativo

### Material

- Tema Demo 1 - Constitucion
- Tema Demo 2 - Procedimiento Administrativo

### Preguntas

Crear preguntas ficticias claramente inventadas, sin contenido legal real sensible.

Ejemplos:

- Pregunta demo sobre concepto A.
- Pregunta demo sobre plazo ficticio.
- Pregunta demo sobre organo ficticio.

Debe quedar claro que son datos de prueba.

## 11. Pruebas de permisos criticas

El plan debe comprobar especialmente:

### Student no puede

- Acceder a `/admin`.
- Subir material.
- Generar preguntas.
- Revisar preguntas.
- Aprobar preguntas.
- Ver preguntas `draft`.
- Ver preguntas `pending_review`.
- Ver preguntas `needs_fix`.
- Ver material obsoleto.
- Ver oposiciones no autorizadas.
- Ver resultados de otro usuario.

### Admin puede

- Gestionar workspace propio.
- Gestionar oposicion propia.
- Subir material.
- Generar preguntas.
- Revisar preguntas.
- Aprobar preguntas.
- Dar acceso a estudiantes.

### Premium individual puede

- Gestionar su workspace personal.
- Crear su propia oposicion.
- Subir su material.
- Generar y revisar sus preguntas.
- Crear sus tests.

## 12. Pruebas de integridad de datos

Comprobar:

- Un material pertenece a una oposicion.
- Una oposicion pertenece a un workspace.
- Una pregunta pertenece a una oposicion.
- Un test pertenece a una oposicion.
- Un intento pertenece a un test y usuario.
- No se puede crear test con preguntas de otra oposicion.
- No se puede vincular pregunta a tema de otra oposicion.
- No se puede vincular pregunta a material de otra oposicion.
- No se puede mezclar contenido entre workspaces.

## 13. Pruebas de calidad de preguntas

Comprobar:

- Pregunta sin fuente no se aprueba.
- Pregunta sin explicacion no se aprueba.
- Pregunta con dos respuestas correctas no se aprueba.
- Pregunta con cero respuestas correctas no se aprueba.
- Pregunta con fuente obsoleta no se aprueba.
- Pregunta con tema obsoleto no se aprueba.
- Pregunta generada por IA queda pendiente de revision.
- Solo accion humana explicita puede aprobar.

## 14. Pruebas de test

Comprobar:

- Test no incluye preguntas no validadas.
- Test no incluye preguntas obsoletas.
- Test no incluye preguntas de otra oposicion.
- Test falla si no hay suficientes preguntas.
- Test no muestra soluciones antes de enviar.
- Test permite preguntas sin responder.
- Resultado calcula correctamente:
  - Total.
  - Aciertos.
  - Fallos.
  - No respondidas.
  - Porcentaje.

## 15. Pruebas de PDF

Comprobar:

- PDF se sube correctamente.
- PDF queda como material.
- PDF pertenece a oposicion.
- PDF se guarda fuera del repositorio.
- PDF no valido se rechaza.
- PDF vacio se rechaza.
- PDF demasiado grande se rechaza.
- PDF con texto seleccionable extrae texto.
- PDF escaneado muestra aviso claro.
- Student autorizado puede ver PDF activo.
- Student no autorizado no puede verlo.

## 16. Pruebas de UX

Comprobar:

- La app no tiene demasiados botones por pantalla.
- Admin y Student estan claramente separados.
- El estudiante no ve lenguaje tecnico.
- Los errores son entendibles.
- Los estados vacios ayudan al usuario.
- La accion principal de cada pantalla es clara.
- El flujo completo puede hacerse sin tocar codigo.

## 17. Criterios para considerar MVP listo

El MVP puede considerarse listo para prueba amplia si:

- El flujo admin funciona de punta a punta.
- El flujo student funciona de punta a punta.
- Los permisos basicos funcionan.
- No se mezclan workspaces ni oposiciones.
- Las preguntas no validadas nunca llegan al estudiante.
- Los tests solo usan preguntas validadas.
- Las respuestas correctas no se muestran antes de enviar.
- Los resultados se calculan correctamente.
- Las fuentes y explicaciones se muestran despues del test.
- Los PDFs pueden subirse y registrarse como material.
- No hay errores bloqueantes en el flujo principal.
- La interfaz es comprensible para alguien no tecnico.

## 18. Errores bloqueantes

Considerar bloqueante cualquier error que permita:

- Student accede a admin.
- Student ve preguntas no validadas.
- Test incluye preguntas no validadas.
- Test muestra respuestas antes de enviar.
- Pregunta invalida se aprueba sin control.
- Se mezclan datos entre oposiciones.
- Se mezclan datos entre workspaces.
- Student ve resultados de otro usuario.
- Material privado queda expuesto sin permiso.
- PDF se guarda dentro del repositorio.

## 19. Prompt para Claude

Claude, implementa la SPEC 015 - MVP QA & Manual Test Plan.

Esta spec no debe anadir nuevas funcionalidades de producto.

Debes crear documentacion y, si encaja con el stack actual, datos ficticios de prueba para validar el MVP.

Crea como minimo:

- `/docs/qa/mvp-manual-test-plan.md`
- `/docs/qa/mvp-checklist.md`
- `/docs/qa/bug-report-template.md`

El plan debe cubrir:

- Flujo admin.
- Flujo student.
- Workspace.
- Opposition.
- Material.
- PDF upload.
- Topic map.
- Question generation.
- Question validation.
- Admin review.
- Student portal.
- Test generation.
- Test taking.
- Results.
- Permissions.
- Data integrity.
- UX.

No implementes:

- Nuevas funcionalidades.
- Pagos.
- Ranking.
- Comunidad.
- Estadisticas avanzadas.
- Gamificacion.
- App movil nativa.
- Marketplace.

Si anades fixtures o datos demo, deben ser ficticios y no usar temarios reales.

Regla central:

```text
El objetivo es saber si el MVP esta listo para probarse como usuario real y detectar fallos criticos antes de seguir construyendo.
```
