import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import AdminClientForm from './AdminClientForm'
import { generateProposalPdf, type ProposalPdfData } from './proposalPdf'
import { buildInstallmentSchedule, calculateQuotePreview, toCents } from './quoteMath'
import type { CommercialStatus, DiscountLevel, PaymentMode, RetentionInput } from './types'
import { hrxPublishableKey, hrxSupabase, quoteAdminEndpoint } from './supabaseClient'
import { buildAdminSubroutePath } from './adminModules'
import { navigateAdmin, navigateAdminPath } from './adminNavigation'
import { useAdminRoute } from './AdminRouteContext'
import './quotes.css'
import './quote-commercial.css'
import './admin-quotes-mobile.css'

type ProviderRule = { provider: 'nubank' | 'mercadopago'; display_name: string; boleto_fee_per_paid: number }
type PricingRule = { service_key: string; service_name: string; category: string; base_amount: number; minimum_amount: number; invoice_description?: string | null }
type Client = { id: string; name: string; company?: string | null; email?: string | null; phone?: string | null; document?: string | null; notes?: string | null; active: boolean }
type QuoteItem = { id?: string; service_key?: string | null; service_name: string; item_description?: string | null; unit_label?: string; quantity: number; unit_amount: number; total_amount?: number }
type Installment = { id?: string; installment_number: number; amount: number; due_date: string; status?: string }
type Version = { id: string; version_number: number; commercial_status: CommercialStatus; pdf_object_path?: string | null; document_id?: string | null; created_at: string }
type Audit = { id: string; event_type: string; event_data?: Record<string, unknown>; created_at: string }
type Draft = {
  id: string
  request_id: string
  base_amount: number
  complexity_multiplier: number
  urgency_multiplier: number
  pre_discount_amount: number
  discount_percent: DiscountLevel
  discount_amount: number
  tax_percent: number
  tax_amount: number
  final_amount: number
  custom_final_amount?: number | null
  custom_adjustment_reason?: string | null
  payment_provider: 'none' | 'nubank' | 'mercadopago'
  payment_mode: PaymentMode
  installments: number
  installment_interval_days: number
  first_due_date?: string | null
  payment_fee_total: number
  retentions: RetentionInput
  retention_total: number
  retention_pricing_mode: 'informational' | 'preserve_net'
  estimated_net: number
  fiscal_review_required: boolean
  fiscal_review_confirmed: boolean
  proposal_title?: string | null
  project_service?: string | null
  proposal_description?: string | null
  customer_notes?: string | null
  notes?: string | null
  validity_days: number
  valid_until?: string | null
  commercial_status: CommercialStatus
  current_version: number
  approved_version?: number | null
  status: string
  updated_at: string
  items: QuoteItem[]
  paymentInstallments: Installment[]
}
type Request = {
  id: string
  client_id?: string | null
  protocol: string
  proposal_number: string
  created_at: string
  updated_at?: string
  name: string
  email: string
  phone: string
  company?: string | null
  request_text: string
  status: string
  draft: Draft
  versions: Version[]
  audit: Audit[]
}
type CommercialMetrics = { pipeline: number; drafts: number; negotiation: number; approved: number; total?: number }
type AdminResponse = { requests: Request[]; clients: Client[]; providers: ProviderRule[]; pricingRules: PricingRule[]; metrics?: CommercialMetrics }
type ItemState = { key: string; serviceKey?: string | null; serviceName: string; description: string; unitLabel: string; quantity: number; unitAmount: number }
type EditorState = {
  proposalTitle: string
  projectService: string
  description: string
  customerNotes: string
  notes: string
  items: ItemState[]
  discountPercent: DiscountLevel
  complexityMultiplier: number
  urgencyMultiplier: number
  taxPercent: number
  desiredFinalAmount: number | null
  adjustmentReason: string
  paymentProvider: 'none' | 'nubank' | 'mercadopago'
  paymentMode: PaymentMode
  installments: number
  installmentIntervalDays: number
  firstDueDate: string
  validityDays: number
  retentions: RetentionInput
  retentionPricingMode: 'informational' | 'preserve_net'
  fiscalReviewConfirmed: boolean
}
type Step = 'client' | 'items' | 'values' | 'payment' | 'review' | 'send'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const emptyRetentions: RetentionInput = { iss: 0, irrf: 0, pis: 0, cofins: 0, csll: 0, inss: 0 }
const statusLabels: Record<CommercialStatus, string> = { draft: 'Rascunho', reviewed: 'Revisado', sent: 'Enviado', negotiating: 'Em negociação', approved: 'Aprovado', invoiced: 'Faturado', received: 'Recebido', lost: 'Perdido', cancelled: 'Cancelado' }
const eventLabels: Record<string, string> = {
  quote_created: 'Orçamento criado',
  manual_quote_created: 'Orçamento criado',
  draft_saved: 'Rascunho salvo',
  quote_duplicated: 'Orçamento duplicado',
  custom_final_amount_confirmed: 'Valor final negociado',
  proposal_version_generated: 'Versão e PDF gerados',
  email_prepared: 'E-mail preparado',
  email_shared: 'E-mail compartilhado',
  whatsapp_prepared: 'WhatsApp preparado',
  whatsapp_shared: 'Compartilhado pelo WhatsApp',
  proposal_copied: 'Mensagem e link copiados',
  pdf_downloaded: 'PDF baixado',
  commercial_status_sent: 'Proposta marcada como enviada',
  commercial_status_approved: 'Proposta aprovada',
  commercial_status_negotiating: 'Negociação iniciada',
  commercial_status_lost: 'Proposta marcada como perdida',
  commercial_status_cancelled: 'Proposta cancelada',
}
const today = () => new Date().toISOString().slice(0, 10)
const futureDate = (days: number) => { const value = new Date(); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10) }
const normalizeWhatsApp = (phone: string) => { const digits = phone.replace(/\D/g, ''); return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits }
const safeFileName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_.-]+/g, '_')
const isQuoteReadOnly = (request: Request) => ['approved', 'invoiced', 'received', 'lost', 'cancelled'].includes(request.draft.commercial_status) || request.draft.status === 'suspended'

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
}
const icons = {
  plus: <Icon><path d="M12 5v14M5 12h14"/></Icon>,
  search: <Icon><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></Icon>,
  file: <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16h14a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></Icon>,
  user: <Icon><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></Icon>,
  trash: <Icon><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></Icon>,
  copy: <Icon><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></Icon>,
  download: <Icon><path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/></Icon>,
  send: <Icon><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></Icon>,
  check: <Icon><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></Icon>,
  history: <Icon><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></Icon>,
  back: <Icon><path d="m15 18-6-6 6-6"/></Icon>,
}

