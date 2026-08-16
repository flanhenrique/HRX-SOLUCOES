import { createClient } from 'npm:@supabase/supabase-js@2'

type DiscountLevel = 0 | 5 | 10 | 15 | 20
type RetentionPricingMode = 'informational' | 'preserve_net'

type Retentions = {
  iss?: number
  irrf?: number
  pis?: number
  cofins?: number
  csll?: number
  inss?: number
}

type UpdateDraftPayload = {
  action: 'update_draft'
  requestId: string
  discountPercent: DiscountLevel
  complexityMultiplier?: number
  urgencyMultiplier?: number
  paymentProvider?: 'none' | 'nubank' | 'mercadopago'
  installments?: number
  retentions?: Retentions
  retentionPricingMode?: RetentionPricingMode
  fiscalReviewConfirmed?: boolean
  notes?: string
}

type ApprovePayload = {
  action: 'approve'
  requestId: string
}

type ActionPayload = UpdateDraftPayload | ApprovePayload

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } })

function cors(origin: string | null) {
  const configured = (Deno.env.get('HRX_ALLOWED_ORIGINS') ?? 'http://localhost:5173,https://flanhenrique.github.io')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const allowedOrigin = origin && configured.includes(origin) ? origin : configured[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
    'Vary': 'Origin',
  }
}

const discountTone = (percent: DiscountLevel) => {
  if (percent <= 5) return 'green'
  if (percent === 10) return 'yellow'
  if (percent === 15) return 'red'
  return 'purple'
}

