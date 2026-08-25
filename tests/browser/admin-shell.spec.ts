import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'

const css = await Promise.all([
  readFile(new URL('../../src/quotes/admin-liquid-glass.css', import.meta.url), 'utf8'),
  readFile(new URL('../../src/quotes/admin-unified-shell.css', import.meta.url), 'utf8'),
  readFile(new URL('../../src/quotes/admin-unified-chrome.css', import.meta.url), 'utf8'),
]).then((parts) => parts.join('\n'))

type ViewportCase = { name: string; width: number; height: number }

const viewports: ViewportCase[] = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x800', width: 360, height: 800 },
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
  { name: '393x852', width: 393, height: 852 },
  { name: '412x915', width: 412, height: 915 },
  { name: '430x932', width: 430, height: 932 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '820x1180', width: 820, height: 1180 },
  { name: '1024x1366', width: 1024, height: 1366 },
  { name: '844x390-landscape', width: 844, height: 390 },
  { name: '932x430-landscape', width: 932, height: 430 },
  { name: '1024x768-landscape', width: 1024, height: 768 },
  { name: '1366x1024', width: 1366, height: 1024 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
]

function viewportClass(width: number) {
  if (width <= 760) return 'phone'
  if (width <= 1100) return 'tablet'
  return 'desktop'
}

function compactShell(kind: 'phone' | 'tablet') {
  return `
    <div class="hrx-unified-shell is-pwa" data-admin-shell="pwa" data-runtime="standalone" data-viewport="${kind}">
      <header class="hrx-glass-topbar hrx-unified-topbar hrx-pwa-topbar">
        <div class="hrx-pwa-brand">
          <img alt="HRX Solutions" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='44'%3E%3Crect width='90' height='44' fill='%2307182d'/%3E%3C/svg%3E" />
          <div><span>HRX ADMIN</span><strong>Orçamentos e propostas</strong></div>
        </div>
        <div class="hrx-unified-actions">
          <button class="hrx-notifications" type="button" aria-label="12 notificações" aria-haspopup="dialog" aria-expanded="false"><i aria-hidden="true">♢</i><span aria-hidden="true">12</span></button>
          <button class="hrx-pwa-settings" type="button" aria-label="Abrir configurações">⚙</button>
          <button class="hrx-pwa-more" type="button" aria-label="Abrir mais áreas" aria-expanded="false" aria-controls="fixture-secondary">•••</button>
        </div>
      </header>
      <main class="hrx-unified-content" data-admin-workspace="true"><section style="min-height:900px;padding:16px"><h1>HRX Admin</h1><p>Conteúdo administrativo de validação responsiva.</p></section></main>
      <nav class="hrx-mobile-nav hrx-unified-mobile-nav" aria-label="Navegação principal do aplicativo">
        <button type="button" class="is-active" aria-current="page"><i aria-hidden="true">⌂</i><span>Início</span></button>
        <button type="button"><i aria-hidden="true">◫</i><span>Orçamentos</span></button>
        <button type="button"><i aria-hidden="true">▣</i><span>Projetos</span></button>
        <button type="button"><i aria-hidden="true">▤</i><span>Docs</span></button>
        <button type="button"><i aria-hidden="true">⚙</i><span>Perfil</span></button>
      </nav>
      <aside id="fixture-secondary" class="hrx-pwa-secondary" aria-label="Mais áreas do HRX Admin" hidden></aside>
    </div>`
}

