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

const client = {
  id: 'client-route-test',
  name: 'Cliente Rota',
  company: 'Cliente Rota Ltda',
  email: 'cliente@example.com',
  phone: '92999990000',
  document: '11111111111',
  notes: null,
  active: true,
}

async function activateButton(button: Locator) {
  await button.focus()
  await button.press('Enter')
}

function makeQuote(id: string, status: 'draft' | 'approved', title: string, number: string) {
  const approved = status === 'approved'
  return {
    id,
    client_id: client.id,
    protocol: `HRX-${number}`,
    proposal_number: number,
    created_at: '2026-08-25T12:00:00.000Z',
    updated_at: '2026-08-25T12:00:00.000Z',
    name: client.name,
    email: client.email,
    phone: client.phone,
    company: client.company,
    request_text: 'Escopo de teste da rota comercial.',
    status: approved ? 'approved' : 'draft',
    draft: {
      id: `draft-${id}`,
      request_id: id,
      base_amount: 1000,
      complexity_multiplier: 1,
      urgency_multiplier: 1,
      pre_discount_amount: 1000,
      discount_percent: 0,
      discount_amount: 0,
      tax_percent: 0,
      tax_amount: 0,
      final_amount: 1000,
      custom_final_amount: null,
      custom_adjustment_reason: null,
      payment_provider: 'none',
      payment_mode: 'cash',
      installments: 1,
      installment_interval_days: 30,
      first_due_date: '2026-09-01',
      payment_fee_total: 0,
      retentions: { iss: 0, irrf: 0, pis: 0, cofins: 0, csll: 0, inss: 0 },
      retention_total: 0,
      retention_pricing_mode: 'informational',
      estimated_net: 1000,
      fiscal_review_required: false,
      fiscal_review_confirmed: false,
      proposal_title: title,
      project_service: 'Serviço de teste',
      proposal_description: 'Descrição de teste.',
      customer_notes: '',
      notes: '',
      validity_days: 15,
      valid_until: '2026-09-09',
      commercial_status: status,
      current_version: approved ? 1 : 0,
      approved_version: approved ? 1 : null,
      status: approved ? 'approved' : 'draft',
      updated_at: '2026-08-25T12:00:00.000Z',
      items: [{ id: `item-${id}`, service_key: null, service_name: 'Serviço de teste', item_description: '', unit_label: 'un.', quantity: 1, unit_amount: 1000, total_amount: 1000 }],
      paymentInstallments: [{ id: `installment-${id}`, installment_number: 1, amount: 1000, due_date: '2026-09-01', status: 'pending' }],
    },
    versions: approved ? [{ id: `version-${id}`, version_number: 1, commercial_status: 'approved', created_at: '2026-08-25T12:00:00.000Z' }] : [],
    audit: [],
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, value)
    Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: true })
  }, { key: AUTH_KEY, value: JSON.stringify(previewSession) })

  let requests = [
    makeQuote('quote-draft', 'draft', 'Proposta Draft', 'HRX-2026-001'),
    makeQuote('quote-readonly', 'approved', 'Proposta Aprovada', 'HRX-2026-002'),
  ]

  await page.route('**/functions/v1/quote-admin', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          requests,
          clients: [client],
          providers: [],
          pricingRules: [],
          metrics: { pipeline: 1000, drafts: 1, negotiation: 0, approved: 1, total: 2 },
        }),
      })
      return
    }

    const payload = request.postDataJSON() as { action?: string; requestId?: string; proposalTitle?: string }
    if (payload.action === 'create_quote') {
      const created = makeQuote('quote-new', 'draft', payload.proposalTitle || 'Nova proposta', 'HRX-2026-003')
      requests = [created, ...requests]
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ request: { id: created.id } }) })
      return
    }
    if (payload.action === 'delete_draft' && payload.requestId) {
      requests = requests.filter((item) => item.id !== payload.requestId)
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
      return
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })

  await page.route('**/rest/v1/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' })
  })
})

test('deep link de edição abre exatamente a proposta indicada e mantém um único editor', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/admin/orcamentos/quote-draft/editar?hrx-preview=1')

  await expect(page).toHaveURL(/\/admin\/orcamentos\/quote-draft\/editar\?hrx-preview=1$/)
  await expect(page.locator('.quote-editor-header h2')).toHaveText('Proposta Draft')
  await expect(page.locator('.quote-editor')).toHaveCount(1)
  await expect(page.locator('.admin-lead.is-active')).toContainText('HRX-2026-001')
  await expect(page).toHaveTitle('Editar orçamento · HRX Admin')
  await expect(page.locator('[data-admin-shell]')).toHaveCount(1)
})

test('cliques escolhem rota de edição ou detalhe e back/forward restaura a proposta', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/admin/orcamentos?hrx-preview=1')
  await expect(page.locator('.quote-editor-header h2')).toHaveText('Proposta Draft')

  await activateButton(page.locator('.admin-lead').filter({ hasText: 'HRX-2026-002' }))
  await expect(page).toHaveURL(/\/admin\/orcamentos\/quote-readonly\?hrx-preview=1$/)
  await expect(page.locator('.quote-editor-header h2')).toHaveText('Proposta Aprovada')
  await expect(page.locator('.quote-readonly-banner')).toBeVisible()

  await activateButton(page.locator('.admin-lead').filter({ hasText: 'HRX-2026-001' }))
  await expect(page).toHaveURL(/\/admin\/orcamentos\/quote-draft\/editar\?hrx-preview=1$/)
  await expect(page.locator('.quote-editor-header h2')).toHaveText('Proposta Draft')

  await page.goBack()
  await expect(page).toHaveURL(/\/admin\/orcamentos\/quote-readonly\?hrx-preview=1$/)
  await expect(page.locator('.quote-editor-header h2')).toHaveText('Proposta Aprovada')

  await page.goForward()
  await expect(page).toHaveURL(/\/admin\/orcamentos\/quote-draft\/editar\?hrx-preview=1$/)
  await expect(page.locator('.quote-editor-header h2')).toHaveText('Proposta Draft')
})

test('ID inexistente não seleciona outra proposta por fallback silencioso', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/orcamentos/quote-missing/editar?hrx-preview=1')

  await expect(page).toHaveURL(/\/admin\/orcamentos\/quote-missing\/editar\?hrx-preview=1$/)
  await expect(page.getByText('Orçamento não encontrado', { exact: true })).toBeVisible()
  await expect(page.locator('.quote-editor')).toHaveCount(0)
  await expect(page.locator('[data-admin-shell]')).toHaveCount(1)
})

test('criação navega para o novo rascunho e exclusão retorna à lista canônica', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/admin/orcamentos?hrx-preview=1')
  await expect(page.locator('.quote-editor')).toHaveCount(1)

  await activateButton(page.getByRole('button', { name: /Novo orçamento/ }))
  await page.locator('.quote-client-results button').first().click()
  await page.getByPlaceholder('Ex.: Implantação e consultoria').fill('Nova proposta por rota')
  await page.getByRole('button', { name: 'Criar rascunho' }).click()

  await expect(page).toHaveURL(/\/admin\/orcamentos\/quote-new\/editar\?hrx-preview=1$/)
  await expect(page.locator('.quote-editor-header h2')).toHaveText('Nova proposta por rota')

  await page.getByRole('button', { name: /Excluir rascunho/ }).click()
  await page.getByRole('button', { name: /Excluir definitivamente/ }).click()

  await expect(page).toHaveURL(/\/admin\/orcamentos\?hrx-preview=1$/)
  await expect(page.locator('.quote-editor-header h2')).not.toHaveText('Nova proposta por rota')
})
