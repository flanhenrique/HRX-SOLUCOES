import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const [modules, finance, scoped] = await Promise.all([
  read('src/quotes/adminModules.ts'),
  read('src/quotes/AdminFinancePage.tsx'),
  read('src/quotes/AdminFinanceScopedPage.tsx'),
])

test('Financeiro mantém os contratos canônicos de receber e pagar registrados no módulo pai', () => {
  const financeModule = modules.slice(modules.indexOf("id: 'finance'"), modules.indexOf("id: 'fiscal'"))
  assert.match(financeModule, /id: 'finance-receivable', pattern: 'receber'/)
  assert.match(financeModule, /id: 'finance-payable', pattern: 'pagar'/)
  assert.match(financeModule, /title: 'Contas a receber'/)
  assert.match(financeModule, /title: 'Contas a pagar'/)
})

test('builder aceita subrotas estáticas sem relaxar parâmetros de rotas dinâmicas', () => {
  assert.match(modules, /buildAdminSubroutePath\(destination: AdminDestination, subrouteId: AdminSubrouteId, params: Record<string, string> = \{\}\)/)
  assert.match(modules, /admin_subroute_param_required/)
  assert.match(modules, /const value = params\[key\]/)
})

test('AdminFinancePage usa a subrota como fonte de verdade das abas receber e pagar', () => {
  assert.match(finance, /const route = useAdminRoute\(\)/)
  assert.match(finance, /financeViewFromRoute\(route\.subroute\?\.id\)/)
  assert.match(finance, /subrouteId === 'finance-receivable'/)
  assert.match(finance, /subrouteId === 'finance-payable'/)
  assert.match(finance, /navigateAdminPath\(buildAdminSubroutePath\('finance', 'finance-receivable'\)\)/)
  assert.match(finance, /navigateAdminPath\(buildAdminSubroutePath\('finance', 'finance-payable'\)\)/)
  assert.match(finance, /navigateAdmin\('finance'\)/)
  assert.match(finance, /selectView\('receivables'\)/)
  assert.match(finance, /selectView\('payables'\)/)
  assert.doesNotMatch(finance, /history\.(pushState|replaceState)|onAdminRouteChange|window\.location\.pathname/)
})

test('subrotas empresariais prevalecem sobre preferência persistida de Financeiro Pessoal', () => {
  assert.match(scoped, /const route = useAdminRoute\(\)/)
  assert.match(scoped, /route\.subroute\?\.id === 'finance-receivable'/)
  assert.match(scoped, /route\.subroute\?\.id === 'finance-payable'/)
  assert.match(scoped, /const activeScope: FinanceScope = businessRoute \? 'business' : scope/)
  assert.match(scoped, /window\.sessionStorage\.setItem\('hrx-finance-scope', 'business'\)/)
  assert.match(scoped, /if \(next === 'personal' && businessRoute\) navigateAdmin\('finance'\)/)
  assert.match(scoped, /data-finance-scope=\{activeScope\}/)
  assert.doesNotMatch(scoped, /history\.(pushState|replaceState)|onAdminRouteChange|window\.location\.pathname/)
})

test('Fase 4 não cria outro ledger, backend ou shell para as subrotas financeiras', () => {
  assert.equal((finance.match(/function AdminFinancePage|export default function AdminFinancePage/g) ?? []).length, 1)
  assert.doesNotMatch(finance, /createClient\(|create table|hrx-unified-sidebar|hrx-unified-mobile-nav/)
  assert.doesNotMatch(scoped, /hrx-unified-sidebar|hrx-unified-mobile-nav|function DesktopShell|function PwaShell/)
})
