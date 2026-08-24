import { createClient } from 'npm:@supabase/supabase-js@2'

type DiscountLevel = 0 | 5 | 10 | 15 | 20
type RetentionPricingMode = 'informational' | 'preserve_net'
type Retentions = { iss?: number; irrf?: number; pis?: number; cofins?: number; csll?: number; inss?: number }
type CommercialStatus = 'draft' | 'reviewed' | 'sent' | 'negotiating' | 'approved' | 'invoiced' | 'received' | 'lost' | 'cancelled'
type ItemInput = { serviceKey?: string | null; serviceName?: string; description?: string; unitLabel?: string; quantity?: number; unitAmount?: number }
type DraftInput = {
  proposalTitle?: string
  projectService?: string
  description?: string
  customerNotes?: string
  notes?: string
  items?: ItemInput[]
  discountPercent?: DiscountLevel
  complexityMultiplier?: number
  urgencyMultiplier?: number
  taxPercent?: number
  desiredFinalAmount?: number | null
  adjustmentReason?: string | null
  paymentProvider?: 'none' | 'nubank' | 'mercadopago'
  paymentMode?: 'cash' | 'installments'
  installments?: number
  installmentIntervalDays?: number
  firstDueDate?: string
  validityDays?: number
  retentions?: Retentions
  retentionPricingMode?: RetentionPricingMode
  fiscalReviewConfirmed?: boolean
}
type ActionPayload =
  | ({ action: 'create_quote'; clientId: string; scope?: string; proposalTitle?: string })
  | ({ action: 'save_quote'; requestId: string } & DraftInput)
  | ({ action: 'approve'; requestId: string })
  | ({ action: 'delete_draft' | 'duplicate_quote'; requestId: string })
  | ({ action: 'finalize'; requestId: string; pdfObjectPath: string; checksumSha256: string; sizeBytes: number })
  | ({ action: 'set_status'; requestId: string; status: CommercialStatus; channel?: string; note?: string })
  | ({ action: 'log_event'; requestId: string; eventType: string; eventData?: Record<string, unknown> })

const defaultOrigins = ['http://localhost:5173', 'https://flanhenrique.github.io', 'https://hrxsolutions.com.br', 'https://www.hrxsolutions.com.br']
const allowedDiscounts: DiscountLevel[] = [0, 5, 10, 15, 20]
const immutableStatuses: CommercialStatus[] = ['approved', 'invoiced', 'received', 'lost', 'cancelled']
const deliveryEvents = new Set(['email_prepared', 'email_shared', 'whatsapp_prepared', 'whatsapp_shared', 'proposal_copied', 'pdf_downloaded'])
const KPI_PAGE_SIZE = 1000

function allowedOrigins() {
  const configured = (Deno.env.get('HRX_ALLOWED_ORIGINS') ?? '').split(',').map((item) => item.trim()).filter(Boolean)
  return [...new Set([...defaultOrigins, ...configured])]
}
function cors(origin: string | null) {
  const configured = allowedOrigins()
  const allowedOrigin = origin && configured.includes(origin) ? origin : configured[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
    Vary: 'Origin',
  }
}
const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } })
const clean = (value: unknown, max = 4000) => String(value ?? '').trim().slice(0, max)
const toCents = (value: unknown) => Math.max(0, Math.round((Number(value) || 0) * 100))
const fromCents = (value: number) => Math.round(value) / 100
const discountTone = (percent: DiscountLevel) => percent <= 5 ? 'green' : percent === 10 ? 'yellow' : percent === 15 ? 'red' : 'purple'
const clampMultiplier = (value: unknown) => Math.min(3, Math.max(0.5, Number(value ?? 1)))
const normalizeRetentions = (value?: Retentions): Required<Retentions> => ({
  iss: Math.max(0, Number(value?.iss ?? 0)),
  irrf: Math.max(0, Number(value?.irrf ?? 0)),
  pis: Math.max(0, Number(value?.pis ?? 0)),
  cofins: Math.max(0, Number(value?.cofins ?? 0)),
  csll: Math.max(0, Number(value?.csll ?? 0)),
  inss: Math.max(0, Number(value?.inss ?? 0)),
})

