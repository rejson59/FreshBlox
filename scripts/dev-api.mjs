#!/usr/bin/env node
/**
 * Local runner for the Vercel functions in `api/`.
 *
 * `vite` alone cannot execute them, so `npm run dev` used to answer `/api/register-account`
 * with index.html — the client then failed to parse JSON and reported a generic error.
 * Start this in a second terminal (`npm run dev:api`) and Vite proxies `/api` to it.
 *
 * Environment is read from the process first, then `.env.local`, then `.env`.
 */

import { createServer } from 'node:http'
import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '0.0.0.0'

/** Minimal KEY=VALUE reader: enough for local development, no trailing-comment cleverness. */
async function loadEnvFile(file) {
  try {
    const raw = await readFile(resolve(ROOT, file), 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (key && !(key in process.env)) process.env[key] = value
    }
  } catch {
    // File is optional.
  }
}

await loadEnvFile('.env.local')
await loadEnvFile('.env')

const handlers = new Map()
async function loadHandler(name) {
  if (!handlers.has(name)) {
    const file = resolve(ROOT, 'api', `${name}.js`)
    try {
      await access(file)
    } catch {
      const missing = new Error(`No api/${name}.js in this repository`)
      missing.code = 'ENOENT_FUNCTION'
      throw missing
    }
    const mod = await import(pathToFileURL(file).href)
    if (typeof mod.default !== 'function') throw new Error(`api/${name}.js has no default export`)
    handlers.set(name, mod.default)
  }
  return handlers.get(name)
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size <= 1_000_000) chunks.push(chunk)
    })
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const match = url.pathname.match(/^\/api\/([a-zA-Z0-9_-]+)\/?$/)

  if (!match) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'NOT_FOUND', hint: 'Use /api/<function-name>' }))
    return
  }

  try {
    const handler = await loadHandler(match[1])
    const raw = await readBody(req)
    if (raw) req.body = raw
    await handler(req, res)
  } catch (err) {
    const notFound = err?.code === 'ENOENT_FUNCTION'
    console.error(`[dev-api] ${match[1]} ${notFound ? 'not found' : 'failed'}:`, err?.message ?? err)
    if (!res.headersSent) {
      res.statusCode = notFound ? 404 : 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
    }
    res.end(
      JSON.stringify({
        ok: false,
        error: notFound ? 'FUNCTION_NOT_FOUND' : 'DEV_API_ERROR',
        message: String(err?.message ?? err),
      }),
    )
  }
})

server.listen(PORT, HOST, () => {
  const missing = []
  if (!process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL) missing.push('SUPABASE_URL')
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!process.env.FRESHBLOX_FP_SALT) missing.push('FRESHBLOX_FP_SALT')
  console.log(`[dev-api] listening on http://${HOST}:${PORT}`)
  console.log(`[dev-api] available: /api/register-account`)
  if (missing.length > 0) {
    console.warn(`[dev-api] not configured for real registrations, missing: ${missing.join(', ')}`)
    console.warn('[dev-api] copy .env.example to .env.local and fill in the server-side values')
  }
})

const shutdown = () => server.close(() => process.exit(0))
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
