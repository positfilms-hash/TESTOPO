# Codex Visual Review Runbook

## 1. Objetivo

Definir el proceso reproducible de revision visual que ejecuta Codex antes de cerrar specs con impacto en frontend o QA pre-beta.

Este runbook no sustituye tests unitarios ni permisos. Es una verificacion complementaria para detectar regresiones visuales, solapes, pantallas rotas y filtraciones visibles en flujos criticos.

## 2. Responsabilidad

Codex:

- Coordina la revision visual.
- Ejecuta Vite/preview.
- Recorre flujos con Playwright o navegador equivalente.
- Guarda capturas `smoke-*.png`.
- Compara resultados contra la spec activa.
- Reporta bloqueantes, recomendados y minimos.

Claude:

- Implementa correcciones solicitadas por spec o por revision de Codex.
- No necesita ejecutar esta revision salvo que Codex lo pida expresamente.
- No debe inventar un proceso paralelo.

## 3. Cuando Ejecutarlo

Ejecutar cuando una spec:

- Cambia frontend.
- Cambia navegacion.
- Cambia permisos visibles.
- Cambia autenticacion.
- Cambia student/admin portal.
- Cambia resultados o tests.
- Cambia account deletion.
- Prepara QA pre-beta.

Tambien ejecutarlo cuando haya sospecha de regresion visual aunque la spec sea principalmente backend.

## 4. Preparacion

Desde el frontend:

```powershell
cd C:\Users\migue\Documents\TESTOPO\app\frontend
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

Si el puerto `5173` esta ocupado, usar otro puerto y documentarlo en la revision.

Si Playwright no esta instalado en el frontend y se necesita para una revision puntual:

```powershell
cd C:\Users\migue\Documents\TESTOPO\app\frontend
npm.cmd install -D playwright
```

Si se anade Playwright solo temporalmente para una revision de Codex, revertir cualquier cambio de `package.json` o lockfile antes de cerrar, salvo que una spec pida versionarlo.

## 5. Capturas

Guardar capturas con nombres `smoke-*.png`, por ejemplo:

```text
app/frontend/smoke-home.png
app/frontend/smoke-admin.png
app/frontend/smoke-student.png
app/frontend/smoke-test-taking.png
app/frontend/smoke-test-result.png
app/frontend/smoke-account.png
```

Estas capturas no se commitean. Estan ignoradas por `.gitignore`.

## 6. Flujos Minimos

### 6.1 Home/Auth

- Landing o pantalla inicial carga sin errores.
- Login/register/reset se ven completos.
- No hay textos cortados.
- No se muestran claves ni variables privadas.

### 6.2 Admin

- Navegacion admin carga.
- Materiales, temario, preguntas, revision y tests son accesibles para perfiles admin/owner.
- Tablas/listas no se desbordan.
- Estados vacios son comprensibles.
- Acciones destructivas se distinguen visualmente.

### 6.3 Student

- Student no ve admin.
- Student ve solo oposiciones autorizadas.
- Student puede iniciar test.
- Antes de submit no aparecen respuestas correctas, explicaciones ni marcadores de correccion.
- Despues de submit aparecen resultado, explicacion y fuente cuando corresponde.

### 6.4 Account Deletion

- La pantalla de cuenta muestra advertencia clara.
- La confirmacion explicita es visible.
- El boton destructivo no parece una accion primaria normal.
- El flujo de owner unico bloqueado tiene mensaje comprensible.

## 7. Criterios Visuales Globales

Revisar contra la spec activa y, como base, contra `docs/specs/018-1-visual-identity.md`.

Criterios base:

- Identidad sobria y clara.
- Azul pastel, blanco y lineas negras finas donde aplique.
- Titulos con Georgia si la identidad visual vigente lo mantiene.
- Texto general con sans-serif del sistema.
- Mucho espacio visual, sin saturacion.
- Jerarquia clara entre titulos, secciones, controles y estados.
- Sin solapes.
- Sin texto cortado.
- Sin botones que cambian de tamano al interactuar.
- Sin cards anidadas innecesarias.
- Sin estados ilegibles en desktop o mobile.

## 8. Viewports

Probar al menos:

```text
Desktop: 1366x900
Mobile: 390x844
```

Si una pantalla es especialmente densa, revisar tambien:

```text
Tablet: 768x1024
```

## 9. Checks De Seguridad Visible

Durante la revision visual, confirmar:

- No aparece `SUPABASE_SERVICE_ROLE_KEY`.
- No aparece `VITE_SUPABASE_SERVICE_ROLE_KEY`.
- No aparecen tokens reales.
- Student no ve respuestas correctas antes de enviar.
- Student no ve explicaciones antes de enviar.
- Student no ve resultados de otro usuario.
- Student no ve pantallas admin.

## 10. Ejemplo De Smoke Playwright

Este ejemplo es orientativo. Codex puede adaptarlo al estado real de la app.

```powershell
$env:NODE_PATH='C:\Users\migue\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
& 'C:\Users\migue\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' -e "const { chromium } = require('playwright'); (async()=>{ const browser=await chromium.launch({headless:true}); const page=await browser.newPage({viewport:{width:1366,height:900}}); await page.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'}); await page.screenshot({path:'C:/Users/migue/Documents/TESTOPO/app/frontend/smoke-home.png', fullPage:true}); await browser.close(); })().catch(e=>{ console.error(e); process.exit(1); });"
```

## 11. Resultado Esperado

La revision debe terminar con una nota de Codex que incluya:

- Rama revisada.
- URL local usada.
- Viewports probados.
- Capturas generadas.
- Flujos recorridos.
- Findings bloqueantes.
- Findings recomendados.
- Findings minimos.
- Tests automaticos ejecutados.
- Checks pendientes si dependen de Supabase real.

## 12. Severidad

### Bloqueante

- Pantalla critica inutilizable.
- Student ve admin.
- Student ve respuestas correctas antes de submit.
- Student ve resultados ajenos.
- Clave privada visible.
- Login o flujo de test principal roto.

### Recomendado

- Problema visual claro que afecta confianza.
- Texto importante cortado.
- Estado vacio confuso en flujo principal.
- Mobile usable pero con friccion evidente.

### Minimo

- Pulido menor.
- Espaciado mejorable.
- Copy poco fino.
- Captura no critica con pequeno desajuste.

## 13. Relacion Con SPEC 027

En SPEC 027, este runbook se usa como apoyo para:

- `docs/qa/pre-beta-qa-plan.md`.
- `docs/qa/pre-beta-manual-test-script.md`.
- `docs/qa/pre-beta-release-blockers.md`.

No convierte la SPEC 027 en una spec visual. Solo formaliza la parte de revision visual que Codex ya venia ejecutando.
