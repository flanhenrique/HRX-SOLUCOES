import { ChangeEvent, useMemo, useState } from 'react'
import { hrxSupabase } from './supabaseClient'
import { navigateAdmin } from './adminNavigation'
import VoltDocumentsWorkspace from './VoltDocumentsWorkspace'
import './admin-documents-page.css'

type Area = {
  key: string
  title: string
  description: string
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
  mime_type?: string | null
  size_bytes?: number | null
  created_at: string
}

type MessageTone = 'success' | 'error'

const areas: Area[] = [
  { key: 'institutional', title: 'Institucional', description: 'Identidade, registros, certidões, apresentações e políticas corporativas.', governance: 'Governança corporativa', folders: ['Identidade e marca', 'Registros e certidões', 'Apresentações institucionais', 'Políticas e procedimentos'] },
  { key: 'clients', title: 'Clientes', description: 'Dossiês de clientes, propostas, contratos, entregas e aceites.', governance: 'Controle por cliente e projeto', folders: ['Hortifruti Revolução', 'Novos clientes', 'Encerrados'] },
  { key: 'templates', title: 'Modelos', description: 'Modelos controlados de propostas, contratos, atas, checklists e relatórios.', governance: 'Controle de versão', folders: ['Propostas', 'Contratos e termos', 'Atas', 'Checklists', 'Relatórios'] },
  { key: 'internal', title: 'Projetos internos', description: 'Documentação funcional, técnica e operacional dos produtos HRX.', governance: 'Gestão de produto', folders: ['VOLT', 'NEXUS', 'HRX Admin'] },
  { key: 'commercial', title: 'Comercial', description: 'Prospecção, materiais comerciais, propostas, negociações e referências.', governance: 'Acesso interno', folders: ['Materiais comerciais', 'Apresentações', 'Propostas enviadas', 'Negociações', 'Referências'] },
  { key: 'finance', title: 'Financeiro', description: 'Documentos fiscais, comprovantes, controles e conciliações.', governance: 'Retenção fiscal', folders: ['Notas fiscais', 'Comprovantes', 'Controles', 'Conciliação documental'] },
  { key: 'legal', title: 'Jurídico e contratos', description: 'Contratos, termos, aditivos, vigências, obrigações e riscos.', governance: 'Revisão contratual', folders: ['Contratos vigentes', 'Em revisão', 'Aditivos e termos', 'Encerrados'] },
  { key: 'archive', title: 'Arquivo histórico', description: 'Material encerrado, substituído ou obsoleto mantido para rastreabilidade.', governance: 'Somente leitura', folders: ['Substituídos', 'Encerrados', 'Legado'] },
]

const acceptedTypes = '.pdf,.docx,.xlsx,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp'

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

