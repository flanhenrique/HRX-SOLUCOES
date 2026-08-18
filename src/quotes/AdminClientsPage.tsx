import { FormEvent, useEffect, useMemo, useState } from 'react'
import { hrxSupabase } from './supabaseClient'
import { navigateAdmin, onAdminNavigate } from './adminNavigation'
import AdminClientForm from './AdminClientForm'
import './admin-clients-page.css'

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
  created_at: string
  source: string
  draft?: { status: string; final_amount: number } | null
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export default function AdminClientsPage() {
  const [open, setOpen] = useState(false)
  const [clients, setClients] = useState<ClientRow[]>([])
  const [quotes, setQuotes] = useState<QuoteRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [clientFormOpen, setClientFormOpen] = useState(false)
  const [quoteFormOpen, setQuoteFormOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [manualForm, setManualForm] = useState({ clientId: '', requestText: '', desiredDeadline: '', preferredContact: 'whatsapp' })

  useEffect(() => onAdminNavigate((destination) => {
    setOpen(destination === 'clients')
    if (destination !== 'clients') setQuoteFormOpen(false)
  }), [])

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [clientsResult, requestsResult, draftsResult] = await Promise.all([
        hrxSupabase.from('clients').select('id,created_at,updated_at,name,company,email,phone,document,notes,source,active,last_quote_at').order('name'),
        hrxSupabase.from('quote_requests').select('id,client_id,protocol,name,company,email,created_at,source').order('created_at', { ascending: false }).limit(300),
        hrxSupabase.from('quote_drafts').select('request_id,status,final_amount'),
      ])
      if (clientsResult.error) throw clientsResult.error
      if (requestsResult.error) throw requestsResult.error
      if (draftsResult.error) throw draftsResult.error
      const clientRows = (clientsResult.data ?? []) as ClientRow[]
      const draftMap = new Map((draftsResult.data ?? []).map((item) => [item.request_id, item]))
      const requestRows = (requestsResult.data ?? []) as Omit<QuoteRow, 'draft'>[]
      setClients(clientRows)
      setQuotes(requestRows.map((item) => ({ ...item, draft: draftMap.get(item.id) ?? null })))
      setSelectedId((current) => current && clientRows.some((item) => item.id === current) ? current : clientRows[0]?.id ?? null)
    } catch {
      setError('Não foi possível carregar a carteira de clientes agora.')
    } finally { setLoading(false) }
  }

  useEffect(() => { if (open) void load() }, [open])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR')
    if (!normalized) return clients
    return clients.filter((item) => [item.name, item.company, item.email, item.phone, item.document].some((value) => value?.toLocaleLowerCase('pt-BR').includes(normalized)))
  }, [clients, query])

  const selected = clients.find((item) => item.id === selectedId) ?? null
  const selectedQuotes = quotes.filter((item) => item.client_id === selectedId)
  const volume = selectedQuotes.reduce((sum, item) => sum + Number(item.draft?.final_amount ?? 0), 0)

  const openManualQuote = (clientId?: string) => {
    setManualForm({ clientId: clientId ?? selectedId ?? clients[0]?.id ?? '', requestText: '', desiredDeadline: '', preferredContact: 'whatsapp' })
    setQuoteFormOpen(true)
  }

  const createManualQuote = async (event: FormEvent) => {
    event.preventDefault()
    if (!manualForm.clientId) return
    setBusy(true); setError('')
    const { error: rpcError } = await hrxSupabase.rpc('hrx_create_manual_quote', {
      p_client_id: manualForm.clientId,
      p_request_text: manualForm.requestText || null,
      p_desired_deadline: manualForm.desiredDeadline || null,
      p_preferred_contact: manualForm.preferredContact,
    })
    setBusy(false)
    if (rpcError) {
      setError('Não foi possível criar o orçamento manual.')
      return
    }
    setQuoteFormOpen(false)
    navigateAdmin('quotes')
  }

  if (!open) return null

  return <section className="hrx-clients-page" aria-label="Clientes HRX">
    <header className="hrx-clients-header">
      <div><span>HRX SOLUTIONS · RELACIONAMENTO</span><h1>Clientes</h1><p>Carteira, histórico comercial e criação de novas oportunidades.</p></div>
      <div><button type="button" onClick={() => setClientFormOpen(true)}>+ Cliente</button><button type="button" className="is-primary" onClick={() => openManualQuote()}>+ Orçamento</button></div>
    </header>
    {error && <div className="hrx-clients-error">{error}</div>}
    <main className="hrx-clients-content">
      <aside className="hrx-clients-list">
        <div className="hrx-clients-list-head"><div><strong>Carteira</strong><span>{clients.length}</span></div><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente" /></label></div>
        <div className="hrx-clients-scroll">{loading && <p className="hrx-clients-empty">Carregando clientes…</p>}{!loading && filtered.map((client) => <button key={client.id} type="button" className={selectedId === client.id ? 'is-active' : ''} onClick={() => setSelectedId(client.id)}><div><strong>{client.name}</strong>{!client.active && <span>Inativo</span>}</div><small>{client.company || client.email || client.phone || 'Sem contato'}</small><time>{client.last_quote_at ? new Date(client.last_quote_at).toLocaleDateString('pt-BR') : 'Sem orçamento'}</time></button>)}</div>
      </aside>
      <section className="hrx-client-detail">{selected ? <>
        <div className="hrx-client-title"><div className="hrx-client-avatar">{selected.name.slice(0, 2).toUpperCase()}</div><div><span>CLIENTE</span><h2>{selected.name}</h2><p>{selected.company || 'Sem empresa informada'}</p></div><button type="button" onClick={() => openManualQuote(selected.id)}>Novo orçamento</button></div>
        <div className="hrx-client-kpis"><article><span>Orçamentos</span><strong>{selectedQuotes.length}</strong></article><article><span>Volume histórico</span><strong>{currency.format(volume)}</strong></article><article><span>Último orçamento</span><strong>{selected.last_quote_at ? new Date(selected.last_quote_at).toLocaleDateString('pt-BR') : '—'}</strong></article></div>
        <div className="hrx-client-info"><article><span>E-mail</span><strong>{selected.email || 'Não informado'}</strong></article><article><span>Telefone</span><strong>{selected.phone || 'Não informado'}</strong></article><article><span>Documento</span><strong>{selected.document || 'Não informado'}</strong></article><article><span>Origem</span><strong>{selected.source.replaceAll('_', ' ')}</strong></article></div>
        {selected.notes && <div className="hrx-client-notes"><span>OBSERVAÇÕES</span><p>{selected.notes}</p></div>}
        <div className="hrx-client-history"><header><div><span>HISTÓRICO COMERCIAL</span><h3>Orçamentos vinculados</h3></div><strong>{selectedQuotes.length}</strong></header>{!selectedQuotes.length ? <p className="hrx-clients-empty">Nenhum orçamento vinculado a este cliente.</p> : selectedQuotes.map((quote) => <article key={quote.id}><div><strong>{quote.protocol}</strong><small>{quote.source === 'admin_manual' ? 'Manual' : 'Site'}</small></div><span>{new Date(quote.created_at).toLocaleDateString('pt-BR')}</span><b>{currency.format(Number(quote.draft?.final_amount ?? 0))}</b></article>)}</div>
      </> : <div className="hrx-clients-empty-state"><h2>Selecione um cliente</h2><p>Escolha um cadastro para ver contatos e histórico.</p></div>}</section>
    </main>

    {clientFormOpen && <AdminClientForm onClose={() => setClientFormOpen(false)} onCreated={async (id) => { await load(); if (id) setSelectedId(id) }} />}
    {quoteFormOpen && <div className="hrx-clients-modal-backdrop"><form className="hrx-clients-modal" onSubmit={createManualQuote}><header><div><span>OPORTUNIDADE COMERCIAL</span><h2>Novo orçamento</h2></div><button type="button" onClick={() => setQuoteFormOpen(false)}>×</button></header><label>Cliente<select required value={manualForm.clientId} onChange={(event) => setManualForm({ ...manualForm, clientId: event.target.value })}><option value="">Selecione</option>{clients.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}{item.company ? ` · ${item.company}` : ''}</option>)}</select></label><div className="hrx-clients-form-row"><label>Prazo desejado<input value={manualForm.desiredDeadline} onChange={(event) => setManualForm({ ...manualForm, desiredDeadline: event.target.value })} placeholder="Ex.: 30 dias" /></label><label>Contato preferencial<select value={manualForm.preferredContact} onChange={(event) => setManualForm({ ...manualForm, preferredContact: event.target.value })}><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option></select></label></div><label>Escopo inicial<textarea rows={5} value={manualForm.requestText} onChange={(event) => setManualForm({ ...manualForm, requestText: event.target.value })} placeholder="Descreva a demanda inicial." /></label><footer><button type="button" onClick={() => setQuoteFormOpen(false)}>Cancelar</button><button type="submit" className="is-primary" disabled={busy || !manualForm.clientId}>{busy ? 'Criando…' : 'Criar orçamento'}</button></footer></form></div>}
  </section>
}
