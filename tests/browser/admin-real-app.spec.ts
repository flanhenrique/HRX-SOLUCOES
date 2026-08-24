import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/rest/v1/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/0' },
      body: '[]',
    })
  })
})

test('aplicativo React real mantém um único shell e Projetos como view normal no mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/?hrx-preview=1#admin/painels')

  const shell = page.locator('[data-admin-shell="pwa"]')
  await expect(shell).toHaveCount(1)
  await expect(shell).toBeVisible()
  await expect(page.locator('[data-admin-shell]')).toHaveCount(1)
  await expect(page.locator('.admin-projects-shell')).toHaveCount(1)
  await expect(page.locator('.admin-projects-shell')).not.toHaveAttribute('role', 'dialog')
  await expect(page.locator('.admin-projects-close')).toHaveCount(0)
  await expect(page.locator('.hrx-unified-mobile-nav')).toHaveCount(1)
  await expect(page.getByRole('button', { name: /notifica/i })).toBeVisible()

  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    shells: document.querySelectorAll('[data-admin-shell]').length,
  }))
  expect(geometry.shells).toBe(1)
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth)
})

test('navegação React real preserva deep link e histórico entre Projetos e Configurações', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 })
  await page.goto('/admin/?hrx-preview=1#admin/painels')
  await expect(page.locator('.admin-projects-shell')).toBeVisible()
  await expect(page).toHaveURL(/#admin\/painels$/)

  await page.getByRole('button', { name: 'Perfil' }).click()
  await expect(page).toHaveURL(/#admin\/configuracoes$/)
  await expect(page.locator('.hrx-settings-view')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Alterar senha/i })).toBeVisible()
  await expect(page.locator('[data-admin-shell]')).toHaveCount(1)

  await page.goBack()
  await expect(page).toHaveURL(/#admin\/painels$/)
  await expect(page.locator('.admin-projects-shell')).toBeVisible()
  await expect(page.locator('[data-admin-shell]')).toHaveCount(1)
})

test('trocar para Orçamentos não monta outro shell mesmo sem sessão de teste', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/?hrx-preview=1#admin/painels')
  await page.getByRole('button', { name: 'Orçamentos' }).click()

  await expect(page).toHaveURL(/#admin\/orcamentos$/)
  await expect(page.locator('[data-admin-shell]')).toHaveCount(1)
  await expect(page.locator('.quote-module-loading')).toBeVisible()
  await expect(page.locator('.admin-exec-sidebar')).toHaveCount(0)
  await expect(page.locator('.admin-mobile-nav')).toHaveCount(0)
})

test('views administrativas operam em fluxo normal dentro de hrx-unified-content sem position fixed', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/admin/?hrx-preview=1#admin/clientes')

  const content = page.locator('.hrx-unified-content')
  await expect(content).toHaveCount(1)

  // Testa Clientes
  const clientsPage = page.locator('.hrx-clients-page')
  await expect(clientsPage).toHaveCount(1)
  const clientsPosition = await clientsPage.evaluate((el) => getComputedStyle(el).position)
  expect(clientsPosition).toBe('relative')

  // Testa Fiscal
  await page.goto('/admin/?hrx-preview=1#admin/fiscal')
  const fiscalPage = page.locator('.hrx-fiscal-page')
  await expect(fiscalPage).toHaveCount(1)
  const fiscalPosition = await fiscalPage.evaluate((el) => getComputedStyle(el).position)
  expect(fiscalPosition).toBe('relative')

  // Testa Documentos
  await page.goto('/admin/?hrx-preview=1#admin/documentos')
  const docsPage = page.locator('.hrx-documents-page')
  await expect(docsPage).toHaveCount(1)
  const docsPosition = await docsPage.evaluate((el) => getComputedStyle(el).position)
  expect(docsPosition).toBe('relative')

  // Testa Suspensões
  await page.goto('/admin/?hrx-preview=1#admin/suspensoes')
  const suspPage = page.locator('.hrx-suspensions-page')
  await expect(suspPage).toHaveCount(1)
  const suspPosition = await suspPage.evaluate((el) => getComputedStyle(el).position)
  expect(suspPosition).toBe('relative')
})

test('topbar mobile exibe título canônico e popover de perfil desktop opera com acessibilidade', async ({ page }) => {
  // 1. Mobile PWA topbar title check
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/?hrx-preview=1#admin/clientes')
  const pwaBrand = page.locator('.hrx-pwa-brand strong')
  await expect(pwaBrand).toBeVisible()
  await expect(pwaBrand).toHaveText('Clientes')

  // 2. Desktop profile popover
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/admin/?hrx-preview=1#admin/clientes')
  const profileButton = page.locator('.hrx-unified-profile')
  await expect(profileButton).toBeVisible()
  await profileButton.click()

  const popover = page.locator('.hrx-profile-popover')
  await expect(popover).toBeVisible()
  await expect(popover).toContainText('Administrador')
  await expect(popover).toContainText('Configurações da conta')
  await expect(popover).toContainText('Encerrar sessão')

  // Fecha via Escape
  await page.keyboard.press('Escape')
  await expect(popover).toHaveCount(0)
})

