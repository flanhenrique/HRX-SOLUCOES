import { FormEvent, useEffect, useMemo, useState } from 'react'
import { hrxSupabase } from './supabaseClient'
import { navigateAdmin, onAdminNavigate, type AdminDestination } from './adminNavigation'
import { passwordMeetsPolicy, passwordRequirementText, secureUpdateAdminPassword } from './passwordSecurity'
import './admin-experience.css'
import './admin-shell-navigation.css'

type SettingsView = 'home' | 'password'

const navigationItems: Array<{ destination: Exclude<AdminDestination, 'settings'>; icon: string; label: string; description: string }> = [
  { destination: 'executive', icon: '◫', label: 'Visão executiva', description: 'Negócio, indicadores e atenção' },
  { destination: 'quotes', icon: '▦', label: 'Orçamentos', description: 'Fila e editor comercial' },
  { destination: 'clients', icon: '♙', label: 'Clientes', description: 'Carteira e histórico' },
  { destination: 'suspensions', icon: 'Ⅱ', label: 'Suspensões', description: 'Parados e retomadas' },
  { destination: 'documents', icon: '▤', label: 'Central de documentos', description: 'Governança documental' },
  { destination: 'panels', icon: '▦', label: 'Painéis', description: 'Projetos e prioridades' },
  { destination: 'fiscal', icon: '◇', label: 'Fiscal', description: 'Cadastro e situação tributária' },
]

