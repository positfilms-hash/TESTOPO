# Lenguaje visual del frontend (SPEC 031)

Refresh visual «drive-like»: TESTOPO debe leerse **simple, calmado y claro** antes
de que el usuario entienda cada flujo. Es un cambio **solo de presentación**
(`app/frontend/`): no toca comportamiento, rutas, permisos, datos ni backend.

## Principio

- **Lienzo** azul muy claro; **superficies de lectura blancas** (tarjetas, filas,
  inputs). El **navy** es un **acento** reservado a: barra lateral, acción primaria
  y elementos enfatizados/seleccionados. No se usa navy «en todo» (evita el peso).
- **Serif (Georgia) solo en titulares** (h1–h4, marca, dato destacado). Cuerpo,
  formularios, botones, listas y tablas en **sans del sistema**.
- Escala de espaciado compacta y consistente, bordes finos, sombras sutiles. Sin
  card-dentro-de-card, gradientes, blobs ni estilo de landing.

## Tokens (`src/styles.css`)

| Token | Valor | Uso |
| --- | --- | --- |
| `--app-bg` | `#eef4fb` | lienzo de la app |
| `--surface` | `#ffffff` | superficie de lectura (tarjetas/filas/inputs) |
| `--surface-alt` | `#f2f7fd` | azul pálido (hover de fila, cabeceras suaves) |
| `--navy` | `#173f66` | sidebar, acción primaria, énfasis |
| `--navy-hover` / `--navy-press` | `#1f4f7e` / `#102c49` | estados del navy |
| `--on-navy` / `--on-navy-muted` | `#f4f8fd` / `#aebfd4` | texto sobre navy |
| `--ink` | `#13293f` | texto principal sobre claro |
| `--muted` | `#5a6b7d` | texto secundario sobre claro |
| `--hairline` | `#dce5f0` | bordes finos sobre claro |
| `--accent` | `#2f6db0` | foco, marcador activo, enlaces |
| `--space-1..6` | 4 · 8 · 12 · 16 · 24 · 32 px | escala de espaciado |
| `--radius` / `--radius-sm` / `--radius-pill` | 12 · 8 · 999 px | radios |
| `--shadow` / `--shadow-raise` | — | sombras sutiles |

Alias legacy: `--text` → `--ink`, `--border` → `--hairline` (para usos inline
existentes). Estados: `--success/--warning/--danger` + sus `*-soft`.

## Componentes

- **Barra lateral** (`.sidebar`, navy): marca serif, distintivo de zona, ítems de
  navegación con activo marcado por pastilla + barra de acento (`--accent`). El pie
  de contexto (`.sidebar-context`) agrupa «quién soy / dónde estoy / acciones».
- **Botones**: primario navy; `secondary` blanco con borde fino; `danger` blanco
  con texto/borde rojos. Altura y radios consistentes.
- **Tarjetas** (`.card`): blancas con borde `--hairline` y `--shadow`. Variante
  `.card.emphasis` (navy) para énfasis puntual.
- **Biblioteca de archivos** (`.file-list`/`.file-row`/`.file-icon`): filas blancas
  escaneables con glifo de archivo (SVG inline, sin dependencias), título,
  metadatos, badge(s) de estado y acciones a la derecha. Material conserva
  exactamente sus acciones (subir/abrir/eliminar) y, para el gestor, el estado y
  detalle de OCR (SPEC 030).
- **Badges**, **avisos** (`.notice`), **estados** vacío/carga/error, **opciones**
  de test y **pestañas**: paleta suave y legible sobre superficie blanca, con foco
  visible (`:focus-visible`) y contraste accesible.

## Accesibilidad y responsive

- Foco siempre visible; comunicación de estado no solo por color (texto + pastilla).
- Verificar `1366×900`, anchura tablet/portátil y `390×844`: sin overflow
  horizontal, solapes ni acciones recortadas. La barra lateral pasa arriba en móvil.
- `prefers-reduced-motion`: se anulan las transiciones.

## Fuera de alcance

No se añaden dependencias (sin librería de iconos: los glifos son SVG inline). No
se cambia navegación/semántica de reset, permisos Admin/Estudiante, ni ninguna
capacidad funcional. La revisión visual desktop/móvil (capturas/Playwright) la
ejecuta Codex ([`../qa/codex-visual-review-runbook.md`](../qa/codex-visual-review-runbook.md)).
