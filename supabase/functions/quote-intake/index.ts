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
  { key: 'automacao_avancada', terms: ['automacao avancada', 'automação avançada', 'automacao complexa', 'automação complexa', 'multiplas automacoes', 'múltiplas automações'] },
  { key: 'automacao_intermediaria', terms: ['automacao intermediaria', 'automação intermediária', 'automacao com integracao', 'automação com integração', 'automacao integrada', 'automação integrada'] },
  { key: 'automacao', terms: ['automacao simples', 'automação simples', 'automatizar tarefa', 'automatizar rotina', 'n8n', 'zapier', 'make.com'] },
  { key: 'integracao_api', terms: ['integracao via api', 'integração via api', 'integracao api', 'integração api', 'conectar sistemas', 'webhook'] },
  { key: 'sistema_web', terms: ['sistema web', 'sistema interno', 'aplicacao interna', 'aplicação interna', 'portal interno'] },
  { key: 'mvp', terms: ['mvp', 'produto digital', 'aplicativo novo', 'app novo', 'prototipo funcional', 'protótipo funcional'] },
  { key: 'suporte_digital', terms: ['manutencao de site', 'manutenção de site', 'manutencao de sistema', 'manutenção de sistema', 'suporte tecnico', 'suporte técnico', 'evolucao de sistema', 'evolução de sistema'] },

  { key: 'diagnostico_operacional', terms: ['diagnostico operacional', 'diagnóstico operacional', 'gargalo', 'entender a operacao', 'entender a operação'] },
  { key: 'mapeamento_processos', terms: ['mapear processo', 'mapear processos', 'mapeamento de processos', 'fluxo de processo', 'fluxograma'] },
  { key: 'estrutura_rotina_processo', terms: ['estruturar rotina', 'estruturação de rotina', 'estruturacao de rotina', 'estruturar processo', 'estruturação de processo', 'estruturacao de processo'] },
  { key: 'implantacao_processo', terms: ['implantar processo', 'implantação de processo', 'implantacao de processo', 'padronizar processo', 'rotina operacional'] },
  { key: 'gestao_recorrente_crm', terms: ['gestao recorrente de crm', 'gestão recorrente de crm', 'operacao de crm', 'operação de crm', 'administrar crm', 'gestao mensal de crm', 'gestão mensal de crm'] },
  { key: 'implantacao_crm', terms: ['implantacao de crm', 'implantação de crm', 'implantar crm', 'configurar crm', 'funil comercial', 'funil de vendas', 'pipeline comercial'] },
  { key: 'organizacao_atendimento', terms: ['atendimento ao cliente', 'organizar atendimento', 'chamados', 'suporte ao cliente', 'relacionamento com clientes'] },

  { key: 'organizacao_administrativa', terms: ['organizacao administrativa', 'organização administrativa', 'rotina administrativa', 'backoffice'] },
  { key: 'gestao_documental', terms: ['gestao documental', 'gestão documental', 'organizar documentos', 'arquivo digital'] },
  { key: 'kit_documentos_ate_5', terms: ['kit de documentos', 'kit documentos', 'padronizar documentos', 'ate 5 documentos', 'até 5 documentos'] },
  { key: 'procedimentos_ate_5', terms: ['pacote de procedimentos', 'ate 5 procedimentos', 'até 5 procedimentos', 'cinco procedimentos'] },
  { key: 'pop', terms: ['pop', 'procedimento operacional', 'manual de processo', 'procedimento interno'] },
  { key: 'controle_contratos', terms: ['controle de contratos', 'vencimento de contrato', 'gestao de contratos', 'gestão de contratos'] },
  { key: 'planilha_avancada', terms: ['planilha avancada', 'planilha avançada', 'dashboard em excel', 'planilha automatizada', 'excel avancado', 'excel avançado'] },
  { key: 'planilha', terms: ['planilha simples', 'controle em planilha', 'planilha de controle', 'excel simples'] },

  { key: 'organizacao_financeira', terms: ['organizacao financeira', 'organização financeira', 'contas a pagar', 'contas a receber', 'fluxo de caixa'] },
  { key: 'faturamento_cobranca', terms: ['cobranca', 'cobrança', 'faturamento', 'inadimplencia', 'inadimplência'] },
  { key: 'conciliacao', terms: ['conciliacao', 'conciliação', 'conferir extrato', 'conferencia financeira', 'conferência financeira'] },
  { key: 'relatorio_gerencial', terms: ['relatorio gerencial', 'relatório gerencial', 'indicadores financeiros', 'relatorio financeiro', 'relatório financeiro'] },
  { key: 'apoio_fiscal_documental', terms: ['documentos fiscais', 'organizar notas', 'apoio fiscal', 'enviar para contabilidade'] },
  { key: 'dossie_credito', terms: ['credito bancario', 'crédito bancário', 'financiamento', 'dossie de credito', 'dossiê de crédito'] },

  { key: 'recorrente_essencial', terms: ['plano essencial', 'recorrente essencial', 'pacote essencial', '6h por mes', '6 horas por mes', '6 horas por mês'] },
  { key: 'recorrente_gestao', terms: ['plano gestao', 'plano gestão', 'recorrente gestao', 'recorrente gestão', '14h por mes', '14 horas por mês'] },
  { key: 'recorrente_operacao', terms: ['plano operacao', 'plano operação', 'recorrente operacao', 'recorrente operação', '24h por mes', '24 horas por mês'] },
]