export default function AdminExperienceLayer() {
  const [active, setActive] = useState<AdminDestination>(() => window.location.hash === '#admin/painels' ? 'panels' : 'executive')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsView, setSettingsView] = useState<SettingsView>('home')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  useEffect(() => { void hrxSupabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? '')) }, [])
  useEffect(() => onAdminNavigate((destination) => {
    if (destination === 'settings') {
      setSettingsOpen(true)
      return
    }
    setActive(destination)
    setSettingsOpen(false)
    setMobileMenuOpen(false)
  }), [])

  useEffect(() => {
    document.documentElement.classList.toggle('hrx-settings-open', settingsOpen)
    document.documentElement.classList.toggle('hrx-mobile-menu-open', mobileMenuOpen)
    return () => {
      document.documentElement.classList.remove('hrx-settings-open')
      document.documentElement.classList.remove('hrx-mobile-menu-open')
    }
  }, [settingsOpen, mobileMenuOpen])

  const passwordValid = useMemo(() => passwordMeetsPolicy(password) && password === confirmPassword, [password, confirmPassword])
  const initials = (email || 'HR').slice(0, 2).toUpperCase()

  const closeSettings = () => {
    if (passwordBusy) return
    setSettingsOpen(false); setSettingsView('home'); setPassword(''); setConfirmPassword(''); setPasswordMessage(''); setPasswordSuccess(false)
  }
  const openSettings = () => { setMobileMenuOpen(false); setSettingsView('home'); setSettingsOpen(true) }
  const openDestination = (destination: Exclude<AdminDestination, 'settings'>) => { setMobileMenuOpen(false); navigateAdmin(destination) }

  const changePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (!passwordValid) return
    setPasswordBusy(true); setPasswordMessage(''); setPasswordSuccess(false)
    const result = await secureUpdateAdminPassword(password)
    setPasswordBusy(false)
    if (!result.ok) { setPasswordMessage(result.message); return }
    setPassword(''); setConfirmPassword(''); setPasswordSuccess(true); setPasswordMessage('Senha alterada com sucesso e validada pela política de segurança da HRX.')
  }

  return <>
    <aside className="hrx-admin-shell-sidebar" aria-label="Navegação principal do HRX Admin">
      <div className="hrx-admin-shell-brand"><strong>HRX</strong><span>SOLUTIONS</span><small>ADMIN</small></div>
      <nav><span className="hrx-admin-shell-section">GESTÃO</span>{navigationItems.map((item) => <button key={item.destination} type="button" className={active === item.destination ? 'is-active' : ''} onClick={() => openDestination(item.destination)}><span aria-hidden="true">{item.icon}</span><div><strong>{item.label}</strong><small>{item.description}</small></div></button>)}</nav>
      <footer><button type="button" className={settingsOpen ? 'is-active' : ''} onClick={openSettings}><span aria-hidden="true">⚙</span><div><strong>Configurações</strong><small>Conta e segurança</small></div></button><div className="hrx-admin-shell-account"><span>{initials}</span><div><strong>Administrador</strong><small>{email || 'Sessão protegida'}</small></div></div></footer>
    </aside>

    <nav className="hrx-admin-shell-mobile-nav" aria-label="Navegação mobile do HRX Admin">
      <button type="button" className={active === 'executive' ? 'is-active' : ''} onClick={() => openDestination('executive')}><span>◫</span>Início</button>
      <button type="button" className={active === 'quotes' ? 'is-active' : ''} onClick={() => openDestination('quotes')}><span>▦</span>Orçamentos</button>
      <button type="button" onClick={() => setMobileMenuOpen(true)}><span>☰</span>Menu</button>
    </nav>

    {mobileMenuOpen && <div className="hrx-mobile-menu-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileMenuOpen(false) }}><section className="hrx-mobile-menu" role="dialog" aria-modal="true" aria-label="Menu do HRX Admin"><header><div><span>HRX ADMIN</span><h2>Navegação</h2></div><button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Fechar">×</button></header><div className="hrx-mobile-menu-grid">
      {navigationItems.map((item) => <button type="button" key={item.destination} className={active === item.destination ? 'is-active' : ''} onClick={() => openDestination(item.destination)}><span>{item.icon}</span><strong>{item.label}</strong><small>{item.description}</small></button>)}
      <button type="button" onClick={openSettings}><span>⚙</span><strong>Configurações</strong><small>Conta e segurança</small></button>
    </div><button type="button" className="hrx-mobile-refresh" onClick={() => window.location.reload()}>↻ Atualizar dados</button></section></div>}

    {settingsOpen && <section className="hrx-settings-shell" role="dialog" aria-modal="true" aria-label="Configurações do HRX Admin"><header className="hrx-settings-header"><div><span>HRX · SISTEMA</span><h2>Configurações</h2></div><button type="button" onClick={closeSettings} aria-label="Fechar">×</button></header><div className="hrx-settings-body"><aside className="hrx-settings-menu"><button type="button" className={settingsView === 'home' ? 'is-active' : ''} onClick={() => setSettingsView('home')}><span>⌂</span><div><strong>Conta</strong><small>Perfil e sessão</small></div></button><button type="button" className={settingsView === 'password' ? 'is-active' : ''} onClick={() => setSettingsView('password')}><span>⌁</span><div><strong>Segurança</strong><small>Alterar senha</small></div></button></aside><main className="hrx-settings-content">
      {settingsView === 'home' && <><div className="hrx-settings-title"><span>CONTA ADMINISTRATIVA</span><h3>Seu acesso</h3><p>Gerencie as informações e a segurança usadas no HRX Admin.</p></div><section className="hrx-settings-card"><div className="hrx-settings-account"><span>{initials}</span><div><strong>Administrador HRX</strong><small>{email || 'Conta autenticada'}</small></div></div><dl><div><dt>Perfil</dt><dd>Administrador</dd></div><div><dt>Ambiente</dt><dd>HRX Admin PWA</dd></div></dl></section><section className="hrx-settings-card hrx-settings-security-row"><div><span>SEGURANÇA</span><strong>Senha de acesso</strong><small>Use uma senha exclusiva e mantenha a verificação em duas etapas ativa.</small></div><button type="button" onClick={() => setSettingsView('password')}>Alterar senha</button></section></>}
      {settingsView === 'password' && <form className="hrx-settings-password" onSubmit={changePassword}><div className="hrx-settings-title"><span>SEGURANÇA</span><h3>Alterar senha</h3><p>A nova senha será validada pela mesma política usada no login e na recuperação de acesso.</p></div><label>Nova senha<div className="hrx-settings-password-field"><input type={showPassword ? 'text' : 'password'} minLength={12} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" onClick={() => setShowPassword((current) => !current)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></div><small>{passwordRequirementText}</small></label><label>Confirmar nova senha<input type={showPassword ? 'text' : 'password'} minLength={12} required autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>{password && !passwordMeetsPolicy(password) && <div className="hrx-settings-message is-warning">{passwordRequirementText}</div>}{confirmPassword && password !== confirmPassword && <div className="hrx-settings-message is-warning">As senhas precisam ser iguais.</div>}{passwordMessage && <div className={`hrx-settings-message ${passwordSuccess ? 'is-success' : 'is-error'}`}>{passwordMessage}</div>}<div className="hrx-settings-actions"><button type="button" onClick={() => setSettingsView('home')}>Cancelar</button><button className="is-primary" type="submit" disabled={!passwordValid || passwordBusy}>{passwordBusy ? 'Validando segurança…' : 'Salvar nova senha'}</button></div></form>}
    </main></div></section>}
  </>
}
