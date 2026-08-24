import { ReactNode, useEffect, useMemo, useState } from 'react'
import { hrxSupabase } from './supabaseClient'
import { navigateAdmin } from './adminNavigation'

type DraftRow = {
  request_id: string
  status: string
  updated_at?: string | null
  suspension_reason?: string | null
  suspension_note?: string | null
}

type RequestRow = {
  id: string
  protocol: string
  created_at: string
  name: string
  company?: string | null
}

type DocumentRow = {
  id: string
  title: string
  area_key: string
  client_name?: string | null
  created_at: string
  updated_at?: string | null
}

type ActivityStatus = 'progress' | 'blocked' | 'validation' | 'complete'
type ActivityRow = {
  id: string
  title: string
  context: string
  kind: 'document' | 'project'
  status: ActivityStatus
  priority: 'Alta' | 'Média' | 'Baixa'
  at: string
  detail?: string
}

const areaLabels: Record<string, string> = {
  institutional: 'Institucional', clients: 'Clientes', templates: 'Modelos', internal: 'Projetos',
  commercial: 'Comercial', finance: 'Financeiro', legal: 'Contratos', archive: 'Arquivo',
}

const milestone: Record<string, string> = {
  new: 'Triagem inicial', received: 'Análise da solicitação', awaiting_review: 'Validação administrativa',
  needs_scope: 'Completar escopo', approved: 'Entrega aprovada', rejected: 'Registro encerrado', suspended: 'Resolver bloqueio',
}

function statusFrom(value: string): ActivityStatus {
  if (value === 'suspended') return 'blocked'
  if (value === 'awaiting_review' || value === 'needs_scope') return 'validation'
  if (value === 'approved' || value === 'rejected') return 'complete'
  return 'progress'
}

function priorityFrom(value: string): ActivityRow['priority'] {
  if (value === 'suspended' || value === 'needs_scope') return 'Alta'
  if (value === 'awaiting_review') return 'Média'
  return 'Baixa'
}

function sameDay(value: string) {
  return new Date(value).toDateString() === new Date().toDateString()
}

