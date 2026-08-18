import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import './admin-documents.css'

type DocumentArea = {
  key: string
  title: string
  description: string
  meta: string
  governance: string
  folders: string[]
}

const areas: DocumentArea[] = [
  { key: 'institutional', title: 'Institucional', description: 'Identidade, registros, certidões, apresentações e documentos societários da HRX.', meta: 'Governança corporativa', governance: 'Revisão administrativa', folders: ['Identidade e marca', 'Registros e certidões', 'Apresentações institucionais', 'Políticas e procedimentos'] },
  { key: 'clients', title: 'Clientes', description: 'Dossiês por cliente com levantamento, proposta, contrato, execução, entrega e aceite.', meta: 'Dossiês de clientes', governance: 'Controle por projeto', folders: ['Hortifruti Revolução', 'Novos clientes', 'Encerrados'] },
  { key: 'templates', title: 'Modelos', description: 'Biblioteca controlada de propostas, contratos, atas, termos, checklists e relatórios.', meta: 'Biblioteca padrão', governance: 'Controle de versão', folders: ['Propostas', 'Contratos e termos', 'Atas', 'Checklists', 'Relatórios'] },
  { key: 'internal', title: 'Projetos internos', description: 'Documentação funcional, técnica e operacional dos produtos próprios da HRX.', meta: 'Produtos HRX', governance: 'Gestão de produto', folders: ['VOLT', 'NEXUS', 'HRX Admin'] },
  { key: 'commercial', title: 'Comercial', description: 'Materiais de prospecção, propostas comerciais e registros de negociação.', meta: 'Área comercial', governance: 'Acesso interno', folders: ['Apresentações', 'Propostas enviadas', 'Negociações', 'Referências'] },
  { key: 'finance', title: 'Financeiro', description: 'Documentos fiscais, comprovantes, controles e evidências financeiras.', meta: 'Área financeira', governance: 'Retenção fiscal', folders: ['Notas fiscais', 'Comprovantes', 'Controles', 'Conciliação documental'] },
  { key: 'legal', title: 'Jurídico e contratos', description: 'Contratos, termos, aditivos e documentos que exigem leitura de obrigações, riscos e vigências.', meta: 'Análise contratual', governance: 'Revisão jurídica', folders: ['Contratos vigentes', 'Em revisão', 'Aditivos e termos', 'Encerrados'] },
  { key: 'archive', title: 'Arquivo histórico', description: 'Material encerrado, substituído ou obsoleto preservado para rastreabilidade.', meta: 'Histórico controlado', governance: 'Somente leitura', folders: ['Substituídos', 'Encerrados', 'Legado'] },
]

const hortifrutiFolders = ['Documentos recebidos', 'Levantamento', 'Propostas', 'Contratos', 'Projeto', 'Entregas', 'Aceites', 'Financeiro', 'Arquivo']

