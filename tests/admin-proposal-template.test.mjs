import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('proposal PDF follows the exact approved Canva model geometry', async () => {
  const pdf = await read('src/quotes/proposalPdf.ts')

  assert.match(pdf, /Design ID: DAHTJI6gD7s/)
  assert.match(pdf, /const W = 794\b/)
  assert.match(pdf, /const H = 1123\b/)
  assert.match(pdf, /const FOOTER_Y = 1082\b/)

  for (const title of [
    '01 — Apresentação',
    '02 — Objeto e escopo',
    '03 — Investimento',
    '04 — Condições comerciais',
    '05 — Aceite',
  ]) assert.ok(pdf.includes(title), `seção canônica ausente: ${title}`)

  assert.match(pdf, /drawImage\(ctx, logoLight, 68, 70, 182, 108\.72\)/)
  assert.match(pdf, /drawImage\(ctx, logoDark, 68, 96, 190, 113\.4989\)/)
  assert.match(pdf, /ctx\.drawImage\(markDark, 486, 925, 240, 103\.56\)/)
  assert.match(pdf, /drawImage\(ctx, logoDark, 96, 654\.03, 190, 113\.4989\)/)

  assert.match(pdf, /const rowTops = \[173, 212\.5, 252\.5\]/)
  assert.match(pdf, /const rowTops = \[396, 435\.5, 475\.5\]/)
  assert.match(pdf, /'Documento comercial HRX Solutions'/)

  assert.doesNotMatch(pdf, /fillRect\(0, 0, 18, H\)/, 'barra lateral inventada não pode voltar')
  assert.doesNotMatch(pdf, /Referência comercial oficial da entrega após aprovação\./, 'fechamento inventado não pertence ao modelo')
})

test('proposal PDF always renders the six canonical pages in approved order', async () => {
  const pdf = await read('src/quotes/proposalPdf.ts')
  const sequence = ['drawCover(', 'drawPresentation(', 'drawScope(', 'drawInvestment(', 'drawConditions(', 'drawAcceptance(']
  let cursor = pdf.indexOf('export async function generateProposalPdf')
  assert.ok(cursor >= 0)
  for (const call of sequence) {
    const next = pdf.indexOf(call, cursor)
    assert.ok(next > cursor, `página fora de ordem ou ausente: ${call}`)
    cursor = next
  }
  assert.match(pdf, /return canvasesToPdf\(canvases\)/)
})

test('approved document uses HRX dark-on-light brand assets on internal pages', async () => {
  const [pdf, logo, mark] = await Promise.all([
    read('src/quotes/proposalPdf.ts'),
    read('public/hrx-logo-dark.svg'),
    read('public/hrx-mark-dark.svg'),
  ])

  assert.match(pdf, /loadImage\('hrx-logo-dark\.svg'\)/)
  assert.match(pdf, /loadImage\('hrx-mark-dark\.svg'\)/)
  assert.match(logo, /#07182d/i)
  assert.match(logo, /#24b96d/i)
  assert.match(mark, /#07182d/i)
  assert.match(mark, /#24b96d/i)
})
