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
const M = 78
const FOOTER_Y = 1660
const NAVY = '#07182D'
const NAVY_2 = '#102C45'
const GREEN = '#24B96D'
const GREEN_LIGHT = '#62D98A'
const BLUE = '#377FE8'
const TEXT = '#102235'
const BODY = '#52697D'
const MUTED = '#778A9B'
const LINE = '#DCE5ED'
const SOFT = '#F3F7FA'
const WHITE = '#FFFFFF'
const encoder = new TextEncoder()

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const percent = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const formatDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')

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
  return y + lines.length * lineHeight
}

function drawDraftWatermark(ctx: CanvasRenderingContext2D, data: ProposalPdfData) {
  if (!data.draft) return
  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.rotate(-Math.PI / 5)
  ctx.globalAlpha = 0.045
  ctx.fillStyle = NAVY
  ctx.font = '800 148px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('RASCUNHO', 0, 0)
  ctx.restore()
  ctx.textAlign = 'left'
}

function drawLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement, x: number, y: number, width: number, height: number, light = false) {
  if (logo.complete && logo.naturalWidth) {
    ctx.drawImage(logo, x, y, width, height)
    return
  }
  ctx.fillStyle = light ? WHITE : NAVY
  ctx.font = '800 44px Arial'
  ctx.fillText('HRX', x, y + 52)
  ctx.fillStyle = GREEN
  ctx.font = '700 17px Arial'
  ctx.fillText('SOLUTIONS', x + 92, y + 52)
}

function drawFooter(ctx: CanvasRenderingContext2D, data: ProposalPdfData, page: number, pages: number) {
  ctx.strokeStyle = LINE
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(M, FOOTER_Y)
  ctx.lineTo(W - M, FOOTER_Y)
  ctx.stroke()

  ctx.fillStyle = MUTED
  ctx.font = '500 14px Arial'
  ctx.fillText('HRX SOLUTIONS  •  PROPOSTA COMERCIAL', M, FOOTER_Y + 35)
  ctx.fillStyle = '#8EA0AF'
  ctx.font = '500 13px Arial'
  ctx.fillText(`${data.proposalNumber}  •  Versão ${data.version}`, M, FOOTER_Y + 62)
  ctx.textAlign = 'right'
  ctx.fillStyle = BODY
  ctx.font = '700 13px Arial'
  ctx.fillText(`${page} / ${pages}`, W - M, FOOTER_Y + 48)
  ctx.textAlign = 'left'
}

function drawPageHeader(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, page: number, pages: number, kicker: string, title: string) {
  ctx.fillStyle = WHITE
  ctx.fillRect(0, 0, W, H)

  drawLogo(ctx, logo, M, 40, 178, 106)
  ctx.textAlign = 'right'
  ctx.fillStyle = TEXT
  ctx.font = '700 15px Arial'
  ctx.fillText(data.proposalNumber, W - M, 72)
  ctx.fillStyle = MUTED
  ctx.font = '500 14px Arial'
  ctx.fillText(`Versão ${data.version}  •  ${formatDate(data.createdAt)}`, W - M, 100)
  ctx.textAlign = 'left'

  ctx.fillStyle = GREEN
  ctx.fillRect(M, 166, 86, 5)
  ctx.fillStyle = '#DCE8F2'
  ctx.fillRect(M + 86, 166, W - M * 2 - 86, 1)

  ctx.fillStyle = GREEN
  ctx.font = '800 14px Arial'
  ctx.fillText(kicker.toUpperCase(), M, 230)
  ctx.fillStyle = NAVY
  ctx.font = '800 34px Arial'
  ctx.fillText(title, M, 278)

  drawDraftWatermark(ctx, data)
  drawFooter(ctx, data, page, pages)
}

