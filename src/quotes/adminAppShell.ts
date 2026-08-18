const LOCKED_VIEWPORT = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'

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
  if (html.dataset.hrxAdminShell === 'locked') return

  html.dataset.hrxAdminShell = 'locked'
  html.classList.add('hrx-admin-pwa')
  document.body.classList.add('hrx-admin-pwa')

  let viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (!viewport) {
    viewport = document.createElement('meta')
    viewport.name = 'viewport'
    document.head.appendChild(viewport)
  }
  viewport.content = LOCKED_VIEWPORT

  ensureMeta('mobile-web-app-capable', 'yes')
  ensureMeta('apple-mobile-web-app-capable', 'yes')
  ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent')

  const preventGesture = (event: Event) => event.preventDefault()
  document.addEventListener('gesturestart', preventGesture as EventListener, { passive: false })
  document.addEventListener('gesturechange', preventGesture as EventListener, { passive: false })
  document.addEventListener('gestureend', preventGesture as EventListener, { passive: false })

  window.addEventListener('wheel', (event) => {
    if (event.ctrlKey) event.preventDefault()
  }, { passive: false })

  window.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && ['+', '=', '-', '0'].includes(event.key)) {
      event.preventDefault()
    }
  })
}
