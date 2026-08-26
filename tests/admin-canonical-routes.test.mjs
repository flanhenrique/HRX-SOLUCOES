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
  assert.match(root, /const ActiveView = route\.module\.component/)
  assert.match(root, /<AdminRouteProvider route=\{route\}>/)
  assert.doesNotMatch(root, /const navItems|const pwaPrimary|lazy\(\(\) => import/)
})

test('registro canônico descreve as subrotas estruturais sem criar views de negócio paralelas', () => {
  for (const contract of [
    "id: 'client-detail', pattern: ':clienteId'",
    "id: 'quote-detail', pattern: ':orcamentoId'",
    "id: 'quote-edit', pattern: ':orcamentoId/editar'",
    "id: 'finance-receivable', pattern: 'receber'",
    "id: 'finance-payable', pattern: 'pagar'",
  ]) assert.ok(modules.includes(contract), `subrota estrutural ausente: ${contract}`)

  assert.match(modules, /resolveAdminRouteFromPath/)
  assert.match(modules, /matchSubroute/)
  assert.match(modules, /params\[expected\.slice\(1\)\]/)
  assert.match(modules, /buildAdminSubroutePath/)
})

test('orçamentos permanece view pura sem sidebar, dock ou router próprios', () => {
  assert.ok(!quotes.includes('className="admin-exec-sidebar"'))
  assert.ok(!quotes.includes('className="admin-mobile-nav"'))
  assert.match(quotes, /useAdminRoute\(\)/)
  assert.doesNotMatch(quotes, /onAdminRouteChange|resolveAdminRoute\(|window\.location\.(pathname|hash)|history\.(pushState|replaceState)/)
  assert.match(quotes, /navigateAdminPath\(buildAdminSubroutePath/)
})

test('pathname é a fonte de verdade e hashes antigos são apenas aliases de entrada', () => {
  assert.match(navigation, /history\.pushState/)
  assert.match(navigation, /history\.replaceState/)
  assert.match(navigation, /popstate/)
  assert.match(navigation, /hashchange/)
  assert.match(navigation, /resolveAdminRouteFromPath\(window\.location\.pathname\)/)
  assert.match(navigation, /resolveAdminModuleFromLegacyHash\(window\.location\.hash\)/)
  assert.match(navigation, /canonicalizeAdminLocation/)
  assert.match(navigation, /export function navigateAdminPath/)
  assert.match(navigation, /export function onAdminRouteChange/)
  assert.doesNotMatch(navigation, /#admin\//)
  assert.match(modules, /pathname\.startsWith\(`\$\{module\.path\}\//)
  assert.ok(modules.includes("legacyHashes: ['paineis', 'painels', 'projetos', 'panels']"))
})

test('GitHub Pages materializa módulos e possui fallback SPA para deep links dinâmicos', () => {
  assert.match(deploy, /cp dist\/index\.html dist\/404\.html/)
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
