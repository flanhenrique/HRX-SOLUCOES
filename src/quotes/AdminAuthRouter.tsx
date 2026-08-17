import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import AdminQuotes from './AdminQuotes'
import { hrxSupabase } from './supabaseClient'
import './admin-auth.css'

type MessageTone = 'success' | 'warning' | 'error'

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

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [tone, setTone] = useState<MessageTone>('success')

  const login = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')

    const { error } = await hrxSupabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    setBusy(false)
    if (!error) return

    setTone('error')
    const detail = `${error.name ?? ''} ${error.message ?? ''}`.toLowerCase()
    if (detail.includes('invalid login credentials')) {
      setMessage('E-mail ou senha incorretos.')
      return
    }
    if (detail.includes('email not confirmed')) {
      setMessage('Este usuário ainda não está liberado no Supabase Auth.')
      return
    }
    setMessage('Não foi possível entrar agora. Tente novamente em alguns instantes.')
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

    if (error) {
      setTone('error')
      setMessage('Não foi possível iniciar a definição de senha agora.')
      return
    }

    setTone('success')
    setMessage('Enviamos um link para definir ou recuperar sua senha. Depois disso, os próximos acessos serão com e-mail e senha.')
  }

  return (
    <main className="admin-login-shell">
      <form className="admin-login-card admin-password-card" onSubmit={login}>
        <span className="eyebrow">HRX · AMBIENTE INTERNO</span>
        <h1>Entrar no HRX Admin</h1>
        <p>Use seu e-mail corporativo e sua senha. O acesso permanece restrito aos administradores autorizados.</p>

        <label className="admin-field">
          E-mail administrativo
          <input
            type="email"
            required
            inputMode="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="admin-field">
          Senha
          <span className="admin-password-input">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </span>
        </label>

        <button className="button button-primary" type="submit" disabled={busy || recoveryBusy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>

        <button className="admin-recovery-button" type="button" disabled={busy || recoveryBusy} onClick={() => void requestPassword()}>
          {recoveryBusy ? 'Enviando…' : 'Primeiro acesso ou esqueci minha senha'}
        </button>

        {message && <div className={`admin-login-message is-${tone}`} role="status">{message}</div>}
        <a className="admin-back-link" href="/">← Voltar ao site</a>
      </form>
    </main>
  )
}

function PasswordRecoveryScreen({ session, onDone }: { session: Session; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const valid = useMemo(() => password.length >= 8 && password === confirmPassword, [password, confirmPassword])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!valid || !session) return

    setBusy(true)
    setMessage('')
    const { error } = await hrxSupabase.auth.updateUser({ password })
    setBusy(false)

    if (error) {
      setMessage('Não foi possível salvar a nova senha. Solicite um novo link e tente novamente.')
      return
    }

    clearRecoveryUrl()
    onDone()
  }

  return (
    <main className="admin-login-shell">
      <form className="admin-login-card admin-password-card" onSubmit={save}>
        <span className="eyebrow">HRX · SEGURANÇA</span>
        <h1>Definir senha</h1>
        <p>Crie a senha que será usada nos próximos acessos ao HRX Admin.</p>

        <label className="admin-field">
          Nova senha
          <span className="admin-password-input">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button type="button" onClick={() => setShowPassword((current) => !current)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button>
          </span>
        </label>

        <label className="admin-field">
          Confirmar senha
          <input
            type={showPassword ? 'text' : 'password'}
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>

        {confirmPassword && password !== confirmPassword && <div className="admin-login-message is-warning">As senhas precisam ser iguais.</div>}
        {message && <div className="admin-login-message is-error" role="alert">{message}</div>}

        <button className="button button-primary" type="submit" disabled={!valid || busy}>
          {busy ? 'Salvando…' : 'Salvar senha e entrar'}
        </button>
      </form>
    </main>
  )
}

export default function AdminAuthRouter() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [recovery, setRecovery] = useState(recoveryRequested)

  useEffect(() => {
    void hrxSupabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })

    const { data } = hrxSupabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setChecking(false)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  if (checking) return <main className="admin-login-shell"><div className="admin-login-card"><p>Validando acesso…</p></div></main>
  if (recovery && session) return <PasswordRecoveryScreen session={session} onDone={() => setRecovery(false)} />
  if (!session) return <LoginScreen />
  return <AdminQuotes />
}
