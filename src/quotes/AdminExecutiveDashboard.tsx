import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { hrxPublishableKey, hrxSupabase, quoteAdminEndpoint } from './supabaseClient'
import { navigateAdmin, onAdminNavigate } from './adminNavigation'
import './admin-executive-dashboard.css'

type ExecutiveDraft = { status?: string; final_amount?: number | null }
type ExecutiveRequest = { id: string; created_at: string; name: string; company?: string | null; status: string; draft?: ExecutiveDraft | null }
type AdminResponse = { requests?: ExecutiveRequest[] }
type DashboardState = { requests: ExecutiveRequest[]; activeClients: number; documents: number }

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('pt-BR')

async function loadRequests(session: Session) {
  const response = await fetch(quoteAdminEndpoint, { headers: { apikey: hrxPublishableKey, Authorization: `Bearer ${session.access_token}` } })
  if (!response.ok) throw new Error('quotes_unavailable')
  const payload = await response.json() as AdminResponse
  return payload.requests ?? []
}

export default function AdminExecutiveDashboard() {
  const [open, setOpen] = useState(() => window.location.hash !== '#admin/painels')
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [state, setState] = useState<DashboardState>({ requests: [], activeClients: 0, documents: 0 })

  useEffect(() => onAdminNavigate((destination) => setOpen(destination === 'executive')), [])

  const load = async (session?: Session | null) => {
    const currentSession = session ?? (await hrxSupabase.auth.getSession()).data.session
    if (!currentSession) { setReady(false); setLoading(false); setLoaded(false); return }
    const { data: aal, error: aalError } = await hrxSupabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aalError || aal.currentLevel !== 'aal2') { setReady(false); setLoading(false); setLoaded(false); return }

    setReady(true); setLoading(true); setError('')
    try {
      const [requests, clientsResult, documentsResult] = await Promise.all([
        loadRequests(currentSession),
        hrxSupabase.from('clients').select('id', { count: 'exact', head: true }).eq('active', true),
        hrxSupabase.from('hrx_documents').select('id', { count: 'exact', head: true }).neq('status', 'archived'),
      ])
      setState({ requests, activeClients: clientsResult.count ?? 0, documents: documentsResult.count ?? 0 })
      setLoaded(true)
    } catch { setError('Não foi possível consolidar os indicadores executivos agora.') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    void load()
    const { data } = hrxSupabase.auth.onAuthStateChange((_event, session) => { void load(session) })
    return () => data.subscription.unsubscribe()
  }, [])

  const metrics = useMemo(() => {
    const active = state.requests.filter((item) => !['rejected', 'suspended'].includes(item.draft?.status ?? item.status))
    const pipeline = active.reduce((sum, item) => sum + Number(item.draft?.final_amount ?? 0), 0)
    const awaiting = state.requests.filter((item) => (item.draft?.status ?? item.status) === 'awaiting_review').length
    const scope = state.requests.filter((item) => (item.draft?.status ?? item.status) === 'needs_scope').length
    const approved = state.requests.filter((item) => (item.draft?.status ?? item.status) === 'approved').length
    const suspended = state.requests.filter((item) => (item.draft?.status ?? item.status) === 'suspended').length
    const recent = [...state.requests].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 5)
    return { pipeline, awaiting, scope, approved, suspended, recent }
  }, [state.requests])

  if (!open || !ready) return null
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const attention = metrics.awaiting + metrics.scope + metrics.suspended
  const emptyBusiness = loaded && !state.requests.length && state.activeClients === 0 && state.documents === 0

  return <section className="hrx-executive-page" aria-label="Visão Executiva HRX">
    <header className="hrx-executive-header"><div><span>HRX SOLUTIONS · VISÃO EXECUTIVA</span><h1>Visão do negócio</h1><p>{today} · acompanhamento consolidado da operação</p></div><div className="hrx-executive-header-actions"><span className="is-secure">AAL2 · Protegido</span><button type="button" onClick={() => void load()} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</button></div></header>
    {error && loaded && <div className="hrx-executive-alert is-error">{error}</div>}
    <main className="hrx-executive-content">
      {!loaded && loading && <section className="hrx-executive-state" aria-live="polite"><i /><div><strong>Consolidando indicadores</strong><span>Clientes, carteira, documentos e decisões estão sendo atualizados.</span></div></section>}
      {!loaded && !loading && error && <section className="hrx-executive-state is-error"><div><strong>Não foi possível abrir a visão consolidada.</strong><span>{error}</span></div><button type="button" onClick={() => void load()}>Tentar novamente</button></section>}
      {loaded && <>
        {emptyBusiness && <section className="hrx-executive-state is-empty"><div><strong>O cockpit está pronto para receber a operação.</strong><span>Cadastre clientes, crie oportunidades ou adicione documentos para formar a primeira visão consolidada.</span></div><button type="button" onClick={() => navigateAdmin('clients')}>Abrir Clientes</button></section>}
        <section className="hrx-executive-hero"><div><span>CARTEIRA EM ANÁLISE</span><strong>{currency.format(metrics.pipeline)}</strong><p>Valor potencial dos orçamentos ativos no pipeline.</p></div><aside><span>ATENÇÃO NECESSÁRIA</span><strong>{attention}</strong><p>Itens aguardando revisão, escopo ou retomada.</p></aside></section>
        <section className="hrx-executive-kpis" aria-label="Indicadores principais"><article><span>Clientes ativos</span><strong>{number.format(state.activeClients)}</strong><small>Carteira cadastrada</small></article><article><span>Aguardando revisão</span><strong>{number.format(metrics.awaiting)}</strong><small>Decisão administrativa</small></article><article><span>Aprovados</span><strong>{number.format(metrics.approved)}</strong><small>Prontos para avanço</small></article><article><span>Documentos ativos</span><strong>{number.format(state.documents)}</strong><small>Central HRX</small></article></section>
        <section className="hrx-executive-grid"><article className="hrx-executive-panel"><header><div><span>COMERCIAL</span><h2>Pipeline e decisões</h2></div><button type="button" onClick={() => navigateAdmin('quotes')}>Abrir orçamentos →</button></header><div className="hrx-executive-status-grid"><div><span>Revisão</span><strong>{metrics.awaiting}</strong></div><div><span>Escopo</span><strong>{metrics.scope}</strong></div><div><span>Suspensos</span><strong>{metrics.suspended}</strong></div></div><div className="hrx-executive-recent">{metrics.recent.map((request) => <button key={request.id} type="button" onClick={() => navigateAdmin('quotes')}><div><strong>{request.company || request.name}</strong><small>{new Date(request.created_at).toLocaleDateString('pt-BR')}</small></div><span>{currency.format(Number(request.draft?.final_amount ?? 0))}</span></button>)}{!metrics.recent.length && <p>Nenhuma solicitação recente.</p>}</div></article><article className="hrx-executive-panel is-attention"><header><div><span>GESTÃO</span><h2>Atenção necessária</h2></div></header><button type="button" className={metrics.awaiting ? 'is-warning' : ''} onClick={() => navigateAdmin('quotes')}><div><strong>Orçamentos aguardando revisão</strong><small>Validar escopo, preço e condições</small></div><b>{metrics.awaiting}</b></button><button type="button" className={metrics.scope ? 'is-warning' : ''} onClick={() => navigateAdmin('quotes')}><div><strong>Escopos incompletos</strong><small>Solicitam complementação antes da proposta</small></div><b>{metrics.scope}</b></button><button type="button" className={metrics.suspended ? 'is-warning' : ''} onClick={() => navigateAdmin('suspensions')}><div><strong>Itens suspensos</strong><small>Decidir retomada ou encerramento</small></div><b>{metrics.suspended}</b></button><button type="button" onClick={() => navigateAdmin('documents')}><div><strong>Governança documental</strong><small>{state.documents} documentos ativos na Central HRX</small></div><b>→</b></button></article></section>
        <section className="hrx-executive-quick-actions" aria-label="Áreas de gestão"><button type="button" onClick={() => navigateAdmin('clients')}><span>♙</span><div><strong>Clientes</strong><small>Carteira e histórico</small></div></button><button type="button" onClick={() => navigateAdmin('panels')}><span>▦</span><div><strong>Projetos</strong><small>Status e prioridades</small></div></button><button type="button" onClick={() => navigateAdmin('fiscal')}><span>◇</span><div><strong>Fiscal</strong><small>Cadastro tributário</small></div></button><button type="button" onClick={() => navigateAdmin('documents')}><span>▤</span><div><strong>Documentos</strong><small>Contratos e governança</small></div></button></section>
      </>}
    </main>
  </section>
}
