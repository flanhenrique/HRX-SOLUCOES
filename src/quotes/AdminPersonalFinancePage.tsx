import { FormEvent, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Session } from '@supabase/supabase-js'
import { hrxSupabase } from './supabaseClient'
import './admin-finance.css'
import './admin-finance-scope.css'

type PersonalEntry = {
  id: string
  owner_user_id: string
  status: 'open' | 'paid' | 'cancelled'
  counterparty_name: string
  description: string
  category: string
  gross_amount: number
  paid_amount: number
  due_date: string
  competence_date?: string | null
  reference_number?: string | null
  notes?: string | null
  paid_at?: string | null
  payment_method?: string | null
  created_at: string
  updated_at: string
}

type PersonalView = 'open' | 'paid'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const today = () => new Date().toISOString().slice(0, 10)
const currentMonth = () => new Date().toISOString().slice(0, 7)
const formatDate = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—'
const formatCompetence = (value?: string | null) => {
  if (!value) return '—'
  const key = value.slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(key)) return '—'
  return new Date(`${key}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')
}
const competenceKey = (entry: PersonalEntry) => (entry.competence_date || entry.due_date).slice(0, 7)
const categories = ['Moradia', 'Água', 'Energia', 'Internet', 'Telefonia', 'Assinaturas', 'Academia', 'Parcelamentos', 'Cartão', 'Transporte', 'Saúde', 'Outros']

function initialCompetence() {
  const search = new URLSearchParams(window.location.search)
  const requested = search.get('competencia') || ''
  return /^\d{4}-\d{2}$/.test(requested) ? requested : currentMonth()
}

function shiftMonth(value: string, amount: number) {
  const date = new Date(`${value}-01T12:00:00`)
  date.setMonth(date.getMonth() + amount)
  return date.toISOString().slice(0, 7)
}

function derivedStatus(entry: PersonalEntry) {
  if (entry.status === 'paid') return { label: 'Pago', className: 'is-paid' }
  if (entry.due_date < today()) return { label: 'Vencido', className: 'is-overdue' }
  return { label: 'A pagar', className: 'is-open' }
}

function installmentLabel(entry: PersonalEntry) {
  const reference = entry.reference_number || ''
  const match = reference.match(/(?:^|[-_\s])(\d+)\/(\d+)(?:$|[-_\s])/)
  if (entry.category === 'Parcelamentos' && match) return `Parcela ${match[1]}/${match[2]}`
  if (entry.category === 'Parcelamentos') return 'Parcelamento'
  return 'Única'
}

function useFinanceModalViewportLock() {
  useEffect(() => {
    document.documentElement.classList.add('hrx-finance-modal-open')
    document.body.classList.add('hrx-finance-modal-open')
    return () => {
      document.documentElement.classList.remove('hrx-finance-modal-open')
      document.body.classList.remove('hrx-finance-modal-open')
    }
  }, [])
}

export default function AdminPersonalFinancePage() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [entries, setEntries] = useState<PersonalEntry[]>([])
  const [view, setView] = useState<PersonalView>('open')
  const [selectedCompetence, setSelectedCompetence] = useState(initialCompetence)
  const [newOpen, setNewOpen] = useState(false)
  const [paymentEntry, setPaymentEntry] = useState<PersonalEntry | null>(null)
  const [editEntry, setEditEntry] = useState<PersonalEntry | null>(null)
  const [cancelEntry, setCancelEntry] = useState<PersonalEntry | null>(null)

  useEffect(() => {
    void hrxSupabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false) })
    const { data: listener } = hrxSupabase.auth.onAuthStateChange((_event, next) => { setSession(next); setChecking(false) })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('competencia', selectedCompetence)
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }, [selectedCompetence])

  const load = async (current = session) => {
    if (!current) return
    setLoading(true)
    setError('')
    const { data, error: queryError } = await hrxSupabase
      .from('personal_financial_entries')
      .select('*')
      .eq('owner_user_id', current.user.id)
      .order('due_date', { ascending: true })
      .order('created_at', { ascending: false })
    if (queryError) {
      setError(queryError.message.toLowerCase().includes('row-level') ? 'Confirme o MFA/AAL2 para acessar suas contas pessoais.' : 'Não foi possível carregar as contas pessoais.')
    } else {
      setEntries((data ?? []) as PersonalEntry[])
    }
    setLoading(false)
  }

  useEffect(() => { if (session) void load(session) }, [session])

  const active = useMemo(() => entries.filter((entry) => entry.status === 'open'), [entries])
  const paid = useMemo(() => entries.filter((entry) => entry.status === 'paid'), [entries])
  const activeInPeriod = useMemo(() => active.filter((entry) => competenceKey(entry) === selectedCompetence), [active, selectedCompetence])
  const paidInPeriod = useMemo(() => paid.filter((entry) => competenceKey(entry) === selectedCompetence), [paid, selectedCompetence])
  const previousPending = useMemo(() => active.filter((entry) => competenceKey(entry) < selectedCompetence), [active, selectedCompetence])
  const previousPendingTotal = useMemo(() => previousPending.reduce((sum, entry) => sum + Math.max(0, Number(entry.gross_amount) - Number(entry.paid_amount)), 0), [previousPending])
  const openTotal = useMemo(() => activeInPeriod.reduce((sum, entry) => sum + Math.max(0, Number(entry.gross_amount) - Number(entry.paid_amount)), 0), [activeInPeriod])
  const overdue = useMemo(() => activeInPeriod.filter((entry) => entry.due_date < today()), [activeInPeriod])
  const overdueTotal = useMemo(() => overdue.reduce((sum, entry) => sum + Math.max(0, Number(entry.gross_amount) - Number(entry.paid_amount)), 0), [overdue])
  const paidTotal = useMemo(() => paidInPeriod.reduce((sum, entry) => sum + Number(entry.paid_amount || entry.gross_amount), 0), [paidInPeriod])
  const periodTotal = openTotal + paidTotal
  const periodLabel = useMemo(() => new Date(`${selectedCompetence}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), [selectedCompetence])

  if (checking || !session) return <section className="finance-loading">Validando acesso financeiro pessoal…</section>

  const visible = view === 'open' ? activeInPeriod : paidInPeriod

  return <section className="finance-page personal-finance-page">
    <header className="finance-page-header">
      <div><span>FINANCEIRO • PESSOAL</span><h1>Contas pessoais</h1><p>Visualize uma competência por vez, edite lançamentos e acompanhe o que pertence de fato a cada mês.</p></div>
      <div className="finance-header-actions"><button type="button" onClick={() => void load()} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</button><button type="button" className="is-primary" onClick={() => setNewOpen(true)}>+ Nova conta</button></div>
    </header>

    <div className="personal-finance-period" aria-label="Competência financeira">
      <div className="personal-finance-period-copy"><span>COMPETÊNCIA</span><strong>{periodLabel}</strong><small>{periodTotal ? `${currency.format(periodTotal)} previsto nesta competência` : 'Sem movimentações nesta competência'}</small></div>
      <div className="personal-finance-period-controls">
        <button type="button" aria-label="Mês anterior" onClick={() => setSelectedCompetence((value) => shiftMonth(value, -1))}>‹</button>
        <input aria-label="Selecionar mês e ano" type="month" value={selectedCompetence} onChange={(event) => event.target.value && setSelectedCompetence(event.target.value)} />
        <button type="button" aria-label="Próximo mês" onClick={() => setSelectedCompetence((value) => shiftMonth(value, 1))}>›</button>
        <button type="button" className="is-today" onClick={() => setSelectedCompetence(currentMonth())}>Mês atual</button>
      </div>
    </div>

    <div className="personal-finance-boundary"><strong>Separação financeira ativa</strong><span>Nenhum valor desta visão entra nos indicadores empresariais da HRX Solutions.</span></div>
    {error && <div className="finance-error" role="alert">{error}</div>}

    <div className="finance-metrics personal-finance-metrics">
      <article><span>A pagar</span><strong>{currency.format(openTotal)}</strong><small>{activeInPeriod.length} conta(s) aberta(s) em {formatCompetence(`${selectedCompetence}-01`)}</small></article>
      <article><span>Pago</span><strong>{currency.format(paidTotal)}</strong><small>{paidInPeriod.length} conta(s) quitada(s) da competência</small></article>
      <article><span>Vencidos no mês</span><strong>{currency.format(overdueTotal)}</strong><small>{overdue.length} conta(s) vencida(s) nesta competência</small></article>
      <article><span>Total da competência</span><strong>{currency.format(periodTotal)}</strong><small>Pago + saldo ainda em aberto</small></article>
    </div>

    {previousPending.length > 0 && <div className="personal-finance-prior"><div><span>PENDÊNCIAS ANTERIORES</span><strong>{previousPending.length} conta(s) • {currency.format(previousPendingTotal)}</strong></div><small>Essas contas continuam pendentes, mas não são misturadas ao total de {periodLabel}.</small></div>}

    <nav className="finance-tabs personal-finance-tabs" aria-label="Contas pessoais">
      <button className={view === 'open' ? 'is-active' : ''} onClick={() => setView('open')}>Contas a pagar <span>{activeInPeriod.length}</span></button>
      <button className={view === 'paid' ? 'is-active' : ''} onClick={() => setView('paid')}>Pagos <span>{paidInPeriod.length}</span></button>
    </nav>

    {!visible.length ? <div className="finance-empty"><strong>{view === 'open' ? `Nenhuma conta em aberto em ${periodLabel}` : `Nenhuma conta paga em ${periodLabel}`}</strong><span>{view === 'open' ? 'Use “Nova conta” para registrar um compromisso nesta competência.' : 'As contas quitadas desta competência aparecerão aqui.'}</span></div> : <div className="finance-table-wrap"><table className="finance-table personal-finance-table"><thead><tr><th>Conta</th><th>Tipo</th><th>Competência</th><th>Vencimento</th><th>Categoria</th><th>Valor do mês</th><th>Status</th><th>Ações</th></tr></thead><tbody>{visible.map((entry) => {
      const status = derivedStatus(entry)
      return <tr key={entry.id}><td data-label="Conta"><strong>{entry.counterparty_name}</strong><small>{entry.description}</small></td><td data-label="Tipo"><strong>{installmentLabel(entry)}</strong><small>{entry.reference_number || 'Lançamento pessoal'}</small></td><td data-label="Competência"><strong>{formatCompetence(entry.competence_date || entry.due_date)}</strong></td><td data-label="Vencimento">{formatDate(entry.due_date)}</td><td data-label="Categoria"><strong>{entry.category}</strong></td><td data-label="Valor do mês"><strong>{currency.format(Number(entry.gross_amount))}</strong>{entry.status === 'paid' && <small>Pago em {formatDate(entry.paid_at)}</small>}</td><td data-label="Status"><span className={`finance-status ${status.className}`}>{status.label}</span></td><td data-label="Ações"><div className="finance-row-actions">{entry.status === 'open' && <button type="button" className="is-secondary" onClick={() => setEditEntry(entry)}>Editar</button>}{entry.status === 'open' && <button type="button" onClick={() => setPaymentEntry(entry)}>Registrar pagamento</button>}{entry.status === 'open' && <button type="button" className="is-danger" onClick={() => setCancelEntry(entry)}>Cancelar</button>}</div></td></tr>
    })}</tbody></table></div>}

    <footer className="finance-page-footer"><span>Dados pessoais protegidos por usuário e MFA/AAL2. A competência selecionada controla tabela e indicadores desta visão.</span></footer>

    {newOpen && <NewPersonalEntryModal session={session} competence={selectedCompetence} onClose={() => setNewOpen(false)} onDone={async () => { setNewOpen(false); await load(session); setView('open') }} onError={setError} />}
    {editEntry && <EditPersonalEntryModal session={session} entry={editEntry} onClose={() => setEditEntry(null)} onDone={async () => { setEditEntry(null); await load(session) }} onError={setError} />}
    {paymentEntry && <PayPersonalEntryModal session={session} entry={paymentEntry} onClose={() => setPaymentEntry(null)} onDone={async () => { setPaymentEntry(null); await load(session); setView('paid') }} onError={setError} />}
    {cancelEntry && <CancelPersonalEntryModal session={session} entry={cancelEntry} onClose={() => setCancelEntry(null)} onDone={async () => { setCancelEntry(null); await load(session) }} onError={setError} />}
  </section>
}

