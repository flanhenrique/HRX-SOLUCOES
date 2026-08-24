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
  paymentMethod?: string
  estimatedDeadline?: string
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
 * TEMPLATE COMERCIAL CANÔNICO — NÃO REDESENHAR.
 * Canva: “HRX Solutions — Proposta Comercial — Opção 3 Revisada”
 * Design ID: DAHTJI6gD7s
 * Dimensão original: 794 × 1123 px (A4), 6 páginas.
 *
 * As coordenadas abaixo reproduzem a geometria do arquivo aprovado. Mudanças de
 * identidade/layout devem ser feitas primeiro no documento canônico e só depois
 * refletidas neste renderer.
 */
const W = 794
const H = 1123
const SCALE = 2
const FOOTER_Y = 1082
const LEFT = 68
const RIGHT = 726

const NAVY = '#07182D'
const NAVY_2 = '#102D48'
const NAVY_3 = '#173A58'
const GREEN = '#24B96D'
const GREEN_LIGHT = '#62DD8A'
const WHITE = '#FFFFFF'
const PAPER = '#FFFFFF'
const TEXT = '#10263B'
const BODY = '#4D6478'
const MUTED = '#718497'
const LINE = '#DDE5EC'
const SOFT = '#F3F6F8'
const SOFT_GREEN = '#EEF9F3'
const encoder = new TextEncoder()

const COMPANY_CNPJ = '68.588.217/0001-06'
const COMPANY_EMAIL = 'comercial@hrxsolutions.com.br'
const COMPANY_SITE = 'hrxsolutions.com.br'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const percent = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const date = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')
const versionLabel = (value: number) => `${Math.max(1, Number(value) || 1)}.0`
const clientName = (data: ProposalPdfData) => data.client.company || data.client.name
const companyContactLine = () => `HRX Solutions • ${COMPANY_CNPJ} • ${COMPANY_EMAIL} • ${COMPANY_SITE}`

function pageCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')!
  ctx.scale(SCALE, SCALE)
  ctx.textBaseline = 'alphabetic'
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
  const [logoLight, logoDark, markDark] = await Promise.all([
    loadImage('hrx-logo.svg'),
    loadImage('hrx-logo-dark.svg'),
    loadImage('hrx-mark-dark.svg'),
  ])
  return { logoLight, logoDark, markDark }
}

function font(ctx: CanvasRenderingContext2D, weight: number, size: number) {
  ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius = 10) {
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
}

function wrappedLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 20) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line)
      line = word
      if (lines.length >= maxLines) break
    } else {
      line = candidate
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines
}

function writeWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 20) {
  const lines = wrappedLines(ctx, text, maxWidth, maxLines)
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight))
  return lines.length
}

function drawImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  if (image.complete && image.naturalWidth) ctx.drawImage(image, x, y, width, height)
}

function drawDraftWatermark(ctx: CanvasRenderingContext2D, data: ProposalPdfData) {
  if (!data.draft) return
  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.rotate(-Math.PI / 5)
  ctx.globalAlpha = .055
  ctx.fillStyle = NAVY
  font(ctx, 800, 92)
  ctx.textAlign = 'center'
  ctx.fillText('RASCUNHO', 0, 0)
  ctx.restore()
  ctx.textAlign = 'left'
}

function drawWatermark(ctx: CanvasRenderingContext2D, markDark: HTMLImageElement) {
  if (!markDark.complete || !markDark.naturalWidth) return
  ctx.save()
  ctx.globalAlpha = .055
  ctx.drawImage(markDark, 486, 925, 240, 103.56)
  ctx.restore()
}

function drawFooter(ctx: CanvasRenderingContext2D, data: ProposalPdfData, page: number, label = companyContactLine()) {
  ctx.fillStyle = '#768A9D'
  font(ctx, 500, 7.5)
  ctx.fillText(label, LEFT, FOOTER_Y)
  ctx.textAlign = 'right'
  ctx.fillText(`${data.proposalNumber} • v${versionLabel(data.version)} • ${page}/6`, RIGHT, FOOTER_Y)
  ctx.textAlign = 'left'
}

function drawInternalBackground(ctx: CanvasRenderingContext2D, data: ProposalPdfData, markDark: HTMLImageElement, page: number) {
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  drawWatermark(ctx, markDark)
  drawDraftWatermark(ctx, data)
  drawFooter(ctx, data, page)
}

