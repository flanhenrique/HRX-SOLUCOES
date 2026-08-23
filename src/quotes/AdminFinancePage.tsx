import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { financeAdminEndpoint, hrxPublishableKey, hrxSupabase } from './supabaseClient'
import './admin-finance.css'

type FinancialEntry = {
  id: string
  entry_type: 'receivable' | 'payable'
  status: 'open' | 'partial' | 'paid' | 'cancelled' | 'overdue'
  description: string
  client_id?: string | null
  quote_request_id?: string | null
  quote_version_id?: string | null
  installment_number?: number | null
  invoice_number?: string | null
  invoice_issued_at?: string | null
  gross_amount: number
  paid_amount: number
  tax_reserve_amount?: number | null
  due_date: string
  category?: string | null
}
type FinancialAccount = { id: string; name: string; active: boolean; sort_order: number }
type Settlement = { id: string; entry_id: string; amount: number; settled_at: string; account_id: string; payment_method?: string | null; note?: string | null; receipt_document_id?: string | null; receipt_object_path?: string | null }
type Draft = { id: string; request_id: string; commercial_status: 'approved' | 'invoiced' | 'received'; final_amount: number; tax_amount: number; approved_version?: number | null; current_version: number; payment_mode: string; installments: number; valid_until?: string | null }
type Request = { id: string; client_id?: string | null; proposal_number: string; name: string; company?: string | null; email?: string | null; phone?: string | null; status: string }
type Client = { id: string; name: string; company?: string | null; document?: string | null; email?: string | null; phone?: string | null }
type PlannedInstallment = { id: string; draft_id: string; installment_number: number; amount: number; due_date: string; status: string }
type Version = { id: string; request_id: string; version_number: number; commercial_status: string; document_id?: string | null; pdf_object_path?: string | null }
type FinanceResponse = { entries: FinancialEntry[]; accounts: FinancialAccount[]; settlements: Settlement[]; drafts: Draft[]; requests: Request[]; clients: Client[]; installments: PlannedInstallment[]; versions: Version[] }
type View = 'billing' | 'receivables' | 'received'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const date = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—'
const today = () => new Date().toISOString().slice(0, 10)
const safeFileName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 120)

