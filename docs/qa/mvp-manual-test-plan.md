# TESTOPO - Plan de pruebas manuales del MVP (SPEC 015)

> Objetivo: validar de punta a punta los flujos de **administrador** y de
> **estudiante** antes de seguir construyendo. Este documento **no** describe
> funcionalidad nueva: solo cómo probar lo que ya existe (SPEC 001-014).

## 0. Antes de empezar

### 0.1 Cómo arrancar la app

El frontend es un MVP que corre **en el navegador** (SPEC 009): toda la lógica
de negocio se ejecuta en memoria por sesión, sin servidor ni base de datos.
**Recargar la página reinicia los datos al estado sembrado (seed).**

```bash
cd app/frontend
npm install      # solo la primera vez
npm run dev      # abre el servidor de desarrollo (Vite)
```

### 0.2 Credenciales demo (datos ficticios sembrados)

La app arranca con datos de prueba claramente inventados (la constitución del
proyecto prohíbe usar material real). En la pantalla de login hay botones de
acceso rápido **"Entrar como Admin"** y **"Entrar como Estudiante"**.

| Rol | Email | Contraseña |
| --- | --- | --- |
| Admin (owner del workspace) | `admin@testopo.dev` | `admin1234` |
| Estudiante (acceso a la oposición) | `alumno@testopo.dev` | `alumno1234` |

> Nota: la SPEC 015 sugería nombres `*.local` y un usuario Premium. El seed
> actual usa los emails `*.dev` de arriba. El rol Premium individual se puede
> probar creando un **workspace personal (plan premium)** desde "Mis espacios"
> (ver flujo 7.10). No hay pantalla de registro: los usuarios se crean por seed.

### 0.3 Datos sembrados de referencia

- **Workspace:** `Workspace MVP` (tipo organización). El admin es `owner`; el
  estudiante es miembro con rol `student`.
- **Oposición:** `Oposicion MVP`.
- **Material:** `Tema 1 - Constitucion (ficticio)` (activo, con texto).
- **Temas:** `T1 - Tema 1 - Constitucion`, `T1.1 - Derechos fundamentales`,
  `T2 - Tema 2 - Procedimiento administrativo`.
- **Preguntas:** 10 ficticias — 8 `validated` y 2 `pending_review`.

### 0.4 Zonas y navegación esperadas

- **Zona Administración** (gestor owner/admin). Navegación: `Resumen`,
  `Material`, `Temario`, `Preguntas`, `Tests`, `Alumnos`.
- **Zona Estudio** (estudiante con matrícula). Navegación: `Inicio`,
  `Material`, `Crear test`, `Mis resultados`.
- La barra lateral muestra el **distintivo de zona** (Administracion / Estudio)
  y el contexto (espacio / oposición / rol).
- Si un usuario puede **gestionar y estudiar** a la vez aparece un selector
  ("¿Qué quieres hacer?"). Con un solo rol entra directo a su zona.

---

## 1. Flujo Admin

### 7.1 Workspace y oposición

**Pasos**
1. Entrar como Admin (`admin@testopo.dev`).
2. En "Mis espacios" entrar en `Workspace MVP`.
3. En "Oposiciones" entrar en `Oposicion MVP` (o crear una nueva con título y
   slug únicos).
4. Observar la cabecera de contexto y la navegación.

**Resultado esperado**
- Tras entrar, la zona es **Administración** (distintivo visible).
- La cabecera muestra espacio + oposición + rol.
- La navegación de gestión está disponible.
- No aparecen datos de otros workspaces/oposiciones.

**Riesgos a observar**
- Que aparezca el selector de zona indebidamente (el admin puro debe ir directo
  a Administración).
- Mezcla de oposiciones en los listados.

### 7.2 Material y PDF

