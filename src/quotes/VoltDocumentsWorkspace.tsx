import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { hrxSupabase } from './supabaseClient'
import './volt-documents-workspace.css'

type VoltRow = {
  id: string
  object_path: string
  document_type?: string | null
  title: string
  version: number
  status: 'active' | 'superseded' | 'archived'
  mime_type?: string | null
  size_bytes?: number | null
  checksum_sha256?: string | null
  created_at: string
}

type ZipEntry = { name: string; data: Uint8Array }
type Lifecycle = 'active' | 'superseded' | 'archived'
type Meta = { code: string; title: string; version: number; lifecycle: Lifecycle; filename: string }

type FolderDefinition = { key: string; title: string; description: string; order: number }

const folders: FolderDefinition[] = [
  { key: 'governanca', title: '01 · Governança e Visão', description: 'Visão do produto, contexto oficial e direcionadores estratégicos.', order: 1 },
  { key: 'arquitetura', title: '02 · Arquitetura e Decisões', description: 'Arquitetura oficial, decisões técnicas e padrões de engenharia.', order: 2 },
  { key: 'produto', title: '03 · Produto e PRDs', description: 'Requisitos funcionais, capacidades e especificações oficiais.', order: 3 },
  { key: 'dados', title: '04 · Dados e Segurança', description: 'Modelo de dados, segurança, proteção e controles estruturais.', order: 4 },
  { key: 'operacoes', title: '05 · Operações', description: 'Runbooks, procedimentos e manual operacional.', order: 5 },
  { key: 'design', title: '06 · Design e Experiência', description: 'Sistema de experiência, interface e padrões visuais.', order: 6 },
  { key: 'auditoria', title: '07 · Auditoria e Conformidade', description: 'Auditorias, revisões e registros de conformidade.', order: 7 },
  { key: 'historico', title: '08 · Histórico', description: 'Versões substituídas e arquivadas para rastreabilidade.', order: 8 },
]

const titles: Record<string, string> = {
  'AUD-001': 'Auditoria Mestre do Volt', 'PV-001': 'Product Vision', 'ADR-000': 'Registro Mestre de Decisões', 'ARCH-001': 'Arquitetura Oficial',
  'CTX-001': 'Contexto Oficial do Projeto Volt', 'VES-001': 'Volt Engineering Standards', 'REV-DOC-001': 'Revisão de conformidade',
  'DATA-001': 'Modelo Oficial de Dados', 'SEC-001': 'Framework Oficial de Segurança', 'OPS-001': 'Manual Oficial de Operações',
  'DESIGN-001': 'Product Experience System', 'PRD-000': 'Product Requirements Master', 'PRD-003': 'Organizations & Multi-Tenant Management',
  'PRD-004': 'Role-Based Access Control', 'PRD-005': 'Administrative Console', 'PRD-006': 'Consumer Units & Asset Management',
  'PRD-007': 'Smart Invoice Processing', 'PRD-008': 'Consumption Intelligence', 'PRD-009': 'Tariffs, Billing Simulation & Cost Optimization', 'PRD-010': 'AI Copilot',
}

function folderFor(document: VoltRow) {
  if (document.status !== 'active') return 'historico'
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

function safeName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
}
function basename(path: string) { return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? path }

function metadataFor(path: string): Meta | null {
  const file = basename(path)
  if (!/\.pdf$/i.test(file)) return null
  let code = ''
  if (/^Auditoria Mestre do Volt\.pdf$/i.test(file) || /^AUD-001_/i.test(file)) code = 'AUD-001'
  else code = (file.match(/(?:VOLT[-_])?((?:REV-DOC|PRD|ADR|ARCH|CTX|DATA|SEC|OPS|DESIGN|VES|PV)-\d{3})/i)?.[1] ?? '').toUpperCase()
  if (!code) return null
  const explicitVersion = file.match(/[_-]v(\d{1,2})(?:\D|$)/i)?.[1]
  let version = explicitVersion ? Number(explicitVersion) : 1
  if (code === 'PRD-000' && /Product-Requirements-Master\s*\(1\)\.pdf$/i.test(file)) version = 2
  const lifecycle: Lifecycle = code === 'PRD-000' && version === 1 ? 'superseded' : 'active'
  const fallback = file.replace(/\.pdf$/i, '').replace(/^VOLT[-_]?/i, '').replace(/[-_]+/g, ' ').trim() || code
  const title = titles[code] ?? fallback
  return { code, title, version, lifecycle, filename: `${code}_${safeName(title)}_v${String(version).padStart(2, '0')}${lifecycle === 'superseded' ? '_SUPERSEDED' : ''}.pdf` }
}

