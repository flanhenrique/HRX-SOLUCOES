import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { financeAdminEndpoint, hrxPublishableKey, hrxSupabase } from './supabaseClient'
import './admin-finance.css'

type FinancialEntry = {
  id: string
  entry_type: 'receivable' | 'payable'
  status: 'open' | 'partial' | 'paid' | 'cancelled' | 'overdue'
  description: string
  counterparty_name?: string | null
  client_id?: string | null
  quote_request_id?: string | null
  quote_version_id?: string | null
  installment_number?: number | null
  invoice_number?: string | null
  invoice_issued_at?: string | null
  competence_date?: string | null
  gross_amount: number
  paid_amount: number
  tax_reserve_amount?: number | null
  due_date: string
  category?: string | null
  notes?: string | null
  source?: string | null
  updated_at: string
  entry_kind?: 'one_time' | 'installment' | 'recurrence_occurrence'
  installment_total?: number | null
}
type FinancialAccount = { id: string; name: string; active: boolean; sort_order: number }
type Settlement = { id: string; entry_id: string; amount: number; settled_at: string; account_id: string; payment_method?: string | null; note?: string | null; receipt_document_id?: string | null; receipt_object_path?: string | null }
type Draft = { id: string; request_id: string; commercial_status: 'approved' | 'invoiced' | 'received'; final_amount: number; tax_amount: number; approved_version?: number | null; current_version: number; payment_mode: string; installments: number; valid_until?: string | null }
type Request = { id: string; client_id?: string | null; proposal_number: string; name: string; company?: string | null; email?: string | null; phone?: string | null; status: string }
type Client = { id: string; name: string; company?: string | null; document?: string | null; email?: string | null; phone?: string | null }
type PlannedInstallment = { id: string; draft_id: string; installment_number: number; amount: number; due_date: string; status: string }
type Version = { id: string; request_id: string; version_number: number; commercial_status: string; document_id?: string | null; pdf_object_path?: string | null }
type FinanceMetrics = { outstanding: number; payable: number; projected: number; overdueReceivable: number; overduePayable: number; reserve: number; receivedMonth: number }
type FinanceResponse = { competence?: string; period?: { status: 'open' | 'closed'; closed_at?: string | null }; entries: FinancialEntry[]; previousEntries: FinancialEntry[]; accounts: FinancialAccount[]; settlements: Settlement[]; drafts: Draft[]; requests: Request[]; clients: Client[]; installments: PlannedInstallment[]; versions: Version[]; metrics?: FinanceMetrics }
type View = 'billing' | 'receivables' | 'received' | 'payables' | 'paidPayables' | 'cashflow'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const date = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—'
const today = () => new Date().toISOString().slice(0, 10)
const safeFileName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 120)
const expenseCategories = ['Software e assinaturas', 'Serviços profissionais', 'Marketing', 'Infraestrutura', 'Impostos e taxas', 'Operacional', 'Reembolso', 'Outros']

