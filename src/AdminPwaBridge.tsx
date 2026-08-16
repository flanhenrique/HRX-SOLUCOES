import { useEffect, useMemo, useState } from 'react'
import './admin-pwa.css'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const AUTH_RATE_LIMIT_KEY = 'hrx-admin-auth-rate-limit-until'
const AUTH_RATE_LIMIT_COOLDOWN_MS = 10 * 60 * 1000

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function readRateLimitUntil() {
  const stored = Number(window.localStorage.getItem(AUTH_RATE_LIMIT_KEY) || 0)
  return Number.isFinite(stored) && stored > Date.now() ? stored : 0
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

export default function AdminPwaBridge() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)
  const [online, setOnline] = useState(window.navigator.onLine)
  const [iosHintOpen, setIosHintOpen] = useState(false)
  const [rateLimitedUntil, setRateLimitedUntil] = useState(readRateLimitUntil)
  const ios = useMemo(isIos, [])
  const rateLimited = rateLimitedUntil > Date.now()

  useEffect(() => {
    document.title = 'HRX Admin · Orçamentos'

    let manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (!manifest) {
      manifest = document.createElement('link')
      manifest.rel = 'manifest'
      document.head.appendChild(manifest)
    }
    manifest.href = '/admin/manifest.webmanifest'

    let theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!theme) {
      theme = document.createElement('meta')
      theme.name = 'theme-color'
      document.head.appendChild(theme)
    }
    theme.content = '#061a31'

    let appleCapable = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-capable"]')
    if (!appleCapable) {
      appleCapable = document.createElement('meta')
      appleCapable.name = 'apple-mobile-web-app-capable'
      document.head.appendChild(appleCapable)
    }
    appleCapable.content = 'yes'

    let appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')
    if (!appleTitle) {
      appleTitle = document.createElement('meta')
      appleTitle.name = 'apple-mobile-web-app-title'
      document.head.appendChild(appleTitle)
    }
    appleTitle.content = 'HRX Admin'

    let icon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
    if (!icon) {
      icon = document.createElement('link')
      icon.rel = 'apple-touch-icon'
      document.head.appendChild(icon)
    }
    icon.href = '/admin/hrx-admin-icon.svg'

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' })
    }

    const originalFetch = window.fetch.bind(window)
    window.fetch = async (...args) => {
      const url = requestUrl(args[0])
      const requestMethod = (args[1]?.method || (args[0] instanceof Request ? args[0].method : 'GET')).toUpperCase()
      const isAuthEmailRequest = url.includes('/auth/v1/otp') && requestMethod === 'POST'

      if (isAuthEmailRequest) {
        const blockedUntil = readRateLimitUntil()
        if (blockedUntil) {
          setRateLimitedUntil(blockedUntil)
          return new Response(JSON.stringify({
            code: 'over_email_send_rate_limit',
            message: 'Aguarde alguns minutos antes de solicitar outro link.',
          }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      }

      const response = await originalFetch(...args)
      if (isAuthEmailRequest && response.status === 429) {
        const blockedUntil = Date.now() + AUTH_RATE_LIMIT_COOLDOWN_MS
        window.localStorage.setItem(AUTH_RATE_LIMIT_KEY, String(blockedUntil))
        setRateLimitedUntil(blockedUntil)
      } else if (isAuthEmailRequest && response.ok) {
        window.localStorage.removeItem(AUTH_RATE_LIMIT_KEY)
        setRateLimitedUntil(0)
      }
      return response
    }

    const beforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
    }
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)

    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      window.fetch = originalFetch
      window.removeEventListener('beforeinstallprompt', beforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    if (!rateLimitedUntil) return
    const remaining = Math.max(0, rateLimitedUntil - Date.now())
    const timer = window.setTimeout(() => {
      window.localStorage.removeItem(AUTH_RATE_LIMIT_KEY)
      setRateLimitedUntil(0)
    }, remaining)
    return () => window.clearTimeout(timer)
  }, [rateLimitedUntil])

  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      if (choice.outcome === 'accepted') setInstalled(true)
      setInstallPrompt(null)
      return
    }
    if (ios && !installed) setIosHintOpen((current) => !current)
  }

  return (
    <>
      {rateLimited && (
        <div className="admin-auth-rate-limit" role="alert" aria-live="assertive">
          <strong>Muitas tentativas de acesso.</strong>
          <span>O envio de novos links foi bloqueado temporariamente. Aguarde alguns minutos e tente novamente. Não reutilize links antigos.</span>
        </div>
      )}
      <div className="admin-pwa-tools" aria-label="Controles do aplicativo HRX Admin">
        <span className={`admin-pwa-network ${online ? 'is-online' : 'is-offline'}`}>
          <i /> {online ? 'Online' : 'Sem conexão'}
        </span>
        {!installed && (installPrompt || ios) && (
          <button className="admin-pwa-install" type="button" onClick={install}>Instalar HRX Admin</button>
        )}
        {iosHintOpen && (
          <div className="admin-pwa-ios-hint" role="status">
            No iPhone/iPad: abra o menu Compartilhar do Safari e escolha “Adicionar à Tela de Início”.
          </div>
        )}
      </div>
    </>
  )
}
