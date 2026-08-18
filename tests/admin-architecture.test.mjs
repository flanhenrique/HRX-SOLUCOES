import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin navigation is centralized and fiscal/panels no longer depend on DOM bridges', async () => {
  const [navigation, experience, operations, fiscal, panels, desktopNavigation, main] = await Promise.all([
    read('src/quotes/adminNavigation.ts'),
    read('src/quotes/AdminExperienceLayer.tsx'),
    read('src/quotes/AdminOperationsHub.tsx'),
    read('src/quotes/AdminFiscalPage.tsx'),
    read('src/quotes/AdminProjectPanelsPage.tsx'),
    read('src/quotes/AdminDesktopNavigation.tsx'),
    read('src/main.tsx'),
  ])

  assert.match(navigation, /ADMIN_NAVIGATE_EVENT/)
  assert.match(navigation, /navigateAdmin/)
  assert.match(experience, /navigateAdmin\(destination\)/)
  assert.doesNotMatch(experience, /\.admin-ops-nav/)
  assert.doesNotMatch(experience, /\.admin-fiscal-nav/)
  assert.match(operations, /onAdminNavigate/)
  assert.match(operations, /destination === 'clients'/)
  assert.match(operations, /destination === 'suspensions'/)
  assert.match(fiscal, /onAdminNavigate/)
  assert.match(fiscal, /destination === 'fiscal'/)
  assert.doesNotMatch(fiscal, /createPortal/)
  assert.doesNotMatch(fiscal, /MutationObserver/)
  assert.match(panels, /onAdminNavigate/)
  assert.match(panels, /destination === 'panels'/)
  assert.doesNotMatch(panels, /createPortal/)
  assert.doesNotMatch(panels, /MutationObserver/)
  assert.match(desktopNavigation, /navigateAdmin\(item\.destination\)/)
  assert.match(main, /<AdminFiscalPage \/>/)
  assert.match(main, /<AdminProjectPanelsPage \/>/)
  assert.match(main, /<AdminDesktopNavigation \/>/)
  assert.doesNotMatch(main, /AdminLegacyNavigationBridge/)
  assert.doesNotMatch(main, /AdminFiscalHub/)
  assert.doesNotMatch(main, /AdminProjectPanels from/)
})

test('CNPJ lookup belongs to the client form instead of a DOM mutation layer', async () => {
  const [clientForm, experience, operations, css] = await Promise.all([
    read('src/quotes/AdminClientForm.tsx'),
    read('src/quotes/AdminExperienceLayer.tsx'),
    read('src/quotes/AdminOperationsHub.tsx'),
    read('src/quotes/admin-client-form.css'),
  ])

  assert.match(clientForm, /functions\.invoke<CnpjLookup>\('cnpj-lookup'/)
  assert.match(clientForm, /setForm\(\(current\)/)
  assert.match(clientForm, /Consultar CNPJ/)
  assert.match(operations, /<AdminClientForm/)
  assert.doesNotMatch(experience, /setReactInputValue/)
  assert.doesNotMatch(experience, /findField/)
  assert.doesNotMatch(experience, /clientDocumentTarget/)
  assert.match(css, /hrx-cnpj-inline/)
})

test('desktop modules share one visible navigation group', async () => {
  const [desktopNavigation, css] = await Promise.all([
    read('src/quotes/AdminDesktopNavigation.tsx'),
    read('src/quotes/admin-desktop-navigation.css'),
  ])

  assert.match(desktopNavigation, /Clientes/)
  assert.match(desktopNavigation, /Suspensões/)
  assert.match(desktopNavigation, /Central de documentos/)
  assert.match(desktopNavigation, /Painéis/)
  assert.match(desktopNavigation, /Fiscal/)
  assert.match(css, /\.admin-ops-nav/)
  assert.match(css, /\.hrx-documents-nav/)
  assert.match(css, /\.admin-projects-nav/)
  assert.match(css, /\.admin-fiscal-nav/)
})

test('mobile navigation has exactly two native destinations plus the central menu', async () => {
  const [quotes, experienceCss] = await Promise.all([
    read('src/quotes/AdminQuotes.tsx'),
    read('src/quotes/admin-experience.css'),
  ])

  assert.match(quotes, /className="admin-mobile-nav"/)
  assert.match(experienceCss, /\.admin-mobile-nav>button:nth-child\(3\)/)
  assert.match(experienceCss, /grid-template-columns:1fr 1fr 1fr!important/)
  assert.match(experienceCss, /\.hrx-mobile-menu-launcher/)
})
