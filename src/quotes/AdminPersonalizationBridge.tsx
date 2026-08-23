import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { hrxSupabase } from './supabaseClient'

type Appearance = 'system' | 'dark' | 'light'
type Accent = 'blue' | 'cyan' | 'violet' | 'green'
type Density = 'comfortable' | 'compact'
type InterfaceScale = 'small' | 'default' | 'large'
type NavigationMode = 'auto' | 'compact' | 'expanded'

type UiPreferences = {
  appearance: Appearance
  accent: Accent
  density: Density
  scale: InterfaceScale
  navigation: NavigationMode
}

type SyncState = 'local' | 'syncing' | 'synced' | 'error'

const STORAGE_KEY = 'hrx-admin-ui-preferences-v1'
const DEFAULT_PREFERENCES: UiPreferences = {
  appearance: 'system',
  accent: 'blue',
  density: 'comfortable',
  scale: 'default',
  navigation: 'auto',
}

const appearanceOptions: Array<{ value: Appearance; label: string }> = [
  { value: 'system', label: 'Automático' },
  { value: 'dark', label: 'Escuro' },
  { value: 'light', label: 'Claro' },
]
const densityOptions: Array<{ value: Density; label: string }> = [
  { value: 'comfortable', label: 'Confortável' },
  { value: 'compact', label: 'Compacta' },
]
const scaleOptions: Array<{ value: InterfaceScale; label: string }> = [
  { value: 'small', label: 'Pequena' },
  { value: 'default', label: 'Padrão' },
  { value: 'large', label: 'Grande' },
]
const navigationOptions: Array<{ value: NavigationMode; label: string }> = [
  { value: 'auto', label: 'Automático' },
  { value: 'compact', label: 'Compacto' },
  { value: 'expanded', label: 'Expandido' },
]
const accentOptions: Array<{ value: Accent; label: string }> = [
  { value: 'blue', label: 'Azul HRX' },
  { value: 'cyan', label: 'Ciano' },
  { value: 'violet', label: 'Violeta' },
  { value: 'green', label: 'Verde' },
]

function sanitizePreferences(value: unknown): UiPreferences {
  const raw = value && typeof value === 'object' ? value as Partial<UiPreferences> : {}
  const appearances: Appearance[] = ['system', 'dark', 'light']
  const accents: Accent[] = ['blue', 'cyan', 'violet', 'green']
  const densities: Density[] = ['comfortable', 'compact']
  const scales: InterfaceScale[] = ['small', 'default', 'large']
  const navigationModes: NavigationMode[] = ['auto', 'compact', 'expanded']

  return {
    appearance: appearances.includes(raw.appearance as Appearance) ? raw.appearance as Appearance : DEFAULT_PREFERENCES.appearance,
    accent: accents.includes(raw.accent as Accent) ? raw.accent as Accent : DEFAULT_PREFERENCES.accent,
    density: densities.includes(raw.density as Density) ? raw.density as Density : DEFAULT_PREFERENCES.density,
    scale: scales.includes(raw.scale as InterfaceScale) ? raw.scale as InterfaceScale : DEFAULT_PREFERENCES.scale,
    navigation: navigationModes.includes(raw.navigation as NavigationMode) ? raw.navigation as NavigationMode : DEFAULT_PREFERENCES.navigation,
  }
}

function resolvedAppearance(appearance: Appearance) {
  if (appearance !== 'system') return appearance
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyPreferences(preferences: UiPreferences) {
  const root = document.documentElement
  const resolved = resolvedAppearance(preferences.appearance)
  root.dataset.hrxTheme = preferences.appearance
  root.dataset.hrxThemeResolved = resolved
  root.dataset.hrxAccent = preferences.accent
  root.dataset.hrxDensity = preferences.density
  root.dataset.hrxScale = preferences.scale
  root.dataset.hrxNavigation = preferences.navigation

  const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (themeMeta) themeMeta.content = resolved === 'light' ? '#eef4fb' : '#07182a'
}

function clickAdminNavigation(label: string) {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.hrx-glass-sidebar nav button'))
  buttons.find((button) => button.textContent?.includes(label))?.click()
}

function PreferenceButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" className={active ? 'is-active' : ''} aria-pressed={active} onClick={onClick}>{label}</button>
}

