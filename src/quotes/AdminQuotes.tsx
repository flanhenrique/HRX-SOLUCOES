import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { assessDiscount, DISCOUNT_LEVELS } from './discount'
import type { DiscountLevel, RetentionInput } from './types'
import { hrxPublishableKey, hrxSupabase, quoteAdminEndpoint } from './supabaseClient'
import './quotes.css'

type ProviderRule = { provider: 'nubank' | 'mercadopago'; display_name: string; boleto_fee_per_paid: number; fee_note?: string | null }
type AdminDraft = {
  id: string; request_id: string; base_amount: number; complexity_multiplier: number; urgency_multiplier: number;
  pre_discount_amount: number; discount_percent: DiscountLevel; discount_status: 'green' | 'yellow' | 'red' | 'purple';
  discount_amount: number; final_amount: number; payment_provider: 'none' | 'nubank' | 'mercadopago'; installments: number;
  payment_fee_total: number; retentions: RetentionInput; retention_total: number; retention_pricing_mode: 'informational' | 'preserve_net';
  retention_gross_up_suggestion: number; estimated_net: number; fiscal_review_required: boolean; fiscal_review_confirmed: boolean;
  notes?: string | null; status: 'awaiting_review' | 'needs_scope' | 'approved' | 'rejected'
}
type AdminRequest = {
  id: string; protocol: string; created_at: string; name: string; email: string; phone: string; company?: string | null;
  request_text: string; desired_deadline?: string | null; status: string;
  interpretation?: { summary: string; suggested_service_keys: string[]; confidence: number; missing_information: string[] } | null;
  draft?: AdminDraft | null
}
type AdminResponse = { requests: AdminRequest[]; providers: ProviderRule[] }

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const emptyRetentions: RetentionInput = { iss: 0, irrf: 0, pis: 0, cofins: 0, csll: 0, inss: 0 }

async function adminFetch<T>(session: Session, init?: RequestInit): Promise<T> {
  const response = await fetch(quoteAdminEndpoint, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: hrxPublishableKey,
      Authorization: `Bearer ${session.access_token}`,
      ...(init?.headers ?? {}),
    },
  })
  const body = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(body.error ?? `HTTP_${response.status}`)
  return body as T
}

function LoginPanel() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSending(true)
    setMessage('')
    const redirectTo = `${window.location.origin}/admin/orcamentos`
    const { error } = await hrxSupabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    })
    setSending(false)
    setMessage(error ? 'Não foi possível enviar o link de acesso agora.' : 'Link de acesso enviado. Verifique o e-mail informado.')
  }

  return (
    <main className="admin-login-shell">
      <form className="admin-login-card" onSubmit={submit}>
        <span className="eyebrow">HRX · AMBIENTE INTERNO</span>
        <h1>Acesso administrativo</h1>
        <p>Use o e-mail corporativo autorizado. O acesso é feito por link seguro; solicitações, preços e dados dos clientes não ficam disponíveis publicamente.</p>
        <label className="admin-field">E-mail administrativo
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        </label>
        <button className="button button-primary" type="submit" disabled={sending}>{sending ? 'Enviando…' : 'Enviar link de acesso'}</button>
        {message && <div className="admin-login-message" role="status">{message}</div>}
        <a className="admin-back-link" href="/">← Voltar ao site</a>
      </form>
    </main>
  )
}

