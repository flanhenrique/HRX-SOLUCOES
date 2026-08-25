import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

// AdminApp carrega o shell primeiro; AdminQuotes é lazy e injeta o CSS da rota depois.
const staticCss = await Promise.all([
  readFile(new URL('../../src/quotes/admin-page-system.css', import.meta.url), 'utf8'),
  readFile(new URL('../../src/quotes/admin-feedback.css', import.meta.url), 'utf8'),
  readFile(new URL('../../src/quotes/admin-interactions.css', import.meta.url), 'utf8'),
  readFile(new URL('../../src/quotes/admin-executive-intelligence.css', import.meta.url), 'utf8'),
  readFile(new URL('../../src/quotes/admin-liquid-glass.css', import.meta.url), 'utf8'),
  readFile(new URL('../../src/quotes/admin-responsive-hardening.css', import.meta.url), 'utf8'),
  readFile(new URL('../../src/quotes/admin-mobile-safe-area-fixes.css', import.meta.url), 'utf8'),
  readFile(new URL('../../src/quotes/admin-unified-shell.css', import.meta.url), 'utf8'),
  readFile(new URL('../../src/quotes/admin-unified-chrome.css', import.meta.url), 'utf8'),
  readFile(new URL('../../src/quotes/admin-mobile-usability-fixes.css', import.meta.url), 'utf8'),
  readFile(new URL('../../src/quotes/admin-mobile-floating-dock-fix.css', import.meta.url), 'utf8'),
]).then((parts) => parts.join('\n'))

const lazyQuoteCss = await Promise.all([
  readFile(new URL('../../src/quotes/quotes.css', import.meta.url), 'utf8'),
  readFile(new URL('../../src/quotes/quote-commercial.css', import.meta.url), 'utf8'),
]).then((parts) => parts.join('\n'))

const css = `${staticCss}\n${lazyQuoteCss}`

const proposal = (index: number) => `
  <button type="button" class="admin-lead${index === 0 ? ' is-active' : ''}">
    <div class="admin-lead-top"><span class="quote-status-dot is-approved"></span><span>APROVADO</span><time>23/08/2026</time></div>
    <strong>${index === 0 ? 'HORTIFRUTI REVOLUÇÃO' : `Cliente ${index + 1}`}</strong>
    <small>Criação e Manutenção de PWA</small>
    <div class="admin-lead-bottom"><span>HRX-ORC-2026-${String(index + 1).padStart(6, '0')}</span><b>R$ 2.500,00</b></div>
  </button>`

async function mountQuoteScreen(page: import('@playwright/test').Page) {
  const proposals = Array.from({ length: 10 }, (_, index) => proposal(index)).join('')
  await page.setContent(`<!doctype html>
    <html lang="pt-BR" class="hrx-admin-pwa" data-hrx-theme-resolved="light">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <style>html,body,#root{margin:0;width:100%;height:100%;background:#061325}${css}</style>
      </head>
      <body class="hrx-admin-pwa"><div id="root">
        <div class="hrx-unified-shell is-pwa" data-admin-shell="pwa" data-runtime="standalone" data-viewport="phone">
          <header class="hrx-glass-topbar hrx-unified-topbar hrx-pwa-topbar">
            <div class="hrx-pwa-brand">
              <img alt="HRX Solutions" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='44'%3E%3Crect width='90' height='44' fill='white'/%3E%3C/svg%3E" />
              <div><span>HRX ADMIN</span><strong>Orçamentos</strong></div>
            </div>
            <div class="hrx-unified-actions">
              <button class="hrx-notifications" type="button" aria-label="2 notificações"><i aria-hidden="true">♢</i><span>2</span></button>
              <button class="hrx-pwa-more" type="button" aria-label="Abrir mais áreas">•••</button>
            </div>
          </header>

          <main class="hrx-unified-content" data-admin-workspace="true">
            <main class="admin-live-shell quote-commercial-shell">
              <section class="admin-exec-main">
                <header class="admin-exec-topbar quote-topbar">
                  <div><span class="admin-section-kicker">OPERAÇÃO COMERCIAL</span><h1>Orçamentos e propostas</h1></div>
                  <div><button class="quote-secondary">Atualizar</button><button class="quote-primary">＋ Novo orçamento</button></div>
                </header>
                <section class="admin-exec-metrics quote-metrics">
                  <article><span>Pipeline comercial</span><strong>R$ 7.500,00</strong><small>Propostas em aberto</small></article>
                  <article><span>Rascunhos</span><strong>1</strong><small>Podem ser continuados</small></article>
                  <article><span>Em negociação</span><strong>1</strong><small>Revisadas ou enviadas</small></article>
                  <article><span>Aprovadas</span><strong>3</strong><small>Preparadas para o financeiro</small></article>
                </section>
                <div class="admin-workspace quote-workspace">
                  <aside class="admin-queue quote-queue">
                    <div class="admin-queue-header">
                      <div><strong>Propostas</strong><span>10</span></div>
                      <label class="admin-search"><span>⌕</span><input placeholder="Cliente, CNPJ ou número" /></label>
                      <select><option>Todos os estados</option></select>
                    </div>
                    <div class="admin-queue-list">${proposals}</div>
                  </aside>
                </div>
              </section>
            </main>
          </main>

          <nav class="hrx-mobile-nav hrx-unified-mobile-nav" aria-label="Navegação principal do aplicativo">
            <button type="button"><i>⌂</i><span>Início</span></button>
            <button type="button"><i>▣</i><span>Projetos</span></button>
            <button type="button" class="is-active"><i>◫</i><span>Orçamentos</span></button>
            <button type="button"><i>▤</i><span>Docs</span></button>
            <button type="button"><i>⚙</i><span>Perfil</span></button>
          </nav>
        </div>
      </div></body>
    </html>`)
}

