import type { PlannedInstallment } from './quoteMath'

export type ProposalPdfItem = { serviceName: string; description?: string; unitLabel: string; quantity: number; unitAmount: number; totalAmount: number }
export type ProposalPdfData = {
  proposalNumber: string
  protocol: string
  version: number
  draft: boolean
  createdAt: string
  validUntil: string
  title: string
  description?: string
  customerNotes?: string
  client: { name: string; company?: string | null; document?: string | null; email?: string | null; phone?: string | null }
  items: ProposalPdfItem[]
  subtotal: number
  discountAmount: number
  discountPercent: number
  taxAmount: number
  taxPercent: number
  finalAmount: number
  paymentMode: 'cash' | 'installments'
  installments: PlannedInstallment[]
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const date = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')
const encoder = new TextEncoder()

function writeWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 8) {
  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line)
      line = word
      if (lines.length >= maxLines) break
    } else line = candidate
  }
  if (line && lines.length < maxLines) lines.push(line)
  lines.forEach((item, index) => ctx.fillText(item, x, y + lineHeight * index))
  return y + lineHeight * lines.length
}

async function loadLogo() {
  const image = new Image()
  image.src = `${import.meta.env.BASE_URL}hrx-logo.svg`
  await new Promise<void>((resolve) => { image.onload = () => resolve(); image.onerror = () => resolve() })
  return image
}

function pageCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = 1240
  canvas.height = 1754
  return canvas
}

function drawBase(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, page: number, pages: number) {
  const gradient = ctx.createLinearGradient(0, 0, 1240, 500)
  gradient.addColorStop(0, '#06182c')
  gradient.addColorStop(1, '#0b3150')
  ctx.fillStyle = '#f5f8fb'
  ctx.fillRect(0, 0, 1240, 1754)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 1240, 278)
  if (logo.complete && logo.naturalWidth) ctx.drawImage(logo, 74, 62, 265, 88)
  else {
    ctx.fillStyle = '#4d8dff'; ctx.font = '700 48px Arial'; ctx.fillText('HRX', 74, 120)
    ctx.fillStyle = '#ffffff'; ctx.font = '400 34px Arial'; ctx.fillText('Solutions', 175, 120)
  }
  ctx.fillStyle = '#94a9bd'; ctx.font = '600 19px Arial'; ctx.fillText(data.draft ? 'ORÇAMENTO EM ELABORAÇÃO' : 'PROPOSTA COMERCIAL', 74, 205)
  ctx.fillStyle = '#ffffff'; ctx.font = '700 30px Arial'; ctx.textAlign = 'right'; ctx.fillText(data.proposalNumber, 1166, 92)
  ctx.fillStyle = '#9db3c8'; ctx.font = '500 18px Arial'; ctx.fillText(`Versão ${data.version}  •  ${date(data.createdAt)}`, 1166, 128)
  ctx.textAlign = 'left'
  if (data.draft) {
    ctx.save(); ctx.translate(620, 930); ctx.rotate(-Math.PI / 5)
    ctx.globalAlpha = .07; ctx.fillStyle = '#153d62'; ctx.font = '800 150px Arial'; ctx.textAlign = 'center'; ctx.fillText('RASCUNHO', 0, 0); ctx.restore()
  }
  ctx.fillStyle = '#0a2037'; ctx.fillRect(0, 1688, 1240, 66)
  ctx.fillStyle = '#a9bbcc'; ctx.font = '500 16px Arial'; ctx.fillText('HRX Solutions  •  Documento comercial confidencial', 74, 1728)
  ctx.textAlign = 'right'; ctx.fillText(`Página ${page} de ${pages}`, 1166, 1728); ctx.textAlign = 'left'
}

