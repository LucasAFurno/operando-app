import { spawn } from 'node:child_process'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const execute = (bin, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options })
  const stdout = []
  const stderr = []
  child.stdout.on('data', (chunk) => stdout.push(chunk))
  child.stderr.on('data', (chunk) => stderr.push(chunk))
  child.on('error', reject)
  child.on('close', (code) => code === 0 ? resolve(Buffer.concat(stdout)) : reject(new Error(`OpenSSL exited ${code}: ${Buffer.concat(stderr).toString('utf8').slice(0, 500)}`)))
})

const withSecureFiles = async (files, callback) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'operando-fiscal-'))
  try {
    for (const [name, content] of Object.entries(files)) {
      const target = path.join(dir, name)
      await writeFile(target, content, { mode: 0o600 })
      await chmod(target, 0o600)
    }
    return await callback(dir)
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 3 })
  }
}

export const createCsr = async ({ openSslBin, privateKeyPem, subject }) => withSecureFiles({ 'private.pem': privateKeyPem }, async (dir) => {
  const output = path.join(dir, 'request.csr')
  await execute(openSslBin, ['req', '-new', '-key', path.join(dir, 'private.pem'), '-subj', subject, '-out', output])
  return readFile(output, 'utf8')
})

export const signCms = async ({ openSslBin, privateKeyPem, certificatePem, loginTicketRequestXml }) => withSecureFiles({ 'private.pem': privateKeyPem, 'certificate.pem': certificatePem, 'tra.xml': loginTicketRequestXml }, async (dir) => {
  const output = path.join(dir, 'tra.cms')
  await execute(openSslBin, ['cms', '-sign', '-binary', '-in', path.join(dir, 'tra.xml'), '-signer', path.join(dir, 'certificate.pem'), '-inkey', path.join(dir, 'private.pem'), '-outform', 'DER', '-nodetach', '-out', output])
  return (await readFile(output)).toString('base64')
})
