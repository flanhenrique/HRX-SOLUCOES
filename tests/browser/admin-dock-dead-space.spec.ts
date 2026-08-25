import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const staticAdminCss = await Promise.all([
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

// AdminQuotes é lazy-loaded. Na aplicação real estes estilos entram DEPOIS do shell.
const lazyQuoteCss = await Promise.all([
  readFile(new URL('../../src/quotes/quotes.css', import.meta.url), 'utf8'),
  readFile(new URL('../../src/quotes/quote-commercial.css', import.meta.url), 'utf8'),
]).then((parts) => parts.join('\n'))

const proposal = (index: number) => `
  <button type="button" class="admin-lead${index === 0 ? ' is-active' : ''}">
    <div class="admin-lead-top"><span class="quote-status-dot ${index === 0 ? 'is-approved' : 'is-cancelled'}"></span><span>${index === 0 ? 'APROVADO' : 'CANCELADO'}</span><time>23/08/2026</time></div>
    <strong>${index === 0 ? 'HORTIFRUTI REVOLUCAO' : index === 1 ? 'EVELYN PINTO DO CARMO' : 'HUGO'}</strong>
    <small>Criação e Manutenção de PWA</small>
    <div class="admin-lead-bottom"><span>HRX-ORC-2026-${String(index + 1).padStart(6, '0')}</span><b>R$ 500,00</b></div>
  </button>`

async function mount(page: import('@playwright/test').Page) {
  const proposals = Array.from({ length: 3 }, (_, index) => proposal(index)).join('')
  await page.setContent(`<!doctype html>
  <html lang="pt-BR" class="hrx-admin-pwa" data-hrx-theme-resolved="light">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover" />
      <style>html,body,#root{margin:0;width:100%;height:100%}${staticAdminCss}${lazyQuoteCss}</style>
    </head>
    <body class="hrx-admin-pwa"><div id="root">
      <div class="hrx-unified-shell is-pwa" data-admin-shell="pwa" data-runtime="standalone" data-viewport="phone">
        <header class="hrx-glass-topbar hrx-unified-topbar hrx-pwa-topbar">
          <div class="hrx-pwa-brand"><div><span>HRX ADMIN</span><strong>Orçamentos</strong></div></div>
          <div class="hrx-unified-actions"><button class="hrx-notifications">♢</button><button class="hrx-pwa-more">•••</button></div>
        </header>
        <main class="hrx-unified-content" data-admin-workspace="true">
          <main class="admin-live-shell quote-commercial-shell">
            <section class="admin-exec-main">
              <header class="admin-exec-topbar quote-topbar"><div><span class="admin-section-kicker">OPERAÇÃO COMERCIAL</span><h1>Orçamentos</h1></div><div><button class="quote-primary">＋ Novo orçamento</button></div></header>
              <section class="admin-exec-metrics quote-metrics">
                <article><span>Pipeline comercial</span><strong>R$ 500,00</strong><small>Propostas em aberto</small></article>
                <article><span>Rascunhos</span><strong>0</strong><small>Podem ser continuados</small></article>
                <article><span>Em negociação</span><strong>0</strong><small>Revisadas ou enviadas</small></article>
                <article><span>Aprovadas</span><strong>1</strong><small>Preparadas para o financeiro</small></article>
              </section>
              <div class="admin-workspace quote-workspace">
                <aside class="admin-queue quote-queue">
                  <div class="admin-queue-header"><div><strong>Propostas</strong><span>3</span></div><label class="admin-search"><span>⌕</span><input placeholder="Cliente, CNPJ ou número" /></label><select><option>Todos os estados</option></select></div>
                  <div class="admin-queue-list">${proposals}</div>
                </aside>
              </div>
            </section>
          </main>
        </main>
        <nav class="hrx-mobile-nav hrx-unified-mobile-nav" aria-label="Navegação principal do aplicativo">
          <button><i>⌂</i><span>Início</span></button><button><i>▣</i><span>Projetos</span></button><button class="is-active"><i>◫</i><span>Orçamentos</span></button><button><i>▤</i><span>Docs</span></button><button><i>⚙</i><span>Perfil</span></button>
        </nav>
      </div>
    </div></body>
  </html>`)
}

test('Orçamentos não cria faixa vazia de 58px/ safe-area depois do último card', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await mount(page)

  const geometry = await page.evaluate(() => {
    const content = document.querySelector('.hrx-unified-content') as HTMLElement
    const route = document.querySelector('.quote-commercial-shell') as HTMLElement
    const exec = document.querySelector('.quote-commercial-shell > .admin-exec-main') as HTMLElement
    const workspace = document.querySelector('.quote-workspace') as HTMLElement
    const queueList = document.querySelector('.admin-queue-list') as HTMLElement
    const last = document.querySelector('.admin-lead:last-child') as HTMLElement
    const dock = document.querySelector('.hrx-unified-mobile-nav') as HTMLElement
    content.scrollTop = content.scrollHeight
    const lastRect = last.getBoundingClientRect()
    const dockRect = dock.getBoundingClientRect()
    return {
      viewportHeight: window.innerHeight,
      contentPaddingBottom: parseFloat(getComputedStyle(content).paddingBottom),
      routePaddingBottom: parseFloat(getComputedStyle(route).paddingBottom),
      execPaddingBottom: parseFloat(getComputedStyle(exec).paddingBottom),
      workspacePaddingBottom: parseFloat(getComputedStyle(workspace).paddingBottom),
      queuePaddingBottom: parseFloat(getComputedStyle(queueList).paddingBottom),
      lastMarginBottom: parseFloat(getComputedStyle(last).marginBottom),
      lastBottom: lastRect.bottom,
      dockBottomGap: window.innerHeight - dockRect.bottom,
      deadSpaceAfterLast: window.innerHeight - lastRect.bottom,
    }
  })

  expect(geometry.contentPaddingBottom).toBe(0)
  expect(geometry.routePaddingBottom).toBe(0)
  expect(geometry.execPaddingBottom).toBe(0)
  expect(geometry.workspacePaddingBottom).toBe(0)
  expect(geometry.queuePaddingBottom).toBeLessThanOrEqual(8)
  expect(geometry.lastMarginBottom).toBe(0)
  expect(geometry.dockBottomGap).toBeLessThanOrEqual(10)
  expect(geometry.deadSpaceAfterLast).toBeLessThanOrEqual(12)
})
