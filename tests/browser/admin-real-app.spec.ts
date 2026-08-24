import { expect, test } from '@playwright/test'

const emptyQuotePayload = {
  requests: [],
  clients: [],
  providers: [],
  pricingRules: [],
  metrics: { pipeline: 0, drafts: 0, negotiation: 0, approved: 0, total: 0 },
}

test.beforeEach(async ({ page }) => {
  await page.route('**/functions/v1/quote-admin**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyQuotePayload) })
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

test('aplicativo React real mantém um único shell e Orçamentos como view pura no mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/orcamentos?hrx-preview=1')

  const shell = page.locator('[data-admin-shell="pwa"]')
  await expect(shell).toHaveCount(1)
  await expect(shell).toBeVisible()
  await expect(page.locator('[data-admin-shell]')).toHaveCount(1)
  await expect(page.locator('.quote-commercial-shell')).toHaveCount(1)
  await expect(page.locator('.quote-commercial-shell > .admin-exec-sidebar')).toHaveCount(0)
  await expect(page.locator('.quote-commercial-shell > .hrx-mobile-nav')).toHaveCount(0)
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

test('navegação real preserva deep link e histórico entre Orçamentos e Configurações', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 })
  await page.goto('/admin/orcamentos?hrx-preview=1')
  await expect(page.locator('.quote-commercial-shell')).toBeVisible()
  await expect(page).toHaveURL(/#admin\/orcamentos$/)

  await page.getByRole('button', { name: 'Perfil' }).click()
  await expect(page).toHaveURL(/#admin\/configuracoes$/)
  await expect(page.getByRole('heading', { name: /Configurações/i })).toBeVisible()
  await expect(page.locator('[data-admin-shell]')).toHaveCount(1)

  await page.goBack()
  await expect(page).toHaveURL(/#admin\/orcamentos$/)
  await expect(page.locator('.quote-commercial-shell')).toBeVisible()
  await expect(page.locator('[data-admin-shell]')).toHaveCount(1)
})
