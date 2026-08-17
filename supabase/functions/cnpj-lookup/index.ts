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

function nullableBoolean(value: unknown) {
  return value === true ? true : value === false ? false : null;
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

  let body: { cnpj?: string; clientId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400, headers);
  }

  let client: { id: string; document: string | null } | null = null;
  if (body.clientId) {
    const { data, error } = await db.from("clients").select("id,document").eq("id", body.clientId).maybeSingle();
    if (error) return json({ error: "client_lookup_failed" }, 500, headers);
    if (!data) return json({ error: "client_not_found" }, 404, headers);
    client = data;
  }

  const bodyCnpj = digits(String(body.cnpj ?? ""));
  const clientCnpj = digits(String(client?.document ?? ""));
  if (bodyCnpj && clientCnpj && bodyCnpj !== clientCnpj) return json({ error: "client_cnpj_mismatch" }, 409, headers);
  const cnpj = bodyCnpj || clientCnpj;
  if (!validCnpj(cnpj)) return json({ error: "invalid_cnpj" }, 422, headers);

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { Accept: "application/json", "User-Agent": "HRX-Solutions-Admin/2.0" },
    });
    if (response.status === 404) return json({ error: "cnpj_not_found" }, 404, headers);
    if (!response.ok) return json({ error: "lookup_unavailable" }, 502, headers);

    const data = await response.json();
    const phone = String(data.ddd_telefone_1 ?? data.ddd_telefone_2 ?? "").trim();
    const street = [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(" ").trim();
    const fiscalAddress = {
      street,
      number: data.numero ?? "",
      complement: data.complemento ?? "",
      district: data.bairro ?? "",
      city: data.municipio ?? "",
      state: data.uf ?? "",
      zipCode: data.cep ?? "",
    };
    const formattedAddress = [
      [street, data.numero].filter(Boolean).join(", "),
      data.complemento,
      data.bairro,
      [data.municipio, data.uf].filter(Boolean).join(" - "),
      data.cep ? `CEP ${data.cep}` : "",
    ].filter(Boolean).join(" · ");

    const simpleOption = nullableBoolean(data.opcao_pelo_simples);
    const meiOption = nullableBoolean(data.opcao_pelo_mei);
    const automaticRegime = meiOption === true ? "MEI" : simpleOption === true ? "SIMPLES_NACIONAL" : null;
    const regimes = Array.isArray(data.regime_tributario) ? [...data.regime_tributario] : [];
    regimes.sort((a, b) => Number(b?.ano ?? 0) - Number(a?.ano ?? 0));
    const latestRegime = regimes[0] ?? null;
    const secondaryCnaes = Array.isArray(data.cnaes_secundarios)
      ? data.cnaes_secundarios.map((item: Record<string, unknown>) => ({
          code: item.codigo == null ? "" : String(item.codigo),
          description: String(item.descricao ?? ""),
        }))
      : [];
    const status = String(data.descricao_situacao_cadastral ?? "").toUpperCase();
    const federalValidationStatus = status === "ATIVA" ? "REGULAR_CADASTRALMENTE" : status ? "ATENCAO" : "NAO_VERIFICADO";
    const sefazVerificationUrl = data.uf === "AM" ? "https://online.sefaz.am.gov.br/sintegra/" : null;
    const checkedAt = new Date().toISOString();

    let existing: Record<string, unknown> | null = null;
    if (client) {
      const existingResult = await db.from("client_fiscal_profiles")
        .select("tax_regime,tax_regime_source,tax_regime_requires_confirmation,manual_confirmed_by,manual_confirmed_at,state_registration,state_registration_status,icms_taxpayer,state_validation_status")
        .eq("client_id", client.id)
        .maybeSingle();
      if (existingResult.error) return json({ error: "fiscal_profile_lookup_failed" }, 500, headers);
      existing = existingResult.data;
    }

    const preserveManualRegime = !automaticRegime && existing?.tax_regime_source === "manual_admin" && Boolean(existing?.tax_regime);
    const taxRegime = automaticRegime ?? (preserveManualRegime ? String(existing?.tax_regime) : null);
    const taxRegimeSource = automaticRegime ? "public_cnpj_data" : preserveManualRegime ? "manual_admin" : "requires_confirmation";
    const taxRegimeRequiresConfirmation = automaticRegime ? false : preserveManualRegime ? false : true;

    if (client) {
      const profile = {
        client_id: client.id,
        cnpj,
        legal_name: data.razao_social ?? null,
        trade_name: data.nome_fantasia ?? null,
        registration_status: status || null,
        registration_status_date: data.data_situacao_cadastral ?? null,
        registration_status_reason: data.descricao_motivo_situacao_cadastral ?? null,
        main_cnae_code: data.cnae_fiscal == null ? null : String(data.cnae_fiscal),
        main_cnae_description: data.cnae_fiscal_descricao ?? null,
        secondary_cnaes: secondaryCnaes,
        legal_nature: data.natureza_juridica ?? null,
        company_size: data.descricao_porte || data.porte || null,
        simple_option: simpleOption,
        simple_start_date: data.data_opcao_pelo_simples ?? null,
        simple_end_date: data.data_exclusao_do_simples ?? null,
        mei_option: meiOption,
        mei_start_date: data.data_opcao_pelo_mei ?? null,
        mei_end_date: data.data_exclusao_do_mei ?? null,
        tax_regime: taxRegime,
        tax_regime_requires_confirmation: taxRegimeRequiresConfirmation,
        tax_regime_reference: latestRegime?.forma_de_tributacao ?? null,
        tax_regime_reference_year: latestRegime?.ano ?? null,
        tax_regime_source: taxRegimeSource,
        state_registration: existing?.state_registration ?? null,
        state_registration_status: existing?.state_registration_status ?? null,
        icms_taxpayer: existing?.icms_taxpayer ?? null,
        federal_validation_status: federalValidationStatus,
        state_validation_status: existing?.state_validation_status ?? (data.uf === "AM" ? "PENDENTE_SEFAZ_AM" : "NAO_VERIFICADO"),
        fiscal_address: fiscalAddress,
        data_source: "BrasilAPI / Minha Receita",
        data_source_official: false,
        source_note: "Dados públicos automatizados do CNPJ. A regularidade fiscal por certidão e a situação da inscrição estadual exigem validações próprias.",
        sefaz_verification_url: sefazVerificationUrl,
        checked_at: checkedAt,
        updated_at: checkedAt,
        manual_confirmed_by: automaticRegime ? null : existing?.manual_confirmed_by ?? null,
        manual_confirmed_at: automaticRegime ? null : existing?.manual_confirmed_at ?? null,
      };
      const { error: saveError } = await db.from("client_fiscal_profiles").upsert(profile, { onConflict: "client_id" });
      if (saveError) {
        console.error("fiscal profile save failed", saveError);
        return json({ error: "fiscal_profile_save_failed" }, 500, headers);
      }
    }

    return json({
      cnpj,
      clientId: client?.id ?? null,
      saved: Boolean(client),
      legalName: data.razao_social ?? "",
      tradeName: data.nome_fantasia ?? "",
      status,
      statusDate: data.data_situacao_cadastral ?? null,
      statusReason: data.descricao_motivo_situacao_cadastral ?? "",
      openedAt: data.data_inicio_atividade ?? null,
      phone,
      email: data.email ?? "",
      street,
      number: data.numero ?? "",
      complement: data.complemento ?? "",
      district: data.bairro ?? "",
      city: data.municipio ?? "",
      state: data.uf ?? "",
      zipCode: data.cep ?? "",
      address: formattedAddress,
      cnaeCode: data.cnae_fiscal ?? null,
      cnaeDescription: data.cnae_fiscal_descricao ?? "",
      secondaryCnaes,
      legalNature: data.natureza_juridica ?? "",
      companySize: data.descricao_porte || data.porte || "",
      simpleOption,
      simpleStartDate: data.data_opcao_pelo_simples ?? null,
      simpleEndDate: data.data_exclusao_do_simples ?? null,
      meiOption,
      meiStartDate: data.data_opcao_pelo_mei ?? null,
      meiEndDate: data.data_exclusao_do_mei ?? null,
      taxRegime,
      taxRegimeRequiresConfirmation,
      taxRegimeReference: latestRegime?.forma_de_tributacao ?? null,
      taxRegimeReferenceYear: latestRegime?.ano ?? null,
      federalValidationStatus,
      stateValidationStatus: existing?.state_validation_status ?? (data.uf === "AM" ? "PENDENTE_SEFAZ_AM" : "NAO_VERIFICADO"),
      source: "BrasilAPI / Minha Receita",
      officialAutomatic: false,
      officialNote: "A consulta automática oficial em tempo real da Receita Federal via Serpro exige credenciais contratadas.",
      sefazVerificationUrl,
      checkedAt,
    }, 200, headers);
  } catch (error) {
    console.error("cnpj lookup failed", error);
    return json({ error: "lookup_unavailable" }, 502, headers);
  }
});