function drawSectionHeader(ctx: CanvasRenderingContext2D, section: string, title: string) {
  ctx.fillStyle = GREEN
  font(ctx, 800, 9.5)
  ctx.fillText(section, LEFT, 80)
  ctx.fillStyle = TEXT
  font(ctx, 800, 23)
  writeWrapped(ctx, title, LEFT, 107, RIGHT - LEFT, 29, 2)
}

function drawCoverArtwork(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, W, H)
  gradient.addColorStop(0, '#061529')
  gradient.addColorStop(.55, '#07182D')
  gradient.addColorStop(1, '#0B2945')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, W, H)

  // Geometria derivada do X da marca, preservando a composição escura da capa aprovada.
  ctx.save()
  ctx.globalAlpha = .11
  ctx.fillStyle = '#245175'
  ctx.beginPath(); ctx.moveTo(555, 0); ctx.lineTo(794, 0); ctx.lineTo(794, 335); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(0, 903); ctx.lineTo(0, 1123); ctx.lineTo(425, 1123); ctx.lineTo(250, 903); ctx.closePath(); ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = .16
  ctx.strokeStyle = GREEN
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(470, 870); ctx.lineTo(794, 1123); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(555, 845); ctx.lineTo(794, 1030); ctx.stroke()
  ctx.restore()

  const bottom = ctx.createLinearGradient(0, 903, 794, 1123)
  bottom.addColorStop(0, 'rgba(5,18,34,.15)')
  bottom.addColorStop(1, 'rgba(4,13,25,.86)')
  ctx.fillStyle = bottom
  ctx.fillRect(0, 903, 794, 220)
}

function drawCover(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logoLight: HTMLImageElement) {
  drawCoverArtwork(ctx)
  drawImage(ctx, logoLight, 68, 70, 182, 108.72)

  ctx.fillStyle = '#9DB1C3'
  font(ctx, 700, 9)
  ctx.fillText('Documento comercial oficial', 68, 282)

  ctx.fillStyle = WHITE
  font(ctx, 900, 41)
  ctx.fillText('PROPOSTA', 68, 342)
  ctx.fillText('COMERCIAL', 68, 389)

  ctx.fillStyle = '#D7E1E9'
  font(ctx, 400, 17)
  writeWrapped(ctx, 'Soluções profissionais, escopo claro e condições comerciais transparentes.', 68, 438, 520, 25, 3)

  const pairs = [
    { label: 'Cliente', value: clientName(data), x: 68, y: 547.38 },
    { label: 'Proposta', value: data.proposalNumber, x: 405, y: 547.38 },
    { label: 'Versão', value: versionLabel(data.version), x: 68, y: 635.38 },
    { label: 'Emissão', value: date(data.createdAt), x: 405, y: 635.38 },
  ]
  pairs.forEach(({ label, value, x, y }) => {
    ctx.fillStyle = '#8EA6BA'
    font(ctx, 700, 8)
    ctx.fillText(label, x, y)
    ctx.fillStyle = WHITE
    font(ctx, 700, 14)
    const maxWidth = x === 68 ? 321 : 321
    writeWrapped(ctx, value, x, y + 29, maxWidth, 18, 2)
  })

  drawDraftWatermark(ctx, data)
}

