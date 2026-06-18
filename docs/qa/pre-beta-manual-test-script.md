# Guion de pruebas manuales pre-beta (SPEC 027)

Pruebas end-to-end contra un **Supabase de staging** (migraciones `0001` a `025`
aplicadas y Edge Function `delete-account` desplegada). Cada flujo: marca
PASS/FAIL y registra fallos en [`pre-beta-bug-log.md`](./pre-beta-bug-log.md).

> La version automatizada (modo memory) de 13.1/13.2 esta en
> `app/backend/tests/studentPortal.test.ts` y `preBetaInvariants.test.ts`.

## 13.1 Flujo organizacion completo

1. [ ] PENDING - Owner crea workspace organization (dataset ya venia sembrado).
2. [ ] PENDING - Owner crea oposicion (dataset ya venia sembrado).
3. [ ] PENDING - Owner sube material (PDF y/o texto con "Subir material").
4. [ ] PENDING - Owner importa un ZIP.
5. [ ] PENDING - Owner crea indice IA y lo revisa/aprueba/aplica.
6. [ ] PENDING - Owner genera preguntas -> quedan `pending_review`/`needs_fix` (NUNCA `validated`).
7. [ ] PENDING - Owner revisa y aprueba las validas -> `validated`.
8. [x] PASS - Student A existe en el workspace/oposicion de staging.
9. [x] FAIL - Student A entra y crea test, pero `Empezar` no abre la pantalla de realizacion (BUG-002).
10. [x] FAIL - No se pudo llegar a resultado/explicacion/fuente por BUG-002.

## 13.2 Flujo student aislado

1. [x] PASS - Student A solo ve la oposicion A y Student B solo ve la oposicion B.
2. [x] FAIL - Student A crea test, pero no puede iniciarlo/enviarlo desde UI (BUG-002).
3. [ ] PENDING - Bloqueado por BUG-002.
4. [ ] PENDING - Bloqueado por BUG-002.
5. [x] PASS - Cubierto por plan RLS staging ejecutado contra Supabase (ver `staging-rls-checks.sql`).

## 13.3 Flujo premium individual

1. [ ] PENDING - No se proporciono usuario premium individual para esta pasada.
2. [ ] PENDING - No se proporciono usuario premium individual para esta pasada.
3. [ ] PENDING - No se proporciono usuario premium individual para esta pasada.
4. [ ] PENDING - No se proporciono usuario premium individual para esta pasada.

## 13.4 Flujo eliminacion cuenta organizacion

1. [x] PASS - Owner unico intenta eliminar cuenta -> bloqueado con mensaje claro.
2. [ ] PENDING - No se creo segundo owner durante esta revision.
3. [ ] PENDING - Depende de crear segundo owner.
4. [ ] PENDING - Depende de eliminar owner con segundo owner disponible; su workspace debe seguir activo, membership revoked y profile deleted.

## Checks transversales

- [x] PASS - Login funciona para admin, Student A y Student B contra staging.
- [ ] PENDING - Reset de contrasena no se recorrio en esta pasada visual.
- [ ] PENDING - Modo memory (demo, sin `.env`) no se recorrio en esta pasada visual.
- [x] PASS - Modo supabase lee staging y permite crear tests.
- [x] PASS - `SUPABASE_SERVICE_ROLE_KEY` no aparece en las pantallas revisadas; test automatico `supabaseSecurity.test.ts` ya cubre bundle.
- [x] PASS - `.env` no esta en el repo.