function desktopShell() {
  return `
    <div class="hrx-unified-shell is-desktop" data-admin-shell="desktop" data-runtime="browser" data-viewport="desktop">
      <aside class="hrx-glass-sidebar hrx-unified-sidebar" aria-label="Navegação principal do HRX Admin">
        <div class="hrx-glass-brand"><strong>HRX</strong><span>Solutions</span></div>
        <nav><button type="button" class="is-active" aria-current="page"><i aria-hidden="true">⌂</i><span>Visão Geral</span></button><button type="button"><i aria-hidden="true">◫</i><span>Orçamentos</span></button></nav>
      </aside>
      <header class="hrx-glass-topbar hrx-unified-topbar">
        <div class="hrx-unified-title"><span>HRX ADMIN</span><strong>Visão Geral</strong></div>
        <div class="hrx-unified-actions"><button class="hrx-notifications" type="button" aria-label="12 notificações" aria-haspopup="dialog" aria-expanded="false"><i aria-hidden="true">♢</i><span aria-hidden="true">12</span></button><button class="hrx-unified-profile" type="button"><span>HR</span><div><strong>Administrador</strong><small>HRX Solutions</small></div></button></div>
      </header>
      <main class="hrx-unified-content" data-admin-workspace="true"><section style="min-height:900px;padding:24px"><h1>HRX Admin</h1><p>Conteúdo administrativo de validação desktop.</p></section></main>
    </div>`
}

async function mountFixture(page: Page, width: number) {
  const kind = viewportClass(width)
  const shell = kind === 'desktop' ? desktopShell() : compactShell(kind)
  await page.setContent(`<!doctype html><html lang="pt-BR" data-hrx-theme-resolved="dark" class="hrx-admin-pwa"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>HRX Admin — QA responsivo</title><style>html,body,#root{margin:0;width:100%;height:100%;background:#061325}${css}</style></head><body class="hrx-admin-pwa"><div id="root">${shell}</div></body></html>`)
}

for (const viewport of viewports) {
  test(`canonical shell stays inside ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await mountFixture(page, viewport.width)

    await expect(page.locator('[data-admin-shell]')).toHaveCount(1)
    const geometry = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      viewportWidth: window.innerWidth,
    }))
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth)
    expect(geometry.clientWidth).toBeLessThanOrEqual(geometry.viewportWidth)

    const shellBox = await page.locator('[data-admin-shell]').boundingBox()
    expect(shellBox).not.toBeNull()
    expect(shellBox!.x).toBeGreaterThanOrEqual(0)
    expect(shellBox!.x + shellBox!.width).toBeLessThanOrEqual(viewport.width + .5)

    const bellBox = await page.locator('.hrx-notifications').boundingBox()
    expect(bellBox).not.toBeNull()
    expect(bellBox!.x).toBeGreaterThanOrEqual(0)
    expect(bellBox!.x + bellBox!.width).toBeLessThanOrEqual(viewport.width + .5)

    if (viewport.width <= 1100) {
      await expect(page.locator('.hrx-pwa-settings')).toBeHidden()
      for (const selector of ['.hrx-pwa-more', '.hrx-unified-mobile-nav']) {
        const box = await page.locator(selector).boundingBox()
        expect(box, selector).not.toBeNull()
        expect(box!.x, selector).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width, selector).toBeLessThanOrEqual(viewport.width + .5)
        expect(box!.y + box!.height, selector).toBeLessThanOrEqual(viewport.height + .5)
      }
      const nav = await page.locator('.hrx-unified-mobile-nav').boundingBox()
      expect(nav!.width).toBeLessThan(viewport.width)
      expect(viewport.height - (nav!.y + nav!.height)).toBeGreaterThanOrEqual(4)
    } else {
      await expect(page.locator('.hrx-unified-sidebar')).toBeVisible()
      await expect(page.locator('.hrx-unified-topbar')).toBeVisible()
    }
  })
}

test('light and dark themes produce different canonical shell surfaces', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mountFixture(page, 390)
  const shell = page.locator('.hrx-unified-shell')
  const darkBackground = await shell.evaluate((element) => getComputedStyle(element).backgroundColor)
  await page.locator('html').evaluate((element) => { (element as HTMLElement).dataset.hrxThemeResolved = 'light' })
  const lightBackground = await shell.evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(lightBackground).not.toEqual(darkBackground)
  await expect(page.locator('.hrx-pwa-settings')).toBeHidden()
})

test('canonical shell fixture has no serious or critical axe violations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mountFixture(page, 390)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules(['color-contrast'])
    .analyze()
  const blocking = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact || ''))
  expect(blocking).toEqual([])
})