**Pasos**
1. En `Material`, pulsar **Subir PDF**.
2. Rellenar título y tipo, elegir un PDF y subirlo.
3. Confirmar el mensaje de subida y el estado de extracción.
4. Abrir el detalle del material y ver el texto extraído (si lo hay).
5. (Opcional) subir un PDF escaneado / sin texto para ver el aviso.
6. Marcar un material como obsoleto desde su detalle.
7. (Texto manual) probar **Añadir material** pegando texto.

**Resultado esperado**
- "PDF subido correctamente." Si hay texto: "Texto extraído correctamente…".
  Si no: "El PDF se ha subido, pero no se ha podido extraer texto…".
- El material queda en la oposición correcta y es trazable.
- El archivo **no** se guarda en el repositorio (ver §15 y demo-data).
- Un material `obsolete` no debe poder usarse para generar preguntas nuevas.

**Riesgos a observar**
- Que se acepte un archivo no PDF, vacío o > 50 MB (debe rechazarse).
- Que se exponga `storage_path` u otra ruta interna al estudiante.

### 7.3 Temario

**Pasos**
1. En `Temario`, crear un tema raíz.
2. Crear un subtema bajo él.
3. Editar un tema.
4. Marcar un tema como obsoleto.
5. Ver el árbol de temas.

**Resultado esperado**
- La jerarquía padre/hijo funciona y no permite ciclos.
- Los temas pertenecen a la oposición actual.

### 7.4 Preguntas (generación, validación, revisión)

**Pasos**
1. En `Preguntas`, pulsar **Generar borradores** desde un material.
2. Confirmar que las generadas quedan en `draft` o `pending_review` (nunca
   `validated`).
3. Abrir una pregunta pendiente → ejecutar validación y ver errores/avisos.
4. Editar una pregunta.
5. Aprobar una pregunta válida.
6. Rechazar una inválida.
7. Marcar otra como "necesita corrección".
8. Marcar una como obsoleta.

**Resultado esperado**
- **Ninguna** pregunta generada se valida automáticamente.
- Solo preguntas válidas pueden aprobarse (con fuente, explicación, una única
  respuesta correcta, tema y dificultad).
- La aprobación requiere acción humana explícita.

**Riesgos a observar (bloqueante)**
- Que una pregunta inválida pueda aprobarse.
- Que aparezca jerga técnica (`pending_review`, `needs_fix`) en texto de cara
  al usuario donde no corresponde.

### 7.5 Acceso de estudiante (Alumnos)

**Pasos**
1. En `Alumnos`, ver la lista de alumnos con acceso.
2. Dar acceso a un miembro del workspace sin acceso aún.
3. Revocar el acceso de un alumno.
4. Verificar (cerrando sesión y entrando como ese alumno) que el acceso cambia.

**Resultado esperado**
- El alumno solo ve oposiciones autorizadas.
- Revocar el acceso bloquea la entrada a esa oposición.

### 7.10 (Premium individual) Workspace personal

**Pasos**
1. Crear un usuario nuevo por seed o usar uno existente.
2. En "Mis espacios", crear un workspace **Personal (Premium)**.
3. Crear una oposición propia, subir material, generar y revisar preguntas.

**Resultado esperado**
- El owner del workspace personal gestiona su propio contenido aunque su rol
  global no sea admin (capacidad decidida por el rol de workspace).

---

## 2. Flujo Student

### 7.6 Entrada

**Pasos**
1. Entrar como Estudiante (`alumno@testopo.dev`).
2. Entrar en `Workspace MVP` → ver "Mis oposiciones".
3. Entrar en `Oposicion MVP`.
4. Intentar acceder a una oposición no autorizada (no debe aparecer en la lista).

**Resultado esperado**
- Zona **Estudio** (distintivo visible), navegación reducida.
- Solo se ven oposiciones con matrícula activa.
- No hay forma de llegar a secciones de administración.

### 7.7 Material

**Pasos**
1. En `Material`, ver solo material **activo**.
2. Abrir un material y ver el texto extraído (si existe) o el aviso claro.
3. Comprobar que no se ve material `obsolete` ni `needs_review`/`deprecated`.