export default function AdminDocumentsHub() {
  const [sidebarTarget, setSidebarTarget] = useState<Element | null>(null)
  const [mobileTarget, setMobileTarget] = useState<Element | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedArea, setSelectedArea] = useState<DocumentArea | null>(null)
  const [clientOpen, setClientOpen] = useState(false)

  useEffect(() => {
    const syncTargets = () => {
      setSidebarTarget(document.querySelector('.admin-exec-sidebar nav'))
      setMobileTarget(document.querySelector('.admin-mobile-nav'))
    }
    syncTargets()
    const observer = new MutationObserver(syncTargets)
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
    return areas.filter((area) => [area.title, area.description, area.meta, area.governance, ...area.folders].some((value) => value.toLocaleLowerCase('pt-BR').includes(normalized)))
  }, [query])

  const closeCenter = () => { setOpen(false); setSelectedArea(null); setClientOpen(false) }
  const back = () => { if (clientOpen) setClientOpen(false); else setSelectedArea(null) }

  const sidebarPortal = sidebarTarget ? createPortal(<button type="button" className={`hrx-documents-nav${open ? ' is-active' : ''}`} onClick={() => setOpen(true)}><span aria-hidden="true">▤</span>Central de documentos</button>, sidebarTarget) : null
  const mobilePortal = mobileTarget ? createPortal(<button type="button" className={`hrx-mobile-documents${open ? ' is-active' : ''}`} onClick={() => setOpen(true)}><span aria-hidden="true">▤</span>Documentos</button>, mobileTarget) : null

  const detail = clientOpen ? { title: 'Hortifruti Revolução', eyebrow: 'DOSSIÊ DO CLIENTE', description: 'Documentação organizada pelo ciclo do projeto.', folders: hortifrutiFolders, governance: 'Cliente ativo · controle por projeto' } : selectedArea ? { title: selectedArea.title, eyebrow: 'ÁREA DOCUMENTAL', description: selectedArea.description, folders: selectedArea.folders, governance: selectedArea.governance } : null

  return <>{sidebarPortal}{mobilePortal}{open && <section className="hrx-documents-shell" role="dialog" aria-modal="true" aria-label="Central de Documentos HRX">
    <header className="hrx-documents-header">
      <div className="hrx-documents-heading">{detail && <button type="button" className="hrx-documents-back" onClick={back} aria-label="Voltar">←</button>}<div><span>HRX · GOVERNANÇA DOCUMENTAL</span><h2>{detail ? detail.title : 'Central de Documentos'}</h2><p>{detail ? detail.description : 'Documentos internos organizados por função, projeto, vigência e responsabilidade.'}</p></div></div>
      <div className="hrx-documents-header-actions"><button type="button" onClick={closeCenter} aria-label="Fechar Central de Documentos">×</button></div>
    </header>

    <main className="hrx-documents-content">
      {detail ? <section className="hrx-document-workspace">
        <div className="hrx-document-workspace-meta"><span>{detail.eyebrow}</span><strong>{detail.governance}</strong><p>Abra uma categoria para continuar a navegação dentro do aplicativo. A Central não redireciona para o repositório de código.</p></div>
        <div className="hrx-document-folder-list">{detail.folders.map((folder, index) => <button type="button" key={folder}><span aria-hidden="true">▱</span><div><strong>{folder}</strong><small>Categoria documental · {String(index + 1).padStart(2, '0')}</small></div><b>›</b></button>)}</div>
        {selectedArea?.key === 'legal' && <aside className="hrx-contract-review"><span>LEITURA CONTRATUAL</span><h3>Checklist de análise</h3><div><p>Partes e representação</p><p>Objeto e escopo</p><p>Valores e reajustes</p><p>Prazo e vigência</p><p>Obrigações e SLAs</p><p>Multas e rescisão</p><p>Confidencialidade e LGPD</p><p>Foro e assinaturas</p></div><small>Esta estrutura organiza a revisão; não substitui parecer jurídico profissional quando necessário.</small></aside>}
      </section> : <>
        <section className="hrx-documents-summary"><article><span>CLASSIFICAÇÃO</span><strong>8 áreas</strong><small>Taxonomia funcional</small></article><article><span>INDEXAÇÃO</span><strong>Padronizada</strong><small>Cliente · tipo · data · versão</small></article><article><span>CONTRATOS</span><strong>Controlados</strong><small>Vigência, risco e obrigações</small></article></section>
        <section className="hrx-documents-section"><div className="hrx-documents-section-head"><div><span>CENTRAL HRX</span><h3>Áreas documentais</h3></div><label className="hrx-documents-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar área, documento ou categoria" /></label></div>
          <div className="hrx-documents-grid">{filteredAreas.map((area) => <button key={area.key} type="button" className="hrx-document-card" onClick={() => setSelectedArea(area)}><div className="hrx-document-card-icon" aria-hidden="true">▱</div><div><span>{area.meta}</span><strong>{area.title}</strong><p>{area.description}</p></div><b aria-hidden="true">›</b></button>)}</div>
        </section>
        <section className="hrx-documents-client"><div className="hrx-documents-client-head"><div className="hrx-documents-client-mark">HR</div><div><span>CLIENTE EM DESTAQUE</span><h3>Hortifruti Revolução</h3><p>Dossiê organizado do recebimento ao aceite e arquivo.</p></div><button type="button" onClick={() => setClientOpen(true)}>Abrir dossiê ›</button></div></section>
        <aside className="hrx-documents-note"><div><span>PADRÃO DE INDEXAÇÃO</span><strong>AAAA-MM-DD_CLIENTE_TIPO_DESCRICAO_V01.ext</strong></div><p>A interface passa a tratar documentos como informação de negócio. GitHub é infraestrutura técnica e não aparece como destino da navegação documental.</p></aside>
      </>}
    </main>
  </section>}</>
}
