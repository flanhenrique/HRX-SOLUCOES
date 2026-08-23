import type { PlannedInstallment } from './quoteMath'

export type ProposalPdfItem = {
  serviceName: string
  description?: string
  unitLabel: string
  quantity: number
  unitAmount: number
  totalAmount: number
}

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
  client: {
    name: string
    company?: string | null
    document?: string | null
    email?: string | null
    phone?: string | null
  }
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

/*
 * Fonte visual canônica do documento comercial:
 * Canva — “HRX Solutions — Proposta Comercial — Opção 3 Revisada”.
 * Estrutura fixa aprovada: 6 páginas.
 */
const W = 1240
const H = 1754
const M = 76
const FOOTER_Y = 1638
const NAVY = '#07182D'
const NAVY_2 = '#0D2944'
const BLUE = '#397FE7'
const GREEN = '#24B96D'
const GREEN_LIGHT = '#64D78B'
const PAPER = '#F7F9FC'
const WHITE = '#FFFFFF'
const TEXT = '#11263B'
const BODY = '#526A7E'
const MUTED = '#74889B'
const LINE = '#DCE5ED'
const SOFT = '#EFF4F8'
const encoder = new TextEncoder()

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const percent = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const date = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')
const versionLabel = (value: number) => `${Math.max(1, Number(value) || 1)}.0`
const clientName = (data: ProposalPdfData) => data.client.company || data.client.name

function pageCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  return canvas
}

async function loadImage(path: string) {
  const image = new Image()
  image.src = `${import.meta.env.BASE_URL}${path}`
  await new Promise<void>((resolve) => {
    image.onload = () => resolve()
    image.onerror = () => resolve()
  })
  return image
}

async function loadBrandAssets() {
  const [logo, mark] = await Promise.all([loadImage('hrx-logo.svg'), loadImage('hrx-mark.svg')])
  return { logo, mark }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius = 18) {
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
}

function wrappedLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 20) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line)
      line = word
      if (lines.length >= maxLines) break
    } else line = candidate
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines
}

function writeWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 20) {
  const lines = wrappedLines(ctx, text, maxWidth, maxLines)
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight))
  return y + Math.max(1, lines.length) * lineHeight
}

function drawLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement, x: number, y: number, width = 200, height = 110, light = false) {
  if (logo.complete && logo.naturalWidth) {
    ctx.drawImage(logo, x, y, width, height)
    return
  }
  ctx.fillStyle = light ? WHITE : NAVY
  ctx.font = '800 46px Arial'
  ctx.fillText('HRX', x, y + 64)
  ctx.fillStyle = GREEN
  ctx.font = '700 18px Arial'
  ctx.fillText('SOLUTIONS', x + 104, y + 64)
}

function drawDraftWatermark(ctx: CanvasRenderingContext2D, data: ProposalPdfData) {
  if (!data.draft) return
  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.rotate(-Math.PI / 5)
  ctx.globalAlpha = .045
  ctx.fillStyle = NAVY
  ctx.font = '800 148px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('RASCUNHO', 0, 0)
  ctx.restore()
  ctx.textAlign = 'left'
}

function drawFooter(ctx: CanvasRenderingContext2D, data: ProposalPdfData, page: number) {
  ctx.strokeStyle = LINE
  ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.moveTo(M, FOOTER_Y); ctx.lineTo(W - M, FOOTER_Y); ctx.stroke()
  ctx.fillStyle = MUTED
  ctx.font = '500 14px Arial'
  ctx.fillText('HRX Solutions • hrxsolutions.com.br', M, FOOTER_Y + 38)
  ctx.textAlign = 'right'
  ctx.fillText(`${data.proposalNumber} • v${versionLabel(data.version)} • ${page}/6`, W - M, FOOTER_Y + 38)
  ctx.textAlign = 'left'
}