function NewPersonalEntryModal({ session, competence, onClose, onDone, onError }: { session: Session; competence: string; onClose: () => void; onDone: () => Promise<void>; onError: (message: string) => void }) {
  useFinanceModalViewportLock()
  const [counterpartyName, setCounterpartyName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(categories[0])
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState(`${competence}-${String(Math.min(new Date().getDate(), 28)).padStart(2, '0')}`)
  const [competenceDate, setCompetenceDate] = useState(`${competence}-01`)
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const numericAmount = Number(amount.replace(/\./g, '').replace(',', '.'))
    if (counterpartyName.trim().length < 2 || description.trim().length < 2 || numericAmount <= 0 || !dueDate) { onError('Preencha conta/favorecido, descrição, valor e vencimento.'); return }
    setBusy(true)
    const { error } = await hrxSupabase.from('personal_financial_entries').insert({
      owner_user_id: session.user.id,
      status: 'open',
      counterparty_name: counterpartyName.trim(),
      description: description.trim(),
      category,
      gross_amount: numericAmount,
      paid_amount: 0,
      due_date: dueDate,
      competence_date: competenceDate || dueDate,
      reference_number: referenceNumber.trim() || null,
      notes: notes.trim() || null,
    })
    if (error) onError('Não foi possível criar a conta pessoal. Confirme o MFA e revise os dados.')
    else await onDone()
    setBusy(false)
  }

  return createPortal(<div className="finance-modal-backdrop"><form className="finance-modal" onSubmit={submit}><header><div><span>FINANCEIRO PESSOAL</span><h2>Nova conta a pagar</h2><p>O lançamento será criado na competência escolhida e ficará isolado da contabilidade empresarial.</p></div><button type="button" onClick={onClose}>×</button></header><div className="finance-modal-body"><label>Conta / favorecido<input autoFocus value={counterpartyName} onChange={(event) => setCounterpartyName(event.target.value)} placeholder="Ex.: Internet, academia, locador" /></label><label>Categoria<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="is-wide">Descrição<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Mensalidade de setembro" /></label><label>Valor da ocorrência<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" /></label><label>Vencimento<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label>Competência<input type="month" value={competenceDate.slice(0, 7)} onChange={(event) => setCompetenceDate(`${event.target.value || competence}-01`)} /></label><label>Referência<input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} placeholder="Ex.: 4/8 ou AGO-2026" /></label><label className="is-wide">Observações<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Informação pessoal opcional." /></label></div><footer><button type="button" className="is-secondary" onClick={onClose}>Cancelar</button><button disabled={busy}>{busy ? 'Salvando…' : 'Criar conta'}</button></footer></form></div>, document.body)
}

