import { createClient } from 'npm:@supabase/supabase-js@2'

type DiscountLevel = 0 | 5 | 10 | 15 | 20
type RetentionPricingMode = 'informational' | 'preserve_net'
type Retentions = { iss?: number; irrf?: number; pis?: number; cofins?: number; csll?: number; inss?: number }
type DraftCalculationInput = {
  discountPercent?: DiscountLevel
  complexityMultiplier?: number
  urgencyMultiplier?: number
  paymentProvider?: 'none' | 'nubank' | 'mercadopago'
  installments?: number
  retentions?: Retentions
  retentionPricingMode?: RetentionPricingMode
  fiscalReviewConfirmed?: boolean
  notes?: string
}
type UpdateDraftPayload = DraftCalculationInput & { action: 'update_draft'; requestId: string; discountPercent: DiscountLevel }
type SetItemsPayload = { action: 'set_items'; requestId: string; items: { serviceKey: string; quantity?: number }[] }
type SaveQuotePayload = DraftCalculationInput & {
  action: 'save_quote'
  requestId: string
  discountPercent: DiscountLevel
  items: { serviceKey: string; quantity?: number }[]
}
type ApprovePayload = { action: 'approve'; requestId: string }
type ActionPayload = UpdateDraftPayload | SetItemsPayload | SaveQuotePayload | ApprovePayload

const defaultOrigins = ['http://localhost:5173','https://flanhenrique.github.io','https://hrxsolutions.com.br','https://www.hrxsolutions.com.br']
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
    'Vary': 'Origin',
  }
}
const json = (body: unknown, status: number, headers: Record<string, string>) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } })
const discountTone = (percent: DiscountLevel) => percent <= 5 ? 'green' : percent === 10 ? 'yellow' : percent === 15 ? 'red' : 'purple'
const clampMultiplier = (value: number | undefined) => Math.min(3, Math.max(0.5, Number(value ?? 1)))
const roundMoney = (value: number) => Math.round(value * 100) / 100
const allowedDiscounts: DiscountLevel[] = [0,5,10,15,20]

function normalizeRetentions(value?: Retentions): Required<Retentions> {
  return {
    iss: Math.max(0, Number(value?.iss ?? 0)),
    irrf: Math.max(0, Number(value?.irrf ?? 0)),
    pis: Math.max(0, Number(value?.pis ?? 0)),
    cofins: Math.max(0, Number(value?.cofins ?? 0)),
    csll: Math.max(0, Number(value?.csll ?? 0)),
    inss: Math.max(0, Number(value?.inss ?? 0)),
  }
}

