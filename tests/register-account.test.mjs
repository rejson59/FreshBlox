import assert from 'node:assert/strict'
import test from 'node:test'
import crypto from 'node:crypto'
import {
  MAX_ACCOUNTS_PER_NETWORK_PER_DAY,
  SALT_MIN_LENGTH,
  extractClientIp,
  handleRegister,
  hmacHex,
  isOriginAllowed,
  normalizeIp,
  parseAllowedOrigins,
  readJsonBody,
  resolveFpSalt,
} from '../api/register-account.js'

// A realistic, long-lived secret: the handler refuses to issue device locks without one.
const SALT = 'test-salt-that-is-long-enough-for-hmac-0123456789'
const SERVICES = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  FRESHBLOX_FP_SALT: SALT,
}

const PROOF = {
  deviceToken: 'a'.repeat(48),
  browserFp: 'b'.repeat(64),
  coreHw: 'c'.repeat(64),
}

function makeReq({ method = 'POST', headers = {}, body = null } = {}) {
  return {
    method,
    headers: { host: 'freshblox.test', ...headers },
    body,
    socket: { remoteAddress: '203.0.113.9' },
    on() {},
  }
}

function makeRes() {
  const res = {
    statusCode: 0,
    headers: {},
    payload: null,
    setHeader(k, v) {
      res.headers[k.toLowerCase()] = v
    },
    end(raw) {
      res.payload = raw ? JSON.parse(raw) : null
    },
  }
  return res
}

/** Routes the handler's outbound calls so each test states only what it cares about. */
function makeFetch(routes) {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    const call = { url: String(url), init, body: init.body ? JSON.parse(init.body) : null }
    calls.push(call)
    for (const [match, handler] of routes) {
      if (call.url.includes(match)) return handler(call)
    }
    throw new Error(`Unexpected outbound request: ${call.url}`)
  }
  return { fetchImpl, calls }
}

const json = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
})

const LOOKUP_OK = ['fb_device_registrations?select=id&or=', () => json(200, [])]
const RATE_OK = ['fb_device_registrations?select=id&ip_hash=eq.', () => json(200, [])]
const AVAIL_OK = ['rpc/is_freshblox_username_available', () => json(200, true)]
const CREATE_OK = ['auth/v1/admin/users', () => json(200, { id: 'user-1' })]
const LOCK_OK = ['fb_device_registrations', (call) =>
  call.init.method === 'POST' ? json(201, null) : json(200, []),
]

async function register(overrides = {}, routes = null, reqOptions = {}) {
  const base = [
    LOOKUP_OK,
    RATE_OK,
    AVAIL_OK,
    CREATE_OK,
    LOCK_OK,
  ]
  const { fetchImpl, calls } = makeFetch(routes ?? base)
  const req = makeReq({
    body: JSON.stringify({ action: 'register', username: 'NowyGracz', password: 'tajne123', ...PROOF, ...overrides }),
    headers: { origin: 'https://freshblox.test' },
    ...reqOptions,
  })
  const res = makeRes()
  await handleRegister(req, res, { env: SERVICES, fetchImpl })
  return { res, calls }
}

test('IP normalization keeps a device on one slot across IPv6 privacy rotation', () => {
  assert.equal(normalizeIp('::ffff:203.0.113.9'), '203.0.113.9')
  assert.equal(normalizeIp(' 203.0.113.9 '), '203.0.113.9')
  assert.equal(normalizeIp('2a02:1234:abcd:ef01:1111:2222:3333:4444'), '2a02:1234:abcd:ef01')
  assert.equal(normalizeIp('2a02:1234:abcd:ef01:9999:8888:7777:6666'), '2a02:1234:abcd:ef01')
  assert.equal(normalizeIp(''), 'unknown')
  assert.equal(normalizeIp(undefined), 'unknown')
})

