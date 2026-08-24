import { FormEvent, useEffect, useMemo, useState } from 'react'
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
const monthKey = () => new Date().toISOString().slice(0, 7)
const formatDate = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—'
const categories = ['Moradia', 'Água', 'Energia', 'Internet', 'Telefonia', 'Assinaturas', 'Academia', 'Parcelamentos', 'Cartão', 'Transporte', 'Saúde', 'Outros']

function derivedStatus(entry: PersonalEntry) {
  if (entry.status === 'paid') return { label: 'Pago', className: 'is-paid' }
  if (entry.due_date < today()) return { label: 'Vencido', className: 'is-overdue' }
  return { label: 'A pagar', className: 'is-open' }
}

export default function AdminPersonalFinancePage() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [entries, setEntries] = useState<PersonalEntry[]>([])
  const [view, setView] = useState<PersonalView>('open')
  const [newOpen, setNewOpen] = useState(false)
  const [paymentEntry, setPaymentEntry] = useState<PersonalEntry | null>(null)
  const [cancelEntry, setCancelEntry] = useState<PersonalEntry | null>(null)

  useEffect(() => {
    void hrxSupabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false) })
    const { data: listener } = hrxSupabase.auth.onAuthStateChange((_event, next) => { setSession(next); setChecking(false) })
    return () => listener.subscription.unsubscribe()
  }, [])

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
  const openTotal = useMemo(() => active.reduce((sum, entry) => sum + Number(entry.gross_amount), 0), [active])
  const overdue = useMemo(() => active.filter((entry) => entry.due_date < today()), [active])
  const overdueTotal = useMemo(() => overdue.reduce((sum, entry) => sum + Number(entry.gross_amount), 0), [overdue])
  const paidMonth = useMemo(() => paid.filter((entry) => entry.paid_at?.startsWith(monthKey())).reduce((sum, entry) => sum + Number(entry.paid_amount), 0), [paid])
  const nextThirty = useMemo(() => {
    const limit = new Date(); limit.setDate(limit.getDate() + 30)
    const upper = limit.toISOString().slice(0, 10)
    return active.filter((entry) => entry.due_date >= today() && entry.due_date <= upper).reduce((sum, entry) => sum + Number(entry.gross_amount), 0)
  }, [active])

  if (checking || !session) return <section className="finance-loading">Validando acesso financeiro pessoal…</section>

  const visible = view === 'open' ? active : paid

  return <section className="finance-page personal-finance-page">
    <header className="finance-page-header">
      <div><span>FINANCEIRO • PESSOAL</span><h1>Contas pessoais</h1><p>Compromissos pessoais ficam isolados da contabilidade, dos KPIs e do fluxo de caixa da HRX Solutions.</p></div>
      <div className="finance-header-actions"><button type="button" onClick={() => void load()} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</button><button type="button" className="is-primary" onClick={() => setNewOpen(true)}>+ Nova conta</button></div>
    </header>

    <div className="personal-finance-boundary"><strong>Separação financeira ativa</strong><span>Nenhum valor desta visão entra em A receber, A pagar, Saldo previsto, impostos ou fluxo de caixa empresarial da HRX.</span></div>
    {error && <div className="finance-error" role="alert">{error}</div>}

    <div className="finance-metrics personal-finance-metrics">
      <article><span>A pagar</span><strong>{currency.format(openTotal)}</strong><small>{active.length} compromisso(s) aberto(s)</small></article>
      <article><span>Vencidos</span><strong>{currency.format(overdueTotal)}</strong><small>{overdue.length} conta(s) vencida(s)</small></article>
      <article><span>Próximos 30 dias</span><strong>{currency.format(nextThirty)}</strong><small>Contas abertas no horizonte</small></article>
      <article><span>Pago no mês</span><strong>{currency.format(paidMonth)}</strong><small>Baixas pessoais no mês atual</small></article>
    </div>

    <nav className="finance-tabs personal-finance-tabs" aria-label="Contas pessoais">
      <button className={view === 'open' ? 'is-active' : ''} onClick={() => setView('open')}>Contas a pagar <span>{active.length}</span></button>
      <button className={view === 'paid' ? 'is-active' : ''} onClick={() => setView('paid')}>Pagos <span>{paid.length}</span></button>
    </nav>

    {!visible.length ? <div className="finance-empty"><strong>{view === 'open' ? 'Nenhuma conta pessoal em aberto' : 'Nenhuma conta pessoal paga'}</strong><span>{view === 'open' ? 'Use “Nova conta” para registrar um compromisso pessoal.' : 'As contas quitadas aparecerão aqui.'}</span></div> : <div className="finance-table-wrap"><table className="finance-table personal-finance-table"><thead><tr><th>Conta</th><th>Vencimento</th><th>Categoria</th><th>Referência</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>{visible.map((entry) => {
      const status = derivedStatus(entry)
      return <tr key={entry.id}><td data-label="Conta"><strong>{entry.counterparty_name}</strong><small>{entry.description}</small></td><td data-label="Vencimento">{formatDate(entry.due_date)}</td><td data-label="Categoria"><strong>{entry.category}</strong><small>Competência {formatDate(entry.competence_date)}</small></td><td data-label="Referência">{entry.reference_number || '—'}</td><td data-label="Valor"><strong>{currency.format(Number(entry.gross_amount))}</strong>{entry.status === 'paid' && <small>Pago em {formatDate(entry.paid_at)}</small>}</td><td data-label="Status"><span className={`finance-status ${status.className}`}>{status.label}</span></td><td data-label="Ações"><div className="finance-row-actions">{entry.status === 'open' && <button type="button" onClick={() => setPaymentEntry(entry)}>Registrar pagamento</button>}{entry.status === 'open' && <button type="button" className="is-danger" onClick={() => setCancelEntry(entry)}>Cancelar</button>}</div></td></tr>
    })}</tbody></table></div>}

    <footer className="finance-page-footer"><span>Dados pessoais protegidos por usuário e MFA/AAL2. O ledger empresarial da HRX permanece separado.</span></footer>

    {newOpen && <NewPersonalEntryModal session={session} onClose={() => setNewOpen(false)} onDone={async () => { setNewOpen(false); await load(session); setView('open') }} onError={setError} />}
    {paymentEntry && <PayPersonalEntryModal session={session} entry={paymentEntry} onClose={() => setPaymentEntry(null)} onDone={async () => { setPaymentEntry(null); await load(session); setView('paid') }} onError={setError} />}
    {cancelEntry && <CancelPersonalEntryModal session={session} entry={cancelEntry} onClose={() => setCancelEntry(null)} onDone={async () => { setCancelEntry(null); await load(session) }} onError={setError} />}
  </section>
}

