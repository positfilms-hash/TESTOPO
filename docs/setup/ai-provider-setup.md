# Configuracion del proveedor de IA (SPEC 018.4 / 018.4-B)

TESTOPO genera **borradores** de preguntas con IA detras de una interfaz
desacoplada (`QuestionGenerationProvider`). El dominio no depende de ningun
proveedor concreto: se elige por variable de entorno.

> Principio central: **la IA no valida preguntas**. Genera candidatos que pasan
> por validacion automatica y **revision humana**. Solo una accion humana
> explicita puede pasar una pregunta a `validated`.

## Proveedores

| Proveedor   | `AI_PROVIDER` | Uso                                  |
| ----------- | ------------- | ------------------------------------ |
| OpenAI      | `openai`      | **Principal recomendado** (beta/prod) |
| Anthropic   | `anthropic`   | Alternativo configurable             |
| Mock        | `mock`        | Tests, desarrollo local, demos, CI   |

Sin configuracion, el factory usa **mock** (no llama a APIs externas). Para
produccion/beta usa `openai` salvo decision explicita.

## Como elegir proveedor

Define `AI_PROVIDER` en el entorno del servidor (nunca en el frontend):

```text
AI_PROVIDER=openai      # principal
AI_PROVIDER=anthropic   # alternativo
AI_PROVIDER=mock        # tests / local
```

## Configurar OpenAI (principal)

```text
AI_PROVIDER=openai
OPENAI_API_KEY=...            # obligatorio; si falta -> error claro (OPENAI_API_KEY_MISSING)
OPENAI_MODEL=gpt-4o-mini      # configurable; debe soportar salida estructurada (json_schema strict)
```

Modelos compatibles con salida estructurada estricta: `gpt-4o-mini`, `gpt-4o`,
`gpt-5.5`, entre otros. El modelo **no** se fija en el codigo; consulta la
documentacion oficial de OpenAI para el modelo vigente que prefieras.

El proveedor usa la Chat Completions API (`/v1/chat/completions`) con
`response_format` de tipo `json_schema` (`strict: true`).

## Configurar Anthropic (alternativo)

```text
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=...         # obligatorio para este proveedor
ANTHROPIC_MODEL=claude-opus-4-8
```

Compatibilidad temporal: si no defines `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`, se
usan las antiguas `AI_API_KEY`/`AI_MODEL` si existen. La configuracion nueva
debe usar el esquema `ANTHROPIC_*`.

## Usar mock

```text
AI_PROVIDER=mock
```

No requiere claves ni red. Es el valor por defecto y el que usan los tests
automaticos (CI nunca depende de APIs externas). Devuelve preguntas realistas
pero claramente ficticias.

## Limites

```text
MAX_GENERATION_INPUT_CHARS=20000   # caracteres de material enviados al proveedor
MAX_GENERATED_QUESTIONS=20         # maximo de preguntas por generacion
```

## Reglas de seguridad

- Nunca hardcodear claves en el codigo.
- Nunca subir el `.env` real ni poner claves reales en documentacion.
- Las claves son **solo de servidor**: jamas con prefijo `VITE_` ni en el bundle.

## Recordatorio

- OpenAI (o Anthropic) **genera preguntas candidatas**, no las valida.
- Toda pregunta generada queda en `draft`, `pending_review` o `needs_fix`,
  **nunca** `validated`.
- La **revision humana sigue siendo obligatoria** antes de aprobar.
