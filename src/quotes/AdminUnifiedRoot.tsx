import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import AdminPersonalizationBridge from './AdminPersonalizationBridge'
import { AdminRouteProvider } from './AdminRouteContext'
import {
  ADMIN_DESKTOP_MODULES,
  ADMIN_MOBILE_MORE_MODULES,
  ADMIN_MOBILE_PRIMARY_MODULES,
  type AdminResolvedRoute,
} from './adminModules'
import {
  canonicalizeAdminLocation,
  navigateAdmin,
  onAdminRouteChange,
  resolveAdminRoute,
  type AdminDestination,
} from './adminNavigation'
import { hrxSupabase } from './supabaseClient'

type RuntimeMode = 'standalone' | 'browser'
type ViewportClass = 'phone' | 'tablet' | 'desktop'
type AlertLoadStatus = 'loading' | 'ready' | 'unavailable'
type AlertSnapshot = {
  status: AlertLoadStatus
  suspended: number
  needsScope: number
  awaitingReview: number
  expiredDocuments: number
}

const EMPTY_ALERTS: AlertSnapshot = {
  status: 'loading',
  suspended: 0,
  needsScope: 0,
  awaitingReview: 0,
  expiredDocuments: 0,
}

const ALERT_REFRESH_MS = 120_000

function runtimeMode(): RuntimeMode {
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone ? 'standalone' : 'browser'
}

function viewportClass(): ViewportClass {
  if (window.innerWidth <= 760) return 'phone'
  if (window.innerWidth <= 1100) return 'tablet'
  return 'desktop'
}

function useAdminEnvironment() {
  const [environment, setEnvironment] = useState(() => ({ runtime: runtimeMode(), viewport: viewportClass() }))

  useEffect(() => {
    const standaloneMedia = window.matchMedia('(display-mode: standalone)')
    const sync = () => setEnvironment({ runtime: runtimeMode(), viewport: viewportClass() })
    sync()
    standaloneMedia.addEventListener?.('change', sync)
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    return () => {
      standaloneMedia.removeEventListener?.('change', sync)
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])

  return environment
}

function RouteLoading() {
  return <section className="hrx-route-loading" role="status" aria-live="polite">Carregando área administrativa…</section>
}

function RouteContent({ route }: { route: AdminResolvedRoute }) {
  const ActiveView = route.module.component
  return <AdminRouteProvider route={route}><Suspense fallback={<RouteLoading />}><ActiveView /></Suspense></AdminRouteProvider>
}

function totalAlerts(alerts: AlertSnapshot) {
  return alerts.suspended + alerts.needsScope + alerts.awaitingReview + alerts.expiredDocuments
}

function displayAlertCount(alerts: AlertSnapshot) {
  if (alerts.status === 'unavailable') return '!'
  const count = totalAlerts(alerts)
  return count > 99 ? '99+' : String(count)
}

function NotificationButton({ alerts, open, onClick, buttonRef }: { alerts: AlertSnapshot; open: boolean; onClick: () => void; buttonRef?: Ref<HTMLButtonElement> }) {
  const count = totalAlerts(alerts)
  const unavailable = alerts.status === 'unavailable'
  const label = unavailable
    ? 'Notificações indisponíveis no momento'
    : alerts.status === 'loading'
      ? 'Carregando notificações'
      : `${count} notificação${count === 1 ? '' : 'ões'}`

  return <button ref={buttonRef} className="hrx-notifications" type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={onClick}>
    <i aria-hidden="true">♢</i>
    {(count > 0 || unavailable) && <span aria-hidden="true">{displayAlertCount(alerts)}</span>}
  </button>
}

function NotificationPanel({ alerts, onClose, onNavigate }: { alerts: AlertSnapshot; onClose: () => void; onNavigate: (destination: AdminDestination) => void }) {
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target || panelRef.current?.contains(target)) return
      if ((target as Element).closest?.('.hrx-notifications')) return
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [onClose])

  const count = totalAlerts(alerts)
  const go = (destination: AdminDestination) => { onClose(); onNavigate(destination) }

  return <aside ref={panelRef} className="hrx-notification-panel" role="dialog" aria-modal="false" aria-labelledby="hrx-notification-title">
    <header>
      <div><span>HRX ADMIN</span><h2 id="hrx-notification-title">Notificações</h2></div>
      <button ref={closeRef} type="button" aria-label="Fechar notificações" onClick={onClose}>×</button>
    </header>

    {alerts.status === 'loading' && <div className="hrx-notification-summary"><strong>Carregando alertas…</strong><p>Consultando apenas as pendências que exigem atenção.</p></div>}
    {alerts.status === 'unavailable' && <div className="hrx-notification-summary is-unavailable"><strong>Não foi possível sincronizar os alertas</strong><p>Os dados não foram zerados. Verifique a conexão e tente novamente.</p></div>}
    {alerts.status === 'ready' && <>
      <div className="hrx-notification-summary">
        <strong>{count > 0 ? `${count} item${count === 1 ? '' : 's'} requer${count === 1 ? '' : 'em'} atenção` : 'Nenhuma pendência sinalizada'}</strong>
        <p>{count > 0 ? 'As contagens são consultadas diretamente no banco e revalidadas enquanto o aplicativo estiver em uso.' : 'O painel não indica bloqueios comerciais ou documentos vencidos neste momento.'}</p>
      </div>
      <div className="hrx-notification-list" aria-label="Resumo de pendências">
        <button type="button" onClick={() => go('suspensions')}><span>Orçamentos suspensos</span><strong>{alerts.suspended}</strong></button>
        <button type="button" onClick={() => go('activities')}><span>Precisam de escopo</span><strong>{alerts.needsScope}</strong></button>
        <button type="button" onClick={() => go('quotes')}><span>Aguardando revisão</span><strong>{alerts.awaitingReview}</strong></button>
        <button type="button" onClick={() => go('documents')}><span>Documentos vencidos</span><strong>{alerts.expiredDocuments}</strong></button>
      </div>
    </>}
  </aside>
}