test('quote list is compact, legible and scrolls behind the floating dock on iPhone-sized PWA', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 })
  await mountQuoteScreen(page)

  const content = page.locator('.hrx-unified-content')
  const quoteTopbar = page.locator('.quote-topbar')
  const contentBox = await content.boundingBox()
  const quoteTopbarBox = await quoteTopbar.boundingBox()
  expect(contentBox).not.toBeNull()
  expect(quoteTopbarBox).not.toBeNull()
  expect(Math.abs(quoteTopbarBox!.y - contentBox!.y)).toBeLessThanOrEqual(1)
  expect(quoteTopbarBox!.height).toBeLessThanOrEqual(72)
  await expect(quoteTopbar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')

  const metrics = page.locator('.quote-metrics article')
  await expect(metrics).toHaveCount(4)
  for (let index = 0; index < 4; index += 1) {
    const box = await metrics.nth(index).boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeLessThanOrEqual(76)
  }

  await expect(page.locator('.quote-metrics article').first().locator('strong')).toHaveCSS('color', 'rgb(16, 34, 53)')
  await expect(page.locator('.quote-queue .admin-queue-header strong')).toHaveCSS('color', 'rgb(24, 49, 73)')
  await expect(page.locator('.quote-queue .admin-lead').first().locator('strong')).toHaveCSS('color', 'rgb(24, 49, 73)')

  const bottomPadding = await content.evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingBottom))
  expect(bottomPadding).toBe(0)

  await content.evaluate((element) => { element.scrollTop = element.scrollHeight })
  const lastProposal = await page.locator('.admin-lead').last().boundingBox()
  const dock = await page.locator('.hrx-unified-mobile-nav').boundingBox()
  expect(lastProposal).not.toBeNull()
  expect(dock).not.toBeNull()

  // O dock é overlay: no fim da lista o conteúdo pode passar por trás da cápsula,
  // mas a cápsula deve estar colada ao fundo físico, sem uma faixa reservada abaixo.
  expect(lastProposal!.y + lastProposal!.height).toBeGreaterThan(dock!.y)
  expect(932 - (dock!.y + dock!.height)).toBeLessThanOrEqual(10)

  const geometry = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, width: window.innerWidth }))
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width)
})

test('short quote list keeps the light surface painted to the physical bottom of the PWA', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 })
  await mountQuoteScreen(page)
  await page.locator('.admin-lead').nth(1).evaluate((element) => {
    let current = element
    while (current) {
      const next = current.nextElementSibling
      current.remove()
      current = next as HTMLElement | null
    }
  })

  const shell = page.locator('.hrx-unified-shell.is-pwa')
  const content = page.locator('.hrx-unified-content')
  const dock = page.locator('.hrx-unified-mobile-nav')
  const shellBox = await shell.boundingBox()
  const contentBox = await content.boundingBox()
  const dockBox = await dock.boundingBox()
  expect(shellBox).not.toBeNull()
  expect(contentBox).not.toBeNull()
  expect(dockBox).not.toBeNull()
  expect(contentBox!.y + contentBox!.height).toBeGreaterThanOrEqual(shellBox!.y + shellBox!.height - 1)
  expect(932 - (dockBox!.y + dockBox!.height)).toBeLessThanOrEqual(10)

  const surfaces = await page.evaluate(() => {
    const shellElement = document.querySelector('.hrx-unified-shell.is-pwa') as HTMLElement
    const contentElement = document.querySelector('.hrx-unified-content') as HTMLElement
    return {
      display: getComputedStyle(shellElement).display,
      shellBackground: getComputedStyle(shellElement).backgroundImage,
      contentBackground: getComputedStyle(contentElement).backgroundImage,
      contentPaddingBottom: getComputedStyle(contentElement).paddingBottom,
    }
  })
  expect(surfaces.display).toBe('flex')
  expect(surfaces.shellBackground).toContain('rgb(238, 244, 250)')
  expect(surfaces.contentBackground).toContain('rgb(238, 244, 250)')
  expect(surfaces.contentPaddingBottom).toBe('0px')
})