test('the platform header wins over client-controlled ones', () => {
  const req = {
    headers: {
      'x-vercel-forwarded-for': '198.51.100.7, 10.0.0.1',
      'cf-connecting-ip': '1.1.1.1',
      'x-forwarded-for': '8.8.8.8',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(extractClientIp(req), '198.51.100.7')

  // Local dev without the platform proxy still falls back to a sane remote address.
  assert.equal(extractClientIp({ headers: {}, socket: { remoteAddress: '::ffff:127.0.0.1' } }), '127.0.0.1')
})

test('only the deployment origin and the explicit allowlist may call the endpoint', () => {
  const req = makeReq({ headers: { host: 'freshblox.test', 'x-forwarded-proto': 'https' } })
  const env = { FRESHBLOX_ALLOWED_ORIGINS: 'https://staging.freshblox.app/, https://preview.freshblox.app' }
  assert.equal(isOriginAllowed('https://freshblox.test', req, env), true, 'same origin')
  assert.equal(isOriginAllowed('https://staging.freshblox.app', req, env), true, 'allowlisted, trailing slash trimmed')
  assert.equal(isOriginAllowed('https://evil.example', req, env), false, 'third party rejected')
  assert.equal(isOriginAllowed('', req, env), true, 'no Origin header (curl/server) is not a browser')
  assert.equal(
    isOriginAllowed('http://freshblox.test', req, env),
    true,
    'the local vite proxy keeps the browser Host header on plain http',
  )
  assert.deepEqual(parseAllowedOrigins('a, b ,,c'), ['a', 'b', 'c'])
})

test('the fingerprint salt must be a real secret, never a fallback', () => {
  assert.equal(resolveFpSalt({}), null)
  assert.equal(resolveFpSalt({ FRESHBLOX_FP_SALT: 'short' }), null)
  assert.equal(resolveFpSalt({ FRESHBLOX_FP_SALT: 'x'.repeat(SALT_MIN_LENGTH - 1) }), null)
  assert.equal(resolveFpSalt({ FRESHBLOX_FP_SALT: 'x'.repeat(SALT_MIN_LENGTH) }), 'x'.repeat(SALT_MIN_LENGTH))
  // The service-role key must never double as the hash salt.
  assert.equal(resolveFpSalt({ SUPABASE_SERVICE_ROLE_KEY: 'k'.repeat(64) }), null)
})

test('a deployment without a salt refuses to register instead of hashing predictably', async () => {
  for (const env of [
    { SUPABASE_URL: SERVICES.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'key' },
    { ...SERVICES, FRESHBLOX_FP_SALT: 'too-short' },
  ]) {
    const { fetchImpl, calls } = makeFetch([])
    const res = makeRes()
    await handleRegister(makeReq({ body: '{}' }), res, { env, fetchImpl })
    assert.equal(res.statusCode, 500)
    assert.equal(res.payload.error, 'SERVER_MISCONFIGURED')
    assert.equal(calls.length, 0, 'nothing is written before the configuration is known-good')
  }
})

test('a healthy registration locks the device with HMACs and never stores the raw proof', async () => {
  const { res, calls } = await register()

  assert.equal(res.statusCode, 201)
  assert.equal(res.payload.ok, true)
  assert.match(res.payload.loginEmail, /^u_nowygracz_[0-9a-f]{8}@accounts\.freshblox\.app$/)
  assert.equal(res.headers['access-control-allow-origin'], 'https://freshblox.test', 'CORS echoes the caller')

  const create = calls.find((c) => c.url.includes('/auth/v1/admin/users'))
  assert.equal(create.body.user_metadata.username, 'NowyGracz')
  assert.equal(create.body.email_confirm, true)

  const lock = calls.find((c) => c.url.endsWith('/rest/v1/fb_device_registrations'))
  assert.equal(lock.body.device_token_hash, hmacHex(SALT, `tok:${PROOF.deviceToken}`))
  assert.equal(lock.body.fp_ip_hash, hmacHex(SALT, `fp:${PROOF.browserFp}|ip:203.0.113.9`))
  assert.equal(lock.body.ip_hash, hmacHex(SALT, 'ip:203.0.113.9'))
  const serialized = JSON.stringify(calls.map((c) => c.body))
  assert.ok(!serialized.includes(PROOF.deviceToken), 'the device token itself never reaches the database')
})

test('a device that already registered an account is turned away before any user exists', async () => {
  const { res, calls } = await register({}, [[LOOKUP_OK[0], () => json(200, [{ id: 'reg-1' }])]])
  assert.equal(res.statusCode, 403)
  assert.equal(res.payload.error, 'DEVICE_LIMIT_REACHED')
  assert.equal(calls.some((c) => c.url.includes('/auth/v1/admin/users')), false)
})

test('identical machines on one network are not denied by a shared hardware signature', async () => {
  const { calls } = await register({}, [
    LOOKUP_OK,
    RATE_OK,
    AVAIL_OK,
    CREATE_OK,
    LOCK_OK,
  ])
  const lookup = calls.find((call) => call.url.includes('select=id&or='))
  assert.ok(lookup.url.includes('device_token_hash.eq.'))
  assert.ok(lookup.url.includes('fp_ip_hash.eq.'))
  assert.equal(
    lookup.url.includes('core_hw_ip_hash.eq.'),
    false,
    'the coarse hardware hash must never be a hard blocker',
  )

  // …but it is still stored, so the signal is not lost for support and abuse review.
  const lock = calls.find((call) => call.url.endsWith('/rest/v1/fb_device_registrations'))
  assert.equal(typeof lock.body.core_hw_ip_hash, 'string')
  assert.equal(lock.body.core_hw_ip_hash.length, 64)
})

test('an unreachable rate limiter fails closed instead of letting accounts through', async () => {
  const { res, calls } = await register({}, [
    LOOKUP_OK,
    [RATE_OK[0], () => json(500, { message: 'connection reset' })],
  ])
  assert.equal(res.statusCode, 503)
  assert.equal(res.payload.error, 'SERVER_BUSY')
  assert.equal(res.headers['retry-after'], '30')
  assert.equal(calls.some((c) => c.url.includes('/auth/v1/admin/users')), false, 'no orphan account is created')
})

test('the per-network budget is enforced', async () => {
  const rows = Array.from({ length: MAX_ACCOUNTS_PER_NETWORK_PER_DAY }, (_, i) => ({ id: `r${i}` }))
  const { res } = await register({}, [LOOKUP_OK, [RATE_OK[0], () => json(200, rows)]])
  assert.equal(res.statusCode, 429)
  assert.equal(res.payload.error, 'NETWORK_RATE_LIMIT')
})

test('a lost device-lock race rolls the brand-new user back', async () => {
  const { res, calls } = await register({}, [
    LOOKUP_OK,
    RATE_OK,
    AVAIL_OK,
    CREATE_OK,
    [
      'fb_device_registrations',
      (call) => (call.init.method === 'POST' ? json(409, { code: '23505' }) : json(200, [])),
    ],
  ])
  assert.equal(res.statusCode, 403)
  assert.equal(res.payload.error, 'DEVICE_LIMIT_REACHED')
  const deleted = calls.find((c) => c.url.includes('/auth/v1/admin/users/user-1') && c.init.method === 'DELETE')
  assert.ok(deleted, 'the half-created account must not survive')
})

test('a duplicate username from the admin API is reported as such, not as a server error', async () => {
  for (const payload of [
    { code: '23505' },
    { msg: 'duplicate key value violates unique constraint "idx_fb_profiles_username_lower"' },
    { message: 'User with this username already exists' },
  ]) {
    const { res } = await register({}, [LOOKUP_OK, RATE_OK, AVAIL_OK, [CREATE_OK[0], () => json(500, payload)]])
    assert.equal(res.statusCode, 409, JSON.stringify(payload))
    assert.equal(res.payload.error, 'USERNAME_TAKEN')
  }
})

test('a failed availability RPC degrades to the unique index instead of failing open forever', async () => {
  const { res } = await register({}, [LOOKUP_OK, RATE_OK, [AVAIL_OK[0], () => json(503, {})], CREATE_OK, LOCK_OK])
  assert.equal(res.statusCode, 201, 'the database constraint is still the source of truth')
})

test('cross-origin drive-by registration and preflight from unknown sites are rejected', async () => {
  const post = await register({}, null, { headers: { origin: 'https://evil.example' } })
  assert.equal(post.res.statusCode, 403)
  assert.equal(post.res.payload.error, 'ORIGIN_NOT_ALLOWED')
  assert.equal(post.calls.length, 0, 'no upstream call is made for a foreign origin')

  const { fetchImpl } = makeFetch([])
  const preflight = makeRes()
  await handleRegister(
    makeReq({ method: 'OPTIONS', headers: { origin: 'https://evil.example' } }),
    preflight,
    { env: SERVICES, fetchImpl },
  )
  assert.equal(preflight.statusCode, 403)

  const allowed = makeRes()
  await handleRegister(
    makeReq({ method: 'OPTIONS', headers: { origin: 'https://freshblox.test' } }),
    allowed,
    { env: SERVICES, fetchImpl: makeFetch([]).fetchImpl },
  )
  assert.equal(allowed.statusCode, 204)
  assert.equal(allowed.headers['access-control-allow-origin'], 'https://freshblox.test')
})

test('the public health check does not hand a foreign page a CORS grant', async () => {
  const { fetchImpl } = makeFetch([])
  const res = makeRes()
  await handleRegister(makeReq({ method: 'GET', headers: { origin: 'https://evil.example' } }), res, {
    env: SERVICES,
    fetchImpl,
  })
  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['access-control-allow-origin'], undefined)
  assert.equal(res.payload.configured, true)
  assert.equal(res.payload.deviceLock, true)

  const sameOrigin = makeRes()
  await handleRegister(
    makeReq({ method: 'GET', headers: { origin: 'https://freshblox.test' } }),
    sameOrigin,
    { env: SERVICES, fetchImpl },
  )
  assert.equal(sameOrigin.headers['access-control-allow-origin'], 'https://freshblox.test')
})

test('oversized bodies are rejected with 413 before any work is done', async () => {
  const res = makeRes()
  const { fetchImpl, calls } = makeFetch([])
  await handleRegister(makeReq({ body: JSON.stringify({ padding: 'x'.repeat(40_000) }) }), res, {
    env: SERVICES,
    fetchImpl,
  })
  assert.equal(res.statusCode, 413)
  assert.equal(res.payload.error, 'PAYLOAD_TOO_LARGE')
  assert.equal(calls.length, 0)
})

test('the device check is read-only and never creates anything', async () => {
  const { fetchImpl, calls } = makeFetch([[LOOKUP_OK[0], () => json(200, [])]])
  const res = makeRes()
  await handleRegister(
    makeReq({ headers: { origin: 'https://freshblox.test' }, body: JSON.stringify({ action: 'check', ...PROOF }) }),
    res,
    { env: SERVICES, fetchImpl },
  )
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.payload, { ok: true, allowed: true })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].init.method, 'GET')
})

test('the body reader tags empty, invalid and oversized input distinctly', async () => {
  assert.deepEqual(await readJsonBody({ body: { a: 1 } }), { kind: 'ok', body: { a: 1 } })
  assert.equal((await readJsonBody({ body: 'not json' })).kind, 'invalid')
  assert.equal((await readJsonBody({ body: '[]' })).kind, 'invalid')
  assert.equal((await readJsonBody({ body: 'x'.repeat(40_000) })).kind, 'too-large')
  const empty = await readJsonBody({
    body: undefined,
    on(event, cb) {
      if (event === 'end') cb()
    },
  })
  assert.equal(empty.kind, 'empty')
})

test('hashes are deterministic per salt and differ across salts', () => {
  const a = hmacHex('salt-one', 'tok:abc')
  assert.equal(a, crypto.createHmac('sha256', 'salt-one').update('tok:abc').digest('hex'))
  assert.notEqual(a, hmacHex('salt-two', 'tok:abc'))
})