function NewPersonalEntryModal({ session, onClose, onDone, onError }: { session: Session; onClose: () => void; onDone: () => Promise<void>; onError: (message: string) => void }) {
  const [counterpartyName, setCounterpartyName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(categories[0])
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState(today())
  const [competenceDate, setCompetenceDate] = useState(today())
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

  return <div className="finance-modal-backdrop"><form className="finance-modal" onSubmit={submit}><header><div><span>FINANCEIRO PESSOAL</span><h2>Nova conta a pagar</h2><p>Este lançamento é pessoal e não será usado nos indicadores empresariais da HRX Solutions.</p></div><button type="button" onClick={onClose}>×</button></header><div className="finance-modal-body"><label>Conta / favorecido<input autoFocus value={counterpartyName} onChange={(event) => setCounterpartyName(event.target.value)} placeholder="Ex.: Internet, academia, locador" /></label><label>Categoria<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="is-wide">Descrição<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Mensalidade de setembro" /></label><label>Valor<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" /></label><label>Vencimento<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label>Competência<input type="date" value={competenceDate} onChange={(event) => setCompetenceDate(event.target.value)} /></label><label>Referência<input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} placeholder="Opcional" /></label><label className="is-wide">Observações<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Informação pessoal opcional." /></label></div><footer><button type="button" className="is-secondary" onClick={onClose}>Cancelar</button><button disabled={busy}>{busy ? 'Salvando…' : 'Criar conta'}</button></footer></form></div>
}

function PayPersonalEntryModal({ session, entry, onClose, onDone, onError }: { session: Session; entry: PersonalEntry; onClose: () => void; onDone: () => Promise<void>; onError: (message: string) => void }) {
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
  return <div className="finance-modal-backdrop"><div className="finance-modal is-small"><header><div><span>BAIXA PESSOAL</span><h2>Registrar pagamento</h2><p>{entry.counterparty_name} • {currency.format(Number(entry.gross_amount))}</p></div><button type="button" onClick={onClose}>×</button></header><div className="finance-modal-body"><label>Data do pagamento<input type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} /></label><label>Forma<select value={method} onChange={(event) => setMethod(event.target.value)}><option value="pix">PIX</option><option value="transferencia">Transferência</option><option value="boleto">Boleto</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option><option value="debito_automatico">Débito automático</option><option value="outro">Outro</option></select></label></div><footer><button type="button" className="is-secondary" onClick={onClose}>Cancelar</button><button type="button" disabled={busy} onClick={() => void confirm()}>{busy ? 'Registrando…' : 'Confirmar pagamento'}</button></footer></div></div>
}

function CancelPersonalEntryModal({ session, entry, onClose, onDone, onError }: { session: Session; entry: PersonalEntry; onClose: () => void; onDone: () => Promise<void>; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false)
  const confirm = async () => {
    setBusy(true)
    const { error } = await hrxSupabase.from('personal_financial_entries').update({ status: 'cancelled', paid_amount: 0, paid_at: null, payment_method: null, updated_at: new Date().toISOString() }).eq('id', entry.id).eq('owner_user_id', session.user.id).eq('status', 'open')
    if (error) onError('Não foi possível cancelar a conta pessoal.')
    else await onDone()
    setBusy(false)
  }
  return <div className="finance-modal-backdrop"><div className="finance-modal is-small"><header><div><span>FINANCEIRO PESSOAL</span><h2>Cancelar conta?</h2><p>{entry.counterparty_name} • {entry.description}</p></div><button type="button" onClick={onClose}>×</button></header><div className="finance-modal-body"><div className="finance-cancel-warning">A conta sairá das pendências, mas permanecerá registrada com status cancelado.</div></div><footer><button type="button" className="is-secondary" onClick={onClose}>Manter</button><button type="button" className="is-danger" disabled={busy} onClick={() => void confirm()}>{busy ? 'Cancelando…' : 'Cancelar conta'}</button></footer></div></div>
}
