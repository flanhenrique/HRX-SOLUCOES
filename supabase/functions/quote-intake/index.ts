import { createClient } from 'npm:@supabase/supabase-js@2'

type Payload = {
  name?: string
  email?: string
  phone?: string
  company?: string
  reason?: string
  interests?: string[]
  request?: string
  desiredDeadline?: string
  preferredContact?: 'whatsapp' | 'email'
  privacyConsent?: boolean
  marketingConsent?: boolean
  source?: string
}

const serviceRules: { key: string; terms: string[] }[] = [
  { key: 'site_institucional', terms: ['site institucional', 'site para empresa', 'site da empresa', 'website'] },
  { key: 'landing_page', terms: ['landing page', 'pagina de venda', 'página de venda', 'pagina unica', 'página única'] },
  { key: 'catalogo_digital', terms: ['catalogo digital', 'catálogo digital', 'catalogo online', 'catálogo online'] },
  { key: 'automacao', terms: ['automacao', 'automação', 'automatizar', 'automatico', 'automático', 'n8n'] },
  { key: 'integracao_api', terms: ['api', 'integracao', 'integração', 'conectar sistemas'] },
  { key: 'sistema_web', terms: ['sistema web', 'sistema interno', 'aplicacao interna', 'aplicação interna', 'portal interno'] },
  { key: 'mvp', terms: ['mvp', 'produto digital', 'aplicativo novo', 'app novo'] },
  { key: 'suporte_digital', terms: ['manutencao de site', 'manutenção de site', 'manutencao de sistema', 'manutenção de sistema', 'suporte tecnico', 'suporte técnico'] },
  { key: 'diagnostico_operacional', terms: ['diagnostico', 'diagnóstico', 'gargalo', 'entender a operacao', 'entender a operação'] },
  { key: 'mapeamento_processos', terms: ['mapear processo', 'mapear processos', 'fluxo de processo', 'fluxograma'] },
  { key: 'implantacao_processo', terms: ['implantar processo', 'organizar processo', 'padronizar processo', 'rotina operacional'] },
  { key: 'implantacao_crm', terms: ['crm', 'funil comercial', 'funil de vendas', 'pipeline comercial'] },
  { key: 'organizacao_atendimento', terms: ['atendimento ao cliente', 'organizar atendimento', 'chamados', 'suporte ao cliente'] },
  { key: 'organizacao_administrativa', terms: ['organizacao administrativa', 'organização administrativa', 'rotina administrativa', 'backoffice'] },
  { key: 'gestao_documental', terms: ['gestao documental', 'gestão documental', 'organizar documentos', 'arquivo digital'] },
  { key: 'pop', terms: ['pop', 'procedimento operacional', 'manual de processo', 'procedimento interno'] },
  { key: 'controle_contratos', terms: ['controle de contratos', 'vencimento de contrato', 'gestao de contratos', 'gestão de contratos'] },
  { key: 'planilha', terms: ['planilha', 'excel', 'controle em planilha'] },
  { key: 'organizacao_financeira', terms: ['organizacao financeira', 'organização financeira', 'contas a pagar', 'contas a receber', 'fluxo de caixa'] },
  { key: 'faturamento_cobranca', terms: ['cobranca', 'cobrança', 'faturamento', 'inadimplencia', 'inadimplência'] },
  { key: 'conciliacao', terms: ['conciliacao', 'conciliação', 'conferir extrato', 'conferencia financeira', 'conferência financeira'] },
  { key: 'relatorio_gerencial', terms: ['relatorio gerencial', 'relatório gerencial', 'indicadores financeiros', 'relatorio financeiro', 'relatório financeiro'] },
  { key: 'apoio_fiscal_documental', terms: ['documentos fiscais', 'organizar notas', 'apoio fiscal', 'enviar para contabilidade'] },
  { key: 'dossie_credito', terms: ['credito bancario', 'crédito bancário', 'financiamento', 'dossie de credito', 'dossiê de crédito'] },
]

const normalize = (value: string) => value.toLocaleLowerCase('pt-BR')

function interpretRequest(payload: Payload) {
  const text = normalize(`${payload.reason ?? ''} ${(payload.interests ?? []).join(' ')} ${payload.request ?? ''}`)
  const matches = serviceRules.filter((rule) => rule.terms.some((term) => text.includes(term))).map((rule) => rule.key)
  const unique = [...new Set(matches)]

  let confidence = 35
  if (unique.length === 1) confidence = 82
  if (unique.length >= 2 && unique.length <= 4) confidence = 72
  if (unique.length > 4) confidence = 55

  const missing: string[] = []
  if ((payload.request ?? '').trim().length < 80) missing.push('Detalhar melhor o escopo e o cenário atual')
  if (!payload.desiredDeadline) missing.push('Confirmar prazo desejado')
  if (unique.length === 0) missing.push('Identificar o serviço principal')

  return {
    serviceKeys: unique,
    confidence,
    missing,
    summary: unique.length
      ? `Demanda relacionada a ${unique.length} serviço(s) do catálogo, pendente de validação humana.`
      : 'Demanda recebida sem correspondência segura no catálogo. Revisão humana necessária.',
  }
}

