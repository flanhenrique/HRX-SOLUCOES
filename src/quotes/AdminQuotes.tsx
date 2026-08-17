import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { assessDiscount, DISCOUNT_LEVELS } from './discount'
import { calculateQuotePreview } from './quoteMath'
import type { DiscountLevel, RetentionInput } from './types'
import { hrxPublishableKey, hrxSupabase, quoteAdminEndpoint } from './supabaseClient'
import './quotes.css'

type ProviderRule = { provider: 'nubank' | 'mercadopago'; display_name: string; boleto_fee_per_paid: number; fee_note?: string | null }
type PricingRule = {
  service_key: string
  service_name: string
  category: string
  base_amount: number
  minimum_amount: number
  fiscal_code?: string | null
  invoice_description?: string | null
}
type QuoteItem = {
  id?: string
  draft_id?: string
  service_key: string
  service_name: string
  quantity: number
  unit_amount: number
  total_amount: number
  source: 'engine' | 'manual'
}
type AdminDraft = {
  id: string; request_id: string; base_amount: number; complexity_multiplier: number; urgency_multiplier: number;
  pre_discount_amount: number; discount_percent: DiscountLevel; discount_status: 'green' | 'yellow' | 'red' | 'purple';
  discount_amount: number; final_amount: number; payment_provider: 'none' | 'nubank' | 'mercadopago'; installments: number;
  payment_fee_total: number; retentions: RetentionInput; retention_total: number; retention_pricing_mode: 'informational' | 'preserve_net';
  retention_gross_up_suggestion: number; estimated_net: number; fiscal_review_required: boolean; fiscal_review_confirmed: boolean;
  notes?: string | null; status: 'awaiting_review' | 'needs_scope' | 'approved' | 'rejected'; items?: QuoteItem[]; updated_at?: string
}
type AdminRequest = {
  id: string; protocol: string; created_at: string; name: string; email: string; phone: string; company?: string | null;
  request_text: string; desired_deadline?: string | null; status: string;
  interpretation?: { summary: string; suggested_service_keys: string[]; confidence: number; missing_information: string[] } | null;
  draft?: AdminDraft | null
}
type AdminResponse = { requests: AdminRequest[]; providers: ProviderRule[]; pricingRules: PricingRule[] }
type SaveQuotePayload = {
  items: { serviceKey: string; quantity: number }[]
  discountPercent: DiscountLevel
  complexityMultiplier: number
  urgencyMultiplier: number
  paymentProvider: 'none' | 'nubank' | 'mercadopago'
  installments: number
  retentions: RetentionInput
  retentionPricingMode: 'informational' | 'preserve_net'
  fiscalReviewConfirmed: boolean
  notes: string
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const emptyRetentions: RetentionInput = { iss: 0, irrf: 0, pis: 0, cofins: 0, csll: 0, inss: 0 }
const retentionLabels: Record<keyof RetentionInput, string> = { iss: 'ISS', irrf: 'IRRF', pis: 'PIS', cofins: 'COFINS', csll: 'CSLL', inss: 'INSS' }

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

function normalizeWhatsApp(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return digits
}

function retentionText(retentions: RetentionInput) {
  return (Object.entries(retentions) as [keyof RetentionInput, number][])
    .filter(([, value]) => Number(value) > 0)
    .map(([key, value]) => `${retentionLabels[key]} ${Number(value).toLocaleString('pt-BR')}%`)
    .join(' · ')
}

function buildClientQuoteMessage(request: AdminRequest, draft: AdminDraft, providers: ProviderRule[]) {
  const lines = [
    'HRX SOLUTIONS — ORÇAMENTO',
    `Protocolo: ${request.protocol}`,
    `Cliente: ${request.name}${request.company ? ` · ${request.company}` : ''}`,
    '',
    'Serviços:',
  ]

  for (const item of draft.items ?? []) {
    const quantity = Number(item.quantity) || 1
    lines.push(`• ${item.service_name} — ${quantity} × ${currency.format(Number(item.unit_amount))} = ${currency.format(Number(item.total_amount))}`)
  }

  lines.push('', `Subtotal do catálogo: ${currency.format(Number(draft.base_amount))}`)
  if (Number(draft.discount_amount) > 0) lines.push(`Desconto: - ${currency.format(Number(draft.discount_amount))}`)
  if (Number(draft.payment_fee_total) > 0) {
    const provider = providers.find((item) => item.provider === draft.payment_provider)
    lines.push(`Cobrança${provider ? ` via ${provider.display_name}` : ''}: ${currency.format(Number(draft.payment_fee_total))}`)
  }
  if (Number(draft.retention_total) > 0) {
    lines.push(`Retenções consideradas: ${retentionText(draft.retentions)} · total ${Number(draft.retention_total).toLocaleString('pt-BR')}%`)
  }

  lines.push(`Valor do orçamento: ${currency.format(Number(draft.final_amount))}`)
  if (Number(draft.retention_total) > 0) lines.push(`Líquido estimado após retenções: ${currency.format(Number(draft.estimated_net))}`)
  lines.push('', 'Validade: 7 dias.', 'HRX Solutions · Soluções inteligentes. Resultados reais.')
  return lines.join('\n')
}

export default function AdminQuotes() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [requests, setRequests] = useState<AdminRequest[]>([])
  const [providers, setProviders] = useState<ProviderRule[]>([])
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    void hrxSupabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false) })
    const { data } = hrxSupabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setChecking(false) })
    return () => data.subscription.unsubscribe()
  }, [])

  const load = async (currentSession: Session) => {
    setLoading(true)
    setError('')
    try {
      const result = await adminFetch<AdminResponse>(currentSession)
      setRequests(result.requests)
      setProviders(result.providers)
      setPricingRules(result.pricingRules ?? [])
      setSelectedId((current) => current && result.requests.some((item) => item.id === current) ? current : result.requests[0]?.id ?? null)
    } catch (loadError) {
      const code = loadError instanceof Error ? loadError.message : ''
      setError(code === 'forbidden' ? 'Este login ainda não está autorizado como administrador da HRX.' : 'Não foi possível carregar os orçamentos agora.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (session) void load(session) }, [session])
  const selected = useMemo(() => requests.find((item) => item.id === selectedId) ?? null, [requests, selectedId])

  const saveQuote = async (payload: SaveQuotePayload) => {
    if (!session || !selected?.draft) return
    setError('')
    try {
      await adminFetch(session, { method: 'PATCH', body: JSON.stringify({ action: 'save_quote', requestId: selected.id, ...payload }) })
      await load(session)
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      const messages: Record<string, string> = {
        invalid_service: 'Há um serviço inválido ou inativo na composição.',
        invalid_items: 'A composição enviada não é válida.',
        items_update_failed: 'Não foi possível atualizar os itens do orçamento.',
        invalid_retention_total: 'A soma das retenções precisa ser menor que 100%.',
        invalid_discount: 'O desconto selecionado não é permitido.',
      }
      setError(messages[code] ?? 'Não foi possível salvar e recalcular o orçamento.')
      throw err
    }
  }

  const approve = async () => {
    if (!session || !selected?.draft) return
    setError('')
    try {
      await adminFetch(session, { method: 'PATCH', body: JSON.stringify({ action: 'approve', requestId: selected.id }) })
      await load(session)
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      const messages: Record<string, string> = {
        discount_blocked: 'Desconto de 20% está bloqueado.',
        fiscal_review_required: 'Confirme a revisão fiscal antes de aprovar.',
        scope_not_ready: 'O escopo ainda precisa ser fechado.',
      }
      setError(messages[code] ?? 'Não foi possível aprovar este orçamento.')
    }
  }

  if (checking || !session) return <main className="admin-login-shell"><div className="admin-login-card"><p>Validando acesso…</p></div></main>

  return (
    <main className="admin-live-shell">
      <header className="admin-live-header">
        <div><span className="eyebrow">HRX · BACKOFFICE</span><h1>Motor de orçamentos</h1><p>Catálogo, soma instantânea, retenções, validação e envio do orçamento ao cliente.</p></div>
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
        <section className="admin-detail">{selected ? <QuoteEditor request={selected} providers={providers} pricingRules={pricingRules} onSave={saveQuote} onApprove={approve} /> : <div className="admin-card"><h2>Selecione uma solicitação</h2></div>}</section>
      </div>
    </main>
  )
}

function QuoteEditor({ request, providers, pricingRules, onSave, onApprove }: {
  request: AdminRequest
  providers: ProviderRule[]
  pricingRules: PricingRule[]
  onSave: (payload: SaveQuotePayload) => Promise<void>
  onApprove: () => Promise<void>
}) {
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
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [shareStatus, setShareStatus] = useState('')

  useEffect(() => {
    setDiscount(draft?.discount_percent ?? 0)
    setComplexity(draft?.complexity_multiplier ?? 1)
    setUrgency(draft?.urgency_multiplier ?? 1)
    setProvider(draft?.payment_provider ?? 'none')
    setInstallments(draft?.installments ?? 1)
    setRetentions(draft?.retentions ?? emptyRetentions)
    setRetentionMode(draft?.retention_pricing_mode ?? 'informational')
    setFiscalConfirmed(draft?.fiscal_review_confirmed ?? false)
    setNotes(draft?.notes ?? '')
    setQuantities(Object.fromEntries((draft?.items ?? []).map((item) => [item.service_key, Number(item.quantity) || 1])))
    setShareStatus('')
  }, [request.id, draft?.updated_at])

  const groupedRules = useMemo(() => {
    const groups = new Map<string, PricingRule[]>()
    for (const rule of pricingRules) groups.set(rule.category, [...(groups.get(rule.category) ?? []), rule])
    return [...groups.entries()]
  }, [pricingRules])

  if (!draft) return <div className="admin-card"><h2>Rascunho ainda não disponível</h2></div>

  const assessment = assessDiscount(discount)
  const selectedRules = pricingRules.filter((rule) => Number(quantities[rule.service_key] ?? 0) > 0)
  const compositionBase = selectedRules.reduce((sum, rule) => sum + Number(rule.base_amount) * Number(quantities[rule.service_key] ?? 1), 0)
  const retentionInputTotal = Object.values(retentions).reduce((sum, value) => sum + Number(value || 0), 0)
  const preview = calculateQuotePreview({
    baseAmount: compositionBase,
    complexityMultiplier: complexity,
    urgencyMultiplier: urgency,
    discountPercent: discount,
    paymentProvider: provider,
    installments,
    providers,
    retentions,
    retentionPricingMode: retentionMode,
    fiscalReviewConfirmed: fiscalConfirmed,
  })
  const savedQuantities = Object.fromEntries((draft.items ?? []).map((item) => [item.service_key, Number(item.quantity) || 1]))
  const currentEntries = Object.entries(quantities).filter(([, quantity]) => Number(quantity) > 0).sort(([a], [b]) => a.localeCompare(b))
  const savedEntries = Object.entries(savedQuantities).filter(([, quantity]) => Number(quantity) > 0).sort(([a], [b]) => a.localeCompare(b))
  const hasUnsavedChanges = JSON.stringify(currentEntries) !== JSON.stringify(savedEntries)
    || Number(discount) !== Number(draft.discount_percent)
    || Number(complexity) !== Number(draft.complexity_multiplier)
    || Number(urgency) !== Number(draft.urgency_multiplier)
    || provider !== draft.payment_provider
    || Number(installments) !== Number(draft.installments)
    || retentionMode !== draft.retention_pricing_mode
    || fiscalConfirmed !== draft.fiscal_review_confirmed
    || (Object.keys(retentions) as (keyof RetentionInput)[]).some((key) => Number(retentions[key]) !== Number(draft.retentions?.[key] ?? 0))
    || notes !== (draft.notes ?? '')
  const retentionInvalid = retentionInputTotal >= 100
  const canApprove = !hasUnsavedChanges && !retentionInvalid && draft.discount_status !== 'purple' && draft.status !== 'needs_scope' && (!draft.fiscal_review_required || draft.fiscal_review_confirmed)
  const canSend = draft.status === 'approved' && !hasUnsavedChanges
  const whatsapp = normalizeWhatsApp(request.phone)
  const whatsappText = encodeURIComponent(`Olá, ${request.name}! Aqui é da HRX Solutions. Recebemos sua solicitação ${request.protocol} e estou entrando em contato para validar alguns pontos antes da proposta.`)

  const toggleRule = (key: string, checked: boolean) => {
    setQuantities((current) => {
      const next = { ...current }
      if (checked) next[key] = Math.max(1, Number(next[key] ?? 1))
      else delete next[key]
      return next
    })
  }

  const save = async () => {
    if (retentionInvalid) return
    setSaving(true)
    setShareStatus('')
    try {
      await onSave({
        items: Object.entries(quantities).filter(([, quantity]) => quantity > 0).map(([serviceKey, quantity]) => ({ serviceKey, quantity })),
        discountPercent: discount,
        complexityMultiplier: complexity,
        urgencyMultiplier: urgency,
        paymentProvider: provider,
        installments,
        retentions,
        retentionPricingMode: retentionMode,
        fiscalReviewConfirmed: fiscalConfirmed,
        notes,
      })
    } finally {
      setSaving(false)
    }
  }

  const changeRetention = (key: keyof RetentionInput, value: number) => {
    setRetentions((current) => ({ ...current, [key]: Math.max(0, value || 0) }))
    setFiscalConfirmed(false)
  }

  const approvedMessage = buildClientQuoteMessage(request, draft, providers)

  const sendWhatsApp = () => {
    if (!canSend || !whatsapp) return
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(approvedMessage)}`, '_blank', 'noopener,noreferrer')
    setShareStatus('Orçamento aberto no WhatsApp. Revise e confirme o envio no aplicativo.')
  }

  const sendEmail = () => {
    if (!canSend || !request.email) return
    const subject = encodeURIComponent(`Orçamento HRX Solutions · ${request.protocol}`)
    window.location.href = `mailto:${request.email}?subject=${subject}&body=${encodeURIComponent(approvedMessage)}`
    setShareStatus('Orçamento preparado no aplicativo de e-mail.')
  }

  const shareQuote = async () => {
    if (!canSend) return
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `Orçamento HRX · ${request.protocol}`, text: approvedMessage })
        setShareStatus('Orçamento compartilhado pelo sistema.')
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    if (whatsapp) sendWhatsApp()
    else sendEmail()
  }

  const copyQuote = async () => {
    if (!canSend) return
    try {
      await navigator.clipboard.writeText(approvedMessage)
      setShareStatus('Orçamento copiado. Agora é só colar no canal de atendimento.')
    } catch {
      setShareStatus('Não foi possível copiar automaticamente neste dispositivo.')
    }
  }

  return <div className="admin-editor-grid">
    <article className="admin-card admin-wide-card"><span className="admin-card-kicker">{request.protocol}</span><div className="admin-title-row"><div><h2>{request.name}</h2><p>{request.company || 'Empresa não informada'}</p></div><span className={`admin-request-state state-${request.status}`}>{request.status.replaceAll('_',' ')}</span></div><div className="admin-contact-row"><a href={`mailto:${request.email}`}>{request.email}</a><a href={`tel:${request.phone}`}>{request.phone}</a>{whatsapp && <a href={`https://wa.me/${whatsapp}?text=${whatsappText}`} target="_blank" rel="noreferrer">WhatsApp ↗</a>}</div><blockquote className="admin-request-text">{request.request_text}</blockquote>{request.desired_deadline && <p className="admin-note"><strong>Prazo:</strong> {request.desired_deadline}</p>}</article>

    <article className="admin-card"><span className="admin-card-kicker">INTERPRETAÇÃO</span><h2>Leitura do motor</h2><p>{request.interpretation?.summary || 'Sem interpretação disponível.'}</p><div className="admin-confidence-line"><span>Confiança</span><strong>{request.interpretation?.confidence ?? 0}%</strong></div><div className="admin-service-tags">{request.interpretation?.suggested_service_keys.map((key) => <span key={key}>{pricingRules.find((rule) => rule.service_key === key)?.service_name ?? key.replaceAll('_',' ')}</span>)}</div>{!!request.interpretation?.missing_information.length && <div className="admin-missing"><strong>Falta confirmar</strong>{request.interpretation.missing_information.map((item) => <span key={item}>• {item}</span>)}</div>}</article>

    <article className="admin-card admin-wide-card admin-rules-card"><div className="admin-rules-heading"><div><span className="admin-card-kicker">CATÁLOGO DE SERVIÇOS</span><h2>Composição do orçamento</h2><p>Selecione os serviços e quantidades. A soma abaixo é instantânea; ao salvar, catálogo e cálculo são gravados juntos para não perder nenhum valor.</p></div><div className="admin-rules-total"><span>{selectedRules.length} serviço(s)</span><strong>{currency.format(compositionBase)}</strong><small>subtotal em tempo real</small></div></div><div className="admin-rule-groups">{groupedRules.map(([category, rules]) => <section className="admin-rule-group" key={category}><h3>{category}</h3><div className="admin-rule-list">{rules.map((rule) => { const quantity = Number(quantities[rule.service_key] ?? 0); const checked = quantity > 0; return <div className={checked ? 'admin-rule-row is-selected' : 'admin-rule-row'} key={rule.service_key}><label className="admin-rule-check"><input type="checkbox" checked={checked} onChange={(event) => toggleRule(rule.service_key, event.target.checked)} /><span><strong>{rule.service_name}</strong><small>{rule.fiscal_code ? `NFS-e ${rule.fiscal_code}` : 'Código fiscal a validar'} · mínimo interno {currency.format(Number(rule.minimum_amount))}</small></span></label><div className="admin-rule-price"><strong>{currency.format(Number(rule.base_amount))}</strong><small>unitário</small></div><label className="admin-rule-qty">Qtd.<input type="number" min="1" max="99" disabled={!checked} value={checked ? quantity : 1} onChange={(event) => setQuantities((current) => ({ ...current, [rule.service_key]: Math.min(99, Math.max(1, Math.round(Number(event.target.value) || 1))) }))} /></label><div className="admin-rule-line-total"><small>Total</small><strong>{currency.format(Number(rule.base_amount) * (checked ? quantity : 0))}</strong></div></div>})}</div></section>)}</div><div className="admin-rules-actions"><p>{hasUnsavedChanges ? 'Há alterações ainda não salvas no catálogo ou no cálculo.' : `Composição salva: ${draft.items?.length ?? 0} item(ns), base ${currency.format(Number(draft.base_amount))}.`}</p><button className="button button-primary" type="button" disabled={saving || retentionInvalid} onClick={() => void save()}>{saving ? 'Recalculando…' : 'Aplicar e recalcular'}</button></div></article>

    <article className="admin-card"><span className="admin-card-kicker">PREÇO</span><h2>Base e complexidade</h2><div className="price-summary"><div><span>Base do catálogo</span><strong>{currency.format(preview.baseAmount)}</strong></div><div><span>Pré-desconto</span><strong>{currency.format(preview.preDiscountAmount)}</strong></div></div><div className="admin-inline-fields"><label className="admin-field">Complexidade<select value={complexity} onChange={(e) => setComplexity(Number(e.target.value))}><option value={1}>Padrão · 1x</option><option value={1.25}>Intermediária · 1,25x</option><option value={1.5}>Alta · 1,5x</option><option value={2}>Especial · 2x</option></select></label><label className="admin-field">Urgência<select value={urgency} onChange={(e) => setUrgency(Number(e.target.value))}><option value={1}>Normal · 1x</option><option value={1.15}>Prioritária · 1,15x</option><option value={1.3}>Urgente · 1,3x</option></select></label></div></article>

    <article className="admin-card"><span className="admin-card-kicker">DESCONTO</span><h2>Faixa segura</h2><div className="discount-options">{DISCOUNT_LEVELS.map((level) => { const item = assessDiscount(level); return <button key={level} type="button" className={`discount-choice discount-${item.tone} ${discount === level ? 'is-active' : ''}`} onClick={() => setDiscount(level)}><strong>{level}%</strong><span>{item.label}</span></button> })}</div><div className={`discount-assessment discount-${assessment.tone}`}><strong>{assessment.label}</strong><p>{assessment.message}</p></div></article>

    <article className="admin-card"><span className="admin-card-kicker">PAGAMENTO</span><h2>Boleto e parcelamento</h2><label className="admin-field">Provedor<select value={provider} onChange={(e) => setProvider(e.target.value as typeof provider)}><option value="none">Sem boleto</option>{providers.map((item) => <option key={item.provider} value={item.provider}>{item.display_name}</option>)}</select></label><label className="admin-field">Parcelas<input type="number" min="1" max="24" value={installments} onChange={(e) => setInstallments(Math.min(24, Math.max(1, Math.round(Number(e.target.value) || 1))))} /></label><div className="price-summary"><div><span>Taxa total prevista</span><strong>{currency.format(preview.paymentFeeTotal)}</strong></div></div></article>

    <article className="admin-card"><span className="admin-card-kicker">RETENÇÕES</span><h2>Revisão fiscal</h2><p className="admin-note warning">Informe somente retenções confirmadas. Qualquer alteração nas alíquotas exige nova confirmação fiscal.</p><div className="retention-grid">{(Object.keys(retentions) as (keyof RetentionInput)[]).map((key) => <label className="admin-field" key={key}>{retentionLabels[key]} (%)<input type="number" min="0" max="100" step="0.01" value={retentions[key]} onChange={(e) => changeRetention(key, Number(e.target.value))} /></label>)}</div><div className={retentionInvalid ? 'retention-total-alert is-invalid' : 'retention-total-alert'}><span>Total das retenções</span><strong>{retentionInputTotal.toLocaleString('pt-BR')}%</strong><span>{currency.format(preview.retentionAmount)} estimados</span></div>{retentionInvalid && <p className="admin-note retention-error">A soma das retenções precisa ser menor que 100%.</p>}<label className="admin-field">Tratamento<select value={retentionMode} onChange={(e) => { setRetentionMode(e.target.value as typeof retentionMode); setFiscalConfirmed(false) }}><option value="informational">Somente informar impacto</option><option value="preserve_net">Preservar líquido por gross-up</option></select></label>{retentionInputTotal > 0 && <label className="privacy-check"><input type="checkbox" checked={fiscalConfirmed} onChange={(e) => setFiscalConfirmed(e.target.checked)} /><span>Confirmei a revisão fiscal das retenções deste orçamento.</span></label>}<div className="retention-breakdown">{(Object.entries(retentions) as [keyof RetentionInput, number][]).filter(([, value]) => Number(value) > 0).map(([key, value]) => <div key={key}><span>{retentionLabels[key]} · {Number(value).toLocaleString('pt-BR')}%</span><strong>- {currency.format(preview.retentionBreakdown[key])}</strong></div>)}</div></article>

    <article className="admin-card admin-wide-card admin-total-card"><div><span className="admin-card-kicker">RESUMO EM TEMPO REAL</span><h2>Valor para validação</h2>{hasUnsavedChanges && <p className="admin-note warning">Prévia atualizada na tela. Salve para gravar estes valores antes de aprovar.</p>}</div><div className="admin-total-values"><div><span>Subtotal catálogo</span><strong>{currency.format(preview.baseAmount)}</strong></div><div><span>Pré-desconto</span><strong>{currency.format(preview.preDiscountAmount)}</strong></div><div><span>Desconto</span><strong>- {currency.format(preview.discountAmount)}</strong></div><div><span>Taxas de cobrança</span><strong>+ {currency.format(preview.paymentFeeTotal)}</strong></div><div><span>Retenções</span><strong>{preview.retentionTotal.toLocaleString('pt-BR')}% · {currency.format(preview.retentionAmount)}</strong></div><div><span>Bruto sugerido para preservar líquido</span><strong>{currency.format(preview.retentionGrossUpSuggestion)}</strong></div><div className="admin-grand-total"><span>Valor final</span><strong>{currency.format(preview.finalAmount)}</strong></div><div><span>Líquido estimado</span><strong>{currency.format(preview.estimatedNet)}</strong></div></div><label className="admin-field">Observações internas<textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} /></label><div className="admin-approval-actions"><button className="button button-secondary" type="button" disabled={saving || retentionInvalid} onClick={() => void save()}>{saving ? 'Salvando…' : 'Salvar orçamento'}</button><button className="button button-primary" type="button" disabled={!canApprove} onClick={() => void onApprove()}>Aprovar orçamento</button></div><small>Aprovar continua sendo validação interna. O envio ao cliente é uma ação separada e explícita.</small></article>

    <article className="admin-card admin-wide-card admin-send-card"><div><span className="admin-card-kicker">ENVIO AO CLIENTE</span><h2>Enviar orçamento aprovado</h2><p>{canSend ? 'O orçamento está aprovado e sincronizado. Escolha o canal de envio.' : hasUnsavedChanges ? 'Existem alterações não salvas. Salve e aprove novamente antes de enviar.' : 'Aprove o orçamento para liberar o envio ao cliente.'}</p></div><div className="admin-send-preview"><pre>{approvedMessage}</pre></div><div className="admin-send-actions"><button className="button button-primary" type="button" disabled={!canSend} onClick={() => void shareQuote()}>Enviar orçamento</button><button className="button button-secondary" type="button" disabled={!canSend || !whatsapp} onClick={sendWhatsApp}>WhatsApp</button><button className="button button-secondary" type="button" disabled={!canSend || !request.email} onClick={sendEmail}>E-mail</button><button className="button button-secondary" type="button" disabled={!canSend} onClick={() => void copyQuote()}>Copiar</button></div>{shareStatus && <div className="admin-send-status" role="status">{shareStatus}</div>}<small>O sistema prepara o orçamento; WhatsApp/e-mail ainda exigem sua confirmação final no aplicativo escolhido.</small></article>
  </div>
}
