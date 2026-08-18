import { ChangeEvent, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { hrxSupabase } from './supabaseClient'

type ZipEntry = { name: string; data: Uint8Array }
type Lifecycle = 'active' | 'superseded' | 'archived'
type VoltDocumentMeta = {
  code: string
  title: string
  version: number
  lifecycle: Lifecycle
  effectiveDate: string
  filename: string
}

const titles: Record<string, string> = {
  'AUD-001': 'Auditoria Mestre do Volt',
  'PV-001': 'Product Vision',
  'ADR-000': 'Registro Mestre de Decisões',
  'ARCH-001': 'Arquitetura Oficial',
  'CTX-001': 'Contexto Oficial do Projeto Volt',
  'VES-001': 'Volt Engineering Standards',
  'REV-DOC-001': 'Revisão de conformidade do contexto e VES-001',
  'DATA-001': 'Modelo Oficial de Dados',
  'SEC-001': 'Framework Oficial de Segurança',
  'OPS-001': 'Manual Oficial de Operações',
  'DESIGN-001': 'Product Experience System',
  'PRD-000': 'Product Requirements Master',
  'PRD-003': 'Organizations & Multi-Tenant Management',
  'PRD-004': 'Role-Based Access Control',
  'PRD-005': 'Administrative Console',
  'PRD-006': 'Consumer Units & Asset Management',
  'PRD-007': 'Smart Invoice Processing',
  'PRD-008': 'Consumption Intelligence',
  'PRD-009': 'Tariffs, Billing Simulation & Cost Optimization',
  'PRD-010': 'AI Copilot',
}

function safeName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
}

function basename(path: string) {
  return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? path
}

function metadataFor(path: string): VoltDocumentMeta | null {
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
  const fallback = file.replace(/\.pdf$/i, '').replace(/^VOLT[-_]?/i, '').replace(new RegExp(`^${code.replace('-', '[-_]')}[-_]?`, 'i'), '').replace(/[-_]+/g, ' ').trim() || code
  const title = titles[code] ?? fallback
  const suffix = lifecycle === 'superseded' ? '_SUPERSEDED' : ''
  const filename = `${code}_${safeName(title)}_v${String(version).padStart(2, '0')}${suffix}.pdf`
  return { code, title, version, lifecycle, effectiveDate: '2026-07-31', filename }
}

function findEocd(view: DataView, length: number) {
  const min = Math.max(0, length - 65557)
  for (let offset = length - 22; offset >= min; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset
  }
  throw new Error('ZIP inválido: diretório central não encontrado.')
}

async function inflateRaw(compressed: Uint8Array) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não suporta descompactação ZIP segura. Atualize o navegador e tente novamente.')
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

    let data: Uint8Array
    if (method === 0) data = new Uint8Array(compressed)
    else if (method === 8) data = await inflateRaw(compressed)
    else throw new Error(`ZIP usa compressão não suportada (${method}) em ${name}.`)

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

function isPdf(data: Uint8Array) {
  return data.byteLength >= 5 && data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46 && data[4] === 0x2d
}

export default function VoltZipImporter() {
  const [target, setTarget] = useState<Element | null>(null)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const sync = () => setTarget(document.querySelector('.hrx-volt-private-head'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  const importZip = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 50 * 1024 * 1024) {
      setMessage('O ZIP excede o limite de 50 MB para importação em lote.')
      return
    }

    setImporting(true)
    setMessage('Validando biblioteca VOLT…')
    let imported = 0
    let skipped = 0
    let failed = 0

    try {
      const entries = (await extractZip(await file.arrayBuffer())).filter((entry) => /\.pdf$/i.test(entry.name))
      if (!entries.length) throw new Error('O ZIP não contém PDFs reconhecíveis.')

      const { data: existingRows, error: existingError } = await hrxSupabase
        .from('hrx_documents')
        .select('checksum_sha256')
        .eq('area_key', 'internal')
        .eq('folder', 'VOLT')
        .not('checksum_sha256', 'is', null)
      if (existingError) throw new Error('Não foi possível consultar o índice de duplicidade. Confirme a autenticação em duas etapas.')

      const knownChecksums = new Set<string>((existingRows ?? []).map((row: { checksum_sha256?: string | null }) => row.checksum_sha256).filter(Boolean) as string[])
      const batchChecksums = new Set<string>()

      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index]
        const meta = metadataFor(entry.name)
        setMessage(`Processando ${index + 1}/${entries.length}: ${basename(entry.name)}`)
        if (!meta || !isPdf(entry.data) || entry.data.byteLength > 25 * 1024 * 1024) {
          failed += 1
          continue
        }

        const checksum = await sha256(entry.data)
        if (knownChecksums.has(checksum) || batchChecksums.has(checksum)) {
          skipped += 1
          continue
        }
        batchChecksums.add(checksum)

        const objectPath = `internal/geral/volt/${Date.now()}_${String(index + 1).padStart(2, '0')}_${meta.filename}`
        const source = entry.data.buffer.slice(entry.data.byteOffset, entry.data.byteOffset + entry.data.byteLength) as ArrayBuffer
        const { error: uploadError } = await hrxSupabase.storage.from('hrx-documents').upload(objectPath, new Blob([source], { type: 'application/pdf' }), {
          contentType: 'application/pdf',
          upsert: false,
        })
        if (uploadError) {
          failed += 1
          continue
        }

        const { error: metadataError } = await hrxSupabase.from('hrx_documents').insert({
          object_path: objectPath,
          area_key: 'internal',
          folder: 'VOLT',
          client_name: null,
          document_type: meta.code,
          title: meta.title,
          version: meta.version,
          status: meta.lifecycle,
          access_class: 'internal',
          effective_date: meta.effectiveDate,
          mime_type: 'application/pdf',
          size_bytes: entry.data.byteLength,
          checksum_sha256: checksum,
        })

        if (metadataError) {
          await hrxSupabase.storage.from('hrx-documents').remove([objectPath])
          failed += 1
          continue
        }
        knownChecksums.add(checksum)
        imported += 1
      }

      const result = `${imported} importado(s) · ${skipped} duplicado(s) ignorado(s)${failed ? ` · ${failed} falha(s)` : ''}`
      setMessage(`${result}. Reabra a pasta VOLT para atualizar a listagem.`)
      window.dispatchEvent(new CustomEvent('hrx:documents-refresh'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível importar a biblioteca VOLT.')
    } finally {
      setImporting(false)
    }
  }

  if (!target) return null
  return createPortal(
    <div className="hrx-volt-zip-importer">
      <label className={importing ? 'is-disabled' : ''}>{importing ? 'Importando biblioteca…' : 'Importar biblioteca (.zip)'}<input type="file" accept=".zip,application/zip" disabled={importing} onChange={(event) => void importZip(event)} /></label>
      {message && <small role="status">{message}</small>}
    </div>,
    target,
  )
}
