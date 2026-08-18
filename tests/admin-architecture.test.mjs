import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin navigation is centralized and shell-native pages avoid DOM bridges', async () => {
  const [navigation, executive, documents, clients, suspensions, experience, fiscal, panels, desktopNavigation, main] = await Promise.all([
    read('src/quotes/adminNavigation.ts'),
    read('src/quotes/AdminExecutiveDashboard.tsx'),
    read('src/quotes/AdminDocumentsPage.tsx'),
    read('src/quotes/AdminClientsPage.tsx'),
    read('src/quotes/AdminSuspensionsPage.tsx'),
    read('src/quotes/AdminExperienceLayer.tsx'),
    read('src/quotes/AdminFiscalPage.tsx'),
    read('src/quotes/AdminProjectPanelsPage.tsx'),
    read('src/quotes/AdminDesktopNavigation.tsx'),
    read('src/main.tsx'),
  ])

  assert.match(navigation, /'executive'/)
  assert.match(navigation, /ADMIN_NAVIGATE_EVENT/)
  assert.doesNotMatch(navigation, /hrx:open-documents/)
  assert.match(executive, /VISÃO EXECUTIVA/)
  assert.match(executive, /getAuthenticatorAssuranceLevel/)
  assert.match(executive, /aal\.currentLevel !== 'aal2'/)
  assert.match(documents, /destination === 'documents'/)
  assert.match(documents, /createSignedUrl/)
  assert.doesNotMatch(documents, /createPortal|MutationObserver/)
  assert.match(clients, /destination === 'clients'/)
  assert.match(clients, /<AdminClientForm/)
  assert.match(clients, /hrx_create_manual_quote/)
  assert.doesNotMatch(clients, /createPortal|MutationObserver/)
  assert.match(suspensions, /destination === 'suspensions'/)
  assert.match(suspensions, /hrx_suspend_quote/)
  assert.match(suspensions, /hrx_resume_quote/)
  assert.doesNotMatch(suspensions, /createPortal|MutationObserver/)
  assert.match(fiscal, /destination === 'fiscal'/)
  assert.doesNotMatch(fiscal, /createPortal|MutationObserver/)
  assert.match(panels, /destination === 'panels'/)
  assert.doesNotMatch(panels, /createPortal|MutationObserver/)
  assert.match(desktopNavigation, /destination: 'executive'/)
  assert.match(main, /<AdminExecutiveDashboard \/>/)
  assert.match(main, /<AdminClientsPage \/>/)
  assert.match(main, /<AdminSuspensionsPage \/>/)
  assert.match(main, /<AdminDocumentsPage \/>/)
  assert.doesNotMatch(main, /AdminOperationsHub|AdminDocumentsHub|AdminLegacyNavigationBridge/)
  assert.doesNotMatch(experience, /\.admin-ops-nav|\.admin-fiscal-nav/)
})

test('CNPJ lookup belongs to the client form instead of a DOM mutation layer', async () => {
  const [clientForm, experience, clients, css] = await Promise.all([
    read('src/quotes/AdminClientForm.tsx'),
    read('src/quotes/AdminExperienceLayer.tsx'),
    read('src/quotes/AdminClientsPage.tsx'),
    read('src/quotes/admin-client-form.css'),
  ])

  assert.match(clientForm, /functions\.invoke<CnpjLookup>\('cnpj-lookup'/)
  assert.match(clientForm, /Consultar CNPJ/)
  assert.match(clients, /<AdminClientForm/)
  assert.doesNotMatch(experience, /setReactInputValue|findField|clientDocumentTarget/)
  assert.match(css, /hrx-cnpj-inline/)
})

test('desktop modules share one visible navigation group', async () => {
  const [desktopNavigation, css] = await Promise.all([
    read('src/quotes/AdminDesktopNavigation.tsx'),
    read('src/quotes/admin-desktop-navigation.css'),
  ])
  for (const label of ['Visão executiva', 'Orçamentos', 'Clientes', 'Central de documentos', 'Painéis', 'Fiscal']) assert.match(desktopNavigation, new RegExp(label))
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
  assert.match(experienceCss, /grid-template-columns:1fr 1fr 1fr!important/)
  assert.match(experienceCss, /\.hrx-mobile-menu-launcher/)
})
