import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import AdminApp from './AdminApp'
import AdminMfaGate from './AdminMfaGate'
import { adminBootstrapEndpoint, hrxPublishableKey, hrxSupabase } from './supabaseClient'
import { passwordMeetsPolicy, passwordRequirementText, secureUpdateAdminPassword } from './passwordSecurity'
import './admin-auth.css'

type MessageTone = 'success' | 'warning' | 'error'
type LoginMode = 'login' | 'activate'

function recoveryRequested() {
  const search = new URLSearchParams(window.location.search)
  return search.get('recovery') === '1' || /(?:^|[#&])type=recovery(?:&|$)/.test(window.location.hash)
}

function clearRecoveryUrl() {
  const url = new URL(window.location.href)
  url.searchParams.delete('recovery')
  url.hash = ''
  window.history.replaceState({}, '', `${url.pathname}${url.search}`)
}

function BrandLockup() {
  return <div className="admin-auth-brand"><span>HRX</span><small>SOLUTIONS · ADMIN</small></div>
}

function LoginScreen() {
  const [mode, setMode] = useState<LoginMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [activationCode, setActivationCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [tone, setTone] = useState<MessageTone>('success')

  const activationValid = useMemo(() => email.trim().length > 3 && activationCode.trim().length >= 10 && passwordMeetsPolicy(password) && password === confirmPassword, [email, activationCode, password, confirmPassword])

  const login = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const { error } = await hrxSupabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (!error) return
    setTone('error')
    const detail = `${error.name ?? ''} ${error.message ?? ''}`.toLowerCase()
    if (detail.includes('invalid login credentials')) setMessage('E-mail ou senha incorretos.')
    else if (detail.includes('email not confirmed')) setMessage('Este usuário ainda não está liberado para o ambiente administrativo.')
    else setMessage('Não foi possível entrar agora. Verifique seus dados e tente novamente.')
  }

  const activate = async (event: FormEvent) => {
    event.preventDefault()
    if (!activationValid) return
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(adminBootstrapEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: hrxPublishableKey },
        body: JSON.stringify({ email: email.trim(), code: activationCode.trim(), password }),
      })
      const body = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) {
        const messages: Record<string, string> = {
          invalid_code: 'Código de ativação inválido.',
          code_already_used: 'Este código já foi utilizado.',
          code_expired: 'Este código expirou. Solicite um novo código.',
          user_not_found: 'Este e-mail não corresponde ao administrador autorizado.',
          weak_password: passwordRequirementText,
          pwned_password: 'Esta senha aparece em bases públicas de vazamentos. Escolha uma senha exclusiva.',
          pwned_check_unavailable: 'A verificação de segurança está indisponível. A ativação foi bloqueada por segurança.',
        }
        setTone('error')
        setMessage(messages[body.error ?? ''] ?? 'Não foi possível ativar o acesso agora.')
        return
      }
      const { error: loginError } = await hrxSupabase.auth.signInWithPassword({ email: email.trim(), password })
      if (loginError) {
        setTone('warning')
        setMessage('A senha foi definida. Volte para Entrar e use a nova senha.')
        setMode('login')
      }
    } catch {
      setTone('error')
      setMessage('Não foi possível conectar ao serviço de ativação.')
    } finally {
      setBusy(false)
    }
  }

  const requestPassword = async () => {
    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      setTone('warning')
      setMessage('Informe primeiro o e-mail administrativo.')
      return
    }
    setRecoveryBusy(true)
    setMessage('')
    const redirectTo = `${window.location.origin}/admin/orcamentos?recovery=1`
    const { error } = await hrxSupabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo })
    setRecoveryBusy(false)
    setTone(error ? 'error' : 'success')
    setMessage(error ? 'Não foi possível enviar a recuperação de senha.' : 'Enviamos um link de recuperação para o e-mail informado.')
  }

  const switchMode = (nextMode: LoginMode) => {
    setMode(nextMode)
    setMessage('')
    setPassword('')
    setConfirmPassword('')
    setActivationCode('')
  }

  if (mode === 'activate') return <main className="admin-login-shell"><form className="admin-login-card admin-password-card" onSubmit={activate}><BrandLockup /><span className="eyebrow">PRIMEIRO ACESSO</span><h1>Ativar acesso</h1><p>Valide seu convite administrativo e defina a senha da conta.</p><label className="admin-field">E-mail administrativo<input type="email" required inputMode="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="admin-field">Código de ativação<input type="text" required autoCapitalize="characters" autoComplete="one-time-code" placeholder="XXXX-XXXX-XXXX-XXXX" value={activationCode} onChange={(event) => setActivationCode(event.target.value.toUpperCase())} /></label><label className="admin-field">Nova senha<span className="admin-password-input"><input type={showPassword ? 'text' : 'password'} required minLength={12} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" onClick={() => setShowPassword((current) => !current)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></span><small>{passwordRequirementText}</small></label><label className="admin-field">Confirmar nova senha<input type={showPassword ? 'text' : 'password'} required minLength={12} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>{password && !passwordMeetsPolicy(password) && <div className="admin-login-message is-warning">{passwordRequirementText}</div>}{confirmPassword && password !== confirmPassword && <div className="admin-login-message is-warning">As senhas precisam ser iguais.</div>}{message && <div className={`admin-login-message is-${tone}`} role="status">{message}</div>}<button className="button button-primary" type="submit" disabled={!activationValid || busy}>{busy ? 'Validando…' : 'Ativar acesso'}</button><button className="admin-recovery-button" type="button" disabled={busy} onClick={() => switchMode('login')}>← Voltar para o login</button></form></main>

  return <main className="admin-login-shell"><form className="admin-login-card admin-password-card" onSubmit={login}><BrandLockup /><span className="eyebrow">ACESSO ADMINISTRATIVO</span><h1>HRX Admin</h1><p>Entre com suas credenciais administrativas.</p><label className="admin-field">E-mail<input type="email" required inputMode="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="admin-field">Senha<span className="admin-password-input"><input type={showPassword ? 'text' : 'password'} required minLength={6} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" onClick={() => setShowPassword((current) => !current)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></span></label><button className="button button-primary" type="submit" disabled={busy || recoveryBusy}>{busy ? 'Validando…' : 'Continuar'}</button><div className="admin-auth-secondary"><button className="admin-recovery-button" type="button" disabled={busy || recoveryBusy} onClick={() => switchMode('activate')}>Primeiro acesso</button><button className="admin-recovery-button" type="button" disabled={busy || recoveryBusy} onClick={() => void requestPassword()}>{recoveryBusy ? 'Enviando…' : 'Recuperar senha'}</button></div>{message && <div className={`admin-login-message is-${tone}`} role="status">{message}</div>}<a className="admin-back-link" href="/">← Voltar ao site</a></form></main>
}

function PasswordRecoveryScreen({ session, onDone }: { session: Session; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const valid = useMemo(() => passwordMeetsPolicy(password) && password === confirmPassword, [password, confirmPassword])
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!valid || !session) return
    setBusy(true); setMessage('')
    const result = await secureUpdateAdminPassword(password)
    setBusy(false)
    if (!result.ok) { setMessage(result.message); return }
    clearRecoveryUrl(); onDone()
  }
  return <main className="admin-login-shell"><form className="admin-login-card admin-password-card" onSubmit={save}><BrandLockup /><span className="eyebrow">SEGURANÇA</span><h1>Definir nova senha</h1><p>Crie uma senha exclusiva. A verificação em duas etapas continua obrigatória.</p><label className="admin-field">Nova senha<span className="admin-password-input"><input type={showPassword ? 'text' : 'password'} required minLength={12} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" onClick={() => setShowPassword((current) => !current)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></span><small>{passwordRequirementText}</small></label><label className="admin-field">Confirmar senha<input type={showPassword ? 'text' : 'password'} required minLength={12} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>{confirmPassword && password !== confirmPassword && <div className="admin-login-message is-warning">As senhas precisam ser iguais.</div>}{message && <div className="admin-login-message is-error">{message}</div>}<button className="button button-primary" type="submit" disabled={!valid || busy}>{busy ? 'Validando segurança…' : 'Salvar nova senha'}</button></form></main>
}

export default function AdminAuthRouter() {
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).get('hrx-preview') === '1'
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [recovery, setRecovery] = useState(recoveryRequested)

  useEffect(() => {
    void hrxSupabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false) })
    const { data } = hrxSupabase.auth.onAuthStateChange((event, nextSession) => { setSession(nextSession); if (event === 'PASSWORD_RECOVERY') setRecovery(true); setChecking(false) })
    return () => data.subscription.unsubscribe()
  }, [])

  if (preview) return <AdminApp />
  if (checking) return <main className="admin-login-shell"><div className="admin-login-card"><p>Validando acesso seguro…</p></div></main>
  if (recovery && session) return <AdminMfaGate session={session} allowEnrollment={false}><PasswordRecoveryScreen session={session} onDone={() => setRecovery(false)} /></AdminMfaGate>
  if (!session) return <LoginScreen />
  return <AdminMfaGate session={session}><AdminApp /></AdminMfaGate>
}