function drawPageBase(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, mark: HTMLImageElement, page: number, section: string, title: string) {
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = NAVY
  ctx.fillRect(0, 0, 18, H)
  ctx.fillStyle = GREEN
  ctx.fillRect(18, 0, 6, H)
  ctx.fillStyle = WHITE
  ctx.fillRect(24, 0, W - 24, 188)
  drawLogo(ctx, logo, M, 34, 190, 104)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#708398'
  ctx.font = '600 14px Arial'
  ctx.fillText(data.proposalNumber, W - M, 69)
  ctx.fillText(`v${versionLabel(data.version)} • ${date(data.createdAt)}`, W - M, 98)
  ctx.textAlign = 'left'

  ctx.fillStyle = GREEN
  ctx.font = '800 15px Arial'
  ctx.fillText(section, M, 248)
  ctx.fillStyle = TEXT
  ctx.font = '800 37px Arial'
  writeWrapped(ctx, title, M, 302, W - M * 2, 44, 2)
  ctx.fillStyle = BLUE
  ctx.fillRect(M, 334, 104, 5)

  if (mark.complete && mark.naturalWidth) {
    ctx.save()
    ctx.globalAlpha = .035
    ctx.drawImage(mark, 900, 1350, 280, 120)
    ctx.restore()
  }
  drawDraftWatermark(ctx, data)
  drawFooter(ctx, data, page)
}

function drawCover(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, mark: HTMLImageElement) {
  const gradient = ctx.createLinearGradient(0, 0, W, H)
  gradient.addColorStop(0, '#061426')
  gradient.addColorStop(.68, '#081C32')
  gradient.addColorStop(1, '#0B2946')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = GREEN
  ctx.fillRect(0, 0, 14, H)
  ctx.fillStyle = 'rgba(36,185,109,.13)'
  ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W, 430); ctx.lineTo(925, 0); ctx.closePath(); ctx.fill()
  if (mark.complete && mark.naturalWidth) { ctx.save(); ctx.globalAlpha = .065; ctx.drawImage(mark, 680, 1150, 590, 250); ctx.restore() }

  drawLogo(ctx, logo, M, 54, 244, 140, true)
  ctx.fillStyle = '#A0B3C5'
  ctx.font = '700 15px Arial'
  ctx.fillText('DOCUMENTO COMERCIAL OFICIAL', M, 318)
  ctx.fillStyle = WHITE
  ctx.font = '900 54px Arial'
  ctx.fillText(data.draft ? 'ORÇAMENTO' : 'PROPOSTA', M, 401)
  ctx.fillText('COMERCIAL', M, 466)
  ctx.fillStyle = GREEN_LIGHT
  ctx.fillRect(M, 508, 108, 6)

  const cardY = 710
  roundedRect(ctx, M, cardY, W - M * 2, 500, 26)
  ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 1.5; ctx.stroke()
  const rows = [
    ['CLIENTE', clientName(data)],
    ['PROPOSTA', data.proposalNumber],
    ['VERSÃO', versionLabel(data.version)],
    ['EMISSÃO', date(data.createdAt)],
  ]
  rows.forEach(([label, value], index) => {
    const y = cardY + 62 + index * 92
    ctx.fillStyle = '#8FA7BD'; ctx.font = '800 13px Arial'; ctx.fillText(label, M + 34, y)
    ctx.fillStyle = WHITE; ctx.font = '700 24px Arial'; ctx.fillText(value, M + 34, y + 34)
    if (index < rows.length - 1) { ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.beginPath(); ctx.moveTo(M + 34, y + 58); ctx.lineTo(W - M - 34, y + 58); ctx.stroke() }
  })

  ctx.fillStyle = '#B9C8D7'
  ctx.font = '400 21px Arial'
  writeWrapped(ctx, 'Soluções profissionais, escopo claro e condições comerciais transparentes.', M, 1334, 820, 32, 3)
  ctx.fillStyle = '#7E96AB'; ctx.font = '500 14px Arial'; ctx.fillText('HRX Solutions • hrxsolutions.com.br', M, 1658)
  ctx.textAlign = 'right'; ctx.fillText(`${data.proposalNumber} • v${versionLabel(data.version)} • 1/6`, W - M, 1658); ctx.textAlign = 'left'
  drawDraftWatermark(ctx, data)
}

