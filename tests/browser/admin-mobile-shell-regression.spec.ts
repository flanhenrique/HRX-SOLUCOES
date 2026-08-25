import { expect, test, type Page } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const readCss = (path: string) => readFile(new URL(`../../src/quotes/${path}`, import.meta.url), 'utf8')

const staticCss = await Promise.all([
  'admin-page-system.css',
  'admin-feedback.css',
  'admin-interactions.css',
  'admin-executive-intelligence.css',
  'admin-liquid-glass.css',
  'admin-responsive-hardening.css',
  'admin-unified-shell.css',
  'admin-unified-chrome.css',
].map(readCss)).then((parts) => parts.join('\n'))

const lazyQuoteCss = await Promise.all([
  'quotes.css',
  'quote-commercial.css',
  'admin-quotes-mobile.css',
].map(readCss)).then((parts) => parts.join('\n'))

const lazyFinanceCss = await Promise.all([
  'admin-finance.css',
  'admin-finance-scope.css',
].map(readCss)).then((parts) => parts.join('\n'))

const evidenceDir = fileURLToPath(new URL('../../DOCUMENTOS/03_PROJETOS_INTERNOS/HRX_ADMIN_PWA/EVIDENCIAS/', import.meta.url))
const evidencePath = (name: string) => `${evidenceDir}/${name}`

type FixtureOptions = {
  items?: number
  route?: 'generic' | 'quotes' | 'finance'
  modal?: boolean
}

const cards = (count: number, className = 'test-item') => Array.from({ length: count }, (_, index) => (
  `<article class="${className}" data-index="${index}" style="min-height:96px;margin:0 12px 10px;padding:14px;border:1px solid #cad8e5;border-radius:12px;background:#fff">Item ${index + 1}</article>`
)).join('')

function routeMarkup(route: FixtureOptions['route'], count: number) {
  if (route === 'quotes') return `
    <main class="admin-live-shell quote-commercial-shell">
      <section class="admin-exec-main">
        <header class="admin-exec-topbar quote-topbar"><div><h1>Orçamentos</h1></div><div><button class="quote-primary">＋ Novo orçamento</button></div></header>
        <section class="admin-exec-metrics quote-metrics">${cards(4, 'metric-card')}</section>
        <div class="admin-workspace quote-workspace"><aside class="admin-queue quote-queue"><div class="admin-queue-header"><strong>Propostas</strong></div><div class="admin-queue-list">${cards(count, 'admin-lead')}</div></aside></div>
      </section>
    </main>`
  if (route === 'finance') return `
    <section class="finance-scope-root" data-finance-scope="business"><section class="finance-page">
      <header class="finance-page-header"><div><h1>Financeiro</h1></div><div class="finance-header-actions"><button class="is-primary">Nova despesa</button></div></header>
      <div class="finance-list">${cards(count, 'finance-billing-card')}</div>
    </section></section>`
  return `<section class="test-page" style="padding-top:12px">${cards(count)}</section>`
}

