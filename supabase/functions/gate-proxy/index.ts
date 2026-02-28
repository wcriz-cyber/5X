// supabase/functions/gate-proxy/index.ts
// ─────────────────────────────────────────────────────────────────
//  PROXY GATE.IO — Supabase Edge Function
//  Firma cada request con HMAC-SHA512 y lo reenvía a la API de Gate.io
//  Variables de entorno requeridas:
//    GATE_API_KEY     → Tu API Key de Gate.io
//    GATE_API_SECRET  → Tu API Secret de Gate.io
// ─────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATE_BASE = "https://api.gateio.ws/api/v4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HMAC-SHA512 con Web Crypto API
async function hmacSha512(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Generar firma Gate.io
async function gateSign(
  apiSecret: string,
  method: string,
  path: string,
  query: string,
  body: string
): Promise<{ timestamp: string; signature: string }> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const bodyHash = body
    ? Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-512", new TextEncoder().encode(body)))
      ).map(b => b.toString(16).padStart(2, "0")).join("")
    : "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

  const msg = [method.toUpperCase(), path, query, bodyHash, timestamp].join("\n");
  const signature = await hmacSha512(apiSecret, msg);
  return { timestamp, signature };
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey    = Deno.env.get("GATE_API_KEY")    ?? "";
    const apiSecret = Deno.env.get("GATE_API_SECRET") ?? "";

    if (!apiKey || !apiSecret) {
      return new Response(JSON.stringify({ error: "API keys no configuradas en Edge Function" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { method, endpoint, params, body } = await req.json();
    const gateMethod = (method || "GET").toUpperCase();
    const gatePath   = "/api/v4" + endpoint;

    // Construir query string
    const query = params
      ? Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&")
      : "";

    const bodyStr = body ? JSON.stringify(body) : "";
    const { timestamp, signature } = await gateSign(apiSecret, gateMethod, gatePath, query, bodyStr);

    const url = GATE_BASE + endpoint + (query ? "?" + query : "");
    const gateRes = await fetch(url, {
      method: gateMethod,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "KEY": apiKey,
        "Timestamp": timestamp,
        "SIGN": signature,
      },
      body: bodyStr || undefined,
    });

    const data = await gateRes.json();
    return new Response(JSON.stringify(data), {
      status: gateRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
