# TESTOPO Frontend (SPEC 009)

Frontend basico del MVP: una interfaz limpia para usar el flujo completo
**Material → Temario → Preguntas → Revision → Test → Resultado**.

No reimplementa reglas de negocio: reutiliza los servicios del backend
(`app/backend`, SPEC 001–008) importandolos directamente y ejecutandolos en el
navegador (almacen en memoria por sesion, sin API). Incluye datos de ejemplo
ficticios para poder probar el flujo de inmediato.

## Stack

- React 18 + Vite + TypeScript.
- Vitest + Testing Library (jsdom) para los smoke tests.

## Comandos

```bash
cd app/frontend
npm install        # instala dependencias
npm run dev        # arranca el dev server  ->  http://localhost:5173
npm test           # ejecuta los smoke tests
npm run build      # build de produccion (Vite)
```

URL local de revision: **http://localhost:5173**

## Acceso (SPEC 010)

La app pide login. Hay dos usuarios sembrados para la demo (ficticios):

- **Admin:** `admin@testopo.dev` / `admin1234` (o boton "Entrar como Admin").
- **Estudiante:** `alumno@testopo.dev` / `alumno1234` (o boton "Entrar como Estudiante").

Tras entrar se elige un **espacio** ("Workspace MVP" ya sembrado) y luego una
**oposicion** ("Oposicion MVP"). El admin gestiona material/temario/preguntas/
tests de esa oposicion; el estudiante solo ve material activo, crea y realiza
tests, y consulta resultados. El pie de la barra lateral muestra espacio,
oposicion y rol, con opciones para cambiar de espacio u oposicion.

## Notas

- La logica vive en `app/backend`; el frontend la consume via una capa de
  adapters (`src/store/appStore.ts`) sin duplicar reglas.
- `node:crypto` se aliasa a un shim de Web Crypto (`src/shims/nodeCrypto.ts`).
- Datos en memoria: se reinician al recargar la pagina.
- Reglas de UX respetadas: durante un test no se muestra la respuesta correcta
  ni la explicacion; no se puede aprobar una pregunta con errores criticos.

## Estructura

```text
src/
  components/   AppLayout, ui (Card, Button, Badge, EmptyState…)
  pages/        Home, Material, Topic, Questions (+ review/generacion), Tests (+ realizar/resultado)
  store/        appStore (cablea el backend) + StoreContext
  shims/        nodeCrypto (Web Crypto)
tests/          smoke tests (Vitest + Testing Library)
```