async function calculateDraft(
  db: any,
  draft: any,
  baseAmount: number,
  input?: DraftCalculationInput,
  resetFiscalReview = false,
) {
  const discountPercent = (input?.discountPercent ?? Number(draft.discount_percent ?? 0)) as DiscountLevel
  if (!allowedDiscounts.includes(discountPercent)) throw new Error('invalid_discount')

  const complexity = clampMultiplier(input?.complexityMultiplier ?? Number(draft.complexity_multiplier ?? 1))
  const urgency = clampMultiplier(input?.urgencyMultiplier ?? Number(draft.urgency_multiplier ?? 1))
  const preDiscountAmount = roundMoney(baseAmount * complexity * urgency)
  const discountAmount = roundMoney(preDiscountAmount * (discountPercent / 100))
  const provider = input?.paymentProvider ?? draft.payment_provider ?? 'none'
  const installments = Math.min(24, Math.max(1, Math.round(Number(input?.installments ?? draft.installments ?? 1))))

  let feePerInstallment = 0
  if (provider !== 'none') {
    const { data: providerRule } = await db.from('payment_provider_rules').select('boleto_fee_per_paid').eq('provider', provider).eq('active', true).maybeSingle()
    feePerInstallment = Math.max(0, Number(providerRule?.boleto_fee_per_paid ?? 0))
  }
  const paymentFeeTotal = roundMoney(feePerInstallment * installments)
  const retentionNetTarget = roundMoney(preDiscountAmount - discountAmount + paymentFeeTotal)
  const retentions = normalizeRetentions(input?.retentions ?? draft.retentions)
  const retentionTotal = Object.values(retentions).reduce((sum, value) => sum + Number(value), 0)
  if (retentionTotal >= 100) throw new Error('invalid_retention_total')

  const fiscalReviewRequired = retentionTotal > 0
  const requestedFiscalConfirmation = input?.fiscalReviewConfirmed ?? draft.fiscal_review_confirmed === true
  const fiscalReviewConfirmed = fiscalReviewRequired ? (resetFiscalReview ? false : requestedFiscalConfirmation === true) : false
  const mode: RetentionPricingMode = fiscalReviewRequired
    ? ((input?.retentionPricingMode ?? draft.retention_pricing_mode ?? 'informational') as RetentionPricingMode)
    : 'informational'
  const grossUpSuggestion = retentionTotal > 0 ? roundMoney(retentionNetTarget / (1 - retentionTotal / 100)) : retentionNetTarget
  const finalAmount = mode === 'preserve_net' && fiscalReviewConfirmed ? grossUpSuggestion : retentionNetTarget
  const estimatedNet = roundMoney(finalAmount * (1 - retentionTotal / 100))
  const now = new Date().toISOString()

  return {
    base_amount: roundMoney(baseAmount),
    complexity_multiplier: complexity,
    urgency_multiplier: urgency,
    pre_discount_amount: preDiscountAmount,
    discount_percent: discountPercent,
    discount_status: discountTone(discountPercent),
    discount_amount: discountAmount,
    final_amount: finalAmount,
    payment_provider: provider,
    installments,
    boleto_fee_per_installment: feePerInstallment,
    payment_fee_total: paymentFeeTotal,
    retentions,
    retention_total: retentionTotal,
    retention_pricing_mode: mode,
    retention_net_target: retentionNetTarget,
    retention_gross_up_suggestion: grossUpSuggestion,
    estimated_net: estimatedNet,
    fiscal_review_required: fiscalReviewRequired,
    fiscal_review_confirmed: fiscalReviewConfirmed,
    fiscal_review_confirmed_by: null,
    fiscal_review_confirmed_at: null,
    notes: input?.notes ?? draft.notes,
    status: baseAmount > 0 ? 'awaiting_review' : 'needs_scope',
    approved_by: null,
    approved_at: null,
    updated_at: now,
  }
}

