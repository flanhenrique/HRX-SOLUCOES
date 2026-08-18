import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import './admin-documents.css'

const REPOSITORY_URL = 'https://github.com/flanhenrique/HRX-SOLUCOES'
const DOCUMENTS_ROOT = `${REPOSITORY_URL}/tree/main/DOCUMENTOS`
const HORTIFRUTI_ROOT = `${DOCUMENTS_ROOT}/01_CLIENTES/HORTIFRUTI_REVOLUCAO`

type DocumentArea = {
  key: string
  title: string
  description: string
  path: string
  meta: string
}

const areas: DocumentArea[] = [
  { key: 'institutional', title: 'Institucional', description: 'Identidade visual, registros, certidões e apresentações da HRX.', path: '00_INSTITUCIONAL', meta: '4 categorias' },
  { key: 'clients', title: 'Clientes', description: 'Pastas individuais, levantamentos, contratos, entregas e aceites.', path: '01_CLIENTES', meta: '1 cliente ativo' },
  { key: 'templates', title: 'Modelos', description: 'Modelos de propostas, contratos, atas, termos, checklists e relatórios.', path: '02_MODELOS', meta: 'Biblioteca padrão' },
  { key: 'internal', title: 'Projetos internos', description: 'Documentação de produtos e iniciativas internas da HRX Solutions.', path: '03_PROJETOS_INTERNOS', meta: 'VOLT · NEXUS' },
  { key: 'commercial', title: 'Comercial', description: 'Apresentações, propostas e materiais usados no processo comercial.', path: '04_COMERCIAL', meta: 'Área comercial' },
  { key: 'finance', title: 'Financeiro', description: 'Notas fiscais, comprovantes e controles financeiros documentais.', path: '05_FINANCEIRO', meta: 'Área financeira' },
  { key: 'legal', title: 'Jurídico', description: 'Contratos da HRX, termos e registros jurídicos.', path: '06_JURIDICO', meta: 'Área jurídica' },
  { key: 'archive', title: 'Arquivo', description: 'Material encerrado ou substituído que precisa permanecer preservado.', path: '99_ARQUIVO', meta: 'Histórico' },
]

const hortifrutiFolders = [
  ['00_DOCUMENTOS_RECEBIDOS', 'Recebidos'],
  ['01_LEVANTAMENTO', 'Levantamento'],
  ['02_PROPOSTAS', 'Propostas'],
  ['03_CONTRATOS', 'Contratos'],
  ['04_PROJETO', 'Projeto'],
  ['05_ENTREGAS', 'Entregas'],
  ['06_ACEITES', 'Aceites'],
  ['07_FINANCEIRO', 'Financeiro'],
  ['99_ARQUIVO', 'Arquivo'],
] as const

function repoFolder(path: string) {
  return `${DOCUMENTS_ROOT}/${path}`
}

export default function AdminDocumentsHub() {
  const [sidebarTarget, setSidebarTarget] = useState<Element | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const syncTarget = () => setSidebarTarget(document.querySelector('.admin-exec-sidebar nav'))
    syncTarget()
    const observer = new MutationObserver(syncTarget)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const openDocuments = () => setOpen(true)
    window.addEventListener('hrx:open-documents', openDocuments)
    return () => window.removeEventListener('hrx:open-documents', openDocuments)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('hrx-documents-open', open)
    return () => document.documentElement.classList.remove('hrx-documents-open')
  }, [open])

  const filteredAreas = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR')
    if (!normalized) return areas
    return areas.filter((area) => [area.title, area.description, area.meta].some((value) => value.toLocaleLowerCase('pt-BR').includes(normalized)))
  }, [query])

  const sidebarPortal = sidebarTarget ? createPortal(
    <button type="button" className={`hrx-documents-nav${open ? ' is-active' : ''}`} onClick={() => setOpen(true)}>
      <span aria-hidden="true">▤</span>
      Documentos
    </button>,
    sidebarTarget,
  ) : null

  return <>
    {sidebarPortal}

    {open && <section className="hrx-documents-shell" role="dialog" aria-modal="true" aria-label="Repositório de documentos HRX">
      <header className="hrx-documents-header">
        <div>
          <span>HRX · REPOSITÓRIO</span>
          <h2>Documentos</h2>
          <p>Central documental vinculada ao repositório HRX-SOLUCOES.</p>
        </div>
        <div className="hrx-documents-header-actions">
          <a href={DOCUMENTS_ROOT} target="_blank" rel="noreferrer">Abrir no GitHub ↗</a>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fechar documentos">×</button>
        </div>
      </header>

      <main className="hrx-documents-content">
        <section className="hrx-documents-summary">
          <article>
            <span>ESTRUTURA</span>
            <strong>8 áreas</strong>
            <small>Organização documental principal</small>
          </article>
          <article>
            <span>CLIENTES</span>
            <strong>1 ativo</strong>
            <small>Hortifruti Revolução</small>
          </article>
          <article>
            <span>PADRÃO</span>
            <strong>Versionado</strong>
            <small>Histórico preservado no GitHub</small>
          </article>
        </section>

        <section className="hrx-documents-section">
          <div className="hrx-documents-section-head">
            <div><span>VISÃO GERAL</span><h3>Estrutura documental</h3></div>
            <label className="hrx-documents-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar área" /></label>
          </div>
          <div className="hrx-documents-grid">
            {filteredAreas.map((area) => <a key={area.key} className="hrx-document-card" href={repoFolder(area.path)} target="_blank" rel="noreferrer">
              <div className="hrx-document-card-icon" aria-hidden="true">▱</div>
              <div><span>{area.meta}</span><strong>{area.title}</strong><p>{area.description}</p></div>
              <b aria-hidden="true">↗</b>
            </a>)}
          </div>
        </section>

        <section className="hrx-documents-client">
          <div className="hrx-documents-client-head">
            <div className="hrx-documents-client-mark">HR</div>
            <div><span>CLIENTE EM DESTAQUE</span><h3>Hortifruti Revolução</h3><p>Estrutura pronta para receber e classificar os documentos do projeto.</p></div>
            <a href={HORTIFRUTI_ROOT} target="_blank" rel="noreferrer">Abrir pasta ↗</a>
          </div>
          <div className="hrx-documents-client-folders">
            {hortifrutiFolders.map(([folder, label]) => <a key={folder} href={`${HORTIFRUTI_ROOT}/${folder}`} target="_blank" rel="noreferrer"><span aria-hidden="true">▱</span><strong>{label}</strong><small>{folder}</small></a>)}
          </div>
        </section>

        <aside className="hrx-documents-note">
          <div><span>PADRÃO DE ARQUIVO</span><strong>AAAA-MM-DD_CLIENTE_TIPO_DESCRICAO_V01.ext</strong></div>
          <p>O aplicativo funciona como central de navegação. Os arquivos continuam versionados no GitHub, evitando duplicar documentos e criar duas fontes diferentes de verdade.</p>
        </aside>
      </main>
    </section>}
  </>
}
