import { useEffect, useMemo, useRef, useState } from 'react'
import './admin-pwa.css'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type AdminVersion = { release?: string; build?: string; releasedAt?: string; message?: string }
type UpdateProgress = { percent: number; status: string }
type BadgeNavigator = Navigator & { setAppBadge?: (contents?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
type HrxWindow = Window & typeof globalThis & { __HRX_ADMIN_BUILD__?: string }

const AUTH_RATE_LIMIT_KEY = 'hrx-admin-auth-rate-limit-until'
const AUTH_RATE_LIMIT_COOLDOWN_MS = 10 * 60 * 1000
const VERSION_URL = '/admin/version.json'
const SERVICE_WORKER_URL = '/admin/sw.js'
const SERVICE_WORKER_SCOPE = '/admin/'
const UPDATE_CHECK_COOLDOWN_MS = 30_000

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}
function isIos() { return /iphone|ipad|ipod/i.test(window.navigator.userAgent) }
function readRateLimitUntil() {
  const stored = Number(window.localStorage.getItem(AUTH_RATE_LIMIT_KEY) || 0)
  return Number.isFinite(stored) && stored > Date.now() ? stored : 0
}
function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}
function installedBuild() { return String((window as HrxWindow).__HRX_ADMIN_BUILD__ || 'dev').trim() }

