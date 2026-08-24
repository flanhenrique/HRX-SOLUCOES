import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../src/quotes/proposalPdf.ts', import.meta.url), 'utf8')

test('template comercial preserva as seis paginas canonicas', () => {
  assert.match(source, /const page1 = pageCanvas\(\); drawCover/)
  assert.match(source, /const page6 = pageCanvas\(\); drawAcceptance/)
  assert.match(source, /Design ID: DAHTJI6gD7s/)
})

test('conteudo excedente gera anexos em vez de ser omitido', () => {
  assert.match(source, /function appendDetailAnnexes/)
  assert.match(source, /data\.items\.length > 3 \? chunks\(data\.items/)
  assert.match(source, /allInstallments\.length > 3 \? chunks\(allInstallments/)
  assert.match(source, /drawItemsAnnex/)
  assert.match(source, /drawInstallmentsAnnex/)
  assert.match(source, /appendDetailAnnexes\(canvases, data, markDark\)/)
})

test('anexo de itens imprime descricao quantidade valores e total', () => {
  for (const token of ['item.serviceName', 'item.description', 'item.quantity', 'item.unitAmount', 'item.totalAmount']) {
    assert.ok(source.includes(token), `campo ausente do anexo: ${token}`)
  }
})
