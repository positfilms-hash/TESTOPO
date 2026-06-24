# Generar preguntas desde tu material estudiado (SPEC 039)

Guía para gestores (owner/admin). El alumno no ve esta pantalla.

## Idea

Una vez que la app ha **estudiado** tu material (ver
[Estudiar material](study-material.md)), puedes generar preguntas tipo test
**directamente** desde ese estudio. No necesitas crear un índice de temario, ni
aplicarlo, ni elegir un tema.

```text
Subir material  ->  Estudiar material  ->  Generar preguntas  ->  Revisar
```

## Pasos

1. Entra en **Temario / Análisis**.
2. Asegúrate de que el material esté **estudiado** (panel *Estudiar material*). Si
   aún no lo está, estúdialo primero.
3. En el panel **Generar preguntas**:
   - **Alcance:** todo el material estudiado o un documento concreto.
   - **Dificultad:** fácil, media, difícil o mixta.
   - **Número de preguntas** (1–20).
4. Pulsa **Generar preguntas**. La IA prepara candidatas ancladas a su fuente.
5. Al terminar verás cuántas candidatas se han creado y un enlace **Ir a revisar**.

## Qué obtienes

- Cada pregunta tiene enunciado, opciones con **una única** respuesta correcta,
  explicación, dificultad y una **fuente concreta** (la unidad de estudio de la que
  salió, con su extracto).
- Todas las candidatas quedan **pendientes de revisión** (`pending_review`) o
  marcadas para corregir (`needs_fix`). **Ninguna se valida ni se publica sola.**
- Las preguntas solo entran en los tests de los alumnos cuando **tú** las apruebas
  en *Preguntas → Revisar*.

## Bloqueos honestos

- **«Primero estudia el material»**: no hay un estudio completado todavía.
- **«El material estudiado no tiene evidencia utilizable»**: revisa que el material
  sea legible (no escaneo sin OCR, no obsoleto) y vuelve a estudiarlo.
- **«…todavía no está configurada en servidor»**: el proveedor de IA no está
  activo en este entorno. No se crea ninguna pregunta simulada.
- En la **demo local** la generación directa no está disponible (se ejecuta en el
  servidor): no verás candidatas falsas.

## Lo que esta función NO hace

- No crea un índice de temario ni pide elegir tema.
- No valida ni publica preguntas automáticamente.
- No genera un test para el alumno.
- No usa exámenes antiguos como fuente factual (solo, como mucho, orientan estilo).
