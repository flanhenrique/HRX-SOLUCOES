import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('executive cockpit uses commercial metrics without presenting them as realized revenue', async () => {
  const [executive, css, app] = await Promise.all([
    read('src/quotes/AdminExecutiveDashboard.tsx'),
    read('src/quotes/admin-executive-intelligence.css'),
    read('src/quotes/AdminApp.tsx'),
  ])

  assert.match(executive, /estimated_net/)
  assert.match(executive, /approvedValue/)
  assert.match(executive, /avgTicket/)
  assert.match(executive, /pricedCoverage/)
  assert.match(executive, /topAccounts/)
  assert.match(executive, /PERFORMANCE COMERCIAL/)
  assert.match(executive, /Valor aprovado/)
  assert.match(executive, /não receita realizada/)
  assert.match(executive, /Potencial líquido/)
  assert.match(executive, /Cobertura de precificação/)
  assert.match(executive, /CONCENTRAÇÃO DA CARTEIRA/)
  assert.match(executive, /Receita realizada, contas a receber e margem exigem uma camada financeira própria/)
  assert.doesNotMatch(executive, />Receita realizada</)
  assert.match(css, /\.hrx-executive-performance/)
  assert.match(css, /\.hrx-executive-concentration/)
  assert.match(css, /\.hrx-executive-data-boundary/)
  assert.match(app, /admin-executive-intelligence\.css/)
})