function EditPersonalEntryModal({ session, entry, onClose, onDone, onError }: { session: Session; entry: PersonalEntry; onClose: () => void; onDone: () => Promise<void>; onError: (message: string) => void }) {
  useFinanceModalViewportLock()
  const [counterpartyName, setCounterpartyName] = useState(entry.counterparty_name)
  const [description, setDescription] = useState(entry.description)
  const [category, setCategory] = useState(entry.category)
  const [amount, setAmount] = useState(String(Number(entry.gross_amount).toFixed(2)).replace('.', ','))
  const [dueDate, setDueDate] = useState(entry.due_date.slice(0, 10))
  const [competence, setCompetence] = useState(competenceKey(entry))
  const [referenceNumber, setReferenceNumber] = useState(entry.reference_number || '')
  const [notes, setNotes] = useState(entry.notes || '')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const numericAmount = Number(amount.replace(/\./g, '').replace(',', '.'))
    if (counterpartyName.trim().length < 2 || description.trim().length < 2 || numericAmount <= 0 || !dueDate || !competence) { onError('Revise os dados obrigatórios antes de salvar.'); return }
    if (numericAmount + .001 < Number(entry.paid_amount || 0)) { onError('O valor do lançamento não pode ser menor que o valor já pago.'); return }
    setBusy(true)
    const { error } = await hrxSupabase.from('personal_financial_entries').update({
      counterparty_name: counterpartyName.trim(),
      description: description.trim(),
      category,
      gross_amount: numericAmount,
      due_date: dueDate,
      competence_date: `${competence}-01`,
      reference_number: referenceNumber.trim() || null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', entry.id).eq('owner_user_id', session.user.id).eq('status', 'open')
    if (error) onError('Não foi possível salvar as alterações. Confirme o MFA/AAL2 e tente novamente.')
    else await onDone()
    setBusy(false)
  }

  return createPortal(<div className="finance-modal-backdrop"><form className="finance-modal" onSubmit={submit}><header><div><span>EDIÇÃO FINANCEIRA</span><h2>Editar conta</h2><p>Altere somente esta ocorrência. O histórico empresarial da HRX permanece isolado.</p></div><button type="button" onClick={onClose}>×</button></header><div className="finance-modal-body"><label>Conta / favorecido<input autoFocus value={counterpartyName} onChange={(event) => setCounterpartyName(event.target.value)} /></label><label>Categoria<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="is-wide">Descrição<input value={description} onChange={(event) => setDescription(event.target.value)} /></label><label>Valor da ocorrência<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Vencimento<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label>Competência<input type="month" value={competence} onChange={(event) => setCompetence(event.target.value)} /></label><label>Referência<input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} /></label><label className="is-wide">Observações<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label></div><footer><button type="button" className="is-secondary" onClick={onClose}>Cancelar</button><button disabled={busy}>{busy ? 'Salvando…' : 'Salvar alterações'}</button></footer></form></div>, document.body)
}