function drawPresentation(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, mark: HTMLImageElement) {
  drawPageBase(ctx, data, logo, mark, 2, '01 — APRESENTAÇÃO', 'Uma proposta feita para ser clara, executiva e rastreável.')
  const top = 402
  roundedRect(ctx, M, top, W - M * 2, 318, 20); ctx.fillStyle = WHITE; ctx.fill(); ctx.strokeStyle = LINE; ctx.stroke()
  ctx.fillStyle = TEXT; ctx.font = '700 20px Arial'
  writeWrapped(ctx, 'A HRX Solutions apresenta esta proposta comercial para o desenvolvimento e execução dos serviços descritos a seguir. O documento consolida escopo, investimento, condições e prazos de forma objetiva.', M + 30, top + 60, W - M * 2 - 60, 33, 6)
  roundedRect(ctx, M + 30, top + 178, W - M * 2 - 60, 100, 14); ctx.fillStyle = SOFT; ctx.fill()
  ctx.fillStyle = NAVY_2; ctx.font = '700 17px Arial'
  writeWrapped(ctx, '“A proposta aprovada passa a ser a referência comercial oficial da entrega, preservando número, versão e histórico.”', M + 52, top + 218, W - M * 2 - 104, 27, 3)

  const y = 786
  const info = [
    ['CLIENTE', clientName(data)],
    ['CNPJ / CPF', data.client.document || 'Não informado'],
    ['RESPONSÁVEL', data.client.name || 'Não informado'],
    ['E-MAIL / WHATSAPP', [data.client.email, data.client.phone].filter(Boolean).join(' • ') || 'Não informado'],
  ]
  info.forEach(([label, value], index) => {
    const col = index % 2; const row = Math.floor(index / 2); const x = M + col * 548; const yy = y + row * 174
    roundedRect(ctx, x, yy, 516, 144, 18); ctx.fillStyle = WHITE; ctx.fill(); ctx.strokeStyle = LINE; ctx.stroke()
    ctx.fillStyle = BLUE; ctx.font = '800 13px Arial'; ctx.fillText(label, x + 24, yy + 42)
    ctx.fillStyle = TEXT; ctx.font = '700 18px Arial'; writeWrapped(ctx, value, x + 24, yy + 76, 462, 25, 2)
  })
}

