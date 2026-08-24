import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = await readFile(new URL('../src/quotes/AdminUnifiedRoot.tsx', import.meta.url), 'utf8')
const quotes = await readFile(new URL('../src/quotes/AdminQuotes.tsx', import.meta.url), 'utf8')
const navigation = await readFile(new URL('../src/quotes/adminNavigation.ts', import.meta.url), 'utf8')

test('root canônico não depende mais do shell monolítico para atividades ou configurações', () => {
  assert.ok(!root.includes("import('./AdminExperienceLayer')"))
  assert.match(root, /import\('\.\/AdminActivitiesPage'\)/)
  assert.match(root, /import\('\.\/AdminSettingsPage'\)/)
})

test('orçamentos é uma view pura sem sidebar ou dock próprios', () => {
  assert.ok(!quotes.includes('className="admin-exec-sidebar"'))
  assert.ok(!quotes.includes('className="admin-mobile-nav"'))
  assert.ok(!quotes.includes("from './adminNavigation'"))
})

test('navegação administrativa suporta deep links e histórico do navegador', () => {
  for (const path of ['/admin/orcamentos', '/admin/financeiro', '/admin/fiscal', '/admin/documentos', '/admin/configuracoes']) {
    assert.ok(navigation.includes(`'${path}'`), `deep link ausente: ${path}`)
  }
  assert.match(navigation, /history\.pushState/)
  assert.match(navigation, /popstate/)
  assert.match(navigation, /hashchange/)
})