function findEocd(view: DataView, length: number) {
  const min = Math.max(0, length - 65557)
  for (let offset = length - 22; offset >= min; offset -= 1) if (view.getUint32(offset, true) === 0x06054b50) return offset
  throw new Error('ZIP inválido: diretório central não encontrado.')
}

async function inflateRaw(compressed: Uint8Array) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não suporta descompactação ZIP segura.')
  const source = compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength) as ArrayBuffer
  const stream = new Blob([source]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function extractZip(buffer: ArrayBuffer): Promise<ZipEntry[]> {
  const view = new DataView(buffer)
  const eocd = findEocd(view, buffer.byteLength)
  const entriesCount = view.getUint16(eocd + 10, true)
  let cursor = view.getUint32(eocd + 16, true)
  const decoder = new TextDecoder('utf-8')
  const entries: ZipEntry[] = []
  for (let index = 0; index < entriesCount; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('ZIP inválido: entrada central corrompida.')
    const method = view.getUint16(cursor + 10, true)
    const compressedSize = view.getUint32(cursor + 20, true)
    const uncompressedSize = view.getUint32(cursor + 24, true)
    const nameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)
    const name = decoder.decode(new Uint8Array(buffer, cursor + 46, nameLength))
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error(`ZIP inválido: cabeçalho local ausente em ${name}.`)
    const localNameLength = view.getUint16(localOffset + 26, true)
    const localExtraLength = view.getUint16(localOffset + 28, true)
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength
    const compressed = new Uint8Array(buffer, dataOffset, compressedSize)
    const data = method === 0 ? new Uint8Array(compressed) : method === 8 ? await inflateRaw(compressed) : (() => { throw new Error(`Compressão não suportada (${method}).`) })()
    if (data.byteLength !== uncompressedSize) throw new Error(`ZIP corrompido: tamanho divergente em ${name}.`)
    if (!name.endsWith('/')) entries.push({ name, data })
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

async function sha256(data: Uint8Array) {
  const source = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  const digest = await crypto.subtle.digest('SHA-256', source)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
function isPdf(data: Uint8Array) { return data.byteLength >= 5 && data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46 && data[4] === 0x2d }

export default function VoltDocumentsWorkspace() {
  const [documents, setDocuments] = useState<VoltRow[]>([])
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')
  const [viewer, setViewer] = useState<{ title: string; url: string; meta: string } | null>(null)

  const load = async () => {
    setLoading(true); setMessage('')
    const { data, error } = await hrxSupabase.from('hrx_documents').select('id,object_path,document_type,title,version,status,mime_type,size_bytes,checksum_sha256,created_at').eq('area_key', 'internal').eq('folder', 'VOLT').order('document_type').order('version')
    setLoading(false)
    if (error) { setDocuments([]); setMessage('Não foi possível carregar o acervo VOLT.'); return }
    setDocuments((data ?? []) as VoltRow[])
  }
  useEffect(() => { void load() }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, VoltRow[]>()
    for (const folder of folders) map.set(folder.key, [])
    for (const document of documents) map.get(folderFor(document))?.push(document)
    return map
  }, [documents])

  const openDocument = async (document: VoltRow) => {
    const { data, error } = await hrxSupabase.storage.from('hrx-documents').createSignedUrl(document.object_path, 60)
    if (error || !data?.signedUrl) { setMessage('Não foi possível abrir este documento.'); return }
    setViewer({ title: document.title, url: data.signedUrl, meta: `${document.document_type || 'DOC'} · V${String(document.version).padStart(2, '0')} · ${formatBytes(document.size_bytes)}` })
  }

  const importZip = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    if (file.size > 50 * 1024 * 1024) { setMessage('O ZIP excede o limite de 50 MB.'); return }
    setImporting(true); setMessage('Validando biblioteca VOLT…')
    let imported = 0, skipped = 0, failed = 0
    try {
      const entries = (await extractZip(await file.arrayBuffer())).filter((entry) => /\.pdf$/i.test(entry.name))
      if (!entries.length) throw new Error('O ZIP não contém PDFs reconhecíveis.')
      const { data: existingRows, error } = await hrxSupabase.from('hrx_documents').select('checksum_sha256').eq('area_key', 'internal').eq('folder', 'VOLT').not('checksum_sha256', 'is', null)
      if (error) throw new Error('Não foi possível consultar o índice de duplicidade.')
      const known = new Set<string>((existingRows ?? []).map((row: { checksum_sha256?: string | null }) => row.checksum_sha256).filter(Boolean) as string[])
      const batch = new Set<string>()
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index]
        const meta = metadataFor(entry.name)
        if (!meta || !isPdf(entry.data) || entry.data.byteLength > 25 * 1024 * 1024) { failed += 1; continue }
        const checksum = await sha256(entry.data)
        if (known.has(checksum) || batch.has(checksum)) { skipped += 1; continue }
        batch.add(checksum)
        const objectPath = `internal/geral/volt/${Date.now()}_${String(index + 1).padStart(2, '0')}_${meta.filename}`
        const source = entry.data.buffer.slice(entry.data.byteOffset, entry.data.byteOffset + entry.data.byteLength) as ArrayBuffer
        const { error: uploadError } = await hrxSupabase.storage.from('hrx-documents').upload(objectPath, new Blob([source], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: false })
        if (uploadError) { failed += 1; continue }
        const { error: metadataError } = await hrxSupabase.from('hrx_documents').insert({ object_path: objectPath, area_key: 'internal', folder: 'VOLT', client_name: null, document_type: meta.code, title: meta.title, version: meta.version, status: meta.lifecycle, access_class: 'internal', effective_date: '2026-07-31', mime_type: 'application/pdf', size_bytes: entry.data.byteLength, checksum_sha256: checksum })
        if (metadataError) { await hrxSupabase.storage.from('hrx-documents').remove([objectPath]); failed += 1; continue }
        known.add(checksum); imported += 1
      }
      setMessage(`${imported} importado(s) · ${skipped} duplicado(s) ignorado(s)${failed ? ` · ${failed} falha(s)` : ''}`)
      await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível importar a biblioteca VOLT.') }
    finally { setImporting(false) }
  }

  const currentFolder = folders.find((folder) => folder.key === selectedFolder)
  const currentDocuments = selectedFolder ? grouped.get(selectedFolder) ?? [] : []

  return <section className="hrx-volt-workspace">
    <header><div><span>VOLT · BIBLIOTECA CONTROLADA</span><h2>{currentFolder?.title ?? 'Acervo técnico oficial'}</h2><p>{currentFolder?.description ?? 'Documentos classificados por função, versão e ciclo de vida.'}</p></div><div>{selectedFolder && <button type="button" onClick={() => setSelectedFolder(null)}>← Pastas</button>}<label className={importing ? 'is-disabled' : ''}>{importing ? 'Importando…' : 'Importar biblioteca (.zip)'}<input type="file" accept=".zip,application/zip" disabled={importing} onChange={(event) => void importZip(event)} /></label></div></header>
    {message && <div className="hrx-volt-message">{message}</div>}
    {loading && <div className="hrx-volt-empty">Carregando acervo…</div>}
    {!loading && !selectedFolder && <div className="hrx-volt-folders">{folders.map((folder) => <button type="button" key={folder.key} onClick={() => setSelectedFolder(folder.key)}><span>▱</span><div><strong>{folder.title}</strong><p>{folder.description}</p><small>{grouped.get(folder.key)?.length ?? 0} documento(s)</small></div><b>→</b></button>)}</div>}
    {!loading && selectedFolder && <div className="hrx-volt-files">{currentDocuments.map((document) => <button type="button" key={document.id} onClick={() => void openDocument(document)}><span>{document.document_type || 'DOC'}</span><div><strong>{document.title}</strong><small>V{String(document.version).padStart(2, '0')} · {document.status === 'active' ? 'Ativo' : document.status === 'superseded' ? 'Substituído' : 'Arquivado'} · {formatBytes(document.size_bytes)}</small></div><b>→</b></button>)}{!currentDocuments.length && <div className="hrx-volt-empty">Nenhum documento nesta pasta.</div>}</div>}
    {viewer && <div className="hrx-volt-viewer-backdrop"><section className="hrx-volt-viewer"><header><div><span>VOLT · DOCUMENTO OFICIAL</span><h3>{viewer.title}</h3><p>{viewer.meta}</p></div><button type="button" onClick={() => setViewer(null)}>×</button></header><iframe src={viewer.url} title={viewer.title} /></section></div>}
  </section>
}