function protocol() {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replaceAll('-', '')
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase()
  return `HRX-${date}-${suffix}`
}

function cors(origin: string | null) {
  const configured = (Deno.env.get('HRX_ALLOWED_ORIGINS') ?? 'http://localhost:5173')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const allowedOrigin = origin && configured.includes(origin) ? origin : configured[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const headers = cors(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...headers, 'Content-Type': 'application/json' } })

  const allowedOrigins = (Deno.env.get('HRX_ALLOWED_ORIGINS') ?? 'http://localhost:5173').split(',').map((item) => item.trim())
  if (origin && !allowedOrigins.includes(origin)) {
    return new Response(JSON.stringify({ error: 'origin_not_allowed' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'server_not_configured' }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } })
  }

  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } })
  }

  const name = (payload.name ?? '').trim()
  const email = (payload.email ?? '').trim().toLowerCase()
  const phone = (payload.phone ?? '').trim()
  const requestText = (payload.request ?? '').trim()

  if (!name || !email || !phone || requestText.length < 20 || payload.privacyConsent !== true) {
    return new Response(JSON.stringify({ error: 'invalid_payload' }), { status: 422, headers: { ...headers, 'Content-Type': 'application/json' } })
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailPattern.test(email)) {
    return new Response(JSON.stringify({ error: 'invalid_email' }), { status: 422, headers: { ...headers, 'Content-Type': 'application/json' } })
  }

  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const recentSince = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const { count } = await db.from('quote_requests').select('id', { count: 'exact', head: true }).eq('email', email).gte('created_at', recentSince)
  if ((count ?? 0) >= 2) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } })
  }

  const interpretation = interpretRequest(payload)
  const requestProtocol = protocol()

  const { data: requestRow, error: requestError } = await db.from('quote_requests').insert({
    protocol: requestProtocol,
    name,
    email,
    phone,
    company: payload.company?.trim() || null,
    reason: payload.reason ?? 'orcamento',
    interests: payload.interests ?? [],
    request_text: requestText,
    desired_deadline: payload.desiredDeadline?.trim() || null,
    preferred_contact: payload.preferredContact ?? 'whatsapp',
    privacy_consent: true,
    marketing_consent: payload.marketingConsent === true,
    source: 'website',
    status: 'interpreting',
  }).select('id').single()

  if (requestError || !requestRow) {
    console.error('quote request insert failed', requestError)
    return new Response(JSON.stringify({ error: 'storage_failed' }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } })
  }

  await db.from('quote_interpretations').insert({
    request_id: requestRow.id,
    summary: interpretation.summary,
    suggested_service_keys: interpretation.serviceKeys,
    confidence: interpretation.confidence,
    missing_information: interpretation.missing,
    interpretation_method: 'rules-v1',
    raw_result: { matched: interpretation.serviceKeys },
  })

  let baseAmount = 0
  let draftStatus: 'awaiting_review' | 'needs_scope' = 'needs_scope'

  if (interpretation.serviceKeys.length) {
    const { data: pricing } = await db.from('pricing_rules')
      .select('service_key,service_name,base_amount')
      .in('service_key', interpretation.serviceKeys)
      .eq('active', true)

    if (pricing?.length) {
      baseAmount = pricing.reduce((sum, item) => sum + Number(item.base_amount), 0)
      draftStatus = 'awaiting_review'

      const { data: draft } = await db.from('quote_drafts').insert({
        request_id: requestRow.id,
        base_amount: baseAmount,
        pre_discount_amount: baseAmount,
        final_amount: baseAmount,
        estimated_net: baseAmount,
        status: draftStatus,
      }).select('id').single()

      if (draft) {
        await db.from('quote_items').insert(pricing.map((item, index) => ({
          draft_id: draft.id,
          service_key: item.service_key,
          service_name: item.service_name,
          quantity: 1,
          unit_amount: Number(item.base_amount),
          total_amount: Number(item.base_amount),
          source: 'engine',
          sort_order: index,
        })))
      }
    }
  }

  if (draftStatus === 'needs_scope') {
    await db.from('quote_drafts').insert({
      request_id: requestRow.id,
      base_amount: 0,
      pre_discount_amount: 0,
      final_amount: 0,
      estimated_net: 0,
      status: 'needs_scope',
    })
  }

  await db.from('quote_requests').update({ status: draftStatus === 'awaiting_review' ? 'awaiting_review' : 'needs_scope', updated_at: new Date().toISOString() }).eq('id', requestRow.id)

  await db.from('outbound_messages').insert({
    request_id: requestRow.id,
    channel: 'email',
    template_key: 'quote_received_confirmation',
    status: 'pending',
    payload: { to: email, name, protocol: requestProtocol },
  })

  await db.from('quote_audit_log').insert({
    request_id: requestRow.id,
    event_type: 'request_received',
    event_data: { confidence: interpretation.confidence, services: interpretation.serviceKeys },
  })

  return new Response(JSON.stringify({
    requestId: requestRow.id,
    protocol: requestProtocol,
    status: draftStatus === 'awaiting_review' ? 'awaiting_review' : 'received',
  }), { status: 201, headers: { ...headers, 'Content-Type': 'application/json' } })
})
