import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('personal finance remains readable and creatable on mobile PWA', async () => {
  const [page, css] = await Promise.all([
    read('src/quotes/AdminPersonalFinancePage.tsx'),
    read('src/quotes/admin-finance-scope.css'),
  ])

  assert.match(page, /className="finance-page personal-finance-page"/)
  assert.match(page, /className="is-primary"[\s\S]*\+ Nova conta/)
  assert.match(page, /data-label="Ações"/)

  assert.match(css, /data-finance-scope="personal"/)
  assert.match(css, /\.personal-finance-page\{[\s\S]*padding:8px 10px 12px/)
  assert.match(css, /button\.is-primary\{[\s\S]*position:static;[\s\S]*width:100%/)
  assert.doesNotMatch(css, /188px|bottom:calc\(104px/)
  assert.match(css, /\.personal-finance-tabs\{[\s\S]*position:sticky/)
  assert.match(css, /\.personal-finance-table \.finance-row-actions button\{[\s\S]*min-height:44px/)
  assert.match(css, /data-hrx-theme-resolved="light"[\s\S]*\.personal-finance-table tr\{[\s\S]*background:#fff/)
  assert.match(css, /\.personal-finance-table td strong\{[\s\S]*font-size:\.84rem/)
})
