import { useEffect, useRef, useState } from 'react'
import './admin-pwa-update.css'

type AdminVersion = {
  release?: string
  build?: string
  releasedAt?: string
  message?: string
}

type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

type HrxWindow = Window & typeof globalThis & {
  __HRX_ADMIN_BUILD__?: string
}

const VERSION_URL = '/admin/version.json'
const SERVICE_WORKER_URL = '/admin/sw.js'
const SERVICE_WORKER_SCOPE = '/admin/'
const CHECK_COOLDOWN_MS = 30_000

function installedBuild() {
  return String((window as HrxWindow).__HRX_ADMIN_BUILD__ || 'dev').trim()
}

export default function AdminPwaUpdater() {
  const [available, setAvailable] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [complete, setComplete] = useState(false)
  const [version, setVersion] = useState<AdminVersion | null>(null)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('Preparando atualização…')
  const applyUpdateRef = useRef<() => Promise<void>>(async () => undefined)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let registration: ServiceWorkerRegistration | null = null
    let lastCheckAt = 0
    let progressValue = 0
    let applyingUpdate = false
    let reloadScheduled = false
    let disposed = false

    const setUpdateProgress = (percent: number, nextStatus: string) => {
      progressValue = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)))
      if (disposed) return
      setProgress(progressValue)
      setStatus(nextStatus)
    }

    const setBadge = async () => {
      try {
        const badgeNavigator = navigator as BadgeNavigator
        if (typeof badgeNavigator.setAppBadge === 'function') await badgeNavigator.setAppBadge(1)
      } catch {
        // Badging é opcional e depende do navegador/SO.
      }
    }

    const clearBadge = async () => {
      try {
        const badgeNavigator = navigator as BadgeNavigator
        if (typeof badgeNavigator.clearAppBadge === 'function') await badgeNavigator.clearAppBadge()
      } catch {
        // Badging é opcional e depende do navegador/SO.
      }
    }

    const ensureRegistration = async () => {
      const existing = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_SCOPE)
      return existing || navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: SERVICE_WORKER_SCOPE })
    }

    const finishAndReload = () => {
      if (reloadScheduled) return
      reloadScheduled = true
      setUpdateProgress(100, 'Atualização completa')
      if (!disposed) setComplete(true)
      window.setTimeout(() => window.location.reload(), 850)
    }

    const waitUntilInstalled = (worker: ServiceWorker) => {
      if (['installed', 'activated'].includes(worker.state)) return Promise.resolve(worker)

      return new Promise<ServiceWorker>((resolve) => {
        const onStateChange = () => {
          if (worker.state === 'installing') {
            setUpdateProgress(Math.max(progressValue, 22), 'Baixando dados…')
          }
          if (worker.state === 'installed') {
            setUpdateProgress(Math.max(progressValue, 72), 'Download concluído. Instalando dados…')
          }
          if (['installed', 'activated', 'redundant'].includes(worker.state)) {
            worker.removeEventListener('statechange', onStateChange)
            resolve(worker)
          }
        }
        worker.addEventListener('statechange', onStateChange)
      })
    }

    const checkForUpdate = async (force = false) => {
      const now = Date.now()
      if (!force && now - lastCheckAt < CHECK_COOLDOWN_MS) return
      lastCheckAt = now

      try {
        registration ||= await ensureRegistration()
        await registration.update().catch(() => undefined)

        const response = await fetch(`${VERSION_URL}?t=${now}`, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) return

        const remoteVersion = await response.json() as AdminVersion
        const remoteBuild = String(remoteVersion.build || '').trim()
        const currentBuild = installedBuild()
        const hasPendingWorker = Boolean(
          navigator.serviceWorker.controller && (registration.waiting || registration.installing),
        )
        const hasBuildMismatch = currentBuild !== 'dev' && Boolean(remoteBuild && remoteBuild !== currentBuild)
        const hasNewBuild = hasPendingWorker || hasBuildMismatch

        if (hasNewBuild) {
          if (!disposed) {
            setVersion(remoteVersion)
            setAvailable(true)
            if (!applyingUpdate) {
              setComplete(false)
              setUpdateProgress(0, 'Preparando atualização…')
            }
          }
          await setBadge()
        } else if (!applyingUpdate) {
          if (!disposed) setAvailable(false)
          await clearBadge()
        }
      } catch {
        // Sem rede, o PWA segue usando a versão instalada.
      }
    }

    const observeRegistration = (activeRegistration: ServiceWorkerRegistration) => {
      if (activeRegistration.waiting && navigator.serviceWorker.controller) {
        void checkForUpdate(true)
      }

      activeRegistration.addEventListener('updatefound', () => {
        const worker = activeRegistration.installing
        if (!worker) return
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller && !applyingUpdate) {
            void checkForUpdate(true)
          }
        })
      })
    }

    const handleControllerChange = () => {
      if (applyingUpdate) {
        setUpdateProgress(96, 'Ativando nova versão…')
        window.setTimeout(finishAndReload, 180)
      } else {
        void checkForUpdate(true)
      }
    }

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const payload = event.data || {}
      if (payload.type === 'HRX_UPDATE_PROGRESS' && applyingUpdate) {
        const nextProgress = Math.max(progressValue, Number(payload.progress) || 0)
        const nextStatus = payload.phase === 'install'
          ? 'Instalando dados…'
          : payload.phase === 'complete'
            ? 'Atualização completa'
            : 'Baixando dados…'
        setUpdateProgress(nextProgress, nextStatus)
        return
      }

      if (payload.type === 'HRX_UPDATED') {
        if (applyingUpdate) setUpdateProgress(96, 'Ativando nova versão…')
        else void checkForUpdate(true)
      }
    }

    const applyUpdate = async () => {
      if (applyingUpdate) return
      applyingUpdate = true
      if (!disposed) {
        setUpdating(true)
        setComplete(false)
      }
      setUpdateProgress(4, 'Preparando atualização…')
      await clearBadge()

      try {
        registration ||= await ensureRegistration()
        setUpdateProgress(10, 'Verificando nova versão…')

        const waitingBeforeUpdate = registration.waiting
        if (!waitingBeforeUpdate) {
          setUpdateProgress(14, 'Baixando dados…')
          await registration.update()
        }

        const candidate = registration.waiting || registration.installing || waitingBeforeUpdate
        if (candidate) {
          if (candidate.state === 'installing') {
            setUpdateProgress(18, 'Baixando dados…')
          }
          const worker = await waitUntilInstalled(candidate)
          if (worker.state === 'installed') {
            setUpdateProgress(Math.max(progressValue, 78), 'Instalando dados…')
            worker.postMessage({ type: 'SKIP_WAITING' })
            return
          }
        }

        setUpdateProgress(92, 'Aplicando atualização…')
        finishAndReload()
      } catch {
        setUpdateProgress(92, 'Finalizando atualização…')
        finishAndReload()
      }
    }

    applyUpdateRef.current = applyUpdate

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkForUpdate()
    }
    const onPageShow = () => void checkForUpdate()
    const onFocus = () => void checkForUpdate()
    const onReconnect = () => void checkForUpdate(true)

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onReconnect)
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)

    const initialize = async () => {
      try {
        registration = await ensureRegistration()
        observeRegistration(registration)
        await checkForUpdate(true)
      } catch {
        // Atualização é auxiliar e nunca deve bloquear o HRX Admin.
      }
    }

    window.setTimeout(() => void initialize(), 600)

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onReconnect)
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
    }
  }, [])

  if (!available && !updating) return null

  return (
    <aside
      className="admin-pwa-update-banner"
      data-updating={updating ? 'true' : undefined}
      data-complete={complete ? 'true' : undefined}
      role="status"
      aria-live="polite"
    >
      <span className="admin-pwa-update-icon" aria-hidden="true">↑</span>
      <span className="admin-pwa-update-copy">
        <strong>Nova versão do HRX Admin disponível</strong>
        <small>{version?.message || 'Melhorias e correções estão prontas para instalar.'}</small>
      </span>

      {!updating && (
        <button className="admin-pwa-update-action" type="button" onClick={() => void applyUpdateRef.current()}>
          Atualizar agora
        </button>
      )}

      {updating && (
        <div className="admin-pwa-update-progress">
          <div className="admin-pwa-update-progress-copy">
            <span>{status}</span>
            <strong>{progress}%</strong>
          </div>
          <div
            className="admin-pwa-update-progress-track"
            role="progressbar"
            aria-label="Progresso da atualização"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-valuetext={`${status} ${progress}%`}
          >
            <span className="admin-pwa-update-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </aside>
  )
}