function DesktopShell({ route, alerts, notificationOpen, notificationButtonRef, onToggleNotifications, children, runtime, viewport }: { route: AdminResolvedRoute; alerts: AlertSnapshot; notificationOpen: boolean; notificationButtonRef: Ref<HTMLButtonElement>; onToggleNotifications: () => void; children: ReactNode; runtime: RuntimeMode; viewport: ViewportClass }) {
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const active = route.module.id
  const contextLabel = route.subroute ? `HRX ADMIN · ${route.module.title}` : 'HRX ADMIN'

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setProfileOpen(false) }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target || profileRef.current?.contains(target)) return
      setProfileOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  const handleLogout = async () => {
    setProfileOpen(false)
    await hrxSupabase.auth.signOut()
    window.location.href = '/admin/orcamentos'
  }

  return <div className="hrx-unified-shell is-desktop" data-admin-shell="desktop" data-runtime={runtime} data-viewport={viewport}>
    <aside className="hrx-glass-sidebar hrx-unified-sidebar" aria-label="Navegação principal do HRX Admin">
      <div className="hrx-glass-brand">
        <img src="/hrx-mark.svg" alt="HRX" className="hrx-brand-mark-svg" />
        <div className="hrx-brand-copy"><strong>HRX</strong><span>Solutions</span></div>
      </div>
      <nav>{ADMIN_DESKTOP_MODULES.map((item) => <button type="button" key={item.id} className={active === item.id ? 'is-active' : ''} aria-current={active === item.id ? 'page' : undefined} onClick={() => navigateAdmin(item.id)}><i aria-hidden="true">{item.icon}</i><span>{item.title}</span></button>)}</nav>
    </aside>
    <header className="hrx-glass-topbar hrx-unified-topbar">
      <div className="hrx-unified-title"><span>{contextLabel}</span><strong>{route.title}</strong></div>
      <div className="hrx-unified-actions">
        <NotificationButton buttonRef={notificationButtonRef} alerts={alerts} open={notificationOpen} onClick={onToggleNotifications} />
        <div ref={profileRef} className="hrx-profile-wrapper">
          <button className="hrx-unified-profile" type="button" aria-expanded={profileOpen} aria-haspopup="menu" onClick={() => setProfileOpen((val) => !val)}>
            <span>HR</span>
            <div><strong>Administrador</strong><small>HRX Solutions</small></div>
          </button>
          {profileOpen && (
            <div className="hrx-profile-popover" role="menu">
              <div className="hrx-profile-popover-head">
                <strong>Administrador</strong>
                <span>Sessão AAL2 ativa</span>
              </div>
              <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); navigateAdmin('settings') }}>
                Configurações da conta
              </button>
              <button type="button" role="menuitem" className="is-danger" onClick={handleLogout}>
                Encerrar sessão
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
    <main className="hrx-unified-content" data-admin-workspace="true">{children}</main>
  </div>
}