function drawScope(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, mark: HTMLImageElement) {
  drawPageBase(ctx, data, logo, mark, 3, '02 — OBJETO E ESCOPO', data.title || 'Projeto / serviço')
  let y = 405
  roundedRect(ctx, M, y, W - M * 2, 238, 20); ctx.fillStyle = WHITE; ctx.fill(); ctx.strokeStyle = LINE; ctx.stroke()
  ctx.fillStyle = TEXT; ctx.font = '700 19px Arial'
  writeWrapped(ctx, data.description || 'Descrição executiva do projeto, problema a resolver, resultado esperado e contexto da contratação.', M + 28, y + 58, W - M * 2 - 56, 30, 6)

  y = 686
  roundedRect(ctx, M, y, W - M * 2, 472, 20); ctx.fillStyle = WHITE; ctx.fill(); ctx.strokeStyle = LINE; ctx.stroke()
  ctx.fillStyle = BLUE; ctx.font = '800 14px Arial'; ctx.fillText('ENTREGAS CONTEMPLADAS', M + 28, y + 46)
  let itemY = y + 98
  const scopeItems = data.items.slice(0, 8)
  if (!scopeItems.length) scopeItems.push({ serviceName: 'Escopo conforme proposta', unitLabel: 'un.', quantity: 1, unitAmount: 0, totalAmount: 0 })
  scopeItems.forEach((item) => {
    ctx.fillStyle = GREEN; ctx.beginPath(); ctx.arc(M + 36, itemY - 6, 6, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = TEXT; ctx.font = '700 17px Arial'; ctx.fillText(item.serviceName, M + 58, itemY)
    if (item.description) { ctx.fillStyle = BODY; ctx.font = '400 14px Arial'; writeWrapped(ctx, item.description, M + 58, itemY + 23, W - M * 2 - 90, 21, 2); itemY += 64 } else itemY += 45
  })

  y = 1192
  roundedRect(ctx, M, y, W - M * 2, 316, 20); ctx.fillStyle = SOFT; ctx.fill()
  ctx.fillStyle = TEXT; ctx.font = '800 18px Arial'; ctx.fillText('Fora do escopo', M + 28, y + 48)
  ctx.fillStyle = BODY; ctx.font = '400 16px Arial'; writeWrapped(ctx, 'Itens, atividades ou entregas não descritos nesta proposta não estão incluídos, salvo registro expresso em nova versão.', M + 28, y + 86, W - M * 2 - 56, 25, 3)
  ctx.fillStyle = TEXT; ctx.font = '800 18px Arial'; ctx.fillText('Premissas', M + 28, y + 180)
  ctx.fillStyle = BODY; ctx.font = '400 16px Arial'; writeWrapped(ctx, 'Alterações fora do escopo deverão ser avaliadas e poderão gerar uma nova versão desta proposta.', M + 28, y + 218, W - M * 2 - 56, 25, 3)
}

function drawInvestment(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, mark: HTMLImageElement) {
  drawPageBase(ctx, data, logo, mark, 4, '03 — INVESTIMENTO', 'Composição comercial')
  let y = 396
  const tableW = W - M * 2
  const shown = data.items.slice(0, 16)
  const rowH = shown.length > 11 ? 48 : 60
  ctx.fillStyle = NAVY_2; ctx.fillRect(M, y, tableW, 52)
  ctx.fillStyle = WHITE; ctx.font = '800 13px Arial'
  ctx.fillText('ITEM / DESCRIÇÃO', M + 18, y + 33); ctx.fillText('QTD.', 770, y + 33); ctx.fillText('UNITÁRIO', 886, y + 33); ctx.fillText('TOTAL', 1050, y + 33)
  y += 52
  shown.forEach((item, index) => {
    ctx.fillStyle = index % 2 ? '#F8FAFC' : WHITE; ctx.fillRect(M, y, tableW, rowH)
    ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(M, y + rowH); ctx.lineTo(W - M, y + rowH); ctx.stroke()
    ctx.fillStyle = TEXT; ctx.font = '700 14px Arial'; ctx.fillText(`${String(index + 1).padStart(2, '0')}  ${item.serviceName}`, M + 18, y + 27)
    if (item.description && rowH >= 60) { ctx.fillStyle = MUTED; ctx.font = '400 12px Arial'; ctx.fillText(item.description.slice(0, 66), M + 42, y + 48) }
    ctx.fillStyle = TEXT; ctx.font = '600 14px Arial'; ctx.fillText(String(item.quantity), 770, y + 29); ctx.fillText(brl.format(item.unitAmount), 886, y + 29); ctx.fillText(brl.format(item.totalAmount), 1050, y + 29)
    y += rowH
  })
  if (data.items.length > shown.length) { ctx.fillStyle = MUTED; ctx.font = '600 13px Arial'; ctx.fillText(`+ ${data.items.length - shown.length} item(ns) adicionais compõem o valor total.`, M + 18, y + 27); y += 42 }

  y = Math.max(y + 30, 1050)
  const summaryX = 650; const summaryW = W - M - summaryX
  const rows = [
    ['Subtotal', brl.format(data.subtotal)],
    ['Desconto', `${percent.format(data.discountPercent)}% — ${brl.format(data.discountAmount)}`],
    ['Impostos', `${percent.format(data.taxPercent)}% — ${brl.format(data.taxAmount)}`],
  ]
  rows.forEach(([label, value], index) => {
    const yy = y + index * 52
    ctx.fillStyle = MUTED; ctx.font = '700 14px Arial'; ctx.fillText(label, summaryX, yy + 30)
    ctx.textAlign = 'right'; ctx.fillStyle = TEXT; ctx.font = '700 15px Arial'; ctx.fillText(value, summaryX + summaryW, yy + 30); ctx.textAlign = 'left'
  })
  y += rows.length * 52 + 18
  roundedRect(ctx, summaryX - 18, y, summaryW + 18, 92, 16); ctx.fillStyle = NAVY; ctx.fill()
  ctx.fillStyle = '#B9C9D9'; ctx.font = '800 13px Arial'; ctx.fillText('VALOR FINAL', summaryX, y + 32)
  ctx.textAlign = 'right'; ctx.fillStyle = GREEN_LIGHT; ctx.font = '900 29px Arial'; ctx.fillText(brl.format(data.finalAmount), summaryX + summaryW, y + 61); ctx.textAlign = 'left'
}

function drawConditions(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, mark: HTMLImageElement) {
  drawPageBase(ctx, data, logo, mark, 5, '04 — CONDIÇÕES COMERCIAIS', 'Pagamento, prazo e validade')
  const top = 405
  const cards = [
    ['CONDIÇÃO', data.paymentMode === 'cash' ? 'À vista' : `${Math.max(1, data.installments.length)} parcelas`],
    ['FORMA', 'Conforme negociação registrada'],
    ['VALIDADE', `Até ${date(data.validUntil)}`],
    ['PRAZO ESTIMADO', 'Conforme escopo e cronograma acordados'],
  ]
  cards.forEach(([label, value], index) => {
    const col = index % 2; const row = Math.floor(index / 2); const x = M + col * 548; const y = top + row * 152
    roundedRect(ctx, x, y, 516, 124, 18); ctx.fillStyle = WHITE; ctx.fill(); ctx.strokeStyle = LINE; ctx.stroke()
    ctx.fillStyle = BLUE; ctx.font = '800 13px Arial'; ctx.fillText(label, x + 24, y + 38)
    ctx.fillStyle = TEXT; ctx.font = '700 17px Arial'; writeWrapped(ctx, value, x + 24, y + 72, 464, 23, 2)
  })

  let y = 758
  ctx.fillStyle = TEXT; ctx.font = '800 19px Arial'; ctx.fillText('Parcelamento previsto', M, y)
  y += 28
  const schedule = data.installments.length ? data.installments.slice(0, 10) : [{ installmentNumber: 1, amount: data.finalAmount, dueDate: data.validUntil }]
  ctx.fillStyle = NAVY_2; ctx.fillRect(M, y, W - M * 2, 48)
  ctx.fillStyle = WHITE; ctx.font = '800 12px Arial'; ctx.fillText('PARCELA', M + 18, y + 31); ctx.fillText('VALOR', M + 310, y + 31); ctx.fillText('VENCIMENTO', M + 700, y + 31)
  y += 48
  schedule.forEach((installment, index) => {
    ctx.fillStyle = index % 2 ? '#F8FAFC' : WHITE; ctx.fillRect(M, y, W - M * 2, 48)
    ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(M, y + 48); ctx.lineTo(W - M, y + 48); ctx.stroke()
    ctx.fillStyle = TEXT; ctx.font = '700 14px Arial'; ctx.fillText(`${installment.installmentNumber}/${schedule.length}`, M + 18, y + 30); ctx.fillText(brl.format(installment.amount), M + 310, y + 30); ctx.fillText(date(installment.dueDate), M + 700, y + 30)
    y += 48
  })

  y = Math.max(y + 38, 1320)
  roundedRect(ctx, M, y, W - M * 2, 220, 18); ctx.fillStyle = SOFT; ctx.fill()
  ctx.fillStyle = TEXT; ctx.font = '800 17px Arial'; ctx.fillText('Observações comerciais', M + 26, y + 44)
  ctx.fillStyle = BODY; ctx.font = '400 15px Arial'; writeWrapped(ctx, data.customerNotes || 'Sem observações comerciais adicionais registradas.', M + 26, y + 80, W - M * 2 - 52, 24, 5)
}

function drawAcceptance(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, mark: HTMLImageElement) {
  drawPageBase(ctx, data, logo, mark, 6, '05 — ACEITE', 'Confirmação da proposta')
  let y = 408
  roundedRect(ctx, M, y, W - M * 2, 250, 20); ctx.fillStyle = WHITE; ctx.fill(); ctx.strokeStyle = LINE; ctx.stroke()
  ctx.fillStyle = TEXT; ctx.font = '700 19px Arial'
  writeWrapped(ctx, 'Ao aprovar esta proposta, o cliente declara estar de acordo com o escopo, investimento, condições de pagamento, prazos e demais condições registradas nesta versão.', M + 28, y + 58, W - M * 2 - 56, 31, 5)

  y = 720
  const fields = [
    ['CLIENTE', clientName(data)],
    ['PROPOSTA APROVADA', `${data.proposalNumber} • Versão ${versionLabel(data.version)}`],
  ]
  fields.forEach(([label, value], index) => {
    const yy = y + index * 142
    ctx.fillStyle = BLUE; ctx.font = '800 13px Arial'; ctx.fillText(label, M, yy)
    ctx.fillStyle = TEXT; ctx.font = '700 22px Arial'; ctx.fillText(value, M, yy + 38)
    ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(M, yy + 72); ctx.lineTo(W - M, yy + 72); ctx.stroke()
  })

  y = 1068
  ctx.strokeStyle = '#9AAABD'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(610, y); ctx.moveTo(680, y); ctx.lineTo(W - M, y); ctx.stroke()
  ctx.fillStyle = MUTED; ctx.font = '500 14px Arial'; ctx.fillText('Responsável pelo cliente — nome / assinatura', M, y + 34); ctx.fillText('Data do aceite', 680, y + 34)
  ctx.fillStyle = '#8194A7'; ctx.font = '500 15px Arial'; ctx.fillText('____ / ____ / ______', 680, y + 72)

  roundedRect(ctx, M, 1268, W - M * 2, 232, 20); ctx.fillStyle = NAVY; ctx.fill()
  ctx.fillStyle = WHITE; ctx.font = '800 22px Arial'; ctx.fillText('HRX Solutions', M + 28, 1324)
  ctx.fillStyle = '#ACC0D3'; ctx.font = '400 16px Arial'; ctx.fillText('Documento comercial HRX Solutions', M + 28, 1362)
  ctx.fillText(`Protocolo ${data.protocol} • ${data.proposalNumber} • v${versionLabel(data.version)}`, M + 28, 1396)
  ctx.fillStyle = GREEN_LIGHT; ctx.font = '700 15px Arial'; ctx.fillText('Referência comercial oficial da entrega após aprovação.', M + 28, 1440)
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
  const images = canvases.map((canvas) => base64Bytes(canvas.toDataURL('image/jpeg', .95)))
  const objectCount = 2 + canvases.length * 3
  const objects = new Map<number, Uint8Array>()
  objects.set(1, encoder.encode('<< /Type /Catalog /Pages 2 0 R >>'))
  const pageIds = canvases.map((_, index) => 3 + index * 3)
  objects.set(2, encoder.encode(`<< /Type /Pages /Count ${canvases.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`))
  images.forEach((image, index) => {
    const pageId = 3 + index * 3; const imageId = pageId + 1; const contentId = pageId + 2
    const content = encoder.encode('q 595.28 0 0 841.89 0 0 cm /Im0 Do Q')
    objects.set(pageId, encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`))
    objects.set(imageId, concat([encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`), image, encoder.encode('\nendstream')]))
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
  const { logo, mark } = await loadBrandAssets()
  const canvases: HTMLCanvasElement[] = []
  const pages = [drawCover, drawPresentation, drawScope, drawInvestment, drawConditions, drawAcceptance]
  pages.forEach((draw) => {
    const canvas = pageCanvas()
    draw(canvas.getContext('2d')!, data, logo, mark)
    canvases.push(canvas)
  })
  return canvasesToPdf(canvases)
}