async function financeFetch<T>(session: Session, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(financeAdminEndpoint, {
    method: body ? 'PATCH' : 'GET',
    headers: { 'Content-Type': 'application/json', apikey: hrxPublishableKey, Authorization: `Bearer ${session.access_token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(payload.error || `HTTP_${response.status}`)
  return payload as T
}

export default function AdminFinancePage() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('billing')
  const [data, setData] = useState<FinanceResponse>({ entries: [], accounts: [], settlements: [], drafts: [], requests: [], clients: [], installments: [], versions: [] })
  const [invoiceDraft, setInvoiceDraft] = useState<Draft | null>(null)
  const [settlementEntry, setSettlementEntry] = useState<FinancialEntry | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)

  useEffect(() => {
    void hrxSupabase.auth.getSession().then(({ data: auth }) => { setSession(auth.session); setChecking(false) })
    const { data: listener } = hrxSupabase.auth.onAuthStateChange((_event, next) => { setSession(next); setChecking(false) })
    return () => listener.subscription.unsubscribe()
  }, [])

  const load = async (current = session) => {
    if (!current) return
    setLoading(true); setError('')
    try { setData(await financeFetch<FinanceResponse>(current)) }
    catch (cause) {
      const code = cause instanceof Error ? cause.message : ''
      setError(code === 'mfa_required' ? 'Confirme o MFA/AAL2 para acessar o Financeiro.' : 'Não foi possível carregar o financeiro.')
    } finally { setLoading(false) }
  }
  useEffect(() => { if (session) void load(session) }, [session])

  const requestById = useMemo(() => new Map(data.requests.map((item) => [item.id, item])), [data.requests])
  const clientById = useMemo(() => new Map(data.clients.map((item) => [item.id, item])), [data.clients])
  const entryRequestIds = useMemo(() => new Set(data.entries.filter((item) => item.entry_type === 'receivable' && item.quote_request_id).map((item) => item.quote_request_id as string)), [data.entries])
  const billingCandidates = useMemo(() => data.drafts.filter((draft) => draft.commercial_status === 'approved' && !entryRequestIds.has(draft.request_id)), [data.drafts, entryRequestIds])
  const receivables = useMemo(() => data.entries.filter((item) => item.entry_type === 'receivable' && item.status !== 'cancelled'), [data.entries])
  const openReceivables = useMemo(() => receivables.filter((item) => item.status !== 'paid'), [receivables])
  const paidReceivables = useMemo(() => receivables.filter((item) => item.status === 'paid'), [receivables])

  const metrics = useMemo(() => {
    const outstanding = openReceivables.reduce((sum, item) => sum + Math.max(0, Number(item.gross_amount) - Number(item.paid_amount)), 0)
    const overdue = openReceivables.filter((item) => item.status === 'overdue').reduce((sum, item) => sum + Math.max(0, Number(item.gross_amount) - Number(item.paid_amount)), 0)
    const payable = data.entries.filter((item) => item.entry_type === 'payable' && !['paid', 'cancelled'].includes(item.status)).reduce((sum, item) => sum + Math.max(0, Number(item.gross_amount) - Number(item.paid_amount)), 0)
    const reserve = openReceivables.reduce((sum, item) => sum + Number(item.tax_reserve_amount || 0), 0)
    const month = new Date().toISOString().slice(0, 7)
    const receivedMonth = data.settlements.filter((item) => item.settled_at.startsWith(month)).reduce((sum, item) => sum + Number(item.amount), 0)
    return { outstanding, overdue, payable, reserve, receivedMonth }
  }, [data.entries, data.settlements, openReceivables])

  if (checking || !session) return <section className="finance-loading">Validando acesso financeiro…</section>

  return <section className="finance-page">
    <header className="finance-page-header">
      <div><span>FINANCEIRO • FASE 1</span><h1>Recebíveis e faturamento</h1><p>Proposta aprovada vira previsão. Somente após registrar a nota/fatura ela entra oficialmente em Contas a Receber.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</button>
    </header>

    {error && <div className="finance-error" role="alert">{error}</div>}

    <div className="finance-metrics">
      <article><span>A receber</span><strong>{currency.format(metrics.outstanding)}</strong><small>Saldo dos recebíveis abertos</small></article>
      <article><span>Vencidos</span><strong>{currency.format(metrics.overdue)}</strong><small>Saldo após o vencimento</small></article>
      <article><span>Recebido no mês</span><strong>{currency.format(metrics.receivedMonth)}</strong><small>Baixas registradas no período</small></article>
      <article><span>Impostos a reservar</span><strong>{currency.format(metrics.reserve)}</strong><small>Baseada nas propostas faturadas</small></article>
      <article><span>A pagar</span><strong>{currency.format(metrics.payable)}</strong><small>Ledger de despesas existente</small></article>
    </div>

    <nav className="finance-tabs" aria-label="Áreas do financeiro">
      <button className={view === 'billing' ? 'is-active' : ''} onClick={() => setView('billing')}>Aguardando faturamento <span>{billingCandidates.length}</span></button>
      <button className={view === 'receivables' ? 'is-active' : ''} onClick={() => setView('receivables')}>Contas a receber <span>{openReceivables.length}</span></button>
      <button className={view === 'received' ? 'is-active' : ''} onClick={() => setView('received')}>Recebidos <span>{paidReceivables.length}</span></button>
    </nav>

    {view === 'billing' && <BillingList drafts={billingCandidates} requestById={requestById} clientById={clientById} installments={data.installments} onInvoice={setInvoiceDraft} />}
    {view === 'receivables' && <ReceivablesList entries={openReceivables} requestById={requestById} clientById={clientById} settlements={data.settlements} accounts={data.accounts} onSettle={setSettlementEntry} onOpenReceipt={(path) => void openReceipt(path, setError)} />}
    {view === 'received' && <ReceivablesList entries={paidReceivables} requestById={requestById} clientById={clientById} settlements={data.settlements} accounts={data.accounts} onSettle={() => {}} onOpenReceipt={(path) => void openReceipt(path, setError)} readOnly />}

    <footer className="finance-page-footer"><span>Recebíveis vinculados a proposta, versão, parcela e documento.</span><button type="button" onClick={() => setAccountOpen(true)}>Configurar contas de recebimento</button></footer>

    {invoiceDraft && <InvoiceModal session={session} draft={invoiceDraft} request={requestById.get(invoiceDraft.request_id)} installments={data.installments.filter((item) => item.draft_id === invoiceDraft.id)} onClose={() => setInvoiceDraft(null)} onDone={async () => { setInvoiceDraft(null); await load(session); setView('receivables') }} onError={setError} />}
    {settlementEntry && <SettlementModal session={session} entry={settlementEntry} accounts={data.accounts.filter((item) => item.active)} onClose={() => setSettlementEntry(null)} onNeedAccount={() => setAccountOpen(true)} onDone={async () => { setSettlementEntry(null); await load(session) }} onError={setError} />}
    {accountOpen && <AccountModal session={session} onClose={() => setAccountOpen(false)} onDone={async () => { setAccountOpen(false); await load(session) }} onError={setError} />}
  </section>
}

function BillingList({ drafts, requestById, clientById, installments, onInvoice }: { drafts: Draft[]; requestById: Map<string, Request>; clientById: Map<string, Client>; installments: PlannedInstallment[]; onInvoice: (draft: Draft) => void }) {
  if (!drafts.length) return <EmptyState title="Nenhuma proposta aguardando faturamento" text="Quando uma proposta for aprovada, ela aparecerá aqui antes de virar conta a receber." />
  return <div className="finance-list">{drafts.map((draft) => {
    const request = requestById.get(draft.request_id)
    const client = request?.client_id ? clientById.get(request.client_id) : undefined
    const schedule = installments.filter((item) => item.draft_id === draft.id && item.status === 'planned')
    return <article className="finance-billing-card" key={draft.id}>
      <div className="finance-billing-main"><span>APROVADA • AGUARDANDO FATURAMENTO</span><h2>{request?.proposal_number || 'Proposta'}</h2><p>{client?.company || client?.name || request?.company || request?.name || 'Cliente'}</p><small>{schedule.length} parcela(s) prevista(s) • validade {date(draft.valid_until)}</small></div>
      <div className="finance-billing-value"><strong>{currency.format(Number(draft.final_amount))}</strong><small>Reserva tributária {currency.format(Number(draft.tax_amount || 0))}</small><button type="button" onClick={() => onInvoice(draft)}>Registrar faturamento</button></div>
    </article>
  })}</div>
}

function ReceivablesList({ entries, requestById, clientById, settlements, accounts, onSettle, onOpenReceipt, readOnly = false }: { entries: FinancialEntry[]; requestById: Map<string, Request>; clientById: Map<string, Client>; settlements: Settlement[]; accounts: FinancialAccount[]; onSettle: (entry: FinancialEntry) => void; onOpenReceipt: (path: string) => void; readOnly?: boolean }) {
  const accountById = new Map(accounts.map((item) => [item.id, item]))
  if (!entries.length) return <EmptyState title={readOnly ? 'Nenhum recebimento concluído' : 'Nenhum recebível em aberto'} text={readOnly ? 'As parcelas quitadas aparecerão aqui.' : 'Registre o faturamento de uma proposta aprovada para criar as parcelas.'} />
  return <div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Cliente / proposta</th><th>Parcela</th><th>Vencimento</th><th>Nota/Fatura</th><th>Valor</th><th>Recebido</th><th>Status</th><th>Ações</th></tr></thead><tbody>{entries.map((entry) => {
    const request = entry.quote_request_id ? requestById.get(entry.quote_request_id) : undefined
    const client = entry.client_id ? clientById.get(entry.client_id) : undefined
    const entrySettlements = settlements.filter((item) => item.entry_id === entry.id)
    const latest = entrySettlements[0]
    const remaining = Math.max(0, Number(entry.gross_amount) - Number(entry.paid_amount))
    const statusLabel = entry.status === 'paid' ? 'Recebido' : entry.status === 'partial' ? 'Recebido parcial' : entry.status === 'overdue' ? (Number(entry.paid_amount) > 0 ? 'Vencido • parcial' : 'Vencido') : 'A receber'
    return <tr key={entry.id}><td data-label="Cliente / proposta"><strong>{client?.company || client?.name || request?.company || request?.name || 'Lançamento'}</strong><small>{request?.proposal_number || entry.description}</small></td><td data-label="Parcela">{entry.installment_number || '—'}</td><td data-label="Vencimento">{date(entry.due_date)}</td><td data-label="Nota/Fatura"><strong>{entry.invoice_number || '—'}</strong><small>{date(entry.invoice_issued_at)}</small></td><td data-label="Valor"><strong>{currency.format(Number(entry.gross_amount))}</strong><small>Saldo {currency.format(remaining)}</small></td><td data-label="Recebido"><strong>{currency.format(Number(entry.paid_amount))}</strong>{latest && <small>{accountById.get(latest.account_id)?.name || 'Conta'} • {new Date(latest.settled_at).toLocaleDateString('pt-BR')}</small>}</td><td data-label="Status"><span className={`finance-status is-${entry.status}`}>{statusLabel}</span>{Number(entry.tax_reserve_amount || 0) > 0 && <small>Reserva {currency.format(Number(entry.tax_reserve_amount))}</small>}</td><td data-label="Ações"><div className="finance-row-actions">{!readOnly && <button type="button" onClick={() => onSettle(entry)}>Registrar recebimento</button>}{latest?.receipt_object_path && <button type="button" className="is-secondary" onClick={() => onOpenReceipt(latest.receipt_object_path!)}>Comprovante</button>}</div></td></tr>
  })}</tbody></table></div>
}

function InvoiceModal({ session, draft, request, installments, onClose, onDone, onError }: { session: Session; draft: Draft; request?: Request; installments: PlannedInstallment[]; onClose: () => void; onDone: () => Promise<void>; onError: (value: string) => void }) {
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(today())
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!invoiceNumber.trim()) return
    setBusy(true)
    try { await financeFetch(session, { action: 'create_receivables', requestId: draft.request_id, invoiceNumber: invoiceNumber.trim(), invoiceIssuedAt: invoiceDate }); await onDone() }
    catch (cause) {
      const code = cause instanceof Error ? cause.message : ''
      const messages: Record<string, string> = { receivables_already_exist: 'Esta proposta já possui recebíveis vinculados.', payment_schedule_mismatch: 'O cronograma de parcelas não fecha com o valor aprovado.', invoice_data_required: 'Informe o número e a data da nota/fatura.' }
      onError(messages[code] || 'Não foi possível registrar o faturamento.')
    } finally { setBusy(false) }
  }
  return <div className="finance-modal-backdrop"><form className="finance-modal" onSubmit={submit}><header><div><span>FATURAMENTO</span><h2>{request?.proposal_number || 'Proposta aprovada'}</h2><p>O HRX não emite nota fiscal nesta fase. Informe o documento já emitido para criar oficialmente as contas a receber.</p></div><button type="button" onClick={onClose}>×</button></header><div className="finance-modal-body"><label>Número da nota/fatura<input autoFocus value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Ex.: NFS-e 1234" /></label><label>Data de emissão<input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} /></label><div className="finance-modal-summary"><span>Valor aprovado <strong>{currency.format(Number(draft.final_amount))}</strong></span><span>Parcelas <strong>{installments.length}</strong></span><span>Reserva tributária <strong>{currency.format(Number(draft.tax_amount || 0))}</strong></span></div></div><footer><button type="button" className="is-secondary" onClick={onClose}>Cancelar</button><button disabled={busy || !invoiceNumber.trim()}>{busy ? 'Registrando…' : 'Criar contas a receber'}</button></footer></form></div>
}

function SettlementModal({ session, entry, accounts, onClose, onNeedAccount, onDone, onError }: { session: Session; entry: FinancialEntry; accounts: FinancialAccount[]; onClose: () => void; onNeedAccount: () => void; onDone: () => Promise<void>; onError: (value: string) => void }) {
  const remaining = Math.max(0, Number(entry.gross_amount) - Number(entry.paid_amount))
  const [amount, setAmount] = useState(String(remaining.toFixed(2)).replace('.', ','))
  const [accountId, setAccountId] = useState(accounts[0]?.id || '')
  const [settledAt, setSettledAt] = useState(today())
  const [method, setMethod] = useState('pix')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (!accountId && accounts[0]) setAccountId(accounts[0].id) }, [accounts, accountId])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const numericAmount = Number(amount.replace(/\./g, '').replace(',', '.'))
    if (!numericAmount || numericAmount <= 0 || numericAmount > remaining + .001) { onError('Informe um valor de recebimento válido, limitado ao saldo da parcela.'); return }
    if (!accountId) { onError('Cadastre e selecione a conta de recebimento.'); return }
    if (file && file.size > 15 * 1024 * 1024) { onError('O comprovante deve ter no máximo 15 MB.'); return }
    setBusy(true)
    let uploadedPath = ''
    try {
      let receipt: Record<string, unknown> | null = null
      if (file) {
        uploadedPath = `finance/receipts/${entry.id}/${Date.now()}_${safeFileName(file.name)}`
        const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
        const checksumSha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
        const { error: uploadError } = await hrxSupabase.storage.from('hrx-documents').upload(uploadedPath, file, { contentType: file.type || 'application/octet-stream', upsert: false })
        if (uploadError) throw new Error('receipt_upload_failed')
        receipt = { objectPath: uploadedPath, mimeType: file.type || null, sizeBytes: file.size, checksumSha256, fileName: file.name }
      }
      await financeFetch(session, { action: 'record_settlement', entryId: entry.id, amount: numericAmount, accountId, settledAt: `${settledAt}T12:00:00`, paymentMethod: method, note: note.trim() || null, receipt })
      await onDone()
    } catch (cause) {
      if (uploadedPath) await hrxSupabase.storage.from('hrx-documents').remove([uploadedPath]).catch(() => undefined)
      const code = cause instanceof Error ? cause.message : ''
      const messages: Record<string, string> = { receipt_upload_failed: 'Não foi possível enviar o comprovante.', settlement_above_balance: 'O valor informado ultrapassa o saldo atual.', account_required: 'A conta de recebimento não está disponível.' }
      onError(messages[code] || 'Não foi possível registrar o recebimento.')
    } finally { setBusy(false) }
  }

  return <div className="finance-modal-backdrop"><form className="finance-modal" onSubmit={submit}><header><div><span>BAIXA FINANCEIRA</span><h2>Registrar recebimento</h2><p>O comprovante é recomendado, mas não bloqueia a baixa. Toda movimentação fica vinculada à parcela.</p></div><button type="button" onClick={onClose}>×</button></header><div className="finance-modal-body"><div className="finance-modal-summary"><span>Valor da parcela <strong>{currency.format(Number(entry.gross_amount))}</strong></span><span>Já recebido <strong>{currency.format(Number(entry.paid_amount))}</strong></span><span>Saldo <strong>{currency.format(remaining)}</strong></span></div><label>Valor recebido<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Data do recebimento<input type="date" value={settledAt} onChange={(event) => setSettledAt(event.target.value)} /></label><label>Conta de recebimento<select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Selecione…</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>{!accounts.length && <button type="button" className="finance-inline-action" onClick={onNeedAccount}>+ Cadastrar conta de recebimento</button>}<label>Forma<select value={method} onChange={(event) => setMethod(event.target.value)}><option value="pix">PIX</option><option value="transferencia">Transferência</option><option value="boleto">Boleto</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option><option value="outro">Outro</option></select></label><label className="is-wide">Comprovante<input type="file" accept="application/pdf,image/*" onChange={(event) => setFile(event.target.files?.[0] || null)} /><small>{file ? `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Opcional. PDF ou imagem, até 15 MB.'}</small></label><label className="is-wide">Observação<textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: Recebimento confirmado via extrato." /></label></div><footer><button type="button" className="is-secondary" onClick={onClose}>Cancelar</button><button disabled={busy}>{busy ? 'Registrando…' : 'Confirmar recebimento'}</button></footer></form></div>
}

function AccountModal({ session, onClose, onDone, onError }: { session: Session; onClose: () => void; onDone: () => Promise<void>; onError: (value: string) => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); if (name.trim().length < 2) return; setBusy(true); try { await financeFetch(session, { action: 'add_account', name: name.trim() }); await onDone() } catch (cause) { onError(cause instanceof Error && cause.message === 'account_already_exists' ? 'Essa conta já está cadastrada.' : 'Não foi possível cadastrar a conta.'); } finally { setBusy(false) } }
  return <div className="finance-modal-backdrop"><form className="finance-modal is-small" onSubmit={submit}><header><div><span>CONFIGURAÇÃO</span><h2>Nova conta de recebimento</h2><p>Use o nome que você reconhece no dia a dia. Ex.: banco, carteira ou conta interna.</p></div><button type="button" onClick={onClose}>×</button></header><div className="finance-modal-body"><label>Nome da conta<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Conta PJ principal" /></label></div><footer><button type="button" className="is-secondary" onClick={onClose}>Cancelar</button><button disabled={busy || name.trim().length < 2}>{busy ? 'Salvando…' : 'Cadastrar'}</button></footer></form></div>
}

function EmptyState({ title, text }: { title: string; text: string }) { return <div className="finance-empty"><strong>{title}</strong><span>{text}</span></div> }

async function openReceipt(path: string, onError: (value: string) => void) {
  const { data, error } = await hrxSupabase.storage.from('hrx-documents').createSignedUrl(path, 600)
  if (error || !data?.signedUrl) { onError('Não foi possível abrir o comprovante.'); return }
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}
