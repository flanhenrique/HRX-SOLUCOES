import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin route uses password auth router instead of magic-link login', async () => {
  const [main, authRouter] = await Promise.all([
    read('src/main.tsx'),
    read('src/quotes/AdminAuthRouter.tsx'),
  ])

  assert.match(main, /AdminAuthRouter/)
  assert.doesNotMatch(main, /<AdminQuotes\s*\/>/)

  assert.match(authRouter, /signInWithPassword/)
  assert.match(authRouter, /resetPasswordForEmail/)
  assert.match(authRouter, /updateUser\(\{ password \}\)/)
  assert.match(authRouter, /Primeiro acesso ou esqueci minha senha/)
  assert.match(authRouter, /autoComplete="current-password"/)
  assert.match(authRouter, /autoComplete="new-password"/)
})