function PwaShell({ route, alerts, notificationOpen, notificationButtonRef, onToggleNotifications, children, runtime, viewport }: { route: AdminResolvedRoute; alerts: AlertSnapshot; notificationOpen: boolean; notificationButtonRef: Ref<HTMLButtonElement>; onToggleNotifications: () => void; children: ReactNode; runtime: RuntimeMode; viewport: ViewportClass }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const active = route.module.id
  const moreActive = moreOpen || ADMIN_MOBILE_MORE_MODULES.some((item) => item.id === active)
  const go = (destination: AdminDestination) => { setMoreOpen(false); navigateAdmin(destination) }
  const contextLabel = route.subroute ? `HRX ADMIN · ${route.module.shortTitle ?? route.module.title}` : 'HRX ADMIN'

  useEffect(() => setMoreOpen(false), [active])

  return <div className="hrx-unified-shell is-pwa" data-admin-shell="pwa" data-runtime={runtime} data-viewport={viewport}>
    <header className="hrx-glass-topbar hrx-unified-topbar hrx-pwa-topbar">
      <div className="hrx-pwa-brand"><img src="/hrx-logo.svg" alt="HRX Solutions" /><div><span>{contextLabel}</span><strong>{route.shortTitle}</strong></div></div>
      <div className="hrx-unified-actions">
        <NotificationButton buttonRef={notificationButtonRef} alerts={alerts} open={notificationOpen} onClick={onToggleNotifications} />
      </div>
    </header>
    {moreOpen && <aside id="hrx-pwa-secondary" className="hrx-pwa-secondary" aria-label="Mais áreas do HRX Admin"><header><span>MAIS ÁREAS</span><button type="button" aria-label="Fechar menu" onClick={() => setMoreOpen(false)}>×</button></header><nav>{ADMIN_MOBILE_MORE_MODULES.map((item) => <button type="button" key={item.id} className={active === item.id ? 'is-active' : ''} aria-current={active === item.id ? 'page' : undefined} onClick={() => go(item.id)}><i aria-hidden="true">{item.icon}</i><span>{item.title}</span></button>)}</nav></aside>}
    <main className="hrx-unified-content" data-admin-workspace="true">{children}</main>
    <nav className="hrx-mobile-nav hrx-unified-mobile-nav" aria-label="Navegação principal do aplicativo">
      {ADMIN_MOBILE_PRIMARY_MODULES.map((item) => <button type="button" key={item.id} className={active === item.id ? 'is-active' : ''} aria-current={active === item.id ? 'page' : undefined} onClick={() => go(item.id)}><i aria-hidden="true">{item.icon}</i><span>{item.shortTitle || item.title}</span></button>)}
      <button className={`hrx-mobile-more${moreActive ? ' is-active' : ''}`} type="button" aria-label="Abrir mais áreas" aria-expanded={moreOpen} aria-controls="hrx-pwa-secondary" onClick={() => setMoreOpen((value) => !value)}><i aria-hidden="true">•••</i><span>Mais</span></button>
    </nav>
  </div>
}

