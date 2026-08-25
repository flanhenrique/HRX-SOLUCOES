import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: true })
  })
  await page.route('**/rest/v1/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/0' },
      body: '[]',
    })
  })
})

test('standalone PWA preserves dock geometry after canonical lazy routes load', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.goto('/admin/paineis?hrx-preview=1')
  const shell = page.locator('.hrx-unified-shell.is-pwa')
  await expect(shell).toHaveAttribute('data-runtime', 'standalone')
  await shell.evaluate((node) => node.style.setProperty('--hrx-safe-bottom', '34px'))

  const measure = () => page.evaluate(() => {
    const content = document.querySelector('.hrx-unified-content') as HTMLElement
    const dock = document.querySelector('.hrx-unified-mobile-nav') as HTMLElement
    const dockRect = dock.getBoundingClientRect()
    const contentRect = content.getBoundingClientRect()
    return {
      dockTop: dockRect.top,
      dockBottom: dockRect.bottom,
      dockHeight: dockRect.height,
      gap: (window.visualViewport?.height ?? window.innerHeight) - dockRect.bottom,
      contentBottom: contentRect.bottom,
      contentOverflowY: getComputedStyle(content).overflowY,
      shellCount: document.querySelectorAll('[data-admin-shell]').length,
    }
  })

  const baseline = await measure()
  expect(baseline.gap).toBeCloseTo(6, 0)

  await page.getByRole('button', { name: 'Orçamentos' }).click()
  await expect(page).toHaveURL(/\/admin\/orcamentos\?hrx-preview=1$/)
  await expect(page.locator('.quote-module-loading')).toBeVisible()
  const quotes = await measure()

  await page.getByRole('button', { name: 'Financeiro' }).click()
  await expect(page).toHaveURL(/\/admin\/financeiro\?hrx-preview=1$/)
  await expect(page.locator('.finance-scope-root')).toBeVisible()
  const finance = await measure()

  await page.getByRole('button', { name: 'Abrir mais áreas' }).click()
  await page.getByRole('button', { name: 'Painéis' }).click()
  await expect(page).toHaveURL(/\/admin\/paineis\?hrx-preview=1$/)
  await expect(page.locator('.admin-projects-shell')).toBeVisible()
  const panels = await measure()

  await page.getByRole('button', { name: 'Abrir mais áreas' }).click()
  await page.getByRole('button', { name: 'Central de Documentos' }).click()
  await expect(page).toHaveURL(/\/admin\/documentos\?hrx-preview=1$/)
  await expect(page.locator('.hrx-documents-page')).toBeVisible()
  const documents = await measure()

  for (const current of [quotes, finance, panels, documents]) {
    expect(current.shellCount).toBe(1)
    expect(current.contentOverflowY).toBe('auto')
    expect(current.dockTop).toBeCloseTo(baseline.dockTop, 0)
    expect(current.dockBottom).toBeCloseTo(baseline.dockBottom, 0)
    expect(current.dockHeight).toBeCloseTo(baseline.dockHeight, 0)
    expect(current.gap).toBeCloseTo(6, 0)
    expect(current.contentBottom).toBeCloseTo(874, 0)
  }
})

test('aplicativo React real mantém um único shell e Painéis como view normal no mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/paineis?hrx-preview=1')

  const shell = page.locator('[data-admin-shell="pwa"]')
  await expect(shell).toHaveCount(1)
  await expect(shell).toBeVisible()
  await expect(page.locator('[data-admin-shell]')).toHaveCount(1)
  await expect(page.locator('.admin-projects-shell')).toHaveCount(1)
  await expect(page.locator('.admin-projects-shell')).not.toHaveAttribute('role', 'dialog')
  await expect(page.locator('.admin-projects-close')).toHaveCount(0)
  await expect(page.locator('.hrx-unified-mobile-nav')).toHaveCount(1)
  await expect(page.getByRole('button', { name: /notifica/i })).toBeVisible()

  const dockLabels = await page.locator('.hrx-unified-mobile-nav span').allTextContents()
  expect(dockLabels).toEqual(['Início', 'Orçamentos', 'Clientes', 'Financeiro', 'Mais'])

  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    shells: document.querySelectorAll('[data-admin-shell]').length,
  }))
  expect(geometry.shells).toBe(1)
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth)
})

test('navegação real usa pathname, preserva query e histórico entre Painéis e Configurações', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 })
  await page.goto('/admin/paineis?hrx-preview=1')
  await expect(page.locator('.admin-projects-shell')).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/paineis\?hrx-preview=1$/)

  await page.getByRole('button', { name: 'Abrir mais áreas' }).click()
  await page.getByRole('button', { name: 'Configurações' }).click()
  await expect(page).toHaveURL(/\/admin\/configuracoes\?hrx-preview=1$/)
  await expect(page.locator('.hrx-settings-view')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Alterar senha/i })).toBeVisible()
  await expect(page.locator('[data-admin-shell]')).toHaveCount(1)

  await page.goBack()
  await expect(page).toHaveURL(/\/admin\/paineis\?hrx-preview=1$/)
  await expect(page.locator('.admin-projects-shell')).toBeVisible()

  await page.goForward()
  await expect(page).toHaveURL(/\/admin\/configuracoes\?hrx-preview=1$/)
  await expect(page.locator('.hrx-settings-view')).toBeVisible()
  await expect(page.locator('[data-admin-shell]')).toHaveCount(1)
})

