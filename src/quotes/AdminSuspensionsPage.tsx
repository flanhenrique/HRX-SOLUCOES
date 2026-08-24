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
  draft?: {
    status: string
    final_amount: number
    commercial_status: string
    current_version: number
    suspension_reason?: string | null
    suspension_note?: string | null
  } | null
}

type MessageTone = 'success' | 'error'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const reasons = ['Aguardando retorno do cliente', 'Aguardando documentação', 'Revisão de escopo', 'Negociação comercial', 'Prazo solicitado pelo cliente', 'Pendência interna', 'Outro motivo']

function canDeleteDraft(quote: QuoteRow) {
  return quote.draft?.commercial_status === 'draft' && Number(quote.draft?.current_version ?? 0) === 0
}

export default function AdminSuspensionsPage() {
  const [open, setOpen] = useState(false)
  const [quotes, setQuotes] = useState<QuoteRow[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<MessageTone>('success')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [target, setTarget] = useState<QuoteRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<QuoteRow | null>(null)
  const [form, setForm] = useState({ reason: reasons[0], note: '' })

  const clearMessage = () => { setMessage(''); setMessageTone('success') }
  const showMessage = (tone: MessageTone, text: string) => { setMessageTone(tone); setMessage(text) }

  const load = async (preserveMessage = false) => {
    setLoading(true)
    if (!preserveMessage) clearMessage()
    try {
      const [requestsResult, draftsResult] = await Promise.all([
        hrxSupabase.from('quote_requests').select('id,protocol,name,company,email,created_at,status').order('created_at', { ascending: false }).limit(300),
        hrxSupabase.from('quote_drafts').select('request_id,status,final_amount,commercial_status,current_version,suspension_reason,suspension_note'),
      ])
      if (requestsResult.error) throw requestsResult.error
      if (draftsResult.error) throw draftsResult.error
      const draftMap = new Map((draftsResult.data ?? []).map((item) => [item.request_id, item]))
      const requestRows = (requestsResult.data ?? []) as Omit<QuoteRow, 'draft'>[]
      setQuotes(requestRows.map((item) => ({ ...item, draft: draftMap.get(item.id) ?? null })))
      return true
    } catch {
      showMessage('error', 'Não foi possível carregar a lista de suspensões.')
      return false
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR')
    if (!normalized) return quotes
    return quotes.filter((item) => [item.protocol, item.name, item.company, item.email].some((value) => value?.toLocaleLowerCase('pt-BR').includes(normalized)))
  }, [query, quotes])

  const suspendedCount = quotes.filter((item) => item.draft?.status === 'suspended').length

  const suspend = async (event: FormEvent) => {
    event.preventDefault()
    if (!target) return
    setBusy(true); clearMessage()
    const { error: rpcError } = await hrxSupabase.rpc('hrx_suspend_quote', { p_request_id: target.id, p_reason: form.reason, p_note: form.note || null })
    setBusy(false)
    if (rpcError) { showMessage('error', 'Não foi possível suspender este orçamento.'); return }
    const protocol = target.protocol
    setTarget(null)
    const refreshed = await load(true)
    if (refreshed) showMessage('success', `${protocol} foi suspenso e saiu do fluxo de aprovação.`)
  }

  const resume = async (quote: QuoteRow) => {
    setBusy(true); clearMessage()
    const { error: rpcError } = await hrxSupabase.rpc('hrx_resume_quote', { p_request_id: quote.id })
    setBusy(false)
    if (rpcError) { showMessage('error', 'Não foi possível retomar este orçamento.'); return }
    const refreshed = await load(true)
    if (refreshed) showMessage('success', `${quote.protocol} foi retomado e voltou ao fluxo operacional.`)
  }

  const deleteDraft = async () => {
    if (!deleteTarget) return
    const protocol = deleteTarget.protocol
    setBusy(true); clearMessage()
    const { error: rpcError } = await hrxSupabase.rpc('hrx_delete_draft_quote', { p_request_id: deleteTarget.id })
    setBusy(false)
    if (rpcError) {
      const code = rpcError.message || ''
      if (code.includes('mfa_required')) showMessage('error', 'Confirme o MFA para excluir este orçamento.')
      else if (code.includes('cannot_delete_used_quote') || code.includes('cannot_delete_official_quote')) showMessage('error', 'Este orçamento já possui uso ou versão oficial e não pode ser excluído.')
      else if (code.includes('cannot_delete_financial_quote')) showMessage('error', 'Este orçamento possui vínculo financeiro e não pode ser excluído.')
      else showMessage('error', 'Não foi possível excluir este orçamento.')
      return
    }
    setDeleteTarget(null)
    const refreshed = await load(true)
    if (refreshed) showMessage('success', `${protocol} foi excluído definitivamente.`)
  }

  return <section className="hrx-suspensions-page" aria-label="Suspensões de orçamentos">
    <header className="hrx-suspensions-header"><div><span>HRX SOLUTIONS · CONTROLE DE FLUXO</span><h1>Suspensões</h1><p>Orçamentos interrompidos, pendências e condições de retomada.</p></div><button type="button" onClick={() => navigateAdmin('quotes')}>Abrir orçamentos</button></header>
    {message && <div className={`hrx-suspensions-message is-${messageTone}`} role={messageTone === 'error' ? 'alert' : 'status'}>{message}</div>}
    <main className="hrx-suspensions-content">
      <section className="hrx-suspensions-summary"><article><span>Suspensos</span><strong>{suspendedCount}</strong><small>Exigem decisão ou retorno</small></article><article><span>Total monitorado</span><strong>{quotes.length}</strong><small>Últimos registros</small></article></section>
      <div className="hrx-suspensions-toolbar"><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar protocolo ou cliente" /></label><button type="button" onClick={() => void load()} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</button></div>
      <section className="hrx-suspensions-list">
        {loading && <div className="hrx-suspensions-empty"><strong>Carregando orçamentos…</strong><span>Atualizando o fluxo monitorado.</span></div>}
        {!loading && !quotes.length && <div className="hrx-suspensions-empty"><strong>Nenhum orçamento para monitorar.</strong><span>Quando novas oportunidades entrarem no fluxo, elas aparecerão aqui.</span><button type="button" onClick={() => navigateAdmin('clients')}>Abrir Clientes</button></div>}
        {!loading && quotes.length > 0 && !filtered.length && <div className="hrx-suspensions-empty"><strong>Nenhum resultado encontrado.</strong><span>Revise o protocolo, cliente ou empresa informada.</span><button type="button" onClick={() => setQuery('')}>Limpar busca</button></div>}
        {!loading && filtered.map((quote) => {
          const suspended = quote.draft?.status === 'suspended'
          const deletable = canDeleteDraft(quote)
          return <article key={quote.id} className={suspended ? 'is-suspended' : ''}><div><span className={suspended ? 'is-suspended' : ''}>{suspended ? 'Suspenso' : quote.draft?.status?.replaceAll('_', ' ') || quote.status}</span><strong>{quote.protocol}</strong><h2>{quote.name}</h2><p>{quote.company || quote.email}</p>{suspended && <small><b>Motivo:</b> {quote.draft?.suspension_reason}{quote.draft?.suspension_note ? ` · ${quote.draft.suspension_note}` : ''}</small>}</div><aside><time>{new Date(quote.created_at).toLocaleDateString('pt-BR')}</time><strong>{currency.format(Number(quote.draft?.final_amount ?? 0))}</strong><div className="hrx-suspensions-actions">{suspended ? <button type="button" disabled={busy} onClick={() => void resume(quote)}>Retomar</button> : <button type="button" disabled={busy} onClick={() => { setTarget(quote); setForm({ reason: reasons[0], note: '' }) }}>Suspender</button>}{deletable && <button type="button" className="is-delete" disabled={busy} onClick={() => setDeleteTarget(quote)}>Excluir</button>}</div></aside></article>
        })}
      </section>
    </main>
    {target && <div className="hrx-suspensions-modal-backdrop"><form className="hrx-suspensions-modal" onSubmit={suspend}><header><div><span>SUSPENDER ORÇAMENTO</span><h2>{target.protocol}</h2></div><button type="button" onClick={() => setTarget(null)}>×</button></header><p>A suspensão preserva valores e histórico e remove o orçamento do fluxo de aprovação até a retomada.</p><label>Motivo<select value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })}>{reasons.map((reason) => <option key={reason}>{reason}</option>)}</select></label><label>Detalhes<textarea rows={4} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Condição de retomada, responsável ou contexto." /></label><footer><button type="button" onClick={() => setTarget(null)}>Cancelar</button><button type="submit" className="is-danger" disabled={busy}>{busy ? 'Suspendendo…' : 'Confirmar suspensão'}</button></footer></form></div>}
    {deleteTarget && <div className="hrx-suspensions-modal-backdrop"><div className="hrx-suspensions-modal hrx-delete-quote-modal"><header><div><span>EXCLUSÃO DEFINITIVA</span><h2>{deleteTarget.protocol}</h2></div><button type="button" onClick={() => setDeleteTarget(null)}>×</button></header><p>Este rascunho ainda não possui versão oficial. A exclusão remove o orçamento e seus registros operacionais relacionados, mas não exclui o cadastro do cliente.</p><div className="hrx-delete-warning"><strong>Excluir este orçamento?</strong><span>Esta ação não poderá ser desfeita.</span></div><footer><button type="button" onClick={() => setDeleteTarget(null)}>Cancelar</button><button type="button" className="is-danger" disabled={busy} onClick={() => void deleteDraft()}>{busy ? 'Excluindo…' : 'Excluir definitivamente'}</button></footer></div></div>}
  </section>
}
