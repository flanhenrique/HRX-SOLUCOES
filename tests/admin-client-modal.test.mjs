import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('novo cliente usa portal modal e não participa do fluxo da página', async () => {
  const [component, css] = await Promise.all([
    read('src/quotes/AdminClientForm.tsx'),
    read('src/quotes/admin-client-form.css'),
  ])

  assert.match(component, /createPortal\(modal, document\.body\)/)
  assert.match(component, /role="dialog"/)
  assert.match(component, /aria-modal="true"/)
  assert.match(component, /document\.body\.style\.overflow = 'hidden'/)
  assert.match(component, /event\.key === 'Escape'/)
  assert.match(css, /\.admin-client-modal-backdrop\{position:fixed;inset:0;/)
  assert.match(css, /z-index:5200/)
  assert.match(css, /\.admin-client-modal\{width:min\(760px,100%\);max-height:/)
  assert.match(css, /\.admin-client-modal-body\{[^}]*overflow:auto/)
})

test('modal de cliente tem layout próprio de PWA sem overflow horizontal', async () => {
  const css = await read('src/quotes/admin-client-form.css')
  assert.match(css, /@media\(max-width:760px\)/)
  assert.match(css, /grid-template-columns:1fr/)
  assert.match(css, /max-height:calc\(100dvh - env\(safe-area-inset-top\)/)
  assert.match(css, /env\(safe-area-inset-bottom\)/)
})