function drawPresentation(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logoDark: HTMLImageElement, markDark: HTMLImageElement) {
  drawInternalBackground(ctx, data, markDark, 2)

  const line = ctx.createLinearGradient(68, 70, 726, 70)
  line.addColorStop(0, NAVY)
  line.addColorStop(.72, NAVY_3)
  line.addColorStop(1, GREEN)
  ctx.fillStyle = line
  ctx.fillRect(68, 70, 658, 7)
  drawImage(ctx, logoDark, 68, 96, 190, 113.4989)

  ctx.fillStyle = GREEN
  font(ctx, 800, 9.5)
  ctx.fillText('01 — Apresentação', 68, 272)
  ctx.fillStyle = TEXT
  font(ctx, 800, 27)
  writeWrapped(ctx, 'Uma proposta feita para ser clara, executiva e rastreável.', 68, 310, 658, 32, 2)

  ctx.fillStyle = BODY
  font(ctx, 400, 13.5)
  writeWrapped(ctx, 'A HRX Solutions apresenta esta proposta comercial para o desenvolvimento e execução dos serviços descritos a seguir. O documento consolida escopo, investimento, condições e prazos de forma objetiva.', 68, 378, 658, 20, 5)

  roundedRect(ctx, 68, 444, 658, 102, 12)
  ctx.fillStyle = SOFT_GREEN
  ctx.fill()
  ctx.fillStyle = NAVY_2
  font(ctx, 700, 13.5)
  writeWrapped(ctx, '“A proposta aprovada passa a ser a referência comercial oficial da entrega, preservando número, versão e histórico.”', 86, 477, 622, 22, 4)

  const cards = [
    { label: 'Cliente', value: clientName(data), x: 68, y: 596.75 },
    { label: 'CNPJ / CPF', value: data.client.document || 'Não informado', x: 406, y: 596.75 },
    { label: 'Responsável', value: data.client.name || 'Não informado', x: 68, y: 687.75 },
    { label: 'E-mail / WhatsApp', value: [data.client.email, data.client.phone].filter(Boolean).join(' • ') || 'Não informado', x: 406, y: 687.75 },
  ]
  cards.forEach(({ label, value, x, y }) => {
    roundedRect(ctx, x, y, 320, 72, 9)
    ctx.fillStyle = '#F7F9FB'
    ctx.fill()
    ctx.strokeStyle = LINE
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = MUTED
    font(ctx, 700, 8)
    ctx.fillText(label, x + 19, y + 28)
    ctx.fillStyle = TEXT
    font(ctx, 700, 11.5)
    writeWrapped(ctx, value, x + 19, y + 49, 282, 15, 2)
  })
}

function scopeLines(data: ProposalPdfData) {
  const first = data.items.slice(0, 4).map((item) => item.serviceName)
  if (!first.length) return ['Escopo conforme proposta comercial']
  if (data.items.length > 4) first[3] = `${first[3]} + ${data.items.length - 4} entrega(s) complementar(es)`
  return first
}

function drawScope(ctx: CanvasRenderingContext2D, data: ProposalPdfData, markDark: HTMLImageElement) {
  drawInternalBackground(ctx, data, markDark, 3)
  drawSectionHeader(ctx, '02 — Objeto e escopo', data.title || 'Projeto / serviço')

  ctx.fillStyle = BODY
  font(ctx, 400, 13.5)
  writeWrapped(ctx, data.description || 'Descrição executiva do projeto, problema a resolver, resultado esperado e contexto da contratação.', 68, 155, 658, 20, 4)

  ctx.fillStyle = TEXT
  font(ctx, 800, 14)
  ctx.fillText('Entregas contempladas', 68, 252)
  const deliveries = scopeLines(data)
  let y = 286
  deliveries.forEach((delivery) => {
    ctx.fillStyle = GREEN
    ctx.beginPath(); ctx.arc(75, y - 4, 3.5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = TEXT
    font(ctx, 600, 12.5)
    writeWrapped(ctx, delivery, 88, y, 620, 18, 2)
    y += 25
  })

  ctx.fillStyle = TEXT
  font(ctx, 800, 14)
  ctx.fillText('Fora do escopo', 68, 416)
  ctx.fillStyle = BODY
  font(ctx, 400, 12.5)
  ctx.fillText('• Itens e entregas não descritos nesta proposta.', 68, 449)
  ctx.fillText('• Dependências de terceiros não expressamente incluídas.', 68, 474)

  roundedRect(ctx, 68, 515, 658, 99, 10)
  ctx.fillStyle = SOFT
  ctx.fill()
  ctx.fillStyle = MUTED
  font(ctx, 700, 8)
  ctx.fillText('Premissas', 91, 544)
  ctx.fillStyle = BODY
  font(ctx, 400, 12.5)
  writeWrapped(ctx, 'Alterações fora do escopo deverão ser avaliadas e poderão gerar uma nova versão desta proposta.', 91, 569, 616, 19, 3)
}

type InvestmentRow = { serviceName: string; quantity: number; unitAmount: number; totalAmount: number }
function investmentRows(data: ProposalPdfData): InvestmentRow[] {
  if (data.items.length <= 3) return data.items.map((item) => ({ serviceName: item.serviceName, quantity: item.quantity, unitAmount: item.unitAmount, totalAmount: item.totalAmount }))
  const first = data.items.slice(0, 2).map((item) => ({ serviceName: item.serviceName, quantity: item.quantity, unitAmount: item.unitAmount, totalAmount: item.totalAmount }))
  const remaining = data.items.slice(2)
  const total = remaining.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0)
  first.push({ serviceName: `Outras entregas do escopo (${remaining.length})`, quantity: 1, unitAmount: total, totalAmount: total })
  return first
}

