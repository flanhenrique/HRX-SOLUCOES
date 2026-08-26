import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('financeiro pessoal isola contas pela competência selecionada', async () => {
  const page = await read('src/quotes/AdminPersonalFinancePage.tsx')
  assert.match(page, /selectedCompetence/)
  assert.match(page, /competenceKey\(entry\) === selectedCompetence/)
  assert.match(page, /activeInPeriod/)
  assert.match(page, /paidInPeriod/)
  assert.match(page, /searchParams\.set\('competencia', selectedCompetence\)/)
  assert.match(page, /type="month"/)
  assert.match(page, /Mês atual/)
})

test('KPIs pessoais não somam competências futuras no mês selecionado', async () => {
  const page = await read('src/quotes/AdminPersonalFinancePage.tsx')
  assert.match(page, /openTotal = useMemo\(\(\) => activeInPeriod\.reduce/)
  assert.match(page, /paidTotal = useMemo\(\(\) => paidInPeriod\.reduce/)
  assert.match(page, /previousPending/)
  assert.match(page, /não são misturadas ao total/i)
  assert.match(page, /Total da competência/)
})

test('conta pessoal aberta pode ser editada sem alterar o ledger empresarial', async () => {
  const page = await read('src/quotes/AdminPersonalFinancePage.tsx')
  assert.match(page, />Editar<\/button>/)
  assert.match(page, /function EditPersonalEntryModal/)
  assert.match(page, /Salvar alterações/)
  assert.match(page, /\.eq\('owner_user_id', session\.user\.id\)\.eq\('status', 'open'\)/)
  assert.match(page, /O valor do lançamento não pode ser menor que o valor já pago/)
})

test('tabela pessoal mostra competência e valor da ocorrência mensal', async () => {
  const [page, css] = await Promise.all([
    read('src/quotes/AdminPersonalFinancePage.tsx'),
    read('src/quotes/admin-finance-scope.css'),
  ])
  assert.match(page, /Valor do mês/)
  assert.match(page, /formatCompetence/)
  assert.match(page, /Parcela \$\{match\[1\]\}\/\$\{match\[2\]\}/)
  assert.match(css, /personal-finance-period/)
  assert.match(css, /personal-finance-prior/)
})