export default function AdminPersonalizationBridge() {
  const [preferences, setPreferences] = useState<UiPreferences>(DEFAULT_PREFERENCES)
  const [remoteReady, setRemoteReady] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>('local')
  const [settingsTarget, setSettingsTarget] = useState<HTMLElement | null>(null)
  const [notificationButton, setNotificationButton] = useState<HTMLButtonElement | null>(null)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) setPreferences(sanitizePreferences(JSON.parse(stored)))
    } catch {
      // Preferências locais são auxiliares; falha de storage não bloqueia o admin.
    }

    let disposed = false
    void hrxSupabase.auth.getUser().then(({ data }) => {
      if (disposed) return
      const remote = data.user?.user_metadata?.hrx_ui_preferences
      if (remote) setPreferences(sanitizePreferences(remote))
      setRemoteReady(true)
    }).catch(() => {
      if (!disposed) setRemoteReady(true)
    })

    return () => { disposed = true }
  }, [])

  useEffect(() => {
    applyPreferences(preferences)
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)) } catch { /* opcional */ }
  }, [preferences])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => { if (preferences.appearance === 'system') applyPreferences(preferences) }
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [preferences])

  useEffect(() => {
    if (!remoteReady) return
    setSyncState('syncing')
    const timer = window.setTimeout(() => {
      void hrxSupabase.auth.updateUser({ data: { hrx_ui_preferences: preferences } }).then(({ error }) => {
        setSyncState(error ? 'error' : 'synced')
      }).catch(() => setSyncState('error'))
    }, 650)
    return () => window.clearTimeout(timer)
  }, [preferences, remoteReady])

  useEffect(() => {
    const host = document.getElementById('root')
    if (!host) return

    const syncDomTargets = () => {
      setSettingsTarget(document.querySelector<HTMLElement>('.hrx-settings-view .hrx-settings-layout > div'))
      const bell = document.querySelector<HTMLButtonElement>('.hrx-notifications')
      setNotificationButton(bell)
      const badge = bell?.querySelector<HTMLElement>(':scope > span')
      const parsed = Number.parseInt(badge?.textContent || '0', 10)
      setNotificationCount(Number.isFinite(parsed) ? parsed : 0)
    }

    syncDomTargets()
    const observer = new MutationObserver(syncDomTargets)
    observer.observe(host, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!notificationButton) return
    const onClick = (event: Event) => {
      event.preventDefault()
      setNotificationOpen((current) => !current)
    }
    notificationButton.setAttribute('aria-haspopup', 'dialog')
    notificationButton.addEventListener('click', onClick)
    return () => notificationButton.removeEventListener('click', onClick)
  }, [notificationButton])

  useEffect(() => {
    notificationButton?.setAttribute('aria-expanded', notificationOpen ? 'true' : 'false')
  }, [notificationButton, notificationOpen])

  useEffect(() => {
    if (!notificationOpen) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setNotificationOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [notificationOpen])

  const updatePreference = <K extends keyof UiPreferences>(key: K, value: UiPreferences[K]) => {
    setSyncState('local')
    setPreferences((current) => ({ ...current, [key]: value }))
  }

  const resetPreferences = () => {
    setSyncState('local')
    setPreferences({ ...DEFAULT_PREFERENCES })
  }

  const settingsPanel = settingsTarget ? createPortal(
    <section className="hrx-settings-card hrx-personalization-card" aria-labelledby="hrx-personalization-title">
      <header className="hrx-personalization-header">
        <div>
          <span className="hrx-preference-eyebrow">PERSONALIZAÇÃO</span>
          <h2 id="hrx-personalization-title">Interface do aplicativo</h2>
          <p>Ajuste aparência e densidade sem alterar os dados ou permissões do HRX.</p>
        </div>
        <span className={`hrx-preference-sync is-${syncState}`} aria-live="polite">
          {syncState === 'syncing' ? 'Sincronizando…' : syncState === 'synced' ? 'Sincronizado' : syncState === 'error' ? 'Salvo neste aparelho' : 'Alteração local'}
        </span>
      </header>

      <div className="hrx-preference-grid">
        <fieldset>
          <legend>Aparência</legend>
          <p>Segue o aparelho ou fixa um tema.</p>
          <div className="hrx-preference-segment">
            {appearanceOptions.map((option) => <PreferenceButton key={option.value} active={preferences.appearance === option.value} label={option.label} onClick={() => updatePreference('appearance', option.value)} />)}
          </div>
        </fieldset>

        <fieldset>
          <legend>Cor de destaque</legend>
          <p>Mantém o Liquid Glass e troca apenas a cor de interação.</p>
          <div className="hrx-accent-options">
            {accentOptions.map((option) => <button type="button" key={option.value} className={preferences.accent === option.value ? 'is-active' : ''} data-accent={option.value} aria-pressed={preferences.accent === option.value} onClick={() => updatePreference('accent', option.value)}><i aria-hidden="true"/><span>{option.label}</span></button>)}
          </div>
        </fieldset>

        <fieldset>
          <legend>Densidade</legend>
          <p>Controla o espaço entre informações.</p>
          <div className="hrx-preference-segment">
            {densityOptions.map((option) => <PreferenceButton key={option.value} active={preferences.density === option.value} label={option.label} onClick={() => updatePreference('density', option.value)} />)}
          </div>
        </fieldset>

        <fieldset>
          <legend>Tamanho da interface</legend>
          <p>Ajusta textos e componentes sem usar zoom do navegador.</p>
          <div className="hrx-preference-segment">
            {scaleOptions.map((option) => <PreferenceButton key={option.value} active={preferences.scale === option.value} label={option.label} onClick={() => updatePreference('scale', option.value)} />)}
          </div>
        </fieldset>

        <fieldset className="hrx-preference-wide">
          <legend>Menu no desktop</legend>
          <p>No celular o menu continua específico para PWA.</p>
          <div className="hrx-preference-segment">
            {navigationOptions.map((option) => <PreferenceButton key={option.value} active={preferences.navigation === option.value} label={option.label} onClick={() => updatePreference('navigation', option.value)} />)}
          </div>
        </fieldset>
      </div>

      <footer className="hrx-preference-footer">
        <button type="button" onClick={resetPreferences}>Restaurar padrão HRX</button>
        <small>As preferências são mantidas neste aparelho e sincronizadas com sua conta quando a conexão está disponível.</small>
      </footer>
    </section>,
    settingsTarget,
  ) : null

  return <>
    {settingsPanel}
    {notificationOpen && <aside className="hrx-notification-panel" role="dialog" aria-modal="false" aria-labelledby="hrx-notification-title">
      <header>
        <div><span>HRX ADMIN</span><h2 id="hrx-notification-title">Notificações</h2></div>
        <button type="button" aria-label="Fechar notificações" onClick={() => setNotificationOpen(false)}>×</button>
      </header>
      <div className="hrx-notification-summary">
        <strong>{notificationCount > 0 ? `${notificationCount} item${notificationCount === 1 ? '' : 's'} requer${notificationCount === 1 ? '' : 'em'} atenção` : 'Nenhuma pendência sinalizada'}</strong>
        <p>{notificationCount > 0 ? 'Abra a área correspondente para revisar bloqueios e documentos pendentes.' : 'O painel não indica bloqueios ou documentos vencidos neste momento.'}</p>
      </div>
      <div className="hrx-notification-actions">
        <button type="button" onClick={() => { clickAdminNavigation('Atividades'); setNotificationOpen(false) }}>Ver atividades e bloqueios</button>
        <button type="button" onClick={() => { clickAdminNavigation('Central de Documentos'); setNotificationOpen(false) }}>Revisar documentos</button>
      </div>
    </aside>}
  </>
}
