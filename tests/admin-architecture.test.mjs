import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const pureViewPaths = [
  'src/quotes/AdminExecutiveDashboard.tsx',
  'src/quotes/AdminQuotes.tsx',
  'src/quotes/AdminClientsPage.tsx',
  'src/quotes/AdminFinanceScopedPage.tsx',
  'src/quotes/AdminFiscalPage.tsx',
  'src/quotes/AdminSuspensionsPage.tsx',
  'src/quotes/AdminActivitiesPage.tsx',
  'src/quotes/AdminDocumentsPage.tsx',
  'src/quotes/AdminProjectPanelsPage.tsx',
  'src/quotes/AdminSettingsPage.tsx',
]

test('admin autenticado preserva a cadeia canônica e monta exatamente uma raiz', async () => {
  const [adminApp, unifiedRoot, authRouter, main] = await Promise.all([
    read('src/quotes/AdminApp.tsx'),
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/AdminAuthRouter.tsx'),
    read('src/main.tsx'),
  ])

  assert.match(adminApp, /<AdminUnifiedRoot \/>/)
  assert.match(authRouter, /<AdminMfaGate session=\{session\}><AdminApp \/><\/AdminMfaGate>/)
  assert.match(main, /<AdminAuthRouter \/>/)
  assert.match(unifiedRoot, /function DesktopShell/)
  assert.match(unifiedRoot, /function PwaShell/)
  assert.match(unifiedRoot, /data-admin-shell="desktop"/)
  assert.match(unifiedRoot, /data-admin-shell="pwa"/)
  assert.match(unifiedRoot, /environment\.viewport !== 'desktop'/)
  assert.match(unifiedRoot, /\? <PwaShell/)
  assert.match(unifiedRoot, /: <DesktopShell/)
  assert.match(unifiedRoot, /<main className="hrx-unified-content" data-admin-workspace="true">/)

  for (const legacyRoot of ['AdminQuotes', 'AdminSuspensionsPage', 'AdminFiscalPage', 'AdminExperienceLayer', 'AdminSettingsShortcut', 'SuspendedQuoteGuard']) {
    assert.doesNotMatch(adminApp, new RegExp(`<${legacyRoot}\\s*\\/>`), `${legacyRoot} não pode ser montado em paralelo no AdminApp`)
  }
})

