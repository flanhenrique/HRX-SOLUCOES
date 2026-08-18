const ADMIN_VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover'

function ensureMeta(name: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
    document.head.appendChild(meta)
  }
  meta.content = content
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
  viewport.content = ADMIN_VIEWPORT

  ensureMeta('mobile-web-app-capable', 'yes')
  ensureMeta('apple-mobile-web-app-capable', 'yes')
  ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent')
}
