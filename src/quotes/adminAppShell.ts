const BROWSER_VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover'
const STANDALONE_VIEWPORT = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'

function ensureMeta(name: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
    document.head.appendChild(meta)
  }
  meta.content = content
}

function isStandalonePwa() {
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone
}

function applyViewportPolicy(viewport: HTMLMetaElement) {
  const standalone = isStandalonePwa()
  viewport.content = standalone ? STANDALONE_VIEWPORT : BROWSER_VIEWPORT
  document.documentElement.dataset.hrxViewportPolicy = standalone ? 'app-locked' : 'browser-accessible'
}

export function configureAdminAppShell() {
  const html = document.documentElement
  if (html.dataset.hrxAdminShell === 'configured') return

  html.dataset.hrxAdminShell = 'configured'
  html.classList.add('hrx-admin-pwa')
  document.body.classList.add('hrx-admin-pwa')

  let viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (!viewport) {
    viewport = document.createElement('meta')
    viewport.name = 'viewport'
    document.head.appendChild(viewport)
  }
  applyViewportPolicy(viewport)

  const standaloneMedia = window.matchMedia('(display-mode: standalone)')
  standaloneMedia.addEventListener?.('change', () => applyViewportPolicy(viewport))

  ensureMeta('mobile-web-app-capable', 'yes')
  ensureMeta('apple-mobile-web-app-capable', 'yes')
  ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent')
}