const currentCompetence = () => new URLSearchParams(window.location.search).get('competencia')?.match(/^\d{4}-\d{2}$/)?.[0] || new Date().toISOString().slice(0, 7)
const competenceLabel = (value: string) => new Date(`${value}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
const moveCompetence = (value: string, amount: number) => { const next = new Date(`${value}-01T12:00:00`); next.setMonth(next.getMonth() + amount); return next.toISOString().slice(0, 7) }

async function financeFetch<T>(session: Session, body?: Record<string, unknown>, competence?: string): Promise<T> {
  const endpoint = body ? financeAdminEndpoint : `${financeAdminEndpoint}?competence=${encodeURIComponent(competence || currentCompetence())}`
  const response = await fetch(endpoint, {
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
  const [selectedCompetence, setSelectedCompetence] = useState(currentCompetence)
  const [data, setData] = useState<FinanceResponse>({ entries: [], previousEntries: [], accounts: [], settlements: [], drafts: [], requests: [], clients: [], installments: [], versions: [] })
  const [invoiceDraft, setInvoiceDraft] = useState<Draft | null>(null)
  const [settlementEntry, setSettlementEntry] = useState<FinancialEntry | null>(null)
  const [payableOpen, setPayableOpen] = useState(false)
  const [cancelEntry, setCancelEntry] = useState<FinancialEntry | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<FinancialEntry | null>(null)

  useEffect(() => {
    void hrxSupabase.auth.getSession().then(({ data: auth }) => { setSession(auth.session); setChecking(false) })
    const { data: listener } = hrxSupabase.auth.onAuthStateChange((_event, next) => { setSession(next); setChecking(false) })
    return () => listener.subscription.unsubscribe()
  }, [])

  const load = async (current = session, competence = selectedCompetence) => {
    if (!current) return
    setLoading(true); setError('')
    try { const response = await financeFetch<FinanceResponse>(current, undefined, competence); setData({ ...response, previousEntries: response.previousEntries ?? [] }) }
    catch (cause) {
      const code = cause instanceof Error ? cause.message : ''
      setError(code === 'mfa_required' ? 'Confirme o MFA/AAL2 para acessar o Financeiro.' : 'Não foi possível carregar o financeiro.')
    } finally { setLoading(false) }
  }
  useEffect(() => { if (session) void load(session, selectedCompetence) }, [session, selectedCompetence])
  useEffect(() => {
    const onPopState = () => setSelectedCompetence(currentCompetence())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  const selectCompetence = (value: string) => {
    if (!/^\d{4}-\d{2}$/.test(value)) return
    window.history.pushState({}, '', `/admin/financeiro?competencia=${value}`)
    setSelectedCompetence(value)
  }
  const togglePeriod = async () => {
    if (!session) return
    const closed = data.period?.status === 'closed'
    const reason = closed ? window.prompt('Justificativa obrigatória para reabrir a competência:')?.trim() : ''
    if (closed && (!reason || reason.length < 5)) return
    setLoading(true); setError('')
    try { await financeFetch(session, closed ? { action: 'reopen_period', competence: selectedCompetence, reason } : { action: 'close_period', competence: selectedCompetence }); await load(session, selectedCompetence) }
    catch (cause) { const code = cause instanceof Error ? cause.message : ''; setError(code === 'period_has_pending_entries' ? 'Quite ou cancele as pendências da competência antes de fechá-la.' : 'Não foi possível alterar o fechamento da competência.') }
    finally { setLoading(false) }
  }

  const monthlyEntries = useMemo(() => data.entries.filter((item) => (item.competence_date || item.due_date).slice(0, 7) === selectedCompetence), [data.entries, selectedCompetence])
  const requestById = useMemo(() => new Map(data.requests.map((item) => [item.id, item])), [data.requests])
  const clientById = useMemo(() => new Map(data.clients.map((item) => [item.id, item])), [data.clients])
  const entryById = useMemo(() => new Map(monthlyEntries.map((item) => [item.id, item])), [monthlyEntries])
  const entryRequestIds = useMemo(() => new Set(monthlyEntries.filter((item) => item.entry_type === 'receivable' && item.quote_request_id).map((item) => item.quote_request_id as string)), [monthlyEntries])
  const billingCandidates = useMemo(() => data.drafts.filter((draft) => draft.commercial_status === 'approved' && !entryRequestIds.has(draft.request_id)), [data.drafts, entryRequestIds])
  const receivables = useMemo(() => monthlyEntries.filter((item) => item.entry_type === 'receivable' && item.status !== 'cancelled'), [monthlyEntries])
  const openReceivables = useMemo(() => receivables.filter((item) => item.status !== 'paid'), [receivables])
  const paidReceivables = useMemo(() => receivables.filter((item) => item.status === 'paid'), [receivables])
  const payables = useMemo(() => monthlyEntries.filter((item) => item.entry_type === 'payable' && item.status !== 'cancelled'), [monthlyEntries])
  const openPayables = useMemo(() => payables.filter((item) => item.status !== 'paid'), [payables])
  const paidPayables = useMemo(() => payables.filter((item) => item.status === 'paid'), [payables])

  const fallbackMetrics = useMemo<FinanceMetrics>(() => {
    const outstanding = openReceivables.reduce((sum, item) => sum + Math.max(0, Number(item.gross_amount) - Number(item.paid_amount)), 0)
    const payable = openPayables.reduce((sum, item) => sum + Math.max(0, Number(item.gross_amount) - Number(item.paid_amount)), 0)
    const projected = outstanding - payable
    const overdueReceivable = openReceivables.filter((item) => item.status === 'overdue').reduce((sum, item) => sum + Math.max(0, Number(item.gross_amount) - Number(item.paid_amount)), 0)
    const overduePayable = openPayables.filter((item) => item.status === 'overdue').reduce((sum, item) => sum + Math.max(0, Number(item.gross_amount) - Number(item.paid_amount)), 0)
    const reserve = openReceivables.reduce((sum, item) => sum + Number(item.tax_reserve_amount || 0), 0)
    const month = new Date().toISOString().slice(0, 7)
    const receivedMonth = data.settlements.filter((item) => item.settled_at.startsWith(month) && entryById.get(item.entry_id)?.entry_type === 'receivable').reduce((sum, item) => sum + Number(item.amount), 0)
    return { outstanding, payable, projected, overdueReceivable, overduePayable, reserve, receivedMonth }
  }, [data.settlements, entryById, openPayables, openReceivables])
  const metrics = data.competence === selectedCompetence ? (data.metrics ?? fallbackMetrics) : fallbackMetrics

  if (checking || !session) return <section className="finance-loading">Validando acesso financeiro…</section>

  const previousEntries = data.previousEntries ?? []
  const previousBalance = previousEntries.reduce((sum, item) => sum + Math.max(0, Number(item.gross_amount) - Number(item.paid_amount)), 0)

  return <section className="finance-page">
    <header className="finance-page-header">
      <div><span>FINANCEIRO • CONTROLE OPERACIONAL</span><h1>Receitas, despesas e fluxo previsto</h1><p>Propostas aprovadas alimentam o faturamento e as contas a receber. Despesas entram no mesmo ledger oficial, com baixa, conta financeira e comprovante.</p></div>
      <div className="finance-header-actions"><button type="button" onClick={() => void load()} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</button><button type="button" className="is-primary" onClick={() => setPayableOpen(true)}>+ Nova despesa</button></div>
    </header>

    <section className="finance-competence" aria-label="Competência financeira">
      <button type="button" aria-label="Mês anterior" onClick={() => selectCompetence(moveCompetence(selectedCompetence, -1))}>‹</button>
      <label><span>COMPETÊNCIA</span><input aria-label="Selecionar competência" type="month" value={selectedCompetence} onChange={(event) => selectCompetence(event.target.value)} /></label>
      <button type="button" aria-label="Próximo mês" onClick={() => selectCompetence(moveCompetence(selectedCompetence, 1))}>›</button>
      <button type="button" className="is-today" onClick={() => selectCompetence(new Date().toISOString().slice(0, 7))}>Hoje</button>
      <span className={`finance-period-status is-${data.period?.status || 'open'}`}>{data.period?.status === 'closed' ? `Fechado${data.period.closed_at ? ` em ${date(data.period.closed_at)}` : ''}` : 'Aberto'}</span>
      <button type="button" className="is-period-action" onClick={() => void togglePeriod()}>{data.period?.status === 'closed' ? 'Reabrir mês' : 'Fechar mês'}</button>
    </section>

    {error && <div className="finance-error" role="alert">{error}</div>}

    <div className="finance-metrics">
      <article><span>A receber</span><strong>{currency.format(metrics.outstanding)}</strong><small>{competenceLabel(selectedCompetence)}</small></article>
      <article><span>A pagar</span><strong>{currency.format(metrics.payable)}</strong><small>{competenceLabel(selectedCompetence)}</small></article>
      <article><span>Saldo previsto</span><strong>{currency.format(metrics.projected)}</strong><small>A receber menos A pagar</small></article>
      <article><span>Impostos a reservar</span><strong>{currency.format(metrics.reserve)}</strong><small>Reserva das propostas faturadas</small></article>
      <article><span>Recebido no mês</span><strong>{currency.format(metrics.receivedMonth)}</strong><small>Baixas de recebíveis no período</small></article>
      <article><span>Vencidos</span><strong>{currency.format(metrics.overdueReceivable + metrics.overduePayable)}</strong><small>Receber {currency.format(metrics.overdueReceivable)} • pagar {currency.format(metrics.overduePayable)}</small></article>
    </div>

    <nav className="finance-tabs" aria-label="Áreas do financeiro">
      <button className={view === 'billing' ? 'is-active' : ''} onClick={() => setView('billing')}>Aguardando faturamento <span>{billingCandidates.length}</span></button>
      <button className={view === 'receivables' ? 'is-active' : ''} onClick={() => setView('receivables')}>Contas a receber <span>{openReceivables.length}</span></button>
      <button className={view === 'received' ? 'is-active' : ''} onClick={() => setView('received')}>Recebidos <span>{paidReceivables.length}</span></button>
      <button className={view === 'payables' ? 'is-active' : ''} onClick={() => setView('payables')}>Contas a pagar <span>{openPayables.length}</span></button>
      <button className={view === 'paidPayables' ? 'is-active' : ''} onClick={() => setView('paidPayables')}>Pagos <span>{paidPayables.length}</span></button>
      <button className={view === 'cashflow' ? 'is-active' : ''} onClick={() => setView('cashflow')}>Fluxo de caixa</button>
    </nav>

    {view === 'billing' && <BillingList drafts={billingCandidates} requestById={requestById} clientById={clientById} installments={data.installments} onInvoice={setInvoiceDraft} />}
    {view === 'receivables' && <ReceivablesList entries={openReceivables} requestById={requestById} clientById={clientById} settlements={data.settlements} accounts={data.accounts} onSettle={setSettlementEntry} onEdit={setEditEntry} onOpenReceipt={(path) => void openReceipt(path, setError)} readOnly={data.period?.status === 'closed'} />}
    {view === 'received' && <ReceivablesList entries={paidReceivables} requestById={requestById} clientById={clientById} settlements={data.settlements} accounts={data.accounts} onSettle={() => {}} onEdit={() => {}} onOpenReceipt={(path) => void openReceipt(path, setError)} readOnly />}
    {view === 'payables' && <PayablesList entries={openPayables} settlements={data.settlements} accounts={data.accounts} onSettle={setSettlementEntry} onEdit={setEditEntry} onCancel={setCancelEntry} onOpenReceipt={(path) => void openReceipt(path, setError)} readOnly={data.period?.status === 'closed'} />}
    {view === 'paidPayables' && <PayablesList entries={paidPayables} settlements={data.settlements} accounts={data.accounts} onSettle={() => {}} onEdit={() => {}} onCancel={() => {}} onOpenReceipt={(path) => void openReceipt(path, setError)} readOnly />}
    {view === 'cashflow' && <CashFlowView entries={monthlyEntries} settlements={data.settlements} accounts={data.accounts} requestById={requestById} clientById={clientById} />}

    {previousEntries.length > 0 && <details className="finance-previous"><summary>Pendências anteriores <strong>{previousEntries.length} contas • {currency.format(previousBalance)}</strong></summary><div>{previousEntries.map((entry) => <span key={entry.id}>{entry.description} · {date(entry.due_date)} · {currency.format(Math.max(0, Number(entry.gross_amount) - Number(entry.paid_amount)))}</span>)}</div></details>}

    <footer className="finance-page-footer"><span>Todos os lançamentos usam o ledger financeiro oficial da HRX e exigem sessão administrativa com MFA/AAL2.</span><button type="button" onClick={() => setAccountOpen(true)}>Configurar contas financeiras</button></footer>

    {invoiceDraft && <InvoiceModal session={session} draft={invoiceDraft} request={requestById.get(invoiceDraft.request_id)} installments={data.installments.filter((item) => item.draft_id === invoiceDraft.id)} onClose={() => setInvoiceDraft(null)} onDone={async () => { setInvoiceDraft(null); await load(session); setView('receivables') }} onError={setError} />}
    {payableOpen && <PayableModal session={session} onClose={() => setPayableOpen(false)} onDone={async () => { setPayableOpen(false); await load(session); setView('payables') }} onError={setError} />}
    {settlementEntry && <SettlementModal session={session} entry={settlementEntry} accounts={data.accounts.filter((item) => item.active)} onClose={() => setSettlementEntry(null)} onNeedAccount={() => setAccountOpen(true)} onDone={async () => { const type = settlementEntry.entry_type; setSettlementEntry(null); await load(session); setView(type === 'payable' ? 'payables' : 'receivables') }} onError={setError} />}
    {cancelEntry && <CancelPayableModal session={session} entry={cancelEntry} onClose={() => setCancelEntry(null)} onDone={async () => { setCancelEntry(null); await load(session); setView('payables') }} onError={setError} />}
    {accountOpen && <AccountModal session={session} onClose={() => setAccountOpen(false)} onDone={async () => { setAccountOpen(false); await load(session) }} onError={setError} />}
    {editEntry && <EditEntryModal session={session} entry={editEntry} onClose={() => setEditEntry(null)} onDone={async () => { setEditEntry(null); await load(session, selectedCompetence) }} onError={setError} />}
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

function ReceivablesList({ entries, requestById, clientById, settlements, accounts, onSettle, onEdit, onOpenReceipt, readOnly = false }: { entries: FinancialEntry[]; requestById: Map<string, Request>; clientById: Map<string, Client>; settlements: Settlement[]; accounts: FinancialAccount[]; onSettle: (entry: FinancialEntry) => void; onEdit: (entry: FinancialEntry) => void; onOpenReceipt: (path: string) => void; readOnly?: boolean }) {
  const accountById = new Map(accounts.map((item) => [item.id, item]))
  if (!entries.length) return <EmptyState title={readOnly ? 'Nenhum recebimento concluído' : 'Nenhum recebível em aberto'} text={readOnly ? 'As parcelas quitadas aparecerão aqui.' : 'Registre o faturamento de uma proposta aprovada para criar as parcelas.'} />
  return <div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Lançamento</th><th>Tipo / competência</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>{entries.map((entry) => {
    const request = entry.quote_request_id ? requestById.get(entry.quote_request_id) : undefined
    const client = entry.client_id ? clientById.get(entry.client_id) : undefined
    const entrySettlements = settlements.filter((item) => item.entry_id === entry.id)
    const latest = entrySettlements[0]
    const remaining = Math.max(0, Number(entry.gross_amount) - Number(entry.paid_amount))
    const statusLabel = entry.status === 'paid' ? 'Recebido' : entry.status === 'partial' ? 'Recebido parcial' : entry.status === 'overdue' ? (Number(entry.paid_amount) > 0 ? 'Vencido • parcial' : 'Vencido') : 'A receber'
    const installmentTotal = entry.installment_total || entries.filter((item) => item.quote_request_id && item.quote_request_id === entry.quote_request_id).length
    return <tr key={entry.id}><td data-label="Lançamento"><strong>{client?.company || client?.name || request?.company || request?.name || 'Lançamento'}</strong><small>{request?.proposal_number || entry.description}</small></td><td data-label="Tipo">{entry.installment_number ? `Parcela ${entry.installment_number} de ${installmentTotal}` : entry.entry_kind === 'recurrence_occurrence' ? 'Recorrente mensal' : 'Único'}<small>{entry.competence_date?.slice(0, 7)}</small></td><td data-label="Vencimento">{date(entry.due_date)}</td><td data-label="Valor"><strong>{currency.format(Number(entry.gross_amount))}</strong><small>Saldo {currency.format(remaining)}</small></td><td data-label="Status"><span className={`finance-status is-${entry.status}`}>{statusLabel}</span></td><td data-label="Ações"><div className="finance-row-actions">{!readOnly && <button type="button" onClick={() => onSettle(entry)}>Registrar recebimento</button>}{!readOnly && <button type="button" className="is-secondary" onClick={() => onEdit(entry)}>Editar</button>}{latest?.receipt_object_path && <button type="button" className="is-secondary" onClick={() => onOpenReceipt(latest.receipt_object_path!)}>Comprovante</button>}</div></td></tr>
  })}</tbody></table></div>
}

function PayablesList({ entries, settlements, accounts, onSettle, onEdit, onCancel, onOpenReceipt, readOnly = false }: { entries: FinancialEntry[]; settlements: Settlement[]; accounts: FinancialAccount[]; onSettle: (entry: FinancialEntry) => void; onEdit: (entry: FinancialEntry) => void; onCancel: (entry: FinancialEntry) => void; onOpenReceipt: (path: string) => void; readOnly?: boolean }) {
  const accountById = new Map(accounts.map((item) => [item.id, item]))
  if (!entries.length) return <EmptyState title={readOnly ? 'Nenhuma despesa paga' : 'Nenhuma conta a pagar'} text={readOnly ? 'As despesas quitadas aparecerão aqui.' : 'Use “Nova despesa” para registrar compromissos, fornecedores e vencimentos.'} />
  return <div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Lançamento</th><th>Tipo / competência</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>{entries.map((entry) => {
    const entrySettlements = settlements.filter((item) => item.entry_id === entry.id)
    const latest = entrySettlements[0]
    const remaining = Math.max(0, Number(entry.gross_amount) - Number(entry.paid_amount))
    const statusLabel = entry.status === 'paid' ? 'Pago' : entry.status === 'partial' ? 'Pago parcial' : entry.status === 'overdue' ? (Number(entry.paid_amount) > 0 ? 'Vencido • parcial' : 'Vencido') : 'A pagar'
    return <tr key={entry.id}><td data-label="Lançamento"><strong>{entry.counterparty_name || 'Favorecido'}</strong><small>{entry.description}</small></td><td data-label="Tipo">{entry.installment_number ? `Parcela ${entry.installment_number} de ${entry.installment_total || '?'}` : entry.entry_kind === 'recurrence_occurrence' ? 'Recorrente mensal' : 'Único'}<small>{entry.competence_date?.slice(0, 7)}</small></td><td data-label="Vencimento">{date(entry.due_date)}</td><td data-label="Valor"><strong>{currency.format(Number(entry.gross_amount))}</strong><small>Saldo {currency.format(remaining)}</small></td><td data-label="Status"><span className={`finance-status is-${entry.status}`}>{statusLabel}</span></td><td data-label="Ações"><div className="finance-row-actions">{!readOnly && <button type="button" onClick={() => onSettle(entry)}>Registrar pagamento</button>}{!readOnly && <button type="button" className="is-secondary" onClick={() => onEdit(entry)}>Editar</button>}{!readOnly && Number(entry.paid_amount) === 0 && <button type="button" className="is-danger" onClick={() => onCancel(entry)}>Cancelar</button>}{latest?.receipt_object_path && <button type="button" className="is-secondary" onClick={() => onOpenReceipt(latest.receipt_object_path!)}>Comprovante</button>}</div></td></tr>
  })}</tbody></table></div>
}

function CashFlowView({ entries, settlements, accounts, requestById, clientById }: { entries: FinancialEntry[]; settlements: Settlement[]; accounts: FinancialAccount[]; requestById: Map<string, Request>; clientById: Map<string, Client> }) {
  const [accountId, setAccountId] = useState('all')
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7))
  const entryById = useMemo(() => new Map(entries.map((item) => [item.id, item])), [entries])
  const accountById = useMemo(() => new Map(accounts.map((item) => [item.id, item])), [accounts])
  const periodStart = `${period}-01`
  const periodLabel = useMemo(() => new Date(`${period}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), [period])

  const filteredSettlements = useMemo(() => settlements.filter((item) => accountId === 'all' || item.account_id === accountId), [accountId, settlements])
  const periodSettlements = useMemo(() => filteredSettlements.filter((item) => item.settled_at.startsWith(period)).sort((a, b) => b.settled_at.localeCompare(a.settled_at)), [filteredSettlements, period])
  const opening = useMemo(() => filteredSettlements.filter((item) => item.settled_at.slice(0, 10) < periodStart).reduce((sum, item) => {
    const entry = entryById.get(item.entry_id)
    return sum + (entry?.entry_type === 'payable' ? -Number(item.amount) : Number(item.amount))
  }, 0), [entryById, filteredSettlements, periodStart])
  const inflow = useMemo(() => periodSettlements.filter((item) => entryById.get(item.entry_id)?.entry_type === 'receivable').reduce((sum, item) => sum + Number(item.amount), 0), [entryById, periodSettlements])
  const outflow = useMemo(() => periodSettlements.filter((item) => entryById.get(item.entry_id)?.entry_type === 'payable').reduce((sum, item) => sum + Number(item.amount), 0), [entryById, periodSettlements])
  const closing = opening + inflow - outflow
  const accumulated = useMemo(() => filteredSettlements.reduce((sum, item) => {
    const entry = entryById.get(item.entry_id)
    return sum + (entry?.entry_type === 'payable' ? -Number(item.amount) : Number(item.amount))
  }, 0), [entryById, filteredSettlements])

  const projectedEntries = useMemo(() => entries.filter((item) => item.status !== 'cancelled' && item.status !== 'paid' && item.due_date.startsWith(period)), [entries, period])
  const projectedIn = useMemo(() => projectedEntries.filter((item) => item.entry_type === 'receivable').reduce((sum, item) => sum + Math.max(0, Number(item.gross_amount) - Number(item.paid_amount)), 0), [projectedEntries])
  const projectedOut = useMemo(() => projectedEntries.filter((item) => item.entry_type === 'payable').reduce((sum, item) => sum + Math.max(0, Number(item.gross_amount) - Number(item.paid_amount)), 0), [projectedEntries])

  const accountSummaries = useMemo(() => accounts.filter((item) => item.active || settlements.some((settlement) => settlement.account_id === item.id)).map((account) => {
    const accountSettlements = settlements.filter((item) => item.account_id === account.id)
    const received = accountSettlements.filter((item) => entryById.get(item.entry_id)?.entry_type === 'receivable').reduce((sum, item) => sum + Number(item.amount), 0)
    const paid = accountSettlements.filter((item) => entryById.get(item.entry_id)?.entry_type === 'payable').reduce((sum, item) => sum + Number(item.amount), 0)
    return { account, received, paid, balance: received - paid }
  }).sort((a, b) => a.account.sort_order - b.account.sort_order || a.account.name.localeCompare(b.account.name)), [accounts, entryById, settlements])

  return <div className="finance-cashflow">
    <div className="finance-cashflow-notice"><strong>Fluxo de caixa registrado no HRX</strong><span>Este painel não representa saldo bancário nem faz conciliação automática. O saldo parte de zero e considera somente recebimentos e pagamentos efetivamente baixados no HRX.</span></div>
    <div className="finance-cashflow-toolbar">
      <label>Período<input type="month" value={period} onChange={(event) => setPeriod(event.target.value || new Date().toISOString().slice(0, 7))} /></label>
      <label>Conta financeira<select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="all">Todas as contas</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.active ? '' : ' • inativa'}</option>)}</select></label>
      <div><span>Referência</span><strong>{periodLabel}</strong></div>
    </div>
    <div className="finance-cashflow-metrics">
      <article><span>Saldo inicial registrado</span><strong>{currency.format(opening)}</strong><small>Movimento acumulado antes do período</small></article>
      <article><span>Entradas realizadas</span><strong>{currency.format(inflow)}</strong><small>Recebimentos baixados no período</small></article>
      <article><span>Saídas realizadas</span><strong>{currency.format(outflow)}</strong><small>Pagamentos baixados no período</small></article>
      <article><span>Saldo final registrado</span><strong>{currency.format(closing)}</strong><small>Saldo inicial + entradas − saídas</small></article>
      <article><span>Acumulado no HRX</span><strong>{currency.format(accumulated)}</strong><small>Desde o primeiro lançamento baixado</small></article>
    </div>
    <div className="finance-cashflow-projection">
      <div><span>Previsto a receber no período</span><strong>{currency.format(projectedIn)}</strong></div>
      <div><span>Previsto a pagar no período</span><strong>{currency.format(projectedOut)}</strong></div>
      <div><span>Resultado previsto</span><strong>{currency.format(projectedIn - projectedOut)}</strong></div>
      <p>A previsão usa os vencimentos ainda abertos e é geral. Ela não é atribuída a uma conta financeira até a baixa do lançamento.</p>
    </div>
    <section className="finance-cashflow-section"><header><div><span>MOVIMENTAÇÕES REALIZADAS</span><h2>{periodLabel}</h2></div><small>{periodSettlements.length} movimentação(ões)</small></header>
      {!periodSettlements.length ? <EmptyState title="Nenhuma movimentação no período" text="Recebimentos e pagamentos aparecerão aqui depois que forem efetivamente baixados no Financeiro." /> : <div className="finance-table-wrap"><table className="finance-table finance-cashflow-table"><thead><tr><th>Data</th><th>Descrição</th><th>Conta</th><th>Tipo</th><th>Forma</th><th>Valor</th></tr></thead><tbody>{periodSettlements.map((settlement) => {
        const entry = entryById.get(settlement.entry_id)
        const request = entry?.quote_request_id ? requestById.get(entry.quote_request_id) : undefined
        const client = entry?.client_id ? clientById.get(entry.client_id) : undefined
        const isPayable = entry?.entry_type === 'payable'
        const title = isPayable ? (entry?.counterparty_name || entry?.description || 'Pagamento') : (client?.company || client?.name || request?.company || request?.name || entry?.description || 'Recebimento')
        const detail = isPayable ? entry?.description : (request?.proposal_number || entry?.description)
        return <tr key={settlement.id}><td data-label="Data"><strong>{new Date(settlement.settled_at).toLocaleDateString('pt-BR')}</strong></td><td data-label="Descrição"><strong>{title}</strong><small>{detail}</small></td><td data-label="Conta">{accountById.get(settlement.account_id)?.name || 'Conta'}</td><td data-label="Tipo"><span className={`finance-cashflow-kind ${isPayable ? 'is-out' : 'is-in'}`}>{isPayable ? 'Saída' : 'Entrada'}</span></td><td data-label="Forma">{settlement.payment_method || '—'}</td><td data-label="Valor"><strong className={isPayable ? 'finance-value-out' : 'finance-value-in'}>{isPayable ? '− ' : '+ '}{currency.format(Number(settlement.amount))}</strong></td></tr>
      })}</tbody></table></div>}
    </section>
    <section className="finance-cashflow-section"><header><div><span>RESUMO POR CONTA</span><h2>Movimento acumulado registrado</h2></div></header>
      {!accountSummaries.length ? <EmptyState title="Nenhuma conta financeira cadastrada" text="Cadastre uma conta financeira para organizar recebimentos e pagamentos por origem ou destino." /> : <div className="finance-account-summary">{accountSummaries.map(({ account, received, paid, balance }) => <article key={account.id}><div><strong>{account.name}</strong><small>{account.active ? 'Ativa' : 'Inativa'}</small></div><span>Entradas <strong>{currency.format(received)}</strong></span><span>Saídas <strong>{currency.format(paid)}</strong></span><span>Saldo registrado <strong>{currency.format(balance)}</strong></span></article>)}</div>}
    </section>
  </div>
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
      const messages: Record<string, string> = { receivables_already_exist: 'Esta proposta já possui recebíveis vinculados.', payment_schedule_mismatch: 'O cronograma de parcelas não fecha com o valor aprovado.', approved_payment_schedule_mismatch: 'A versão aprovada e o cronograma de parcelas estão divergentes. O faturamento foi bloqueado para evitar valor incorreto.', invoice_data_required: 'Informe o número e a data da nota/fatura.' }
      onError(messages[code] || 'Não foi possível registrar o faturamento.')
    } finally { setBusy(false) }
  }
  return <div className="finance-modal-backdrop"><form className="finance-modal" onSubmit={submit}><header><div><span>FATURAMENTO</span><h2>{request?.proposal_number || 'Proposta aprovada'}</h2><p>O HRX não emite nota fiscal nesta fase. Informe o documento já emitido para criar oficialmente as contas a receber.</p></div><button type="button" onClick={onClose}>×</button></header><div className="finance-modal-body"><label>Número da nota/fatura<input autoFocus value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Ex.: NFS-e 1234" /></label><label>Data de emissão<input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} /></label><div className="finance-modal-summary"><span>Valor aprovado <strong>{currency.format(Number(draft.final_amount))}</strong></span><span>Parcelas <strong>{installments.length}</strong></span><span>Reserva tributária <strong>{currency.format(Number(draft.tax_amount || 0))}</strong></span></div></div><footer><button type="button" className="is-secondary" onClick={onClose}>Cancelar</button><button disabled={busy || !invoiceNumber.trim()}>{busy ? 'Registrando…' : 'Criar contas a receber'}</button></footer></form></div>
}

