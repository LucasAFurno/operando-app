import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { getCashSessionTotals, getRegisterCashSession } from '../site/operational-utils.js'
import { createBrowserDataStore } from '../site/data-store.js'

const session = { id: 'session-qa', openingAmount: 5000 }
const sale = { cashSessionId: session.id, paymentMethod: 'cash', amountPaid: 3000, paymentBreakdown: { cash: 3000 } }
const receipt = { cashSessionId: session.id, kind: 'sale', signedAmount: 3000 }
const movement = (kind, signedAmount) => ({ cashSessionId: session.id, kind, signedAmount })

test('open sessions are isolated by branch and register', () => {
  const sessions = [{ id: 'one', status: 'open', branchId: 'A', registerId: 'A1' }, { id: 'two', status: 'open', branchId: 'B', registerId: 'B1' }]
  assert.equal(getRegisterCashSession(sessions, 'A', 'A1').id, 'one')
  assert.equal(getRegisterCashSession(sessions, 'B', 'B1').id, 'two')
  assert.equal(getRegisterCashSession(sessions, 'B', 'A1'), null)
  assert.equal(getRegisterCashSession(sessions, 'B', ''), null)
})

test('cash receipt is counted once and is not a manual income', () => {
  assert.deepEqual(getCashSessionTotals(session, [sale], [receipt]), {
    cashSalesTotal: 3000, sessionCashMovementTotal: 0, sessionCashIncome: 0,
    sessionCashExpenses: 0, expectedCash: 8000,
  })
})

test('mixed, manual, refund and edited-sale movements reconcile without payment-table duplication', () => {
  const mixed = { ...sale, paymentMethod: 'mixed', paymentBreakdown: { cash: 1000, transfer: 2000 } }
  assert.equal(getCashSessionTotals(session, [mixed], []).expectedCash, 6000)
  assert.equal(getCashSessionTotals(session, [sale], [receipt, movement('income', 500), movement('expense', -200)]).expectedCash, 8300)
  assert.equal(getCashSessionTotals(session, [{ ...sale, status: 'cancelled', amountPaid: 0 }], [receipt, movement('refund', -3000)]).expectedCash, 5000)
  assert.equal(getCashSessionTotals(session, [mixed], [receipt, movement('refund', -3000), movement('sale', 1000)]).expectedCash, 6000)
  assert.equal(getCashSessionTotals(session, [sale], [{ ...receipt, cashSessionId: 'another-session' }]).expectedCash, 8000)
  assert.equal(getCashSessionTotals(null, [sale], [receipt]).expectedCash, 0)
})

test('local cash sale closes without a difference at the correct counted amount', async () => {
  const store = createBrowserDataStore({ seedDemoData: true })
  assert.equal((await store.authenticateUser('admin@demo.local', 'demo1234')).ok, true)
  assert.equal((await store.openCashSession({ openingAmount: 5000, registerId: store.getSnapshot().registers[0].id })).ok, true)
  const before = store.getSnapshot()
  const open = before.cashSessions.find((entry) => entry.status === 'open')
  assert.ok(open)
  const product = before.products.find((entry) => entry.trackStock && entry.stock > 0)
  assert.equal((await store.createSale({ items: [{ productId: product.id, quantity: 1 }], paymentMethod: 'cash', isPaid: true, channel: 'Mostrador' })).ok, true)
  const snapshot = store.getSnapshot()
  const { expectedCash } = getCashSessionTotals(open, snapshot.sales, snapshot.cashMovements)
  assert.equal((await store.closeCashSession({ cashSessionId: open.id, countedAmount: expectedCash })).ok, true)
  assert.equal(store.getSnapshot().cashSessions.find((entry) => entry.id === open.id).differenceAmount, 0)
})

test('all timestamp presentations agree on Argentina local day and time, preserving date-only fields', () => {
  const result = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import {localDateKey, localDateTime, localTime} from './site/operational-utils.js';
    console.log(JSON.stringify([localTime('2026-11-13T18:30:00Z'),localDateTime('2026-11-14T01:30:00Z'),localDateKey('2026-11-13')]));
  `], { cwd: new URL('..', import.meta.url), env: { ...process.env, TZ: 'America/Argentina/Buenos_Aires' }, encoding: 'utf8' })
  assert.deepEqual(JSON.parse(result), ['15:30', '2026-11-13 · 22:30', '2026-11-13'])
})