function drawCover(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, mark: HTMLImageElement, pages: number) {
  const gradient = ctx.createLinearGradient(0, 0, W, H)
  gradient.addColorStop(0, '#061426')
  gradient.addColorStop(.72, '#081C32')
  gradient.addColorStop(1, '#0B2742')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = GREEN
  ctx.fillRect(0, 0, 14, H)
  ctx.fillStyle = 'rgba(36,185,109,.13)'
  ctx.beginPath()
  ctx.moveTo(W, 0)
  ctx.lineTo(W, 440)
  ctx.lineTo(930, 0)
  ctx.closePath()
  ctx.fill()

  if (mark.complete && mark.naturalWidth) {
    ctx.save()
    ctx.globalAlpha = .07
    ctx.drawImage(mark, 670, 1160, 610, 250)
    ctx.restore()
  }

  drawLogo(ctx, logo, M, 58, 245, 146, true)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#DCE6F0'
  ctx.font = '700 16px Arial'
  ctx.fillText(data.proposalNumber, W - M, 82)
  ctx.fillStyle = '#92A7BB'
  ctx.font = '500 14px Arial'
  ctx.fillText(`Versão ${data.version}  •  ${formatDate(data.createdAt)}`, W - M, 111)
  ctx.textAlign = 'left'

  ctx.fillStyle = GREEN_LIGHT
  ctx.font = '800 16px Arial'
  ctx.fillText(data.draft ? 'ORÇAMENTO EM ELABORAÇÃO' : 'PROPOSTA COMERCIAL', M, 360)

  ctx.fillStyle = WHITE
  ctx.font = '800 50px Arial'
  const titleBottom = writeWrapped(ctx, data.title || 'Proposta Comercial', M, 432, 870, 61, 4)
  ctx.fillStyle = '#AFC0D1'
  ctx.font = '400 19px Arial'
  writeWrapped(ctx, data.description || 'Solução estruturada pela HRX Solutions conforme o escopo, investimento e condições desta proposta.', M, titleBottom + 28, 820, 30, 5)

  const clientY = 790
  ctx.strokeStyle = 'rgba(255,255,255,.14)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(M, clientY)
  ctx.lineTo(W - M, clientY)
  ctx.stroke()

  ctx.fillStyle = '#8FA8BE'
  ctx.font = '800 13px Arial'
  ctx.fillText('PREPARADO PARA', M, clientY + 50)
  ctx.fillStyle = WHITE
  ctx.font = '800 28px Arial'
  ctx.fillText(data.client.company || data.client.name, M, clientY + 94)
  if (data.client.company) {
    ctx.fillStyle = '#B0C0CF'
    ctx.font = '500 17px Arial'
    ctx.fillText(data.client.name, M, clientY + 126)
  }

  ctx.fillStyle = '#90A6B9'
  ctx.font = '500 15px Arial'
  const contact = [data.client.document, data.client.email, data.client.phone].filter(Boolean).join('  •  ')
  if (contact) ctx.fillText(contact, M, clientY + 162)

  const infoY = 1080
  const infoWidth = 335
  const info = [
    ['INVESTIMENTO', brl.format(data.finalAmount)],
    ['CONDIÇÃO', data.paymentMode === 'cash' ? 'À vista' : `${Math.max(1, data.installments.length)} parcelas`],
    ['VALIDADE', formatDate(data.validUntil)],
  ]
  info.forEach(([label, value], index) => {
    const x = M + index * (infoWidth + 28)
    ctx.fillStyle = label === 'INVESTIMENTO' ? GREEN_LIGHT : '#8FA8BE'
    ctx.font = '800 12px Arial'
    ctx.fillText(label, x, infoY)
    ctx.fillStyle = WHITE
    ctx.font = label === 'INVESTIMENTO' ? '800 25px Arial' : '700 20px Arial'
    ctx.fillText(value, x, infoY + 43)
  })

  ctx.fillStyle = '#8199AF'
  ctx.font = '500 13px Arial'
  ctx.fillText(`Protocolo ${data.protocol}`, M, 1560)
  ctx.textAlign = 'right'
  ctx.fillText(`1 / ${pages}`, W - M, 1560)
  ctx.textAlign = 'left'
  drawDraftWatermark(ctx, data)
}

