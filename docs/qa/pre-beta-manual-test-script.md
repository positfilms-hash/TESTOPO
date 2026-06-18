# Guion de pruebas manuales pre-beta (SPEC 027)

Pruebas end-to-end contra un **Supabase de staging** (migraciones `0001`→`025`
aplicadas y Edge Function `delete-account` desplegada). Cada flujo: marca PASS/FAIL
y registra fallos en [`pre-beta-bug-log.md`](./pre-beta-bug-log.md).

> La versión automatizada (modo memory) de 13.1/13.2 está en
> `app/backend/tests/studentPortal.test.ts` y `preBetaInvariants.test.ts`.

## 13.1 Flujo organización completo
1. [ ] Owner crea workspace organization.
2. [ ] Owner crea oposición.
3. [ ] Owner sube material (PDF y/o texto con "Subir material").
4. [ ] Owner importa un ZIP.
5. [ ] Owner crea índice IA y lo revisa/aprueba/aplica.
6. [ ] Owner genera preguntas → quedan `pending_review`/`needs_fix` (NUNCA `validated`).
7. [ ] Owner revisa y aprueba las válidas → `validated`.
8. [ ] Owner añade Student A.
9. [ ] Student A entra, ve material `active`, crea test, responde, envía.
10. [ ] Student A ve resultado + explicación/fuente (solo **después** de enviar).

## 13.2 Flujo student aislado
1. [ ] Student A solo ve sus oposiciones; **no** ve la de Student B.
2. [ ] Student A crea test, responde parcialmente, envía.
3. [ ] Contadores correct/incorrect/`unanswered` correctos.
4. [ ] Student A no puede editar respuestas tras enviar.
5. [ ] Student A no puede ver el attempt de Student B (probar leyendo por API/SQL).

## 13.3 Flujo premium individual
1. [ ] Crea workspace personal + oposición personal.
2. [ ] Sube material, crea temario, genera/revisa/aprueba preguntas, crea y realiza test.
3. [ ] Elimina su cuenta (escribe ELIMINAR).
4. [ ] Su workspace personal queda `archived`; perfil `deleted`; sin sesión.

## 13.4 Flujo eliminación cuenta organización
1. [ ] Owner **único** intenta eliminar cuenta → **bloqueado** (mensaje claro).
2. [ ] Se añade un segundo owner.
3. [ ] El primer owner elimina su cuenta → permitido.
4. [ ] El workspace organization sigue **activo**; su membership queda `revoked`;
       su perfil `deleted`.

## Checks transversales
- [ ] Registro / login / reset de contraseña funcionan.
- [ ] Modo memory (demo, sin `.env`) sigue arrancando y sembrando datos.
- [ ] Modo supabase (`APP_PERSISTENCE_MODE=supabase`) lee/escribe en Supabase.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` no aparece en el bundle (`supabaseSecurity.test.ts`).
- [ ] `.env` no está en el repo.