async function mount(page: Page, options: FixtureOptions = {}) {
  const route = options.route ?? 'generic'
  const count = options.items ?? 12
  const routeCss = route === 'quotes' ? lazyQuoteCss : route === 'finance' ? lazyFinanceCss : ''
  const modal = options.modal
    ? route === 'quotes'
      ? `<div class="quote-modal-backdrop" data-test-modal><form class="quote-modal quote-new-modal"><header><h2>Novo orçamento</h2></header><label class="quote-field">Cliente<input value="Cliente HRX"></label><footer><button>Cancelar</button><button class="quote-primary">Criar rascunho</button></footer></form></div>`
      : `<div class="finance-modal-backdrop" data-test-modal><div class="finance-modal is-small"><header><h2>Registrar pagamento</h2></header><div class="finance-modal-body"><label>Valor<input value="100,00"></label></div><footer><button>Cancelar</button><button>Confirmar</button></footer></div></div>`
    : ''

  await page.setContent(`<!doctype html>
    <html lang="pt-BR" class="hrx-admin-pwa" data-hrx-theme-resolved="light">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
        <style>html,body,#root{margin:0;width:100%;height:100%;background:#f3f7fa}.test-home-indicator{position:fixed;z-index:6000;right:50%;bottom:8px;width:134px;height:5px;border-radius:999px;background:rgba(0,0,0,.58);transform:translateX(50%);pointer-events:none}${staticCss}${routeCss}</style>
      </head>
      <body class="hrx-admin-pwa"><div id="root">
        <div class="hrx-unified-shell is-pwa" data-admin-shell="pwa" data-runtime="standalone" data-viewport="phone" style="--hrx-safe-top:47px;--hrx-safe-bottom:34px">
          <header class="hrx-glass-topbar hrx-unified-topbar hrx-pwa-topbar"><div class="hrx-pwa-brand"><div><span>HRX ADMIN</span><strong>${route}</strong></div></div><div class="hrx-unified-actions"><button class="hrx-notifications">♢</button><button class="hrx-pwa-more">•••</button></div></header>
          <main class="hrx-unified-content" data-admin-workspace="true">${routeMarkup(route, count)}</main>
          <nav class="hrx-mobile-nav hrx-unified-mobile-nav" aria-label="Navegação principal do aplicativo"><button><i>⌂</i><span>Início</span></button><button><i>▣</i><span>Projetos</span></button><button class="is-active"><i>◫</i><span>Orçamentos</span></button><button><i>▤</i><span>Docs</span></button><button><i>⚙</i><span>Perfil</span></button></nav>
          ${modal}
          <div class="test-home-indicator" aria-hidden="true"></div>
        </div>
      </div></body>
    </html>`)
}

