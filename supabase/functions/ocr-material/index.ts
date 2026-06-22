// TESTOPO - Edge Function: ocr-material (SPEC 030, Fase 2). SCAFFOLD.
//
// Frontera de servidor de CONFIANZA para el OCR/vision de un PDF escaneado. El
// navegador renderiza cada pagina a imagen (sin secretos) y delega aqui el
// reconocimiento; esta funcion es quien guarda la CLAVE del proveedor OCR/vision
// como secreto de SERVIDOR. La clave NUNCA llega al navegador/Vite.
//
// Contrato HTTP (alineado con EdgeFunctionOcrProvider en el backend):
//   request : { page_number: number, image_base64: string }
//   response: { text: string, confidence: number | null, warnings: string[] }
//
// Estado ACTUAL = scaffold: autentica el JWT del gestor y deja marcado el punto
// EXACTO donde se llama al proveedor real. Sin `OCR_PROVIDER_API_KEY` configurada
// responde 501 OCR_PROVIDER_NOT_CONFIGURED. NO contiene ninguna clave real.
//
// Despliegue y secretos: docs/setup/supabase-edge-functions.md.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'OCR_INVALID_REQUEST' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return json({ error: 'OCR_SERVER_NOT_CONFIGURED' }, 500);
  }

  // 1) Autenticacion: la sesion del gestor viaja en el JWT (no en el body). Con
  //    verify_jwt activado (por defecto) Supabase ya exige Authorization; aun asi
  //    revalidamos para obtener el usuario.
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return json({ error: 'OCR_ACCESS_DENIED' }, 401);
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: 'OCR_ACCESS_DENIED' }, 401);
  }

  // 2) Payload: numero de pagina + imagen renderizada (base64). El navegador
  //    nunca recibe la clave del proveedor; solo manda la imagen que ya tiene.
  let body: { page_number?: unknown; image_base64?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'OCR_INVALID_REQUEST' }, 400);
  }
  const pageNumber = typeof body.page_number === 'number' ? body.page_number : null;
  const imageBase64 = typeof body.image_base64 === 'string' ? body.image_base64 : null;
  if (pageNumber === null || imageBase64 === null) {
    return json({ error: 'OCR_INVALID_REQUEST' }, 400);
  }

  // 3) Clave del proveedor OCR/vision: secreto de SERVIDOR. Sin ella, no hay OCR.
  const providerKey = Deno.env.get('OCR_PROVIDER_API_KEY');
  if (!providerKey) {
    return json({ error: 'OCR_PROVIDER_NOT_CONFIGURED' }, 501);
  }

  // 4) === PUNTO DE INTEGRACION DEL PROVEEDOR REAL ===
  //    Aqui se llama al proveedor OCR/vision con `providerKey` (p. ej. una API de
  //    vision que reciba la imagen base64) y se normaliza su salida al contrato:
  //
  //      const out = await callRealOcrProvider({ providerKey, imageBase64 });
  //      return json({ text: out.text, confidence: out.confidence, warnings: out.warnings });
  //
  //    Reglas: no devolver `storage_path`, ni la clave, ni URLs internas de
  //    imagen; acotar tamano/timeout por pagina (ver OcrConfig). Mientras no se
  //    integre, el scaffold responde explicitamente que falta implementacion.
  return json(
    {
      error: 'OCR_PROVIDER_NOT_IMPLEMENTED',
      detail:
        'Edge Function scaffold: falta integrar el proveedor OCR/vision real en el paso 4.',
      page_number: pageNumber,
    },
    501,
  );
});
