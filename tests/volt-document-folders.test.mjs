import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/quotes/VoltDocumentFolders.tsx', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')

test('VOLT controlled documents are presented in eight internal folders', () => {
  for (const folder of [
    '01 · Governança e Visão',
    '02 · Arquitetura e Decisões',
    '03 · Produto e PRDs',
    '04 · Dados e Segurança',
    '05 · Operações',
    '06 · Design e Experiência',
    '07 · Auditoria e Conformidade',
    '08 · Histórico',
  ]) assert.match(source, new RegExp(folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

  assert.match(source, /document\.status === 'superseded'/)
  assert.match(source, /code\.startsWith\('PRD-'\)/)
  assert.match(source, /createSignedUrl\(document\.object_path, 60\)/)
  assert.match(main, /<VoltDocumentFolders \/>/)
})
