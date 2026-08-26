import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const [modules, navigation, routeContext, root, deploy, clients, quotes] = await Promise.all([
  read('src/quotes/adminModules.ts'),
  read('src/quotes/adminNavigation.ts'),
  read('src/quotes/AdminRouteContext.tsx'),
  read('src/quotes/AdminUnifiedRoot.tsx'),
  read('.github/workflows/deploy-pages.yml'),
  read('src/quotes/AdminClientsPage.tsx'),
  read('src/quotes/AdminQuotes.tsx'),
])

test('subrotas pertencem ao módulo pai e extraem parâmetros sem router local nas views', () => {
  assert.match(modules, /export type AdminResolvedRoute/)
  assert.match(modules, /subroute: AdminSubroute \| null/)
  assert.match(modules, /params: Readonly<Record<string, string>>/)
  assert.match(modules, /canonicalRelativePath/)
  assert.match(modules, /matchSubroute\(candidate\.pattern, relativePath\)/)
  assert.match(modules, /decodeURIComponent\(value\)/)
  assert.match(modules, /return \{ module, subroute, pathname: normalized, params, title, shortTitle, breadcrumbs \}/)
})

test('builder de subrota exige contrato registrado e parâmetros obrigatórios', () => {
  assert.match(modules, /export function buildAdminSubroutePath/)
  assert.match(modules, /admin_subroute_not_found/)
  assert.match(modules, /admin_subroute_param_required/)
  assert.match(modules, /encodeURIComponent\(value\)/)
})

test('contexto de rota é fornecido pelo shell e consumível pelas views futuras', () => {
  assert.match(routeContext, /const AdminRouteContext = createContext<AdminResolvedRoute \| null>\(null\)/)
  assert.match(routeContext, /AdminRouteContext\.Provider value=\{route\}/)
  assert.match(routeContext, /export function useAdminRoute/)
  assert.match(root, /useState<AdminResolvedRoute>\(\(\) => resolveAdminRoute\(\)\)/)
  assert.match(root, /onAdminRouteChange/)
  assert.match(root, /<AdminRouteProvider route=\{route\}>/)
  assert.match(root, /document\.title = `\$\{route\.title\} · HRX Admin`/)
})

test('navegação aceita pathname administrativo completo sem abandonar APIs de módulo', () => {
  assert.match(navigation, /export function navigateAdmin\(destination: AdminDestination/)
  assert.match(navigation, /export function navigateAdminPath\(pathname: string/)
  assert.match(navigation, /invalid_admin_path/)
  assert.match(navigation, /hrxAdminPath: normalized/)
  assert.match(navigation, /dispatchAdminNavigation\(route\.module\.id\)/)
})

test('Clientes usa a subrota como fonte de verdade sem criar uma segunda tela de detalhe', () => {
  assert.match(clients, /const route = useAdminRoute\(\)/)
  assert.match(clients, /route\.subroute\?\.id === 'client-detail'/)
  assert.match(clients, /route\.params\.clienteId/)
  assert.match(clients, /navigateAdminPath\(buildAdminSubroutePath\('clients', 'client-detail', \{ clienteId: id \}\)\)/)
  assert.match(clients, /navigateAdmin\('clients'\)/)
  assert.match(clients, /Cliente não encontrado/)
  assert.doesNotMatch(clients, /window\.location|history\.(pushState|replaceState)/)
  assert.equal((clients.match(/className="hrx-client-detail"/g) ?? []).length, 1)
})

test('Orçamentos usa as subrotas para selecionar e abrir o único editor existente', () => {
  assert.match(quotes, /const route = useAdminRoute\(\)/)
  assert.match(quotes, /route\.subroute\?\.id === 'quote-detail'/)
  assert.match(quotes, /route\.subroute\?\.id === 'quote-edit'/)
  assert.match(quotes, /route\.params\.orcamentoId/)
  assert.match(quotes, /isQuoteReadOnly\(request\) \? 'quote-detail' : 'quote-edit'/)
  assert.match(quotes, /navigateAdminPath\(buildAdminSubroutePath\('quotes', subroute, \{ orcamentoId: request\.id \}\)\)/)
  assert.match(quotes, /buildAdminSubroutePath\('quotes', 'quote-edit', \{ orcamentoId: result\.request\.id \}\)/)
  assert.match(quotes, /if \(body\.action === 'delete_draft'\) navigateAdmin\('quotes'\)/)
  assert.match(quotes, /Orçamento não encontrado/)
  assert.doesNotMatch(quotes, /history\.(pushState|replaceState)/)
  assert.equal((quotes.match(/function QuoteEditor\(/g) ?? []).length, 1)
})

test('fallback do Pages permite bootstrap da SPA em path dinâmico sem substituir entradas principais', () => {
  assert.match(deploy, /cp dist\/index\.html dist\/404\.html/)
  assert.match(deploy, /cp dist\/index\.html dist\/admin\/index\.html/)
  assert.match(deploy, /for route in orcamentos clientes financeiro/)
})

test('permissões granulares não são simuladas apenas no cliente nesta fase', () => {
  assert.match(modules, /permissions: readonly string\[\]/)
  assert.doesNotMatch(root, /permissions\.(some|includes)|filter\([^\n]*permissions/)
  assert.doesNotMatch(navigation, /permissions\.(some|includes)/)
})