function fitTableText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, base = 10.5, min = 7.5) {
  let size = base
  while (size > min) {
    font(ctx, 600, size)
    if (ctx.measureText(text).width <= maxWidth) break
    size -= .5
  }
  ctx.fillText(text, 0, 0)
  return size
}

function drawInvestment(ctx: CanvasRenderingContext2D, data: ProposalPdfData, markDark: HTMLImageElement) {
  drawInternalBackground(ctx, data, markDark, 4)
  drawSectionHeader(ctx, '03 — Investimento', 'Composição comercial')

  const columns = [68, 147.97, 405.19, 483.98, 604.97, 726]
  const headers = ['Item', 'Descrição', 'Qtd.', 'Unitário', 'Total']
  for (let index = 0; index < 5; index += 1) {
    ctx.fillStyle = NAVY
    ctx.fillRect(columns[index], 134, columns[index + 1] - columns[index], 39)
    ctx.fillStyle = WHITE
    font(ctx, 800, 8.5)
    ctx.fillText(headers[index], columns[index] + 10, 158)
  }

  const rows = investmentRows(data)
  const rowTops = [173, 212.5, 252.5]
  rowTops.forEach((top, index) => {
    const item = rows[index]
    const height = index === 0 ? 39.5 : 40
    ctx.fillStyle = index % 2 === 0 ? WHITE : '#F7F9FB'
    ctx.fillRect(68, top, 658, height)
    ctx.strokeStyle = LINE
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(68, top + height); ctx.lineTo(726, top + height); ctx.stroke()
    if (!item) return

    ctx.fillStyle = TEXT
    font(ctx, 700, 9.5)
    ctx.fillText(String(index + 1).padStart(2, '0'), 79, top + 25)

    ctx.save()
    ctx.translate(158, top + 25)
    fitTableText(ctx, item.serviceName, 236)
    ctx.restore()

    ctx.fillStyle = TEXT
    font(ctx, 600, 9.5)
    ctx.fillText(String(item.quantity).replace('.', ','), 416, top + 25)
    font(ctx, 600, 8.8)
    ctx.fillText(brl.format(item.unitAmount), 493, top + 25)
    ctx.fillText(brl.format(item.totalAmount), 614, top + 25)
  })

  roundedRect(ctx, 68, 324, 320, 171, 10)
  ctx.fillStyle = SOFT
  ctx.fill()
  const summary = [
    ['Subtotal', brl.format(data.subtotal), 351, 368],
    ['Desconto', `${percent.format(data.discountPercent)}% — ${brl.format(data.discountAmount)}`, 404, 421],
    ['Impostos', `${percent.format(data.taxPercent)}% — ${brl.format(data.taxAmount)}`, 457, 474],
  ] as const
  summary.forEach(([label, value, labelY, valueY]) => {
    ctx.fillStyle = MUTED
    font(ctx, 700, 8)
    ctx.fillText(label, 92, labelY)
    ctx.fillStyle = TEXT
    font(ctx, 700, 11.5)
    ctx.fillText(value, 92, valueY)
  })

  roundedRect(ctx, 406, 412, 296, 83, 10)
  ctx.fillStyle = NAVY
  ctx.fill()
  ctx.fillStyle = '#AFC0CF'
  font(ctx, 800, 8)
  ctx.fillText('Valor final', 428, 441)
  ctx.fillStyle = GREEN_LIGHT
  font(ctx, 900, 25)
  ctx.fillText(brl.format(data.finalAmount), 428, 476)
}

function visibleInstallments(data: ProposalPdfData) {
  const all = data.installments.length ? data.installments : [{ installmentNumber: 1, amount: data.finalAmount, dueDate: data.validUntil }]
  return { all, visible: all.slice(0, 3) }
}