function PayPersonalEntryModal({ session, entry, onClose, onDone, onError }: { session: Session; entry: PersonalEntry; onClose: () => void; onDone: () => Promise<void>; onError: (message: string) => void }) {
  useFinanceModalViewportLock()
  const [paidDate, setPaidDate] = useState(today())
  const [method, setMethod] = useState('pix')
  const [busy, setBusy] = useState(false)
  const confirm = async () => {
    setBusy(true)
    const paidAt = new Date(`${paidDate}T12:00:00`).toISOString()
    const { error } = await hrxSupabase.from('personal_financial_entries').update({ status: 'paid', paid_amount: Number(entry.gross_amount), paid_at: paidAt, payment_method: method, updated_at: new Date().toISOString() }).eq('id', entry.id).eq('owner_user_id', session.user.id).eq('status', 'open')
    if (error) onError('Não foi possível registrar o pagamento pessoal.')
    else await onDone()
    setBusy(false)
  }
  return createPortal(<div className="finance-modal-backdrop"><div className="finance-modal is-small"><header><div><span>BAIXA PESSOAL</span><h2>Registrar pagamento</h2><p>{entry.counterparty_name} • {currency.format(Number(entry.gross_amount))}</p></div><button type="button" onClick={onClose}>×</button></header><div className="finance-modal-body"><label>Data do pagamento<input type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} /></label><label>Forma<select value={method} onChange={(event) => setMethod(event.target.value)}><option value="pix">PIX</option><option value="transferencia">Transferência</option><option value="boleto">Boleto</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option><option value="debito_automatico">Débito automático</option><option value="outro">Outro</option></select></label></div><footer><button type="button" className="is-secondary" onClick={onClose}>Cancelar</button><button type="button" disabled={busy} onClick={() => void confirm()}>{busy ? 'Registrando…' : 'Confirmar pagamento'}</button></footer></div></div>, document.body)
}

