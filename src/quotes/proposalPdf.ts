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

const W = 1240
const H = 1754
const M = 74
const FOOTER_TOP = 1648
const NAVY = '#061426'
const NAVY_2 = '#091B31'
const NAVY_3 = '#102C45'
const BLUE = '#4389FF'
const GREEN = '#62C978'
const GREEN_DARK = '#24B96D'
const TEXT = '#102235'
const MUTED = '#667D90'
const LINE = '#D8E3EE'
const SOFT = '#EEF4FA'
const PAPER = '#F7FAFD'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const percent = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const date = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')
const encoder = new TextEncoder()

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

function writeWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 10) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
      if (lines.length >= maxLines) break
    } else line = next
  }
  if (line && lines.length < maxLines) lines.push(line)
  lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight))
  return y + lines.length * lineHeight
}

function drawDraftWatermark(ctx: CanvasRenderingContext2D, data: ProposalPdfData) {
  if (!data.draft) return
  ctx.save()
  ctx.translate(W / 2, H / 2 + 50)
  ctx.rotate(-Math.PI / 5)
  ctx.globalAlpha = 0.055
  ctx.fillStyle = NAVY_3
  ctx.font = '800 154px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('RASCUNHO', 0, 0)
  ctx.restore()
  ctx.textAlign = 'left'
}

function drawFooter(ctx: CanvasRenderingContext2D, data: ProposalPdfData, page: number, pages: number) {
  ctx.fillStyle = NAVY
  ctx.fillRect(0, FOOTER_TOP, W, H - FOOTER_TOP)
  ctx.fillStyle = '#B7C7D8'
  ctx.font = '500 15px Arial'
  ctx.fillText('HRX Solutions • Documento comercial confidencial', M, FOOTER_TOP + 45)
  ctx.fillStyle = '#7F97AF'
  ctx.font = '500 14px Arial'
  ctx.fillText(`${data.proposalNumber} • Versão ${data.version}`, M, FOOTER_TOP + 72)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#D7E4F1'
  ctx.fillText(`Página ${page} de ${pages}`, W - M, FOOTER_TOP + 58)
  ctx.textAlign = 'left'
}

function drawInternalBase(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, mark: HTMLImageElement, page: number, pages: number, title: string, eyebrow: string) {
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  const gradient = ctx.createLinearGradient(0, 0, W, 0)
  gradient.addColorStop(0, NAVY)
  gradient.addColorStop(1, NAVY_2)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, W, 196)
  if (logo.complete && logo.naturalWidth) ctx.drawImage(logo, M, 28, 190, 114)
  else {
    ctx.fillStyle = '#FFFFFF'; ctx.font = '800 48px Arial'; ctx.fillText('HRX', M, 96)
    ctx.fillStyle = GREEN; ctx.font = '700 20px Arial'; ctx.fillText('SOLUTIONS', M + 112, 96)
  }
  ctx.textAlign = 'right'
  ctx.fillStyle = '#D5E2F0'; ctx.font = '600 17px Arial'; ctx.fillText(data.proposalNumber, W - M, 62)
  ctx.fillStyle = '#92A8C0'; ctx.font = '500 15px Arial'; ctx.fillText(`Versão ${data.version} • ${date(data.createdAt)}`, W - M, 91)
  ctx.fillText(data.draft ? 'ORÇAMENTO EM ELABORAÇÃO' : 'PROPOSTA COMERCIAL', W - M, 120)
  ctx.textAlign = 'left'
  ctx.fillStyle = GREEN_DARK; ctx.fillRect(M, 196, 102, 6)
  ctx.fillStyle = BLUE; ctx.font = '700 15px Arial'; ctx.fillText(eyebrow.toUpperCase(), M, 266)
  ctx.fillStyle = TEXT; ctx.font = '800 34px Arial'; ctx.fillText(title, M, 314)
  if (mark.complete && mark.naturalWidth) {
    ctx.save(); ctx.globalAlpha = 0.055; ctx.drawImage(mark, 900, 1360, 350, 150); ctx.restore()
  }
  drawDraftWatermark(ctx, data)
  drawFooter(ctx, data, page, pages)
}