const defaultOrigins = [
  'http://localhost:5173',
  'https://flanhenrique.github.io',
  'https://hrxsolutions.com.br',
  'https://www.hrxsolutions.com.br',
]
const normalize = (value: string) => value.toLocaleLowerCase('pt-BR')

function allowedOrigins() {
  const configured = (Deno.env.get('HRX_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  return [...new Set([...defaultOrigins, ...configured])]
}

function publishableKeys() {
  try {
    const parsed = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<string, string>
    return Object.values(parsed)
  } catch {
    return []
  }
}

function resolveServiceKeys(text: string) {
  const matches = serviceRules.filter((rule) => rule.terms.some((term) => text.includes(term))).map((rule) => rule.key)
  const unique = [...new Set(matches)]

  if (unique.includes('automacao_avancada') || unique.includes('automacao_intermediaria')) {
    return unique.filter((key) => key !== 'automacao')
  }
  if (unique.includes('planilha_avancada')) {
    return unique.filter((key) => key !== 'planilha')
  }
  if (unique.includes('procedimentos_ate_5')) {
    return unique.filter((key) => key !== 'pop')
  }
  if (unique.includes('gestao_recorrente_crm')) {
    return unique.filter((key) => key !== 'implantacao_crm')
  }
  return unique
}

function interpretRequest(payload: Payload) {
  const text = normalize(`${payload.reason ?? ''} ${(payload.interests ?? []).join(' ')} ${payload.request ?? ''}`)
  const unique = resolveServiceKeys(text)

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
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  return `HRX-${date}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
}

function cors(origin: string | null) {
  const configured = allowedOrigins()
  const allowedOrigin = origin && configured.includes(origin) ? origin : configured[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const headers = cors(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, headers)
  if (origin && !allowedOrigins().includes(origin)) return json({ error: 'origin_not_allowed' }, 403, headers)

  const apiKey = req.headers.get('apikey') ?? ''
  if (!apiKey || !publishableKeys().includes(apiKey)) return json({ error: 'unauthorized' }, 401, headers)

  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (contentLength > 32_768) return json({ error: 'payload_too_large' }, 413, headers)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'server_not_configured' }, 500, headers)

  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400, headers)
  }

  const name = (payload.name ?? '').trim()
  const email = (payload.email ?? '').trim().toLowerCase()
  const phone = (payload.phone ?? '').trim()
  const requestText = (payload.request ?? '').trim()
  const company = payload.company?.trim() || null
  const desiredDeadline = payload.desiredDeadline?.trim() || null

  if (!name || !email || !phone || requestText.length < 20 || payload.privacyConsent !== true) return json({ error: 'invalid_payload' }, 422, headers)
  if (name.length > 140 || email.length > 254 || phone.length > 60 || requestText.length > 12_000 || (company?.length ?? 0) > 180 || (desiredDeadline?.length ?? 0) > 180) return json({ error: 'invalid_payload_length' }, 422, headers)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'invalid_email' }, 422, headers)

  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const recentSince = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const { count } = await db.from('quote_requests').select('id', { count: 'exact', head: true }).eq('email', email).gte('created_at', recentSince)
  if ((count ?? 0) >= 2) return json({ error: 'rate_limited' }, 429, headers)

  const interpretation = interpretRequest(payload)
  const requestProtocol = protocol()

  const { data: requestRow, error: requestError } = await db.from('quote_requests').insert({
    protocol: requestProtocol,
    name,
    email,
    phone,
    company,
    reason: payload.reason ?? 'orcamento',
    interests: payload.interests ?? [],
    request_text: requestText,
    desired_deadline: desiredDeadline,
    preferred_contact: payload.preferredContact ?? 'whatsapp',
    privacy_consent: true,
    marketing_consent: payload.marketingConsent === true,
    source: 'website',
    status: 'interpreting',
  }).select('id').single()

  if (requestError || !requestRow) {
    console.error('quote request insert failed', requestError)
    return json({ error: 'storage_failed' }, 500, headers)
  }

  await db.from('quote_interpretations').insert({
    request_id: requestRow.id,
    summary: interpretation.summary,
    suggested_service_keys: interpretation.serviceKeys,
    confidence: interpretation.confidence,
    missing_information: interpretation.missing,
    interpretation_method: 'rules-v2',
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
    await db.from('quote_drafts').insert({ request_id: requestRow.id, base_amount: 0, pre_discount_amount: 0, final_amount: 0, estimated_net: 0, status: 'needs_scope' })
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

  return json({ requestId: requestRow.id, protocol: requestProtocol, status: draftStatus === 'awaiting_review' ? 'awaiting_review' : 'received' }, 201, headers)
})