async function loadCommercialMetrics(db: any) {
  let offset = 0
  let pipelineCents = 0
  let drafts = 0
  let negotiation = 0
  let approved = 0
  let total = 0

  while (true) {
    const { data, error } = await db.from('quote_drafts')
      .select('final_amount,commercial_status,status')
      .order('id', { ascending: true })
      .range(offset, offset + KPI_PAGE_SIZE - 1)
    if (error) throw error

    const rows = data ?? []
    for (const row of rows) {
      total += 1
      const commercialStatus = row.commercial_status as CommercialStatus
      const operationalStatus = String(row.status || '')
      if (!['rejected', 'suspended'].includes(operationalStatus) && !['lost', 'cancelled', 'received'].includes(commercialStatus)) {
        pipelineCents += toCents(row.final_amount)
      }
      if (commercialStatus === 'draft') drafts += 1
      if (['reviewed', 'sent', 'negotiating'].includes(commercialStatus)) negotiation += 1
      if (['approved', 'invoiced', 'received'].includes(commercialStatus)) approved += 1
    }

    if (rows.length < KPI_PAGE_SIZE) break
    offset += KPI_PAGE_SIZE
  }

  return { pipeline: fromCents(pipelineCents), drafts, negotiation, approved, total }
}

async function resolveItems(db: any, draftId: string, items: ItemInput[]) {
  if (!Array.isArray(items) || items.length > 100) throw new Error('invalid_items')
  const requestedCatalogKeys = [...new Set(items.map((item) => clean(item.serviceKey, 100)).filter(Boolean))]
  const { data: catalog } = requestedCatalogKeys.length
    ? await db.from('pricing_rules').select('service_key,service_name,base_amount,active').in('service_key', requestedCatalogKeys).eq('active', true)
    : { data: [] }
  const catalogByKey = new Map((catalog ?? []).map((item: any) => [item.service_key, item]))
  const rows = items.map((item, index) => {
    const serviceKey = clean(item.serviceKey, 100)
    const rule = serviceKey ? catalogByKey.get(serviceKey) : null
    if (serviceKey && !rule) throw new Error('invalid_service')
    const serviceName = clean(rule?.service_name ?? item.serviceName, 240)
    const quantity = Math.min(9999, Math.max(0.01, Number(item.quantity ?? 1)))
    const unitAmountCents = rule ? toCents(rule.base_amount) : toCents(item.unitAmount)
    if (!serviceName || unitAmountCents <= 0) throw new Error('invalid_items')
    return {
      draft_id: draftId,
      service_key: serviceKey || `manual-${crypto.randomUUID()}`,
      service_name: serviceName,
      item_description: clean(item.description, 1200) || null,
      unit_label: clean(item.unitLabel, 30) || 'un.',
      quantity,
      unit_amount: fromCents(unitAmountCents),
      total_amount: fromCents(Math.round(unitAmountCents * quantity)),
      source: 'manual',
      sort_order: index,
    }
  })
  return { rows, baseAmountCents: rows.reduce((sum, item) => sum + toCents(item.total_amount), 0) }
}

