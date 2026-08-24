import { lazy, ReactNode, Ref, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import AdminPersonalizationBridge from './AdminPersonalizationBridge'
import { navigateAdmin, onAdminNavigate, resolveAdminDestination, type AdminDestination } from './adminNavigation'
import { hrxSupabase } from './supabaseClient'

const AdminExecutiveDashboard = lazy(() => import('./AdminExecutiveDashboard'))
const AdminProjectPanelsPage = lazy(() => import('./AdminProjectPanelsPage'))
const AdminExperienceLayer = lazy(() => import('./AdminExperienceLayer'))
const AdminClientsPage = lazy(() => import('./AdminClientsPage'))
const AdminDocumentsPage = lazy(() => import('./AdminDocumentsPage'))
const AdminQuotes = lazy(() => import('./AdminQuotes'))
const AdminFinancePage = lazy(() => import('./AdminFinancePage'))
const AdminFiscalPage = lazy(() => import('./AdminFiscalPage'))
const AdminSuspensionsPage = lazy(() => import('./AdminSuspensionsPage'))

type NavItem = { destination: AdminDestination; label: string; shortLabel?: string; icon: string }
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

const navItems: NavItem[] = [
  { destination: 'executive', label: 'Visão Geral', shortLabel: 'Início', icon: '⌂' },
  { destination: 'panels', label: 'Projetos', icon: '▣' },
  { destination: 'activities', label: 'Atividades', icon: '✓' },
  { destination: 'quotes', label: 'Orçamentos', icon: '◫' },
  { destination: 'clients', label: 'Clientes', icon: '♙' },
  { destination: 'suspensions', label: 'Suspensões', icon: 'Ⅱ' },
  { destination: 'fiscal', label: 'Fiscal', icon: '§' },
  { destination: 'finance', label: 'Financeiro', icon: '¤' },
  { destination: 'documents', label: 'Central de Documentos', shortLabel: 'Docs', icon: '▤' },
  { destination: 'settings', label: 'Configurações', shortLabel: 'Perfil', icon: '⚙' },
]

const pwaPrimary = new Set<AdminDestination>(['executive', 'quotes', 'panels', 'documents', 'settings'])

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

function ActivatedRoute({ destination, children }: { destination: AdminDestination; children: ReactNode }) {
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => navigateAdmin(destination, { replace: true }))
    return () => window.cancelAnimationFrame(frame)
  }, [destination])
  return <>{children}</>
}

function RouteLoading() {
  return <section className="hrx-route-loading" role="status" aria-live="polite">Carregando área administrativa…</section>
}

