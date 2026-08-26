import { createClient } from 'npm:@supabase/supabase-js@2'

type ReceiptInput = {
  objectPath: string
  mimeType?: string
  sizeBytes?: number
  checksumSha256?: string
  fileName?: string
}

type ActionPayload =
  | { action: 'create_receivables'; requestId: string; invoiceNumber: string; invoiceIssuedAt: string }
  | { action: 'create_payable'; counterpartyName: string; description: string; category: string; amount: number; dueDate: string; competenceDate?: string; referenceNumber?: string; notes?: string }
  | { action: 'cancel_entry'; entryId: string }
  | { action: 'add_account'; name: string }
  | { action: 'record_settlement'; entryId: string; amount: number; accountId: string; settledAt?: string; paymentMethod?: string; note?: string; receipt?: ReceiptInput | null }
  | { action: 'reverse_settlement'; settlementId: string; reason: string }
  | { action: 'update_entry'; entryId: string; expectedUpdatedAt: string; counterpartyName?: string; description: string; category?: string; amount: number; competenceDate: string; dueDate: string; referenceNumber?: string; notes?: string }
  | { action: 'close_period'; competence: string }
  | { action: 'reopen_period'; competence: string; reason: string }

const defaultOrigins = ['http://localhost:5173', 'https://flanhenrique.github.io', 'https://hrxsolutions.com.br', 'https://www.hrxsolutions.com.br']
const clean = (value: unknown, max = 1000) => String(value ?? '').trim().slice(0, max)
const cents = (value: unknown) => Math.round((Number(value) || 0) * 100)
const money = (valueInCents: number) => Math.round(valueInCents) / 100
const isoDate = (value: unknown) => {
  const date = clean(value, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ''
}
const safePercent = (value: unknown) => Math.min(99.9999, Math.max(0, Number(value) || 0))
const METRIC_PAGE_SIZE = 1000

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

function allocateCents(totalCents: number, installments: Array<{ amount: number }>) {
  const target = Math.max(0, Math.round(totalCents))
  const amounts = installments.map((item) => Math.max(0, cents(item.amount)))
  const total = amounts.reduce((sum, value) => sum + value, 0)
  if (!target || !total) return amounts.map(() => 0)
  let allocated = 0
  return amounts.map((value, index) => {
    if (index === amounts.length - 1) return target - allocated
    const part = Math.floor(target * value / total)
    allocated += part
    return part
  })
}

function approvedSnapshotAmountCents(version: any, fallback: unknown) {
  const proposal = version?.snapshot?.proposal ?? {}
  const custom = cents(proposal.custom_final_amount)
  if (custom > 0) return custom
  const final = cents(proposal.final_amount)
  if (final > 0) return final
  return cents(fallback)
}

function approvedTaxPercent(version: any, fallback: unknown) {
  const proposal = version?.snapshot?.proposal ?? {}
  return safePercent(proposal.tax_percent ?? fallback)
}

function effectiveStatus(entry: any, currentDate: string) {
  if (['open', 'partial'].includes(String(entry.status)) && String(entry.due_date || '') < currentDate) return 'overdue'
  return entry.status
}

function nextMonthStart(currentDate: string) {
  const date = new Date(`${currentDate.slice(0, 7)}-01T12:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + 1)
  return date.toISOString().slice(0, 10)
}

async function loadFinanceMetrics(db: any, currentDate: string, monthStart: string, monthEnd: string) {
  let offset = 0
  let outstandingCents = 0
  let payableCents = 0
  let overdueReceivableCents = 0
  let overduePayableCents = 0
  let reserveCents = 0
  const entryTypeById = new Map<string, 'receivable' | 'payable'>()

  while (true) {
    const { data, error } = await db.from('financial_entries')
      .select('id,entry_type,status,gross_amount,paid_amount,tax_reserve_amount,due_date,competence_date')
      .gte('competence_date', monthStart)
      .lt('competence_date', monthEnd)
      .order('id', { ascending: true })
      .range(offset, offset + METRIC_PAGE_SIZE - 1)
    if (error) throw error
    const rows = data ?? []

    for (const entry of rows) {
      entryTypeById.set(entry.id, entry.entry_type)
      if (entry.status === 'cancelled') continue
      const balance = Math.max(0, cents(entry.gross_amount) - cents(entry.paid_amount))
      if (entry.status === 'paid' || balance <= 0) continue
      const overdue = String(entry.due_date || '') < currentDate
      if (entry.entry_type === 'receivable') {
        outstandingCents += balance
        reserveCents += cents(entry.tax_reserve_amount)
        if (overdue) overdueReceivableCents += balance
      } else if (entry.entry_type === 'payable') {
        payableCents += balance
        if (overdue) overduePayableCents += balance
      }
    }

    if (rows.length < METRIC_PAGE_SIZE) break
    offset += METRIC_PAGE_SIZE
  }

  offset = 0
  let receivedMonthCents = 0
  while (true) {
    const { data, error } = await db.from('financial_settlements')
      .select('entry_id,amount,settled_at,reversed_at')
      .is('reversed_at', null)
      .gte('settled_at', `${monthStart}T00:00:00.000Z`)
      .lt('settled_at', `${monthEnd}T00:00:00.000Z`)
      .order('id', { ascending: true })
      .range(offset, offset + METRIC_PAGE_SIZE - 1)
    if (error) throw error
    const rows = data ?? []
    for (const settlement of rows) {
      if (entryTypeById.get(settlement.entry_id) === 'receivable') receivedMonthCents += cents(settlement.amount)
    }
    if (rows.length < METRIC_PAGE_SIZE) break
    offset += METRIC_PAGE_SIZE
  }

  return {
    outstanding: money(outstandingCents),
    payable: money(payableCents),
    projected: money(outstandingCents - payableCents),
    overdueReceivable: money(overdueReceivableCents),
    overduePayable: money(overduePayableCents),
    reserve: money(reserveCents),
    receivedMonth: money(receivedMonthCents),
  }
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
    const currentDate = new Date().toISOString().slice(0, 10)
    const url = new URL(req.url)
    const competence = /^\d{4}-\d{2}$/.test(url.searchParams.get('competence') || '') ? url.searchParams.get('competence')! : currentDate.slice(0, 7)
    const monthStart = `${competence}-01`
    const monthEnd = nextMonthStart(monthStart)
    const metricsPromise = loadFinanceMetrics(db, currentDate, monthStart, monthEnd)

    const [{ data: rawEntries, error: entriesError }, { data: previousEntries }, { data: period }, { data: accounts }, { data: drafts }, { data: settlements }, { data: audits }] = await Promise.all([
      db.from('financial_entries').select('*').gte('competence_date', monthStart).lt('competence_date', monthEnd).order('due_date', { ascending: true }).limit(800),
      db.from('financial_entries').select('*').lt('competence_date', monthStart).in('status', ['open', 'partial', 'overdue']).order('due_date', { ascending: true }).limit(200),
      db.from('financial_periods').select('*').eq('competence_month', monthStart).maybeSingle(),
      db.from('financial_accounts').select('id,name,active,sort_order,created_at').order('sort_order').order('name'),
      db.from('quote_drafts').select('id,request_id,commercial_status,final_amount,tax_percent,tax_amount,approved_version,current_version,payment_mode,installments,first_due_date,valid_until,updated_at').in('commercial_status', ['approved', 'invoiced', 'received']).order('updated_at', { ascending: false }).limit(300),
      db.from('financial_settlements').select('*').order('settled_at', { ascending: false }).order('created_at', { ascending: false }).limit(1600),
      db.from('financial_audit_log').select('*').order('created_at', { ascending: false }).limit(1600),
    ])
    if (entriesError) return json({ error: 'query_failed' }, 500, headers)
    const entries = (rawEntries ?? []).map((entry: any) => ({ ...entry, status: effectiveStatus(entry, currentDate) }))

    const requestIds: string[] = [...new Set((drafts ?? []).map((item: any) => item.request_id).filter(Boolean))]
    const entryRequestIds = entries.map((item: any) => item.quote_request_id).filter(Boolean)
    for (const id of entryRequestIds) if (!requestIds.includes(id)) requestIds.push(id)

    const [{ data: requests }, { data: installments }, { data: versions }] = await Promise.all([
      requestIds.length ? db.from('quote_requests').select('id,client_id,proposal_number,name,company,email,phone,status').in('id', requestIds) : Promise.resolve({ data: [] }),
      (drafts ?? []).length ? db.from('quote_payment_installments').select('id,draft_id,installment_number,amount,due_date,status').in('draft_id', (drafts ?? []).map((item: any) => item.id)).order('installment_number') : Promise.resolve({ data: [] }),
      requestIds.length ? db.from('quote_versions').select('id,request_id,version_number,commercial_status,document_id,pdf_object_path,created_at,snapshot').in('request_id', requestIds).order('version_number', { ascending: false }) : Promise.resolve({ data: [] }),
    ])

    const versionRows = versions ?? []
    const installmentRows = installments ?? []
    const financeDrafts = (drafts ?? []).map((draft: any) => {
      const versionNumber = Number(draft.approved_version || draft.current_version || 0)
      const version = versionRows.find((item: any) => item.request_id === draft.request_id && Number(item.version_number) === versionNumber)
      const schedule = installmentRows.filter((item: any) => item.draft_id === draft.id && item.status === 'planned')
      const scheduleTotal = schedule.reduce((sum: number, item: any) => sum + cents(item.amount), 0)
      const snapshotAmount = approvedSnapshotAmountCents(version, draft.final_amount)
      const approvedAmount = scheduleTotal > 0 ? scheduleTotal : snapshotAmount
      const taxPercent = approvedTaxPercent(version, draft.tax_percent)
      const taxReserve = Math.round(approvedAmount * taxPercent / 100)
      return {
        ...draft,
        final_amount: money(approvedAmount),
        tax_percent: taxPercent,
        tax_amount: money(taxReserve),
        approved_amount_source: scheduleTotal > 0 ? 'payment_schedule' : 'approved_version',
      }
    })

    const clientIds: string[] = [...new Set([...(requests ?? []).map((item: any) => item.client_id), ...entries.map((item: any) => item.client_id)].filter(Boolean))]
    const { data: clients } = clientIds.length
      ? await db.from('clients').select('id,name,company,document,email,phone').in('id', clientIds)
      : { data: [] }

    const publicVersions = versionRows.map(({ snapshot: _snapshot, ...version }: any) => version)
    let metrics
    try { metrics = await metricsPromise } catch { return json({ error: 'metrics_query_failed' }, 500, headers) }
    return json({
      entries,
      previousEntries: (previousEntries ?? []).map((entry: any) => ({ ...entry, status: effectiveStatus(entry, currentDate) })),
      competence,
      period: period ?? { competence_month: monthStart, status: 'open' },
      accounts: accounts ?? [],
      drafts: financeDrafts,
      settlements: settlements ?? [],
      audits: audits ?? [],
      requests: requests ?? [],
      installments: installmentRows,
      versions: publicVersions,
      clients: clients ?? [],
      metrics,
    }, 200, headers)
  }

  if (req.method !== 'PATCH') return json({ error: 'method_not_allowed' }, 405, headers)

  let body: ActionPayload
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400, headers) }

  if (body.action === 'add_account') {
    const name = clean(body.name, 120)
    if (name.length < 2) return json({ error: 'invalid_account_name' }, 400, headers)
    const { data, error } = await db.from('financial_accounts').insert({ name, created_by: user.id }).select('id,name,active,sort_order').single()
    if (error?.code === '23505') return json({ error: 'account_already_exists' }, 409, headers)
    if (error) return json({ error: 'account_create_failed' }, 500, headers)
    return json({ account: data }, 201, headers)
  }

  if (body.action === 'update_entry') {
    const entryId = clean(body.entryId, 80)
    const expectedUpdatedAt = clean(body.expectedUpdatedAt, 40)
    const description = clean(body.description, 240)
    const counterpartyName = clean(body.counterpartyName, 160) || null
    const category = clean(body.category, 120) || null
    const referenceNumber = clean(body.referenceNumber, 120) || null
    const notes = clean(body.notes, 1200) || null
    const amountCents = cents(body.amount)
    const competenceDate = isoDate(body.competenceDate)
    const dueDate = isoDate(body.dueDate)
    if (!entryId || !expectedUpdatedAt || description.length < 2 || amountCents <= 0 || !competenceDate || !dueDate) return json({ error: 'invalid_entry_update' }, 400, headers)

    const { data: entry } = await db.from('financial_entries').select('*').eq('id', entryId).maybeSingle()
    if (!entry) return json({ error: 'entry_not_found' }, 404, headers)
    if (entry.updated_at !== expectedUpdatedAt) return json({ error: 'entry_changed_reload' }, 409, headers)
    if (['paid', 'cancelled'].includes(entry.status)) return json({ error: 'entry_not_editable' }, 409, headers)
    if (amountCents < cents(entry.paid_amount)) return json({ error: 'gross_amount_below_paid_amount' }, 409, headers)
    const { data: closed } = await db.from('financial_periods').select('competence_month').eq('competence_month', `${String(entry.competence_date).slice(0, 7)}-01`).eq('status', 'closed').maybeSingle()
    if (closed) return json({ error: 'financial_period_closed' }, 409, headers)

    const before = entry
    const { data: updated, error } = await db.from('financial_entries').update({
      description, counterparty_name: counterpartyName, category, gross_amount: money(amountCents), competence_date: competenceDate,
      due_date: dueDate, invoice_number: referenceNumber, notes, updated_at: new Date().toISOString(),
    }).eq('id', entryId).eq('updated_at', expectedUpdatedAt).select('*').maybeSingle()
    if (error || !updated) return json({ error: 'entry_changed_reload' }, 409, headers)
    await db.from('financial_audit_log').insert({ entry_id: entryId, actor_user_id: user.id, event_type: 'entry_updated', event_data: { scope: 'occurrence', before, after: updated } })
    return json({ entry: updated }, 200, headers)
  }

  if (body.action === 'close_period' || body.action === 'reopen_period') {
    const competence = clean(body.competence, 7)
    if (!/^\d{4}-\d{2}$/.test(competence)) return json({ error: 'invalid_competence' }, 400, headers)
    const competenceMonth = `${competence}-01`
    if (body.action === 'reopen_period') {
      const reason = clean(body.reason, 500)
      if (reason.length < 5) return json({ error: 'reopen_reason_required' }, 400, headers)
      const { data, error } = await db.from('financial_periods').upsert({ competence_month: competenceMonth, status: 'open', reopened_at: new Date().toISOString(), reopened_by: user.id, reopen_reason: reason, updated_at: new Date().toISOString() }).select('*').single()
      if (error) return json({ error: 'period_reopen_failed' }, 500, headers)
      await db.from('financial_audit_log').insert({ actor_user_id: user.id, event_type: 'financial_period_reopened', event_data: { competence, reason } })
      return json({ period: data }, 200, headers)
    }
    const pending = await db.from('financial_entries').select('id', { count: 'exact', head: true }).gte('competence_date', competenceMonth).lt('competence_date', nextMonthStart(competenceMonth)).in('status', ['open', 'partial', 'overdue'])
    if ((pending.count ?? 0) > 0) return json({ error: 'period_has_pending_entries' }, 409, headers)
    const { data, error } = await db.from('financial_periods').upsert({ competence_month: competenceMonth, status: 'closed', closed_at: new Date().toISOString(), closed_by: user.id, updated_at: new Date().toISOString() }).select('*').single()
    if (error) return json({ error: 'period_close_failed' }, 500, headers)
    await db.from('financial_audit_log').insert({ actor_user_id: user.id, event_type: 'financial_period_closed', event_data: { competence } })
    return json({ period: data }, 200, headers)
  }

  if (body.action === 'create_payable') {
    const counterpartyName = clean(body.counterpartyName, 160)
    const description = clean(body.description, 240)
    const category = clean(body.category, 120)
    const amountCents = cents(body.amount)
    const dueDate = isoDate(body.dueDate)
    const competenceDate = isoDate(body.competenceDate) || dueDate
    const referenceNumber = clean(body.referenceNumber, 120) || null
    const notes = clean(body.notes, 1200) || null
    if (counterpartyName.length < 2 || description.length < 2 || category.length < 2 || amountCents <= 0 || !dueDate) {
      return json({ error: 'payable_data_required' }, 400, headers)
    }
    const status = dueDate < new Date().toISOString().slice(0, 10) ? 'overdue' : 'open'
    const { data: entry, error } = await db.from('financial_entries').insert({
      entry_type: 'payable',
      status,
      description,
      counterparty_name: counterpartyName,
      gross_amount: money(amountCents),
      paid_amount: 0,
      due_date: dueDate,
      competence_date: competenceDate,
      category,
      notes,
      source: 'manual',
      invoice_number: referenceNumber,
      tax_reserve_amount: 0,
      created_by: user.id,
    }).select('*').single()
    if (error || !entry) return json({ error: 'payable_create_failed' }, 500, headers)
    return json({ entry }, 201, headers)
  }

  if (body.action === 'cancel_entry') {
    const entryId = clean(body.entryId, 80)
    if (!entryId) return json({ error: 'entry_required' }, 400, headers)
    const { data: entry } = await db.from('financial_entries').select('id,entry_type,source,status').eq('id', entryId).maybeSingle()
    if (!entry) return json({ error: 'entry_not_found' }, 404, headers)
    if (entry.entry_type !== 'payable' || entry.source !== 'manual' || ['paid', 'cancelled'].includes(entry.status)) return json({ error: 'entry_not_cancellable' }, 409, headers)
    const { count } = await db.from('financial_settlements').select('id', { count: 'exact', head: true }).eq('entry_id', entryId).is('reversed_at', null)
    if ((count ?? 0) > 0) return json({ error: 'entry_has_settlements' }, 409, headers)
    const { data: cancelled, error } = await db.from('financial_entries').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', entryId).select('*').single()
    if (error || !cancelled) return json({ error: 'entry_cancel_failed' }, 500, headers)
    await db.from('financial_audit_log').insert({ entry_id: entryId, actor_user_id: user.id, event_type: 'entry_cancelled', event_data: { previousStatus: entry.status } })
    return json({ entry: cancelled }, 200, headers)
  }

  if (body.action === 'reverse_settlement') {
    const settlementId = clean(body.settlementId, 80)
    const reason = clean(body.reason, 500)
    if (!settlementId || reason.length < 5) return json({ error: 'reversal_reason_required' }, 400, headers)

    const { data: settlement } = await db.from('financial_settlements').select('*').eq('id', settlementId).maybeSingle()
    if (!settlement) return json({ error: 'settlement_not_found' }, 404, headers)
    if (settlement.reversed_at) return json({ error: 'settlement_already_reversed' }, 409, headers)

    const { data: entry } = await db.from('financial_entries').select('*').eq('id', settlement.entry_id).maybeSingle()
    if (!entry) return json({ error: 'entry_not_found' }, 404, headers)
    if (entry.status === 'cancelled') return json({ error: 'entry_not_open' }, 409, headers)

    const { data: latestActive } = await db.from('financial_settlements')
      .select('id')
      .eq('entry_id', settlement.entry_id)
      .is('reversed_at', null)
      .order('settled_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!latestActive || latestActive.id !== settlement.id) return json({ error: 'reversal_requires_latest' }, 409, headers)

    const reversedAt = new Date().toISOString()
    const { data: reversed, error: reverseError } = await db.from('financial_settlements')
      .update({ reversed_at: reversedAt, reversed_by: user.id, reversal_reason: reason })
      .eq('id', settlement.id)
      .is('reversed_at', null)
      .select('*')
      .single()
    if (reverseError || !reversed) return json({ error: 'settlement_reverse_failed' }, 500, headers)

    const { data: refreshed } = await db.from('financial_entries').select('*').eq('id', entry.id).single()

    if (entry.entry_type === 'receivable' && entry.quote_request_id) {
      await db.from('quote_audit_log').insert({
        request_id: entry.quote_request_id,
        actor_user_id: user.id,
        event_type: 'financial_settlement_reversed',
        event_data: { entryId: entry.id, settlementId: settlement.id, installmentNumber: entry.installment_number, amount: Number(settlement.amount), reason },
      })

      const { data: quoteDraft } = await db.from('quote_drafts').select('id,current_version,approved_version,commercial_status').eq('request_id', entry.quote_request_id).maybeSingle()
      if (quoteDraft?.commercial_status === 'received') {
        const version = Number(quoteDraft.approved_version || quoteDraft.current_version || 0)
        await db.from('quote_drafts').update({ commercial_status: 'invoiced', updated_at: reversedAt }).eq('id', quoteDraft.id)
        if (version > 0) await db.from('quote_versions').update({ commercial_status: 'invoiced' }).eq('request_id', entry.quote_request_id).eq('version_number', version)
        await db.from('quote_audit_log').insert({ request_id: entry.quote_request_id, actor_user_id: user.id, event_type: 'commercial_status_invoiced_after_reversal', event_data: { source: 'finance', version, settlementId: settlement.id } })
      }
    }

    return json({ settlement: reversed, entry: refreshed }, 200, headers)
  }

  if (body.action === 'create_receivables') {
    const requestId = clean(body.requestId, 80)
    const invoiceNumber = clean(body.invoiceNumber, 120)
    const invoiceIssuedAt = isoDate(body.invoiceIssuedAt)
    if (!requestId || !invoiceNumber || !invoiceIssuedAt) return json({ error: 'invoice_data_required' }, 400, headers)

    const { data: request } = await db.from('quote_requests').select('id,client_id,proposal_number,name,company').eq('id', requestId).maybeSingle()
    const { data: draft } = await db.from('quote_drafts').select('id,request_id,commercial_status,final_amount,tax_percent,tax_amount,approved_version,current_version').eq('request_id', requestId).maybeSingle()
    if (!request || !draft) return json({ error: 'quote_not_found' }, 404, headers)
    if (!['approved', 'invoiced'].includes(String(draft.commercial_status))) return json({ error: 'quote_not_approved' }, 409, headers)
    const approvedVersion = Number(draft.approved_version || 0)
    if (approvedVersion <= 0) return json({ error: 'approved_version_required' }, 409, headers)

    const { data: existing } = await db.from('financial_entries').select('*').eq('entry_type', 'receivable').eq('quote_request_id', requestId).order('installment_number')
    if ((existing ?? []).length) {
      const differentInvoice = (existing ?? []).some((item: any) => item.invoice_number && item.invoice_number !== invoiceNumber)
      if (differentInvoice) return json({ error: 'receivables_already_exist' }, 409, headers)
      if (draft.commercial_status === 'approved') {
        const now = new Date().toISOString()
        await db.from('quote_drafts').update({ commercial_status: 'invoiced', updated_at: now }).eq('id', draft.id)
        await db.from('quote_versions').update({ commercial_status: 'invoiced' }).eq('request_id', requestId).eq('version_number', approvedVersion)
      }
      return json({ entries: existing, idempotent: true }, 200, headers)
    }

    const [{ data: planned }, { data: version }] = await Promise.all([
      db.from('quote_payment_installments').select('id,draft_id,installment_number,amount,due_date,status').eq('draft_id', draft.id).eq('status', 'planned').order('installment_number'),
      db.from('quote_versions').select('id,request_id,version_number,snapshot').eq('request_id', requestId).eq('version_number', approvedVersion).maybeSingle(),
    ])
    if (!version) return json({ error: 'approved_version_required' }, 409, headers)
    if (!(planned ?? []).length) return json({ error: 'payment_schedule_required' }, 409, headers)

    const schedule = planned as Array<{ id: string; installment_number: number; amount: number; due_date: string; status: string }>
    const scheduleTotal = schedule.reduce((sum, item) => sum + cents(item.amount), 0)
    const approvedAmount = approvedSnapshotAmountCents(version, draft.final_amount)
    if (scheduleTotal !== approvedAmount) {
      return json({ error: 'approved_payment_schedule_mismatch', approvedAmount: money(approvedAmount), scheduleAmount: money(scheduleTotal) }, 409, headers)
    }

    const taxPercent = approvedTaxPercent(version, draft.tax_percent)
    const taxReserveTotal = Math.round(scheduleTotal * taxPercent / 100)
    const taxParts = allocateCents(taxReserveTotal, schedule)
    const rows = schedule.map((item, index) => ({
      entry_type: 'receivable',
      status: new Date(`${item.due_date}T12:00:00Z`).getTime() < Date.now() ? 'overdue' : 'open',
      description: `${request.proposal_number} • Parcela ${item.installment_number}/${schedule.length}`,
      client_id: request.client_id,
      quote_request_id: request.id,
      quote_version_id: version.id,
      quote_installment_id: item.id,
      installment_number: item.installment_number,
      gross_amount: Number(item.amount),
      paid_amount: 0,
      due_date: item.due_date,
      competence_date: `${item.due_date.slice(0, 7)}-01`,
      category: 'Receita de serviços',
      source: 'quote',
      entry_kind: schedule.length > 1 ? 'installment' : 'one_time',
      installment_total: schedule.length > 1 ? schedule.length : null,
      invoice_number: invoiceNumber,
      invoice_issued_at: invoiceIssuedAt,
      tax_reserve_amount: money(taxParts[index]),
      created_by: user.id,
    }))

    const { data: created, error: insertError } = await db.from('financial_entries').insert(rows).select('*').order('installment_number')
    if (insertError) return json({ error: insertError.code === '23505' ? 'receivables_already_exist' : 'receivable_create_failed' }, insertError.code === '23505' ? 409 : 500, headers)

    const now = new Date().toISOString()
    const { error: statusError } = await db.from('quote_drafts').update({ commercial_status: 'invoiced', updated_at: now }).eq('id', draft.id)
    if (statusError) return json({ error: 'quote_status_update_failed' }, 500, headers)
    await db.from('quote_versions').update({ commercial_status: 'invoiced' }).eq('request_id', request.id).eq('version_number', approvedVersion)
    await db.from('quote_audit_log').insert({
      request_id: request.id,
      actor_user_id: user.id,
      event_type: 'financial_receivables_created',
      event_data: {
        invoiceNumber,
        invoiceIssuedAt,
        installments: rows.length,
        grossAmount: money(scheduleTotal),
        taxReserveAmount: money(taxReserveTotal),
        taxPercent,
        version: approvedVersion,
        amountSource: 'approved_version_and_payment_schedule',
      },
    })

    return json({ entries: created ?? [] }, 201, headers)
  }

  if (body.action === 'record_settlement') {
    const entryId = clean(body.entryId, 80)
    const accountId = clean(body.accountId, 80)
    const amountCents = cents(body.amount)
    if (!entryId || !accountId || amountCents <= 0) return json({ error: 'invalid_settlement' }, 400, headers)

    const [{ data: entry }, { data: account }] = await Promise.all([
      db.from('financial_entries').select('*').eq('id', entryId).maybeSingle(),
      db.from('financial_accounts').select('id,name,active').eq('id', accountId).eq('active', true).maybeSingle(),
    ])
    if (!entry) return json({ error: 'entry_not_found' }, 404, headers)
    if (!account) return json({ error: 'account_required' }, 409, headers)
    if (entry.status === 'cancelled' || entry.status === 'paid') return json({ error: 'entry_not_open' }, 409, headers)

    const remaining = cents(entry.gross_amount) - cents(entry.paid_amount)
    if (amountCents > remaining) return json({ error: 'settlement_above_balance' }, 409, headers)

    let settledAt = new Date().toISOString()
    if (body.settledAt) {
      const parsed = new Date(body.settledAt)
      if (Number.isNaN(parsed.getTime())) return json({ error: 'invalid_settlement_date' }, 400, headers)
      settledAt = parsed.toISOString()
    }

    let receiptDocumentId: string | null = null
    let receiptObjectPath: string | null = null
    if (body.receipt) {
      const receipt = body.receipt
      const objectPath = clean(receipt.objectPath, 500)
      const mimeType = clean(receipt.mimeType, 120) || null
      const sizeBytes = Math.max(0, Math.round(Number(receipt.sizeBytes || 0))) || null
      const checksum = clean(receipt.checksumSha256, 64).toLowerCase() || null
      const fileName = clean(receipt.fileName, 200) || 'Comprovante'
      if (!objectPath.startsWith(`finance/receipts/${entry.id}/`) || objectPath.includes('..')) return json({ error: 'invalid_receipt_path' }, 400, headers)
      if (sizeBytes && sizeBytes > 15 * 1024 * 1024) return json({ error: 'receipt_too_large' }, 413, headers)
      if (checksum && !/^[a-f0-9]{64}$/.test(checksum)) return json({ error: 'invalid_receipt_checksum' }, 400, headers)

      let existingDocument: any = null
      if (checksum) {
        const result = await db.from('hrx_documents').select('id,object_path').eq('checksum_sha256', checksum).maybeSingle()
        existingDocument = result.data
      }
      if (existingDocument) {
        receiptDocumentId = existingDocument.id
        receiptObjectPath = existingDocument.object_path
      } else {
        const request = entry.quote_request_id
          ? (await db.from('quote_requests').select('id,proposal_number,client_id,name,company').eq('id', entry.quote_request_id).maybeSingle()).data
          : null
        const client = entry.client_id
          ? (await db.from('clients').select('id,name,company').eq('id', entry.client_id).maybeSingle()).data
          : null
        const isPayable = entry.entry_type === 'payable'
        const documentType = isPayable ? 'Comprovante de Pagamento' : 'Comprovante de Recebimento'
        const counterparty = isPayable ? entry.counterparty_name : (client?.company || client?.name || request?.company || request?.name || null)
        const { data: document, error: documentError } = await db.from('hrx_documents').insert({
          object_path: objectPath,
          area_key: 'financeiro',
          folder: 'Comprovantes',
          client_name: counterparty,
          document_type: documentType,
          title: `${fileName} • ${request?.proposal_number || entry.description}`,
          version: 1,
          status: 'active',
          access_class: 'internal',
          effective_date: settledAt.slice(0, 10),
          mime_type: mimeType,
          size_bytes: sizeBytes,
          uploaded_by: user.id,
          checksum_sha256: checksum,
          client_id: entry.client_id,
          quote_request_id: entry.quote_request_id,
          quote_version_id: entry.quote_version_id,
        }).select('id,object_path').single()
        if (documentError || !document) return json({ error: 'receipt_register_failed' }, 500, headers)
        receiptDocumentId = document.id
        receiptObjectPath = document.object_path
      }
    }

    const { data: settlement, error: settlementError } = await db.from('financial_settlements').insert({
      entry_id: entry.id,
      amount: money(amountCents),
      settled_at: settledAt,
      account_id: account.id,
      payment_method: clean(body.paymentMethod, 80) || null,
      note: clean(body.note, 1200) || null,
      receipt_document_id: receiptDocumentId,
      receipt_object_path: receiptObjectPath,
      created_by: user.id,
    }).select('*').single()
    if (settlementError) return json({ error: String(settlementError.message).includes('settlement_exceeds_entry_balance') ? 'settlement_above_balance' : 'settlement_create_failed' }, 409, headers)

    const { data: refreshed } = await db.from('financial_entries').select('*').eq('id', entry.id).single()
    if (entry.entry_type === 'receivable' && entry.quote_request_id) {
      await db.from('quote_audit_log').insert({
        request_id: entry.quote_request_id,
        actor_user_id: user.id,
        event_type: 'financial_settlement_recorded',
        event_data: { entryId: entry.id, installmentNumber: entry.installment_number, amount: money(amountCents), account: account.name, hasReceipt: Boolean(receiptDocumentId) },
      })

      const { data: receivables } = await db.from('financial_entries').select('status').eq('entry_type', 'receivable').eq('quote_request_id', entry.quote_request_id)
      const allPaid = Boolean((receivables ?? []).length) && (receivables ?? []).every((item: any) => item.status === 'paid')
      if (allPaid) {
        const { data: quoteDraft } = await db.from('quote_drafts').select('id,current_version,approved_version,commercial_status').eq('request_id', entry.quote_request_id).maybeSingle()
        if (quoteDraft && quoteDraft.commercial_status === 'invoiced') {
          const version = Number(quoteDraft.approved_version || quoteDraft.current_version || 0)
          await db.from('quote_drafts').update({ commercial_status: 'received', updated_at: new Date().toISOString() }).eq('id', quoteDraft.id)
          if (version > 0) await db.from('quote_versions').update({ commercial_status: 'received' }).eq('request_id', entry.quote_request_id).eq('version_number', version)
          await db.from('quote_audit_log').insert({ request_id: entry.quote_request_id, actor_user_id: user.id, event_type: 'commercial_status_received', event_data: { source: 'finance', version } })
        }
      }
    }

    return json({ settlement, entry: refreshed }, 201, headers)
  }

  return json({ error: 'unknown_action' }, 400, headers)
})
