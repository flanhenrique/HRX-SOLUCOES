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
  | { action: 'add_account'; name: string }
  | { action: 'record_settlement'; entryId: string; amount: number; accountId: string; settledAt?: string; paymentMethod?: string; note?: string; receipt?: ReceiptInput | null }

const defaultOrigins = ['http://localhost:5173', 'https://flanhenrique.github.io', 'https://hrxsolutions.com.br', 'https://www.hrxsolutions.com.br']
const clean = (value: unknown, max = 1000) => String(value ?? '').trim().slice(0, max)
const cents = (value: unknown) => Math.round((Number(value) || 0) * 100)
const money = (value: number) => Math.round(value) / 100
const isoDate = (value: unknown) => {
  const date = clean(value, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ''
}

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

function allocateTax(totalTax: number, installments: Array<{ amount: number }>) {
  const taxCents = Math.max(0, cents(totalTax))
  const amounts = installments.map((item) => Math.max(0, cents(item.amount)))
  const total = amounts.reduce((sum, value) => sum + value, 0)
  if (!taxCents || !total) return amounts.map(() => 0)
  let allocated = 0
  return amounts.map((value, index) => {
    if (index === amounts.length - 1) return taxCents - allocated
    const part = Math.floor(taxCents * value / total)
    allocated += part
    return part
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
    const currentDate = new Date().toISOString().slice(0, 10)
    await db.from('financial_entries')
      .update({ status: 'overdue', updated_at: new Date().toISOString() })
      .eq('entry_type', 'receivable')
      .lt('due_date', currentDate)
      .in('status', ['open', 'partial'])

    const [{ data: entries, error: entriesError }, { data: accounts }, { data: drafts }, { data: settlements }] = await Promise.all([
      db.from('financial_entries').select('*').order('due_date', { ascending: true }).limit(600),
      db.from('financial_accounts').select('id,name,active,sort_order,created_at').order('sort_order').order('name'),
      db.from('quote_drafts').select('id,request_id,commercial_status,final_amount,tax_amount,approved_version,current_version,payment_mode,installments,first_due_date,valid_until,updated_at').in('commercial_status', ['approved', 'invoiced', 'received']).order('updated_at', { ascending: false }).limit(300),
      db.from('financial_settlements').select('*').order('settled_at', { ascending: false }).limit(1200),
    ])
    if (entriesError) return json({ error: 'query_failed' }, 500, headers)

    const requestIds: string[] = [...new Set((drafts ?? []).map((item: any) => item.request_id).filter(Boolean))]
    const entryRequestIds = (entries ?? []).map((item: any) => item.quote_request_id).filter(Boolean)
    for (const id of entryRequestIds) if (!requestIds.includes(id)) requestIds.push(id)

    const [{ data: requests }, { data: installments }, { data: versions }] = await Promise.all([
      requestIds.length ? db.from('quote_requests').select('id,client_id,proposal_number,name,company,email,phone,status').in('id', requestIds) : Promise.resolve({ data: [] }),
      (drafts ?? []).length ? db.from('quote_payment_installments').select('id,draft_id,installment_number,amount,due_date,status').in('draft_id', (drafts ?? []).map((item: any) => item.id)).order('installment_number') : Promise.resolve({ data: [] }),
      requestIds.length ? db.from('quote_versions').select('id,request_id,version_number,commercial_status,document_id,pdf_object_path,created_at').in('request_id', requestIds).order('version_number', { ascending: false }) : Promise.resolve({ data: [] }),
    ])

    const clientIds: string[] = [...new Set([...(requests ?? []).map((item: any) => item.client_id), ...(entries ?? []).map((item: any) => item.client_id)].filter(Boolean))]
    const { data: clients } = clientIds.length
      ? await db.from('clients').select('id,name,company,document,email,phone').in('id', clientIds)
      : { data: [] }

    return json({
      entries: entries ?? [],
      accounts: accounts ?? [],
      drafts: drafts ?? [],
      settlements: settlements ?? [],
      requests: requests ?? [],
      installments: installments ?? [],
      versions: versions ?? [],
      clients: clients ?? [],
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

  if (body.action === 'create_receivables') {
    const requestId = clean(body.requestId, 80)
    const invoiceNumber = clean(body.invoiceNumber, 120)
    const invoiceIssuedAt = isoDate(body.invoiceIssuedAt)
    if (!requestId || !invoiceNumber || !invoiceIssuedAt) return json({ error: 'invoice_data_required' }, 400, headers)

    const { data: request } = await db.from('quote_requests').select('id,client_id,proposal_number,name,company').eq('id', requestId).maybeSingle()
    const { data: draft } = await db.from('quote_drafts').select('id,request_id,commercial_status,final_amount,tax_amount,approved_version,current_version').eq('request_id', requestId).maybeSingle()
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
      db.from('quote_versions').select('id,request_id,version_number').eq('request_id', requestId).eq('version_number', approvedVersion).maybeSingle(),
    ])
    if (!version) return json({ error: 'approved_version_required' }, 409, headers)
    if (!(planned ?? []).length) return json({ error: 'payment_schedule_required' }, 409, headers)

    const scheduleTotal = (planned ?? []).reduce((sum: number, item: any) => sum + cents(item.amount), 0)
    if (scheduleTotal !== cents(draft.final_amount)) return json({ error: 'payment_schedule_mismatch' }, 409, headers)

    const taxParts = allocateTax(Number(draft.tax_amount || 0), planned as Array<{ amount: number }>)
    const rows = (planned ?? []).map((item: any, index: number) => ({
      entry_type: 'receivable',
      status: new Date(`${item.due_date}T12:00:00Z`).getTime() < Date.now() ? 'overdue' : 'open',
      description: `${request.proposal_number} • Parcela ${item.installment_number}/${planned!.length}`,
      client_id: request.client_id,
      quote_request_id: request.id,
      quote_version_id: version.id,
      quote_installment_id: item.id,
      installment_number: item.installment_number,
      gross_amount: Number(item.amount),
      paid_amount: 0,
      due_date: item.due_date,
      competence_date: invoiceIssuedAt,
      category: 'Receita de serviços',
      source: 'quote',
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
      event_data: { invoiceNumber, invoiceIssuedAt, installments: rows.length, grossAmount: Number(draft.final_amount), taxReserveAmount: Number(draft.tax_amount || 0), version: approvedVersion },
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
        const { data: document, error: documentError } = await db.from('hrx_documents').insert({
          object_path: objectPath,
          area_key: 'financeiro',
          folder: 'Comprovantes',
          client_name: client?.company || client?.name || request?.company || request?.name || null,
          document_type: 'Comprovante de Recebimento',
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
    if (entry.quote_request_id) {
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
