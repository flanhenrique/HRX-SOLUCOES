import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('authenticated admin mounts exactly one canonical root', async () => {
  const [adminApp, unifiedRoot, authRouter, main] = await Promise.all([
    read('src/quotes/AdminApp.tsx'),
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/AdminAuthRouter.tsx'),
    read('src/main.tsx'),
  ])

  assert.match(adminApp, /<AdminUnifiedRoot \/>/)
  for (const legacyRoot of ['AdminQuotes', 'AdminSuspensionsPage', 'AdminFiscalPage', 'AdminExperienceLayer', 'AdminSettingsShortcut', 'SuspendedQuoteGuard']) {
    assert.doesNotMatch(adminApp, new RegExp(`<${legacyRoot}\\s*\\/>`), `${legacyRoot} não pode ser montado em paralelo no AdminApp`)
  }

  assert.match(unifiedRoot, /function RouteContent/)
  assert.match(unifiedRoot, /function DesktopShell/)
  assert.match(unifiedRoot, /function PwaShell/)
  assert.match(unifiedRoot, /data-admin-shell="desktop"/)
  assert.match(unifiedRoot, /data-admin-shell="pwa"/)
  assert.match(unifiedRoot, /compactShell/)
  assert.match(unifiedRoot, /\? <PwaShell/)
  assert.match(unifiedRoot, /: <DesktopShell/)
  assert.match(unifiedRoot, /data-admin-workspace="true"/)

  assert.match(authRouter, /<AdminMfaGate session=\{session\}><AdminApp \/><\/AdminMfaGate>/)
  assert.match(main, /<AdminAuthRouter \/>/)
})

test('business modules are routed as pure views instead of sibling fullscreen apps', async () => {
  const [root, quotes, suspensions, fiscal, activities, settings, panels, panelsCss] = await Promise.all([
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/AdminQuotes.tsx'),
    read('src/quotes/AdminSuspensionsPage.tsx'),
    read('src/quotes/AdminFiscalPage.tsx'),
    read('src/quotes/AdminActivitiesPage.tsx'),
    read('src/quotes/AdminSettingsPage.tsx'),
    read('src/quotes/AdminProjectPanelsPage.tsx'),
    read('src/quotes/admin-project-panels.css'),
  ])

  assert.match(root, /destination === 'quotes'.*<AdminQuotes \/>/s)
  assert.match(root, /destination === 'suspensions'.*<AdminSuspensionsPage \/>/s)
  assert.match(root, /destination === 'fiscal'.*<AdminFiscalPage \/>/s)
  assert.match(root, /destination === 'activities'.*<AdminActivitiesPage \/>/s)
  assert.match(root, /destination === 'panels'.*<AdminProjectPanelsPage \/>/s)
  assert.match(root, /<AdminSettingsPage \/>/)
  assert.doesNotMatch(root, /AdminExperienceLayer/)

  assert.match(quotes, /action: 'save_quote'/)
  assert.match(quotes, /generateProposalPdf/)
  assert.match(quotes, /proposal_number/)
  assert.doesNotMatch(quotes, /className="admin-exec-sidebar"/)
  assert.doesNotMatch(quotes, /className="admin-mobile-nav"/)
  assert.doesNotMatch(activities, /hrx-glass-sidebar/)
  assert.doesNotMatch(settings, /hrx-glass-sidebar/)
  assert.doesNotMatch(panels, /role="dialog"|aria-modal|admin-projects-close|onAdminNavigate|PANELS_HASH/)
  assert.doesNotMatch(panelsCss, /\.admin-projects-shell\{[^}]*position:fixed/)
  assert.match(suspensions, /hrx_suspend_quote/)
  assert.match(suspensions, /hrx_resume_quote/)
  assert.match(fiscal, /cnpj-lookup/)
  assert.match(fiscal, /hrx_confirm_client_tax_regime/)
})

test('desktop and compact shells are selected by viewport while runtime mode remains independent', async () => {
  const root = await read('src/quotes/AdminUnifiedRoot.tsx')

  assert.match(root, /const pwaPrimary/)
  assert.match(root, /function useAdminEnvironment/)
  assert.match(root, /type RuntimeMode = 'standalone' \| 'browser'/)
  assert.match(root, /type ViewportClass = 'phone' \| 'tablet' \| 'desktop'/)
  assert.match(root, /display-mode: standalone/)
  assert.match(root, /window\.innerWidth <= 760/)
  assert.match(root, /window\.innerWidth <= 1100/)
  assert.match(root, /environment\.viewport !== 'desktop'/)
  assert.match(root, /<aside className="hrx-glass-sidebar hrx-unified-sidebar"/)
  assert.match(root, /<nav className="hrx-mobile-nav hrx-unified-mobile-nav"/)
  assert.match(root, /hrx-pwa-secondary/)

  const desktopBlock = root.slice(root.indexOf('function DesktopShell'), root.indexOf('function PwaShell'))
  const pwaBlock = root.slice(root.indexOf('function PwaShell'), root.indexOf('export default function AdminUnifiedRoot'))
  assert.doesNotMatch(desktopBlock, /hrx-unified-mobile-nav/)
  assert.doesNotMatch(pwaBlock, /hrx-unified-sidebar" aria-label="Navegação principal/)
  assert.doesNotMatch(pwaBlock, /hrx-pwa-settings/)
})

test('canonical workspace no longer relies on hiding quote navigation shells', async () => {
  const [quotes, root] = await Promise.all([
    read('src/quotes/AdminQuotes.tsx'),
    read('src/quotes/AdminUnifiedRoot.tsx'),
  ])

  assert.doesNotMatch(quotes, /admin-exec-sidebar/)
  assert.doesNotMatch(quotes, /admin-mobile-nav/)
  assert.match(root, /hrx-unified-sidebar/)
  assert.match(root, /hrx-unified-mobile-nav/)
})

test('admin keeps real data, storage and personalization behind the unified shell', async () => {
  const [root, activities, settings, personalization, interactions] = await Promise.all([
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/AdminActivitiesPage.tsx'),
    read('src/quotes/AdminSettingsPage.tsx'),
    read('src/quotes/AdminPersonalizationBridge.tsx'),
    read('src/quotes/admin-interactions.css'),
  ])

  assert.match(root, /from\('quote_drafts'\)/)
  assert.match(root, /from\('hrx_documents'\)/)
  assert.match(root, /channel\('hrx-admin-alerts'\)/)
  assert.match(root, /<AdminPersonalizationBridge settingsActive=\{active === 'settings'\} \/>/)
  assert.match(activities, /from\('quote_requests'\)/)
  assert.match(activities, /from\('hrx_documents'\)/)
  assert.match(settings, /secureUpdateAdminPassword/)
  assert.match(personalization, /hrx-admin-ui-preferences-v1/)
  assert.doesNotMatch(personalization, /MutationObserver/)
  assert.match(interactions, /:focus-visible/)
  assert.match(interactions, /prefers-reduced-motion:reduce/)
})