async function calculateDraft(db: any, draft: any, baseAmountCents: number, input: DraftInput) {
  const discountPercent = Number(input.discountPercent ?? draft.discount_percent ?? 0) as DiscountLevel
  if (!allowedDiscounts.includes(discountPercent)) throw new Error('invalid_discount')
  const complexity = clampMultiplier(input.complexityMultiplier ?? draft.complexity_multiplier)
  const urgency = clampMultiplier(input.urgencyMultiplier ?? draft.urgency_multiplier)
  const preDiscountCents = Math.round(baseAmountCents * complexity * urgency)
  const discountCents = Math.round(preDiscountCents * discountPercent / 100)
  const taxableCents = Math.max(0, preDiscountCents - discountCents)
  const taxPercent = Math.min(99.9999, Math.max(0, Number(input.taxPercent ?? draft.tax_percent ?? 0)))
  const taxCents = Math.round(taxableCents * taxPercent / 100)
  const paymentProvider = input.paymentProvider ?? draft.payment_provider ?? 'none'
  const paymentMode = input.paymentMode ?? draft.payment_mode ?? 'cash'
  const installments = paymentMode === 'cash' ? 1 : Math.min(24, Math.max(2, Math.round(Number(input.installments ?? draft.installments ?? 2))))
  let feePerInstallmentCents = 0
  if (paymentProvider !== 'none') {
    const { data: providerRule } = await db.from('payment_provider_rules').select('boleto_fee_per_paid').eq('provider', paymentProvider).eq('active', true).maybeSingle()
    feePerInstallmentCents = toCents(providerRule?.boleto_fee_per_paid)
  }
  const paymentFeeCents = feePerInstallmentCents * installments
  const commercialCents = taxableCents + taxCents + paymentFeeCents
  const retentions = normalizeRetentions(input.retentions ?? draft.retentions)
  const retentionTotal = Object.values(retentions).reduce((sum, value) => sum + value, 0)
  if (retentionTotal >= 100) throw new Error('invalid_retention_total')
  const fiscalReviewRequired = retentionTotal > 0
  const fiscalReviewConfirmed = fiscalReviewRequired ? input.fiscalReviewConfirmed === true : false
  const retentionPricingMode: RetentionPricingMode = fiscalReviewRequired
    ? (input.retentionPricingMode ?? draft.retention_pricing_mode ?? 'informational')
    : 'informational'
  const grossUpCents = retentionTotal > 0 ? Math.round(commercialCents / (1 - retentionTotal / 100)) : commercialCents
  const calculatedCents = retentionPricingMode === 'preserve_net' && fiscalReviewConfirmed ? grossUpCents : commercialCents
  const desiredCents = input.desiredFinalAmount == null ? null : toCents(input.desiredFinalAmount)
  if (desiredCents != null && (desiredCents <= 0 || desiredCents > calculatedCents)) throw new Error('invalid_desired_final')
  if (desiredCents != null && clean(input.adjustmentReason, 600).length < 8) throw new Error('adjustment_reason_required')
  const finalCents = desiredCents ?? calculatedCents
  const estimatedNetCents = Math.max(0, finalCents - Math.round(finalCents * retentionTotal / 100))
  const validityDays = Math.min(365, Math.max(1, Math.round(Number(input.validityDays ?? draft.validity_days ?? 15))))
  const validUntil = new Date()
  validUntil.setUTCDate(validUntil.getUTCDate() + validityDays)
  const intervalDays = Math.min(365, Math.max(1, Math.round(Number(input.installmentIntervalDays ?? draft.installment_interval_days ?? 30))))
  const firstDueDate = clean(input.firstDueDate, 10) || new Date().toISOString().slice(0, 10)
  const previousStatus = draft.commercial_status as CommercialStatus
  const commercialStatus: CommercialStatus = ['reviewed', 'sent'].includes(previousStatus) ? 'negotiating' : previousStatus
  return {
    base_amount: fromCents(baseAmountCents),
    complexity_multiplier: complexity,
    urgency_multiplier: urgency,
    pre_discount_amount: fromCents(preDiscountCents),
    discount_percent: discountPercent,
    discount_status: discountTone(discountPercent),
    discount_amount: fromCents(discountCents),
    tax_percent: taxPercent,
    tax_amount: fromCents(taxCents),
    final_amount: fromCents(finalCents),
    custom_final_amount: desiredCents == null ? null : fromCents(desiredCents),
    custom_adjustment_reason: desiredCents == null ? null : clean(input.adjustmentReason, 600),
    payment_provider: paymentProvider,
    payment_mode: paymentMode,
    installments,
    installment_interval_days: intervalDays,
    first_due_date: firstDueDate,
    boleto_fee_per_installment: fromCents(feePerInstallmentCents),
    payment_fee_total: fromCents(paymentFeeCents),
    retentions,
    retention_total: retentionTotal,
    retention_pricing_mode: retentionPricingMode,
    retention_net_target: fromCents(commercialCents),
    retention_gross_up_suggestion: fromCents(grossUpCents),
    estimated_net: fromCents(estimatedNetCents),
    fiscal_review_required: fiscalReviewRequired,
    fiscal_review_confirmed: fiscalReviewConfirmed,
    proposal_title: clean(input.proposalTitle, 240) || null,
    project_service: clean(input.projectService, 240) || null,
    proposal_description: clean(input.description, 6000) || null,
    customer_notes: clean(input.customerNotes, 4000) || null,
    notes: clean(input.notes, 4000) || null,
    validity_days: validityDays,
    valid_until: validUntil.toISOString().slice(0, 10),
    commercial_status: commercialStatus,
    status: baseAmountCents > 0 ? 'awaiting_review' : 'needs_scope',
    approved_by: null,
    approved_at: null,
    updated_at: new Date().toISOString(),
  }
}