test('registro modular possui lazy loading, metadados e contrato de subrotas', async () => {
  const [root, modules, routeContext] = await Promise.all([
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/adminModules.ts'),
    read('src/quotes/AdminRouteContext.tsx'),
  ])

  assert.match(modules, /export type AdminModule/)
  assert.match(modules, /export type AdminResolvedRoute/)
  assert.match(modules, /export type AdminSubroute/)
  assert.match(modules, /export const ADMIN_MODULES/)
  assert.match(modules, /component: lazy\(\(\) => import/)
  assert.match(modules, /navigationGroup:/)
  assert.match(modules, /mobileNavigation:/)
  assert.match(modules, /permissions:/)
  assert.match(modules, /resolveAdminModuleFromPath/)
  assert.match(modules, /resolveAdminRouteFromPath/)
  assert.match(modules, /buildAdminSubroutePath/)
  assert.match(root, /const ActiveView = route\.module\.component/)
  assert.match(root, /<AdminRouteProvider route=\{route\}>/)
  assert.match(routeContext, /createContext<AdminResolvedRoute \| null>/)
  assert.match(routeContext, /export function useAdminRoute/)
  assert.doesNotMatch(root, /import\('\.\/AdminQuotes'\)|import\('\.\/AdminSettingsPage'\)|const navItems|const pwaPrimary/)
})

test('módulos de negócio permanecem views puras dentro do workspace canônico', async () => {
  const views = await Promise.all(pureViewPaths.map(read))
  for (let index = 0; index < pureViewPaths.length; index += 1) {
    const source = views[index]
    const path = pureViewPaths[index]
    assert.doesNotMatch(source, /<AdminUnifiedRoot|function DesktopShell|function PwaShell|hrx-unified-sidebar|hrx-unified-mobile-nav/, `${path} não pode criar shell ou navegação global`)
    assert.doesNotMatch(source, /onAdminNavigate|onAdminRouteChange|resolveAdminRoute\(|window\.location\.hash|const\s+\[open,\s*setOpen\]/, `${path} não pode controlar sua própria ativação de rota`)
  }

  const quotes = views[pureViewPaths.indexOf('src/quotes/AdminQuotes.tsx')]
  const suspensions = views[pureViewPaths.indexOf('src/quotes/AdminSuspensionsPage.tsx')]
  const fiscal = views[pureViewPaths.indexOf('src/quotes/AdminFiscalPage.tsx')]
  const panels = views[pureViewPaths.indexOf('src/quotes/AdminProjectPanelsPage.tsx')]
  const panelsCss = await read('src/quotes/admin-project-panels.css')

  assert.match(quotes, /action: 'save_quote'/)
  assert.match(quotes, /generateProposalPdf/)
  assert.doesNotMatch(quotes, /className="admin-exec-sidebar"|className="admin-mobile-nav"/)
  assert.match(quotes, /useAdminRoute\(\)/)
  assert.match(quotes, /navigateAdminPath\(buildAdminSubroutePath/)
  assert.match(suspensions, /hrx_suspend_quote/)
  assert.match(suspensions, /hrx_resume_quote/)
  assert.match(fiscal, /cnpj-lookup/)
  assert.match(fiscal, /hrx_confirm_client_tax_regime/)
  assert.doesNotMatch(panels, /role="dialog"|aria-modal|admin-projects-close|PANELS_HASH/)
  assert.doesNotMatch(panelsCss, /\.admin-projects-shell\{[^}]*position:fixed/)
})

test('desktop e PWA consomem o mesmo registro, mantendo um único dock mobile', async () => {
  const [root, modules] = await Promise.all([
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/adminModules.ts'),
  ])

  assert.match(root, /ADMIN_DESKTOP_MODULES\.map/)
  assert.match(root, /ADMIN_MOBILE_PRIMARY_MODULES\.map/)
  assert.match(root, /ADMIN_MOBILE_MORE_MODULES\.map/)
  assert.match(root, /className="hrx-mobile-nav hrx-unified-mobile-nav"/)
  assert.match(root, /className={`hrx-mobile-more\$\{moreActive \? ' is-active' : ''\}`}/)
  assert.match(root, /<span>Mais<\/span>/)
  assert.match(root, /hrx-pwa-secondary/)
  assert.match(modules, /id: 'clients',[\s\S]*mobileNavigation: 'primary'/)
  assert.match(modules, /id: 'finance',[\s\S]*mobileNavigation: 'primary'/)
  assert.match(modules, /id: 'panels',[\s\S]*mobileNavigation: 'more'/)
  assert.match(modules, /id: 'settings',[\s\S]*mobileNavigation: 'more'/)

  const desktopBlock = root.slice(root.indexOf('function DesktopShell'), root.indexOf('function PwaShell'))
  const pwaBlock = root.slice(root.indexOf('function PwaShell'), root.indexOf('export default function AdminUnifiedRoot'))
  assert.doesNotMatch(desktopBlock, /hrx-unified-mobile-nav/)
  assert.doesNotMatch(pwaBlock, /hrx-unified-sidebar" aria-label="Navegação principal/)
  assert.doesNotMatch(pwaBlock, /hrx-pwa-settings/)
})

test('runtime responsivo, dados reais e personalização permanecem atrás do shell', async () => {
  const [root, activities, settings, personalization, interactions] = await Promise.all([
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/AdminActivitiesPage.tsx'),
    read('src/quotes/AdminSettingsPage.tsx'),
    read('src/quotes/AdminPersonalizationBridge.tsx'),
    read('src/quotes/admin-interactions.css'),
  ])

  assert.match(root, /type RuntimeMode = 'standalone' \| 'browser'/)
  assert.match(root, /type ViewportClass = 'phone' \| 'tablet' \| 'desktop'/)
  assert.match(root, /display-mode: standalone/)
  assert.match(root, /window\.innerWidth <= 760/)
  assert.match(root, /window\.innerWidth <= 1100/)
  assert.match(root, /from\('quote_drafts'\)/)
  assert.match(root, /from\('hrx_documents'\)/)
  assert.match(root, /channel\('hrx-admin-alerts'\)/)
  assert.match(root, /<AdminPersonalizationBridge settingsActive=\{active === 'settings'\} \/>/)
  assert.match(activities, /from\('quote_requests'\)/)
  assert.match(settings, /secureUpdateAdminPassword/)
  assert.match(personalization, /hrx-admin-ui-preferences-v1/)
  assert.doesNotMatch(personalization, /MutationObserver/)
  assert.match(interactions, /:focus-visible/)
  assert.match(interactions, /prefers-reduced-motion:reduce/)
})