export default function AdminDocumentsPage() {
  const [area, setArea] = useState<Area | null>(null)
  const [folder, setFolder] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<MessageTone>('success')

  const clearMessage = () => { setMessage(''); setMessageTone('success') }
  const showMessage = (tone: MessageTone, text: string) => { setMessageTone(tone); setMessage(text) }

  const filteredAreas = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR')
    if (!normalized) return areas
    return areas.filter((item) => [item.title, item.description, item.governance, ...item.folders].some((value) => value.toLocaleLowerCase('pt-BR').includes(normalized)))
  }, [query])

  const loadDocuments = async (selectedArea: Area, selectedFolder: string) => {
    setLoading(true)
    clearMessage()
    const { data, error } = await hrxSupabase.from('hrx_documents').select('*').eq('area_key', selectedArea.key).eq('folder', selectedFolder).neq('status', 'archived').order('created_at', { ascending: false })
    setLoading(false)
    if (error) {
      setDocuments([])
      showMessage('error', 'Não foi possível carregar esta pasta. Confirme sua sessão de segurança.')
      return false
    }
    setDocuments((data ?? []) as DocumentRow[])
    return true
  }

  const selectFolder = (selectedFolder: string) => {
    if (!area) return
    setFolder(selectedFolder)
    setDocuments([])
    clearMessage()
    if (!(area.key === 'internal' && selectedFolder === 'VOLT')) void loadDocuments(area, selectedFolder)
  }

  const uploadDocument = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !area || !folder) return
    if (file.size > 25 * 1024 * 1024) {
      showMessage('error', 'O arquivo excede o limite de 25 MB.')
      return
    }

    setUploading(true)
    clearMessage()
    const objectPath = `${area.key}/geral/${slug(folder)}/${Date.now()}_${safeFileName(file.name)}`
    const { error: uploadError } = await hrxSupabase.storage.from('hrx-documents').upload(objectPath, file, { contentType: file.type || undefined, upsert: false })
    if (uploadError) {
      setUploading(false)
      showMessage('error', 'Não foi possível enviar o arquivo. Verifique formato, tamanho e autenticação.')
      return
    }

    const { error: metadataError } = await hrxSupabase.from('hrx_documents').insert({
      object_path: objectPath,
      area_key: area.key,
      folder,
      client_name: null,
      document_type: file.name.split('.').pop()?.toUpperCase() || 'ARQUIVO',
      title: file.name.replace(/\.[^.]+$/, ''),
      version: 1,
      status: 'active',
      access_class: ['legal', 'finance'].includes(area.key) ? 'restricted' : 'internal',
      mime_type: file.type || null,
      size_bytes: file.size,
    })

    if (metadataError) {
      await hrxSupabase.storage.from('hrx-documents').remove([objectPath])
      setUploading(false)
      showMessage('error', 'O arquivo foi removido porque os metadados não puderam ser registrados.')
      return
    }

    setUploading(false)
    const refreshed = await loadDocuments(area, folder)
    if (refreshed) showMessage('success', 'Documento arquivado com sucesso.')
  }

  const openDocument = async (document: DocumentRow) => {
    clearMessage()
    if (document.object_path.startsWith('external:')) {
      const target = document.object_path.slice('external:'.length).trim()
      try {
        const url = new URL(target, window.location.origin)
        if (url.protocol !== 'https:' && url.origin !== window.location.origin) throw new Error('invalid_protocol')
        window.open(url.toString(), '_blank', 'noopener,noreferrer')
      } catch {
        showMessage('error', 'A referência externa deste documento é inválida.')
      }
      return
    }

    const { data, error } = await hrxSupabase.storage.from('hrx-documents').createSignedUrl(document.object_path, 60)
    if (error || !data?.signedUrl) {
      showMessage('error', 'Não foi possível gerar o acesso temporário ao documento.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const isVolt = area?.key === 'internal' && folder === 'VOLT'

  return <section className="hrx-documents-page" aria-label="Central de Documentos HRX">
    <header className="hrx-documents-page-header">
      <div><span>HRX SOLUTIONS · GOVERNANÇA DOCUMENTAL</span><h1>{folder ?? area?.title ?? 'Central de Documentos'}</h1><p>{folder ? `${area?.title} · arquivos protegidos e versionados` : area?.description ?? 'Informação corporativa organizada por função, cliente, projeto, vigência e responsabilidade.'}</p></div>
      <div className="hrx-documents-page-actions">
        {(area || folder) && <button type="button" onClick={() => folder ? (setFolder(null), setDocuments([]), clearMessage()) : setArea(null)}>← Voltar</button>}
        <button type="button" onClick={() => navigateAdmin('executive')}>Visão executiva</button>
      </div>
    </header>

    <main className="hrx-documents-page-content">
      {!area && <>
        <section className="hrx-documents-page-summary">
          <article><span>Áreas documentais</span><strong>8</strong><small>Taxonomia corporativa</small></article>
          <article><span>Armazenamento</span><strong>Privado</strong><small>Supabase Storage</small></article>
          <article><span>Segurança</span><strong>AAL2</strong><small>MFA obrigatório</small></article>
        </section>
        <label className="hrx-documents-page-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar área ou categoria documental" /></label>
        <section className="hrx-documents-page-grid">{filteredAreas.map((item) => <button type="button" key={item.key} onClick={() => setArea(item)}><span>{item.governance}</span><strong>{item.title}</strong><p>{item.description}</p><b>→</b></button>)}</section>
        {!filteredAreas.length && <div className="hrx-documents-empty"><strong>Nenhuma categoria encontrada.</strong><span>Revise o termo de busca ou navegue pelas áreas documentais disponíveis.</span></div>}
      </>}

      {area && !folder && <>
        <section className="hrx-documents-page-context"><span>ÁREA DOCUMENTAL</span><strong>{area.governance}</strong><p>Selecione uma categoria para acessar os arquivos controlados.</p></section>
        <section className="hrx-documents-folder-grid">{area.folders.map((item) => <button type="button" key={item} onClick={() => selectFolder(item)}><span>▱</span><strong>{item}</strong><small>{item === 'VOLT' ? 'Biblioteca técnica controlada' : 'Categoria documental'}</small><b>→</b></button>)}</section>
        {area.key === 'legal' && <aside className="hrx-documents-contract-check"><span>ANÁLISE CONTRATUAL</span><h2>Checklist executivo</h2><div><p>Partes e representação</p><p>Objeto e escopo</p><p>Valores e reajustes</p><p>Prazo e vigência</p><p>Obrigações e SLAs</p><p>Multas e rescisão</p><p>Confidencialidade e LGPD</p><p>Foro e assinaturas</p></div></aside>}
      </>}

      {isVolt && <VoltDocumentsWorkspace />}

      {area && folder && !isVolt && <>
        <section className="hrx-documents-storage-bar"><div><span>{documents.length} documento(s)</span><small>Arquivos privados e referências controladas · limite de 25 MB por upload</small></div><label className={uploading ? 'is-disabled' : ''}>{uploading ? 'Enviando…' : '+ Adicionar documento'}<input type="file" accept={acceptedTypes} disabled={uploading} onChange={(event) => void uploadDocument(event)} /></label></section>
        {message && <div className={`hrx-documents-page-message is-${messageTone}`} role={messageTone === 'error' ? 'alert' : 'status'}>{message}</div>}
        <section className="hrx-documents-file-list">
          {loading && <div className="hrx-documents-empty"><strong>Carregando documentos…</strong><span>Atualizando o conteúdo protegido desta categoria.</span></div>}
          {!loading && !documents.length && <div className="hrx-documents-empty"><strong>Nenhum documento cadastrado.</strong><span>Use “Adicionar documento” para iniciar esta categoria.</span></div>}
          {!loading && documents.map((document) => <button type="button" key={document.id} onClick={() => void openDocument(document)}><span>▤</span><div><strong>{document.title}</strong><small>V{String(document.version).padStart(2, '0')} · {document.document_type || 'ARQUIVO'} · {formatBytes(document.size_bytes)}</small><time>{new Date(document.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</time></div><b>{document.access_class === 'confidential' ? 'Confidencial' : document.access_class === 'restricted' ? 'Restrito' : 'Interno'} →</b></button>)}
        </section>
        <aside className="hrx-documents-naming"><span>PADRÃO DE INDEXAÇÃO</span><strong>AAAA-MM-DD_CLIENTE_TIPO_DESCRICAO_V01.ext</strong><p>Metadados mínimos: área, categoria, tipo, versão, responsável, vigência e classificação de acesso.</p></aside>
      </>}
    </main>
  </section>
}