export default function AdminUnifiedRoot() {
  const [route, setRoute] = useState<AdminResolvedRoute>(() => resolveAdminRoute())
  const [alerts, setAlerts] = useState<AlertSnapshot>(EMPTY_ALERTS)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const notificationButtonRef = useRef<HTMLButtonElement>(null)
  const environment = useAdminEnvironment()
  const compactShell = environment.viewport !== 'desktop'
  const active = route.module.id

  useEffect(() => {
    canonicalizeAdminLocation(active)
    return onAdminRouteChange((nextRoute) => {
      setRoute(nextRoute)
      setNotificationOpen(false)
    })
  }, [])

  useEffect(() => {
    document.title = `${route.title} · HRX Admin`
  }, [route.title])

  useEffect(() => {
    document.documentElement.dataset.hrxRuntime = environment.runtime
    document.documentElement.dataset.hrxViewport = environment.viewport
  }, [environment])

  useEffect(() => {
    let disposed = false
    let refreshTimer = 0

    const countQuoteStatus = (status: string) => hrxSupabase.from('quote_drafts').select('id', { count: 'exact', head: true }).eq('status', status)
    const loadAlerts = async () => {
      if (disposed) return
      setAlerts((current) => ({ ...current, status: 'loading' }))
      const now = new Date().toISOString()
      const [suspendedResult, needsScopeResult, awaitingReviewResult, documentsResult] = await Promise.all([
        countQuoteStatus('suspended'),
        countQuoteStatus('needs_scope'),
        countQuoteStatus('awaiting_review'),
        hrxSupabase.from('hrx_documents').select('id', { count: 'exact', head: true }).eq('status', 'active').lt('expires_at', now),
      ])
      if (disposed) return
      const failed = [suspendedResult.error, needsScopeResult.error, awaitingReviewResult.error, documentsResult.error].some(Boolean)
      if (failed) {
        setAlerts((current) => ({ ...current, status: 'unavailable' }))
        return
      }
      setAlerts({
        status: 'ready',
        suspended: suspendedResult.count ?? 0,
        needsScope: needsScopeResult.count ?? 0,
        awaitingReview: awaitingReviewResult.count ?? 0,
        expiredDocuments: documentsResult.count ?? 0,
      })
    }

    const refreshWhenUsable = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void loadAlerts()
    }

    void loadAlerts()
    refreshTimer = window.setInterval(refreshWhenUsable, ALERT_REFRESH_MS)
    window.addEventListener('focus', refreshWhenUsable)
    window.addEventListener('online', refreshWhenUsable)
    document.addEventListener('visibilitychange', refreshWhenUsable)

    const realtime = hrxSupabase
      .channel('hrx-admin-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quote_drafts' }, refreshWhenUsable)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hrx_documents' }, refreshWhenUsable)
      .subscribe()

    return () => {
      disposed = true
      if (refreshTimer) window.clearInterval(refreshTimer)
      window.removeEventListener('focus', refreshWhenUsable)
      window.removeEventListener('online', refreshWhenUsable)
      document.removeEventListener('visibilitychange', refreshWhenUsable)
      void hrxSupabase.removeChannel(realtime)
    }
  }, [])

  const content = useMemo(() => <RouteContent route={route} />, [route])
  const closeNotifications = () => {
    setNotificationOpen(false)
    window.requestAnimationFrame(() => notificationButtonRef.current?.focus())
  }

  return <>
    {compactShell
      ? <PwaShell route={route} alerts={alerts} notificationOpen={notificationOpen} notificationButtonRef={notificationButtonRef} onToggleNotifications={() => setNotificationOpen((current) => !current)} runtime={environment.runtime} viewport={environment.viewport}>{content}</PwaShell>
      : <DesktopShell route={route} alerts={alerts} notificationOpen={notificationOpen} notificationButtonRef={notificationButtonRef} onToggleNotifications={() => setNotificationOpen((current) => !current)} runtime={environment.runtime} viewport={environment.viewport}>{content}</DesktopShell>}
    {notificationOpen && <NotificationPanel alerts={alerts} onClose={closeNotifications} onNavigate={(destination) => navigateAdmin(destination)} />}
    <AdminPersonalizationBridge settingsActive={active === 'settings'} />
  </>
}