**Resultado esperado**
- Solo material activo y autorizado es visible.
- No se muestran detalles internos (p. ej. `storage_path`).

### 7.8 Crear y responder test

**Pasos**
1. En `Crear test`, elegir número de preguntas, tema (opcional), dificultad y
   modo. Crear el test.
2. Pulsar **Empezar**.
3. Responder algunas preguntas; cambiar una respuesta; dejar otra sin responder.
4. Enviar el test (confirmar el aviso).

**Resultado esperado**
- El test usa **solo** preguntas `validated` de esa oposición.
- Antes de enviar **no** se muestra la respuesta correcta ni la explicación, ni
  se marca opción como correcta/incorrecta.
- Se pueden cambiar respuestas y dejar preguntas en blanco antes de enviar.
- Si no hay suficientes preguntas validadas, mensaje claro y no se crea el test.

**Riesgos a observar (bloqueante)**
- Que el test incluya preguntas no validadas o de otra oposición.
- Que se filtre la solución antes de enviar.

### 7.9 Resultados y revisión

**Pasos**
1. Ver puntuación, porcentaje, aciertos, fallos y no respondidas.
2. Pulsar **Revisar respuestas**.
3. Revisar enunciado, opción elegida, opción correcta, explicación, tema,
   dificultad y fuente.
4. Ir a `Mis resultados` y reabrir un intento enviado.

**Resultado esperado**
- La corrección es correcta (total/aciertos/fallos/sin responder/porcentaje).
- Explicaciones y fuentes aparecen **después** de enviar.
- Las fuentes son legibles y **no** muestran rutas internas.
- En `Mis resultados` solo aparecen los intentos **propios** enviados.

---

## 3. Comprobaciones transversales

### Permisos (ver checklist §Permisos)
- Student no accede a zona admin, no sube material, no genera/revisa/aprueba
  preguntas, no ve preguntas no validadas, no ve resultados de otros.

### Integridad de datos
- Material → oposición; oposición → workspace; pregunta/test/intento →
  oposición/usuario correctos. No se mezcla contenido entre oposiciones ni
  workspaces. No se vincula pregunta a tema/material de otra oposición.

### Calidad de preguntas
- Sin fuente / sin explicación / con 0 o 2+ respuestas correctas / con fuente o
  tema obsoleto → **no** se aprueba. Generadas por IA → quedan pendientes.

### PDF
- Se sube y registra como material; pertenece a la oposición; se guarda fuera
  del repo; PDF inválido/vacío/grande se rechaza; escaneado muestra aviso;
  student autorizado ve PDF activo, no autorizado no.

### UX
- Pocas acciones por pantalla, una principal clara; admin y student claramente
  separados; sin jerga técnica para el estudiante; errores y estados vacíos
  comprensibles; el flujo completo se puede hacer sin tocar código.

---

## 4. Tests automáticos (apoyo al QA manual)

Estos comandos validan la lógica de negocio y los smoke del frontend. Ejecútalos
antes de dar por bueno el MVP.

```bash
# Backend (lógica de dominio, servicios, permisos)
cd app/backend
npm install        # primera vez
npm run typecheck  # comprobación de tipos
npm test           # suite Vitest

# Frontend (build + smoke de navegación/portal)
cd app/frontend
npm install        # primera vez
npm run build      # build de producción (Vite)
npm test           # smoke (Testing Library + Vitest)
```

Estado de referencia al redactar este plan: **backend 216 tests** en verde,
**frontend 8 smoke tests** en verde, build OK.

> Si tocas código de producto, todos los tests anteriores deben seguir pasando
> (no regresión, SPEC 001-014).

---

## 5. Cómo registrar incidencias

Usa la plantilla `bug-report-template.md` de esta carpeta. Marca como
**bloqueante** cualquier fallo de la lista de "errores bloqueantes" del
`mvp-checklist.md` (p. ej. el estudiante accede a admin, el test muestra
soluciones antes de enviar, o un PDF se guarda en el repositorio).
