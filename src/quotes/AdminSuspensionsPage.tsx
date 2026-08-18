import { FormEvent, useEffect, useMemo, useState } from 'react'
import { hrxSupabase } from './supabaseClient'
import { navigateAdmin, onAdminNavigate } from './adminNavigation'
import './admin-suspensions-page.css'

type QuoteRow = {
  id: string
  protocol: string
  name: string
  company?: string | null
  email: string
  created_at: string
  status: string
  draft?: { status: string; final_amount: number; suspension_reason?: string | null; suspension_note?: string | null } | null
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const reasons = ['Aguardando retorno do cliente', 'Aguardando documentação', 'Revisão de escopo', 'Negociação comercial', 'Prazo solicitado pelo cliente', 'Pendência interna', 'Outro motivo']

export default function AdminSuspensionsPage() {
  const [open, setOpen] = useState(false)
  const [quotes, setQuotes] = useState<QuoteRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [target, setTarget] = useState<QuoteRow | null>(null)
  const [form, setForm] = useState({ reason: reasons[0], note: '' })

  useEffect(() => onAdminNavigate((destination) => setOpen(destination === 'suspensions')), [])

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [requestsResult, draftsResult] = await Promise.all([
        hrxSupabase.from('quote_requests').select('id,protocol,name,company,email,created_at,status').order('created_at', { ascending: false }).limit(300),
        hrxSupabase.from('quote_drafts').select('request_id,status,final_amount,suspension_reason,suspension_note'),
      ])
      if (requestsResult.error) throw requestsResult.error
      if (draftsResult.error) throw draftsResult.error
      const draftMap = new Map((draftsResult.data ?? []).map((item) => [item.request_id, item]))
      setQuotes(((requestsResult.data ?? []) as Omit<QuoteRow, 'draft'>[]).map((item) => ({ ...item, draft: draftMap.get(item.id) ?? null })))
    } catch { setError('Não foi possível carregar os orçamentos agora.') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (open) void load() }, [open])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR')
    if (!normalized) return quotes
    return quotes.filter((item) => [item.protocol, item.name, item.company, item.email].some((value) => value?.toLocaleLowerCase('pt-BR').includes(normalized)))
  }, [query, quotes])

  const suspendedCount = quotes.filter((item) => item.draft?.status === 'suspended').length

  const suspend = async (event: FormEvent) => {
    event.preventDefault()
    if (!target) return
    setBusy(true); setError('')
    const { error: rpcError } = await hrxSupabase.rpc('hrx_suspend_quote', { p_request_id: target.id, p_reason: form.reason, p_note: form.note || null })
    setBusy(false)
    if (rpcError) { setError('Não foi possível suspender este orçamento.'); return }
    setTarget(null)
    await load()
  }

  const resume = async (requestId: string) => {
    setBusy(true); setError('')
    const { error: rpcError } = await hrxSupabase.rpc('hrx_resume_quote', { p_request_id: requestId })
    setBusy(false)
    if (rpcError) { setError('Não foi possível retomar este orçamento.'); return }
    await load()
  }

  if (!open) return null

  return <section className="hrx-suspensions-page" aria-label="Suspensões de orçamentos">
    <header className="hrx-suspensions-header"><div><span>HRX SOLUTIONS · CONTROLE DE FLUXO</span><h1>Suspensões</h1><p>Orçamentos interrompidos, pendências e condições de retomada.</p></div><button type="button" onClick={() => navigateAdmin('quotes')}>Abrir orçamentos</button></header>
    {error && <div className="hrx-suspensions-error">{error}</div>}
    <main className="hrx-suspensions-content">
      <section className="hrx-suspensions-summary"><article><span>Suspensos</span><strong>{suspendedCount}</strong><small>Exigem decisão ou retorno</small></article><article><span>Total monitorado</span><strong>{quotes.length}</strong><small>Últimos registros</small></article></section>
      <div className="hrx-suspensions-toolbar"><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar protocolo ou cliente" /></label><button type="button" onClick={() => void load()}>{loading ? 'Atualizando…' : 'Atualizar'}</button></div>
      <section className="hrx-suspensions-list">{loading && <p>Carregando orçamentos…</p>}{!loading && filtered.map((quote) => { const suspended = quote.draft?.status === 'suspended'; return <article key={quote.id} className={suspended ? 'is-suspended' : ''}><div><span className={suspended ? 'is-suspended' : ''}>{suspended ? 'Suspenso' : quote.draft?.status?.replaceAll('_', ' ') || quote.status}</span><strong>{quote.protocol}</strong><h2>{quote.name}</h2><p>{quote.company || quote.email}</p>{suspended && <small><b>Motivo:</b> {quote.draft?.suspension_reason}{quote.draft?.suspension_note ? ` · ${quote.draft.suspension_note}` : ''}</small>}</div><aside><time>{new Date(quote.created_at).toLocaleDateString('pt-BR')}</time><strong>{currency.format(Number(quote.draft?.final_amount ?? 0))}</strong>{suspended ? <button type="button" disabled={busy} onClick={() => void resume(quote.id)}>Retomar</button> : <button type="button" disabled={busy} onClick={() => { setTarget(quote); setForm({ reason: reasons[0], note: '' }) }}>Suspender</button>}</aside></article> })}</section>
    </main>
    {target && <div className="hrx-suspensions-modal-backdrop"><form className="hrx-suspensions-modal" onSubmit={suspend}><header><div><span>SUSPENDER ORÇAMENTO</span><h2>{target.protocol}</h2></div><button type="button" onClick={() => setTarget(null)}>×</button></header><p>A suspensão preserva valores e histórico e remove o orçamento do fluxo de aprovação até a retomada.</p><label>Motivo<select value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })}>{reasons.map((reason) => <option key={reason}>{reason}</option>)}</select></label><label>Detalhes<textarea rows={4} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Condição de retomada, responsável ou contexto." /></label><footer><button type="button" onClick={() => setTarget(null)}>Cancelar</button><button type="submit" className="is-danger" disabled={busy}>{busy ? 'Suspendendo…' : 'Confirmar suspensão'}</button></footer></form></div>}
  </section>
}