function drawCover(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, mark: HTMLImageElement, page: number, pages: number) {
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, NAVY); bg.addColorStop(0.62, NAVY_2); bg.addColorStop(1, '#0D2540')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = GREEN_DARK; ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W, 390); ctx.lineTo(1010, 0); ctx.closePath(); ctx.fill()
  ctx.save(); ctx.globalAlpha = 0.09; ctx.fillStyle = BLUE; ctx.beginPath(); ctx.moveTo(W, 300); ctx.lineTo(W, 790); ctx.lineTo(890, 470); ctx.closePath(); ctx.fill(); ctx.restore()
  if (mark.complete && mark.naturalWidth) { ctx.save(); ctx.globalAlpha = 0.055; ctx.drawImage(mark, 670, 1040, 610, 260); ctx.restore() }
  if (logo.complete && logo.naturalWidth) ctx.drawImage(logo, M, 52, 240, 144)
  else { ctx.fillStyle = '#FFFFFF'; ctx.font = '800 56px Arial'; ctx.fillText('HRX', M, 125) }
  ctx.textAlign = 'right'; ctx.fillStyle = '#D9E6F2'; ctx.font = '600 18px Arial'; ctx.fillText(data.proposalNumber, W - M, 82)
  ctx.fillStyle = '#8FA7C0'; ctx.font = '500 16px Arial'; ctx.fillText(`Versão ${data.version} • ${date(data.createdAt)}`, W - M, 114); ctx.textAlign = 'left'
  ctx.fillStyle = GREEN; ctx.font = '700 17px Arial'; ctx.fillText(data.draft ? 'ORÇAMENTO EM ELABORAÇÃO' : 'PROPOSTA COMERCIAL', M, 356)
  ctx.fillStyle = '#FFFFFF'; ctx.font = '800 48px Arial'
  const titleBottom = writeWrapped(ctx, data.title || 'Proposta Comercial', M, 422, 850, 58, 4)
  ctx.fillStyle = '#A9BDD1'; ctx.font = '400 20px Arial'
  writeWrapped(ctx, data.description || 'Solução proposta pela HRX Solutions conforme escopo e condições comerciais deste documento.', M, titleBottom + 22, 830, 31, 5)

  const cardY = 760
  roundedRect(ctx, M, cardY, W - M * 2, 380, 28); ctx.fillStyle = 'rgba(255,255,255,0.075)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2; ctx.stroke()
  ctx.fillStyle = '#B8CBE0'; ctx.font = '700 14px Arial'; ctx.fillText('CLIENTE', M + 34, cardY + 46)
  ctx.fillStyle = '#FFFFFF'; ctx.font = '800 29px Arial'; ctx.fillText(data.client.company || data.client.name, M + 34, cardY + 88)
  ctx.fillStyle = '#A8BCD1'; ctx.font = '500 17px Arial'; ctx.fillText(data.client.company ? data.client.name : 'Contato principal', M + 34, cardY + 122)
  ctx.fillText([data.client.document, data.client.email, data.client.phone].filter(Boolean).join('  •  '), M + 34, cardY + 154)
  const stats = [
    ['Valor final', brl.format(data.finalAmount)],
    ['Pagamento', data.paymentMode === 'cash' ? 'À vista' : `${data.installments.length} parcelas`],
    ['Validade', date(data.validUntil)],
  ]
  stats.forEach(([label, value], index) => {
    const x = M + 34 + index * 350; const y = cardY + 226
    roundedRect(ctx, x, y, 320, 108, 18); ctx.fillStyle = 'rgba(255,255,255,0.055)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.11)'; ctx.stroke()
    ctx.fillStyle = '#8FA8C2'; ctx.font = '700 13px Arial'; ctx.fillText(label.toUpperCase(), x + 20, y + 32)
    ctx.fillStyle = label === 'Valor final' ? GREEN : '#FFFFFF'; ctx.font = label === 'Valor final' ? '800 24px Arial' : '700 20px Arial'; ctx.fillText(value, x + 20, y + 70)
  })
  drawDraftWatermark(ctx, data)
  drawFooter(ctx, data, page, pages)
}

