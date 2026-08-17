import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const defaultOrigins = [
  "http://localhost:5173",
  "https://flanhenrique.github.io",
  "https://hrxsolutions.com.br",
  "https://www.hrxsolutions.com.br",
];

function allowedOrigins() {
  const configured = (Deno.env.get("HRX_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set([...defaultOrigins, ...configured])];
}

function cors(origin: string | null) {
  const origins = allowedOrigins();
  const allowedOrigin = origin && origins.includes(origin) ? origin : origins[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function validCnpj(value: string) {
  const cnpj = digits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((total, n, i) => total + Number(n) * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calc(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(cnpj.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${d1}${d2}`);
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
  const { data: admin } = await db.from("admin_users").select("user_id").eq("user_id", userData.user.id).maybeSingle();
  if (!admin) return json({ error: "forbidden" }, 403, headers);

  let body: { cnpj?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400, headers);
  }

  const cnpj = digits(String(body.cnpj ?? ""));
  if (!validCnpj(cnpj)) return json({ error: "invalid_cnpj" }, 422, headers);

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { Accept: "application/json", "User-Agent": "HRX-Solutions-Admin/1.0" },
    });
    if (response.status === 404) return json({ error: "cnpj_not_found" }, 404, headers);
    if (!response.ok) return json({ error: "lookup_unavailable" }, 502, headers);

    const data = await response.json();
    const phone = String(data.ddd_telefone_1 ?? data.ddd_telefone_2 ?? "").trim();
    const address = [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(" ").trim();
    const formattedAddress = [
      [address, data.numero].filter(Boolean).join(", "),
      data.complemento,
      data.bairro,
      [data.municipio, data.uf].filter(Boolean).join(" - "),
      data.cep ? `CEP ${data.cep}` : "",
    ].filter(Boolean).join(" · ");

    return json({
      cnpj,
      legalName: data.razao_social ?? "",
      tradeName: data.nome_fantasia ?? "",
      status: data.descricao_situacao_cadastral ?? "",
      openedAt: data.data_inicio_atividade ?? null,
      phone,
      email: data.email ?? "",
      street: address,
      number: data.numero ?? "",
      complement: data.complemento ?? "",
      district: data.bairro ?? "",
      city: data.municipio ?? "",
      state: data.uf ?? "",
      zipCode: data.cep ?? "",
      address: formattedAddress,
      cnaeCode: data.cnae_fiscal ?? null,
      cnaeDescription: data.cnae_fiscal_descricao ?? "",
      source: "BrasilAPI / dados públicos do CNPJ",
      officialAutomatic: false,
      officialNote: "A consulta automática oficial em tempo real da Receita Federal é disponibilizada pelo Serpro e requer credenciais contratadas.",
      sefazVerificationUrl: data.uf === "AM" ? "https://online.sefaz.am.gov.br/sintegra/" : null,
      checkedAt: new Date().toISOString(),
    }, 200, headers);
  } catch (error) {
    console.error("cnpj lookup failed", error);
    return json({ error: "lookup_unavailable" }, 502, headers);
  }
});
