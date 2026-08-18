import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin navigation is centralized and executive view is the primary destination', async () => {
  const [navigation, executive, documents, experience, operations, fiscal, panels, desktopNavigation, main] = await Promise.all([
    read('src/quotes/adminNavigation.ts'),
    read('src/quotes/AdminExecutiveDashboard.tsx'),
    read('src/quotes/AdminDocumentsPage.tsx'),
    read('src/quotes/AdminExperienceLayer.tsx'),
    read('src/quotes/AdminOperationsHub.tsx'),
    read('src/quotes/AdminFiscalPage.tsx'),
    read('src/quotes/AdminProjectPanelsPage.tsx'),
    read('src/quotes/AdminDesktopNavigation.tsx'),
    read('src/main.tsx'),
  ])

  assert.match(navigation, /'executive'/)
  assert.match(navigation, /ADMIN_NAVIGATE_EVENT/)
  assert.match(navigation, /window\.dispatchEvent\(new CustomEvent<AdminDestination>\(ADMIN_NAVIGATE_EVENT/)
  assert.doesNotMatch(navigation, /hrx:open-documents/)
  assert.match(executive, /VISÃO EXECUTIVA/)
  assert.match(executive, /getAuthenticatorAssuranceLevel/)
  assert.match(executive, /aal\.currentLevel !== 'aal2'/)
  assert.match(executive, /quoteAdminEndpoint/)
  assert.match(executive, /hrx_documents/)
  assert.match(executive, /navigateAdmin\('quotes'\)/)
  assert.match(documents, /onAdminNavigate/)
  assert.match(documents, /destination === 'documents'/)
  assert.match(documents, /hrx_documents/)
  assert.match(documents, /createSignedUrl/)
  assert.doesNotMatch(documents, /createPortal/)
  assert.doesNotMatch(documents, /MutationObserver/)
  assert.match(experience, /openDestination\('executive'\)/)
  assert.doesNotMatch(experience, /\.admin-ops-nav/)
  assert.doesNotMatch(experience, /\.admin-fiscal-nav/)
  assert.match(operations, /onAdminNavigate/)
  assert.match(fiscal, /destination === 'fiscal'/)
  assert.doesNotMatch(fiscal, /createPortal/)
  assert.doesNotMatch(fiscal, /MutationObserver/)
  assert.match(panels, /destination === 'panels'/)
  assert.doesNotMatch(panels, /createPortal/)
  assert.doesNotMatch(panels, /MutationObserver/)
  assert.match(desktopNavigation, /destination: 'executive'/)
  assert.match(desktopNavigation, /useState<AdminDestination>\(\(\) => window\.location\.hash === '#admin\/painels' \? 'panels' : 'executive'\)/)
  assert.match(main, /<AdminExecutiveDashboard \/>/)
  assert.match(main, /<AdminDocumentsPage \/>/)
  assert.match(main, /<AdminFiscalPage \/>/)
  assert.match(main, /<AdminProjectPanelsPage \/>/)
  assert.doesNotMatch(main, /AdminDocumentsHub/)
  assert.doesNotMatch(main, /AdminLegacyNavigationBridge/)
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

  assert.match(desktopNavigation, /Visão executiva/)
  assert.match(desktopNavigation, /Orçamentos/)
  assert.match(desktopNavigation, /Clientes/)
  assert.match(desktopNavigation, /Central de documentos/)
  assert.match(desktopNavigation, /Painéis/)
  assert.match(desktopNavigation, /Fiscal/)
  assert.match(css, /\.admin-exec-sidebar nav>button\.is-active/)
  assert.match(css, /\.hrx-admin-desktop-nav>button\.is-active/)
})

test('mobile navigation keeps three destinations and exposes executive cockpit through Menu', async () => {
  const [quotes, experience, experienceCss] = await Promise.all([
    read('src/quotes/AdminQuotes.tsx'),
    read('src/quotes/AdminExperienceLayer.tsx'),
    read('src/quotes/admin-experience.css'),
  ])

  assert.match(quotes, /className="admin-mobile-nav"/)
  assert.match(experience, /Visão executiva/)
  assert.match(experienceCss, /\.admin-mobile-nav>button:nth-child\(3\)/)
  assert.match(experienceCss, /grid-template-columns:1fr 1fr 1fr!important/)
  assert.match(experienceCss, /\.hrx-mobile-menu-launcher/)
})
