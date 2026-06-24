# Revisar candidatas y dar feedback (SPEC 040)

Guía para gestores (owner/admin). El alumno no ve esta pantalla.

## Por qué importa

Cuando revisas una candidata, tu decisión **enseña** al sistema. El motivo por el que
rechazas o marcas para corregir se resume (solo dentro de **tu** oposición) y se usa
como **consejo de calidad** en las próximas generaciones desde material estudiado. No
es magia: es tu criterio, convertido en instrucciones de "errores a evitar".

> La memoria nunca es fuente de hechos, nunca valida una pregunta ni crea un test.

## Acciones de revisión

En **Preguntas → Revisar**:

- **Aprobar (validar):** solo si no hay errores críticos. No exige formulario. Al
  validar se registra una señal de resultado (`sin cambios` / `cambios menores` /
  `tras edición mayor`), nunca una aprobación automática.
- **Editar:** corrige enunciado/explicación/dificultad y vuelve a revisar.
- **Marcar para corregir (`needs_fix`):** el motivo es opcional pero recomendable.
- **Rechazar:** **obligatorio** marcar al menos un **motivo estructurado** y elegir
  una **severidad** (`low`/`medium`/`high`/`critical`). El botón "Rechazar" está
  deshabilitado hasta que marcas un motivo.

El comentario es siempre opcional y ayuda a afinar el resumen.

## Catálogo de motivos y severidad

El catálogo de tipos de feedback y las severidades están formalizados en un contrato
único compartido por servidor y cliente. Ejemplos de motivos: pregunta ambigua, varias
respuestas correctas, respuesta correcta incorrecta, distractores débiles, fuente
insuficiente/ausente, explicación débil/ausente, contenido inventado, copia de examen
antiguo, dificultad no acorde, formato incorrecto, etc.

## Qué ocurre después

- Tu feedback se guarda **dentro de tu workspace y oposición** (aislado: ninguna otra
  academia lo ve ni se beneficia de él).
- El feedback **crítico o repetido** crea o refuerza una entrada de memoria
  ("evita …") e incrementa su contador de ocurrencias.
- En la siguiente generación desde material estudiado, el servidor añade un bloque
  acotado de **"errores a evitar"** (máximo 10 entradas / 3000 caracteres),
  **separado** de la evidencia del material. Si no hay memoria, la generación funciona
  igual que antes.

## Métricas

En la cabecera de **Preguntas** verás una franja de **fiabilidad** del banco de tu
oposición: total, validadas (y su porcentaje), para corregir y rechazadas. Es una
vista rápida, no un panel.

## Lo que NO ocurre

- Ninguna pregunta se valida ni se publica automáticamente.
- No se genera un test para el alumno de forma automática.
- El navegador no redacta ni envía memoria ni prompts: solo tu acción y el feedback
  permitido.