function drawObjectPage(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, mark: HTMLImageElement, page: number, pages: number) {
  drawInternalBase(ctx, data, logo, mark, page, pages, 'Objeto da proposta', 'Escopo e entregas')
  const top = 360
  roundedRect(ctx, M, top, 520, 410, 24); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = LINE; ctx.stroke()
  ctx.fillStyle = BLUE; ctx.font = '700 14px Arial'; ctx.fillText('PROJETO / SERVIÇO', M + 28, top + 46)
  ctx.fillStyle = TEXT; ctx.font = '800 25px Arial'; writeWrapped(ctx, data.title || 'Proposta Comercial', M + 28, top + 86, 460, 32, 3)
  ctx.fillStyle = '#74889C'; ctx.font = '700 14px Arial'; ctx.fillText('DESCRIÇÃO', M + 28, top + 178)
  ctx.fillStyle = MUTED; ctx.font = '400 17px Arial'; writeWrapped(ctx, data.description || 'Escopo conforme composição comercial apresentada.', M + 28, top + 216, 460, 27, 6)

  roundedRect(ctx, 626, top, 540, 410, 24); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = LINE; ctx.stroke()
  ctx.fillStyle = BLUE; ctx.font = '700 14px Arial'; ctx.fillText('ESCOPO CONTEMPLADO', 654, top + 46)
  let y = top + 92
  const scopeItems = data.items.slice(0, 7)
  if (!scopeItems.length) scopeItems.push({ serviceName: 'Escopo conforme proposta', unitLabel: 'un.', quantity: 1, unitAmount: 0, totalAmount: 0 })
  for (const item of scopeItems) {
    ctx.fillStyle = GREEN_DARK; ctx.beginPath(); ctx.arc(666, y - 5, 6, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = TEXT; ctx.font = '700 17px Arial'; ctx.fillText(item.serviceName, 686, y)
    if (item.description) { ctx.fillStyle = MUTED; ctx.font = '400 14px Arial'; writeWrapped(ctx, item.description, 686, y + 23, 430, 20, 2); y += 64 } else y += 42
  }

  const noteY = 824
  roundedRect(ctx, M, noteY, W - M * 2, 250, 24); ctx.fillStyle = '#F0F5FB'; ctx.fill(); ctx.strokeStyle = '#D7E3EF'; ctx.stroke()
  ctx.fillStyle = TEXT; ctx.font = '800 20px Arial'; ctx.fillText('Premissas da proposta', M + 28, noteY + 46)
  ctx.fillStyle = MUTED; ctx.font = '400 17px Arial'
  writeWrapped(ctx, 'Os serviços descritos neste documento compõem o escopo comercial desta versão. Qualquer necessidade adicional, alteração relevante de premissa ou ampliação de escopo poderá exigir revisão da proposta e nova versão para aprovação.', M + 28, noteY + 84, W - M * 2 - 56, 29, 6)
}

function drawInvestmentPage(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, mark: HTMLImageElement, page: number, pages: number, items: ProposalPdfItem[], first: boolean) {
  drawInternalBase(ctx, data, logo, mark, page, pages, first ? 'Investimento' : 'Investimento — continuação', 'Composição comercial')
  const tableX = M; let y = 360; const tableW = W - M * 2
  ctx.fillStyle = SOFT; ctx.fillRect(tableX, y, tableW, 54)
  ctx.fillStyle = '#496176'; ctx.font = '700 14px Arial'; ctx.fillText('ITEM / DESCRIÇÃO', tableX + 18, y + 34); ctx.fillText('QTD.', 770, y + 34); ctx.fillText('UNITÁRIO', 880, y + 34); ctx.fillText('TOTAL', 1050, y + 34)
  y += 54
  for (const item of items) {
    const rowH = 88
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(tableX, y, tableW, rowH); ctx.strokeStyle = '#E2EAF2'; ctx.beginPath(); ctx.moveTo(tableX, y + rowH); ctx.lineTo(tableX + tableW, y + rowH); ctx.stroke()
    ctx.fillStyle = TEXT; ctx.font = '700 17px Arial'; ctx.fillText(item.serviceName, tableX + 18, y + 30)
    if (item.description) { ctx.fillStyle = MUTED; ctx.font = '400 14px Arial'; writeWrapped(ctx, item.description, tableX + 18, y + 55, 610, 19, 2) }
    ctx.fillStyle = '#40586C'; ctx.font = '500 16px Arial'; ctx.fillText(`${item.quantity.toLocaleString('pt-BR')} ${item.unitLabel}`, 770, y + 45); ctx.fillText(brl.format(item.unitAmount), 880, y + 45); ctx.fillText(brl.format(item.totalAmount), 1050, y + 45)
    y += rowH
  }
  if (!first) return
  const summaryY = Math.max(y + 28, 1090)
  roundedRect(ctx, 672, summaryY, 494, 310, 22); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = LINE; ctx.stroke()
  const rows = [
    ['Subtotal', brl.format(data.subtotal)],
    [`Desconto (${percent.format(data.discountPercent)}%)`, `− ${brl.format(data.discountAmount)}`],
    [`Impostos (${percent.format(data.taxPercent)}%)`, `+ ${brl.format(data.taxAmount)}`],
  ]
  rows.forEach(([label, value], index) => {
    const yy = summaryY + 48 + index * 52
    ctx.fillStyle = MUTED; ctx.font = '600 17px Arial'; ctx.fillText(label, 704, yy)
    ctx.fillStyle = TEXT; ctx.textAlign = 'right'; ctx.fillText(value, 1134, yy); ctx.textAlign = 'left'
  })
  ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(704, summaryY + 205); ctx.lineTo(1134, summaryY + 205); ctx.stroke()
  ctx.fillStyle = TEXT; ctx.font = '800 20px Arial'; ctx.fillText('Valor final', 704, summaryY + 260)
  ctx.fillStyle = GREEN_DARK; ctx.font = '800 28px Arial'; ctx.textAlign = 'right'; ctx.fillText(brl.format(data.finalAmount), 1134, summaryY + 262); ctx.textAlign = 'left'
}

function drawPaymentPage(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, mark: HTMLImageElement, page: number, pages: number) {
  drawInternalBase(ctx, data, logo, mark, page, pages, 'Condições de pagamento', 'Prazos e vencimentos')
  const top = 360; const cardW = 340
  const cards = [
    ['Forma de pagamento', data.paymentMode === 'cash' ? 'À vista' : 'Parcelado'],
    ['Parcelas previstas', String(Math.max(1, data.installments.length))],
    ['Validade', date(data.validUntil)],
  ]
  cards.forEach(([label, value], index) => {
    const x = M + index * (cardW + 36)
    roundedRect(ctx, x, top, cardW, 138, 20); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = LINE; ctx.stroke()
    ctx.fillStyle = '#71879B'; ctx.font = '700 13px Arial'; ctx.fillText(label.toUpperCase(), x + 22, top + 38)
    ctx.fillStyle = TEXT; ctx.font = '800 22px Arial'; ctx.fillText(value, x + 22, top + 83)
  })
  ctx.fillStyle = TEXT; ctx.font = '800 22px Arial'; ctx.fillText('Cronograma previsto', M, 560)
  ctx.fillStyle = MUTED; ctx.font = '400 16px Arial'; ctx.fillText('Os vencimentos abaixo refletem a condição comercial registrada nesta versão.', M, 590)
  const schedule = data.installments.length ? data.installments : [{ installmentNumber: 1, amount: data.finalAmount, dueDate: data.validUntil }]
  const columns = schedule.length > 12 ? [schedule.slice(0, 12), schedule.slice(12)] : [schedule]
  columns.forEach((column, colIndex) => {
    const x = M + colIndex * 548; let y = 638; const width = columns.length === 1 ? W - M * 2 : 516
    ctx.fillStyle = SOFT; ctx.fillRect(x, y, width, 44); ctx.fillStyle = '#526A7F'; ctx.font = '700 13px Arial'; ctx.fillText('PARCELA', x + 16, y + 28); ctx.fillText('VENCIMENTO', x + 144, y + 28); ctx.textAlign = 'right'; ctx.fillText('VALOR', x + width - 16, y + 28); ctx.textAlign = 'left'; y += 44
    column.forEach((installment) => {
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, width, 58); ctx.strokeStyle = '#E2EAF2'; ctx.beginPath(); ctx.moveTo(x, y + 58); ctx.lineTo(x + width, y + 58); ctx.stroke()
      ctx.fillStyle = TEXT; ctx.font = '700 15px Arial'; ctx.fillText(`${installment.installmentNumber}/${schedule.length}`, x + 16, y + 36)
      ctx.fillStyle = MUTED; ctx.font = '500 15px Arial'; ctx.fillText(date(installment.dueDate), x + 144, y + 36)
      ctx.textAlign = 'right'; ctx.fillStyle = TEXT; ctx.font = '700 15px Arial'; ctx.fillText(brl.format(installment.amount), x + width - 16, y + 36); ctx.textAlign = 'left'; y += 58
    })
  })
}