export default function AdminQuotes() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [requests, setRequests] = useState<AdminRequest[]>([])
  const [providers, setProviders] = useState<ProviderRule[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    hrxSupabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false) })
    const { data } = hrxSupabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setChecking(false) })
    return () => data.subscription.unsubscribe()
  }, [])

  const load = async (currentSession: Session) => {
    setLoading(true); setError('')
    try {
      const result = await adminFetch<AdminResponse>(currentSession)
      setRequests(result.requests)
      setProviders(result.providers)
      setSelectedId((current) => current && result.requests.some((item) => item.id === current) ? current : result.requests[0]?.id ?? null)
    } catch (loadError) {
      const code = loadError instanceof Error ? loadError.message : ''
      setError(code === 'forbidden' ? 'Este login ainda não está autorizado como administrador da HRX.' : 'Não foi possível carregar os orçamentos agora.')
    } finally { setLoading(false) }
  }

  useEffect(() => { if (session) void load(session) }, [session])
  const selected = useMemo(() => requests.find((item) => item.id === selectedId) ?? null, [requests, selectedId])

  const updateDraft = async (payload: Record<string, unknown>) => {
    if (!session || !selected?.draft) return
    setError('')
    try {
      await adminFetch(session, { method: 'PATCH', body: JSON.stringify({ action: 'update_draft', requestId: selected.id, ...payload }) })
      await load(session)
    } catch (err) { setError(err instanceof Error ? `Não foi possível atualizar: ${err.message}` : 'Não foi possível atualizar.') }
  }

  const approve = async () => {
    if (!session || !selected?.draft) return
    try {
      await adminFetch(session, { method: 'PATCH', body: JSON.stringify({ action: 'approve', requestId: selected.id }) })
      await load(session)
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      const messages: Record<string, string> = { discount_blocked: 'Desconto de 20% está bloqueado.', fiscal_review_required: 'Confirme a revisão fiscal antes de aprovar.', scope_not_ready: 'O escopo ainda precisa ser fechado.' }
      setError(messages[code] ?? 'Não foi possível aprovar este orçamento.')
    }
  }

  if (checking) return <main className="admin-login-shell"><div className="admin-login-card"><p>Validando acesso…</p></div></main>
  if (!session) return <LoginPanel />

  return (
    <main className="admin-live-shell">
      <header className="admin-live-header">
        <div><span className="eyebrow">HRX · BACKOFFICE</span><h1>Motor de orçamentos</h1><p>Solicitações, interpretação, preço, desconto, pagamento, retenções e validação final.</p></div>
        <div className="admin-header-actions"><button className="button button-secondary" type="button" onClick={() => void load(session)}>Atualizar</button><button className="admin-signout" type="button" onClick={() => void hrxSupabase.auth.signOut()}>Sair</button></div>
      </header>
      {error && <div className="admin-global-error" role="alert">{error}</div>}
      <div className="admin-workspace">
        <aside className="admin-queue">
          <div className="admin-queue-title"><strong>Solicitações</strong><span>{requests.length}</span></div>
          {loading && <p className="admin-empty">Carregando…</p>}
          {!loading && requests.length === 0 && <p className="admin-empty">Nenhuma solicitação recebida ainda.</p>}
          {requests.map((request) => <button key={request.id} type="button" className={selectedId === request.id ? 'admin-lead is-active' : 'admin-lead'} onClick={() => setSelectedId(request.id)}><span className="admin-lead-status">{request.status.replaceAll('_',' ')}</span><strong>{request.name}</strong><small>{request.company || request.email}</small><time>{new Date(request.created_at).toLocaleString('pt-BR')}</time></button>)}
        </aside>
        <section className="admin-detail">{selected ? <QuoteEditor request={selected} providers={providers} onUpdate={updateDraft} onApprove={approve} /> : <div className="admin-card"><h2>Selecione uma solicitação</h2></div>}</section>
      </div>
    </main>
  )
}

