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
  await expect(page.getByRole('heading', { name: /Configurações/i })).toBeVisible()
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