function CancelPersonalEntryModal({ session, entry, onClose, onDone, onError }: { session: Session; entry: PersonalEntry; onClose: () => void; onDone: () => Promise<void>; onError: (message: string) => void }) {
  useFinanceModalViewportLock()
  const [busy, setBusy] = useState(false)
  const confirm = async () => {
    setBusy(true)
    const { error } = await hrxSupabase.from('personal_financial_entries').update({ status: 'cancelled', paid_amount: 0, paid_at: null, payment_method: null, updated_at: new Date().toISOString() }).eq('id', entry.id).eq('owner_user_id', session.user.id).eq('status', 'open')
    if (error) onError('Não foi possível cancelar a conta pessoal.')
    else await onDone()
    setBusy(false)
  }
  return createPortal(<div className="finance-modal-backdrop"><div className="finance-modal is-small"><header><div><span>FINANCEIRO PESSOAL</span><h2>Cancelar conta?</h2><p>{entry.counterparty_name} • {entry.description}</p></div><button type="button" onClick={onClose}>×</button></header><div className="finance-modal-body"><div className="finance-cancel-warning">A conta sairá das pendências, mas permanecerá registrada com status cancelado.</div></div><footer><button type="button" className="is-secondary" onClick={onClose}>Manter</button><button type="button" className="is-danger" disabled={busy} onClick={() => void confirm()}>{busy ? 'Cancelando…' : 'Cancelar conta'}</button></footer></div></div>, document.body)
}
