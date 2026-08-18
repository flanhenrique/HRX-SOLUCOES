import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin route uses password auth router with hardened password flows', async () => {
  const [main, authRouter, mfaGate, passwordSecurity] = await Promise.all([
    read('src/main.tsx'),
    read('src/quotes/AdminAuthRouter.tsx'),
    read('src/quotes/AdminMfaGate.tsx'),
    read('src/quotes/passwordSecurity.ts'),
  ])

  assert.match(main, /AdminAuthRouter/)
  assert.doesNotMatch(main, /<AdminQuotes\s*\/>/)

  assert.match(authRouter, /signInWithPassword/)
  assert.match(authRouter, /resetPasswordForEmail/)
  assert.match(authRouter, /secureUpdateAdminPassword/)
  assert.match(authRouter, /passwordMeetsPolicy/)
  assert.match(authRouter, /minLength=\{12\}/)
  assert.match(authRouter, />Primeiro acesso</)
  assert.match(authRouter, />Ativar acesso</)
  assert.match(authRouter, /Recuperar senha/)
  assert.match(authRouter, /autoComplete="current-password"/)
  assert.match(authRouter, /autoComplete="new-password"/)
  assert.match(authRouter, /allowEnrollment=\{false\}/)
  assert.match(mfaGate, /allowEnrollment = true/)
  assert.match(mfaGate, /fator não estiver disponível/)

  assert.match(passwordSecurity, /functions\.invoke\('admin-password'/)
  assert.match(passwordSecurity, /pwned_password/)
  assert.match(passwordSecurity, /pwned_check_unavailable/)
  assert.match(passwordSecurity, /mfa_required/)
  assert.match(passwordSecurity, /password\.length >= 12/)
})