async function adminFetch<T>(session: Session, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(quoteAdminEndpoint, {
    method: body ? 'PATCH' : 'GET',
    headers: { 'Content-Type': 'application/json', apikey: hrxPublishableKey, Authorization: `Bearer ${session.access_token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(payload.error || `HTTP_${response.status}`)
  return payload as T
}

function stateFrom(request: Request): EditorState {
  const draft = request.draft
  return {
    proposalTitle: draft.proposal_title || '',
    projectService: draft.project_service || '',
    description: draft.proposal_description || request.request_text || '',
    customerNotes: draft.customer_notes || '',
    notes: draft.notes || '',
    items: (draft.items || []).map((item) => ({
      key: item.id || crypto.randomUUID(),
      serviceKey: item.service_key?.startsWith('manual-') ? null : item.service_key,
      serviceName: item.service_name,
      description: item.item_description || '',
      unitLabel: item.unit_label || 'un.',
      quantity: Number(item.quantity),
      unitAmount: Number(item.unit_amount),
    })),
    discountPercent: Number(draft.discount_percent || 0) as DiscountLevel,
    complexityMultiplier: Number(draft.complexity_multiplier || 1),
    urgencyMultiplier: Number(draft.urgency_multiplier || 1),
    taxPercent: Number(draft.tax_percent || 0),
    desiredFinalAmount: draft.custom_final_amount == null ? null : Number(draft.custom_final_amount),
    adjustmentReason: draft.custom_adjustment_reason || '',
    paymentProvider: draft.payment_provider || 'none',
    paymentMode: draft.payment_mode || 'cash',
    installments: Number(draft.installments || 1),
    installmentIntervalDays: Number(draft.installment_interval_days || 30),
    firstDueDate: draft.first_due_date || today(),
    validityDays: Number(draft.validity_days || 15),
    retentions: draft.retentions || emptyRetentions,
    retentionPricingMode: draft.retention_pricing_mode || 'informational',
    fiscalReviewConfirmed: draft.fiscal_review_confirmed,
  }
}

function payloadFrom(state: EditorState) {
  return {
    proposalTitle: state.proposalTitle,
    projectService: state.projectService,
    description: state.description,
    customerNotes: state.customerNotes,
    notes: state.notes,
    items: state.items.map((item) => ({ serviceKey: item.serviceKey || null, serviceName: item.serviceName, description: item.description, unitLabel: item.unitLabel, quantity: item.quantity, unitAmount: item.unitAmount })),
    discountPercent: state.discountPercent,
    complexityMultiplier: state.complexityMultiplier,
    urgencyMultiplier: state.urgencyMultiplier,
    taxPercent: state.taxPercent,
    desiredFinalAmount: state.desiredFinalAmount,
    adjustmentReason: state.adjustmentReason || null,
    paymentProvider: state.paymentProvider,
    paymentMode: state.paymentMode,
    installments: state.paymentMode === 'cash' ? 1 : state.installments,
    installmentIntervalDays: state.installmentIntervalDays,
    firstDueDate: state.firstDueDate,
    validityDays: state.validityDays,
    retentions: state.retentions,
    retentionPricingMode: state.retentionPricingMode,
    fiscalReviewConfirmed: state.fiscalReviewConfirmed,
  }
}

export default function AdminQuotes() {
  const route = useAdminRoute()
  const routeQuoteId = route.subroute?.id === 'quote-detail' || route.subroute?.id === 'quote-edit' ? route.params.orcamentoId ?? null : null
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<AdminResponse>({ requests: [], clients: [], providers: [], pricingRules: [] })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | CommercialStatus>('all')
  const [mobileDetail, setMobileDetail] = useState(Boolean(routeQuoteId))
  const [newOpen, setNewOpen] = useState(false)
  useEffect(() => {
    void hrxSupabase.auth.getSession().then(({ data: auth }) => { setSession(auth.session); setChecking(false) })
    const { data: listener } = hrxSupabase.auth.onAuthStateChange((_event, next) => { setSession(next); setChecking(false) })
    return () => listener.subscription.unsubscribe()
  }, [])
  const load = async (current = session, select?: string) => {
    if (!current) return
    setLoading(true); setError('')
    try {
      const response = await adminFetch<AdminResponse>(current)
      setData(response)
      const targetId = select || routeQuoteId
      setSelectedId((currentId) => targetId ? (response.requests.some((item) => item.id === targetId) ? targetId : null) : (currentId && response.requests.some((item) => item.id === currentId) ? currentId : response.requests[0]?.id || null))
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : ''
      setError(code === 'mfa_required' ? 'Confirme o MFA para acessar o módulo comercial.' : 'Não foi possível carregar os orçamentos.')
    } finally { setLoading(false) }
  }
  useEffect(() => { if (session) void load(session) }, [session])
  useEffect(() => {
    if (routeQuoteId) {
      setSelectedId(data.requests.some((item) => item.id === routeQuoteId) ? routeQuoteId : null)
      setMobileDetail(true)
      return
    }
    setMobileDetail(false)
    setSelectedId((currentId) => currentId && data.requests.some((item) => item.id === currentId) ? currentId : data.requests[0]?.id || null)
  }, [data.requests, routeQuoteId])
  const selected = data.requests.find((item) => item.id === selectedId) || null
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR')
    return data.requests.filter((item) => {
      const match = !term || [item.proposal_number, item.protocol, item.name, item.company, item.email].some((value) => value?.toLocaleLowerCase('pt-BR').includes(term))
      return match && (filter === 'all' || item.draft.commercial_status === filter)
    })
  }, [data.requests, query, filter])
  const fallbackMetrics = useMemo<CommercialMetrics>(() => ({
    pipeline: data.requests.filter((item) => !(item.draft?.status === 'rejected' || item.draft?.status === 'suspended') && !['lost', 'cancelled', 'received'].includes(item.draft.commercial_status)).reduce((sum, item) => sum + Number(item.draft.final_amount || 0), 0),
    drafts: data.requests.filter((item) => item.draft.commercial_status === 'draft').length,
    negotiation: data.requests.filter((item) => ['reviewed', 'sent', 'negotiating'].includes(item.draft.commercial_status)).length,
    approved: data.requests.filter((item) => ['approved', 'invoiced', 'received'].includes(item.draft.commercial_status)).length,
  }), [data.requests])
  const metrics = data.metrics ?? fallbackMetrics
  const mutate = async <T,>(body: Record<string, unknown>, select?: string) => {
    if (!session) throw new Error('unauthorized')
    const result = await adminFetch<T>(session, body)
    const createdId = (result as { request?: { id?: string } })?.request?.id
    await load(session, select || createdId)
    if (body.action === 'delete_draft') navigateAdmin('quotes')
    return result
  }
  const openQuote = (request: Request) => {
    setSelectedId(request.id)
    setMobileDetail(true)
    const subroute = isQuoteReadOnly(request) ? 'quote-detail' : 'quote-edit'
    navigateAdminPath(buildAdminSubroutePath('quotes', subroute, { orcamentoId: request.id }))
  }
  const returnToQuoteList = () => {
    setMobileDetail(false)
    navigateAdmin('quotes')
  }
  const quoteNotFound = Boolean(routeQuoteId && !loading && !selected)
  if (checking || !session) return <section className="quote-module-loading" role="status">Validando acesso administrativo…</section>
  return <section className={`admin-live-shell quote-commercial-shell${mobileDetail ? ' is-mobile-detail-open' : ''}`}>
    <section className="admin-exec-main">
      <header className="admin-exec-topbar quote-topbar"><div><span className="admin-section-kicker">OPERAÇÃO COMERCIAL</span><h1>Orçamentos e propostas</h1></div><div><button className="quote-secondary" onClick={() => void load()} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</button><button className="quote-primary" onClick={() => setNewOpen(true)}>{icons.plus}Novo orçamento</button></div></header>
      {error && <div className="admin-global-error" role="alert">{error}</div>}
      <section className="admin-exec-metrics quote-metrics"><article><span>Pipeline comercial</span><strong>{currency.format(metrics.pipeline)}</strong><small>Propostas em aberto</small></article><article><span>Rascunhos</span><strong>{metrics.drafts}</strong><small>Podem ser continuados</small></article><article><span>Em negociação</span><strong>{metrics.negotiation}</strong><small>Revisadas ou enviadas</small></article><article><span>Aprovadas</span><strong>{metrics.approved}</strong><small>Preparadas para o financeiro</small></article></section>
      <div className="admin-workspace quote-workspace">
        <aside className="admin-queue quote-queue">
          <div className="admin-queue-header"><div><strong>Propostas</strong><span>{visible.length}</span></div><label className="admin-search">{icons.search}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cliente, CNPJ ou número" /></label><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">Todos os estados</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="admin-queue-list">{visible.map((request) => <button type="button" className={selectedId === request.id ? 'admin-lead is-active' : 'admin-lead'} key={request.id} onClick={() => openQuote(request)}><div className="admin-lead-top"><span className={`quote-status-dot is-${request.draft.commercial_status}`}/><span>{statusLabels[request.draft.commercial_status]}</span><time>{new Date(request.draft.updated_at || request.created_at).toLocaleDateString('pt-BR')}</time></div><strong>{request.company || request.name}</strong><small>{request.draft.proposal_title || 'Proposta ainda sem título'}</small><div className="admin-lead-bottom"><span>{request.proposal_number}</span><b>{currency.format(Number(request.draft.final_amount || 0))}</b></div></button>)}{!loading && !visible.length && <div className="quote-empty">{icons.file}<strong>Nenhuma proposta encontrada</strong><span>Crie um orçamento usando um cliente real.</span></div>}</div>
        </aside>
        <section className="admin-detail quote-detail">{selected ? <QuoteEditor key={selected.id} request={selected} clients={data.clients} providers={data.providers} pricingRules={data.pricingRules} session={session} onMutate={mutate} onError={setError} onBack={returnToQuoteList} /> : quoteNotFound ? <div className="quote-empty"><strong>Orçamento não encontrado</strong><span>A proposta informada na URL não existe ou não está disponível para este acesso.</span><button type="button" className="quote-secondary" onClick={returnToQuoteList}>Voltar para propostas</button></div> : <div className="quote-empty">{icons.file}<strong>Selecione uma proposta</strong><span>Abra um orçamento para continuar o fluxo comercial.</span></div>}</section>
      </div>
    </section>
    {newOpen && <NewQuoteModal clients={data.clients} onClose={() => setNewOpen(false)} onCreate={async (payload) => { const result = await mutate<{ request: { id: string } }>({ action: 'create_quote', ...payload }); setNewOpen(false); setSelectedId(result.request.id); setMobileDetail(true); navigateAdminPath(buildAdminSubroutePath('quotes', 'quote-edit', { orcamentoId: result.request.id })) }} onClientCreated={async () => { await load(session) }}/>} 
  </section>
}

function NewQuoteModal({ clients, onClose, onCreate, onClientCreated }: { clients: Client[]; onClose: () => void; onCreate: (payload: { clientId: string; proposalTitle: string; scope: string }) => Promise<void>; onClientCreated: (id?: string) => Promise<void> }) {
  const [search, setSearch] = useState('')
  const [clientId, setClientId] = useState('')
  const [proposalTitle, setProposalTitle] = useState('')
  const [scope, setScope] = useState('')
  const [clientForm, setClientForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const results = clients.filter((client) => !search || [client.name, client.company, client.email, client.phone, client.document].some((value) => value?.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))).slice(0, 8)
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!clientId) return; setBusy(true); try { await onCreate({ clientId, proposalTitle, scope }) } finally { setBusy(false) } }
  return <div className="quote-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="quote-modal quote-new-modal" onSubmit={submit}><header><div><span>NOVO ORÇAMENTO</span><h2>Comece pelo cliente</h2><p>Pesquise a base oficial ou cadastre sem perder o preenchimento.</p></div><button type="button" onClick={onClose}>×</button></header><label className="quote-field">Cliente<input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, razão social, CPF/CNPJ, e-mail ou telefone" /></label><div className="quote-client-results">{results.map((client) => <button type="button" className={clientId === client.id ? 'is-selected' : ''} key={client.id} onClick={() => { setClientId(client.id); setSearch(client.company || client.name) }}><span>{icons.user}</span><div><strong>{client.company || client.name}</strong><small>{[client.name, client.document, client.email || client.phone].filter(Boolean).join(' · ')}</small></div>{clientId === client.id && icons.check}</button>)}</div><button className="quote-inline-create" type="button" onClick={() => setClientForm(true)}>{icons.plus}Cadastrar novo cliente</button><div className="quote-form-grid"><label className="quote-field">Título da proposta<input value={proposalTitle} onChange={(event) => setProposalTitle(event.target.value)} placeholder="Ex.: Implantação e consultoria" /></label><label className="quote-field is-wide">Escopo inicial<textarea rows={4} value={scope} onChange={(event) => setScope(event.target.value)} placeholder="Contexto e necessidade do cliente."/></label></div><footer><button type="button" className="quote-secondary" onClick={onClose}>Cancelar</button><button className="quote-primary" disabled={!clientId || busy}>{busy ? 'Criando…' : 'Criar rascunho'}</button></footer></form>{clientForm && <AdminClientForm onClose={() => setClientForm(false)} onCreated={async (id) => { if (id) setClientId(id); await onClientCreated(id) }}/>}</div>
}

function QuoteEditor({ request, clients, providers, pricingRules, session, onMutate, onError, onBack }: { request: Request; clients: Client[]; providers: ProviderRule[]; pricingRules: PricingRule[]; session: Session; onMutate: <T>(body: Record<string, unknown>, select?: string) => Promise<T>; onError: (value: string) => void; onBack: () => void }) {
  const [state, setState] = useState(() => stateFrom(request))
  const [step, setStep] = useState<Step>('client')
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved')
  const [busy, setBusy] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [adjustmentOpen, setAdjustmentOpen] = useState(false)
  const [desiredInput, setDesiredInput] = useState(String(state.desiredFinalAmount || ''))
  const [adjustmentReason, setAdjustmentReason] = useState(state.adjustmentReason)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTo, setEmailTo] = useState(request.email || '')
  const [emailSubject, setEmailSubject] = useState(`Proposta Comercial HRX Solutions — ${request.proposal_number}`)
  const [emailBody, setEmailBody] = useState(`Olá, ${request.name}.\n\nSegue a proposta comercial ${request.proposal_number} da HRX Solutions. Ela permanece válida até ${new Date(request.draft.valid_until || futureDate(state.validityDays)).toLocaleDateString('pt-BR')}.\n\nFicamos à disposição para qualquer esclarecimento.\n\nHRX Solutions`)
  const hydrated = useRef(false)
  const linkedClient = clients.find((item) => item.id === request.client_id)
  const client = { name: linkedClient?.name || request.name, company: linkedClient?.company || request.company, email: linkedClient?.email || request.email, phone: linkedClient?.phone || request.phone, document: linkedClient?.document || null }
  const isReadOnly = isQuoteReadOnly(request)
  const baseAmount = state.items.reduce((sum, item) => sum + (toCents(item.unitAmount) * item.quantity) / 100, 0)
  const preview = calculateQuotePreview({ baseAmount, complexityMultiplier: state.complexityMultiplier, urgencyMultiplier: state.urgencyMultiplier, discountPercent: state.discountPercent, taxPercent: state.taxPercent, desiredFinalAmount: state.desiredFinalAmount, paymentProvider: state.paymentProvider, installments: state.paymentMode === 'cash' ? 1 : state.installments, providers, retentions: state.retentions, retentionPricingMode: state.retentionPricingMode, fiscalReviewConfirmed: state.fiscalReviewConfirmed })
  const schedule = buildInstallmentSchedule({ total: preview.finalAmount, count: state.paymentMode === 'cash' ? 1 : state.installments, firstDueDate: state.firstDueDate, intervalDays: state.installmentIntervalDays })
  const validUntil = futureDate(state.validityDays)
  const validation = [!state.proposalTitle.trim() && 'Informe o título da proposta.', !state.items.length && 'Adicione pelo menos um item.', state.items.some((item) => !item.serviceName.trim() || item.quantity <= 0 || item.unitAmount <= 0) && 'Revise descrição, quantidade e valor dos itens.', preview.finalAmount <= 0 && 'O total precisa ser maior que zero.', !state.firstDueDate && 'Informe o primeiro vencimento.', schedule.reduce((sum, item) => sum + toCents(item.amount), 0) !== toCents(preview.finalAmount) && 'A soma das parcelas não fecha com o total.'].filter(Boolean) as string[]
  const patch = (update: Partial<EditorState>) => {
    if (isReadOnly) { onError('Esta proposta está encerrada ou suspensa. Duplique-a para iniciar uma nova negociação.'); return }
    setState((current) => ({ ...current, ...update })); setSaveState('dirty')
  }
  const save = async () => {
    if (saveState === 'saving') return
    setSaveState('saving')
    try {
      await onMutate({ action: 'save_quote', requestId: request.id, ...payloadFrom(state) }, request.id)
      setSaveState('saved')
    } catch (cause) {
      setSaveState('error')
      const code = cause instanceof Error ? cause.message : ''
      const message: Record<string, string> = { invalid_items: 'Revise os itens e valores.', invalid_desired_final: 'O valor desejado deve ser maior que zero e não pode exceder o calculado.', adjustment_reason_required: 'Informe a justificativa comercial do ajuste.', quote_is_read_only: 'Este orçamento está encerrado e não pode ser editado.' }
      onError(message[code] || 'Não foi possível salvar o rascunho.')
      throw cause
    }
  }
  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return }
    if (saveState !== 'dirty' || (state.desiredFinalAmount != null && state.adjustmentReason.length < 8)) return
    const timer = window.setTimeout(() => { void save() }, 1600)
    return () => window.clearTimeout(timer)
  }, [state, saveState])
  const addManual = () => patch({ items: [...state.items, { key: crypto.randomUUID(), serviceKey: null, serviceName: '', description: '', unitLabel: 'un.', quantity: 1, unitAmount: 0 }] })
  const addCatalog = (key: string) => {
    const rule = pricingRules.find((item) => item.service_key === key)
    if (!rule || state.items.some((item) => item.serviceKey === key)) return
    patch({ items: [...state.items, { key: crypto.randomUUID(), serviceKey: key, serviceName: rule.service_name, description: rule.invoice_description || '', unitLabel: 'un.', quantity: 1, unitAmount: Number(rule.base_amount) }] })
  }
  const updateItem = (key: string, update: Partial<ItemState>) => patch({ items: state.items.map((item) => item.key === key ? { ...item, ...update } : item) })
  const moveItem = (index: number, delta: number) => { const next = [...state.items]; const target = index + delta; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; patch({ items: next }) }
  const pdfData = (draft: boolean): ProposalPdfData => ({
    proposalNumber: request.proposal_number,
    protocol: request.protocol,
    version: draft ? Math.max(1, request.draft.current_version + 1) : request.draft.current_version,
    draft,
    createdAt: today(),
    validUntil,
    title: state.proposalTitle,
    description: state.description,
    customerNotes: state.customerNotes,
    client,
    items: state.items.map((item) => ({ serviceName: item.serviceName, description: item.description, unitLabel: item.unitLabel, quantity: item.quantity, unitAmount: item.unitAmount, totalAmount: Math.round(toCents(item.unitAmount) * item.quantity) / 100 })),
    subtotal: preview.preDiscountAmount,
    discountAmount: preview.discountAmount + preview.customAdjustmentAmount,
    discountPercent: state.desiredFinalAmount == null ? state.discountPercent : preview.customAdjustmentPercent,
    taxAmount: preview.taxAmount,
    taxPercent: state.taxPercent,
    finalAmount: preview.finalAmount,
    paymentMode: state.paymentMode,
    installments: schedule,
  })
  const downloadBlob = (blob: Blob, suffix: string) => { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = safeFileName(`${request.proposal_number}_${suffix}.pdf`); anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
  const downloadDraft = async () => { setBusy('pdf'); try { downloadBlob(await generateProposalPdf(pdfData(true)), 'RASCUNHO') } finally { setBusy('') } }
  const finalize = async () => {
    if (validation.length) {
      setStep('review')
      window.requestAnimationFrame(() => {
        document.querySelector('.quote-validation')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      return
    }
    setBusy('finalize')
    try {
      if (saveState !== 'saved') await save()
      const version = request.draft.current_version + 1
      const blob = await generateProposalPdf({ ...pdfData(false), version })
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
      const checksum = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
      const objectPath = `commercial/proposals/${request.id}/${safeFileName(request.proposal_number)}_V${String(version).padStart(2, '0')}.pdf`
      const { error: uploadError } = await hrxSupabase.storage.from('hrx-documents').upload(objectPath, blob, { contentType: 'application/pdf', upsert: false })
      if (uploadError) throw new Error('pdf_upload_failed')
      await onMutate({ action: 'finalize', requestId: request.id, pdfObjectPath: objectPath, checksumSha256: checksum, sizeBytes: blob.size }, request.id)
      downloadBlob(blob, `V${String(version).padStart(2, '0')}`)
      setStep('send')
    } catch (cause) {
      onError(cause instanceof Error && cause.message === 'pdf_upload_failed' ? 'O PDF não pôde ser armazenado na Central.' : 'Não foi possível finalizar e versionar a proposta.')
    } finally { setBusy('') }
  }
  const confirmAdjustment = async () => {
    const desired = Number(desiredInput.replace(',', '.'))
    if (!desired || desired > preview.calculatedAmount || adjustmentReason.trim().length < 8) { onError('Informe um valor válido e uma justificativa com pelo menos 8 caracteres.'); return }
    const { data: aal, error } = await hrxSupabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error || aal.currentLevel !== 'aal2') { onError('Confirme o MFA/AAL2 antes de ajustar manualmente o valor.'); return }
    patch({ desiredFinalAmount: desired, adjustmentReason: adjustmentReason.trim() }); setAdjustmentOpen(false)
  }
  const latest = request.versions[0]
  const signedLink = async () => {
    if (!latest?.pdf_object_path) throw new Error('version_required')
    const { data, error } = await hrxSupabase.storage.from('hrx-documents').createSignedUrl(latest.pdf_object_path, 604800)
    if (error || !data?.signedUrl) throw new Error('signed_url_failed')
    return data.signedUrl
  }
  const log = (eventType: string, eventData?: Record<string, unknown>) => onMutate({ action: 'log_event', requestId: request.id, eventType, eventData }, request.id)
  const openEmail = () => { if (!request.draft.current_version) { onError('Finalize uma versão antes de preparar o envio.'); return } setEmailOpen(true) }
  const prepareEmail = async () => { await log('email_prepared', { recipient: emailTo, version: request.draft.current_version, channel: 'mailto' }); window.location.href = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`; setEmailOpen(false) }
  const downloadOfficialBlob = async () => {
    if (!latest?.pdf_object_path) throw new Error('version_required')
    const { data, error } = await hrxSupabase.storage.from('hrx-documents').download(latest.pdf_object_path)
    if (error || !data) throw new Error('download_failed')
    return data
  }
  const shareEmailNative = async () => {
    try {
      const blob = await downloadOfficialBlob()
      const file = new File([blob], `${request.proposal_number}_V${String(request.draft.current_version).padStart(2, '0')}.pdf`, { type: 'application/pdf' })
      if (!navigator.share || (navigator.canShare && !navigator.canShare({ files: [file] }))) throw new Error('share_unavailable')
      await navigator.share({ title: emailSubject, text: emailBody, files: [file] })
      await log('email_shared', { recipient: emailTo, version: request.draft.current_version, mode: 'native_share' })
      setEmailOpen(false)
    } catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) onError('O compartilhamento nativo com PDF não está disponível neste dispositivo.') }
  }
  const downloadOfficial = async () => { try { const blob = await downloadOfficialBlob(); downloadBlob(blob, `V${String(request.draft.current_version).padStart(2, '0')}`); await log('pdf_downloaded', { version: request.draft.current_version }) } catch { onError('Não foi possível baixar o PDF oficial.') } }
  const shareWhatsApp = async () => {
    if (!request.draft.current_version) { onError('Finalize uma versão antes de compartilhar.'); return }
    setBusy('share')
    try {
      const link = await signedLink()
      const message = `Olá, ${request.name}. Segue a proposta comercial ${request.proposal_number} da HRX Solutions: ${link}`
      const blob = await downloadOfficialBlob()
      const file = new File([blob], `${request.proposal_number}.pdf`, { type: 'application/pdf' })
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: request.proposal_number, text: message, files: [file] })
        await log('whatsapp_shared', { version: request.draft.current_version, mode: 'native_share' })
      } else {
        window.open(`https://wa.me/${normalizeWhatsApp(request.phone)}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
        await log('whatsapp_prepared', { version: request.draft.current_version, signedUrlExpiresIn: 604800 })
      }
    } catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) onError('Não foi possível preparar o compartilhamento agora.') } finally { setBusy('') }
  }
  const copy = async () => { const link = await signedLink(); await navigator.clipboard.writeText(`Olá, ${request.name}. Segue a proposta ${request.proposal_number}: ${link}`); await log('proposal_copied', { version: request.draft.current_version, signedUrlExpiresIn: 604800 }) }
  const setStatus = async (status: CommercialStatus, note?: string) => { setBusy('status'); try { await onMutate({ action: 'set_status', requestId: request.id, status, channel: 'administrative', note: note || '' }, request.id) } catch { onError('Essa transição de estado não é permitida no momento.') } finally { setBusy('') } }
  const steps: Array<[Step, string]> = [['client', 'Cliente'], ['items', 'Itens'], ['values', 'Valores'], ['payment', 'Pagamento'], ['review', 'Revisão'], ['send', 'Envio']]
  return <div className="quote-editor">
    <header className="quote-editor-header"><button className="quote-back" onClick={onBack}>{icons.back}</button><div><span>{request.proposal_number}</span><h2>{state.proposalTitle || 'Proposta sem título'}</h2><p>{request.company || request.name}</p></div><div className="quote-header-value"><span className={`quote-status is-${request.draft.commercial_status}`}>{statusLabels[request.draft.commercial_status]}</span><strong>{currency.format(preview.finalAmount)}</strong></div></header>
    <nav className="quote-steps">{steps.map(([value, label], index) => <button key={value} className={step === value ? 'is-active' : ''} onClick={() => setStep(value)}><span>{index + 1}</span>{label}</button>)}</nav>
    <div className="quote-editor-scroll">{isReadOnly && <div className="quote-readonly-banner" role="status">Proposta somente leitura. O documento e o histórico permanecem preservados; use Duplicar para uma nova negociação.</div>}<div className="quote-editor-main">
      <section className="quote-stage">
        {step === 'client' && <div className="quote-section"><SectionTitle eyebrow="DADOS GERAIS" title="Cliente e identificação" text="O cliente vem da base oficial; a proposta guarda apenas o snapshot documental ao versionar."/><div className="quote-client-card"><span>{icons.user}</span><div><strong>{request.company || request.name}</strong><small>{[request.name, request.email, request.phone].filter(Boolean).join(' · ')}</small><em>Cliente vinculado à base real</em></div></div><div className="quote-form-grid"><label className="quote-field">Título da proposta<input value={state.proposalTitle} onChange={(event) => patch({ proposalTitle: event.target.value })}/></label><label className="quote-field">Projeto / serviço<input value={state.projectService} onChange={(event) => patch({ projectService: event.target.value })}/></label><label className="quote-field is-wide">Descrição / escopo<textarea rows={6} value={state.description} onChange={(event) => patch({ description: event.target.value })}/></label><label className="quote-field">Validade<select value={state.validityDays} onChange={(event) => patch({ validityDays: Number(event.target.value) })}><option value={7}>7 dias</option><option value={10}>10 dias</option><option value={15}>15 dias</option><option value={30}>30 dias</option><option value={60}>60 dias</option><option value={90}>90 dias</option></select><small>Válida até {new Date(`${validUntil}T12:00:00`).toLocaleDateString('pt-BR')}</small></label><label className="quote-field is-wide">Observações para o cliente<textarea rows={4} value={state.customerNotes} onChange={(event) => patch({ customerNotes: event.target.value })}/></label></div></div>}
        {step === 'items' && <div className="quote-section"><SectionTitle eyebrow="COMPOSIÇÃO" title="Itens do orçamento" text="Adicione serviços do catálogo ou itens manuais. Os cálculos usam precisão em centavos." actions={<><select className="quote-catalog-select" value="" onChange={(event) => addCatalog(event.target.value)}><option value="">Adicionar do catálogo…</option>{pricingRules.map((rule) => <option value={rule.service_key} key={rule.service_key}>{rule.service_name} · {currency.format(rule.base_amount)}</option>)}</select><button className="quote-secondary" onClick={addManual}>{icons.plus}Item manual</button></>}/><div className="quote-items-table"><div className="quote-items-head"><span>Descrição</span><span>Qtd.</span><span>Unidade</span><span>Valor unitário</span><span>Subtotal</span><span/></div>{state.items.map((item, index) => <div className="quote-item-row" key={item.key}><div><input aria-label="Descrição do item" value={item.serviceName} disabled={Boolean(item.serviceKey)} onChange={(event) => updateItem(item.key, { serviceName: event.target.value })}/><input className="quote-item-description" aria-label="Detalhe do item" value={item.description} onChange={(event) => updateItem(item.key, { description: event.target.value })} placeholder="Escopo ou detalhe opcional"/></div><input aria-label="Quantidade" type="number" min=".01" step=".01" value={item.quantity} onChange={(event) => updateItem(item.key, { quantity: Number(event.target.value) })}/><input aria-label="Unidade" value={item.unitLabel} onChange={(event) => updateItem(item.key, { unitLabel: event.target.value })}/><input aria-label="Valor unitário" type="number" min="0" step=".01" value={item.unitAmount} disabled={Boolean(item.serviceKey)} onChange={(event) => updateItem(item.key, { unitAmount: Number(event.target.value) })}/><strong>{currency.format(Math.round(toCents(item.unitAmount) * item.quantity) / 100)}</strong><div className="quote-item-actions"><button aria-label="Mover item para cima" disabled={index === 0} onClick={() => moveItem(index, -1)}>↑</button><button aria-label="Mover item para baixo" disabled={index === state.items.length - 1} onClick={() => moveItem(index, 1)}>↓</button><button aria-label="Remover item" onClick={() => patch({ items: state.items.filter((current) => current.key !== item.key) })}>{icons.trash}</button></div></div>)}{!state.items.length && <div className="quote-empty">{icons.plus}<strong>Nenhum item adicionado</strong><span>Use o catálogo ou crie um item manual.</span></div>}</div></div>}
        {step === 'values' && <div className="quote-section"><SectionTitle eyebrow="NEGOCIAÇÃO" title="Valores, desconto e imposto" text="A alíquota é configurável por proposta e nunca é tratada como regra fiscal universal."/><div className="quote-values-grid"><article><h3>Desconto percentual</h3><div className="quote-discounts">{([0, 5, 10, 15, 20] as DiscountLevel[]).map((value) => <button className={state.discountPercent === value ? 'is-active' : ''} onClick={() => patch({ discountPercent: value, desiredFinalAmount: null, adjustmentReason: '' })} key={value}>{value}%</button>)}</div><p>20% permanece sinalizado para revisão comercial.</p></article><article><h3>Imposto estimado</h3><label className="quote-field">Alíquota (%)<input type="number" min="0" max="99.99" step=".01" value={state.taxPercent} onChange={(event) => patch({ taxPercent: Number(event.target.value) })}/><small>{state.taxPercent.toLocaleString('pt-BR')}% → {currency.format(preview.taxAmount)}</small></label></article><article className="quote-custom-value"><h3>Valor final desejado</h3>{state.desiredFinalAmount == null ? <><p>Valor calculado: <strong>{currency.format(preview.calculatedAmount)}</strong></p><button className="quote-secondary" onClick={() => { setDesiredInput(String(preview.finalAmount)); setAdjustmentReason(''); setAdjustmentOpen(true) }}>Definir valor final</button></> : <><p>Valor negociado: <strong>{currency.format(state.desiredFinalAmount)}</strong></p><small>Desconto adicional de {currency.format(preview.customAdjustmentAmount)} ({preview.customAdjustmentPercent.toLocaleString('pt-BR')}%).</small><button className="quote-text-button" onClick={() => patch({ desiredFinalAmount: null, adjustmentReason: '' })}>Remover ajuste</button></>}</article><article><h3>Parâmetros internos</h3><div className="quote-form-grid"><label className="quote-field">Complexidade<select value={state.complexityMultiplier} onChange={(event) => patch({ complexityMultiplier: Number(event.target.value) })}><option value={1}>Padrão · 1x</option><option value={1.25}>Intermediária · 1,25x</option><option value={1.5}>Alta · 1,5x</option><option value={2}>Especial · 2x</option></select></label><label className="quote-field">Urgência<select value={state.urgencyMultiplier} onChange={(event) => patch({ urgencyMultiplier: Number(event.target.value) })}><option value={1}>Normal · 1x</option><option value={1.15}>Prioritária · 1,15x</option><option value={1.3}>Urgente · 1,3x</option></select></label></div></article></div></div>}
        {step === 'payment' && <div className="quote-section"><SectionTitle eyebrow="CONDIÇÃO DE PAGAMENTO" title="Vencimentos previstos" text="Este cronograma prepara o futuro Contas a Receber, sem gerar cobrança ou baixa financeira."/><div className="quote-payment-options"><button className={state.paymentMode === 'cash' ? 'is-active' : ''} onClick={() => patch({ paymentMode: 'cash', installments: 1 })}><strong>À vista</strong><span>Uma parcela prevista</span></button><button className={state.paymentMode === 'installments' ? 'is-active' : ''} onClick={() => patch({ paymentMode: 'installments', installments: Math.max(2, state.installments) })}><strong>Parcelado</strong><span>Até 24 parcelas previstas</span></button></div><div className="quote-form-grid"><label className="quote-field">Primeiro vencimento<input type="date" value={state.firstDueDate} onChange={(event) => patch({ firstDueDate: event.target.value })}/></label>{state.paymentMode === 'installments' && <><label className="quote-field">Parcelas<input type="number" min="2" max="24" value={state.installments} onChange={(event) => patch({ installments: Math.min(24, Math.max(2, Number(event.target.value))) })}/></label><label className="quote-field">Intervalo (dias)<input type="number" min="1" max="365" value={state.installmentIntervalDays} onChange={(event) => patch({ installmentIntervalDays: Number(event.target.value) })}/></label></>}<label className="quote-field">Meio previsto<select value={state.paymentProvider} onChange={(event) => patch({ paymentProvider: event.target.value as EditorState['paymentProvider'] })}><option value="none">A definir / sem taxa</option>{providers.map((provider) => <option value={provider.provider} key={provider.provider}>{provider.display_name}</option>)}</select></label></div><div className="quote-installments">{schedule.map((item) => <article key={item.installmentNumber}><span>{item.installmentNumber}</span><div><strong>{currency.format(item.amount)}</strong><small>{new Date(`${item.dueDate}T12:00:00`).toLocaleDateString('pt-BR')}</small></div></article>)}</div><p className="quote-schedule-total">Soma prevista <strong>{currency.format(schedule.reduce((sum, item) => sum + item.amount, 0))}</strong> · Total da proposta <strong>{currency.format(preview.finalAmount)}</strong></p></div>}
        {step === 'review' && <div className="quote-section"><SectionTitle eyebrow="REVISÃO FINAL" title="Confira antes de finalizar" text="Finalizar gera uma nova versão imutável, o PDF oficial e o registro na Central de Documentos."/><div className="quote-review-card"><header><div><span>{request.proposal_number}</span><h3>{state.proposalTitle || 'Título pendente'}</h3><p>{request.company || request.name}</p></div><strong>{currency.format(preview.finalAmount)}</strong></header><dl><div><dt>Itens</dt><dd>{state.items.length}</dd></div><div><dt>Subtotal</dt><dd>{currency.format(preview.preDiscountAmount)}</dd></div><div><dt>Desconto</dt><dd>− {currency.format(preview.discountAmount + preview.customAdjustmentAmount)}</dd></div><div><dt>Imposto</dt><dd>+ {currency.format(preview.taxAmount)}</dd></div><div><dt>Pagamento</dt><dd>{state.paymentMode === 'cash' ? 'À vista' : `${schedule.length} parcelas`}</dd></div><div><dt>Validade</dt><dd>{new Date(`${validUntil}T12:00:00`).toLocaleDateString('pt-BR')}</dd></div></dl>{validation.length > 0 && <div className="quote-validation" role="alert"><strong>Antes de finalizar:</strong>{validation.map((item) => <span key={item}>• {item}</span>)}</div>}<footer><button className="quote-secondary" onClick={() => setStep('items')}>Voltar e editar</button><button className="quote-secondary" onClick={() => void downloadDraft()} disabled={busy === 'pdf'}>{icons.download}{busy === 'pdf' ? 'Gerando…' : 'Baixar rascunho'}</button><button className="quote-primary" disabled={Boolean(validation.length) || busy === 'finalize'} onClick={() => void finalize()}>{icons.check}{busy === 'finalize' ? 'Gerando versão…' : 'Finalizar proposta'}</button></footer></div></div>}
        {step === 'send' && <div className="quote-section"><SectionTitle eyebrow="VERSÕES E ENVIO" title="Documento oficial" text="O envio sempre exige confirmação. Links compartilhados são temporários e assinados."/><div className="quote-send-grid"><article><h3>Versões</h3>{request.versions.map((version) => <div className="quote-version" key={version.id}><span>{icons.file}</span><div><strong>Versão {version.version_number}</strong><small>{new Date(version.created_at).toLocaleString('pt-BR')}</small></div><span className={`quote-status is-${version.commercial_status}`}>{statusLabels[version.commercial_status]}</span></div>)}{!request.versions.length && <p>Nenhuma versão oficial gerada.</p>}</article><article><h3>Compartilhar</h3><div className="quote-send-actions"><button className="quote-primary" disabled={!request.draft.current_version} onClick={openEmail}>{icons.send}Enviar por e-mail</button><button className="quote-secondary" disabled={!request.draft.current_version || !request.phone || busy === 'share'} onClick={() => void shareWhatsApp()}>{icons.send}WhatsApp</button><button className="quote-secondary" disabled={!request.draft.current_version} onClick={() => void downloadOfficial()}>{icons.download}Baixar PDF</button><button className="quote-secondary" disabled={!request.draft.current_version} onClick={() => void copy()}>{icons.copy}Copiar mensagem/link</button></div><small>O e-mail usa o aplicativo configurado no dispositivo; nenhuma senha do iCloud fica no frontend.</small></article><article><h3>Estado comercial</h3><div className="quote-status-actions">{request.draft.commercial_status === 'reviewed' && <button onClick={() => void setStatus('sent')}>Marcar como enviado</button>}{['reviewed', 'sent', 'negotiating'].includes(request.draft.commercial_status) && <><button onClick={() => void setStatus('approved', 'Aprovação registrada pelo administrador')}>Aprovar proposta</button><button onClick={() => void setStatus('lost')}>Marcar como perdida</button></>} {['draft', 'reviewed', 'sent', 'negotiating'].includes(request.draft.commercial_status) && <button className="is-danger" onClick={() => void setStatus('cancelled')}>Cancelar</button>}</div></article><article><h3>Histórico</h3><div className="quote-history">{request.audit.slice(0, 20).map((event) => <div key={event.id}><span>{icons.history}</span><div><strong>{eventLabels[event.event_type] || event.event_type.replaceAll('_', ' ')}</strong><small>{new Date(event.created_at).toLocaleString('pt-BR')}</small></div></div>)}</div></article></div></div>}
      </section>
      <aside className="quote-summary"><span>RESUMO FINANCEIRO</span><h3>{request.proposal_number}</h3><dl><div><dt>Subtotal</dt><dd>{currency.format(preview.preDiscountAmount)}</dd></div><div><dt>Desconto</dt><dd>− {currency.format(preview.discountAmount)}</dd></div>{preview.customAdjustmentAmount > 0 && <div><dt>Ajuste negociado</dt><dd>− {currency.format(preview.customAdjustmentAmount)}</dd></div>}<div><dt>Imposto ({state.taxPercent.toLocaleString('pt-BR')}%)</dt><dd>+ {currency.format(preview.taxAmount)}</dd></div>{preview.paymentFeeTotal > 0 && <div><dt>Taxas previstas</dt><dd>+ {currency.format(preview.paymentFeeTotal)}</dd></div>}<div className="is-total"><dt>Total final</dt><dd>{currency.format(preview.finalAmount)}</dd></div></dl><p>{state.paymentMode === 'cash' ? 'Pagamento à vista' : `${schedule.length} parcelas`} · válida até {new Date(`${validUntil}T12:00:00`).toLocaleDateString('pt-BR')}</p></aside>
    </div></div>
    <footer className="quote-editor-footer"><div className={`quote-save-state is-${saveState}`}><span/>{isReadOnly ? 'Somente leitura' : saveState === 'saved' ? 'Salvo agora' : saveState === 'saving' ? 'Salvando…' : saveState === 'error' ? 'Falha ao salvar' : 'Alterações pendentes'}</div><div><button className="quote-secondary" onClick={() => void onMutate({ action: 'duplicate_quote', requestId: request.id }, request.id)}>{icons.copy}Duplicar</button>{request.draft.commercial_status === 'draft' && request.draft.current_version === 0 && request.draft.status !== 'suspended' && <button className="quote-danger" onClick={() => setConfirmDelete(true)}>{icons.trash}Excluir rascunho</button>}<button className="quote-primary" disabled={isReadOnly || saveState === 'saving'} onClick={() => void save()}>{saveState === 'saving' ? 'Salvando…' : 'Salvar'}</button></div></footer>
    {adjustmentOpen && <div className="quote-modal-backdrop"><div className="quote-modal quote-confirm-modal"><header><div><span>CONFIRMAÇÃO ADMINISTRATIVA</span><h2>Definir valor final</h2><p>O MFA/AAL2 da sessão será verificado e a alteração ficará no histórico.</p></div><button onClick={() => setAdjustmentOpen(false)}>×</button></header><div className="quote-form-grid"><label className="quote-field">Valor calculado<input readOnly value={currency.format(preview.calculatedAmount)}/></label><label className="quote-field">Quero receber<input inputMode="decimal" value={desiredInput} onChange={(event) => setDesiredInput(event.target.value)}/></label><label className="quote-field is-wide">Justificativa do ajuste<textarea rows={4} value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} placeholder="Ex.: Valor comercial negociado com o cliente."/></label></div><footer><button className="quote-secondary" onClick={() => setAdjustmentOpen(false)}>Cancelar</button><button className="quote-primary" onClick={() => void confirmAdjustment()}>Confirmar com AAL2</button></footer></div></div>}
    {confirmDelete && <div className="quote-modal-backdrop"><div className="quote-modal quote-confirm-modal"><header><div><span>EXCLUSÃO DE RASCUNHO</span><h2>Excluir este rascunho?</h2><p>Esta ação não poderá ser desfeita. Propostas versionadas não podem ser excluídas por este fluxo.</p></div></header><footer><button className="quote-secondary" onClick={() => setConfirmDelete(false)}>Manter rascunho</button><button className="quote-danger" onClick={() => void onMutate({ action: 'delete_draft', requestId: request.id })}>{icons.trash}Excluir definitivamente</button></footer></div></div>}
    {emailOpen && <div className="quote-modal-backdrop"><div className="quote-modal quote-email-modal"><header><div><span>ENVIO POR E-MAIL</span><h2>Revise antes de enviar</h2><p>O documento oficial é a versão {request.draft.current_version}. O compartilhamento nativo inclui o PDF; o fluxo mailto abre apenas a mensagem e exige anexar o arquivo.</p></div><button onClick={() => setEmailOpen(false)}>×</button></header><div className="quote-form-grid"><label className="quote-field is-wide">Para<input type="email" value={emailTo} onChange={(event) => setEmailTo(event.target.value)}/></label><label className="quote-field is-wide">Assunto<input value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)}/></label><label className="quote-field is-wide">Mensagem<textarea rows={8} value={emailBody} onChange={(event) => setEmailBody(event.target.value)}/></label><div className="quote-email-document">{icons.file}<div><strong>{request.proposal_number}_V{String(request.draft.current_version).padStart(2, '0')}.pdf</strong><small>PDF oficial privado na Central de Documentos</small></div></div></div><footer><button className="quote-secondary" onClick={() => setEmailOpen(false)}>Cancelar</button><button className="quote-secondary" disabled={!emailTo} onClick={() => void prepareEmail()}>{icons.send}Abrir e-mail sem anexo</button><button className="quote-primary" disabled={!emailTo} onClick={() => void shareEmailNative()}>{icons.file}Compartilhar com PDF</button></footer></div></div>}
  </div>
}

function SectionTitle({ eyebrow, title, text, actions }: { eyebrow: string; title: string; text: string; actions?: ReactNode }) {
  return <header className="quote-section-title"><div><span>{eyebrow}</span><h3>{title}</h3><p>{text}</p></div>{actions && <div>{actions}</div>}</header>
}