function drawFirstPage(ctx: CanvasRenderingContext2D, data: ProposalPdfData, items: ProposalPdfItem[]) {
  let y = 330
  ctx.fillStyle = '#102c45'; ctx.font = '700 36px Arial'
  y = writeWrapped(ctx, data.title || 'Proposta Comercial', 74, y, 1092, 45, 2) + 20
  ctx.fillStyle = '#62788c'; ctx.font = '400 20px Arial'
  y = writeWrapped(ctx, data.description || 'Escopo conforme composição comercial apresentada.', 74, y, 1092, 29, 4) + 34
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#d6e1e9'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.roundRect(74, y, 1092, 174, 18); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#5d7489'; ctx.font = '700 17px Arial'; ctx.fillText('CLIENTE', 102, y + 40)
  ctx.fillStyle = '#102c45'; ctx.font = '700 25px Arial'; ctx.fillText(data.client.company || data.client.name, 102, y + 79)
  ctx.fillStyle = '#667d90'; ctx.font = '400 18px Arial'
  ctx.fillText(data.client.company ? data.client.name : 'Contato principal', 102, y + 111)
  ctx.fillText([data.client.document, data.client.email, data.client.phone].filter(Boolean).join('  •  '), 102, y + 141)
  y += 216
  ctx.fillStyle = '#102c45'; ctx.font = '700 22px Arial'; ctx.fillText('Composição', 74, y)
  y += 25
  ctx.fillStyle = '#dce7ef'; ctx.fillRect(74, y, 1092, 46)
  ctx.fillStyle = '#4c6579'; ctx.font = '700 16px Arial'
  ctx.fillText('DESCRIÇÃO', 94, y + 29); ctx.fillText('QTD.', 760, y + 29); ctx.fillText('UNITÁRIO', 870, y + 29); ctx.fillText('TOTAL', 1050, y + 29)
  y += 46
  for (const item of items) {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(74, y, 1092, 78)
    ctx.strokeStyle = '#e1e9ef'; ctx.beginPath(); ctx.moveTo(74, y + 78); ctx.lineTo(1166, y + 78); ctx.stroke()
    ctx.fillStyle = '#16334a'; ctx.font = '600 18px Arial'; ctx.fillText(item.serviceName, 94, y + 30)
    if (item.description) { ctx.fillStyle = '#75899a'; ctx.font = '400 15px Arial'; ctx.fillText(item.description.slice(0, 82), 94, y + 57) }
    ctx.fillStyle = '#334e62'; ctx.font = '500 17px Arial'; ctx.fillText(`${item.quantity.toLocaleString('pt-BR')} ${item.unitLabel}`, 760, y + 42)
    ctx.fillText(brl.format(item.unitAmount), 870, y + 42); ctx.fillText(brl.format(item.totalAmount), 1050, y + 42)
    y += 78
  }
  y += 30
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#d6e1e9'; ctx.beginPath(); ctx.roundRect(692, y, 474, 234, 18); ctx.fill(); ctx.stroke()
  const summary = [
    ['Subtotal', brl.format(data.subtotal)],
    [`Desconto (${data.discountPercent.toLocaleString('pt-BR')}%)`, `− ${brl.format(data.discountAmount)}`],
    [`Imposto (${data.taxPercent.toLocaleString('pt-BR')}%)`, `+ ${brl.format(data.taxAmount)}`],
  ]
  summary.forEach(([label, value], index) => {
    ctx.fillStyle = '#657b8e'; ctx.font = '500 18px Arial'; ctx.fillText(label, 722, y + 39 + index * 43)
    ctx.fillStyle = '#18354d'; ctx.textAlign = 'right'; ctx.fillText(value, 1134, y + 39 + index * 43); ctx.textAlign = 'left'
  })
  ctx.strokeStyle = '#dce5ec'; ctx.beginPath(); ctx.moveTo(722, y + 148); ctx.lineTo(1134, y + 148); ctx.stroke()
  ctx.fillStyle = '#0f2d47'; ctx.font = '700 22px Arial'; ctx.fillText('Valor final', 722, y + 194)
  ctx.textAlign = 'right'; ctx.fillStyle = '#2267cf'; ctx.font = '800 28px Arial'; ctx.fillText(brl.format(data.finalAmount), 1134, y + 196); ctx.textAlign = 'left'
}

function drawConditions(ctx: CanvasRenderingContext2D, data: ProposalPdfData, offset = 340) {
  let y = offset
  ctx.fillStyle = '#102c45'; ctx.font = '700 30px Arial'; ctx.fillText('Condições comerciais', 74, y)
  y += 48
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#d6e1e9'; ctx.beginPath(); ctx.roundRect(74, y, 1092, 156, 18); ctx.fill(); ctx.stroke()
  const conditions = [
    ['Forma de pagamento', data.paymentMode === 'cash' ? 'À vista' : `${data.installments.length} parcelas`],
    ['Validade', `Até ${date(data.validUntil)}`],
    ['Documento', `${data.proposalNumber} • versão ${data.version}`],
  ]
  conditions.forEach(([label, value], index) => {
    const x = 102 + index * 354
    ctx.fillStyle = '#718698'; ctx.font = '600 16px Arial'; ctx.fillText(label.toUpperCase(), x, y + 47)
    ctx.fillStyle = '#17344c'; ctx.font = '700 20px Arial'; ctx.fillText(value, x, y + 85)
  })
  y += 204
  if (data.installments.length) {
    ctx.fillStyle = '#102c45'; ctx.font = '700 22px Arial'; ctx.fillText('Vencimentos previstos', 74, y)
    y += 31
    data.installments.slice(0, 12).forEach((item) => {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(74, y, 1092, 52)
      ctx.strokeStyle = '#e1e9ef'; ctx.beginPath(); ctx.moveTo(74, y + 52); ctx.lineTo(1166, y + 52); ctx.stroke()
      ctx.fillStyle = '#60778a'; ctx.font = '600 17px Arial'; ctx.fillText(`Parcela ${item.installmentNumber}`, 96, y + 33)
      ctx.fillText(date(item.dueDate), 530, y + 33)
      ctx.fillStyle = '#17344c'; ctx.textAlign = 'right'; ctx.fillText(brl.format(item.amount), 1142, y + 33); ctx.textAlign = 'left'
      y += 52
    })
    y += 34
  }
  if (data.customerNotes) {
    ctx.fillStyle = '#102c45'; ctx.font = '700 22px Arial'; ctx.fillText('Observações', 74, y)
    ctx.fillStyle = '#657b8e'; ctx.font = '400 18px Arial'
    writeWrapped(ctx, data.customerNotes, 74, y + 36, 1092, 28, 8)
  }
}