function RouteContent({ destination }: { destination: AdminDestination }) {
  let content: ReactNode

  if (destination === 'executive') content = <AdminExecutiveDashboard />
  else if (destination === 'panels') content = <AdminProjectPanelsPage />
  else if (destination === 'clients') content = <AdminClientsPage />
  else if (destination === 'documents') content = <AdminDocumentsPage />
  else if (destination === 'quotes') content = <AdminQuotes />
  else if (destination === 'finance') content = <AdminFinancePage />
  else if (destination === 'suspensions') content = <AdminSuspensionsPage />
  else if (destination === 'fiscal') content = <AdminFiscalPage />
  else content = <AdminExperienceLayer />

  return <Suspense fallback={<RouteLoading />}><ActivatedRoute destination={destination}>{content}</ActivatedRoute></Suspense>
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

function DesktopShell({ active, alerts, notificationOpen, notificationButtonRef, onToggleNotifications, children, runtime, viewport }: { active: AdminDestination; alerts: AlertSnapshot; notificationOpen: boolean; notificationButtonRef: Ref<HTMLButtonElement>; onToggleNotifications: () => void; children: ReactNode; runtime: RuntimeMode; viewport: ViewportClass }) {
  const current = navItems.find((item) => item.destination === active) ?? navItems[0]
  return <div className="hrx-unified-shell is-desktop" data-admin-shell="desktop" data-runtime={runtime} data-viewport={viewport}>
    <aside className="hrx-glass-sidebar hrx-unified-sidebar" aria-label="Navegação principal do HRX Admin">
      <div className="hrx-glass-brand"><strong>HRX</strong><span>Solutions</span></div>
      <nav>{navItems.map((item) => <button type="button" key={item.destination} className={active === item.destination ? 'is-active' : ''} aria-current={active === item.destination ? 'page' : undefined} onClick={() => navigateAdmin(item.destination)}><i aria-hidden="true">{item.icon}</i><span>{item.label}</span></button>)}</nav>
    </aside>
    <header className="hrx-glass-topbar hrx-unified-topbar">
      <div className="hrx-unified-title"><span>HRX ADMIN</span><strong>{current.label}</strong></div>
      <div className="hrx-unified-actions">
        <NotificationButton buttonRef={notificationButtonRef} alerts={alerts} open={notificationOpen} onClick={onToggleNotifications} />
        <button className="hrx-unified-profile" type="button" onClick={() => navigateAdmin('settings')}><span>HR</span><div><strong>Administrador</strong><small>HRX Solutions</small></div></button>
      </div>
    </header>
    <main className="hrx-unified-content" data-admin-workspace="true">{children}</main>
  </div>
}

function PwaShell({ active, alerts, notificationOpen, notificationButtonRef, onToggleNotifications, children, runtime, viewport }: { active: AdminDestination; alerts: AlertSnapshot; notificationOpen: boolean; notificationButtonRef: Ref<HTMLButtonElement>; onToggleNotifications: () => void; children: ReactNode; runtime: RuntimeMode; viewport: ViewportClass }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const current = navItems.find((item) => item.destination === active) ?? navItems[0]
  const primary = navItems.filter((item) => pwaPrimary.has(item.destination))
  const secondary = navItems.filter((item) => !pwaPrimary.has(item.destination))
  const go = (destination: AdminDestination) => { setMoreOpen(false); navigateAdmin(destination) }

  useEffect(() => setMoreOpen(false), [active])

  return <div className="hrx-unified-shell is-pwa" data-admin-shell="pwa" data-runtime={runtime} data-viewport={viewport}>
    <header className="hrx-glass-topbar hrx-unified-topbar hrx-pwa-topbar">
      <div className="hrx-pwa-brand"><img src="/hrx-logo.svg" alt="HRX Solutions" /><div><span>HRX ADMIN</span><strong>{current.shortLabel || current.label}</strong></div></div>
      <div className="hrx-unified-actions">
        <NotificationButton buttonRef={notificationButtonRef} alerts={alerts} open={notificationOpen} onClick={onToggleNotifications} />
        <button className={`hrx-pwa-more${moreOpen ? ' is-open' : ''}`} type="button" aria-label="Abrir mais áreas" aria-expanded={moreOpen} aria-controls="hrx-pwa-secondary" onClick={() => setMoreOpen((value) => !value)}>•••</button>
      </div>
    </header>
    {moreOpen && <aside id="hrx-pwa-secondary" className="hrx-pwa-secondary" aria-label="Mais áreas do HRX Admin"><header><span>MAIS ÁREAS</span><button type="button" aria-label="Fechar menu" onClick={() => setMoreOpen(false)}>×</button></header><nav>{secondary.map((item) => <button type="button" key={item.destination} className={active === item.destination ? 'is-active' : ''} aria-current={active === item.destination ? 'page' : undefined} onClick={() => go(item.destination)}><i aria-hidden="true">{item.icon}</i><span>{item.label}</span></button>)}</nav></aside>}
    <main className="hrx-unified-content" data-admin-workspace="true">{children}</main>
    <nav className="hrx-mobile-nav hrx-unified-mobile-nav" aria-label="Navegação principal do aplicativo">{primary.map((item) => <button type="button" key={item.destination} className={active === item.destination ? 'is-active' : ''} aria-current={active === item.destination ? 'page' : undefined} onClick={() => go(item.destination)}><i aria-hidden="true">{item.icon}</i><span>{item.shortLabel || item.label}</span></button>)}</nav>
  </div>
}

export default function AdminUnifiedRoot() {
  const [active, setActive] = useState<AdminDestination>(() => resolveAdminDestination())
  const [alerts, setAlerts] = useState<AlertSnapshot>(EMPTY_ALERTS)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const notificationButtonRef = useRef<HTMLButtonElement>(null)
  const environment = useAdminEnvironment()
  const compactShell = environment.viewport !== 'desktop'

  useEffect(() => onAdminNavigate((destination) => {
    setActive(destination)
    setNotificationOpen(false)
  }), [])

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

  const content = useMemo(() => <RouteContent destination={active} />, [active])
  const closeNotifications = () => {
    setNotificationOpen(false)
    window.requestAnimationFrame(() => notificationButtonRef.current?.focus())
  }

  return <>
    {compactShell
      ? <PwaShell active={active} alerts={alerts} notificationOpen={notificationOpen} notificationButtonRef={notificationButtonRef} onToggleNotifications={() => setNotificationOpen((current) => !current)} runtime={environment.runtime} viewport={environment.viewport}>{content}</PwaShell>
      : <DesktopShell active={active} alerts={alerts} notificationOpen={notificationOpen} notificationButtonRef={notificationButtonRef} onToggleNotifications={() => setNotificationOpen((current) => !current)} runtime={environment.runtime} viewport={environment.viewport}>{content}</DesktopShell>}
    {notificationOpen && <NotificationPanel alerts={alerts} onClose={closeNotifications} onNavigate={(destination) => navigateAdmin(destination)} />}
    <AdminPersonalizationBridge settingsActive={active === 'settings'} />
  </>
}
