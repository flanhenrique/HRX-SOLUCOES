import { ReactNode, useEffect, useMemo, useState } from 'react'
import AdminExperienceLayer from './AdminExperienceLayer'
import AdminFiscalPage from './AdminFiscalPage'
import AdminPersonalizationBridge from './AdminPersonalizationBridge'
import AdminQuotes from './AdminQuotes'
import AdminSuspensionsPage from './AdminSuspensionsPage'
import { navigateAdmin, onAdminNavigate, type AdminDestination } from './adminNavigation'
import { hrxSupabase } from './supabaseClient'
import './admin-unified-shell.css'

type NavItem = { destination: AdminDestination; label: string; shortLabel?: string; icon: string }

const navItems: NavItem[] = [
  { destination: 'executive', label: 'Visão Geral', shortLabel: 'Início', icon: '⌂' },
  { destination: 'panels', label: 'Projetos', icon: '▣' },
  { destination: 'activities', label: 'Atividades', icon: '✓' },
  { destination: 'quotes', label: 'Orçamentos', icon: '◫' },
  { destination: 'clients', label: 'Clientes', icon: '♙' },
  { destination: 'suspensions', label: 'Suspensões', icon: 'Ⅱ' },
  { destination: 'fiscal', label: 'Fiscal', icon: '§' },
  { destination: 'documents', label: 'Central de Documentos', shortLabel: 'Docs', icon: '▤' },
  { destination: 'settings', label: 'Configurações', shortLabel: 'Perfil', icon: '⚙' },
]

const coreDestinations = new Set<AdminDestination>(['executive', 'panels', 'activities', 'clients', 'documents', 'settings'])
const pwaPrimary = new Set<AdminDestination>(['executive', 'quotes', 'panels', 'documents', 'settings'])

function initialDestination(): AdminDestination {
  const hash = window.location.hash.replace(/^#admin\//, '')
  const map: Record<string, AdminDestination> = {
    'visao-geral': 'executive',
    paineis: 'panels',
    atividades: 'activities',
    orcamentos: 'quotes',
    clientes: 'clients',
    suspensoes: 'suspensions',
    fiscal: 'fiscal',
    documentos: 'documents',
    configuracoes: 'settings',
  }
  if (map[hash]) return map[hash]
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
  if (pathname === '/admin/orcamentos') return 'quotes'
  return 'executive'
}

function useCompactAdmin() {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 760px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const onChange = (event: MediaQueryListEvent) => setCompact(event.matches)
    setCompact(media.matches)
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [])
  return compact
}

function ActivatedRoute({ destination, children }: { destination: 'fiscal' | 'suspensions'; children: ReactNode }) {
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => navigateAdmin(destination))
    return () => window.cancelAnimationFrame(frame)
  }, [destination])
  return <>{children}</>
}

function RouteContent({ destination }: { destination: AdminDestination }) {
  if (coreDestinations.has(destination)) return <AdminExperienceLayer />
  if (destination === 'quotes') return <AdminQuotes />
  if (destination === 'suspensions') return <ActivatedRoute destination="suspensions"><AdminSuspensionsPage /></ActivatedRoute>
  if (destination === 'fiscal') return <ActivatedRoute destination="fiscal"><AdminFiscalPage /></ActivatedRoute>
  return <AdminExperienceLayer />
}

function DesktopShell({ active, alertCount, children }: { active: AdminDestination; alertCount: number; children: ReactNode }) {
  const current = navItems.find((item) => item.destination === active) ?? navItems[0]
  return <div className="hrx-unified-shell is-desktop" data-admin-shell="desktop">
    <aside className="hrx-glass-sidebar hrx-unified-sidebar" aria-label="Navegação principal do HRX Admin">
      <div className="hrx-glass-brand"><strong>HRX</strong><span>Solutions</span></div>
      <nav>{navItems.map((item) => <button type="button" key={item.destination} className={active === item.destination ? 'is-active' : ''} aria-current={active === item.destination ? 'page' : undefined} onClick={() => navigateAdmin(item.destination)}><i aria-hidden="true">{item.icon}</i><span>{item.label}</span></button>)}</nav>
    </aside>
    <header className="hrx-glass-topbar hrx-unified-topbar">
      <div className="hrx-unified-title"><span>HRX ADMIN</span><strong>{current.label}</strong></div>
      <div className="hrx-unified-actions">
        <button className="hrx-notifications" type="button" aria-label={`${alertCount} notificações`}><span aria-hidden="true">♢</span>{alertCount > 0 && <b>{alertCount}</b>}</button>
        <button className="hrx-unified-profile" type="button" onClick={() => navigateAdmin('settings')}><span>HR</span><div><strong>Administrador</strong><small>HRX Solutions</small></div></button>
      </div>
    </header>
    <main className="hrx-unified-content" data-admin-workspace="true">{children}</main>
  </div>
}