function thisWeek(value: string) {
  const age = Date.now() - new Date(value).valueOf()
  return age >= 0 && age <= 7 * 86400000
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function Metric({ label, value, note, tone }: { label: string; value: number; note: string; tone: string }) {
  return <article className={`hrx-glass-metric tone-${tone}`}><div><small>{label}</small><strong>{value.toLocaleString('pt-BR')}</strong><p>{note}</p></div></article>
}

function ActivityCard({ item }: { item: ActivityRow }) {
  return <article className="hrx-activity-card">
    <header><span className={`hrx-status tone-${item.status === 'blocked' ? 'danger' : item.status === 'validation' ? 'warning' : item.status === 'complete' ? 'success' : 'info'}`}>{item.status === 'blocked' ? 'Bloqueada' : item.status === 'validation' ? 'Em validação' : item.status === 'complete' ? 'Concluída' : 'Em andamento'}</span><time>{formatDate(item.at)}</time></header>
    <strong>{item.title}</strong>
    <p>{item.context}</p>
    {item.detail && <small>{item.detail}</small>}
    <footer><span>Prioridade {item.priority}</span>{item.kind === 'project' && <button type="button" onClick={() => navigateAdmin('panels')}>Abrir projeto</button>}{item.kind === 'document' && <button type="button" onClick={() => navigateAdmin('documents')}>Abrir documentos</button>}</footer>
  </article>
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return <section className="hrx-activity-column"><header><h2>{title}</h2></header><div>{children}</div></section>
}

export default function AdminActivitiesPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [drafts, setDrafts] = useState<DraftRow[]>([])
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [tab, setTab] = useState<'all' | ActivityStatus>('all')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [requestsResult, draftsResult, documentsResult] = await Promise.all([
        hrxSupabase.from('quote_requests').select('id,protocol,created_at,name,company').order('created_at', { ascending: false }).limit(500),
        hrxSupabase.from('quote_drafts').select('request_id,status,updated_at,suspension_reason,suspension_note'),
        hrxSupabase.from('hrx_documents').select('id,title,area_key,client_name,created_at,updated_at').neq('status', 'archived').order('created_at', { ascending: false }).limit(500),
      ])
      if (requestsResult.error || draftsResult.error || documentsResult.error) throw new Error('data_unavailable')
      setRequests((requestsResult.data ?? []) as RequestRow[])
      setDrafts((draftsResult.data ?? []) as DraftRow[])
      setDocuments((documentsResult.data ?? []) as DocumentRow[])
    } catch {
      setError('Não foi possível carregar as atividades agora.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const activities = useMemo(() => {
    const draftByRequest = new Map(drafts.map((item) => [item.request_id, item]))
    const projectRows: ActivityRow[] = requests.map((request) => {
      const draft = draftByRequest.get(request.id)
      const status = draft?.status || 'received'
      return {
        id: `project-${request.id}`,
        title: milestone[status] || 'Acompanhamento operacional',
        context: `${request.protocol} · ${request.company || request.name}`,
        kind: 'project',
        status: statusFrom(status),
        priority: priorityFrom(status),
        at: draft?.updated_at || request.created_at,
        detail: draft?.suspension_reason || draft?.suspension_note || undefined,
      }
    })
    const documentRows: ActivityRow[] = documents.map((document) => ({
      id: `document-${document.id}`,
      title: 'Documento atualizado',
      context: `${document.title} · ${document.client_name || areaLabels[document.area_key] || document.area_key}`,
      kind: 'document',
      status: 'complete',
      priority: 'Baixa',
      at: document.updated_at || document.created_at,
    }))
    return [...projectRows, ...documentRows].sort((a, b) => +new Date(b.at) - +new Date(a.at))
  }, [documents, drafts, requests])

  const visible = tab === 'all' ? activities : activities.filter((item) => item.status === tab)
  const today = visible.filter((item) => sameDay(item.at))
  const week = visible.filter((item) => thisWeek(item.at) && !sameDay(item.at))
  const blocked = visible.filter((item) => item.status === 'blocked')

  return <section className="hrx-view hrx-activities-view" aria-labelledby="activities-title">
    <div className="hrx-view-title"><div><h1 id="activities-title">Atividades em andamento</h1><p>Eventos operacionais derivados de solicitações e documentos reais.</p></div><button className="hrx-primary-button" type="button" onClick={() => void load()} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</button></div>
    {error && <div className="hrx-glass-alert" role="alert">{error}</div>}
    <div className="hrx-metric-grid">
      <Metric label="Em andamento" value={activities.filter((item) => item.status === 'progress').length} tone="blue" note="Fluxos abertos" />
      <Metric label="Bloqueadas" value={activities.filter((item) => item.status === 'blocked').length} tone="orange" note="Itens suspensos" />
      <Metric label="Em validação" value={activities.filter((item) => item.status === 'validation').length} tone="purple" note="Aguardando decisão" />
      <Metric label="Concluídas" value={activities.filter((item) => item.status === 'complete').length} tone="green" note="Eventos finalizados" />
    </div>
    <div className="hrx-activity-workspace">
      <nav className="hrx-tabs" aria-label="Filtrar atividades">{([['all', 'Todas'], ['progress', 'Em andamento'], ['blocked', 'Bloqueadas'], ['validation', 'Em validação'], ['complete', 'Concluídas']] as const).map(([value, label]) => <button key={value} type="button" className={tab === value ? 'is-active' : ''} onClick={() => setTab(value)}>{label}</button>)}</nav>
      {loading && !activities.length ? <div className="hrx-loading"><span /><strong>Atualizando atividades…</strong></div> : <div className="hrx-kanban">
        <Column title="Hoje">{today.length ? today.map((item) => <ActivityCard key={item.id} item={item} />) : <p className="hrx-empty">Nenhuma atividade hoje.</p>}</Column>
        <Column title="Esta semana">{week.length ? week.slice(0, 12).map((item) => <ActivityCard key={item.id} item={item} />) : <p className="hrx-empty">Nenhuma atividade adicional nesta semana.</p>}</Column>
        <Column title="Bloqueadas">{blocked.length ? blocked.map((item) => <ActivityCard key={item.id} item={item} />) : <p className="hrx-empty">Nenhum bloqueio aberto.</p>}</Column>
      </div>}
    </div>
  </section>
}
