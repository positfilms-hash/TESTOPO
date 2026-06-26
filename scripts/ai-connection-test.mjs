#!/usr/bin/env node
// SPEC 041 — Prueba interna de conexion con el proveedor IA OpenAI-compatible.
//
// Uso (Fase 0: valida el modelo local ANTES de tocar la app):
//   AI_PROVIDER=lmstudio AI_BASE_URL=http://localhost:1234/v1 AI_API_KEY=lm-studio \
//   AI_MODEL=qwen3-8b-instruct node scripts/ai-connection-test.mjs
//
// Tambien sirve para OpenAI o el futuro servidor europeo: solo cambia las env.
//
// Comprueba: que el servidor responde, que el modelo/base URL estan configurados,
// que se puede generar JSON simple y que hay timeout controlado. NUNCA imprime la
// api key ni la cabecera Authorization. Es una utilidad de SERVIDOR/DEV: no forma
// parte del frontend ni expone secretos al navegador.

const env = process.env;

function pick(...names) {
  for (const n of names) {
    const v = env[n];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return '';
}

function normalizeBaseUrl(u) {
  return u.trim().replace(/\/+$/, '');
}

function sanitizeBaseUrl(u) {
  try {
    const url = new URL(u);
    url.username = '';
    url.password = '';
    url.search = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return normalizeBaseUrl(u).replace(/^[a-z]+:\/\//i, '');
  }
}

const provider = pick('AI_PROVIDER').toLowerCase();
const baseUrl = normalizeBaseUrl(pick('AI_BASE_URL', 'OPENAI_BASE_URL') || 'https://api.openai.com/v1');
const apiKey = pick('AI_API_KEY', 'OPENAI_API_KEY');
const model = pick('AI_MODEL', 'OPENAI_MODEL') || 'gpt-4o-mini';
const timeoutMs = Number.parseInt(pick('AI_REQUEST_TIMEOUT_MS') || '120000', 10) || 120000;

console.log('— Prueba de conexion IA (SPEC 041) —');
console.log(`  proveedor : ${provider || '(no definido)'}`);
console.log(`  base URL  : ${sanitizeBaseUrl(baseUrl)}`);
console.log(`  modelo    : ${model}`);
console.log(`  api key   : ${apiKey ? 'definida (oculta)' : 'NO definida'}`);
console.log(`  timeout   : ${timeoutMs} ms`);

if (!apiKey) {
  console.error('\n✗ provider_not_configured: falta AI_API_KEY/OPENAI_API_KEY.');
  process.exit(2);
}

const url = `${normalizeBaseUrl(baseUrl)}/chat/completions`;
const body = {
  model,
  temperature: 0,
  messages: [
    { role: 'system', content: 'Responde SOLO con JSON valido, sin texto adicional.' },
    {
      role: 'user',
      content:
        'Genera una pregunta tipo test sobre la Constitucion Espanola con 4 opciones, una ' +
        'unica respuesta correcta y una explicacion breve. Devuelve JSON con statement, ' +
        'options (array), correct_index y explanation.',
    },
  ],
  response_format: { type: 'json_object' },
};
// Qwen3: desactiva el thinking en proveedores locales salvo AI_ENABLE_THINKING=true.
if (provider && provider !== 'openai' && pick('AI_ENABLE_THINKING').toLowerCase() !== 'true') {
  body.chat_template_kwargs = { enable_thinking: false };
}

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);
const startedAt = Date.now();

try {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timer);
  const ms = Date.now() - startedAt;

  if (!resp.ok) {
    let err = null;
    try {
      err = await resp.json();
    } catch {
      err = null;
    }
    const code = err?.error?.code ?? err?.error?.type ?? null;
    console.error(`\n✗ provider_http_${resp.status} (${ms} ms) code=${code ?? ''}`);
    if (resp.status === 401 || resp.status === 403) console.error('  -> revisa AI_API_KEY.');
    if (resp.status === 404) console.error('  -> modelo no encontrado o base URL incorrecta.');
    process.exit(3);
  }

  const data = await resp.json();
  let content = data?.choices?.[0]?.message?.content ?? '';
  content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/i, '').trim();
  let parsed = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error(`\n✗ provider_invalid_json (${ms} ms): el modelo no devolvio JSON parseable.`);
    console.error('  primeros 200 chars:', content.slice(0, 200));
    process.exit(4);
  }

  console.log(`\n✓ Conexion y generacion OK (${ms} ms).`);
  if (data?.usage) console.log('  usage:', JSON.stringify(data.usage));
  console.log('  pregunta de prueba:', JSON.stringify(parsed).slice(0, 300));
  process.exit(0);
} catch (e) {
  clearTimeout(timer);
  const ms = Date.now() - startedAt;
  if (e?.name === 'AbortError') {
    console.error(`\n✗ provider_timeout: sin respuesta en ${timeoutMs} ms (${ms} ms transcurridos).`);
    process.exit(5);
  }
  console.error(`\n✗ provider_network_error (${ms} ms): ¿servidor apagado o IP/puerto incorrectos?`);
  console.error('  detalle:', e?.message ?? String(e));
  process.exit(6);
}
