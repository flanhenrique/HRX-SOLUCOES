import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { hrxSupabase } from './supabaseClient'

type VoltRow = {
  id: string
  object_path: string
  document_type?: string | null
  title: string
  version: number
  status: 'active' | 'superseded' | 'archived'
  mime_type?: string | null
  size_bytes?: number | null
  created_at: string
}

type FolderDefinition = {
  key: string
  title: string
  description: string
  order: number
}

const folderDefinitions: FolderDefinition[] = [
  { key: 'governanca', title: '01 · Governança e Visão', description: 'Visão do produto, contexto oficial e direcionadores estratégicos.', order: 1 },
  { key: 'arquitetura', title: '02 · Arquitetura e Decisões', description: 'Arquitetura oficial, decisões técnicas e padrões de engenharia.', order: 2 },
  { key: 'produto', title: '03 · Produto e PRDs', description: 'Requisitos funcionais, capacidades e especificações oficiais do produto.', order: 3 },
  { key: 'dados', title: '04 · Dados e Segurança', description: 'Modelo de dados, segurança, proteção e controles estruturais.', order: 4 },
  { key: 'operacoes', title: '05 · Operações', description: 'Runbooks, procedimentos e manual operacional.', order: 5 },
  { key: 'design', title: '06 · Design e Experiência', description: 'Sistema de experiência, interface e padrões visuais.', order: 6 },
  { key: 'auditoria', title: '07 · Auditoria e Conformidade', description: 'Auditorias, revisões e registros de conformidade documental.', order: 7 },
  { key: 'historico', title: '08 · Histórico', description: 'Versões substituídas, arquivadas e preservadas para rastreabilidade.', order: 8 },
]

function folderFor(document: VoltRow) {
  if (document.status === 'superseded' || document.status === 'archived') return 'historico'
  const code = (document.document_type ?? '').toUpperCase()
  if (['PV-001', 'CTX-001'].includes(code)) return 'governanca'
  if (['ADR-000', 'ARCH-001', 'VES-001'].includes(code)) return 'arquitetura'
  if (code.startsWith('PRD-')) return 'produto'
  if (['DATA-001', 'SEC-001'].includes(code)) return 'dados'
  if (code.startsWith('OPS-')) return 'operacoes'
  if (code.startsWith('DESIGN-')) return 'design'
  if (code.startsWith('AUD-') || code.startsWith('REV-DOC-')) return 'auditoria'
  return 'governanca'
}

function formatBytes(value?: number | null) {
  const bytes = Number(value ?? 0)
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function VoltDocumentFolders() {
  const [target, setTarget] = useState<Element | null>(null)
  const [documents, setDocuments] = useState<VoltRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ title: string; url: string; meta: string } | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const sync = () => {
      const intro = document.querySelector('.hrx-volt-library-intro')
      const workspace = intro?.closest('.hrx-document-workspace')
      const list = workspace?.querySelector('.hrx-document-file-list') ?? null
      setTarget(list)
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  const loadDocuments = async () => {
    setLoading(true)
    setMessage('')
    const { data, error } = await hrxSupabase
      .from('hrx_documents')
      .select('id,object_path,document_type,title,version,status,mime_type,size_bytes,created_at')
      .eq('area_key', 'internal')
      .eq('folder', 'VOLT')
      .order('document_type', { ascending: true })
      .order('version', { ascending: true })
    setLoading(false)
    if (error) {
      setDocuments([])
      setMessage('Não foi possível carregar a organização do acervo VOLT.')
      return
    }
    setDocuments((data ?? []) as VoltRow[])
  }

  useEffect(() => {
    if (!target) return
    target.classList.add('is-volt-folder-mode')
    void loadDocuments()
    const refresh = () => void loadDocuments()
    window.addEventListener('hrx:documents-refresh', refresh)
    return () => {
      target.classList.remove('is-volt-folder-mode')
      window.removeEventListener('hrx:documents-refresh', refresh)
    }
  }, [target])

  const grouped = useMemo(() => {
    const map = new Map<string, VoltRow[]>()
    for (const folder of folderDefinitions) map.set(folder.key, [])
    for (const document of documents) map.get(folderFor(document))?.push(document)
    return map
  }, [documents])

  const currentFolder = folderDefinitions.find((folder) => folder.key === selectedFolder) ?? null
  const currentDocuments = selectedFolder ? grouped.get(selectedFolder) ?? [] : []

  const openDocument = async (document: VoltRow) => {
    setMessage('')
    const { data, error } = await hrxSupabase.storage.from('hrx-documents').createSignedUrl(document.object_path, 60)
    if (error || !data?.signedUrl) {
      setMessage('Não foi possível abrir este documento agora.')
      return
    }
    setViewer({
      title: document.title,
      url: data.signedUrl,
      meta: `${document.document_type || 'ARQUIVO'} · V${String(document.version).padStart(2, '0')} · ${formatBytes(document.size_bytes)}`,
    })
  }

  if (!target) return null

  return <>
    {createPortal(
      <div className="hrx-volt-folder-browser">
        <div className="hrx-volt-folder-browser-head">
          <div><span>ORGANIZAÇÃO DO ACERVO</span><strong>{selectedFolder ? currentFolder?.title : 'Pastas documentais do VOLT'}</strong><p>{selectedFolder ? currentFolder?.description : 'Os documentos oficiais estão separados por função documental, mantendo versões substituídas no histórico.'}</p></div>
          {selectedFolder && <button type="button" onClick={() => setSelectedFolder(null)}>← Todas as pastas</button>}
        </div>

        {message && <div className="hrx-volt-folder-message" role="status">{message}</div>}
        {loading && <div className="hrx-volt-folder-empty">Carregando organização…</div>}

        {!loading && !selectedFolder && <div className="hrx-volt-folder-grid">
          {folderDefinitions.sort((a, b) => a.order - b.order).map((folder) => {
            const count = grouped.get(folder.key)?.length ?? 0
            return <button type="button" key={folder.key} onClick={() => setSelectedFolder(folder.key)}>
              <span aria-hidden="true">▱</span>
              <div><strong>{folder.title}</strong><p>{folder.description}</p><small>{count} documento{count === 1 ? '' : 's'}</small></div>
              <b>›</b>
            </button>
          })}
        </div>}

        {!loading && selectedFolder && <div className="hrx-volt-folder-files">
          {currentDocuments.map((document) => <button type="button" key={document.id} onClick={() => void openDocument(document)}>
            <span className="hrx-volt-folder-code">{document.document_type || 'DOC'}</span>
            <div><strong>{document.title}</strong><small>V{String(document.version).padStart(2, '0')} · {document.status === 'superseded' ? 'Substituído' : document.status === 'archived' ? 'Arquivado' : 'Ativo'} · {formatBytes(document.size_bytes)}</small></div>
            <b>›</b>
          </button>)}
          {currentDocuments.length === 0 && <div className="hrx-volt-folder-empty">Nenhum documento nesta pasta.</div>}
        </div>}
      </div>,
      target,
    )}

    {viewer && createPortal(
      <div className="hrx-volt-folder-viewer-overlay" role="dialog" aria-modal="true" aria-label={`Visualização de ${viewer.title}`}>
        <section className="hrx-volt-folder-viewer">
          <header><div><span>VOLT · DOCUMENTO OFICIAL</span><h3>{viewer.title}</h3><p>{viewer.meta}</p></div><button type="button" onClick={() => setViewer(null)} aria-label="Fechar documento">×</button></header>
          <iframe src={viewer.url} title={viewer.title} />
        </section>
      </div>,
      document.body,
    )}
  </>
}
