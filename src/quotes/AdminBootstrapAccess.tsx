import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { adminBootstrapEndpoint, hrxPublishableKey, hrxSupabase } from './supabaseClient'
import { passwordMeetsPolicy, passwordRequirementText } from './passwordSecurity'
import './admin-bootstrap-access.css'

export default function AdminBootstrapAccess() {
  const [session, setSession] = useState<Session | null>(null)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    void hrxSupabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = hrxSupabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => data.subscription.unsubscribe()
  }, [])

  const valid = useMemo(() => (
    email.trim().length > 3 && code.trim().length >= 10 && passwordMeetsPolicy(password) && password === confirmPassword
  ), [email, code, password, confirmPassword])

  if (session) return null

  const close = () => {
    if (busy) return
    setOpen(false)
    setMessage('')
    setCode('')
    setPassword('')
    setConfirmPassword('')
  }

  const activate = async (event: FormEvent) => {
    event.preventDefault()
    if (!valid) return

    setBusy(true)
    setMessage('')

    try {
      const response = await fetch(adminBootstrapEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: hrxPublishableKey },
        body: JSON.stringify({ email: email.trim(), code: code.trim(), password }),
      })

      const body = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) {
        const messages: Record<string, string> = {
          invalid_code: 'Código de ativação inválido.',
          code_already_used: 'Este código já foi utilizado.',
          code_expired: 'Este código expirou. Gere um novo código de ativação.',
          user_not_found: 'Este e-mail não corresponde ao administrador autorizado.',
          weak_password: passwordRequirementText,
          pwned_password: 'Esta senha aparece em bases públicas de vazamentos. Escolha uma senha nova e exclusiva.',
          pwned_check_unavailable: 'A verificação contra vazamentos está indisponível. Por segurança, a ativação não foi concluída.',
          password_update_failed: 'A senha passou pela validação, mas o Supabase não conseguiu concluir a alteração.',
          invalid_input: 'Confira o e-mail, o código e a nova senha.',
        }
        setMessage(messages[body.error ?? ''] ?? 'Não foi possível ativar o acesso agora.')
        return
      }

      const { error: loginError } = await hrxSupabase.auth.signInWithPassword({ email: email.trim(), password })
      if (loginError) {
        setMessage('A senha foi definida, mas o login automático falhou. Feche esta tela e entre normalmente com a senha escolhida.')
        return
      }
      close()
    } catch {
      setMessage('Não foi possível conectar ao serviço de ativação. Tente novamente em instantes.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <button className="admin-bootstrap-launcher" type="button" onClick={() => setOpen(true)}>Ativar primeiro acesso</button>
    {open && <div className="admin-bootstrap-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
      <form className="admin-bootstrap-modal" onSubmit={activate} role="dialog" aria-modal="true" aria-labelledby="admin-bootstrap-title">
        <div className="admin-bootstrap-heading"><div><span>HRX · PRIMEIRO ACESSO</span><h2 id="admin-bootstrap-title">Ativar acesso</h2></div><button type="button" className="admin-bootstrap-close" onClick={close} aria-label="Fechar">×</button></div>
        <p>Use o código de ativação recebido para definir sua senha sem depender de um novo e-mail do Supabase.</p>
        <label className="admin-field">E-mail administrativo<input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className="admin-field">Código de ativação<input type="text" required autoCapitalize="characters" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX-XXXX" /></label>
        <label className="admin-field">Nova senha<span className="admin-password-input"><input type={showPassword ? 'text' : 'password'} required minLength={12} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" onClick={() => setShowPassword((current) => !current)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></span><small>{passwordRequirementText}</small></label>
        <label className="admin-field">Confirmar nova senha<input type={showPassword ? 'text' : 'password'} required minLength={12} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
        {password && !passwordMeetsPolicy(password) && <div className="admin-login-message is-warning">{passwordRequirementText}</div>}
        {confirmPassword && password !== confirmPassword && <div className="admin-login-message is-warning">As senhas precisam ser iguais.</div>}
        {message && <div className="admin-login-message is-error" role="alert">{message}</div>}
        <div className="admin-bootstrap-actions"><button type="button" className="button button-secondary" onClick={close} disabled={busy}>Cancelar</button><button type="submit" className="button button-primary" disabled={!valid || busy}>{busy ? 'Validando segurança…' : 'Ativar e entrar'}</button></div>
      </form>
    </div>}
  </>
}
