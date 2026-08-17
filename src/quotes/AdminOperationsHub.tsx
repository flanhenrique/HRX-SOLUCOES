import { FormEvent, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { hrxSupabase } from './supabaseClient'
import './admin-operations.css'

type ClientRow = {
  id: string
  created_at: string
  updated_at: string
  name: string
  company?: string | null
  email?: string | null
  phone?: string | null
  document?: string | null
  notes?: string | null
  source: string
  active: boolean
  last_quote_at?: string | null
}

type QuoteRow = {
  id: string
  client_id?: string | null
  protocol: string
  name: string
  company?: string | null
  email: string
  phone: string
  created_at: string
  status: string
  source: string
  draft?: {
    status: string
    final_amount: number
    suspension_reason?: string | null
    suspension_note?: string | null
    suspended_at?: string | null
  } | null
}

type Panel = 'clients' | 'suspensions' | null

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const suspensionReasons = ['Aguardando retorno do cliente', 'Aguardando documentação', 'Revisão de escopo', 'Negociação comercial', 'Prazo solicitado pelo cliente', 'Pendência interna', 'Outro motivo']

function messageFromError(error: unknown) {
  const text = error instanceof Error ? error.message : String((error as { message?: string } | null)?.message ?? '')
  if (text.includes('duplicate_client')) return 'Já existe um cliente cadastrado com este e-mail.'
  if (text.includes('invalid_client')) return 'Informe o nome e ao menos um contato válido.'
  if (text.includes('suspension_reason_required')) return 'Selecione um motivo para suspender o orçamento.'
  if (text.includes('already_suspended')) return 'Este orçamento já está suspenso.'
  if (text.includes('client_not_found')) return 'Cliente não encontrado ou inativo.'
  return 'Não foi possível concluir esta operação agora.'
}

export default function AdminOperationsHub() {
  const [sidebarTarget, setSidebarTarget] = useState<Element | null>(null)
  const [topbarTarget, setTopbarTarget] = useState<Element | null>(null)
  const [mobileTarget, setMobileTarget] = useState<Element | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [clients, setClients] = useState<ClientRow[]>([])
  const [quotes, setQuotes] = useState<QuoteRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [clientQuery, setClientQuery] = useState('')
  const [quoteQuery, setQuoteQuery] = useState('')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [clientFormOpen, setClientFormOpen] = useState(false)
  const [quoteFormOpen, setQuoteFormOpen] = useState(false)
  const [suspendTarget, setSuspendTarget] = useState<QuoteRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [clientForm, setClientForm] = useState({ name: '', company: '', email: '', phone: '', document: '', notes: '' })
  const [manualForm, setManualForm] = useState({ clientId: '', requestText: '', desiredDeadline: '', preferredContact: 'whatsapp' })
  const [suspensionForm, setSuspensionForm] = useState({ reason: suspensionReasons[0], note: '' })

  useEffect(() => {
    const updateTargets = () => {
      const sidebar = document.querySelector('.admin-exec-sidebar nav')
      const topbar = document.querySelector('.admin-exec-topbar .admin-exec-system')
      const mobile = document.querySelector('.admin-mobile-nav')
      setSidebarTarget(sidebar)
      setTopbarTarget(topbar)
      setMobileTarget(mobile)
      mobile?.classList.add('has-admin-ops')
    }
    updateTargets()
    const observer = new MutationObserver(updateTargets)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      document.querySelector('.admin-mobile-nav')?.classList.remove('has-admin-ops')
    }
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [clientsResult, requestsResult, draftsResult] = await Promise.all([
        hrxSupabase.from('clients').select('id,created_at,updated_at,name,company,email,phone,document,notes,source,active,last_quote_at').order('name'),
        hrxSupabase.from('quote_requests').select('id,client_id,protocol,name,company,email,phone,created_at,status,source').order('created_at', { ascending: false }).limit(300),
        hrxSupabase.from('quote_drafts').select('request_id,status,final_amount,suspension_reason,suspension_note,suspended_at'),
      ])
      if (clientsResult.error) throw clientsResult.error
      if (requestsResult.error) throw requestsResult.error
      if (draftsResult.error) throw draftsResult.error

      const clientRows = (clientsResult.data ?? []) as ClientRow[]
      const requestRows = (requestsResult.data ?? []) as Omit<QuoteRow, 'draft'>[]
      const draftMap = new Map((draftsResult.data ?? []).map((item) => [item.request_id, item]))

      const byEmail = new Map(clientRows.filter((item) => item.email).map((item) => [String(item.email).toLowerCase(), item]))
      for (const request of requestRows) {
        if (request.client_id || !request.email) continue
        const matching = byEmail.get(request.email.toLowerCase())
        if (matching) {
          request.client_id = matching.id
          void hrxSupabase.from('quote_requests').update({ client_id: matching.id }).eq('id', request.id)
        }
      }

      setClients(clientRows)
      setQuotes(requestRows.map((item) => ({ ...item, draft: draftMap.get(item.id) ?? null })))
      setSelectedClientId((current) => current && clientRows.some((item) => item.id === current) ? current : clientRows[0]?.id ?? null)
    } catch (loadError) {
      setError(messageFromError(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (panel || quoteFormOpen) void loadData() }, [panel, quoteFormOpen])

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLocaleLowerCase('pt-BR')
    if (!q) return clients
    return clients.filter((item) => [item.name, item.company, item.email, item.phone, item.document].some((value) => value?.toLocaleLowerCase('pt-BR').includes(q)))
  }, [clientQuery, clients])

  const filteredQuotes = useMemo(() => {
    const q = quoteQuery.trim().toLocaleLowerCase('pt-BR')
    if (!q) return quotes
    return quotes.filter((item) => [item.protocol, item.name, item.company, item.email].some((value) => value?.toLocaleLowerCase('pt-BR').includes(q)))
  }, [quoteQuery, quotes])

  const selectedClient = clients.find((item) => item.id === selectedClientId) ?? null
  const selectedClientQuotes = quotes.filter((item) => item.client_id === selectedClientId)
  const selectedClientVolume = selectedClientQuotes.reduce((sum, item) => sum + Number(item.draft?.final_amount ?? 0), 0)
  const suspendedCount = quotes.filter((item) => item.draft?.status === 'suspended').length

  const openManualQuote = (clientId?: string) => {
    const resolved = clientId ?? selectedClientId ?? clients[0]?.id ?? ''
    setManualForm({ clientId: resolved, requestText: '', desiredDeadline: '', preferredContact: 'whatsapp' })
    setQuoteFormOpen(true)
  }

  const createClient = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const { data, error: rpcError } = await hrxSupabase.rpc('hrx_create_client', {
        p_name: clientForm.name,
        p_company: clientForm.company || null,
        p_email: clientForm.email || null,
        p_phone: clientForm.phone || null,
        p_document: clientForm.document || null,
        p_notes: clientForm.notes || null,
      })
      if (rpcError) throw rpcError
      setClientFormOpen(false)
      setClientForm({ name: '', company: '', email: '', phone: '', document: '', notes: '' })
      await loadData()
      if (typeof data === 'string') setSelectedClientId(data)
    } catch (createError) { setError(messageFromError(createError)) }
    finally { setBusy(false) }
  }

  const createManualQuote = async (event: FormEvent) => {
    event.preventDefault()
    if (!manualForm.clientId) return
    setBusy(true); setError('')
    try {
      const { error: rpcError } = await hrxSupabase.rpc('hrx_create_manual_quote', {
        p_client_id: manualForm.clientId,
        p_request_text: manualForm.requestText || null,
        p_desired_deadline: manualForm.desiredDeadline || null,
        p_preferred_contact: manualForm.preferredContact,
      })
      if (rpcError) throw rpcError
      window.location.reload()
    } catch (createError) { setError(messageFromError(createError)); setBusy(false) }
  }

  const suspendQuote = async (event: FormEvent) => {
    event.preventDefault()
    if (!suspendTarget) return
    setBusy(true); setError('')
    try {
      const { error: rpcError } = await hrxSupabase.rpc('hrx_suspend_quote', {
        p_request_id: suspendTarget.id,
        p_reason: suspensionForm.reason,
        p_note: suspensionForm.note || null,
      })
      if (rpcError) throw rpcError
      window.location.reload()
    } catch (suspendError) { setError(messageFromError(suspendError)); setBusy(false) }
  }

  const resumeQuote = async (requestId: string) => {
    setBusy(true); setError('')
    try {
      const { error: rpcError } = await hrxSupabase.rpc('hrx_resume_quote', { p_request_id: requestId })
      if (rpcError) throw rpcError
      window.location.reload()
    } catch (resumeError) { setError(messageFromError(resumeError)); setBusy(false) }
  }

  const sidebarPortal = sidebarTarget ? createPortal(<>
    <button type="button" className="admin-ops-nav" onClick={() => setPanel('clients')}><span aria-hidden="true">♙</span>Clientes</button>
    <button type="button" className="admin-ops-nav" onClick={() => setPanel('suspensions')}><span aria-hidden="true">Ⅱ</span>Suspensões{suspendedCount > 0 && <b>{suspendedCount}</b>}</button>
  </>, sidebarTarget) : null

  const topbarPortal = topbarTarget ? createPortal(
    <button type="button" className="admin-ops-new-quote" onClick={() => openManualQuote()}>+ Orçamento manual</button>,
    topbarTarget,
  ) : null

  const mobilePortal = mobileTarget ? createPortal(
    <button type="button" className="admin-ops-mobile" onClick={() => setPanel('clients')}><span>♙</span>Gestão</button>,
    mobileTarget,
  ) : null

  return <>
    {sidebarPortal}{topbarPortal}{mobilePortal}

    {panel && <section className="admin-ops-shell" role="dialog" aria-modal="true" aria-label={panel === 'clients' ? 'Catálogo de clientes' : 'Suspensões de orçamentos'}>
      <header className="admin-ops-header"><div><span>HRX · BACKOFFICE</span><h2>{panel === 'clients' ? 'Clientes' : 'Suspensões'}</h2></div><div><button type="button" onClick={() => setPanel(panel === 'clients' ? 'suspensions' : 'clients')}>{panel === 'clients' ? `Suspensões${suspendedCount ? ` · ${suspendedCount}` : ''}` : 'Clientes'}</button>{panel === 'clients' && <button className="is-primary" type="button" onClick={() => openManualQuote()}>+ Orçamento manual</button>}<button type="button" aria-label="Fechar" onClick={() => setPanel(null)}>×</button></div></header>
      {error && <div className="admin-ops-error">{error}</div>}

      {panel === 'clients' && <div className="admin-ops-clients">
        <aside className="admin-ops-list"><div className="admin-ops-list-head"><div><strong>Catálogo</strong><span>{clients.length}</span></div><button type="button" onClick={() => setClientFormOpen(true)}>+ Cliente</button></div><label className="admin-ops-search"><span>⌕</span><input value={clientQuery} onChange={(event) => setClientQuery(event.target.value)} placeholder="Buscar cliente, empresa ou contato" /></label><div className="admin-ops-scroll">{loading && <p className="admin-ops-empty">Carregando clientes…</p>}{!loading && filteredClients.map((client) => <button key={client.id} type="button" className={selectedClientId === client.id ? 'admin-ops-client is-active' : 'admin-ops-client'} onClick={() => setSelectedClientId(client.id)}><div><strong>{client.name}</strong>{!client.active && <span>Inativo</span>}</div><small>{client.company || client.email || client.phone}</small><time>{client.last_quote_at ? new Date(client.last_quote_at).toLocaleDateString('pt-BR') : 'Sem orçamento'}</time></button>)}</div></aside>
        <main className="admin-ops-client-detail">{selectedClient ? <><section className="admin-ops-client-title"><div className="admin-ops-avatar">{selectedClient.name.slice(0, 2).toUpperCase()}</div><div><span>CLIENTE</span><h3>{selectedClient.name}</h3><p>{selectedClient.company || 'Sem empresa informada'}</p></div><button type="button" className="is-primary" onClick={() => openManualQuote(selectedClient.id)}>Novo orçamento</button></section><section className="admin-ops-client-metrics"><article><span>Orçamentos</span><strong>{selectedClientQuotes.length}</strong></article><article><span>Volume histórico</span><strong>{currency.format(selectedClientVolume)}</strong></article><article><span>Último orçamento</span><strong>{selectedClient.last_quote_at ? new Date(selectedClient.last_quote_at).toLocaleDateString('pt-BR') : '—'}</strong></article></section><section className="admin-ops-client-info"><article><span>E-mail</span><strong>{selectedClient.email || 'Não informado'}</strong></article><article><span>Telefone</span><strong>{selectedClient.phone || 'Não informado'}</strong></article><article><span>Documento</span><strong>{selectedClient.document || 'Não informado'}</strong></article><article><span>Origem</span><strong>{selectedClient.source.replaceAll('_', ' ')}</strong></article></section>{selectedClient.notes && <section className="admin-ops-notes"><span>OBSERVAÇÕES</span><p>{selectedClient.notes}</p></section>}<section className="admin-ops-history"><div><span>HISTÓRICO COMERCIAL</span><strong>{selectedClientQuotes.length} registro(s)</strong></div>{selectedClientQuotes.length === 0 ? <p className="admin-ops-empty">Nenhum orçamento vinculado a este cliente.</p> : selectedClientQuotes.map((quote) => <article key={quote.id}><div><strong>{quote.protocol}</strong><span>{quote.source === 'admin_manual' ? 'Manual' : 'Site'}</span></div><p>{quote.name}{quote.company ? ` · ${quote.company}` : ''}</p><div><time>{new Date(quote.created_at).toLocaleDateString('pt-BR')}</time><b>{currency.format(Number(quote.draft?.final_amount ?? 0))}</b></div></article>)}</section></> : <div className="admin-ops-empty-state"><h3>Selecione um cliente</h3><p>Escolha um cadastro para ver contatos e histórico.</p></div>}</main>
      </div>}

      {panel === 'suspensions' && <div className="admin-ops-suspensions"><div className="admin-ops-suspension-toolbar"><label className="admin-ops-search"><span>⌕</span><input value={quoteQuery} onChange={(event) => setQuoteQuery(event.target.value)} placeholder="Buscar orçamento ou cliente" /></label><div><strong>{suspendedCount}</strong><span>suspenso(s)</span></div></div><div className="admin-ops-suspension-list">{loading && <p className="admin-ops-empty">Carregando orçamentos…</p>}{!loading && filteredQuotes.map((quote) => { const suspended = quote.draft?.status === 'suspended'; return <article key={quote.id} className={suspended ? 'is-suspended' : ''}><div className="admin-ops-quote-main"><span className={suspended ? 'admin-ops-status is-suspended' : 'admin-ops-status'}>{suspended ? 'Suspenso' : quote.draft?.status?.replaceAll('_', ' ') || quote.status}</span><strong>{quote.protocol}</strong><h3>{quote.name}</h3><p>{quote.company || quote.email}</p>{suspended && <small><b>Motivo:</b> {quote.draft?.suspension_reason}{quote.draft?.suspension_note ? ` · ${quote.draft.suspension_note}` : ''}</small>}</div><div className="admin-ops-quote-value"><span>{new Date(quote.created_at).toLocaleDateString('pt-BR')}</span><strong>{currency.format(Number(quote.draft?.final_amount ?? 0))}</strong>{suspended ? <button type="button" disabled={busy} onClick={() => void resumeQuote(quote.id)}>Retomar</button> : <button type="button" disabled={busy} onClick={() => { setSuspendTarget(quote); setSuspensionForm({ reason: suspensionReasons[0], note: '' }) }}>Suspender</button>}</div></article> })}</div></div>}
    </section>}

    {clientFormOpen && <div className="admin-ops-modal-backdrop"><form className="admin-ops-modal" onSubmit={createClient}><header><div><span>NOVO CADASTRO</span><h3>Adicionar cliente</h3></div><button type="button" onClick={() => setClientFormOpen(false)}>×</button></header><div className="admin-ops-form-grid"><label>Nome / responsável<input required value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} /></label><label>Empresa<input value={clientForm.company} onChange={(e) => setClientForm({ ...clientForm, company: e.target.value })} /></label><label>E-mail<input type="email" value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} /></label><label>Telefone / WhatsApp<input value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} /></label><label>CPF/CNPJ<input value={clientForm.document} onChange={(e) => setClientForm({ ...clientForm, document: e.target.value })} /></label><label className="is-wide">Observações<textarea rows={4} value={clientForm.notes} onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })} /></label></div><footer><button type="button" onClick={() => setClientFormOpen(false)}>Cancelar</button><button className="is-primary" disabled={busy || !clientForm.name || (!clientForm.email && !clientForm.phone)} type="submit">{busy ? 'Salvando…' : 'Salvar cliente'}</button></footer></form></div>}

    {quoteFormOpen && <div className="admin-ops-modal-backdrop"><form className="admin-ops-modal" onSubmit={createManualQuote}><header><div><span>ORÇAMENTO MANUAL</span><h3>Novo orçamento</h3></div><button type="button" onClick={() => setQuoteFormOpen(false)}>×</button></header><div className="admin-ops-form-grid"><label className="is-wide">Cliente<select required value={manualForm.clientId} onChange={(e) => setManualForm({ ...manualForm, clientId: e.target.value })}><option value="">Selecione</option>{clients.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}{item.company ? ` · ${item.company}` : ''}</option>)}</select></label><label>Prazo desejado<input value={manualForm.desiredDeadline} onChange={(e) => setManualForm({ ...manualForm, desiredDeadline: e.target.value })} placeholder="Ex.: 30 dias" /></label><label>Contato preferencial<select value={manualForm.preferredContact} onChange={(e) => setManualForm({ ...manualForm, preferredContact: e.target.value })}><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option></select></label><label className="is-wide">Escopo inicial<textarea rows={5} value={manualForm.requestText} onChange={(e) => setManualForm({ ...manualForm, requestText: e.target.value })} placeholder="Descreva a demanda. O catálogo e os valores serão definidos no editor do orçamento." /></label></div><footer><button type="button" onClick={() => setQuoteFormOpen(false)}>Cancelar</button><button className="is-primary" disabled={busy || !manualForm.clientId} type="submit">{busy ? 'Criando…' : 'Criar orçamento'}</button></footer></form></div>}

    {suspendTarget && <div className="admin-ops-modal-backdrop"><form className="admin-ops-modal admin-ops-suspend-modal" onSubmit={suspendQuote}><header><div><span>SUSPENDER ORÇAMENTO</span><h3>{suspendTarget.protocol}</h3></div><button type="button" onClick={() => setSuspendTarget(null)}>×</button></header><p className="admin-ops-modal-lead">A suspensão tira o orçamento do fluxo de aprovação sem apagar valores, cliente ou histórico. Ele poderá ser retomado depois.</p><div className="admin-ops-form-grid"><label className="is-wide">Motivo<select value={suspensionForm.reason} onChange={(e) => setSuspensionForm({ ...suspensionForm, reason: e.target.value })}>{suspensionReasons.map((reason) => <option key={reason}>{reason}</option>)}</select></label><label className="is-wide">Detalhes<textarea rows={4} value={suspensionForm.note} onChange={(e) => setSuspensionForm({ ...suspensionForm, note: e.target.value })} placeholder="Contexto adicional, responsável ou condição para retomar." /></label></div><footer><button type="button" onClick={() => setSuspendTarget(null)}>Cancelar</button><button className="is-danger" disabled={busy} type="submit">{busy ? 'Suspendendo…' : 'Confirmar suspensão'}</button></footer></form></div>}
  </>
}
