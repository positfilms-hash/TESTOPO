# Generación de preguntas con IA (guía de gestión)

Esta guía resume cómo usar la **IA de la oposición** (SPEC 028-E + 028-F) desde la
zona de administración. Solo owner/admin/gestores autorizados. El alumno nunca ve
nada interno (patrones, perfiles, memoria, candidatas pendientes ni excerpts).

## Principio: la fuente factual es siempre el material primario

La IA **solo organiza y redacta** a partir de tu material aprobado. Los exámenes
antiguos se usan **solo como referencia de estilo agregado** (formato, dificultad,
cobertura), **nunca como contenido** que se copie. Ninguna pregunta se valida
automáticamente: pasa a `pending_review` o `needs_fix`, y solo tú la validas.

## Flujo

1. **Subir y clasificar material** (Material → Subir material). Los exámenes
   antiguos se clasifican como `old_exam_or_test`. La extracción debe quedar
   `completed` (los escaneados/ilegibles no entran).
2. **IA de la oposición → Analizar exámenes.** Genera un **perfil de estilo** en
   borrador con los agregados detectados (nº de opciones, tipos, trampas, ratio
   legal/conceptual) y huellas anti-copia. "Sin exámenes" es un aviso, no un error.
3. **Revisar y activar el perfil.** Envía a revisión, **actívalo** (solo uno
   activo por oposición; el anterior queda *reemplazado*) o recházalo. El panel
   muestra el **contexto** que usará la generación.
4. **Refrescar memoria de errores** desde el feedback de revisión: genera
   instrucciones de "evitar" que también orientan la generación.
5. **Generar desde tema** (Preguntas → Generar desde tema). Usa por defecto el
   perfil activo + la memoria (con interruptores Sí/No). Cada candidata:
   - se ancla a una **fuente concreta** del material (excerpt verificado);
   - recibe una **puntuación de calidad** transparente;
   - si se parece demasiado a un examen antiguo (**copying_risk**) o la calidad es
     baja, queda en `needs_fix` (nunca `pending_review` en silencio).
6. **Revisar** las candidatas: fuente factual, estilo aplicado, puntuación/avisos
   de calidad y el feedback que la generación intentó atender. Solo tú validas.

## Qué NO hace

No hay fine-tuning ni entrenamiento, OCR, RAG, embeddings ni almacén vectorial, ni
banco copiable de exámenes antiguos, ni validación automática, ni tests directos
para el alumno con preguntas no validadas.
