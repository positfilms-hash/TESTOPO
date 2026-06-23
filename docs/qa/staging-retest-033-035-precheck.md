# Staging Re-test: Precheck IA/OCR

**Fecha:** 2026-06-23  
**Entorno:** Vite local `http://127.0.0.1:5178`, modo de persistencia Supabase, proyecto staging.  
**Perfil:** owner QA autenticado (`admin.qa@testopo-fake.dev`; credenciales no incluidas).  
**Workspace:** `QA Academia Ficticia`  
**Oposicion aislada:** `QA Codex - Retest Gates 2026-06-23` (`qa-codex-retest-gates-20260623`)

Este documento registra solo verificacion y documentacion. No se implementaron proveedor IA, Edge Functions, cambios de Auth, RLS o permisos.

## Resultado Global

**PASS.** Los tres bloqueantes se comportan de forma honesta en staging: la lista de Material se refresca, la generacion IA no configurada no crea candidatas y OCR no configurado no persiste resultados simulados.

## 1. Carga y revision de materiales

**Resultado: PASS**

- Se cargaron `compressed-text.pdf` y `scanned-image.pdf` en una sola operacion.
- La interfaz confirmo `2 archivo(s) subido(s)` y mostro ambos elementos inmediatamente, sin recarga ni nuevo inicio de sesion.
- `compressed-text.pdf` quedo `Activo` / `Texto extraido`.
- `scanned-image.pdf` quedo `Por revisar` / `Escaneo detectado`.
- El boton **Abrir** del primer PDF abrio una URL firmada de Supabase Storage correctamente.
- No se perdio el workspace ni la oposicion.
- Captura: `app/frontend/smoke-retest-material.png`.

No hubo errores HTTP de la aplicacion en este flujo. La consola registro un `404` generico de recurso estatico; no afecto la carga, la lista, Supabase ni la apertura del PDF.

## 2. Generacion sin proveedor IA real

**Resultado: PASS**

Como preparacion QA se genero y aplico un indice de prueba existente para disponer de un tema aplicado. Despues se solicito una candidata desde el flujo **Generar desde tema**.

Mensaje visible:

> La generacion con IA no esta configurada en este entorno: no se han creado preguntas. Configura el proveedor de IA en el servidor para generar candidatas reales.

- No se creo ninguna candidata.
- La lista de preguntas quedo en `No hay preguntas pendientes de revision.`
- No se guardo texto mock ni una pregunta ficticia.
- No se marco ninguna entidad como `validated`.
- No se creo ningun test ni se modifico el banco con preguntas nuevas.
- Captura: `app/frontend/smoke-retest-generation-form.png`.

No hubo errores HTTP de la aplicacion durante el intento.

## 3. OCR sin proveedor OCR real

**Resultado: PASS**

Se pulso **Leer escaneo (OCR)** sobre `scanned-image.pdf`.

Mensaje visible:

> El servicio de OCR no esta configurado en este entorno.

Comprobacion autenticada mediante la API de Supabase, limitada a la oposicion QA:

- Material: `extraction_status = scanned_detected`.
- `content_text = null`.
- `material_ocr_runs`: `0` filas.
- `material_ocr_pages`: `0` filas; no puede existir una pagina sin un run asociado.
- No se guardo texto OCR simulado.
- No se marco el material como OCR completado.
- Captura: `app/frontend/smoke-retest-ocr-blocked.png`.

No hubo errores HTTP de la aplicacion durante este flujo. Se conserva el mismo `404` estatico no bloqueante observado en la consola.

## Confirmaciones de alcance

- No se implemento proveedor IA real.
- No se implemento ninguna Edge Function.
- No se modifico Auth ni la rehidratacion de sesion.
- No se modificaron permisos, RLS ni Supabase Schema.
- No se modifico la calidad del indice mock `compressed-text`.
- No se generaron candidatas falsas ni OCR simulado.

## Proximo bloqueo de infraestructura

La generacion de candidatas reales y OCR real siguen pendientes de endpoints/Edge Functions de servidor con proveedores configurados. El frontend no contiene claves privadas y el estado actual bloquea ambas operaciones de forma segura.
