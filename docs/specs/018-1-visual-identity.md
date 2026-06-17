# SPEC 018.1 - Visual Identity: Typography & Colors

## 1. Objetivo

Definir y aplicar una identidad visual basica para TESTOPO antes de la beta.

La app debe verse:

- Limpia.
- Elegante.
- Clara.
- Profesional.
- Facil de usar.
- No sobrecargada.

Esta mini spec es exclusivamente visual. No debe cambiar funcionalidades, permisos, rutas, modelos, reglas de negocio ni flujos existentes.

## 2. Estilo Visual Deseado

La identidad visual debe basarse en:

- Azul pastel.
- Blanco.
- Lineas negras finas.
- Titulos elegantes.
- Texto muy legible.
- Mucho espacio visual.

## 3. Paleta Recomendada

Usar una paleta simple y coherente:

```text
Background principal: #FFFFFF
Background secundario: #F7FBFF
Azul pastel principal: #BFDDF7
Azul pastel suave: #EAF5FF
Azul activo/hover: #A8CFF0
Texto principal: #111111
Texto secundario: #4B5563
Bordes/lineas principales: #111111
Bordes suaves opcionales: #D1D5DB
Error: #DC2626
Exito: #16A34A
Advertencia: #D97706
```

Reglas visuales:

- Usar blanco como base.
- Usar azul pastel como acento.
- Usar lineas negras finas para dar personalidad.
- Evitar bordes negros gruesos o excesivamente agresivos.
- No saturar la interfaz con color.

## 4. Tipografia

La tipografia debe combinar elegancia y legibilidad.

### Titulos

Usar:

```css
Georgia, "Times New Roman", serif
```

Aplicar a:

- Titulos de pagina.
- Encabezados principales.
- Nombres destacados de secciones.
- Titulos de tarjetas importantes.

### Texto General

Usar una sans-serif limpia y muy legible:

```css
system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Aplicar a:

- Parrafos.
- Formularios.
- Inputs.
- Botones.
- Navegacion.
- Tablas.
- Badges.
- Textos pequenos.
- Mensajes de error.
- Estados vacios.

## 5. Reglas Tipograficas

- No usar mas de dos familias tipograficas.
- Georgia solo debe usarse en titulos y encabezados.
- No usar Georgia en botones, inputs o navegacion.
- Mantener tamanos generosos.
- Priorizar claridad sobre decoracion.
- Evitar textos pequenos dificiles de leer.
- Mantener jerarquia visual clara.

## 6. Componentes Afectados

Aplicar el estilo a:

- Layout general.
- Sidebar.
- Header.
- Botones.
- Tarjetas.
- Formularios.
- Inputs.
- Badges de estado.
- Tablas o listas.
- Pantallas vacias.
- Panel admin.
- Portal estudiante.

## 7. Botones

### Boton Principal

- Fondo: azul pastel.
- Texto: negro.
- Borde: negro fino.
- Debe destacar sin ser agresivo.

### Boton Secundario

- Fondo: blanco.
- Texto: negro.
- Borde: negro fino.

### Botones Destructivos

Mantener advertencia visual clara:

- Texto rojo.
- Borde rojo.
- Fondo blanco.

## 8. Tarjetas y Contenedores

Usar tarjetas blancas con borde negro fino.

```text
Fondo: blanco
Borde: 1px solid #111111
Radio: medio
Sombra: ninguna o muy sutil
```

Evitar sombras fuertes.

## 9. Badges de Estado

Los estados deben ser legibles y suaves.

Ejemplos:

- Validada: verde suave.
- Pendiente: azul suave.
- Necesita correccion: amarillo suave.
- Obsoleta: gris suave.
- Rechazada: rojo suave.

No mostrar codigos internos como `pending_review` al usuario final.

## 10. Reglas UX

- No saturar con colores.
- No anadir animaciones innecesarias.
- Mantener mucho espacio blanco.
- Priorizar legibilidad.
- Mantener coherencia entre admin y student.
- Mantener acciones visibles claras y pocas.
- No convertir la app en una herramienta tecnica llena de botones.

## 11. Fuera De Alcance

No implementar:

- Nuevas funcionalidades.
- Nuevos permisos.
- Nuevas rutas.
- Nuevos modelos.
- Cambios en reglas de negocio.
- Cambios de flujo admin/student.
- Cambios en validaciones de preguntas.
- Cambios en generacion de tests.
- Cambios en subida de materiales.
- Cambios en importacion ZIP.
- Sistema de temas configurable por usuario.
- Branding avanzado o logo nuevo, salvo que ya exista una estructura clara para pequenos ajustes visuales.

## 12. Reglas Para Claude

Claude debe:

- Limitarse a cambios visuales.
- Preferir variables/tokens globales si el frontend ya los usa.
- Reutilizar componentes existentes.
- Mantener los mismos textos funcionales salvo ajustes cosmeticos necesarios para mostrar estados de forma humana.
- No tocar backend salvo que exista un archivo compartido puramente visual.
- No modificar datos seed salvo que sea estrictamente necesario para nombres de estado visibles.
- No alterar endpoints, stores, servicios, schemas, migrations, modelos ni permisos.

## 13. Requisitos De Revision Codex

Codex revisara que:

- Los cambios sean solo visuales.
- La app conserve la misma funcionalidad.
- Admin y student sigan separados.
- No se hayan tocado permisos, rutas, modelos ni reglas de negocio.
- La identidad visual respete azul pastel, blanco, lineas negras finas, Georgia en titulos y sans-serif del sistema en texto general.
- No haya regresiones visuales evidentes en smoke visuals.

## 14. Criterios De Aceptacion

La tarea se considera completada cuando:

- La app usa una paleta coherente azul pastel/blanco/negro.
- Los titulos usan Georgia.
- El texto general usa sans-serif legible.
- Los botones tienen estilo uniforme.
- Las tarjetas tienen bordes y espaciado coherentes.
- Admin y Student comparten identidad visual.
- La interfaz se ve mas limpia, elegante y profesional.
- No se ha cambiado funcionalidad.
- No se han roto tests existentes.

