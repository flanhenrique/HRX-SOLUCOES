import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin updater polls for a new release while the PWA remains open', async () => {
  const updater = await read('src/AdminPwaUpdater.tsx')

  assert.match(updater, /const UPDATE_POLL_MS = 30_000/)
  assert.match(updater, /const pollForUpdate = \(\) => \{[\s\S]*document\.visibilityState !== 'visible'[\s\S]*!navigator\.onLine[\s\S]*checkForUpdate\(true\)/)
  assert.match(updater, /window\.setInterval\(pollForUpdate, UPDATE_POLL_MS\)/)
  assert.match(updater, /window\.clearInterval\(updatePollTimer\)/)
})
