import assert from 'node:assert/strict'
import fs from 'node:fs'

const main = fs.readFileSync('src/main.tsx', 'utf8')
const experience = fs.readFileSync('src/quotes/AdminExperienceLayer.tsx', 'utf8')
const quotes = fs.readFileSync('src/quotes/AdminQuotes.tsx', 'utf8')
const css = fs.readFileSync('src/quotes/admin-experience.css', 'utf8')
const cnpjFunction = fs.readFileSync('supabase/functions/cnpj-lookup/index.ts', 'utf8')

assert.match(main, /AdminExperienceLayer/)
assert.doesNotMatch(main, /AdminPasswordControl/)
assert.match(experience, /Configurações/)
assert.match(experience, /Alterar senha/)
assert.match(experience, /hrxSupabase\.auth\.updateUser/)
assert.match(experience, /Consultar CNPJ/)
assert.match(experience, /cnpj-lookup/)
assert.match(experience, /Verificar cadastro na SEFAZ\/AM/)
assert.match(quotes, /Solicitações/)
assert.match(experience, /Orçamentos/)
assert.match(experience, /Clientes/)
assert.match(experience, /Suspensões/)
assert.match(css, /hrx-mobile-menu-launcher/)
assert.match(cnpjFunction, /validCnpj/)
assert.match(cnpjFunction, /admin_users/)
assert.match(cnpjFunction, /brasilapi\.com\.br\/api\/cnpj\/v1/)

console.log('Admin experience checks passed')