test('hash legado é canonicalizado para pathname sem perder a tela', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/?hrx-preview=1#admin/painels')
  await expect(page.locator('.admin-projects-shell')).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/paineis\?hrx-preview=1$/)
  await expect(page.locator('[data-admin-shell]')).toHaveCount(1)
})

test('trocar para Orçamentos não monta outro shell', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/paineis?hrx-preview=1')
  await page.getByRole('button', { name: 'Orçamentos' }).click()

  await expect(page).toHaveURL(/\/admin\/orcamentos\?hrx-preview=1$/)
  await expect(page.locator('[data-admin-shell]')).toHaveCount(1)
  await expect(page.locator('.quote-module-loading')).toBeVisible()
  await expect(page.locator('.admin-exec-sidebar')).toHaveCount(0)
  await expect(page.locator('.admin-mobile-nav')).toHaveCount(0)
})

test('views administrativas operam em fluxo normal dentro de hrx-unified-content', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })

  for (const route of [
    { path: 'clientes', selector: '.hrx-clients-page' },
    { path: 'fiscal', selector: '.hrx-fiscal-page' },
    { path: 'documentos', selector: '.hrx-documents-page' },
    { path: 'suspensoes', selector: '.hrx-suspensions-page' },
  ]) {
    await page.goto(`/admin/${route.path}?hrx-preview=1`)
    await expect(page.locator('.hrx-unified-content')).toHaveCount(1)
    const view = page.locator(route.selector)
    await expect(view).toHaveCount(1)
    const position = await view.evaluate((el) => getComputedStyle(el).position)
    expect(position).toBe('relative')
    await expect(page.locator('[data-admin-shell]')).toHaveCount(1)
  }
})

test('subrota registrada preserva pathname, módulo pai e título sem criar tela paralela', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/admin/clientes/cliente-demo?hrx-preview=1')

  await expect(page.locator('.hrx-clients-page')).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/clientes\/cliente-demo\?hrx-preview=1$/)
  await expect(page.locator('[data-admin-shell]')).toHaveCount(1)
  await expect(page.locator('.hrx-unified-title span')).toHaveText('HRX ADMIN · Clientes')
  await expect(page.locator('.hrx-unified-title strong')).toHaveText('Cliente')
  await expect(page.getByRole('button', { name: 'Clientes' })).toHaveAttribute('aria-current', 'page')
  await expect(page).toHaveTitle('Cliente · HRX Admin')

  await page.goto('/admin/orcamentos/ORC-DEMO/editar?hrx-preview=1')
  await expect(page.locator('.quote-module-loading')).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/orcamentos\/ORC-DEMO\/editar\?hrx-preview=1$/)
  await expect(page.locator('.hrx-unified-title span')).toHaveText('HRX ADMIN · Orçamentos')
  await expect(page.locator('.hrx-unified-title strong')).toHaveText('Editar orçamento')
  await expect(page.getByRole('button', { name: 'Orçamentos' })).toHaveAttribute('aria-current', 'page')
  await expect(page).toHaveTitle('Editar orçamento · HRX Admin')

  await page.goBack()
  await expect(page).toHaveURL(/\/admin\/clientes\/cliente-demo\?hrx-preview=1$/)
  await expect(page.locator('.hrx-clients-page')).toBeVisible()
  await expect(page.locator('.hrx-unified-title strong')).toHaveText('Cliente')
})

test('subpath não registrado continua no módulo pai sem ser convertido em subrota fictícia', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/admin/clientes/cliente-demo/historico?hrx-preview=1')
  await expect(page.locator('.hrx-clients-page')).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/clientes\/cliente-demo\/historico\?hrx-preview=1$/)
  await expect(page.locator('.hrx-unified-title strong')).toHaveText('Clientes')
  await expect(page.locator('[data-admin-shell]')).toHaveCount(1)
})

test('topbar exibe título canônico e popover de perfil desktop mantém acessibilidade', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/clientes?hrx-preview=1')
  const pwaBrand = page.locator('.hrx-pwa-brand strong')
  await expect(pwaBrand).toBeVisible()
  await expect(pwaBrand).toHaveText('Clientes')

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/admin/clientes?hrx-preview=1')
  const profileButton = page.locator('.hrx-unified-profile')
  await expect(profileButton).toBeVisible()
  await profileButton.click()

  const popover = page.locator('.hrx-profile-popover')
  await expect(popover).toBeVisible()
  await expect(popover).toContainText('Administrador')
  await expect(popover).toContainText('Configurações da conta')
  await expect(popover).toContainText('Encerrar sessão')

  await page.keyboard.press('Escape')
  await expect(popover).toHaveCount(0)
})