function buildInstallments(draftId: string, total: number, count: number, firstDueDate: string, intervalDays: number) {
  const totalCents = toCents(total)
  const base = Math.floor(totalCents / count)
  let remainder = totalCents - base * count
  const first = new Date(`${firstDueDate}T12:00:00Z`)
  if (Number.isNaN(first.getTime())) throw new Error('invalid_first_due_date')
  return Array.from({ length: count }, (_, index) => {
    const due = new Date(first)
    due.setUTCDate(due.getUTCDate() + intervalDays * index)
    return {
      draft_id: draftId,
      installment_number: index + 1,
      amount: fromCents(base + (remainder-- > 0 ? 1 : 0)),
      due_date: due.toISOString().slice(0, 10),
      status: 'planned',
    }
  })
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const headers = cors(origin)
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (origin && !allowedOrigins().includes(origin)) return json({ error: 'origin_not_allowed' }, 403, headers)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'server_not_configured' }, 500, headers)
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!bearer) return json({ error: 'unauthorized' }, 401, headers)
  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userResult, error: userError } = await db.auth.getUser(bearer)
  const user = userResult.user
  if (userError || !user) return json({ error: 'unauthorized' }, 401, headers)
  const { data: claimsResult, error: claimsError } = await db.auth.getClaims(bearer)
  if (claimsError || claimsResult?.claims?.aal !== 'aal2') return json({ error: 'mfa_required' }, 403, headers)
  const { data: admin } = await db.from('admin_users').select('user_id,role').eq('user_id', user.id).maybeSingle()
  if (!admin) return json({ error: 'forbidden' }, 403, headers)

  if (req.method === 'GET') {
    const metricsPromise = loadCommercialMetrics(db)
    const { data: requests, error } = await db.from('quote_requests')
      .select('id,client_id,protocol,proposal_number,created_at,updated_at,name,email,phone,company,request_text,desired_deadline,preferred_contact,status')
      .order('created_at', { ascending: false }).limit(200)
    if (error) return json({ error: 'query_failed' }, 500, headers)
    const ids = (requests ?? []).map((item: any) => item.id)
    const [{ data: drafts }, { data: clients }, { data: providers }, { data: pricingRules }, { data: versions }, { data: audits }] = await Promise.all([
      ids.length ? db.from('quote_drafts').select('*').in('request_id', ids) : Promise.resolve({ data: [] }),
      db.from('clients').select('id,name,company,email,phone,document,notes,active,updated_at').eq('active', true).order('company').order('name'),
      db.from('payment_provider_rules').select('provider,display_name,boleto_fee_per_paid,fee_note,active').eq('active', true),
      db.from('pricing_rules').select('service_key,service_name,category,base_amount,minimum_amount,fiscal_code,invoice_description,active').eq('active', true).order('category').order('service_name'),
      ids.length ? db.from('quote_versions').select('id,request_id,version_number,commercial_status,pdf_object_path,document_id,checksum_sha256,created_at,created_by').in('request_id', ids).order('version_number', { ascending: false }) : Promise.resolve({ data: [] }),
      ids.length ? db.from('quote_audit_log').select('id,request_id,event_type,event_data,created_at,actor_user_id').in('request_id', ids).order('created_at', { ascending: false }).limit(1000) : Promise.resolve({ data: [] }),
    ])
    const draftIds = (drafts ?? []).map((item: any) => item.id)
    const [{ data: items }, { data: installments }] = await Promise.all([
      draftIds.length ? db.from('quote_items').select('id,draft_id,service_key,service_name,item_description,unit_label,quantity,unit_amount,total_amount,source,sort_order').in('draft_id', draftIds).order('sort_order') : Promise.resolve({ data: [] }),
      draftIds.length ? db.from('quote_payment_installments').select('id,draft_id,installment_number,amount,due_date,status').in('draft_id', draftIds).order('installment_number') : Promise.resolve({ data: [] }),
    ])
    const group = (rows: any[] | null, key: string) => {
      const map = new Map<string, any[]>()
      for (const row of rows ?? []) map.set(row[key], [...(map.get(row[key]) ?? []), row])
      return map
    }
    const itemsByDraft = group(items, 'draft_id')
    const installmentsByDraft = group(installments, 'draft_id')
    const versionsByRequest = group(versions, 'request_id')
    const auditsByRequest = group(audits, 'request_id')
    const draftByRequest = new Map((drafts ?? []).map((draft: any) => [draft.request_id, { ...draft, items: itemsByDraft.get(draft.id) ?? [], paymentInstallments: installmentsByDraft.get(draft.id) ?? [] }]))
    let metrics
    try { metrics = await metricsPromise } catch { return json({ error: 'metrics_query_failed' }, 500, headers) }
    return json({
      clients: clients ?? [],
      providers: providers ?? [],
      pricingRules: pricingRules ?? [],
      metrics,
      requests: (requests ?? []).map((request: any) => ({
        ...request,
        draft: draftByRequest.get(request.id) ?? null,
        versions: versionsByRequest.get(request.id) ?? [],
        audit: auditsByRequest.get(request.id) ?? [],
      })),
    }, 200, headers)
  }

  if (req.method !== 'PATCH') return json({ error: 'method_not_allowed' }, 405, headers)
  let body: ActionPayload
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400, headers) }

  if (body.action === 'create_quote') {
    const { data: client } = await db.from('clients').select('*').eq('id', body.clientId).eq('active', true).maybeSingle()
    if (!client) return json({ error: 'client_not_found' }, 404, headers)
    const now = new Date().toISOString()
    const requestId = crypto.randomUUID()
    const protocol = `HRX-M-${now.slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`
    const { data: request, error: requestError } = await db.from('quote_requests').insert({
      id: requestId,
      client_id: client.id,
      protocol,
      name: client.name,
      email: client.email ?? '',
      phone: client.phone ?? '',
      company: client.company,
      reason: 'manual_quote',
      interests: [],
      request_text: clean(body.scope, 6000) || 'Orçamento manual criado no HRX Admin.',
      preferred_contact: client.email ? 'email' : 'whatsapp',
      privacy_consent: false,
      marketing_consent: false,
      consent_at: now,
      source: 'admin_manual',
      status: 'needs_scope',
      created_at: now,
      updated_at: now,
    }).select('id,protocol,proposal_number').single()
    if (requestError) return json({ error: 'create_failed' }, 500, headers)
    const { error: draftError } = await db.from('quote_drafts').insert({
      request_id: requestId,
      proposal_title: clean(body.proposalTitle, 240) || null,
      proposal_description: clean(body.scope, 6000) || null,
      responsible_by: user.id,
      base_amount: 0,
      pre_discount_amount: 0,
      final_amount: 0,
      estimated_net: 0,
      status: 'needs_scope',
      commercial_status: 'draft',
      created_at: now,
      updated_at: now,
    })
    if (draftError) {
      await db.from('quote_requests').delete().eq('id', requestId)
      return json({ error: 'create_failed' }, 500, headers)
    }
    await db.from('clients').update({ last_quote_at: now, updated_at: now }).eq('id', client.id)
    await db.from('quote_audit_log').insert({ request_id: requestId, actor_user_id: user.id, event_type: 'quote_created', event_data: { clientId: client.id, proposalNumber: request.proposal_number } })
    return json({ request }, 201, headers)
  }

  if (!('requestId' in body) || !body.requestId) return json({ error: 'request_id_required' }, 422, headers)
  const { data: request } = await db.from('quote_requests').select('*').eq('id', body.requestId).maybeSingle()
  const { data: draft } = await db.from('quote_drafts').select('*').eq('request_id', body.requestId).maybeSingle()
  if (!request || !draft) return json({ error: 'draft_not_found' }, 404, headers)

  if (body.action === 'delete_draft') {
    if (draft.status === 'suspended') return json({ error: 'quote_is_suspended' }, 409, headers)
    if (draft.commercial_status !== 'draft' || Number(draft.current_version) > 0) return json({ error: 'cannot_delete_used_quote' }, 409, headers)
    const { error } = await db.from('quote_requests').delete().eq('id', request.id)
    return error ? json({ error: 'delete_failed' }, 500, headers) : json({ ok: true }, 200, headers)
  }

  if (body.action === 'duplicate_quote') {
    const now = new Date().toISOString()
    const requestId = crypto.randomUUID()
    const protocol = `HRX-M-${now.slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`
    const { data: newRequest, error: requestError } = await db.from('quote_requests').insert({
      id: requestId,
      client_id: request.client_id,
      protocol,
      name: request.name,
      email: request.email,
      phone: request.phone,
      company: request.company,
      reason: 'duplicated_quote',
      interests: request.interests ?? [],
      request_text: request.request_text,
      desired_deadline: null,
      preferred_contact: request.preferred_contact,
      privacy_consent: false,
      marketing_consent: false,
      consent_at: now,
      source: 'admin_duplicate',
      status: 'awaiting_review',
      created_at: now,
      updated_at: now,
    }).select('id,protocol,proposal_number').single()
    if (requestError) return json({ error: 'duplicate_failed' }, 500, headers)
    const copy = {
      request_id: requestId,
      base_amount: draft.base_amount,
      complexity_multiplier: draft.complexity_multiplier,
      urgency_multiplier: draft.urgency_multiplier,
      pre_discount_amount: draft.pre_discount_amount,
      discount_percent: draft.discount_percent,
      discount_status: draft.discount_status,
      discount_amount: draft.discount_amount,
      final_amount: draft.final_amount,
      payment_provider: draft.payment_provider,
      installments: draft.installments,
      boleto_fee_per_installment: draft.boleto_fee_per_installment,
      payment_fee_total: draft.payment_fee_total,
      retentions: draft.retentions,
      retention_total: draft.retention_total,
      retention_pricing_mode: draft.retention_pricing_mode,
      retention_net_target: draft.retention_net_target,
      retention_gross_up_suggestion: draft.retention_gross_up_suggestion,
      estimated_net: draft.estimated_net,
      proposal_title: draft.proposal_title,
      project_service: draft.project_service,
      proposal_description: draft.proposal_description,
      customer_notes: draft.customer_notes,
      notes: draft.notes,
      validity_days: draft.validity_days,
      valid_until: new Date(Date.now() + Number(draft.validity_days ?? 15) * 86400000).toISOString().slice(0, 10),
      tax_percent: draft.tax_percent,
      tax_amount: draft.tax_amount,
      custom_final_amount: null,
      custom_adjustment_reason: null,
      payment_mode: draft.payment_mode,
      installment_interval_days: draft.installment_interval_days,
      first_due_date: new Date().toISOString().slice(0, 10),
      responsible_by: user.id,
      commercial_status: 'draft',
      current_version: 0,
      status: Number(draft.final_amount) > 0 ? 'awaiting_review' : 'needs_scope',
      created_at: now,
      updated_at: now,
    }
    const { data: newDraft, error: draftError } = await db.from('quote_drafts').insert(copy).select('id').single()
    if (draftError) {
      await db.from('quote_requests').delete().eq('id', requestId)
      return json({ error: 'duplicate_failed' }, 500, headers)
    }
    const { data: oldItems } = await db.from('quote_items').select('*').eq('draft_id', draft.id).order('sort_order')
    if (oldItems?.length) await db.from('quote_items').insert(oldItems.map(({ id: _id, draft_id: _draft, ...item }: any) => ({ ...item, draft_id: newDraft.id })))
    const schedule = buildInstallments(newDraft.id, Number(draft.final_amount), Number(draft.installments || 1), copy.first_due_date, Number(draft.installment_interval_days || 30))
    await db.from('quote_payment_installments').insert(schedule)
    await db.from('quote_audit_log').insert([
      { request_id: requestId, actor_user_id: user.id, event_type: 'quote_duplicated', event_data: { sourceRequestId: request.id, proposalNumber: newRequest.proposal_number } },
      { request_id: request.id, actor_user_id: user.id, event_type: 'quote_duplicated_from', event_data: { newRequestId: requestId, proposalNumber: newRequest.proposal_number } },
    ])
    return json({ request: newRequest }, 201, headers)
  }

  if (body.action === 'save_quote') {
    if (draft.status === 'suspended') return json({ error: 'quote_is_suspended' }, 409, headers)
    if (immutableStatuses.includes(draft.commercial_status)) return json({ error: 'quote_is_read_only' }, 409, headers)
    let resolved
    try { resolved = await resolveItems(db, draft.id, body.items ?? []) } catch (error) { return json({ error: error instanceof Error ? error.message : 'invalid_items' }, 422, headers) }
    let update
    try { update = await calculateDraft(db, draft, resolved.baseAmountCents, body) } catch (error) { return json({ error: error instanceof Error ? error.message : 'calculation_failed' }, 422, headers) }
    if (update.fiscal_review_confirmed) {
      update.fiscal_review_confirmed_by = user.id
      update.fiscal_review_confirmed_at = new Date().toISOString()
    }
    if (update.custom_final_amount != null) {
      update.custom_adjustment_by = user.id
      update.custom_adjustment_at = new Date().toISOString()
    } else {
      update.custom_adjustment_by = null
      update.custom_adjustment_at = null
    }
    const schedule = buildInstallments(draft.id, update.final_amount, update.installments, update.first_due_date, update.installment_interval_days)
    const { error: deleteItemsError } = await db.from('quote_items').delete().eq('draft_id', draft.id)
    if (deleteItemsError) return json({ error: 'items_update_failed' }, 500, headers)
    if (resolved.rows.length) {
      const { error: itemsError } = await db.from('quote_items').insert(resolved.rows)
      if (itemsError) return json({ error: 'items_update_failed' }, 500, headers)
    }
    await db.from('quote_payment_installments').delete().eq('draft_id', draft.id)
    if (schedule.length) await db.from('quote_payment_installments').insert(schedule)
    const { data: updated, error: updateError } = await db.from('quote_drafts').update(update).eq('id', draft.id).select('*').single()
    if (updateError) return json({ error: 'update_failed' }, 500, headers)
    await db.from('quote_requests').update({ status: update.status, updated_at: update.updated_at }).eq('id', request.id)
    const events: any[] = [{
      request_id: request.id,
      actor_user_id: user.id,
      event_type: 'draft_saved',
      event_data: { finalAmount: update.final_amount, taxPercent: update.tax_percent, installments: update.installments, commercialStatus: update.commercial_status },
    }]
    if (update.custom_final_amount != null && Number(update.custom_final_amount) !== Number(draft.custom_final_amount)) {
      const originalAmount = update.retention_pricing_mode === 'preserve_net' && update.fiscal_review_confirmed
        ? update.retention_gross_up_suggestion
        : update.retention_net_target
      events.push({
        request_id: request.id,
        actor_user_id: user.id,
        event_type: 'custom_final_amount_confirmed',
        event_data: { originalAmount, finalAmount: update.custom_final_amount, adjustmentAmount: fromCents(toCents(originalAmount) - toCents(update.custom_final_amount)), reason: update.custom_adjustment_reason },
      })
    }
    await db.from('quote_audit_log').insert(events)
    return json({ draft: updated, items: resolved.rows, paymentInstallments: schedule }, 200, headers)
  }

  if (body.action === 'finalize') {
    if (Number(draft.final_amount) <= 0) return json({ error: 'scope_not_ready' }, 409, headers)
    if (draft.fiscal_review_required && !draft.fiscal_review_confirmed) return json({ error: 'fiscal_review_required' }, 409, headers)
    if (!draft.proposal_title || !draft.valid_until) return json({ error: 'proposal_incomplete' }, 409, headers)
    const expectedPrefix = `commercial/proposals/${request.id}/`
    const objectPath = clean(body.pdfObjectPath, 600)
    if (!objectPath.startsWith(expectedPrefix) || !objectPath.endsWith('.pdf')) return json({ error: 'invalid_document_path' }, 422, headers)
    const versionNumber = Number(draft.current_version ?? 0) + 1
    const [{ data: items }, { data: paymentInstallments }, { data: client }] = await Promise.all([
      db.from('quote_items').select('*').eq('draft_id', draft.id).order('sort_order'),
      db.from('quote_payment_installments').select('*').eq('draft_id', draft.id).order('installment_number'),
      db.from('clients').select('id,name,company,email,phone,document').eq('id', request.client_id).maybeSingle(),
    ])
    const snapshot = { proposal: { ...request, ...draft, versionNumber }, client, items: items ?? [], paymentInstallments: paymentInstallments ?? [] }
    const { data: version, error: versionError } = await db.from('quote_versions').insert({
      request_id: request.id,
      draft_id: draft.id,
      version_number: versionNumber,
      commercial_status: 'reviewed',
      snapshot,
      pdf_object_path: objectPath,
      checksum_sha256: clean(body.checksumSha256, 128) || null,
      created_by: user.id,
    }).select('*').single()
    if (versionError) {
      await db.storage.from('hrx-documents').remove([objectPath])
      return json({ error: 'version_failed' }, 500, headers)
    }
    const { data: document, error: documentError } = await db.from('hrx_documents').insert({
      object_path: objectPath,
      area_key: 'commercial',
      folder: 'Propostas Comerciais',
      client_id: request.client_id,
      client_name: client?.company || client?.name || request.company || request.name,
      quote_request_id: request.id,
      quote_version_id: version.id,
      document_type: 'PROPOSTA_COMERCIAL',
      title: `${request.proposal_number} — ${draft.proposal_title}`,
      version: versionNumber,
      status: 'active',
      access_class: 'restricted',
      effective_date: new Date().toISOString().slice(0, 10),
      expires_at: draft.valid_until,
      mime_type: 'application/pdf',
      size_bytes: Math.max(0, Math.round(Number(body.sizeBytes) || 0)),
      checksum_sha256: clean(body.checksumSha256, 128) || null,
      uploaded_by: user.id,
    }).select('*').single()
    if (documentError) {
      await db.from('quote_versions').delete().eq('id', version.id)
      await db.storage.from('hrx-documents').remove([objectPath])
      return json({ error: 'document_metadata_failed' }, 500, headers)
    }
    await db.from('quote_versions').update({ document_id: document.id }).eq('id', version.id)
    await db.from('quote_drafts').update({ current_version: versionNumber, commercial_status: 'reviewed', updated_at: new Date().toISOString() }).eq('id', draft.id)
    await db.from('quote_audit_log').insert({
      request_id: request.id,
      actor_user_id: user.id,
      event_type: 'proposal_version_generated',
      event_data: { version: versionNumber, documentId: document.id, objectPath },
    })
    return json({ version: { ...version, document_id: document.id }, document }, 201, headers)
  }

  if (body.action === 'set_status') {
    const transitions: Record<CommercialStatus, CommercialStatus[]> = {
      draft: ['reviewed', 'cancelled'],
      reviewed: ['sent', 'negotiating', 'approved', 'cancelled', 'lost'],
      sent: ['negotiating', 'approved', 'lost', 'cancelled'],
      negotiating: ['reviewed', 'sent', 'approved', 'lost', 'cancelled'],
      approved: ['invoiced', 'cancelled'],
      invoiced: ['received', 'cancelled'],
      received: [],
      lost: [],
      cancelled: [],
    }
    const current = draft.commercial_status as CommercialStatus
    if (!transitions[current]?.includes(body.status)) return json({ error: 'invalid_status_transition' }, 409, headers)
    if (['reviewed', 'sent', 'approved'].includes(body.status) && Number(draft.current_version) <= 0) return json({ error: 'version_required' }, 409, headers)
    const now = new Date().toISOString()
    const update: Record<string, unknown> = { commercial_status: body.status, updated_at: now }
    if (body.status === 'approved') Object.assign(update, { status: 'approved', approved_by: user.id, approved_at: now, approved_version: draft.current_version, approval_channel: clean(body.channel, 80) || 'manual', approval_note: clean(body.note, 1000) || null })
    const { error } = await db.from('quote_drafts').update(update).eq('id', draft.id)
    if (error) return json({ error: 'status_update_failed' }, 500, headers)
    await db.from('quote_versions')
      .update({ commercial_status: body.status })
      .eq('request_id', request.id)
      .eq('version_number', draft.current_version)
    if (body.status === 'approved') await db.from('quote_requests').update({ status: 'approved', updated_at: now }).eq('id', request.id)
    await db.from('quote_audit_log').insert({ request_id: request.id, actor_user_id: user.id, event_type: `commercial_status_${body.status}`, event_data: { from: current, to: body.status, version: draft.current_version, channel: clean(body.channel, 80) || null, note: clean(body.note, 1000) || null } })
    return json({ ok: true, status: body.status }, 200, headers)
  }

  if (body.action === 'approve') {
    if (draft.status === 'suspended') return json({ error: 'quote_is_suspended' }, 409, headers)
    if (draft.status === 'needs_scope' || Number(draft.final_amount) <= 0) return json({ error: 'scope_not_ready' }, 409, headers)
    if (draft.discount_status === 'purple') return json({ error: 'discount_blocked' }, 409, headers)
    if (draft.fiscal_review_required && !draft.fiscal_review_confirmed) return json({ error: 'fiscal_review_required' }, 409, headers)
    const approvedAt = new Date().toISOString()
    const { error } = await db.from('quote_drafts').update({ status: 'approved', approved_by: user.id, approved_at: approvedAt, updated_at: approvedAt }).eq('id', draft.id)
    if (error) return json({ error: 'approval_failed' }, 500, headers)
    await db.from('quote_requests').update({ status: 'approved', updated_at: approvedAt }).eq('id', request.id)
    await db.from('quote_audit_log').insert({
      request_id: request.id,
      actor_user_id: user.id,
      event_type: 'legacy_draft_approved',
      event_data: { finalAmount: draft.final_amount, requiresOfficialVersion: true },
    })
    return json({ ok: true, status: 'approved' }, 200, headers)
  }

  if (body.action === 'log_event') {
    if (!deliveryEvents.has(body.eventType)) return json({ error: 'invalid_event' }, 422, headers)
    await db.from('quote_audit_log').insert({ request_id: request.id, actor_user_id: user.id, event_type: body.eventType, event_data: body.eventData ?? {} })
    return json({ ok: true }, 200, headers)
  }

  return json({ error: 'invalid_action' }, 422, headers)
})