export default function AdminPwaBridge() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)
  const [online, setOnline] = useState(window.navigator.onLine)
  const [iosHintOpen, setIosHintOpen] = useState(false)
  const [rateLimitedUntil, setRateLimitedUntil] = useState(readRateLimitUntil)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [remoteVersion, setRemoteVersion] = useState<AdminVersion | null>(null)
  const [updateProgress, setUpdateProgressState] = useState<UpdateProgress>({ percent: 0, status: 'Preparando atualização…' })
  const [updating, setUpdating] = useState(false)
  const [updateComplete, setUpdateComplete] = useState(false)
  const applyUpdateRef = useRef<() => Promise<void>>(async () => undefined)
  const ios = useMemo(isIos, [])
  const rateLimited = rateLimitedUntil > Date.now()

  useEffect(() => {
    document.title = 'HRX Admin · Orçamentos'
    let manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (!manifest) { manifest = document.createElement('link'); manifest.rel = 'manifest'; document.head.appendChild(manifest) }
    manifest.href = '/admin/manifest.webmanifest'
    let theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!theme) { theme = document.createElement('meta'); theme.name = 'theme-color'; document.head.appendChild(theme) }
    theme.content = '#061a31'
    let appleCapable = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-capable"]')
    if (!appleCapable) { appleCapable = document.createElement('meta'); appleCapable.name = 'apple-mobile-web-app-capable'; document.head.appendChild(appleCapable) }
    appleCapable.content = 'yes'
    let appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')
    if (!appleTitle) { appleTitle = document.createElement('meta'); appleTitle.name = 'apple-mobile-web-app-title'; document.head.appendChild(appleTitle) }
    appleTitle.content = 'HRX Admin'
    let icon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
    if (!icon) { icon = document.createElement('link'); icon.rel = 'apple-touch-icon'; document.head.appendChild(icon) }
    icon.href = '/admin/hrx-admin-icon.svg'

    const originalFetch = window.fetch.bind(window)
    window.fetch = async (...args) => {
      const url = requestUrl(args[0])
      const requestMethod = (args[1]?.method || (args[0] instanceof Request ? args[0].method : 'GET')).toUpperCase()
      const isAuthEmailRequest = url.includes('/auth/v1/otp') && requestMethod === 'POST'
      if (isAuthEmailRequest) {
        const blockedUntil = readRateLimitUntil()
        if (blockedUntil) {
          setRateLimitedUntil(blockedUntil)
          return new Response(JSON.stringify({ code: 'over_email_send_rate_limit', message: 'Aguarde alguns minutos antes de solicitar outro link.' }), { status: 429, headers: { 'Content-Type': 'application/json' } })
        }
      }
      const response = await originalFetch(...args)
      if (isAuthEmailRequest && response.status === 429) {
        const blockedUntil = Date.now() + AUTH_RATE_LIMIT_COOLDOWN_MS
        window.localStorage.setItem(AUTH_RATE_LIMIT_KEY, String(blockedUntil)); setRateLimitedUntil(blockedUntil)
      } else if (isAuthEmailRequest && response.ok) {
        window.localStorage.removeItem(AUTH_RATE_LIMIT_KEY); setRateLimitedUntil(0)
      }
      return response
    }

    const beforeInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent) }
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null) }
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    if (!('serviceWorker' in navigator)) return () => {
      window.fetch = originalFetch
      window.removeEventListener('beforeinstallprompt', beforeInstall); window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline)
    }

    let registration: ServiceWorkerRegistration | null = null
    let lastCheckAt = 0
    let reloadScheduled = false
    let disposed = false
    let progressValue = 0
    const applyingUpdate = { current: false }
    const setProgress = (percent: number, status: string) => {
      progressValue = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)))
      if (!disposed) setUpdateProgressState({ percent: progressValue, status })
    }
    const clearUpdateBadge = async () => { try { const nav = navigator as BadgeNavigator; if (nav.clearAppBadge) await nav.clearAppBadge() } catch { /* opcional */ } }
    const setUpdateBadge = async () => { try { const nav = navigator as BadgeNavigator; if (nav.setAppBadge) await nav.setAppBadge(1) } catch { /* opcional */ } }
    const finishUpdateAndReload = () => {
      if (reloadScheduled) return
      reloadScheduled = true; setProgress(100, 'Atualização completa'); setUpdateComplete(true)
      window.setTimeout(() => window.location.reload(), 850)
    }
    const ensureRegistration = async () => (await navigator.serviceWorker.getRegistration(SERVICE_WORKER_SCOPE)) || navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: SERVICE_WORKER_SCOPE })
    const waitUntilInstalled = (worker: ServiceWorker) => {
      if (['installed', 'activated'].includes(worker.state)) return Promise.resolve(worker)
      return new Promise<ServiceWorker>((resolve) => {
        const onStateChange = () => {
          if (worker.state === 'installing') setProgress(Math.max(progressValue, 22), 'Baixando dados…')
          if (worker.state === 'installed') setProgress(Math.max(progressValue, 72), 'Download concluído. Instalando dados…')
          if (['installed', 'activated', 'redundant'].includes(worker.state)) { worker.removeEventListener('statechange', onStateChange); resolve(worker) }
        }
        worker.addEventListener('statechange', onStateChange)
      })
    }
    const checkForUpdate = async (force = false) => {
      const now = Date.now()
      if (!force && now - lastCheckAt < UPDATE_CHECK_COOLDOWN_MS) return
      lastCheckAt = now
      try {
        registration ||= await ensureRegistration()
        await registration.update().catch(() => undefined)
        const response = await originalFetch(`${VERSION_URL}?t=${now}`, { cache: 'no-store', headers: { Accept: 'application/json' } })
        if (!response.ok) return
        const version = await response.json() as AdminVersion
        const remoteBuild = String(version.build || '').trim()
        const hasPendingWorker = Boolean(navigator.serviceWorker.controller && (registration.waiting || registration.installing))
        const hasNewBuild = hasPendingWorker || Boolean(remoteBuild && remoteBuild !== installedBuild())
        if (hasNewBuild) {
          if (!disposed) { setRemoteVersion(version); setUpdateAvailable(true); if (!applyingUpdate.current) { setUpdateComplete(false); setProgress(0, 'Preparando atualização…') } }
          await setUpdateBadge()
        } else if (!applyingUpdate.current) { if (!disposed) setUpdateAvailable(false); await clearUpdateBadge() }
      } catch { /* sem rede: mantém versão instalada */ }
    }
    const observeRegistration = (active: ServiceWorkerRegistration) => {
      if (active.waiting && navigator.serviceWorker.controller) void checkForUpdate(true)
      active.addEventListener('updatefound', () => {
        const worker = active.installing
        worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller && !applyingUpdate.current) void checkForUpdate(true) })
      })
    }
    const handleControllerChange = () => {
      if (applyingUpdate.current) { setProgress(96, 'Ativando nova versão…'); window.setTimeout(finishUpdateAndReload, 180) }
      else void checkForUpdate(true)
    }
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const payload = event.data || {}
      if (payload.type === 'HRX_UPDATE_PROGRESS' && applyingUpdate.current) {
        const status = payload.phase === 'install' ? 'Instalando dados…' : payload.phase === 'complete' ? 'Atualização completa' : 'Baixando dados…'
        setProgress(Math.max(progressValue, Number(payload.progress) || 0), status); return
      }
      if (payload.type === 'HRX_UPDATED') { if (applyingUpdate.current) setProgress(96, 'Ativando nova versão…'); else void checkForUpdate(true) }
    }
    const applyUpdate = async () => {
      if (applyingUpdate.current) return
      applyingUpdate.current = true; setUpdating(true); setUpdateComplete(false); setProgress(4, 'Preparando atualização…'); await clearUpdateBadge()
      try {
        registration ||= await ensureRegistration(); setProgress(10, 'Verificando nova versão…')
        const waitingBeforeUpdate = registration.waiting
        if (!waitingBeforeUpdate) { setProgress(14, 'Baixando dados…'); await registration.update() }
        const candidate = registration.waiting || registration.installing || waitingBeforeUpdate
        if (candidate) {
          if (candidate.state === 'installing') setProgress(18, 'Baixando dados…')
          const worker = await waitUntilInstalled(candidate)
          if (worker.state === 'installed') { setProgress(Math.max(progressValue, 78), 'Instalando dados…'); worker.postMessage({ type: 'SKIP_WAITING' }); return }
        }
        setProgress(92, 'Aplicando atualização…'); finishUpdateAndReload()
      } catch { setProgress(92, 'Finalizando atualização…'); finishUpdateAndReload() }
    }
    applyUpdateRef.current = applyUpdate

    const onVisibilityChange = () => { if (document.visibilityState === 'visible') void checkForUpdate() }
    const onPageShow = () => void checkForUpdate()
    const onFocus = () => void checkForUpdate()
    const onReconnect = () => void checkForUpdate(true)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pageshow', onPageShow); window.addEventListener('focus', onFocus); window.addEventListener('online', onReconnect)
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange); navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)

    const initialize = async () => { try { registration = await ensureRegistration(); observeRegistration(registration); await checkForUpdate(true) } catch { /* auxiliar */ } }
    const idleWindow = window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }
    if (idleWindow.requestIdleCallback) idleWindow.requestIdleCallback(() => void initialize(), { timeout: 2_000 })
    else window.setTimeout(() => void initialize(), 600)

    return () => {
      disposed = true; window.fetch = originalFetch
      window.removeEventListener('beforeinstallprompt', beforeInstall); window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); window.removeEventListener('online', onReconnect)
      window.removeEventListener('pageshow', onPageShow); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisibilityChange)
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange); navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
    }
  }, [])

  useEffect(() => {
    if (!rateLimitedUntil) return
    const timer = window.setTimeout(() => { window.localStorage.removeItem(AUTH_RATE_LIMIT_KEY); setRateLimitedUntil(0) }, Math.max(0, rateLimitedUntil - Date.now()))
    return () => window.clearTimeout(timer)
  }, [rateLimitedUntil])

  const install = async () => {
    if (installPrompt) { await installPrompt.prompt(); const choice = await installPrompt.userChoice; if (choice.outcome === 'accepted') setInstalled(true); setInstallPrompt(null); return }
    if (ios && !installed) setIosHintOpen((current) => !current)
  }

  return <>
    {rateLimited && <div className="admin-auth-rate-limit" role="alert" aria-live="assertive"><strong>Muitas tentativas de acesso.</strong><span>O envio de novos links foi bloqueado temporariamente. Aguarde alguns minutos e tente novamente. Não reutilize links antigos.</span></div>}
    {(updateAvailable || updating) && <aside className="admin-pwa-update-banner" data-updating={updating ? 'true' : undefined} data-complete={updateComplete ? 'true' : undefined} role="status" aria-live="polite">
      <span className="admin-pwa-update-icon" aria-hidden="true">↑</span>
      <span className="admin-pwa-update-copy"><strong>Nova versão do HRX Admin disponível</strong><small>{remoteVersion?.message || 'Melhorias e correções estão prontas para instalar.'}</small></span>
      {!updating && <button className="admin-pwa-update-action" type="button" onClick={() => void applyUpdateRef.current()}>Atualizar agora</button>}
      {updating && <div className="admin-pwa-update-progress"><div className="admin-pwa-update-progress-copy"><span>{updateProgress.status}</span><strong>{updateProgress.percent}%</strong></div><div className="admin-pwa-update-progress-track" role="progressbar" aria-label="Progresso da atualização" aria-valuemin={0} aria-valuemax={100} aria-valuenow={updateProgress.percent} aria-valuetext={`${updateProgress.status} ${updateProgress.percent}%`}><span className="admin-pwa-update-progress-fill" style={{ width: `${updateProgress.percent}%` }} /></div></div>}
    </aside>}
    <div className="admin-pwa-tools" aria-label="Controles do aplicativo HRX Admin">
      <span className={`admin-pwa-network ${online ? 'is-online' : 'is-offline'}`}><i /> {online ? 'Online' : 'Sem conexão'}</span>
      {!installed && (installPrompt || ios) && <button className="admin-pwa-install" type="button" onClick={install}>Instalar HRX Admin</button>}
      {iosHintOpen && <div className="admin-pwa-ios-hint" role="status">No iPhone/iPad: abra o menu Compartilhar do Safari e escolha “Adicionar à Tela de Início”.</div>}
    </div>
  </>
}
