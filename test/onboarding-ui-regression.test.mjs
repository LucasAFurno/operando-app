import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'
import { Window } from 'happy-dom'
import { createBrowserDataStore } from '../site/data-store.js'
import * as utils from '../site/operational-utils.js'

const source = await readFile(new URL('../site/client.js', import.meta.url), 'utf8')
const client = source.slice(0, source.lastIndexOf('\napplyTheme()')).replace(/^import .*$/gm, '')

const setup = async () => {
  const window = new Window({ url: 'http://localhost:4178/crear-cuenta/' })
  window.document.body.innerHTML = '<main id="app"></main>'
  const store = createBrowserDataStore({ seedDemoData: true })
  await store.authenticateUser('admin@demo.local', 'demo1234')
  const snapshot = store.getSnapshot()
  const user = snapshot.users.find((entry) => entry.id === snapshot.session.userId)
  user.isOwner = true
  user.productGuideSeenAt = '2026-11-13T18:00:00Z'
  snapshot.business.progressiveProfile = { status: 'pending', operationalGoals: [] }
  let failure = false
  const payloads = []
  const stub = { ...store, getSnapshot: () => structuredClone(snapshot), updateProgressiveProfile: async (payload) => {
    payloads.push(payload)
    if (failure) throw new Error('network unavailable')
    snapshot.business.progressiveProfile = payload
    return { ok: true }
  } }
  const context = vm.createContext({ window, document: window.document, location: window.location, console,
    URL, URLSearchParams, Intl, Date, setTimeout, clearTimeout,
    FormData: window.FormData, HTMLInputElement: window.HTMLInputElement, HTMLElement: window.HTMLElement,
    ...utils, __store: stub })
  const run = (code) => vm.runInContext(code, context)
  run(client)
  run('store = __store; render()')
  return { window, run, payloads, fail: () => { failure = true }, recover: () => { failure = false } }
}

test('optional onboarding saves without phone, keeps the chosen ARCA answer and exits the signup route', async () => {
  const env = await setup()
  try {
    const { document } = env.window
    assert.equal(env.window.location.pathname, '/panel/')
    assert.equal(document.title, 'Resumen | Operando')
    env.run("activeSection = 'caja'; render()")
    assert.equal(env.window.location.pathname, '/panel/caja/')
    document.querySelector('[name="operationalGoals"][value="stock"]').checked = true
    env.run('captureProgressiveDraft(); progressiveProfileStep = 5; render()')
    document.querySelector('[name="needsArca"][value="no"]').checked = true
    await env.run('handleSubmit({preventDefault(){},currentTarget:document.querySelector("form.progressive-profile-modal-form")})')
    assert.equal(env.payloads[0].phone, '')
    assert.equal(env.payloads[0].needsArca, false)
    assert.deepEqual(Array.from(env.payloads[0].operationalGoals), ['stock'])
    assert.equal(document.querySelector('.progressive-profile-dialog'), null)
    assert.equal(env.window.location.pathname, '/panel/')
  } finally { await env.window.happyDOM.abort() }
})

test('failed onboarding retains choices, shows an inline error and permits retry', async () => {
  const env = await setup()
  try {
    env.run('progressiveProfileStep = 5; render()')
    env.window.document.querySelector('[name="needsArca"][value="no"]').checked = true
    env.fail()
    const submit = () => env.run('handleSubmit({preventDefault(){},currentTarget:document.querySelector("form.progressive-profile-modal-form")})')
    await submit()
    assert.ok(env.window.document.querySelector('[role="alert"]'))
    assert.equal(env.window.document.querySelector('[name="needsArca"]:checked').value, 'no')
    env.recover()
    await submit()
    assert.equal(env.window.document.querySelector('.progressive-profile-dialog'), null)
  } finally { await env.window.happyDOM.abort() }
})

test('final skip completes an empty optional profile instead of leaving the dialog open', async () => {
  const env = await setup()
  try {
    env.run('progressiveProfileStep = 5; render()')
    env.window.document.querySelector('[data-action="progressive-profile-skip"]').click()
    await new Promise(setImmediate)
    assert.equal(env.payloads.length, 1)
    assert.equal(env.payloads[0].status, 'complete')
    assert.equal(env.window.document.querySelector('.progressive-profile-dialog'), null)
  } finally { await env.window.happyDOM.abort() }
})