function drawConditions(ctx: CanvasRenderingContext2D, data: ProposalPdfData, markDark: HTMLImageElement) {
  drawInternalBackground(ctx, data, markDark, 5)
  drawSectionHeader(ctx, '04 — Condições comerciais', 'Pagamento, prazo e validade')

  const cards = [
    { label: 'Condição', value: data.paymentMode === 'cash' ? 'À vista' : `${Math.max(1, data.installments.length)} parcelas`, x: 68, y: 136 },
    { label: 'Forma', value: data.paymentMethod || 'Conforme negociação registrada', x: 406, y: 136 },
    { label: 'Validade', value: `Até ${date(data.validUntil)}`, x: 68, y: 227 },
    { label: 'Prazo estimado', value: data.estimatedDeadline || 'Conforme cronograma acordado', x: 406, y: 227 },
  ]
  cards.forEach(({ label, value, x, y }) => {
    roundedRect(ctx, x, y, 320, 72, 9)
    ctx.fillStyle = '#F7F9FB'
    ctx.fill()
    ctx.strokeStyle = LINE
    ctx.stroke()
    ctx.fillStyle = MUTED
    font(ctx, 700, 8)
    ctx.fillText(label, x + 19, y + 29)
    ctx.fillStyle = TEXT
    font(ctx, 700, 11.5)
    writeWrapped(ctx, value, x + 19, y + 50, 282, 15, 2)
  })

  ctx.fillStyle = TEXT
  font(ctx, 800, 14)
  ctx.fillText('Parcelamento previsto', 68, 349)

  const cols = [68, 250.47, 449.81, 726]
  const heads = ['Parcela', 'Valor', 'Vencimento']
  for (let index = 0; index < 3; index += 1) {
    ctx.fillStyle = NAVY
    ctx.fillRect(cols[index], 357, cols[index + 1] - cols[index], 39)
    ctx.fillStyle = WHITE
    font(ctx, 800, 8.5)
    ctx.fillText(heads[index], cols[index] + 12, 381)
  }

  const { all, visible } = visibleInstallments(data)
  const rowTops = [396, 435.5, 475.5]
  rowTops.forEach((top, index) => {
    const installment = visible[index]
    const height = index === 0 ? 39.5 : 40
    ctx.fillStyle = index % 2 === 0 ? WHITE : '#F7F9FB'
    ctx.fillRect(68, top, 658, height)
    ctx.strokeStyle = LINE
    ctx.beginPath(); ctx.moveTo(68, top + height); ctx.lineTo(726, top + height); ctx.stroke()
    if (!installment) return
    ctx.fillStyle = TEXT
    font(ctx, 700, 9.5)
    ctx.fillText(`${installment.installmentNumber}/${all.length}`, 80, top + 25)
    ctx.fillText(brl.format(installment.amount), 263, top + 25)
    ctx.fillText(date(installment.dueDate), 462, top + 25)
  })

  if (all.length > 3) {
    ctx.fillStyle = MUTED
    font(ctx, 500, 8.5)
    ctx.fillText(`+ ${all.length - 3} parcela(s) adicional(is) conforme cronograma comercial registrado.`, 68, 538)
  }

  roundedRect(ctx, 68, 546, 658, 100, 9)
  ctx.fillStyle = SOFT
  ctx.fill()
  ctx.fillStyle = MUTED
  font(ctx, 700, 8)
  ctx.fillText('Observações comerciais', 87, 575)
  ctx.fillStyle = BODY
  font(ctx, 400, 11.5)
  writeWrapped(ctx, data.customerNotes || 'Sem observações comerciais adicionais registradas.', 87, 600, 620, 17, 3)
}