function PayableModal({ session, onClose, onDone, onError }: { session: Session; onClose: () => void; onDone: () => Promise<void>; onError: (value: string) => void }) {
  const [counterpartyName, setCounterpartyName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(expenseCategories[0])
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState(today())
  const [competenceDate, setCompetenceDate] = useState(today())
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const numericAmount = Number(amount.replace(/\./g, '').replace(',', '.'))
    if (counterpartyName.trim().length < 2 || description.trim().length < 2 || !category.trim() || !numericAmount || numericAmount <= 0 || !dueDate) { onError('Preencha favorecido, descrição, categoria, valor e vencimento.'); return }
    setBusy(true)
    try {
      await financeFetch(session, { action: 'create_payable', counterpartyName: counterpartyName.trim(), description: description.trim(), category: category.trim(), amount: numericAmount, dueDate, competenceDate, referenceNumber: referenceNumber.trim() || null, notes: notes.trim() || null })
      await onDone()
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : ''
      onError(code === 'payable_data_required' ? 'Revise os dados obrigatórios da despesa.' : 'Não foi possível criar a conta a pagar.')
    } finally { setBusy(false) }
  }
  return <div className="finance-modal-backdrop"><form className="finance-modal" onSubmit={submit}><header><div><span>CONTAS A PAGAR</span><h2>Nova despesa</h2><p>O lançamento entra no ledger oficial da HRX e poderá ser liquidado parcial ou integralmente com conta financeira e comprovante.</p></div><button type="button" onClick={onClose}>×</button></header><div className="finance-modal-body"><label>Favorecido / fornecedor<input autoFocus value={counterpartyName} onChange={(event) => setCounterpartyName(event.target.value)} placeholder="Ex.: fornecedor ou prestador" /></label><label>Categoria<select value={category} onChange={(event) => setCategory(event.target.value)}>{expenseCategories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="is-wide">Descrição<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Assinatura mensal da ferramenta" /></label><label>Valor<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" /></label><label>Vencimento<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label>Competência<input type="date" value={competenceDate} onChange={(event) => setCompetenceDate(event.target.value)} /></label><label>Documento / referência<input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} placeholder="Opcional" /></label><label className="is-wide">Observações<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Informação interna opcional." /></label></div><footer><button type="button" className="is-secondary" onClick={onClose}>Cancelar</button><button disabled={busy}>{busy ? 'Salvando…' : 'Criar conta a pagar'}</button></footer></form></div>
}

