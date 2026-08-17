import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const defaultOrigins = ["http://localhost:5173", "https://flanhenrique.github.io", "https://hrxsolutions.com.br", "https://www.hrxsolutions.com.br"];
const allowedOrigins = () => [...new Set([...defaultOrigins, ...(Deno.env.get("HRX_ALLOWED_ORIGINS") ?? "").split(",").map((item) => item.trim()).filter(Boolean)])];
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins().includes(origin) ? origin : allowedOrigins()[0],
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const json = (body: unknown, status: number, headers: Record<string, string>) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

function passwordPolicy(password: string) {
  const failures: string[] = [];
  if (password.length < 12) failures.push("min_length");
  if (!/[a-z]/.test(password)) failures.push("lowercase");
  if (!/[A-Z]/.test(password)) failures.push("uppercase");
  if (!/\d/.test(password)) failures.push("number");
  if (!/[^A-Za-z0-9]/.test(password)) failures.push("symbol");
  return failures;
}

async function sha1(value: string) {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

async function pwnedCount(password: string) {
  const hash = await sha1(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { Accept: "text/plain", "Add-Padding": "true", "User-Agent": "HRX-Solutions-Password-Security/1.0" },
  });
  if (!response.ok) throw new Error(`pwned_passwords_${response.status}`);
  const text = await response.text();
  for (const line of text.split(/\r?\n/)) {
    const [candidate, count] = line.split(":");
    if (candidate?.trim().toUpperCase() === suffix) return Number(count?.trim() ?? 0) || 0;
  }
  return 0;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = cors(origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, headers);
  if (origin && !allowedOrigins().includes(origin)) return json({ error: "origin_not_allowed" }, 403, headers);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "server_not_configured" }, 500, headers);

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!bearer) return json({ error: "unauthorized" }, 401, headers);

  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await db.auth.getUser(bearer);
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401, headers);

  const { data: admin, error: adminError } = await db.from("admin_users").select("user_id").eq("user_id", userData.user.id).maybeSingle();
  if (adminError) return json({ error: "admin_lookup_failed" }, 500, headers);
  if (!admin) return json({ error: "forbidden" }, 403, headers);

  let body: { password?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400, headers); }
  const password = String(body.password ?? "");
  const failures = passwordPolicy(password);
  if (failures.length) return json({ error: "weak_password", failures }, 422, headers);

  let occurrences = 0;
  try { occurrences = await pwnedCount(password); }
  catch (error) { console.error("pwned password check failed", error); return json({ error: "pwned_check_unavailable" }, 503, headers); }
  if (occurrences > 0) return json({ error: "pwned_password", occurrences }, 422, headers);

  const { error: updateError } = await db.auth.admin.updateUserById(userData.user.id, { password });
  if (updateError) return json({ error: "password_update_failed" }, 400, headers);

  return json({ ok: true, pwned: false }, 200, headers);
});
