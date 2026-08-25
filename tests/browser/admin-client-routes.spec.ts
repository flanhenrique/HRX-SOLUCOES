import { expect, test } from '@playwright/test'

const clients = [
  {
    id: 'client-1',
    created_at: '2026-08-01T12:00:00.000Z',
    updated_at: '2026-08-20T12:00:00.000Z',
    name: 'Ana Cliente',
    company: 'Ana Serviços',
    email: 'ana@example.com',
    phone: '92999990001',
    document: '11111111111',
    notes: 'Cliente de teste da rota.',
    source: 'admin_manual',
    active: true,
    last_quote_at: '2026-08-20T12:00:00.000Z',
  },
  {
    id: 'client-2',
    created_at: '2026-08-02T12:00:00.000Z',
    updated_at: '2026-08-21T12:00:00.000Z',
    name: 'Bruno Cliente',
    company: 'Bruno Tecnologia',
    email: 'bruno@example.com',
    phone: '92999990002',
    document: '22222222222',
    notes: 'Segundo cliente de teste.',
    source: 'admin_manual',
    active: true,
    last_quote_at: '2026-08-21T12:00:00.000Z',
  },
]

const quoteRequests = [
  {
    id: 'quote-2',
    client_id: 'client-2',
    protocol: 'HRX-TEST-002',
    name: 'Bruno Cliente',
    company: 'Bruno Tecnologia',
    email: 'bruno@example.com',
    created_at: '2026-08-21T12:00:00.000Z',
    source: 'admin_manual',
  },
]

const quoteDrafts = [
  { request_id: 'quote-2', status: 'draft', final_amount: 2500 },
]

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: true })
  })

  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url()
    let body = '[]'
    if (url.includes('/clients?')) body = JSON.stringify(clients)
    else if (url.includes('/quote_requests?')) body = JSON.stringify(quoteRequests)
    else if (url.includes('/quote_drafts?')) body = JSON.stringify(quoteDrafts)

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-1/2' },
      body,
    })
  })
})

test('deep link de cliente seleciona exatamente o cadastro indicado pela URL', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/admin/clientes/client-2?hrx-preview=1')

  await expect(page).toHaveURL(/\/admin\/clientes\/client-2\?hrx-preview=1$/)
  await expect(page.locator('.hrx-client-detail h2')).toHaveText('Bruno Cliente')
  await expect(page.locator('.hrx-client-detail')).toContainText('Bruno Tecnologia')
  await expect(page.locator('.hrx-client-detail')).toContainText('R$ 2.500,00')
  await expect(page.getByRole('button', { name: /Bruno Cliente/ })).toHaveClass(/is-active/)
  await expect(page.locator('[data-admin-shell]')).toHaveCount(1)
})

test('clique e histórico do navegador mantêm seleção e pathname sincronizados', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/admin/clientes?hrx-preview=1')
  await expect(page.locator('.hrx-client-detail h2')).toHaveText('Ana Cliente')

  await page.getByRole('button', { name: /Bruno Cliente/ }).click()
  await expect(page).toHaveURL(/\/admin\/clientes\/client-2\?hrx-preview=1$/)
  await expect(page.locator('.hrx-client-detail h2')).toHaveText('Bruno Cliente')

  await page.goBack()
  await expect(page).toHaveURL(/\/admin\/clientes\?hrx-preview=1$/)
  await expect(page.locator('.hrx-client-detail h2')).toHaveText('Bruno Cliente')

  await page.goForward()
  await expect(page).toHaveURL(/\/admin\/clientes\/client-2\?hrx-preview=1$/)
  await expect(page.locator('.hrx-client-detail h2')).toHaveText('Bruno Cliente')
})

test('ID de cliente inexistente não abre outro cadastro por fallback silencioso', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/clientes/client-missing?hrx-preview=1')

  await expect(page).toHaveURL(/\/admin\/clientes\/client-missing\?hrx-preview=1$/)
  await expect(page.getByRole('heading', { name: 'Cliente não encontrado' })).toBeVisible()
  await expect(page.locator('.hrx-client-detail h2')).toHaveCount(0)
  await expect(page.locator('[data-admin-shell]')).toHaveCount(1)
})
