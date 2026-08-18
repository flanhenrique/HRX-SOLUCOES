import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin application is centralized behind MFA and shell-native pages avoid DOM bridges', async () => {
  const [navigation, executive, documents, clients, suspensions, experience, shellCss, fiscal, panels, adminApp, authRouter, main] = await Promise.all([
    read('src/quotes/adminNavigation.ts'),
    read('src/quotes/AdminExecutiveDashboard.tsx'),
    read('src/quotes/AdminDocumentsPage.tsx'),
    read('src/quotes/AdminClientsPage.tsx'),
    read('src/quotes/AdminSuspensionsPage.tsx'),
    read('src/quotes/AdminExperienceLayer.tsx'),
    read('src/quotes/admin-shell-navigation.css'),
    read('src/quotes/AdminFiscalPage.tsx'),
    read('src/quotes/AdminProjectPanelsPage.tsx'),
    read('src/quotes/AdminApp.tsx'),
    read('src/quotes/AdminAuthRouter.tsx'),
    read('src/main.tsx'),
  ])

  assert.match(navigation, /'executive'/)
  assert.match(navigation, /ADMIN_NAVIGATE_EVENT/)
  assert.doesNotMatch(navigation, /hrx:open-documents/)
  assert.match(executive, /VISÃO EXECUTIVA/)
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

  assert.match(experience, /className="hrx-admin-shell-sidebar"/)
  assert.match(experience, /className="hrx-admin-shell-mobile-nav"/)
  assert.match(experience, /onAdminNavigate/)
  assert.doesNotMatch(experience, /createPortal|MutationObserver|document\.querySelector/)
  for (const label of ['Visão executiva', 'Orçamentos', 'Clientes', 'Suspensões', 'Central de documentos', 'Painéis', 'Fiscal']) assert.match(experience, new RegExp(label))
  assert.match(shellCss, /\.hrx-admin-shell-sidebar/)
  assert.match(shellCss, /\.hrx-admin-shell-mobile-nav/)
  assert.match(shellCss, /\.admin-live-shell>\.admin-exec-sidebar\{visibility:hidden/)

  for (const component of ['AdminQuotes', 'AdminClientsPage', 'AdminSuspensionsPage', 'AdminDocumentsPage', 'AdminFiscalPage', 'AdminProjectPanelsPage', 'AdminExecutiveDashboard', 'AdminExperienceLayer']) assert.match(adminApp, new RegExp(`<${component} \\/>`))
  assert.match(adminApp, /admin-page-system\.css/)
  assert.doesNotMatch(adminApp, /AdminDesktopNavigation|AdminOperationsHub|AdminDocumentsHub/)
  assert.match(authRouter, /<AdminMfaGate session=\{session\}><AdminApp \/><\/AdminMfaGate>/)
  assert.match(main, /<AdminAuthRouter \/>/)
  assert.doesNotMatch(main, /AdminClientsPage|AdminDocumentsPage|AdminExecutiveDashboard|AdminOperationsHub|AdminDocumentsHub/)
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

test('desktop and mobile navigation belong to the HRX shell instead of the quote DOM', async () => {
  const [experience, shellCss, quotes] = await Promise.all([
    read('src/quotes/AdminExperienceLayer.tsx'),
    read('src/quotes/admin-shell-navigation.css'),
    read('src/quotes/AdminQuotes.tsx'),
  ])
  assert.match(experience, /Navegação principal do HRX Admin/)
  assert.match(experience, /Navegação mobile do HRX Admin/)
  assert.match(shellCss, /@media\(max-width:760px\)/)
  assert.match(shellCss, /\.admin-mobile-nav\{display:none!important\}/)
  assert.match(quotes, /className="admin-mobile-nav"/)
  assert.doesNotMatch(experience, /\.admin-exec-sidebar|\.admin-mobile-nav/)
})

test('executive, operational and document pages share one visual system', async () => {
  const css = await read('src/quotes/admin-page-system.css')
  for (const page of ['hrx-executive-page', 'hrx-clients-page', 'hrx-suspensions-page', 'hrx-documents-page', 'hrx-fiscal-page', 'admin-projects-shell']) assert.match(css, new RegExp(`\\.${page}`))
  assert.match(css, /--hrx-admin-sidebar-width:244px/)
  assert.match(css, /--hrx-page-bg:#f4f6f8/)
  assert.match(css, /--hrx-page-surface:#fff/)
  assert.match(css, /admin-projects-close\{display:none!important\}/)
  assert.match(css, /hrx-fiscal-header button\[aria-label="Fechar"\]\{display:none!important\}/)
  assert.match(css, /@media\(max-width:760px\)/)
})
