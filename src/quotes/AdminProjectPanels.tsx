import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import './admin-project-panels.css'

type ProjectId = 'somma' | 'volt' | 'hortifruti'
type ProjectPanel = {
  id: ProjectId
  name: string
  category: string
  status: 'Operacional' | 'Em evolução' | 'Atenção'
  progress: number
  currentPriority: string
  summary: string
  completed: string[]
  pending: string[]
  links: Array<{ label: string; href: string }>
}

const projects: ProjectPanel[] = [
  {
    id: 'hortifruti',
    name: 'Hortifruti Revolução',
    category: 'Site + PWA + operação B2B',
    status: 'Em evolução',
    progress: 72,
    currentPriority: 'Fechar o ciclo operacional completo e validar desktop/mobile.',
    summary: 'Projeto com site institucional, portal do cliente, área administrativa, pedidos, catálogo, consolidação de compras, estrutura fiscal, PWA e notificações.',
    completed: [
      'Site institucional e identidade premium',
      'Cadastro PF/PJ e consulta de CNPJ',
      'Catálogo, pedidos, histórico e status',
      'Consolidação de pedidos para compra',
      'PWA, Web Push e deploy de produção',
    ],
    pending: [
      'Concluir o ciclo operacional completo',
      'Fechar integrações e regras fiscais pendentes',
      'Executar revisão final web desktop e mobile',
      'Consolidar documentação técnica e de entrega',
    ],
    links: [{ label: 'Abrir aplicação', href: 'https://hortifruti-revolucao.vercel.app' }],
  },
  {
    id: 'volt',
    name: 'VOLT',
    category: 'PWA · energia e água',
    status: 'Em evolução',
    progress: 82,
    currentPriority: 'Fechar estabilidade, qualidade visual e pendências do quality gate.',
    summary: 'Aplicação para registrar leituras, acompanhar ciclos de consumo, alertas e relatórios de energia e água.',
    completed: ['PWA instalável e domínio próprio', 'Leituras e ciclos de consumo', 'Dashboard e histórico', 'Base de alertas e relatórios'],
    pending: ['Resolver falhas remanescentes do quality gate', 'Concluir revisão visual claro/escuro', 'Revalidar responsividade e navegação mobile'],
    links: [{ label: 'Abrir VOLT', href: 'https://www.voltconsumo.com.br' }],
  },
  {
    id: 'somma',
    name: 'SOMMA',
    category: 'Site institucional · consultoria',
    status: 'Operacional',
    progress: 91,
    currentPriority: 'Manutenção, acabamento e evolução comercial do site.',
    summary: 'Presença institucional premium para consultoria hoteleira e condomínios, com páginas comerciais, metodologia, cases e contato.',
    completed: ['Site institucional publicado', 'Domínio próprio configurado', 'Identidade visual premium', 'Fluxos de contato e WhatsApp'],
    pending: ['Manter revisão periódica de conteúdo', 'Consolidar melhorias comerciais futuras', 'Monitorar publicação e HTTPS'],
    links: [{ label: 'Abrir SOMMA', href: 'https://sommaconsulthtl.com.br' }],
  },
]

const PANELS_HASH = '#admin/painels'

export default function AdminProjectPanels() {
  const [sidebarTarget, setSidebarTarget] = useState<Element | null>(null)
  const [open, setOpen] = useState(() => window.location.hash === PANELS_HASH)
  const [selectedId, setSelectedId] = useState<ProjectId>('hortifruti')

  useEffect(() => {
    const updateTarget = () => setSidebarTarget(document.querySelector('.admin-exec-sidebar nav'))
    updateTarget()
    const observer = new MutationObserver(updateTarget)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const syncHash = () => setOpen(window.location.hash === PANELS_HASH)
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [])

  const selected = useMemo(() => projects.find((project) => project.id === selectedId) ?? projects[0], [selectedId])
  const overallProgress = Math.round(projects.reduce((total, project) => total + project.progress, 0) / projects.length)
  const pendingTotal = projects.reduce((total, project) => total + project.pending.length, 0)

  const openPanel = (projectId?: ProjectId) => {
    if (projectId) setSelectedId(projectId)
    if (window.location.hash !== PANELS_HASH) window.location.hash = PANELS_HASH
    else setOpen(true)
  }

  const closePanel = () => {
    setOpen(false)
    if (window.location.hash === PANELS_HASH) history.replaceState(null, '', window.location.pathname)
  }

  const sidebarPortal = sidebarTarget ? createPortal(
    <button type="button" className="admin-projects-nav" onClick={() => openPanel()}><span aria-hidden="true">▦</span>Painéis</button>,
    sidebarTarget,
  ) : null

  return <>
    {sidebarPortal}
    {open && <section className="admin-projects-shell" role="dialog" aria-modal="true" aria-label="Painéis de projetos da HRX Solutions">
      <header className="admin-projects-header">
        <div><span>HRX SOLUTIONS · GESTÃO DE PROJETOS</span><h2>Painéis</h2><p>Visão central de status, prioridades e próximos passos.</p></div>
        <button type="button" className="admin-projects-close" aria-label="Fechar painéis" onClick={closePanel}>×</button>
      </header>

      <div className="admin-projects-overview">
        <article><span>PROJETOS ACOMPANHADOS</span><strong>{projects.length}</strong><small>Somma · Volt · Hortifruti</small></article>
        <article><span>PROGRESSO MÉDIO</span><strong>{overallProgress}%</strong><small>Visão executiva consolidada</small></article>
        <article><span>PENDÊNCIAS MAPEADAS</span><strong>{pendingTotal}</strong><small>Itens para revisão e execução</small></article>
      </div>

      <div className="admin-projects-layout">
        <aside className="admin-projects-list" aria-label="Projetos">
          {projects.map((project) => (
            <button key={project.id} type="button" className={selected.id === project.id ? 'is-active' : ''} onClick={() => setSelectedId(project.id)}>
              <div><strong>{project.name}</strong><span className={`status-${project.status.toLowerCase().replace(' ', '-')}`}>{project.status}</span></div>
              <small>{project.category}</small>
              <div className="admin-project-progress"><i style={{ width: `${project.progress}%` }} /></div>
              <em>{project.progress}% concluído</em>
            </button>
          ))}
        </aside>

        <main className="admin-project-detail">
          <div className="admin-project-title"><div><span>{selected.category.toUpperCase()}</span><h3>{selected.name}</h3><p>{selected.summary}</p></div><strong>{selected.progress}%</strong></div>
          <section className="admin-project-priority"><span>PRIORIDADE ATUAL</span><strong>{selected.currentPriority}</strong></section>
          <div className="admin-project-columns">
            <section><header><span>CONCLUÍDO</span><strong>{selected.completed.length}</strong></header>{selected.completed.map((item) => <p key={item}><i>✓</i>{item}</p>)}</section>
            <section><header><span>PRÓXIMOS PASSOS</span><strong>{selected.pending.length}</strong></header>{selected.pending.map((item, index) => <p key={item}><i>{index + 1}</i>{item}</p>)}</section>
          </div>
          <footer className="admin-project-links">{selected.links.map((link) => <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label} ↗</a>)}</footer>
        </main>
      </div>
    </section>}
  </>
}
