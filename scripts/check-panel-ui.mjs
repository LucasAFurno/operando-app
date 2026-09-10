// Run after: node scripts/build.mjs prod --dist-only
// Requires Playwright; optionally set PLAYWRIGHT_MODULE to its index.mjs path.
// All app requests are served from dist in an isolated browser. No real account
// or operational data is read or changed, and external requests are blocked.
import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
const root = path.resolve(import.meta.dirname, '..')
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
const origin = 'https://panel-regression.test'
const errors = []
let page
const fixtureBoot = `
store = createBrowserDataStore({ seedDemoData: true, requireCloud: false })
await store.authenticateUser('admin@demo.local', 'demo1234')
await store.applyModulePreset('multi')
await store.openCashSession({ openingAmount: 1000, registerId: store.getSnapshot().business.currentRegisterId })
progressiveProfilePromptOpen = false
commerceContext = { commerce_id: 'regression-commerce' }
const originalSnapshot = store.getSnapshot
let setupIsComplete = new URL(location.href).searchParams.has('completed')
let cashIsOpen = true
store.getSnapshot = () => {
  const snapshot = originalSnapshot()
  const user = snapshot.users.find(user => user.id === snapshot.session.userId)
  user.id = 'regression-owner'
  snapshot.session.userId = user.id
  snapshot.business.progressiveProfile = { status: setupIsComplete ? 'complete' : 'pending' }
  if (!cashIsOpen) snapshot.cashSessions.forEach(session => { session.status = 'closed' })
  return snapshot
}
window.panelRegression = {
  completeSetup() { setupIsComplete = true; render() },
  closeCash() { cashIsOpen = false; render() },
  render() { render() },
}
activeSection = sectionFromPath()
render()
`
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname === 'esm.sh') return route.fulfill({ contentType: 'text/javascript', body: 'export const createClient = () => { throw new Error("Cloud access is disabled in regression tests") }' })
    if (url.origin !== origin) return route.abort()
    let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    if (!relative || relative.endsWith('/')) relative += 'index.html'
    const file = path.resolve(root, 'dist', relative)
    if (!file.startsWith(path.resolve(root, 'dist') + path.sep)) return route.abort()
    try {
      let body = await readFile(file)
      if (relative === 'app.js') {
        const source = body.toString()
        assert.match(source, /bootstrap\(\)\s*$/)
        body = Buffer.from(source.replace(/bootstrap\(\)\s*$/, fixtureBoot))
      }
      const contentType = ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' })[path.extname(file)] || 'application/octet-stream'
      await route.fulfill({ body, contentType })
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      await route.fulfill({ status: 404, body: 'Not found' })
    }
  })
  page = await context.newPage()
  page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message) })
  page.setDefaultTimeout(10000)
  await page.goto(`${origin}/panel/`)
  await page.locator('.dashboard-view').waitFor()
  assert.equal(await page.locator('.opening-celebration').count(), 0, 'Incomplete setup must not celebrate')
  await page.evaluate(() => window.panelRegression.completeSetup())
  await page.locator('.opening-celebration').waitFor({ state: 'visible' })
  // Reload without dismissal: the first display must already be remembered.
  await page.reload()
  await page.locator('.dashboard-view').waitFor()
  await page.evaluate(() => window.panelRegression.completeSetup())
  assert.equal(await page.locator('.opening-celebration').count(), 0, 'Reload repeated celebration')
  await page.evaluate(() => window.panelRegression.closeCash())
  assert.equal(await page.locator('.opening-checklist').count(), 0, 'Closing cash must not undo onboarding')
  await page.getByRole('button', { name: 'Servicios', exact: true }).click()
  await page.waitForURL('**/servicios/')
  await page.getByRole('searchbox', { name: 'Buscar tickets', exact: true }).waitFor()
  await page.getByRole('searchbox', { name: 'Buscar tickets', exact: true }).fill('no-such-ticket')
  await page.getByRole('combobox', { name: 'Filtrar tickets por estado' }).selectOption('Recibido')
  await page.getByRole('button', { name: 'Resumen', exact: true }).click()
  assert.equal(await page.locator('.opening-celebration').count(), 0, 'Navigation repeated celebration')
  for (const width of [320, 390, 740]) {
    await page.setViewportSize({ width, height: 844 })
    const trigger = page.getByRole('button', { name: 'Abrir búsqueda', exact: true })
    const input = page.getByLabel('Buscar en el panel', { exact: true })
    await trigger.click()
    assert.equal(await trigger.isVisible(), true, `Search trigger disappeared at ${width}px`)
    await input.waitFor({ state: 'visible' })
    assert.equal(await input.evaluate(el => document.activeElement === el), true)
    const box = await input.boundingBox()
    assert.ok(box.x >= 0 && box.x + box.width <= width && box.y < 844, 'Search must fit the viewport')
    await input.fill('zzzz-no-result')
    await page.evaluate(() => window.panelRegression.render())
    assert.equal(await input.isVisible(), true, 'Background render hid the search')
    assert.equal(await input.inputValue(), 'zzzz-no-result', 'Background render lost the query')
    assert.equal(await input.evaluate(el => document.activeElement === el), true)
    await input.press('Enter')
    await page.getByText('No encontre nada con ese termino en esta sesion.', { exact: true }).first().waitFor()
    assert.equal(await input.isVisible(), true, 'An empty result must leave search usable')
    await input.press('Escape')
    assert.equal(await input.isVisible(), false)
    await trigger.click()
    await page.getByRole('button', { name: 'Cerrar búsqueda', exact: true }).click()
    await trigger.click()
    await input.fill('serv')
    await input.press('Enter')
    await page.waitForURL('**/servicios/')
    await page.getByRole('searchbox', { name: 'Buscar tickets', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Resumen', exact: true }).click()
    console.log(`PASS: mobile search and Services navigation at ${width}px`)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  assert.equal(await page.getByRole('button', { name: 'Abrir búsqueda', exact: true }).isVisible(), false)
  assert.equal(await page.getByLabel('Buscar en el panel', { exact: true }).isVisible(), true)
  await page.getByRole('button', { name: 'Servicios', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Buscar tickets', exact: true }).waitFor()
  await page.evaluate(() => localStorage.clear())
  await page.goto(`${origin}/panel/?completed`)
  await page.locator('.dashboard-view').waitFor()
  assert.equal(await page.locator('.opening-celebration').count(), 0, 'Existing completed businesses must not celebrate again')
  assert.equal(await page.locator('.opening-checklist').count(), 0)
  assert.deepEqual(errors, [])
  console.log('PASS: desktop search, Services filters, once-only setup celebration across reload/navigation/cash closure; no JS errors')
} catch (error) {
  await mkdir(path.join(root, 'output'), { recursive: true })
  await page?.screenshot({ path: path.join(root, 'output', 'panel-regression-failure.png'), fullPage: true })
  throw error
} finally {
  await browser.close()
}
