import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin updater checks releases without hammering the network while the PWA remains open', async () => {
  const updater = await read('src/AdminPwaUpdater.tsx')

  assert.match(updater, /const CHECK_COOLDOWN_MS = 60_000/)
  assert.match(updater, /const UPDATE_POLL_MS = 180_000/)
  assert.match(updater, /const pollForUpdate = \(\) => \{[\s\S]*document\.visibilityState !== 'visible'[\s\S]*!navigator\.onLine[\s\S]*checkForUpdate\(\)/)
  assert.doesNotMatch(updater, /const UPDATE_POLL_MS = 30_000/)
  assert.match(updater, /window\.setInterval\(pollForUpdate, UPDATE_POLL_MS\)/)
  assert.match(updater, /window\.clearInterval\(updatePollTimer\)/)
})