function PwaShell({ active, alertCount, children }: { active: AdminDestination; alertCount: number; children: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const current = navItems.find((item) => item.destination === active) ?? navItems[0]
  const primary = navItems.filter((item) => pwaPrimary.has(item.destination))
  const secondary = navItems.filter((item) => !pwaPrimary.has(item.destination))
  const go = (destination: AdminDestination) => { setMoreOpen(false); navigateAdmin(destination) }
  return <div className="hrx-unified-shell is-pwa" data-admin-shell="pwa">
    <header className="hrx-glass-topbar hrx-unified-topbar hrx-pwa-topbar">
      <div className="hrx-pwa-brand"><img src="/hrx-logo.svg" alt="HRX Solutions" /><div><span>HRX ADMIN</span><strong>{current.shortLabel || current.label}</strong></div></div>
      <div className="hrx-unified-actions">
        <button className="hrx-notifications" type="button" aria-label={`${alertCount} notificações`}><span aria-hidden="true">♢</span>{alertCount > 0 && <b>{alertCount}</b>}</button>
        <button className="hrx-pwa-settings" type="button" aria-label="Abrir configurações" onClick={() => go('settings')}>⚙</button>
        <button className={`hrx-pwa-more${moreOpen ? ' is-open' : ''}`} type="button" aria-expanded={moreOpen} aria-controls="hrx-pwa-secondary" onClick={() => setMoreOpen((value) => !value)}>•••</button>
      </div>
    </header>
    {moreOpen && <aside id="hrx-pwa-secondary" className="hrx-pwa-secondary" aria-label="Mais áreas do HRX Admin"><header><span>MAIS ÁREAS</span><button type="button" aria-label="Fechar menu" onClick={() => setMoreOpen(false)}>×</button></header><nav>{secondary.map((item) => <button type="button" key={item.destination} className={active === item.destination ? 'is-active' : ''} onClick={() => go(item.destination)}><i aria-hidden="true">{item.icon}</i><span>{item.label}</span></button>)}</nav></aside>}
    <main className="hrx-unified-content" data-admin-workspace="true">{children}</main>
    <nav className="hrx-mobile-nav hrx-unified-mobile-nav" aria-label="Navegação principal do aplicativo">{primary.map((item) => <button type="button" key={item.destination} className={active === item.destination ? 'is-active' : ''} aria-current={active === item.destination ? 'page' : undefined} onClick={() => go(item.destination)}><i aria-hidden="true">{item.icon}</i><span>{item.shortLabel || item.label}</span></button>)}</nav>
    <aside className="hrx-glass-sidebar hrx-unified-programmatic-nav" aria-hidden="true"><nav>{navItems.map((item) => <button type="button" key={item.destination} onClick={() => go(item.destination)}>{item.label}</button>)}</nav></aside>
  </div>
}

export default function AdminUnifiedRoot() {
  const [active, setActive] = useState<AdminDestination>(initialDestination)
  const [alertCount, setAlertCount] = useState(0)
  const compact = useCompactAdmin()

  useEffect(() => onAdminNavigate((destination) => setActive(destination)), [])

  useEffect(() => {
    let disposed = false
    const loadAlerts = async () => {
      const [draftsResult, documentsResult] = await Promise.all([
        hrxSupabase.from('quote_drafts').select('status'),
        hrxSupabase.from('hrx_documents').select('status,expires_at').neq('status', 'archived'),
      ])
      if (disposed) return
      const quoteAlerts = (draftsResult.data ?? []).filter((item) => ['suspended', 'needs_scope', 'awaiting_review'].includes(String(item.status))).length
      const now = Date.now()
      const documentAlerts = (documentsResult.data ?? []).filter((item) => item.expires_at && new Date(item.expires_at).valueOf() < now).length
      setAlertCount(quoteAlerts + documentAlerts)
    }
    void loadAlerts()
    const onFocus = () => void loadAlerts()
    window.addEventListener('focus', onFocus)
    return () => { disposed = true; window.removeEventListener('focus', onFocus) }
  }, [])

  const content = useMemo(() => <RouteContent destination={active} />, [active])

  return <>
    {compact ? <PwaShell active={active} alertCount={alertCount}>{content}</PwaShell> : <DesktopShell active={active} alertCount={alertCount}>{content}</DesktopShell>}
    <AdminPersonalizationBridge />
  </>
}
