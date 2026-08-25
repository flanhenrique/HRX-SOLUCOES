import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const [root, quotes, navigation, modules, deploy, manifestText] = await Promise.all([
  read('src/quotes/AdminUnifiedRoot.tsx'),
  read('src/quotes/AdminQuotes.tsx'),
  read('src/quotes/adminNavigation.ts'),
  read('src/quotes/adminModules.ts'),
  read('.github/workflows/deploy-pages.yml'),
  read('public/admin/manifest.webmanifest'),
])
const manifest = JSON.parse(manifestText)

const canonicalRoutes = [
  '/admin',
  '/admin/orcamentos',
  '/admin/clientes',
  '/admin/financeiro',
  '/admin/fiscal',
  '/admin/suspensoes',
  '/admin/atividades',
  '/admin/documentos',
  '/admin/paineis',
  '/admin/configuracoes',
]

test('registro canônico concentra módulos, rotas, lazy views e metadados de navegação', () => {
  for (const path of canonicalRoutes) assert.ok(modules.includes(`path: '${path}'`), `rota canônica ausente: ${path}`)
  for (const field of ['navigationGroup:', 'mobileNavigation:', 'permissions:', 'component: lazy(']) assert.ok(modules.includes(field), `contrato de módulo ausente: ${field}`)
  for (const view of [
    'AdminExecutiveDashboard',
    'AdminQuotes',
    'AdminClientsPage',
    'AdminFinanceScopedPage',
    'AdminFiscalPage',
    'AdminSuspensionsPage',
    'AdminActivitiesPage',
    'AdminDocumentsPage',
    'AdminProjectPanelsPage',
    'AdminSettingsPage',
  ]) assert.ok(modules.includes(`import('./${view}')`), `lazy view ausente do registro: ${view}`)

  assert.match(root, /ADMIN_DESKTOP_MODULES/)
  assert.match(root, /ADMIN_MOBILE_PRIMARY_MODULES/)
  assert.match(root, /ADMIN_MOBILE_MORE_MODULES/)
  assert.match(root, /getAdminModule\(destination\)/)
  assert.doesNotMatch(root, /const navItems|const pwaPrimary|lazy\(\(\) => import/)
})

test('orçamentos permanece view pura sem sidebar, dock ou router próprios', () => {
  assert.ok(!quotes.includes('className="admin-exec-sidebar"'))
  assert.ok(!quotes.includes('className="admin-mobile-nav"'))
  assert.ok(!quotes.includes("from './adminNavigation'"))
})

test('pathname é a fonte de verdade e hashes antigos são apenas aliases de entrada', () => {
  assert.match(navigation, /history\.pushState/)
  assert.match(navigation, /history\.replaceState/)
  assert.match(navigation, /popstate/)
  assert.match(navigation, /hashchange/)
  assert.match(navigation, /resolveAdminModuleFromPath\(window\.location\.pathname\)/)
  assert.match(navigation, /resolveAdminModuleFromLegacyHash\(window\.location\.hash\)/)
  assert.match(navigation, /canonicalizeAdminLocation/)
  assert.doesNotMatch(navigation, /#admin\//)
  assert.match(modules, /pathname\.startsWith\(`\$\{module\.path\}\//)
  assert.ok(modules.includes("legacyHashes: ['paineis', 'painels', 'projetos', 'panels']"))
})

test('GitHub Pages materializa todos os módulos para refresh e acesso direto', () => {
  assert.match(deploy, /cp dist\/index\.html dist\/admin\/index\.html/)
  for (const slug of ['orcamentos', 'clientes', 'financeiro', 'fiscal', 'suspensoes', 'atividades', 'documentos', 'paineis', 'configuracoes']) {
    assert.ok(deploy.includes(slug), `rota não preparada no artifact do Pages: ${slug}`)
  }
  for (const alias of ['visao-geral', 'painels', 'projetos']) assert.ok(deploy.includes(alias), `alias de compatibilidade ausente no Pages: ${alias}`)
})

test('PWA abre na visão geral sem mudar a identidade instalada e usa atalhos canônicos', () => {
  assert.equal(manifest.id, '/admin/orcamentos')
  assert.equal(manifest.start_url, '/admin/')
  assert.equal(manifest.scope, '/admin/')
  assert.ok(manifest.shortcuts.some((shortcut) => shortcut.url === '/admin/orcamentos'))
  assert.ok(manifest.shortcuts.some((shortcut) => shortcut.url === '/admin/paineis'))
  assert.ok(manifest.shortcuts.every((shortcut) => !shortcut.url.includes('#admin/')))
})