function drawAcceptance(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logoDark: HTMLImageElement, markDark: HTMLImageElement) {
  drawInternalBackground(ctx, data, markDark, 6)
  drawSectionHeader(ctx, '05 — Aceite', 'Confirmação da proposta')

  ctx.fillStyle = BODY
  font(ctx, 400, 13.5)
  writeWrapped(ctx, 'Ao aprovar esta proposta, o cliente declara estar de acordo com o escopo, investimento, condições de pagamento, prazos e demais condições registradas nesta versão.', 68, 155, 658, 20, 5)

  roundedRect(ctx, 68, 246, 658, 73, 9)
  ctx.fillStyle = '#F7F9FB'
  ctx.fill()
  ctx.fillStyle = MUTED
  font(ctx, 700, 8)
  ctx.fillText('Cliente', 87, 278)
  ctx.fillStyle = TEXT
  font(ctx, 700, 11.5)
  ctx.fillText(clientName(data), 87, 301)

  roundedRect(ctx, 68, 330, 658, 73, 9)
  ctx.fillStyle = '#F7F9FB'
  ctx.fill()
  ctx.fillStyle = MUTED
  font(ctx, 700, 8)
  ctx.fillText('Proposta aprovada', 87, 362)
  ctx.fillStyle = TEXT
  font(ctx, 700, 11.5)
  ctx.fillText(`${data.proposalNumber} • Versão ${versionLabel(data.version)}`, 87, 385)

  ctx.fillStyle = MUTED
  font(ctx, 700, 8)
  ctx.fillText('Responsável pelo cliente', 89, 471)
  ctx.fillText('Data do aceite', 427, 471)
  ctx.strokeStyle = '#A9B7C4'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(89, 522); ctx.lineTo(367, 522); ctx.moveTo(427, 522); ctx.lineTo(705, 522); ctx.stroke()
  ctx.fillStyle = BODY
  font(ctx, 500, 10.5)
  ctx.fillText('Nome / assinatura', 89, 553)
  ctx.fillText('____ / ____ / ______', 427, 553)

  drawImage(ctx, logoDark, 96, 654.03, 190, 113.4989)
  ctx.fillStyle = TEXT
  font(ctx, 800, 12)
  ctx.fillText('HRX Solutions', 521.56, 709.89)
  ctx.fillStyle = BODY
  font(ctx, 500, 8.5)
  writeWrapped(ctx, `${COMPANY_CNPJ} • ${COMPANY_EMAIL} • ${COMPANY_SITE}`, 521.56, 728.89, 176.44, 12, 3)

  // O rodapé da página de aceite usa a legenda específica do arquivo aprovado.
  ctx.fillStyle = WHITE
  ctx.fillRect(60, FOOTER_Y - 14, 675, 24)
  ctx.fillStyle = '#768A9D'
  font(ctx, 500, 7.5)
  ctx.fillText('Documento comercial HRX Solutions', 68, FOOTER_Y)
  ctx.textAlign = 'right'
  ctx.fillText(`${data.proposalNumber} • v${versionLabel(data.version)} • 6/6`, 726, FOOTER_Y)
  ctx.textAlign = 'left'
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
  const images = canvases.map((canvas) => base64Bytes(canvas.toDataURL('image/jpeg', .97)))
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
    const canvas = canvases[index]
    objects.set(pageId, encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`))
    objects.set(imageId, concat([encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`), image, encoder.encode('\nendstream')]))
    objects.set(contentId, concat([encoder.encode(`<< /Length ${content.length} >>\nstream\n`), content, encoder.encode('\nendstream')]))
  })

  const parts: Uint8Array[] = [encoder.encode('%PDF-1.4\n%HRX\n')]
  const offsets = [0]
  let length = parts[0].length
  for (let id = 1; id <= objectCount; id += 1) {
    offsets[id] = length
    const object = concat([encoder.encode(`${id} 0 obj\n`), objects.get(id)!, encoder.encode('\nendobj\n')])
    parts.push(object)
    length += object.length
  }
  const xrefOffset = length
  const xref = ['xref', `0 ${objectCount + 1}`, '0000000000 65535 f ']
  for (let id = 1; id <= objectCount; id += 1) xref.push(`${String(offsets[id]).padStart(10, '0')} 00000 n `)
  xref.push('trailer', `<< /Size ${objectCount + 1} /Root 1 0 R >>`, 'startxref', String(xrefOffset), '%%EOF')
  parts.push(encoder.encode(`${xref.join('\n')}\n`))
  return new Blob([concat(parts)], { type: 'application/pdf' })
}

export async function generateProposalPdf(data: ProposalPdfData) {
  const { logoLight, logoDark, markDark } = await loadBrandAssets()
  const canvases: HTMLCanvasElement[] = []

  const page1 = pageCanvas(); drawCover(page1.getContext('2d')!, data, logoLight); canvases.push(page1)
  const page2 = pageCanvas(); drawPresentation(page2.getContext('2d')!, data, logoDark, markDark); canvases.push(page2)
  const page3 = pageCanvas(); drawScope(page3.getContext('2d')!, data, markDark); canvases.push(page3)
  const page4 = pageCanvas(); drawInvestment(page4.getContext('2d')!, data, markDark); canvases.push(page4)
  const page5 = pageCanvas(); drawConditions(page5.getContext('2d')!, data, markDark); canvases.push(page5)
  const page6 = pageCanvas(); drawAcceptance(page6.getContext('2d')!, data, logoDark, markDark); canvases.push(page6)

  return canvasesToPdf(canvases)
}