async function geometry(page: Page, lastSelector: string) {
  return page.evaluate((selector) => {
    const shell = document.querySelector('.hrx-unified-shell.is-pwa') as HTMLElement
    const content = document.querySelector('.hrx-unified-content') as HTMLElement
    const dock = document.querySelector('.hrx-unified-mobile-nav') as HTMLElement
    const last = document.querySelector(selector) as HTMLElement
    const shellRect = shell.getBoundingClientRect()
    const contentRect = content.getBoundingClientRect()
    const dockRect = dock.getBoundingClientRect()
    const lastRect = last.getBoundingClientRect()
    const viewportBottom = window.visualViewport?.height ?? window.innerHeight
    const structuralChildrenBelowDock = [...shell.children].filter((node) => {
      if (!(node instanceof HTMLElement) || node === dock) return false
      const rect = node.getBoundingClientRect()
      return rect.height > 1 && rect.top >= dockRect.bottom - 0.5
    }).map((node) => (node as HTMLElement).className)
    return {
      innerHeight: window.innerHeight,
      clientHeight: document.documentElement.clientHeight,
      visualViewportHeight: window.visualViewport?.height ?? null,
      shell: { top: shellRect.top, bottom: shellRect.bottom, height: shellRect.height },
      content: { top: contentRect.top, bottom: contentRect.bottom, height: contentRect.height },
      dock: { top: dockRect.top, bottom: dockRect.bottom, height: dockRect.height },
      last: { top: lastRect.top, bottom: lastRect.bottom, height: lastRect.height },
      gapBetweenDockAndViewportBottom: viewportBottom - dockRect.bottom,
      dockPosition: getComputedStyle(dock).position,
      dockPaddingBottom: Number.parseFloat(getComputedStyle(dock).paddingBottom),
      contentPaddingBottom: Number.parseFloat(getComputedStyle(content).paddingBottom),
      contentOverflowY: getComputedStyle(content).overflowY,
      shellOverflow: getComputedStyle(shell).overflow,
      dockBeforeDisplay: getComputedStyle(dock, '::before').display,
      dockAfterDisplay: getComputedStyle(dock, '::after').display,
      structuralChildrenBelowDock,
    }
  }, lastSelector)
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 402, height: 874 },
  { width: 430, height: 932 },
]) {
  test(`dock overlay and long content geometry at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await mount(page, { items: 18 })
    const content = page.locator('.hrx-unified-content')
    const dock = page.locator('.hrx-unified-mobile-nav')
    const before = await dock.boundingBox()
    await content.evaluate((element) => { element.scrollTop = Math.round(element.scrollHeight / 2) })
    const middle = await dock.boundingBox()
    await content.evaluate((element) => { element.scrollTop = element.scrollHeight })
    const after = await dock.boundingBox()
    const measured = await geometry(page, '.test-item:last-child')

    expect(before).not.toBeNull()
    expect(middle).not.toBeNull()
    expect(after).not.toBeNull()
    expect(Math.abs(before!.y - middle!.y)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(before!.y - after!.y)).toBeLessThanOrEqual(0.5)
    expect(measured.dockPosition).toBe('fixed')
    expect(measured.gapBetweenDockAndViewportBottom).toBeCloseTo(6, 0)
    expect(measured.dock.height).toBe(viewport.width <= 390 ? 62 : 64)
    expect(measured.dockPaddingBottom).toBe(4)
    expect(measured.contentOverflowY).toBe('auto')
    expect(measured.shellOverflow).toBe('hidden')
    expect(measured.last.bottom).toBeLessThan(measured.dock.top)
    expect(measured.contentPaddingBottom).toBeGreaterThanOrEqual(80)
    expect(measured.structuralChildrenBelowDock).toEqual([])
    expect(measured.dockBeforeDisplay).toBe('none')
    expect(measured.dockAfterDisplay).toBe('none')
    expect(measured.shell.bottom).toBeCloseTo(measured.innerHeight, 0)
    expect(measured.content.bottom).toBeCloseTo(measured.innerHeight, 0)
    expect(measured.clientHeight).toBe(measured.innerHeight)
    if (measured.visualViewportHeight !== null) expect(measured.visualViewportHeight).toBe(measured.innerHeight)
  })
}

test('short content paints through the physical bottom without a structural footer', async ({ page }) => {
  await mkdir(evidenceDir, { recursive: true })
  await page.setViewportSize({ width: 402, height: 874 })
  await mount(page, { items: 1 })
  const measured = await geometry(page, '.test-item:last-child')
  await expect(page.locator('.hrx-unified-shell.is-pwa')).toHaveCSS('background-color', 'rgb(243, 247, 250)')
  await expect(page.locator('.hrx-unified-content')).toHaveCSS('background-color', 'rgb(243, 247, 250)')
  expect(measured.gapBetweenDockAndViewportBottom).toBeCloseTo(6, 0)
  expect(measured.structuralChildrenBelowDock).toEqual([])
  await page.screenshot({ path: evidencePath('2026-08-25_04_DOCK-SAFE-AREA_402x874.png') })
})

test('lazy Orçamentos CSS preserves the global geometry and keeps the last proposal accessible', async ({ page }) => {
  await mkdir(evidenceDir, { recursive: true })
  await page.setViewportSize({ width: 402, height: 874 })
  await mount(page, { route: 'quotes', items: 18 })
  const content = page.locator('.hrx-unified-content')
  await page.screenshot({ path: evidencePath('2026-08-25_01_ORCAMENTOS-TOPO_402x874.png') })
  await content.evaluate((element) => { element.scrollTop = Math.round((element.scrollHeight - element.clientHeight) / 2) })
  await page.screenshot({ path: evidencePath('2026-08-25_02_ORCAMENTOS-MEIO_402x874.png') })
  await content.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await page.screenshot({ path: evidencePath('2026-08-25_03_ORCAMENTOS-FINAL_402x874.png') })
  const measured = await geometry(page, '.admin-lead:last-child')
  await expect(page.locator('.quote-commercial-shell')).toHaveCSS('position', 'relative')
  await expect(page.locator('.quote-commercial-shell')).toHaveCSS('overflow', 'visible')
  expect(measured.last.bottom).toBeLessThan(measured.dock.top)
  expect(measured.gapBetweenDockAndViewportBottom).toBeCloseTo(6, 0)
})

test('Financeiro CSS does not reserve another dock or safe-area footer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mount(page, { route: 'finance', items: 12 })
  const content = page.locator('.hrx-unified-content')
  await content.evaluate((element) => { element.scrollTop = element.scrollHeight })
  const measured = await geometry(page, '.finance-billing-card:last-child')
  const routeBottomPadding = await page.locator('.finance-page').evaluate((node) => Number.parseFloat(getComputedStyle(node).paddingBottom))
  expect(routeBottomPadding).toBe(12)
  expect(measured.last.bottom).toBeLessThan(measured.dock.top)
  expect(measured.gapBetweenDockAndViewportBottom).toBeCloseTo(6, 0)
})

test('modal owns the real viewport and layers above the dock', async ({ page }) => {
  await mkdir(evidenceDir, { recursive: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await mount(page, { route: 'finance', items: 8, modal: true })
  const result = await page.evaluate(() => {
    const modal = document.querySelector('[data-test-modal]') as HTMLElement
    const dock = document.querySelector('.hrx-unified-mobile-nav') as HTMLElement
    const rect = modal.getBoundingClientRect()
    return {
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      modalZ: Number.parseInt(getComputedStyle(modal).zIndex, 10),
      dockZ: Number.parseInt(getComputedStyle(dock).zIndex, 10),
    }
  })
  expect(result.top).toBeCloseTo(0, 0)
  expect(result.bottom).toBeCloseTo(844, 0)
  expect(result.width).toBeCloseTo(390, 0)
  expect(result.height).toBeCloseTo(844, 0)
  expect(result.modalZ).toBeGreaterThan(result.dockZ)
  await expect(page.getByRole('button', { name: 'Confirmar' })).toBeVisible()
  await page.screenshot({ path: evidencePath('2026-08-25_05_MODAL-FINANCEIRO_390x844.png') })
})

test('Novo orçamento modal also covers the dock and real viewport', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await mount(page, { route: 'quotes', items: 10, modal: true })
  const result = await page.evaluate(() => {
    const modal = document.querySelector('[data-test-modal]') as HTMLElement
    const dock = document.querySelector('.hrx-unified-mobile-nav') as HTMLElement
    const rect = modal.getBoundingClientRect()
    return {
      top: rect.top,
      bottom: rect.bottom,
      modalZ: Number.parseInt(getComputedStyle(modal).zIndex, 10),
      dockZ: Number.parseInt(getComputedStyle(dock).zIndex, 10),
    }
  })
  expect(result.top).toBeCloseTo(0, 0)
  expect(result.bottom).toBeCloseTo(874, 0)
  expect(result.modalZ).toBeGreaterThan(result.dockZ)
  await expect(page.getByRole('button', { name: 'Criar rascunho' })).toBeVisible()
})

test('resize and orientation keep the dock inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await mount(page, { items: 14 })
  await page.setViewportSize({ width: 874, height: 402 })
  await page.locator('.hrx-unified-shell').evaluate((node) => { (node as HTMLElement).dataset.viewport = 'tablet' })
  const dock = await page.locator('.hrx-unified-mobile-nav').boundingBox()
  expect(dock).not.toBeNull()
  expect(dock!.x).toBeGreaterThanOrEqual(0)
  expect(dock!.x + dock!.width).toBeLessThanOrEqual(874)
  expect(dock!.y + dock!.height).toBeLessThanOrEqual(402)
  expect(402 - (dock!.y + dock!.height)).toBeCloseTo(4, 0)
})