function base64Bytes(dataUrl: string) {
  const binary = atob(dataUrl.split(',')[1])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}
function concat(parts: Uint8Array[]) {
  const size = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(size)
  let offset = 0
  for (const part of parts) { output.set(part, offset); offset += part.length }
  return output
}
function canvasesToPdf(canvases: HTMLCanvasElement[]) {
  const images = canvases.map((canvas) => base64Bytes(canvas.toDataURL('image/jpeg', .93)))
  const objectCount = 2 + canvases.length * 3
  const objects = new Map<number, Uint8Array>()
  objects.set(1, encoder.encode('<< /Type /Catalog /Pages 2 0 R >>'))
  const pageIds = canvases.map((_, index) => 3 + index * 3)
  objects.set(2, encoder.encode(`<< /Type /Pages /Count ${canvases.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`))
  images.forEach((image, index) => {
    const pageId = 3 + index * 3
    const imageId = pageId + 1
    const contentId = pageId + 2
    const content = encoder.encode('q 595.28 0 0 841.89 0 0 cm /Im0 Do Q')
    objects.set(pageId, encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`))
    objects.set(imageId, concat([encoder.encode(`<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`), image, encoder.encode('\nendstream')]))
    objects.set(contentId, concat([encoder.encode(`<< /Length ${content.length} >>\nstream\n`), content, encoder.encode('\nendstream')]))
  })
  const parts: Uint8Array[] = [encoder.encode('%PDF-1.4\n%HRX\n')]
  const offsets = [0]
  let length = parts[0].length
  for (let id = 1; id <= objectCount; id++) {
    offsets[id] = length
    const object = concat([encoder.encode(`${id} 0 obj\n`), objects.get(id)!, encoder.encode('\nendobj\n')])
    parts.push(object); length += object.length
  }
  const xrefOffset = length
  const xref = ['xref', `0 ${objectCount + 1}`, '0000000000 65535 f ']
  for (let id = 1; id <= objectCount; id++) xref.push(`${String(offsets[id]).padStart(10, '0')} 00000 n `)
  xref.push('trailer', `<< /Size ${objectCount + 1} /Root 1 0 R >>`, 'startxref', String(xrefOffset), '%%EOF')
  parts.push(encoder.encode(`${xref.join('\n')}\n`))
  return new Blob([concat(parts)], { type: 'application/pdf' })
}

export async function generateProposalPdf(data: ProposalPdfData) {
  const logo = await loadLogo()
  const chunks: ProposalPdfItem[][] = []
  for (let index = 0; index < data.items.length; index += 8) chunks.push(data.items.slice(index, index + 8))
  if (!chunks.length) chunks.push([])
  const needsConditionsPage = true
  const totalPages = chunks.length + (needsConditionsPage ? 1 : 0)
  const canvases = chunks.map((items, index) => {
    const canvas = pageCanvas(); const ctx = canvas.getContext('2d')!
    drawBase(ctx, data, logo, index + 1, totalPages)
    if (index === 0) drawFirstPage(ctx, data, items)
    else {
      ctx.fillStyle = '#102c45'; ctx.font = '700 30px Arial'; ctx.fillText('Continuação da composição', 74, 350)
      drawFirstPage(ctx, { ...data, title: 'Continuação', description: '' }, items)
    }
    if (!needsConditionsPage && index === chunks.length - 1) drawConditions(ctx, data, 1290)
    return canvas
  })
  if (needsConditionsPage) {
    const canvas = pageCanvas(); const ctx = canvas.getContext('2d')!
    drawBase(ctx, data, logo, totalPages, totalPages); drawConditions(ctx, data)
    canvases.push(canvas)
  }
  return canvasesToPdf(canvases)
}