function drawScopePage(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, page: number, pages: number) {
  drawPageHeader(ctx, data, logo, page, pages, 'Escopo e entregas', 'Objeto da proposta')
  let y = 350

  ctx.fillStyle = TEXT
  ctx.font = '800 19px Arial'
  ctx.fillText('Projeto / serviço', M, y)
  ctx.fillStyle = BODY
  ctx.font = '400 18px Arial'
  y = writeWrapped(ctx, data.description || data.title || 'Escopo conforme composição comercial desta proposta.', M, y + 42, W - M * 2, 30, 9) + 45

  ctx.fillStyle = SOFT
  roundedRect(ctx, M, y, W - M * 2, 56, 10)
  ctx.fill()
  ctx.fillStyle = NAVY
  ctx.font = '800 15px Arial'
  ctx.fillText('ENTREGAS CONTEMPLADAS', M + 20, y + 35)
  y += 82

  const scopeItems = data.items.slice(0, 10)
  if (!scopeItems.length) scopeItems.push({ serviceName: 'Escopo conforme proposta', unitLabel: 'un.', quantity: 1, unitAmount: 0, totalAmount: 0 })
  for (const item of scopeItems) {
    ctx.fillStyle = GREEN
    ctx.beginPath()
    ctx.arc(M + 8, y - 5, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = TEXT
    ctx.font = '700 17px Arial'
    ctx.fillText(item.serviceName, M + 28, y)
    if (item.description) {
      ctx.fillStyle = BODY
      ctx.font = '400 15px Arial'
      const bottom = writeWrapped(ctx, item.description, M + 28, y + 27, W - M * 2 - 28, 23, 3)
      y = bottom + 31
    } else y += 44
    if (y > 1450) break
  }

  const noteY = Math.min(Math.max(y + 30, 1210), 1450)
  roundedRect(ctx, M, noteY, W - M * 2, 168, 16)
  ctx.fillStyle = '#F7FAFC'
  ctx.fill()
  ctx.strokeStyle = LINE
  ctx.stroke()
  ctx.fillStyle = NAVY
  ctx.font = '800 17px Arial'
  ctx.fillText('Premissa comercial', M + 24, noteY + 42)
  ctx.fillStyle = BODY
  ctx.font = '400 15px Arial'
  writeWrapped(ctx, 'Necessidades adicionais, alterações relevantes ou ampliações de escopo serão avaliadas antes da execução e podem exigir uma nova versão desta proposta.', M + 24, noteY + 77, W - M * 2 - 48, 24, 4)
}

function drawInvestmentPage(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, page: number, pages: number, items: ProposalPdfItem[], first: boolean) {
  drawPageHeader(ctx, data, logo, page, pages, 'Composição comercial', first ? 'Investimento' : 'Investimento — continuação')
  const tableX = M
  const tableW = W - M * 2
  let y = 348

  ctx.fillStyle = NAVY
  ctx.fillRect(tableX, y, tableW, 52)
  ctx.fillStyle = WHITE
  ctx.font = '800 13px Arial'
  ctx.fillText('ITEM / DESCRIÇÃO', tableX + 18, y + 32)
  ctx.fillText('QTD.', 770, y + 32)
  ctx.fillText('UNITÁRIO', 882, y + 32)
  ctx.fillText('TOTAL', 1052, y + 32)
  y += 52

  for (const item of items) {
    const rowH = item.description ? 92 : 72
    ctx.fillStyle = WHITE
    ctx.fillRect(tableX, y, tableW, rowH)
    ctx.strokeStyle = LINE
    ctx.beginPath()
    ctx.moveTo(tableX, y + rowH)
    ctx.lineTo(tableX + tableW, y + rowH)
    ctx.stroke()
    ctx.fillStyle = TEXT
    ctx.font = '700 16px Arial'
    ctx.fillText(item.serviceName, tableX + 18, y + 28)
    if (item.description) {
      ctx.fillStyle = MUTED
      ctx.font = '400 13px Arial'
      writeWrapped(ctx, item.description, tableX + 18, y + 53, 610, 18, 2)
    }
    ctx.fillStyle = BODY
    ctx.font = '500 15px Arial'
    ctx.fillText(`${item.quantity.toLocaleString('pt-BR')} ${item.unitLabel}`, 770, y + 42)
    ctx.fillText(brl.format(item.unitAmount), 882, y + 42)
    ctx.fillStyle = TEXT
    ctx.font = '700 15px Arial'
    ctx.fillText(brl.format(item.totalAmount), 1052, y + 42)
    y += rowH
  }

  if (!first) return
  const summaryY = Math.max(y + 42, 1080)
  const summaryX = 668
  const summaryW = W - M - summaryX
  roundedRect(ctx, summaryX, summaryY, summaryW, 304, 18)
  ctx.fillStyle = SOFT
  ctx.fill()

  const rows = [
    ['Subtotal', brl.format(data.subtotal)],
    [`Desconto (${percent.format(data.discountPercent)}%)`, `− ${brl.format(data.discountAmount)}`],
    [`Impostos (${percent.format(data.taxPercent)}%)`, `+ ${brl.format(data.taxAmount)}`],
  ]
  rows.forEach(([label, value], index) => {
    const yy = summaryY + 46 + index * 50
    ctx.fillStyle = BODY
    ctx.font = '600 16px Arial'
    ctx.fillText(label, summaryX + 24, yy)
    ctx.textAlign = 'right'
    ctx.fillStyle = TEXT
    ctx.fillText(value, summaryX + summaryW - 24, yy)
    ctx.textAlign = 'left'
  })
  ctx.strokeStyle = '#CAD7E2'
  ctx.beginPath()
  ctx.moveTo(summaryX + 24, summaryY + 199)
  ctx.lineTo(summaryX + summaryW - 24, summaryY + 199)
  ctx.stroke()
  ctx.fillStyle = NAVY
  ctx.font = '800 19px Arial'
  ctx.fillText('Valor final', summaryX + 24, summaryY + 254)
  ctx.fillStyle = GREEN
  ctx.font = '800 27px Arial'
  ctx.textAlign = 'right'
  ctx.fillText(brl.format(data.finalAmount), summaryX + summaryW - 24, summaryY + 256)
  ctx.textAlign = 'left'
}

function drawPaymentPage(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, page: number, pages: number) {
  drawPageHeader(ctx, data, logo, page, pages, 'Prazos e vencimentos', 'Condições de pagamento')
  let y = 348
  const info = [
    ['FORMA DE PAGAMENTO', data.paymentMode === 'cash' ? 'À vista' : 'Parcelado'],
    ['PARCELAS PREVISTAS', String(Math.max(1, data.installments.length))],
    ['VALIDADE', formatDate(data.validUntil)],
  ]
  info.forEach(([label, value], index) => {
    const x = M + index * 360
    ctx.fillStyle = label === 'FORMA DE PAGAMENTO' ? GREEN : BLUE
    ctx.font = '800 12px Arial'
    ctx.fillText(label, x, y)
    ctx.fillStyle = TEXT
    ctx.font = '800 21px Arial'
    ctx.fillText(value, x, y + 38)
  })

  y += 122
  ctx.fillStyle = TEXT
  ctx.font = '800 20px Arial'
  ctx.fillText('Cronograma previsto', M, y)
  ctx.fillStyle = BODY
  ctx.font = '400 15px Arial'
  ctx.fillText('Os vencimentos refletem a condição comercial registrada nesta versão.', M, y + 30)
  y += 65

  const schedule = data.installments.length ? data.installments : [{ installmentNumber: 1, amount: data.finalAmount, dueDate: data.validUntil }]
  const columns = schedule.length > 12 ? [schedule.slice(0, 12), schedule.slice(12)] : [schedule]
  columns.forEach((column, columnIndex) => {
    const width = columns.length === 1 ? W - M * 2 : 516
    const x = M + columnIndex * 548
    let yy = y
    ctx.fillStyle = NAVY
    ctx.fillRect(x, yy, width, 44)
    ctx.fillStyle = WHITE
    ctx.font = '800 12px Arial'
    ctx.fillText('PARCELA', x + 15, yy + 28)
    ctx.fillText('VENCIMENTO', x + 142, yy + 28)
    ctx.textAlign = 'right'
    ctx.fillText('VALOR', x + width - 15, yy + 28)
    ctx.textAlign = 'left'
    yy += 44
    column.forEach((installment) => {
      ctx.fillStyle = WHITE
      ctx.fillRect(x, yy, width, 58)
      ctx.strokeStyle = LINE
      ctx.beginPath()
      ctx.moveTo(x, yy + 58)
      ctx.lineTo(x + width, yy + 58)
      ctx.stroke()
      ctx.fillStyle = TEXT
      ctx.font = '700 15px Arial'
      ctx.fillText(`${installment.installmentNumber}/${schedule.length}`, x + 15, yy + 36)
      ctx.fillStyle = BODY
      ctx.font = '500 15px Arial'
      ctx.fillText(formatDate(installment.dueDate), x + 142, yy + 36)
      ctx.textAlign = 'right'
      ctx.fillStyle = TEXT
      ctx.font = '700 15px Arial'
      ctx.fillText(brl.format(installment.amount), x + width - 15, yy + 36)
      ctx.textAlign = 'left'
      yy += 58
    })
  })
}

function drawConditionsPage(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, page: number, pages: number) {
  drawPageHeader(ctx, data, logo, page, pages, 'Condições gerais', 'Validade e observações')
  let y = 350

  ctx.fillStyle = GREEN
  ctx.font = '800 13px Arial'
  ctx.fillText('VALIDADE DA PROPOSTA', M, y)
  ctx.fillStyle = NAVY
  ctx.font = '800 27px Arial'
  ctx.fillText(`Válida até ${formatDate(data.validUntil)}`, M, y + 43)
  ctx.fillStyle = BODY
  ctx.font = '400 16px Arial'
  writeWrapped(ctx, 'Após esta data, valores, disponibilidade, prazos e demais condições poderão ser revistos antes de uma nova aprovação.', M, y + 82, W - M * 2, 26, 4)

  y += 190
  ctx.strokeStyle = LINE
  ctx.beginPath()
  ctx.moveTo(M, y)
  ctx.lineTo(W - M, y)
  ctx.stroke()
  y += 55

  ctx.fillStyle = NAVY
  ctx.font = '800 19px Arial'
  ctx.fillText('Observações', M, y)
  ctx.fillStyle = BODY
  ctx.font = '400 16px Arial'
  y = writeWrapped(ctx, data.customerNotes || 'Sem observações adicionais registradas para esta proposta.', M, y + 38, W - M * 2, 27, 10) + 58

  ctx.fillStyle = SOFT
  roundedRect(ctx, M, y, W - M * 2, 300, 18)
  ctx.fill()
  ctx.fillStyle = NAVY
  ctx.font = '800 18px Arial'
  ctx.fillText('Condições gerais', M + 25, y + 46)

  const conditions = [
    'Atividades adicionais ou mudanças de escopo serão previamente avaliadas e orçadas quando necessário.',
    'A execução considera as premissas, acessos, informações e dependências descritas nesta versão.',
    'Licenças, serviços de terceiros e itens não explicitamente incluídos não integram o investimento, salvo indicação expressa.',
  ]
  conditions.forEach((condition, index) => {
    const yy = y + 93 + index * 64
    ctx.fillStyle = GREEN
    ctx.beginPath()
    ctx.arc(M + 33, yy - 5, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = BODY
    ctx.font = '400 15px Arial'
    writeWrapped(ctx, condition, M + 54, yy, W - M * 2 - 82, 23, 2)
  })
}

function drawAcceptancePage(ctx: CanvasRenderingContext2D, data: ProposalPdfData, logo: HTMLImageElement, page: number, pages: number) {
  drawPageHeader(ctx, data, logo, page, pages, 'Confirmação comercial', 'Aceite')
  let y = 350

  ctx.fillStyle = BODY
  ctx.font = '400 17px Arial'
  y = writeWrapped(ctx, 'Ao aprovar esta proposta, o cliente declara estar de acordo com o escopo, investimento, condições de pagamento, validade e demais condições desta versão.', M, y, W - M * 2, 29, 6) + 60

  const rows = [
    ['CLIENTE', data.client.company || data.client.name],
    ['RESPONSÁVEL', data.client.name],
    ['DOCUMENTO', data.client.document || '—'],
    ['PROPOSTA', `${data.proposalNumber}  •  Versão ${data.version}`],
  ]
  rows.forEach(([label, value]) => {
    ctx.fillStyle = MUTED
    ctx.font = '800 12px Arial'
    ctx.fillText(label, M, y)
    ctx.fillStyle = TEXT
    ctx.font = '700 18px Arial'
    ctx.fillText(value, M, y + 30)
    ctx.strokeStyle = LINE
    ctx.beginPath()
    ctx.moveTo(M, y + 55)
    ctx.lineTo(W - M, y + 55)
    ctx.stroke()
    y += 88
  })

  y += 85
  ctx.strokeStyle = '#9FAFBD'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(M, y)
  ctx.lineTo(610, y)
  ctx.moveTo(700, y)
  ctx.lineTo(W - M, y)
  ctx.stroke()
  ctx.fillStyle = MUTED
  ctx.font = '500 13px Arial'
  ctx.fillText('Assinatura / aceite do responsável', M, y + 30)
  ctx.fillText('Data', 700, y + 30)

  const closingY = 1275
  ctx.fillStyle = NAVY
  roundedRect(ctx, M, closingY, W - M * 2, 188, 18)
  ctx.fill()
  ctx.fillStyle = WHITE
  ctx.font = '800 21px Arial'
  ctx.fillText('HRX Solutions', M + 28, closingY + 52)
  ctx.fillStyle = '#AFC1D1'
  ctx.font = '400 15px Arial'
  ctx.fillText('Documento comercial versionado pelo ambiente administrativo HRX.', M + 28, closingY + 88)
  ctx.fillText(`Protocolo ${data.protocol}`, M + 28, closingY + 119)
  ctx.fillStyle = GREEN_LIGHT
  ctx.font = '700 14px Arial'
  ctx.fillText('Soluções digitais pensadas para operações reais.', M + 28, closingY + 151)
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
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
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
    const pageId = 3 + index * 3
    const imageId = pageId + 1
    const contentId = pageId + 2
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
    parts.push(object)
    length += object.length
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

  const cover = pageCanvas()
  drawCover(cover.getContext('2d')!, data, logo, mark, totalPages)
  canvases.push(cover)

  const scope = pageCanvas()
  drawScopePage(scope.getContext('2d')!, data, logo, 2, totalPages)
  canvases.push(scope)

  itemChunks.forEach((items, index) => {
    const canvas = pageCanvas()
    drawInvestmentPage(canvas.getContext('2d')!, data, logo, 3 + index, totalPages, items, index === 0)
    canvases.push(canvas)
  })

  let page = 3 + itemChunks.length
  const payment = pageCanvas()
  drawPaymentPage(payment.getContext('2d')!, data, logo, page, totalPages)
  canvases.push(payment)

  page += 1
  const conditions = pageCanvas()
  drawConditionsPage(conditions.getContext('2d')!, data, logo, page, totalPages)
  canvases.push(conditions)

  page += 1
  const acceptance = pageCanvas()
  drawAcceptancePage(acceptance.getContext('2d')!, data, logo, page, totalPages)
  canvases.push(acceptance)

  return canvasesToPdf(canvases)
}
