import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const defaultOrigins = ["http://localhost:5173", "https://flanhenrique.github.io", "https://hrxsolutions.com.br", "https://www.hrxsolutions.com.br"];
const allowedOrigins = () => [...new Set([...defaultOrigins, ...(Deno.env.get("HRX_ALLOWED_ORIGINS") ?? "").split(",").map((item) => item.trim()).filter(Boolean)])];
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins().includes(origin) ? origin : allowedOrigins()[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const json = (body: unknown, status: number, headers: Record<string, string>) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function sha1(value: string) {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}
function passwordPolicy(password: string) {
  const failures: string[] = [];
  if (password.length < 12) failures.push("min_length");
  if (!/[a-z]/.test(password)) failures.push("lowercase");
  if (!/[A-Z]/.test(password)) failures.push("uppercase");
  if (!/\d/.test(password)) failures.push("number");
  if (!/[^A-Za-z0-9]/.test(password)) failures.push("symbol");
  return failures;
}
async function pwnedCount(password: string) {
  const hash = await sha1(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { Accept: "text/plain", "Add-Padding": "true", "User-Agent": "HRX-Solutions-Password-Security/1.0" } });
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
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, headers);
  if (origin && !allowedOrigins().includes(origin)) return json({ error: "origin_not_allowed" }, 403, headers);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "server_not_configured" }, 500, headers);

  let body: { email?: string; code?: string; password?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400, headers); }
  const email = String(body.email ?? "").trim().toLowerCase();
  const code = String(body.code ?? "").trim().toUpperCase();
  const password = String(body.password ?? "");
  if (!email || !code) return json({ error: "invalid_input" }, 400, headers);

  const failures = passwordPolicy(password);
  if (failures.length) return json({ error: "weak_password", failures }, 422, headers);
  let occurrences = 0;
  try { occurrences = await pwnedCount(password); }
  catch (error) { console.error("pwned password check failed", error); return json({ error: "pwned_check_unavailable" }, 503, headers); }
  if (occurrences > 0) return json({ error: "pwned_password", occurrences }, 422, headers);

  const tokenHash = await sha256(code);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: token, error: tokenError } = await admin.from("admin_bootstrap_tokens").select("token_hash,email,user_id,expires_at,used_at").eq("token_hash", tokenHash).eq("email", email).maybeSingle();
  if (tokenError) return json({ error: "bootstrap_lookup_failed" }, 500, headers);
  if (!token) return json({ error: "invalid_code" }, 401, headers);
  if (token.used_at) return json({ error: "code_already_used" }, 409, headers);
  if (new Date(token.expires_at).getTime() <= Date.now()) return json({ error: "code_expired" }, 410, headers);

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(token.user_id);
  if (userError || !userData.user || userData.user.email?.toLowerCase() !== email) return json({ error: "user_not_found" }, 404, headers);
  const { data: allowedAdmin, error: adminLookupError } = await admin.from("admin_users").select("user_id").eq("user_id", token.user_id).maybeSingle();
  if (adminLookupError) return json({ error: "admin_lookup_failed" }, 500, headers);
  if (!allowedAdmin) return json({ error: "forbidden" }, 403, headers);

  const { error: updateError } = await admin.auth.admin.updateUserById(token.user_id, { password, email_confirm: true });
  if (updateError) return json({ error: "password_update_failed" }, 400, headers);
  const { error: consumeError } = await admin.from("admin_bootstrap_tokens").update({ used_at: new Date().toISOString() }).eq("token_hash", tokenHash).is("used_at", null);
  if (consumeError) return json({ error: "token_consume_failed" }, 500, headers);
  return json({ ok: true, pwned: false }, 200, headers);
});
