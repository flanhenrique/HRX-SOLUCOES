import { useEffect, useRef, useState } from 'react'
import { canUseAdminServiceWorker, ensureAdminServiceWorker } from './adminPwaService'
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

type UpdateState = 'idle' | 'available' | 'checking' | 'downloading' | 'installing' | 'activating' | 'complete' | 'error'

const VERSION_URL = '/admin/version.json'
const CHECK_COOLDOWN_MS = 60_000
const UPDATE_POLL_MS = 180_000
const ACTIVATION_TIMEOUT_MS = 20_000

function installedBuild() {
  return String((window as HrxWindow).__HRX_ADMIN_BUILD__ || 'dev').trim()
}

function messageForState(state: UpdateState) {
  if (state === 'checking') return 'Verificando nova versão…'
  if (state === 'downloading') return 'Baixando dados…'
  if (state === 'installing') return 'Instalando dados…'
  if (state === 'activating') return 'Ativando nova versão…'
  if (state === 'complete') return 'Atualização completa'
  if (state === 'error') return 'A atualização não foi concluída'
  return 'Preparando atualização…'
}

export default function AdminPwaUpdater() {
  const [state, setState] = useState<UpdateState>('idle')
  const [version, setVersion] = useState<AdminVersion | null>(null)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('Preparando atualização…')
  const [errorMessage, setErrorMessage] = useState('')
  const applyUpdateRef = useRef<() => Promise<void>>(async () => undefined)

  useEffect(() => {
    if (!canUseAdminServiceWorker()) return

    let registration: ServiceWorkerRegistration | null = null
    let lastCheckAt = 0
    let progressValue = 0
    let applyingUpdate = false
    let reloadScheduled = false
    let activationTimeout = 0
    let updatePollTimer = 0
    let disposed = false

    const transition = (nextState: UpdateState, percent = progressValue, nextStatus = messageForState(nextState)) => {
      progressValue = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)))
      if (disposed) return
      setState(nextState)
      setProgress(progressValue)
      setStatus(nextStatus)
      if (nextState !== 'error') setErrorMessage('')
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

    const markError = (message: string) => {
      applyingUpdate = false
      if (activationTimeout) window.clearTimeout(activationTimeout)
      activationTimeout = 0
      if (disposed) return
      setErrorMessage(message)
      transition('error', Math.min(progressValue, 94), 'A atualização não foi concluída')
    }

    const finishAndReload = () => {
      if (!applyingUpdate || reloadScheduled) return
      reloadScheduled = true
      applyingUpdate = false
      if (activationTimeout) window.clearTimeout(activationTimeout)
      activationTimeout = 0
      transition('complete', 100, 'Atualização completa')
      window.setTimeout(() => window.location.reload(), 850)
    }

    const waitUntilInstalled = (worker: ServiceWorker) => {
      if (worker.state === 'redundant') return Promise.reject(new Error('worker_redundant'))
      if (['installed', 'activated'].includes(worker.state)) return Promise.resolve(worker)

      return new Promise<ServiceWorker>((resolve, reject) => {
        const onStateChange = () => {
          if (worker.state === 'installing') transition('downloading', Math.max(progressValue, 22))
          if (worker.state === 'installed') transition('installing', Math.max(progressValue, 72))
          if (worker.state === 'redundant') {
            worker.removeEventListener('statechange', onStateChange)
            reject(new Error('worker_redundant'))
            return
          }
          if (['installed', 'activated'].includes(worker.state)) {
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
        registration ||= await ensureAdminServiceWorker()
        await registration.update()

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

        if (hasPendingWorker || hasBuildMismatch) {
          if (!disposed) setVersion(remoteVersion)
          if (!applyingUpdate) transition('available', 0)
          await setBadge()
        } else if (!applyingUpdate) {
          transition('idle', 0)
          await clearBadge()
        }
      } catch {
        // Checagem em background não derruba a versão instalada.
      }
    }

    const pollForUpdate = () => {
      if (applyingUpdate || document.visibilityState !== 'visible' || !navigator.onLine) return
      void checkForUpdate()
    }

    const observeRegistration = (activeRegistration: ServiceWorkerRegistration) => {
      if (activeRegistration.waiting && navigator.serviceWorker.controller) void checkForUpdate(true)

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
        transition('activating', 98, 'Ativando nova versão…')
        finishAndReload()
      } else {
        void checkForUpdate(true)
      }
    }

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const payload = event.data || {}
      if (payload.type === 'HRX_UPDATE_PROGRESS' && applyingUpdate) {
        const reported = Number(payload.progress) || 0
        const nextProgress = Math.min(94, Math.max(progressValue, reported))
        if (payload.phase === 'install') transition('installing', nextProgress)
        else if (payload.phase === 'complete') transition('activating', Math.max(nextProgress, 94))
        else transition('downloading', nextProgress)
        return
      }

      if (payload.type === 'HRX_UPDATED') {
        if (applyingUpdate) transition('activating', Math.max(progressValue, 94))
        else void checkForUpdate(true)
      }
    }

    const applyUpdate = async () => {
      if (applyingUpdate) return
      applyingUpdate = true
      reloadScheduled = false
      transition('checking', 4)
      await clearBadge()

      try {
        registration ||= await ensureAdminServiceWorker()
        transition('checking', 10)

        const waitingBeforeUpdate = registration.waiting
        if (!waitingBeforeUpdate) {
          transition('downloading', 14)
          await registration.update()
        }

        const candidate = registration.waiting || registration.installing || waitingBeforeUpdate
        if (!candidate) throw new Error('worker_candidate_missing')

        const worker = await waitUntilInstalled(candidate)
        if (worker.state === 'redundant') throw new Error('worker_redundant')

        if (worker.state === 'activated') {
          transition('activating', 98)
          finishAndReload()
          return
        }

        if (worker.state !== 'installed') throw new Error(`worker_invalid_state_${worker.state}`)

        transition('activating', Math.max(progressValue, 90))
        activationTimeout = window.setTimeout(() => {
          if (applyingUpdate) markError('A nova versão foi baixada, mas não conseguiu assumir o controle do aplicativo. A versão atual continua ativa.')
        }, ACTIVATION_TIMEOUT_MS)
        worker.postMessage({ type: 'SKIP_WAITING' })
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'update_failed'
        const message = reason === 'worker_redundant'
          ? 'O pacote de atualização foi descartado pelo navegador. A versão atual continua ativa; tente novamente.'
          : 'Não foi possível concluir a atualização. A versão instalada continua funcionando normalmente.'
        markError(message)
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
        registration = await ensureAdminServiceWorker()
        observeRegistration(registration)
        await checkForUpdate(true)
      } catch {
        // Atualização é auxiliar e nunca deve bloquear o HRX Admin.
      }
    }

    window.setTimeout(() => void initialize(), 600)
    updatePollTimer = window.setInterval(pollForUpdate, UPDATE_POLL_MS)

    return () => {
      disposed = true
      applyingUpdate = false
      if (activationTimeout) window.clearTimeout(activationTimeout)
      if (updatePollTimer) window.clearInterval(updatePollTimer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onReconnect)
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
    }
  }, [])

  if (state === 'idle') return null

  const working = ['checking', 'downloading', 'installing', 'activating'].includes(state)
  const failed = state === 'error'
  const completed = state === 'complete'

  return (
    <aside
      className="admin-pwa-update-banner"
      data-updating={working ? 'true' : undefined}
      data-complete={completed ? 'true' : undefined}
      data-error={failed ? 'true' : undefined}
      role={failed ? 'alert' : 'status'}
      aria-live={failed ? 'assertive' : 'polite'}
    >
      <span className="admin-pwa-update-icon" aria-hidden="true">{failed ? '!' : completed ? '✓' : '↑'}</span>
      <span className="admin-pwa-update-copy">
        <strong>{failed ? 'Não foi possível instalar a nova versão' : completed ? 'HRX Admin atualizado' : 'Nova versão do HRX Admin disponível'}</strong>
        <small>{failed ? errorMessage : version?.message || 'Melhorias e correções estão prontas para instalar.'}</small>
      </span>

      {state === 'available' && (
        <button className="admin-pwa-update-action" type="button" onClick={() => void applyUpdateRef.current()}>
          Atualizar agora
        </button>
      )}

      {failed && (
        <button className="admin-pwa-update-action" type="button" onClick={() => void applyUpdateRef.current()}>
          Tentar novamente
        </button>
      )}

      {(working || completed || failed) && (
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
