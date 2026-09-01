import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { EncryptedFiscalStore } from '../src/encrypted-store.mjs'

test('stores fiscal material encrypted and does not expose it on disk', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'operando-fiscal-test-'))
  try {
    const store = new EncryptedFiscalStore({ dataDir, masterKey: randomBytes(32) })
    await store.createKeyPair('tenant-test', '/CN=Operando Test/serialNumber=20123456789')
    const record = await store.read('tenant-test')
    assert.match(record.privateKeyPem, /BEGIN PRIVATE KEY/)
    const encryptedOnDisk = await readFile(store.filePath('tenant-test'), 'utf8')
    assert.doesNotMatch(encryptedOnDisk, /BEGIN PRIVATE KEY/)
  } finally {
    await rm(dataDir, { recursive: true, force: true })
  }
})