function drawValidityPage(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, mark: HTMLImageElement, page: number, pages: number) {
  drawInternalBase(ctx, data, logo, mark, page, pages, 'Validade e observações', 'Condições gerais')
  let y = 360
  roundedRect(ctx, M, y, W - M * 2, 210, 24); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = LINE; ctx.stroke()
  ctx.fillStyle = GREEN_DARK; ctx.font = '700 14px Arial'; ctx.fillText('VALIDADE DA PROPOSTA', M + 28, y + 48)
  ctx.fillStyle = TEXT; ctx.font = '800 29px Arial'; ctx.fillText(`Válida até ${date(data.validUntil)}`, M + 28, y + 93)
  ctx.fillStyle = MUTED; ctx.font = '400 17px Arial'; writeWrapped(ctx, 'Após esta data, valores, disponibilidade, prazos e demais condições poderão ser revistos antes de uma nova aprovação.', M + 28, y + 132, W - M * 2 - 56, 27, 3)
  y += 252
  roundedRect(ctx, M, y, W - M * 2, 380, 24); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = LINE; ctx.stroke()
  ctx.fillStyle = BLUE; ctx.font = '700 14px Arial'; ctx.fillText('OBSERVAÇÕES', M + 28, y + 48)
  ctx.fillStyle = MUTED; ctx.font = '400 17px Arial'; writeWrapped(ctx, data.customerNotes || 'Sem observações adicionais registradas para esta proposta.', M + 28, y + 88, W - M * 2 - 56, 29, 8)
  y += 422
  roundedRect(ctx, M, y, W - M * 2, 300, 24); ctx.fillStyle = '#F1F6FB'; ctx.fill(); ctx.strokeStyle = '#D7E3EF'; ctx.stroke()
  ctx.fillStyle = TEXT; ctx.font = '800 20px Arial'; ctx.fillText('Condições gerais', M + 28, y + 48)
  const conditions = [
    'Atividades adicionais ou mudanças de escopo serão previamente avaliadas.',
    'A execução considera as premissas e dependências descritas nesta versão.',
    'Aprovações, acessos e informações sob responsabilidade do cliente podem impactar o cronograma.',
  ]
  conditions.forEach((condition, index) => {
    const yy = y + 96 + index * 58
    ctx.fillStyle = GREEN_DARK; ctx.beginPath(); ctx.arc(M + 36, yy - 6, 5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = MUTED; ctx.font = '400 16px Arial'; writeWrapped(ctx, condition, M + 56, yy, W - M * 2 - 92, 23, 2)
  })
}

function drawAcceptancePage(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, mark: HTMLImageElement, page: number, pages: number) {
  drawInternalBase(ctx, data, logo, mark, page, pages, 'Aceite', 'Confirmação comercial')
  let y = 368
  roundedRect(ctx, M, y, W - M * 2, 270, 24); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = LINE; ctx.stroke()
  ctx.fillStyle = TEXT; ctx.font = '800 22px Arial'; ctx.fillText('Declaração de aceite', M + 28, y + 48)
  ctx.fillStyle = MUTED; ctx.font = '400 17px Arial'
  writeWrapped(ctx, 'Ao aprovar esta proposta, o cliente declara estar de acordo com o escopo, os valores, as condições de pagamento, os prazos e as demais condições descritas neste documento, referentes à versão identificada abaixo.', M + 28, y + 90, W - M * 2 - 56, 29, 6)
  y += 322
  roundedRect(ctx, M, y, W - M * 2, 500, 24); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = LINE; ctx.stroke()
  const rows = [
    ['Cliente', data.client.company || data.client.name],
    ['Responsável', data.client.name],
    ['Documento', data.client.document || '—'],
    ['Proposta', `${data.proposalNumber} • Versão ${data.version}`],
  ]
  rows.forEach(([label, value], index) => {
    const yy = y + 50 + index * 70
    ctx.fillStyle = '#74899D'; ctx.font = '700 13px Arial'; ctx.fillText(label.toUpperCase(), M + 30, yy)
    ctx.fillStyle = TEXT; ctx.font = '700 18px Arial'; ctx.fillText(value, M + 30, yy + 28)
  })
  const signatureY = y + 350
  ctx.strokeStyle = '#AFC0D0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(M + 30, signatureY); ctx.lineTo(M + 500, signatureY); ctx.moveTo(670, signatureY); ctx.lineTo(W - M - 30, signatureY); ctx.stroke()
  ctx.fillStyle = MUTED; ctx.font = '500 14px Arial'; ctx.fillText('Assinatura / aceite do responsável', M + 30, signatureY + 30); ctx.fillText('Data', 670, signatureY + 30)
  roundedRect(ctx, M, 1270, W - M * 2, 220, 24); ctx.fillStyle = NAVY_2; ctx.fill()
  ctx.fillStyle = '#FFFFFF'; ctx.font = '800 22px Arial'; ctx.fillText('HRX Solutions', M + 28, 1324)
  ctx.fillStyle = '#A9BED2'; ctx.font = '400 16px Arial'; ctx.fillText('Proposta comercial emitida e versionada pelo ambiente administrativo HRX.', M + 28, 1364); ctx.fillText(`Protocolo ${data.protocol} • ${data.proposalNumber}`, M + 28, 1398)
  ctx.fillStyle = GREEN; ctx.font = '700 16px Arial'; ctx.fillText('Documento oficial gerado pelo PWA HRX Solutions', M + 28, 1442)
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
  const images = canvases.map((canvas) => base64Bytes(canvas.toDataURL('image/jpeg', 0.94)))
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
  const itemChunks: ProposalPdfItem[][] = []
  for (let index = 0; index < data.items.length; index += 9) itemChunks.push(data.items.slice(index, index + 9))
  if (!itemChunks.length) itemChunks.push([])
  const totalPages = 6 + Math.max(0, itemChunks.length - 1)
  const canvases: HTMLCanvasElement[] = []

  const cover = pageCanvas(); drawCover(cover.getContext('2d')!, data, logo, mark, 1, totalPages); canvases.push(cover)
  const object = pageCanvas(); drawObjectPage(object.getContext('2d')!, data, logo, mark, 2, totalPages); canvases.push(object)
  itemChunks.forEach((items, index) => {
    const canvas = pageCanvas(); drawInvestmentPage(canvas.getContext('2d')!, data, logo, mark, 3 + index, totalPages, items, index === 0); canvases.push(canvas)
  })
  let page = 3 + itemChunks.length
  const payment = pageCanvas(); drawPaymentPage(payment.getContext('2d')!, data, logo, mark, page, totalPages); canvases.push(payment)
  page += 1
  const validity = pageCanvas(); drawValidityPage(validity.getContext('2d')!, data, logo, mark, page, totalPages); canvases.push(validity)
  page += 1
  const acceptance = pageCanvas(); drawAcceptancePage(acceptance.getContext('2d')!, data, logo, mark, page, totalPages); canvases.push(acceptance)
  return canvasesToPdf(canvases)
}
