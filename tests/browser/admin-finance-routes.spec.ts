import { expect, test, type Locator } from '@playwright/test'

const AUTH_KEY = 'sb-tgcdkofplegmjvvkheyd-auth-token'

const previewSession = {
  access_token: 'hrx-preview-access-token',
  refresh_token: 'hrx-preview-refresh-token',
  expires_in: 3600,
  expires_at: 4102444800,
  token_type: 'bearer',
  user: {
    id: '00000000-0000-4000-8000-000000000001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'preview@hrxsolutions.com.br',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    created_at: '2026-08-25T00:00:00.000Z',
  },
}

const financeResponse = {
  entries: [
    {
      id: 'receivable-1',
      entry_type: 'receivable',
      status: 'open',
      description: 'Parcela teste',
      client_id: null,
      quote_request_id: null,
      quote_version_id: null,
      installment_number: 1,
      invoice_number: 'NFS-e 1',
      invoice_issued_at: '2026-08-01',
      competence_date: '2026-08-01',
      gross_amount: 1500,
      paid_amount: 0,
      tax_reserve_amount: 0,
      due_date: '2026-08-30',
      category: null,
      notes: null,
      source: 'test',
    },
    {
      id: 'payable-1',
      entry_type: 'payable',
      status: 'open',
      description: 'Despesa teste',
      counterparty_name: 'Fornecedor Teste',
      gross_amount: 800,
      paid_amount: 0,
      due_date: '2026-08-29',
      category: 'Operacional',
      competence_date: '2026-08-01',
      source: 'test',
    },
  ],
  accounts: [],
  settlements: [],
  drafts: [],
  requests: [],
  clients: [],
  installments: [],
  versions: [],
  metrics: {
    outstanding: 1500,
    payable: 800,
    projected: 700,
    overdueReceivable: 0,
    overduePayable: 0,
    reserve: 0,
    receivedMonth: 0,
  },
}

async function activateButton(button: Locator) {
  await button.focus()
  await button.press('Enter')
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, value)
    Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: true })
  }, { key: AUTH_KEY, value: JSON.stringify(previewSession) })

  await page.route('**/functions/v1/finance-admin', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(financeResponse) })
  })

  await page.route('**/rest/v1/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' })
  })
})

test('deep link /receber abre HRX Solutions e Contas a receber', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/admin/financeiro/receber?hrx-preview=1')

  await expect(page).toHaveURL(/\/admin\/financeiro\/receber\?hrx-preview=1$/)
  await expect(page.locator('.finance-scope-root')).toHaveAttribute('data-finance-scope', 'business')
  await expect(page.getByRole('button', { name: /Contas a receber/ })).toHaveClass(/is-active/)
  await expect(page.getByText('Parcela teste')).toBeVisible()
  await expect(page.locator('[data-admin-shell]')).toHaveCount(1)
})

test('deep link /pagar prevalece sobre preferência anterior de Financeiro Pessoal', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('hrx-finance-scope', 'personal'))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/financeiro/pagar?hrx-preview=1')

  await expect(page).toHaveURL(/\/admin\/financeiro\/pagar\?hrx-preview=1$/)
  await expect(page.locator('.finance-scope-root')).toHaveAttribute('data-finance-scope', 'business')
  await expect(page.getByRole('button', { name: /Contas a pagar/ })).toHaveClass(/is-active/)
  await expect(page.getByText('Fornecedor Teste')).toBeVisible()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('hrx-finance-scope'))).toBe('business')
})

test('cliques e histórico sincronizam receber e pagar com pathname', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/admin/financeiro?hrx-preview=1')

  const receivable = page.getByRole('button', { name: /Contas a receber/ })
  const payable = page.getByRole('button', { name: /Contas a pagar/ })

  await activateButton(receivable)
  await expect(page).toHaveURL(/\/admin\/financeiro\/receber\?hrx-preview=1$/)
  await expect(receivable).toHaveClass(/is-active/)

  await activateButton(payable)
  await expect(page).toHaveURL(/\/admin\/financeiro\/pagar\?hrx-preview=1$/)
  await expect(payable).toHaveClass(/is-active/)

  await page.goBack()
  await expect(page).toHaveURL(/\/admin\/financeiro\/receber\?hrx-preview=1$/)
  await expect(receivable).toHaveClass(/is-active/)

  await page.goForward()
  await expect(page).toHaveURL(/\/admin\/financeiro\/pagar\?hrx-preview=1$/)
  await expect(payable).toHaveClass(/is-active/)
})

test('trocar para Pessoal a partir de subrota empresarial retorna à raiz do Financeiro', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/admin/financeiro/receber?hrx-preview=1')

  await activateButton(page.getByRole('button', { name: 'Pessoal' }))

  await expect(page).toHaveURL(/\/admin\/financeiro\?hrx-preview=1$/)
  await expect(page.locator('.finance-scope-root')).toHaveAttribute('data-finance-scope', 'personal')
  await expect(page.getByRole('heading', { name: 'Contas pessoais' })).toBeVisible()
  await expect(page.locator('[data-admin-shell]')).toHaveCount(1)
})
