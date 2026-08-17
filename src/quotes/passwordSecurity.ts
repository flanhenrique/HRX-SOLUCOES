import { FunctionsHttpError } from '@supabase/supabase-js'
import { hrxSupabase } from './supabaseClient'

export const passwordRequirementText = 'Use pelo menos 12 caracteres, com letra maiúscula, minúscula, número e símbolo.'

export function passwordMeetsPolicy(password: string) {
  return password.length >= 12
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password)
}

export async function secureUpdateAdminPassword(password: string) {
  const { error } = await hrxSupabase.functions.invoke('admin-password', { body: { password } })
  if (!error) return { ok: true as const, message: '' }

  if (error instanceof FunctionsHttpError) {
    const payload = await error.context.json().catch(() => ({})) as { error?: string; occurrences?: number }
    const messages: Record<string, string> = {
      weak_password: passwordRequirementText,
      pwned_password: 'Esta senha aparece em bases públicas de vazamentos. Escolha outra senha que você nunca tenha usado.',
      pwned_check_unavailable: 'A verificação de segurança de senhas está indisponível. Por segurança, a alteração não foi concluída.',
      unauthorized: 'Sua sessão expirou. Entre novamente antes de alterar a senha.',
      forbidden: 'Seu usuário não possui permissão administrativa para alterar a senha por este fluxo.',
      password_update_failed: 'A senha passou pela validação, mas o Supabase não conseguiu concluir a alteração.',
    }
    return { ok: false as const, message: messages[payload.error ?? ''] ?? 'Não foi possível validar e alterar a senha agora.' }
  }

  return { ok: false as const, message: 'Não foi possível validar e alterar a senha agora.' }
}