function SettlementModal({ session, entry, accounts, onClose, onNeedAccount, onDone, onError }: { session: Session; entry: FinancialEntry; accounts: FinancialAccount[]; onClose: () => void; onNeedAccount: () => void; onDone: () => Promise<void>; onError: (value: string) => void }) {
  const isPayable = entry.entry_type === 'payable'
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
    if (!numericAmount || numericAmount <= 0 || numericAmount > remaining + .001) { onError(`Informe um valor de ${isPayable ? 'pagamento' : 'recebimento'} válido, limitado ao saldo do lançamento.`); return }
    if (!accountId) { onError(`Cadastre e selecione a conta de ${isPayable ? 'pagamento' : 'recebimento'}.`); return }
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
      const messages: Record<string, string> = { receipt_upload_failed: 'Não foi possível enviar o comprovante.', settlement_above_balance: 'O valor informado ultrapassa o saldo atual.', account_required: 'A conta financeira não está disponível.' }
      onError(messages[code] || `Não foi possível registrar o ${isPayable ? 'pagamento' : 'recebimento'}.`)
    } finally { setBusy(false) }
  }

  return <div className="finance-modal-backdrop"><form className="finance-modal" onSubmit={submit}><header><div><span>BAIXA FINANCEIRA</span><h2>Registrar {isPayable ? 'pagamento' : 'recebimento'}</h2><p>O comprovante é recomendado, mas não bloqueia a baixa. Toda movimentação fica vinculada ao lançamento e à conta financeira selecionada.</p></div><button type="button" onClick={onClose}>×</button></header><div className="finance-modal-body"><div className="finance-modal-summary"><span>Valor do lançamento <strong>{currency.format(Number(entry.gross_amount))}</strong></span><span>Já {isPayable ? 'pago' : 'recebido'} <strong>{currency.format(Number(entry.paid_amount))}</strong></span><span>Saldo <strong>{currency.format(remaining)}</strong></span></div><label>Valor {isPayable ? 'pago' : 'recebido'}<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Data do {isPayable ? 'pagamento' : 'recebimento'}<input type="date" value={settledAt} onChange={(event) => setSettledAt(event.target.value)} /></label><label>Conta de {isPayable ? 'pagamento' : 'recebimento'}<select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Selecione…</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>{!accounts.length && <button type="button" className="finance-inline-action" onClick={onNeedAccount}>+ Cadastrar conta financeira</button>}<label>Forma<select value={method} onChange={(event) => setMethod(event.target.value)}><option value="pix">PIX</option><option value="transferencia">Transferência</option><option value="boleto">Boleto</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option><option value="outro">Outro</option></select></label><label className="is-wide">Comprovante<input type="file" accept="application/pdf,image/*" onChange={(event) => setFile(event.target.files?.[0] || null)} /><small>{file ? `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Opcional. PDF ou imagem, até 15 MB.'}</small></label><label className="is-wide">Observação<textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder={isPayable ? 'Ex.: Pagamento confirmado no extrato.' : 'Ex.: Recebimento confirmado via extrato.'} /></label></div><footer><button type="button" className="is-secondary" onClick={onClose}>Cancelar</button><button disabled={busy}>{busy ? 'Registrando…' : `Confirmar ${isPayable ? 'pagamento' : 'recebimento'}`}</button></footer></form></div>
}

function CancelPayableModal({ session, entry, onClose, onDone, onError }: { session: Session; entry: FinancialEntry; onClose: () => void; onDone: () => Promise<void>; onError: (value: string) => void }) {
  const [busy, setBusy] = useState(false)
  const confirm = async () => {
    setBusy(true)
    try { await financeFetch(session, { action: 'cancel_entry', entryId: entry.id }); await onDone() }
    catch (cause) {
      const code = cause instanceof Error ? cause.message : ''
      const messages: Record<string, string> = { entry_has_settlements: 'Esta despesa já possui pagamento registrado e não pode ser cancelada por este fluxo.', entry_not_cancellable: 'Este lançamento não pode ser cancelado.' }
      onError(messages[code] || 'Não foi possível cancelar a despesa.')
    } finally { setBusy(false) }
  }
  return <div className="finance-modal-backdrop"><div className="finance-modal is-small"><header><div><span>CONTAS A PAGAR</span><h2>Cancelar despesa?</h2><p>{entry.counterparty_name || 'Favorecido'} • {entry.description}</p></div><button type="button" onClick={onClose}>×</button></header><div className="finance-modal-body"><div className="finance-cancel-warning">O lançamento será mantido no histórico com status cancelado. Despesas com pagamentos já registrados não podem ser canceladas por este fluxo.</div></div><footer><button type="button" className="is-secondary" onClick={onClose}>Manter</button><button type="button" className="is-danger" disabled={busy} onClick={() => void confirm()}>{busy ? 'Cancelando…' : 'Cancelar despesa'}</button></footer></div></div>
}

function EditEntryModal({ session, entry, onClose, onDone, onError }: { session: Session; entry: FinancialEntry; onClose: () => void; onDone: () => Promise<void>; onError: (value: string) => void }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ counterpartyName: entry.counterparty_name || '', description: entry.description, category: entry.category || '', amount: String(entry.gross_amount), competenceDate: entry.competence_date?.slice(0, 10) || entry.due_date, dueDate: entry.due_date, referenceNumber: entry.invoice_number || '', notes: entry.notes || '' })
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); onError('')
    try {
      await financeFetch(session, { action: 'update_entry', entryId: entry.id, expectedUpdatedAt: entry.updated_at, ...form, amount: Number(form.amount) })
      await onDone()
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : ''
      onError(code === 'gross_amount_below_paid_amount' ? 'O valor total não pode ser menor que o valor já pago.' : code === 'financial_period_closed' ? 'A competência está fechada e precisa ser reaberta antes da edição.' : code === 'entry_changed_reload' ? 'Este lançamento mudou. Atualize a tela antes de editar novamente.' : 'Não foi possível editar o lançamento.')
    } finally { setSaving(false) }
  }
  return <div className="finance-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="finance-modal" onSubmit={submit}><header><div><span>EDITAR LANÇAMENTO</span><h2>{entry.description}</h2><p>{entry.entry_kind === 'recurrence_occurrence' ? 'Ocorrência recorrente' : entry.installment_number ? `Parcela ${entry.installment_number} de ${entry.installment_total || '?'}` : 'Lançamento único'} · Pago {currency.format(Number(entry.paid_amount))} · Saldo {currency.format(Math.max(0, Number(entry.gross_amount) - Number(entry.paid_amount)))}</p></div><button type="button" onClick={onClose}>×</button></header><div className="finance-form-grid"><label>Favorecido<input value={form.counterpartyName} onChange={(event) => update('counterpartyName', event.target.value)} /></label><label>Descrição<input required value={form.description} onChange={(event) => update('description', event.target.value)} /></label><label>Categoria<input value={form.category} onChange={(event) => update('category', event.target.value)} /></label><label>Valor total<input required type="number" min={Number(entry.paid_amount)} step="0.01" value={form.amount} onChange={(event) => update('amount', event.target.value)} /></label><label>Competência<input required type="date" value={form.competenceDate} onChange={(event) => update('competenceDate', event.target.value)} /></label><label>Vencimento<input required type="date" value={form.dueDate} onChange={(event) => update('dueDate', event.target.value)} /></label><label>Referência<input value={form.referenceNumber} onChange={(event) => update('referenceNumber', event.target.value)} /></label><label className="is-wide">Observações<textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label></div><footer><button type="button" className="is-secondary" onClick={onClose}>Cancelar</button><button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button></footer></form></div>
}

function AccountModal({ session, onClose, onDone, onError }: { session: Session; onClose: () => void; onDone: () => Promise<void>; onError: (value: string) => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); if (name.trim().length < 2) return; setBusy(true); try { await financeFetch(session, { action: 'add_account', name: name.trim() }); await onDone() } catch (cause) { onError(cause instanceof Error && cause.message === 'account_already_exists' ? 'Essa conta já está cadastrada.' : 'Não foi possível cadastrar a conta.'); } finally { setBusy(false) } }
  return <div className="finance-modal-backdrop"><form className="finance-modal is-small" onSubmit={submit}><header><div><span>CONFIGURAÇÃO</span><h2>Nova conta financeira</h2><p>Use o nome que você reconhece no dia a dia. A mesma conta pode ser usada em recebimentos ou pagamentos.</p></div><button type="button" onClick={onClose}>×</button></header><div className="finance-modal-body"><label>Nome da conta<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Conta PJ principal" /></label></div><footer><button type="button" className="is-secondary" onClick={onClose}>Cancelar</button><button disabled={busy || name.trim().length < 2}>{busy ? 'Salvando…' : 'Cadastrar'}</button></footer></form></div>
}

function EmptyState({ title, text }: { title: string; text: string }) { return <div className="finance-empty"><strong>{title}</strong><span>{text}</span></div> }

async function openReceipt(path: string, onError: (value: string) => void) {
  const { data, error } = await hrxSupabase.storage.from('hrx-documents').createSignedUrl(path, 600)
  if (error || !data?.signedUrl) { onError('Não foi possível abrir o comprovante.'); return }
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}
