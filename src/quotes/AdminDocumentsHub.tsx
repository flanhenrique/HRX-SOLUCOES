import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { hrxSupabase } from './supabaseClient'
import './admin-documents.css'
import './admin-documents-storage.css'

type DocumentArea = {
  key: string
  title: string
  description: string
  meta: string
  governance: string
  folders: string[]
}

type DocumentRow = {
  id: string
  object_path: string
  area_key: string
  folder: string
  client_name?: string | null
  document_type?: string | null
  title: string
  version: number
  status: 'active' | 'superseded' | 'archived'
  access_class: 'internal' | 'restricted' | 'confidential'
  effective_date?: string | null
  expires_at?: string | null
  mime_type?: string | null
  size_bytes?: number | null
  created_at: string
}

type VoltLibraryDocument = {
  id: string
  title: string
  code: string
  category: string
  status: string
  description: string
  sourcePath: string
}

type DocumentViewer = {
  title: string
  meta: string
  kind: 'pdf' | 'image' | 'text' | 'download' | 'error'
  url?: string
  content?: string
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
const acceptedTypes = '.pdf,.docx,.xlsx,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp'
const voltSourceBase = 'https://raw.githubusercontent.com/flanhenrique/Volt-consumo/main/'
const voltLibrary: VoltLibraryDocument[] = [
  { id: 'volt-readme', code: 'VOLT', category: 'Governança e visão', title: 'Visão geral do produto', status: 'Ativo', description: 'Escopo do PWA, funcionalidades, autenticação, OCR, energia, água e operação básica.', sourcePath: 'README.md' },
  { id: 'volt-architecture', code: 'ARCH', category: 'Arquitetura', title: 'Architecture', status: 'Ativo', description: 'Visão arquitetural, fronteiras e decisões técnicas do produto.', sourcePath: 'ARCHITECTURE.md' },
  { id: 'volt-domain-foundation', code: 'DOMAIN', category: 'Arquitetura', title: 'Domain Foundation', status: 'Ativo', description: 'Fundação de domínios e contratos estruturais do VOLT.', sourcePath: 'docs/VOLT-DOMAIN-FOUNDATION.md' },
  { id: 'volt-responsive', code: 'UX-ARCH', category: 'Arquitetura', title: 'Responsive Architecture', status: 'Ativo', description: 'Arquitetura responsiva e regras de comportamento entre mobile e desktop.', sourcePath: 'docs/VOLT-RESPONSIVE-ARCHITECTURE.md' },
  { id: 'volt-integrity', code: 'AUD-DATA', category: 'Auditoria e dados', title: 'Data Integrity Audit', status: 'Ativo', description: 'Auditoria de integridade dos dados e riscos associados.', sourcePath: 'DATA_INTEGRITY_AUDIT.md' },
  { id: 'volt-forensic-matrix', code: 'AUD-MATRIX', category: 'Auditoria e dados', title: 'Forensic Audit Matrix', status: 'Ativo', description: 'Matriz de auditoria técnica e rastreabilidade de achados.', sourcePath: 'FORENSIC_AUDIT_MATRIX.md' },
  { id: 'volt-stabilization', code: 'AUD-STAB', category: 'Auditoria e dados', title: 'Forensic Stabilization Report', status: 'Ativo', description: 'Relatório de estabilização após auditoria forense.', sourcePath: 'FORENSIC_STABILIZATION_REPORT.md' },
  { id: 'volt-glass-report', code: 'DESIGN-RPT', category: 'Design e experiência', title: 'Liquid Glass Redesign Report', status: 'Ativo', description: 'Relatório de redesign e critérios visuais aplicados ao produto.', sourcePath: 'VOLT_LIQUID_GLASS_REDESIGN_REPORT.md' },
  { id: 'volt-design-system', code: 'DESIGN', category: 'Design e experiência', title: 'Liquid Glass Design System', status: 'Ativo', description: 'Sistema visual, tokens e regras de interface do VOLT.', sourcePath: 'docs/VOLT-LIQUID-GLASS-DESIGN-SYSTEM.md' },
  { id: 'volt-auth-runbook', code: 'RUNBOOK', category: 'Operações', title: 'Auth Migration Rollback — Beta', status: 'Operacional', description: 'Runbook de rollback da migração de autenticação no ambiente beta.', sourcePath: 'docs/runbooks/AUTH-MIGRATION-ROLLBACK-BETA.md' },
]

function slug(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function safeFileName(value: string) {
  const index = value.lastIndexOf('.')
  const extension = index >= 0 ? value.slice(index).toLowerCase().replace(/[^a-z0-9.]/g, '') : ''
  const base = (index >= 0 ? value.slice(0, index) : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'documento'
  return `${base}${extension}`
}

function formatBytes(value?: number | null) {
  const bytes = Number(value ?? 0)
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AdminDocumentsHub() {
  const [sidebarTarget, setSidebarTarget] = useState<Element | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedArea, setSelectedArea] = useState<DocumentArea | null>(null)
  const [clientOpen, setClientOpen] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [storageMessage, setStorageMessage] = useState('')
  const [voltQuery, setVoltQuery] = useState('')
  const [voltCategory, setVoltCategory] = useState('Todos')
  const [viewer, setViewer] = useState<DocumentViewer | null>(null)
  const [viewerLoading, setViewerLoading] = useState(false)

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
    return areas.filter((area) => [area.title, area.description, area.meta, area.governance, ...area.folders].some((value) => value.toLocaleLowerCase('pt-BR').includes(normalized)))
  }, [query])

  const voltCategories = useMemo(() => ['Todos', ...Array.from(new Set(voltLibrary.map((document) => document.category)))], [])
  const filteredVoltDocuments = useMemo(() => {
    const normalized = voltQuery.trim().toLocaleLowerCase('pt-BR')
    return voltLibrary.filter((document) => {
      const categoryMatches = voltCategory === 'Todos' || document.category === voltCategory
      const queryMatches = !normalized || [document.title, document.code, document.category, document.description].some((value) => value.toLocaleLowerCase('pt-BR').includes(normalized))
      return categoryMatches && queryMatches
    })
  }, [voltCategory, voltQuery])

  const parentDetail = clientOpen
    ? { title: 'Hortifruti Revolução', eyebrow: 'DOSSIÊ DO CLIENTE', description: 'Documentação organizada pelo ciclo do projeto.', folders: hortifrutiFolders, governance: 'Cliente ativo · controle por projeto', areaKey: 'clients', clientName: 'Hortifruti Revolução' }
    : selectedArea
      ? { title: selectedArea.title, eyebrow: 'ÁREA DOCUMENTAL', description: selectedArea.description, folders: selectedArea.folders, governance: selectedArea.governance, areaKey: selectedArea.key, clientName: null }
      : null

  const isVoltLibrary = Boolean(selectedFolder === 'VOLT' && parentDetail?.areaKey === 'internal')

  const loadDocuments = async () => {
    if (!selectedFolder || !parentDetail) return
    setDocumentsLoading(true)
    setStorageMessage('')
    let request = hrxSupabase.from('hrx_documents').select('*').eq('area_key', parentDetail.areaKey).eq('folder', selectedFolder).neq('status', 'archived').order('created_at', { ascending: false })
    if (parentDetail.clientName) request = request.eq('client_name', parentDetail.clientName)
    else request = request.is('client_name', null)
    const { data, error } = await request
    setDocumentsLoading(false)
    if (error) {
      setDocuments([])
      setStorageMessage(error.message.includes('permission') ? 'Sua sessão precisa estar validada em duas etapas para acessar documentos.' : 'Não foi possível carregar os documentos desta pasta.')
      return
    }
    setDocuments((data ?? []) as DocumentRow[])
  }

  useEffect(() => { if (selectedFolder && parentDetail) void loadDocuments() }, [selectedFolder, parentDetail?.areaKey, parentDetail?.clientName])

  const closeViewer = () => {
    setViewer(null)
    setViewerLoading(false)
  }

  const closeCenter = () => {
    setOpen(false)
    setSelectedArea(null)
    setClientOpen(false)
    setSelectedFolder(null)
    setDocuments([])
    setStorageMessage('')
    setVoltQuery('')
    setVoltCategory('Todos')
    closeViewer()
  }

  const back = () => {
    if (viewer) {
      closeViewer()
      return
    }
    setStorageMessage('')
    if (selectedFolder) { setSelectedFolder(null); setDocuments([]); setVoltQuery(''); setVoltCategory('Todos') }
    else if (clientOpen) setClientOpen(false)
    else setSelectedArea(null)
  }

  const uploadDocument = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !selectedFolder || !parentDetail) return
    if (file.size > 25 * 1024 * 1024) {
      setStorageMessage('O arquivo excede o limite de 25 MB.')
      return
    }

    setUploading(true)
    setStorageMessage('')
    const objectPath = `${parentDetail.areaKey}/${slug(parentDetail.clientName ?? 'geral')}/${slug(selectedFolder)}/${Date.now()}_${safeFileName(file.name)}`
    const { error: uploadError } = await hrxSupabase.storage.from('hrx-documents').upload(objectPath, file, { contentType: file.type || undefined, upsert: false })
    if (uploadError) {
      setUploading(false)
      setStorageMessage('Não foi possível enviar o arquivo. Verifique o formato, tamanho e sua sessão de segurança.')
      return
    }

    const { error: metadataError } = await hrxSupabase.from('hrx_documents').insert({
      object_path: objectPath,
      area_key: parentDetail.areaKey,
      folder: selectedFolder,
      client_name: parentDetail.clientName,
      document_type: file.name.split('.').pop()?.toUpperCase() || 'ARQUIVO',
      title: file.name.replace(/\.[^.]+$/, ''),
      version: 1,
      status: 'active',
      access_class: selectedArea?.key === 'legal' || selectedArea?.key === 'finance' ? 'restricted' : 'internal',
      mime_type: file.type || null,
      size_bytes: file.size,
    })

    if (metadataError) {
      await hrxSupabase.storage.from('hrx-documents').remove([objectPath])
      setUploading(false)
      setStorageMessage('O arquivo foi recusado porque os metadados não puderam ser registrados com segurança.')
      return
    }

    setUploading(false)
    setStorageMessage('Documento arquivado com sucesso.')
    await loadDocuments()
  }

  const openVoltDocument = async (document: VoltLibraryDocument) => {
    setViewerLoading(true)
    setViewer({ title: document.title, meta: `${document.code} · ${document.category} · ${document.status}`, kind: 'text', content: '' })
    try {
      const response = await fetch(`${voltSourceBase}${document.sourcePath}`, { headers: { Accept: 'text/plain' } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const content = await response.text()
      setViewer({ title: document.title, meta: `${document.code} · ${document.category} · ${document.status}`, kind: 'text', content })
    } catch {
      setViewer({ title: document.title, meta: `${document.code} · ${document.category}`, kind: 'error', content: 'O documento está catalogado, mas a fonte técnica não respondeu neste momento.' })
    } finally {
      setViewerLoading(false)
    }
  }

  const openDocument = async (document: DocumentRow) => {
    setStorageMessage('')
    setViewerLoading(true)
    const { data, error } = await hrxSupabase.storage.from('hrx-documents').createSignedUrl(document.object_path, 60)
    if (error || !data?.signedUrl) {
      setViewerLoading(false)
      setStorageMessage('Não foi possível gerar o acesso temporário ao documento.')
      return
    }

    const mime = (document.mime_type ?? '').toLowerCase()
    const type = (document.document_type ?? '').toLowerCase()
    const meta = `V${String(document.version).padStart(2, '0')} · ${document.document_type || 'ARQUIVO'} · ${formatBytes(document.size_bytes)}`

    if (mime.includes('pdf') || type === 'pdf') {
      setViewer({ title: document.title, meta, kind: 'pdf', url: data.signedUrl })
      setViewerLoading(false)
      return
    }

    if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(type)) {
      setViewer({ title: document.title, meta, kind: 'image', url: data.signedUrl })
      setViewerLoading(false)
      return
    }

    if (mime.startsWith('text/') || ['txt', 'csv', 'md'].includes(type)) {
      try {
        const response = await fetch(data.signedUrl)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const content = await response.text()
        setViewer({ title: document.title, meta, kind: 'text', content })
      } catch {
        setViewer({ title: document.title, meta, kind: 'error', content: 'Não foi possível carregar a pré-visualização textual deste arquivo.' })
      } finally {
        setViewerLoading(false)
      }
      return
    }

    setViewer({ title: document.title, meta, kind: 'download', url: data.signedUrl, content: 'Este formato não possui visualização nativa segura no navegador. O arquivo continua protegido pela Central HRX.' })
    setViewerLoading(false)
  }

  const sidebarPortal = sidebarTarget ? createPortal(<button type="button" className={`hrx-documents-nav${open ? ' is-active' : ''}`} onClick={() => setOpen(true)}><span aria-hidden="true">▤</span>Central de documentos</button>, sidebarTarget) : null
  const headerTitle = selectedFolder ?? parentDetail?.title ?? 'Central de Documentos'
  const headerDescription = isVoltLibrary ? 'Biblioteca documental do VOLT · produto, arquitetura, dados, auditoria, design e operações.' : selectedFolder ? `${parentDetail?.title ?? 'Central HRX'} · categoria documental` : parentDetail?.description ?? 'Documentos internos organizados por função, projeto, vigência e responsabilidade.'
  const showBack = Boolean(parentDetail || selectedFolder || viewer)

  return <>{sidebarPortal}{open && <section className="hrx-documents-shell" role="dialog" aria-modal="true" aria-label="Central de Documentos HRX">
    <header className="hrx-documents-header">
      <div className="hrx-documents-heading">{showBack && <button type="button" className="hrx-documents-back" onClick={back} aria-label="Voltar">←</button>}<div><span>HRX · GOVERNANÇA DOCUMENTAL</span><h2>{headerTitle}</h2><p>{headerDescription}</p></div></div>
      <div className="hrx-documents-header-actions"><button type="button" onClick={closeCenter} aria-label="Fechar Central de Documentos">×</button></div>
    </header>

    <main className="hrx-documents-content">
      {selectedFolder && parentDetail ? <section className="hrx-document-workspace">
        {isVoltLibrary ? <>
          <div className="hrx-document-workspace-meta hrx-volt-library-intro"><span>VOLT · BIBLIOTECA DOCUMENTAL</span><strong>Acervo técnico conectado à Central HRX</strong><p>Documentos do produto são lidos dentro do aplicativo. Arquivos privados e PDFs oficiais podem coexistir nesta pasta com versionamento, controle de acesso e histórico.</p></div>
          <div className="hrx-volt-library-toolbar">
            <label className="hrx-documents-search"><span aria-hidden="true">⌕</span><input value={voltQuery} onChange={(event) => setVoltQuery(event.target.value)} placeholder="Buscar no acervo VOLT" /></label>
            <div className="hrx-volt-library-filters" aria-label="Categorias do acervo VOLT">{voltCategories.map((category) => <button key={category} type="button" className={voltCategory === category ? 'is-active' : ''} onClick={() => setVoltCategory(category)}>{category}</button>)}</div>
          </div>
          <div className="hrx-volt-library-summary"><span>{filteredVoltDocuments.length} documento(s) técnico(s)</span><small>Leitura interna · sem redirecionamento externo</small></div>
          <div className="hrx-volt-library-list">
            {filteredVoltDocuments.map((document) => <button type="button" key={document.id} onClick={() => void openVoltDocument(document)}><span className="hrx-volt-library-code">{document.code}</span><div><small>{document.category}</small><strong>{document.title}</strong><p>{document.description}</p></div><b>{document.status} ›</b></button>)}
            {filteredVoltDocuments.length === 0 && <div className="hrx-document-empty"><strong>Nenhum documento encontrado.</strong><span>Ajuste a busca ou selecione outra categoria.</span></div>}
          </div>
          <div className="hrx-volt-private-head"><div><span>ARQUIVOS CONTROLADOS</span><strong>Documentos privados e versões oficiais</strong><p>Use esta área para PDFs, entregáveis, registros e versões que precisam permanecer no storage privado da HRX.</p></div><label className={uploading ? 'is-disabled' : ''}>{uploading ? 'Enviando…' : '+ Adicionar documento'}<input type="file" accept={acceptedTypes} disabled={uploading} onChange={(event) => void uploadDocument(event)} /></label></div>
        </> : <div className="hrx-document-workspace-meta"><span>PASTA DOCUMENTAL</span><strong>{parentDetail.governance}</strong><p>Arquivos privados com controle de acesso, metadados e histórico de versão.</p></div>}

        {!isVoltLibrary && <div className="hrx-document-storage-toolbar"><div><span>{documents.length} documento(s)</span><small>Limite por arquivo: 25 MB</small></div><label className={uploading ? 'is-disabled' : ''}>{uploading ? 'Enviando…' : '+ Adicionar documento'}<input type="file" accept={acceptedTypes} disabled={uploading} onChange={(event) => void uploadDocument(event)} /></label></div>}
        {storageMessage && <div className="hrx-document-storage-message" role="status">{storageMessage}</div>}
        <div className="hrx-document-file-list">
          {documentsLoading && <p className="hrx-document-empty">Carregando documentos…</p>}
          {!documentsLoading && documents.length === 0 && !isVoltLibrary && <div className="hrx-document-empty"><strong>Nenhum documento cadastrado nesta categoria.</strong><span>Use “Adicionar documento” para iniciar o arquivo desta pasta.</span></div>}
          {!documentsLoading && documents.length === 0 && isVoltLibrary && <div className="hrx-document-empty hrx-volt-private-empty"><strong>Nenhum arquivo privado do VOLT cadastrado.</strong><span>O acervo técnico acima permanece disponível; use “Adicionar documento” para incorporar PDFs e versões controladas ao storage HRX.</span></div>}
          {!documentsLoading && documents.map((document) => <button type="button" key={document.id} onClick={() => void openDocument(document)}><span aria-hidden="true">▤</span><div><strong>{document.title}</strong><small>V{String(document.version).padStart(2, '0')} · {document.document_type || 'ARQUIVO'} · {formatBytes(document.size_bytes)}</small><time>{new Date(document.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</time></div><b>{document.access_class === 'confidential' ? 'Confidencial' : document.access_class === 'restricted' ? 'Restrito' : 'Interno'} ›</b></button>)}
        </div>
        <aside className="hrx-documents-note"><div><span>PADRÃO DE INDEXAÇÃO</span><strong>{isVoltLibrary ? 'VOLT_CODIGO_DESCRICAO_VERSAO.ext' : 'AAAA-MM-DD_CLIENTE_TIPO_DESCRICAO_V01.ext'}</strong></div><p>{isVoltLibrary ? 'O VOLT preserva código documental, versão, status e histórico. IDs históricos não devem ser reutilizados.' : 'Campos mínimos: cliente ou área, tipo documental, data, versão, responsável, vigência e classificação de acesso.'}</p></aside>
      </section> : parentDetail ? <section className="hrx-document-workspace">
        <div className="hrx-document-workspace-meta"><span>{parentDetail.eyebrow}</span><strong>{parentDetail.governance}</strong><p>Selecione uma categoria para continuar a navegação dentro da Central de Documentos.</p></div>
        <div className="hrx-document-folder-list">{parentDetail.folders.map((folder, index) => <button type="button" key={folder} onClick={() => setSelectedFolder(folder)}><span aria-hidden="true">▱</span><div><strong>{folder}</strong><small>{folder === 'VOLT' ? 'Produto HRX · biblioteca documental' : `Categoria documental · ${String(index + 1).padStart(2, '0')}`}</small></div><b>›</b></button>)}</div>
        {selectedArea?.key === 'legal' && <aside className="hrx-contract-review"><span>LEITURA CONTRATUAL</span><h3>Checklist de análise</h3><div><p>Partes e representação</p><p>Objeto e escopo</p><p>Valores e reajustes</p><p>Prazo e vigência</p><p>Obrigações e SLAs</p><p>Multas e rescisão</p><p>Confidencialidade e LGPD</p><p>Foro e assinaturas</p></div><small>Esta estrutura organiza a revisão; não substitui parecer jurídico profissional quando necessário.</small></aside>}
      </section> : <>
        <section className="hrx-documents-summary"><article><span>CLASSIFICAÇÃO</span><strong>8 áreas</strong><small>Taxonomia funcional</small></article><article><span>INDEXAÇÃO</span><strong>Padronizada</strong><small>Cliente · tipo · data · versão</small></article><article><span>CONTRATOS</span><strong>Controlados</strong><small>Vigência, risco e obrigações</small></article></section>
        <section className="hrx-documents-section"><div className="hrx-documents-section-head"><div><span>CENTRAL HRX</span><h3>Áreas documentais</h3></div><label className="hrx-documents-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar área, documento ou categoria" /></label></div>
          <div className="hrx-documents-grid">{filteredAreas.map((area) => <button key={area.key} type="button" className="hrx-document-card" onClick={() => { setSelectedArea(area); setSelectedFolder(null) }}><div className="hrx-document-card-icon" aria-hidden="true">▱</div><div><span>{area.meta}</span><strong>{area.title}</strong><p>{area.description}</p></div><b aria-hidden="true">›</b></button>)}</div>
        </section>
        <section className="hrx-documents-client"><div className="hrx-documents-client-head"><div className="hrx-documents-client-mark">HR</div><div><span>CLIENTE EM DESTAQUE</span><h3>Hortifruti Revolução</h3><p>Dossiê organizado do recebimento ao aceite e arquivo.</p></div><button type="button" onClick={() => { setClientOpen(true); setSelectedFolder(null) }}>Abrir dossiê ›</button></div></section>
        <aside className="hrx-documents-note"><div><span>PADRÃO DE INDEXAÇÃO</span><strong>AAAA-MM-DD_CLIENTE_TIPO_DESCRICAO_V01.ext</strong></div><p>A Central trata documentos como informação de negócio, com organização por área, cliente, tipo, data e versão.</p></aside>
      </>}
    </main>

    {viewer && <div className="hrx-document-viewer-overlay" role="dialog" aria-modal="true" aria-label={`Visualização de ${viewer.title}`}>
      <section className="hrx-document-viewer">
        <header><div><span>VISUALIZAÇÃO INTERNA</span><h3>{viewer.title}</h3><p>{viewer.meta}</p></div><button type="button" onClick={closeViewer} aria-label="Fechar documento">×</button></header>
        <div className="hrx-document-viewer-body">
          {viewerLoading && <div className="hrx-document-viewer-state">Carregando documento…</div>}
          {!viewerLoading && viewer.kind === 'pdf' && viewer.url && <iframe src={viewer.url} title={viewer.title} />}
          {!viewerLoading && viewer.kind === 'image' && viewer.url && <img src={viewer.url} alt={viewer.title} />}
          {!viewerLoading && viewer.kind === 'text' && <pre>{viewer.content}</pre>}
          {!viewerLoading && viewer.kind === 'error' && <div className="hrx-document-viewer-state is-error">{viewer.content}</div>}
          {!viewerLoading && viewer.kind === 'download' && <div className="hrx-document-viewer-state"><strong>Pré-visualização indisponível para este formato.</strong><p>{viewer.content}</p>{viewer.url && <a href={viewer.url} download>Baixar arquivo protegido</a>}</div>}
        </div>
      </section>
    </div>}
  </section>}</>
}
