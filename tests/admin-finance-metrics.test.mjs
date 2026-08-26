import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const backend = await readFile(new URL('../supabase/functions/finance-admin/index.ts', import.meta.url), 'utf8')
const frontend = await readFile(new URL('../src/quotes/AdminFinancePage.tsx', import.meta.url), 'utf8')

test('finance GET is read-only and derives overdue state without mutating rows', () => {
  const getBlock = backend.slice(backend.indexOf("if (req.method === 'GET')"), backend.indexOf("if (req.method !== 'PATCH')"))
  assert.ok(getBlock.length > 0)
  assert.doesNotMatch(getBlock, /\.update\(\{\s*status:\s*'overdue'/)
  assert.match(backend, /function effectiveStatus/)
  assert.match(getBlock, /status: effectiveStatus\(entry, currentDate\)/)
})

test('finance KPIs page through only the selected competence', () => {
  assert.match(backend, /async function loadFinanceMetrics/)
  assert.match(backend, /METRIC_PAGE_SIZE = 1000/)
  assert.match(backend, /\.range\(offset, offset \+ METRIC_PAGE_SIZE - 1\)/)
  assert.match(backend, /metricsPromise = loadFinanceMetrics\(db, currentDate, monthStart, monthEnd\)/)
  assert.match(backend, /\.gte\('competence_date', monthStart\)/)
  assert.match(backend, /\.lt\('competence_date', monthEnd\)/)
  assert.match(backend, /metrics,/)
})

test('finance UI uses backend metrics scoped to the selected competence', () => {
  assert.match(frontend, /type FinanceMetrics/)
  assert.match(frontend, /metrics\?: FinanceMetrics/)
  assert.match(frontend, /const fallbackMetrics = useMemo<FinanceMetrics>/)
  assert.match(frontend, /data\.competence === selectedCompetence \? \(data\.metrics \?\? fallbackMetrics\) : fallbackMetrics/)
  assert.match(frontend, /selectedCompetence/)
  assert.match(frontend, /competencia=\$\{value\}/)
})