const clampMultiplier = (value: number | undefined) => {
  const safe = Number(value ?? 1)
  return Math.min(3, Math.max(0.5, safe))
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const headers = cors(origin)
  if (req.method === 'OPTIONS') return new Response('ok', { headers })

  const allowedOrigins = (Deno.env.get('HRX_ALLOWED_ORIGINS') ?? 'http://localhost:5173,https://flanhenrique.github.io')
    .split(',')
    .map((item) => item.trim())
  if (origin && !allowedOrigins.includes(origin)) return json({ error: 'origin_not_allowed' }, 403, headers)

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
    const { data: requests, error } = await db
      .from('quote_requests')
      .select('id,protocol,created_at,name,email,phone,company,reason,interests,request_text,desired_deadline,preferred_contact,status')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) return json({ error: 'query_failed' }, 500, headers)

    const ids = (requests ?? []).map((item) => item.id)
    const [{ data: interpretations }, { data: drafts }, { data: providers }] = await Promise.all([
      ids.length
        ? db.from('quote_interpretations').select('request_id,summary,suggested_service_keys,confidence,missing_information').in('request_id', ids)
        : Promise.resolve({ data: [] }),
      ids.length
        ? db.from('quote_drafts').select('id,request_id,base_amount,complexity_multiplier,urgency_multiplier,pre_discount_amount,discount_percent,discount_status,discount_amount,final_amount,payment_provider,installments,boleto_fee_per_installment,payment_fee_total,retentions,retention_total,retention_pricing_mode,retention_net_target,retention_gross_up_suggestion,estimated_net,fiscal_review_required,fiscal_review_confirmed,notes,status,approved_at').in('request_id', ids)
        : Promise.resolve({ data: [] }),
      db.from('payment_provider_rules').select('provider,display_name,boleto_fee_per_paid,fee_note,last_verified_at,active').eq('active', true),
    ])

    const interpretationByRequest = new Map((interpretations ?? []).map((item) => [item.request_id, item]))
    const draftByRequest = new Map((drafts ?? []).map((item) => [item.request_id, item]))

    return json({
      providers: providers ?? [],
      requests: (requests ?? []).map((item) => ({
        ...item,
        interpretation: interpretationByRequest.get(item.id) ?? null,
        draft: draftByRequest.get(item.id) ?? null,
      })),
    }, 200, headers)
  }

  if (req.method !== 'PATCH') return json({ error: 'method_not_allowed' }, 405, headers)

  let body: ActionPayload
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400, headers)
  }

  if (!body.requestId) return json({ error: 'request_id_required' }, 422, headers)

  const { data: draft, error: draftError } = await db.from('quote_drafts').select('*').eq('request_id', body.requestId).maybeSingle()
  if (draftError || !draft) return json({ error: 'draft_not_found' }, 404, headers)

  if (body.action === 'approve') {
    if (draft.status === 'needs_scope' || Number(draft.final_amount) <= 0) return json({ error: 'scope_not_ready' }, 409, headers)
    if (draft.discount_status === 'purple') return json({ error: 'discount_blocked' }, 409, headers)
    if (draft.fiscal_review_required && !draft.fiscal_review_confirmed) return json({ error: 'fiscal_review_required' }, 409, headers)

    const approvedAt = new Date().toISOString()
    const { error: approveError } = await db.from('quote_drafts').update({
      status: 'approved',
      approved_by: user.id,
      approved_at: approvedAt,
      updated_at: approvedAt,
    }).eq('id', draft.id)

    if (approveError) return json({ error: 'approval_failed' }, 500, headers)

    await db.from('quote_requests').update({ status: 'approved', updated_at: approvedAt }).eq('id', body.requestId)
    await db.from('quote_audit_log').insert({ request_id: body.requestId, actor_user_id: user.id, event_type: 'draft_approved', event_data: { finalAmount: draft.final_amount } })
    return json({ ok: true, status: 'approved' }, 200, headers)
  }

  const allowedDiscounts: DiscountLevel[] = [0, 5, 10, 15, 20]
  if (!allowedDiscounts.includes(body.discountPercent)) return json({ error: 'invalid_discount' }, 422, headers)

  const complexity = clampMultiplier(body.complexityMultiplier)
  const urgency = clampMultiplier(body.urgencyMultiplier)
  const preDiscountAmount = roundMoney(Number(draft.base_amount) * complexity * urgency)
  const discountAmount = roundMoney(preDiscountAmount * (body.discountPercent / 100))
  const provider = body.paymentProvider ?? 'none'
  const installments = Math.min(24, Math.max(1, Math.round(Number(body.installments ?? 1))))

  let feePerInstallment = 0
  if (provider !== 'none') {
    const { data: providerRule } = await db.from('payment_provider_rules')
      .select('boleto_fee_per_paid')
      .eq('provider', provider)
      .eq('active', true)
      .maybeSingle()
    feePerInstallment = Math.max(0, Number(providerRule?.boleto_fee_per_paid ?? 0))
  }

  const paymentFeeTotal = roundMoney(feePerInstallment * installments)
  const retentionNetTarget = roundMoney(preDiscountAmount - discountAmount + paymentFeeTotal)

  const retentions: Required<Retentions> = {
    iss: Math.max(0, Number(body.retentions?.iss ?? 0)),
    irrf: Math.max(0, Number(body.retentions?.irrf ?? 0)),
    pis: Math.max(0, Number(body.retentions?.pis ?? 0)),
    cofins: Math.max(0, Number(body.retentions?.cofins ?? 0)),
    csll: Math.max(0, Number(body.retentions?.csll ?? 0)),
    inss: Math.max(0, Number(body.retentions?.inss ?? 0)),
  }
  const retentionTotal = Object.values(retentions).reduce((sum, value) => sum + value, 0)
  if (retentionTotal >= 100) return json({ error: 'invalid_retention_total' }, 422, headers)

  const fiscalReviewRequired = retentionTotal > 0
  const fiscalReviewConfirmed = fiscalReviewRequired ? body.fiscalReviewConfirmed === true : false
  const mode: RetentionPricingMode = fiscalReviewRequired ? (body.retentionPricingMode ?? 'informational') : 'informational'
  const grossUpSuggestion = retentionTotal > 0
    ? roundMoney(retentionNetTarget / (1 - retentionTotal / 100))
    : retentionNetTarget
  const finalAmount = mode === 'preserve_net' && fiscalReviewConfirmed ? grossUpSuggestion : retentionNetTarget
  const estimatedNet = roundMoney(finalAmount * (1 - retentionTotal / 100))
  const now = new Date().toISOString()

  const update = {
    complexity_multiplier: complexity,
    urgency_multiplier: urgency,
    pre_discount_amount: preDiscountAmount,
    discount_percent: body.discountPercent,
    discount_status: discountTone(body.discountPercent),
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
    fiscal_review_confirmed_by: fiscalReviewConfirmed ? user.id : null,
    fiscal_review_confirmed_at: fiscalReviewConfirmed ? now : null,
    notes: body.notes ?? draft.notes,
    status: Number(draft.base_amount) > 0 ? 'awaiting_review' : 'needs_scope',
    updated_at: now,
  }

  const { data: updated, error: updateError } = await db.from('quote_drafts').update(update).eq('id', draft.id).select('*').single()
  if (updateError) return json({ error: 'update_failed' }, 500, headers)

  await db.from('quote_audit_log').insert({
    request_id: body.requestId,
    actor_user_id: user.id,
    event_type: 'draft_updated',
    event_data: { discount: body.discountPercent, provider, installments, retentionTotal, retentionPricingMode: mode },
  })

  return json({ draft: updated }, 200, headers)
})
