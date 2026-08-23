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
  assert.match(unifiedRoot, /compact \? <PwaShell/)
  assert.match(unifiedRoot, /: <DesktopShell/)
  assert.match(unifiedRoot, /data-admin-workspace="true"/)

  assert.match(authRouter, /<AdminMfaGate session=\{session\}><AdminApp \/><\/AdminMfaGate>/)
  assert.match(main, /<AdminAuthRouter \/>/)
})

test('business modules are routed as views instead of sibling fullscreen apps', async () => {
  const [root, quotes, suspensions, fiscal] = await Promise.all([
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/AdminQuotes.tsx'),
    read('src/quotes/AdminSuspensionsPage.tsx'),
    read('src/quotes/AdminFiscalPage.tsx'),
  ])

  assert.match(root, /destination === 'quotes'.*<AdminQuotes \/>/s)
  assert.match(root, /destination === 'suspensions'.*<AdminSuspensionsPage \/>/s)
  assert.match(root, /destination === 'fiscal'.*<AdminFiscalPage \/>/s)
  assert.match(root, /coreDestinations\.has\(destination\).*<AdminExperienceLayer \/>/s)

  assert.match(quotes, /action: 'save_quote'/)
  assert.match(quotes, /generateProposalPdf/)
  assert.match(quotes, /proposal_number/)
  assert.match(suspensions, /hrx_suspend_quote/)
  assert.match(suspensions, /hrx_resume_quote/)
  assert.match(fiscal, /cnpj-lookup/)
  assert.match(fiscal, /hrx_confirm_client_tax_regime/)
})

test('desktop and PWA are distinct mounted shells, not one responsive chrome', async () => {
  const root = await read('src/quotes/AdminUnifiedRoot.tsx')

  assert.match(root, /const pwaPrimary/)
  assert.match(root, /function useCompactAdmin/)
  assert.match(root, /window\.matchMedia\('\(max-width: 760px\)'\)/)
  assert.match(root, /<aside className="hrx-glass-sidebar hrx-unified-sidebar"/)
  assert.match(root, /<nav className="hrx-mobile-nav hrx-unified-mobile-nav"/)
  assert.match(root, /hrx-pwa-secondary/)

  const desktopBlock = root.slice(root.indexOf('function DesktopShell'), root.indexOf('function PwaShell'))
  const pwaBlock = root.slice(root.indexOf('function PwaShell'), root.indexOf('export default function AdminUnifiedRoot'))
  assert.doesNotMatch(desktopBlock, /hrx-unified-mobile-nav/)
  assert.doesNotMatch(pwaBlock, /hrx-unified-sidebar" aria-label="Navegação principal/)
})

test('nested legacy shells are explicitly neutralized inside the canonical workspace', async () => {
  const css = await read('src/quotes/admin-unified-shell.css')

  assert.match(css, /\.hrx-unified-shell\{[\s\S]*position:fixed/)
  assert.match(css, /\.hrx-unified-content>\.hrx-glass-app\{[\s\S]*position:relative!important/)
  assert.match(css, /\.hrx-unified-content>\.hrx-glass-app>\.hrx-glass-sidebar,[\s\S]*display:none!important/)
  assert.match(css, /\.hrx-unified-content>\.admin-live-shell\.quote-commercial-shell\{[\s\S]*position:relative!important/)
  assert.match(css, /quote-commercial-shell>\.admin-exec-sidebar,[\s\S]*display:none!important/)
  assert.match(css, /\.hrx-unified-content \.hrx-legacy-shell\{display:none!important\}/)
})

test('admin keeps real data, storage and personalization behind the unified shell', async () => {
  const [root, experience, personalization, interactions] = await Promise.all([
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/AdminExperienceLayer.tsx'),
    read('src/quotes/AdminPersonalizationBridge.tsx'),
    read('src/quotes/admin-interactions.css'),
  ])

  assert.match(root, /from\('quote_drafts'\)/)
  assert.match(root, /from\('hrx_documents'\)/)
  assert.match(root, /<AdminPersonalizationBridge \/>/)
  assert.match(experience, /from\('clients'\)/)
  assert.match(experience, /from\('quote_requests'\)/)
  assert.match(experience, /from\('hrx_documents'\)/)
  assert.match(experience, /createSignedUrl/)
  assert.match(experience, /hrx_create_manual_quote/)
  assert.match(personalization, /hrx-admin-ui-preferences-v1/)
  assert.match(interactions, /:focus-visible/)
  assert.match(interactions, /prefers-reduced-motion:reduce/)
})