function QuoteEditor({ request, providers, onUpdate, onApprove }: { request: AdminRequest; providers: ProviderRule[]; onUpdate: (payload: Record<string, unknown>) => Promise<void>; onApprove: () => Promise<void> }) {
  const draft = request.draft
  const [discount, setDiscount] = useState<DiscountLevel>(draft?.discount_percent ?? 0)
  const [complexity, setComplexity] = useState(draft?.complexity_multiplier ?? 1)
  const [urgency, setUrgency] = useState(draft?.urgency_multiplier ?? 1)
  const [provider, setProvider] = useState<'none' | 'nubank' | 'mercadopago'>(draft?.payment_provider ?? 'none')
  const [installments, setInstallments] = useState(draft?.installments ?? 1)
  const [retentions, setRetentions] = useState<RetentionInput>(draft?.retentions ?? emptyRetentions)
  const [retentionMode, setRetentionMode] = useState<'informational' | 'preserve_net'>(draft?.retention_pricing_mode ?? 'informational')
  const [fiscalConfirmed, setFiscalConfirmed] = useState(draft?.fiscal_review_confirmed ?? false)
  const [notes, setNotes] = useState(draft?.notes ?? '')

  useEffect(() => {
    setDiscount(draft?.discount_percent ?? 0); setComplexity(draft?.complexity_multiplier ?? 1); setUrgency(draft?.urgency_multiplier ?? 1)
    setProvider(draft?.payment_provider ?? 'none'); setInstallments(draft?.installments ?? 1); setRetentions(draft?.retentions ?? emptyRetentions)
    setRetentionMode(draft?.retention_pricing_mode ?? 'informational'); setFiscalConfirmed(draft?.fiscal_review_confirmed ?? false); setNotes(draft?.notes ?? '')
  }, [request.id])

  if (!draft) return <div className="admin-card"><h2>Rascunho ainda não disponível</h2></div>
  const assessment = assessDiscount(discount)
  const retentionTotal = Object.values(retentions).reduce((sum, value) => sum + Number(value || 0), 0)
  const whatsapp = request.phone.replace(/\D/g, '')
  const whatsappText = encodeURIComponent(`Olá, ${request.name}! Aqui é da HRX Solutions. Recebemos sua solicitação ${request.protocol} e estou entrando em contato para validar alguns pontos antes da proposta.`)
  const save = () => onUpdate({ discountPercent: discount, complexityMultiplier: complexity, urgencyMultiplier: urgency, paymentProvider: provider, installments, retentions, retentionPricingMode: retentionMode, fiscalReviewConfirmed: fiscalConfirmed, notes })

  return <div className="admin-editor-grid">
    <article className="admin-card admin-wide-card"><span className="admin-card-kicker">{request.protocol}</span><div className="admin-title-row"><div><h2>{request.name}</h2><p>{request.company || 'Empresa não informada'}</p></div><span className={`admin-request-state state-${request.status}`}>{request.status.replaceAll('_',' ')}</span></div><div className="admin-contact-row"><a href={`mailto:${request.email}`}>{request.email}</a><a href={`tel:${request.phone}`}>{request.phone}</a>{whatsapp && <a href={`https://wa.me/${whatsapp}?text=${whatsappText}`} target="_blank" rel="noreferrer">WhatsApp ↗</a>}</div><blockquote className="admin-request-text">{request.request_text}</blockquote>{request.desired_deadline && <p className="admin-note"><strong>Prazo:</strong> {request.desired_deadline}</p>}</article>

    <article className="admin-card"><span className="admin-card-kicker">INTERPRETAÇÃO</span><h2>Leitura do motor</h2><p>{request.interpretation?.summary || 'Sem interpretação disponível.'}</p><div className="admin-confidence-line"><span>Confiança</span><strong>{request.interpretation?.confidence ?? 0}%</strong></div><div className="admin-service-tags">{request.interpretation?.suggested_service_keys.map((key) => <span key={key}>{key.replaceAll('_',' ')}</span>)}</div>{!!request.interpretation?.missing_information.length && <div className="admin-missing"><strong>Falta confirmar</strong>{request.interpretation.missing_information.map((item) => <span key={item}>• {item}</span>)}</div>}</article>

    <article className="admin-card"><span className="admin-card-kicker">PREÇO</span><h2>Base e complexidade</h2><div className="price-summary"><div><span>Base do catálogo</span><strong>{currency.format(Number(draft.base_amount))}</strong></div><div><span>Pré-desconto</span><strong>{currency.format(Number(draft.pre_discount_amount))}</strong></div></div><div className="admin-inline-fields"><label className="admin-field">Complexidade<select value={complexity} onChange={(e) => setComplexity(Number(e.target.value))}><option value={1}>Padrão · 1x</option><option value={1.25}>Intermediária · 1,25x</option><option value={1.5}>Alta · 1,5x</option><option value={2}>Especial · 2x</option></select></label><label className="admin-field">Urgência<select value={urgency} onChange={(e) => setUrgency(Number(e.target.value))}><option value={1}>Normal · 1x</option><option value={1.15}>Prioritária · 1,15x</option><option value={1.3}>Urgente · 1,3x</option></select></label></div></article>

    <article className="admin-card"><span className="admin-card-kicker">DESCONTO</span><h2>Faixa segura</h2><div className="discount-options">{DISCOUNT_LEVELS.map((level) => { const item = assessDiscount(level); return <button key={level} type="button" className={`discount-choice discount-${item.tone} ${discount === level ? 'is-active' : ''}`} onClick={() => setDiscount(level)}><strong>{level}%</strong><span>{item.label}</span></button> })}</div><div className={`discount-assessment discount-${assessment.tone}`}><strong>{assessment.label}</strong><p>{assessment.message}</p></div></article>

    <article className="admin-card"><span className="admin-card-kicker">PAGAMENTO</span><h2>Boleto e parcelamento</h2><label className="admin-field">Provedor<select value={provider} onChange={(e) => setProvider(e.target.value as typeof provider)}><option value="none">Sem boleto</option>{providers.map((item) => <option key={item.provider} value={item.provider}>{item.display_name}</option>)}</select></label><label className="admin-field">Parcelas<input type="number" min="1" max="24" value={installments} onChange={(e) => setInstallments(Math.max(1, Math.round(Number(e.target.value) || 1)))} /></label><div className="price-summary"><div><span>Taxa total atual</span><strong>{currency.format(Number(draft.payment_fee_total))}</strong></div></div></article>

    <article className="admin-card"><span className="admin-card-kicker">RETENÇÕES</span><h2>Revisão fiscal</h2><p className="admin-note warning">Informe somente retenções já confirmadas para o cliente e serviço.</p><div className="retention-grid">{(Object.keys(retentions) as (keyof RetentionInput)[]).map((key) => <label className="admin-field" key={key}>{key.toUpperCase()} (%)<input type="number" min="0" max="100" step="0.01" value={retentions[key]} onChange={(e) => setRetentions((current) => ({ ...current, [key]: Number(e.target.value) || 0 }))} /></label>)}</div><label className="admin-field">Tratamento<select value={retentionMode} onChange={(e) => setRetentionMode(e.target.value as typeof retentionMode)}><option value="informational">Somente informar impacto</option><option value="preserve_net">Preservar líquido por gross-up</option></select></label>{retentionTotal > 0 && <label className="privacy-check"><input type="checkbox" checked={fiscalConfirmed} onChange={(e) => setFiscalConfirmed(e.target.checked)} /><span>Confirmei a revisão fiscal das retenções deste orçamento.</span></label>}</article>

    <article className="admin-card admin-wide-card admin-total-card"><div><span className="admin-card-kicker">RESUMO</span><h2>Valor para validação</h2></div><div className="admin-total-values"><div><span>Desconto</span><strong>- {currency.format(Number(draft.discount_amount))}</strong></div><div><span>Retenções</span><strong>{Number(draft.retention_total).toFixed(2)}%</strong></div><div><span>Bruto para preservar líquido</span><strong>{currency.format(Number(draft.retention_gross_up_suggestion || draft.final_amount))}</strong></div><div className="admin-grand-total"><span>Valor final</span><strong>{currency.format(Number(draft.final_amount))}</strong></div><div><span>Líquido estimado</span><strong>{currency.format(Number(draft.estimated_net))}</strong></div></div><label className="admin-field">Observações internas<textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} /></label><div className="admin-approval-actions"><button className="button button-secondary" type="button" onClick={() => void save()}>Salvar cálculo</button><button className="button button-primary" type="button" disabled={draft.discount_status === 'purple' || draft.status === 'needs_scope' || (draft.fiscal_review_required && !draft.fiscal_review_confirmed)} onClick={() => void onApprove()}>Aprovar orçamento</button></div><small>Aprovar é uma validação interna. Nenhum valor é enviado automaticamente ao cliente.</small></article>
  </div>
}