async function resolveCatalogRows(db: any, draftId: string, items: { serviceKey: string; quantity?: number }[]) {
  if (!Array.isArray(items) || items.length > 50) throw new Error('invalid_items')

  const requested = new Map<string, number>()
  for (const item of items) {
    const key = String(item.serviceKey ?? '').trim()
    if (!key) continue
    const quantity = Math.min(99, Math.max(1, Math.round(Number(item.quantity ?? 1))))
    requested.set(key, Math.min(99, (requested.get(key) ?? 0) + quantity))
  }

  const serviceKeys = [...requested.keys()]
  let pricing: any[] = []
  if (serviceKeys.length) {
    const result = await db.from('pricing_rules')
      .select('service_key,service_name,base_amount,active')
      .in('service_key', serviceKeys)
      .eq('active', true)
    pricing = result.data ?? []
    if (pricing.length !== serviceKeys.length) throw new Error('invalid_service')
  }

  const pricingByKey = new Map(pricing.map((item) => [item.service_key, item]))
  const rows = serviceKeys.map((key, index) => {
    const rule = pricingByKey.get(key)
    const quantity = requested.get(key) ?? 1
    const unitAmount = Number(rule.base_amount)
    return {
      draft_id: draftId,
      service_key: key,
      service_name: rule.service_name,
      quantity,
      unit_amount: unitAmount,
      total_amount: roundMoney(unitAmount * quantity),
      source: 'manual',
      sort_order: index,
    }
  })

  return { rows, baseAmount: roundMoney(rows.reduce((sum, item) => sum + item.total_amount, 0)) }
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

  const { data: admin } = await db.from('admin_users').select('user_id,role').eq('user_id', user.id).maybeSingle()
  if (!admin) return json({ error: 'forbidden' }, 403, headers)

  if (req.method === 'GET') {
    const { data: requests, error } = await db.from('quote_requests')
      .select('id,protocol,created_at,name,email,phone,company,reason,interests,request_text,desired_deadline,preferred_contact,status')
      .order('created_at', { ascending: false }).limit(100)
    if (error) return json({ error: 'query_failed' }, 500, headers)

    const ids = (requests ?? []).map((item) => item.id)
    const [{ data: interpretations }, { data: drafts }, { data: providers }, { data: pricingRules }] = await Promise.all([
      ids.length ? db.from('quote_interpretations').select('request_id,summary,suggested_service_keys,confidence,missing_information').in('request_id', ids) : Promise.resolve({ data: [] }),
      ids.length ? db.from('quote_drafts').select('id,request_id,base_amount,complexity_multiplier,urgency_multiplier,pre_discount_amount,discount_percent,discount_status,discount_amount,final_amount,payment_provider,installments,boleto_fee_per_installment,payment_fee_total,retentions,retention_total,retention_pricing_mode,retention_net_target,retention_gross_up_suggestion,estimated_net,fiscal_review_required,fiscal_review_confirmed,notes,status,approved_at,updated_at').in('request_id', ids) : Promise.resolve({ data: [] }),
      db.from('payment_provider_rules').select('provider,display_name,boleto_fee_per_paid,fee_note,last_verified_at,active').eq('active', true),
      db.from('pricing_rules').select('service_key,service_name,category,base_amount,minimum_amount,fiscal_code,invoice_description,active').eq('active', true).order('category').order('service_name'),
    ])

    const draftIds = (drafts ?? []).map((item) => item.id)
    const { data: items } = draftIds.length
      ? await db.from('quote_items').select('id,draft_id,service_key,service_name,quantity,unit_amount,total_amount,source,sort_order').in('draft_id', draftIds).order('sort_order')
      : { data: [] }

    const interpretationByRequest = new Map((interpretations ?? []).map((item) => [item.request_id, item]))
    const itemsByDraft = new Map<string, any[]>()
    for (const item of items ?? []) {
      const current = itemsByDraft.get(item.draft_id) ?? []
      current.push(item)
      itemsByDraft.set(item.draft_id, current)
    }
    const draftByRequest = new Map((drafts ?? []).map((item) => [item.request_id, { ...item, items: itemsByDraft.get(item.id) ?? [] }]))

    return json({
      providers: providers ?? [],
      pricingRules: pricingRules ?? [],
      requests: (requests ?? []).map((item) => ({
        ...item,
        interpretation: interpretationByRequest.get(item.id) ?? null,
        draft: draftByRequest.get(item.id) ?? null,
      })),
    }, 200, headers)
  }

  if (req.method !== 'PATCH') return json({ error: 'method_not_allowed' }, 405, headers)
  let body: ActionPayload
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400, headers) }
  if (!body.requestId) return json({ error: 'request_id_required' }, 422, headers)

  const { data: draft, error: draftError } = await db.from('quote_drafts').select('*').eq('request_id', body.requestId).maybeSingle()
  if (draftError || !draft) return json({ error: 'draft_not_found' }, 404, headers)

  if (body.action === 'approve') {
    if (draft.status === 'needs_scope' || Number(draft.final_amount) <= 0) return json({ error: 'scope_not_ready' }, 409, headers)
    if (draft.discount_status === 'purple') return json({ error: 'discount_blocked' }, 409, headers)
    if (draft.fiscal_review_required && !draft.fiscal_review_confirmed) return json({ error: 'fiscal_review_required' }, 409, headers)
    const approvedAt = new Date().toISOString()
    const { error: approveError } = await db.from('quote_drafts').update({ status: 'approved', approved_by: user.id, approved_at: approvedAt, updated_at: approvedAt }).eq('id', draft.id)
    if (approveError) return json({ error: 'approval_failed' }, 500, headers)
    await db.from('quote_requests').update({ status: 'approved', updated_at: approvedAt }).eq('id', body.requestId)
    await db.from('quote_audit_log').insert({ request_id: body.requestId, actor_user_id: user.id, event_type: 'draft_approved', event_data: { finalAmount: draft.final_amount } })
    return json({ ok: true, status: 'approved' }, 200, headers)
  }

  if (body.action === 'set_items' || body.action === 'save_quote') {
    let rows: any[]
    let baseAmount: number
    try {
      const resolved = await resolveCatalogRows(db, draft.id, body.items)
      rows = resolved.rows
      baseAmount = resolved.baseAmount
    } catch (error) {
      const code = error instanceof Error ? error.message : 'invalid_items'
      return json({ error: code }, 422, headers)
    }

    let financials
    try {
      financials = await calculateDraft(db, draft, baseAmount, body.action === 'save_quote' ? body : undefined, body.action === 'set_items')
    } catch (error) {
      const code = error instanceof Error ? error.message : 'calculation_failed'
      return json({ error: code }, 422, headers)
    }

    if (financials.fiscal_review_confirmed) {
      financials.fiscal_review_confirmed_by = user.id
      financials.fiscal_review_confirmed_at = new Date().toISOString()
    }

    const { error: deleteError } = await db.from('quote_items').delete().eq('draft_id', draft.id)
    if (deleteError) return json({ error: 'items_update_failed' }, 500, headers)
    if (rows.length) {
      const { error: insertError } = await db.from('quote_items').insert(rows)
      if (insertError) return json({ error: 'items_update_failed' }, 500, headers)
    }

    const { data: updated, error: updateError } = await db.from('quote_drafts').update(financials).eq('id', draft.id).select('*').single()
    if (updateError) return json({ error: 'update_failed' }, 500, headers)
    await db.from('quote_requests').update({ status: baseAmount > 0 ? 'awaiting_review' : 'needs_scope', updated_at: new Date().toISOString() }).eq('id', body.requestId)
    await db.from('quote_audit_log').insert({
      request_id: body.requestId,
      actor_user_id: user.id,
      event_type: body.action === 'save_quote' ? 'draft_catalog_calculation_saved' : 'draft_items_updated',
      event_data: {
        services: rows.map((item) => ({ key: item.service_key, quantity: item.quantity })),
        baseAmount,
        finalAmount: financials.final_amount,
        retentionTotal: financials.retention_total,
      },
    })
    return json({ draft: updated, items: rows }, 200, headers)
  }

  if (!allowedDiscounts.includes(body.discountPercent)) return json({ error: 'invalid_discount' }, 422, headers)

  let update
  try {
    update = await calculateDraft(db, draft, Number(draft.base_amount), body, false)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'calculation_failed'
    return json({ error: code }, 422, headers)
  }

  if (update.fiscal_review_confirmed) {
    update.fiscal_review_confirmed_by = user.id
    update.fiscal_review_confirmed_at = new Date().toISOString()
  }

  const { data: updated, error: updateError } = await db.from('quote_drafts').update(update).eq('id', draft.id).select('*').single()
  if (updateError) return json({ error: 'update_failed' }, 500, headers)
  await db.from('quote_requests').update({ status: Number(draft.base_amount) > 0 ? 'awaiting_review' : 'needs_scope', updated_at: new Date().toISOString() }).eq('id', body.requestId)
  await db.from('quote_audit_log').insert({ request_id: body.requestId, actor_user_id: user.id, event_type: 'draft_updated', event_data: { discount: body.discountPercent, provider: update.payment_provider, installments: update.installments, retentionTotal: update.retention_total, retentionPricingMode: update.retention_pricing_mode } })
  return json({ draft: updated }, 200, headers)
})
