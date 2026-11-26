import crypto from 'node:crypto'

// Public surface used by the browser client (src/store/usePlayerStore.ts) — keep the
// error codes below in sync with translateAuthError() in src/components/auth/AuthScreen.tsx.

export const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/
export const SALT_MIN_LENGTH = 32
export const MAX_BODY_BYTES = 32768
export const MAX_ACCOUNTS_PER_NETWORK_PER_DAY = 6
export const DEFAULT_RETRY_AFTER = 30

function getHeader(req, name) {
  const val = req.headers?.[name.toLowerCase()]
  if (Array.isArray(val)) return val[0] || ''
  return typeof val === 'string' ? val : ''
}

/**
 * Normalizes a client IP so the same device keeps the same hash.
 * IPv6 is collapsed to its /64 prefix: privacy extensions rotate the lower bits
 * of a single connection, and rotating them must not hand out a fresh device slot.
 */
export function normalizeIp(raw) {
  const cleaned = String(raw ?? '').trim().toLowerCase().replace(/^::ffff:/, '')
  if (!cleaned) return 'unknown'
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':').filter(Boolean)
    return parts.slice(0, 4).join(':') || cleaned
  }
  return cleaned
}

/**
 * The platform proxy is the only trustworthy source of the caller address.
 * `x-vercel-forwarded-for` is written by Vercel itself; the remaining headers are
 * client-controlled on every other host, so they are a last resort for local dev only.
 */
export function extractClientIp(req) {
  const raw =
    getHeader(req, 'x-vercel-forwarded-for').split(',')[0].trim() ||
    getHeader(req, 'cf-connecting-ip').trim() ||
    getHeader(req, 'x-real-ip').trim() ||
    getHeader(req, 'x-forwarded-for').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  return normalizeIp(raw)
}

/** Comma-separated allowlist from the environment, e.g. "https://freshblox.app,https://staging.freshblox.app". */
export function parseAllowedOrigins(value) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

/**
 * A request is only accepted from the deployment's own origin or from an explicitly
 * allowlisted one. Requests without an Origin header (curl, server-to-server, tests)
 * are allowed through: no browser is involved, so CORS offers no protection there and
 * the device lock plus the per-network limit do the real work.
 */
export function isOriginAllowed(origin, req, env = {}) {
  const clean = String(origin ?? '').trim().replace(/\/+$/, '')
  if (!clean) return true
  const host = getHeader(req, 'host')
  // Same host is the deployment itself; the scheme may legitimately differ between the
  // HTTPS deployment and a local `vite` proxy that keeps the browser's Host header.
  if (host && /^https?:\/\//.test(clean) && clean.replace(/^https?:\/\//, '') === host) return true
  return parseAllowedOrigins(env.FRESHBLOX_ALLOWED_ORIGINS).includes(clean)
}

export function corsHeaders(origin) {
  const headers = { Vary: 'Origin', 'Cache-Control': 'no-store' }
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Headers'] = 'authorization, x-client-info, apikey, content-type'
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    headers['Access-Control-Max-Age'] = '600'
  }
  return headers
}

export function sendJson(res, status, body, extraHeaders = {}) {
  res.statusCode = status
  for (const [k, v] of Object.entries({ ...corsHeaders(extraHeaders.origin), ...extraHeaders })) {
    if (k === 'origin') continue
    res.setHeader(k, v)
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export function hmacHex(secret, message) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex')
}

export function randomHex(bytes = 4) {
  return crypto.randomBytes(bytes).toString('hex')
}

function serviceHeaders(serviceRoleKey, extra = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Reads a JSON body with a hard size cap.
 * Returns a tagged result so the caller can answer 413 instead of "invalid payload"
 * when a client streams more than MAX_BODY_BYTES.
 */
export async function readJsonBody(req) {
  if (isPlainObject(req.body)) {
    return { kind: 'ok', body: req.body }
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    if (Buffer.byteLength(req.body) > MAX_BODY_BYTES) return { kind: 'too-large' }
    try {
      const parsed = JSON.parse(req.body)
      return isPlainObject(parsed) ? { kind: 'ok', body: parsed } : { kind: 'invalid' }
    } catch {
      return { kind: 'invalid' }
    }
  }

  return new Promise((resolve) => {
    const chunks = []
    let size = 0
    let tooLarge = false
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        tooLarge = true
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (tooLarge) return resolve({ kind: 'too-large' })
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        if (!raw) return resolve({ kind: 'empty' })
        const parsed = JSON.parse(raw)
        resolve(isPlainObject(parsed) ? { kind: 'ok', body: parsed } : { kind: 'invalid' })
      } catch {
        resolve({ kind: 'invalid' })
      }
    })
    req.on('error', () => resolve({ kind: 'invalid' }))
  })
}

/**
 * The fingerprint salt must be a dedicated, long-lived secret.
 * Falling back to the service-role key or to a hardcoded literal would make every
 * device/IP hash predictable, which silently disables the device lock — so a missing
 * or short salt is a configuration error, not something to paper over.
 */
export function resolveFpSalt(env = {}) {
  const salt = typeof env.FRESHBLOX_FP_SALT === 'string' ? env.FRESHBLOX_FP_SALT.trim() : ''
  return salt.length >= SALT_MIN_LENGTH ? salt : null
}

function looksLikeDuplicateUsername(payload) {
  const code = String(payload?.code ?? '')
  const text = `${payload?.msg ?? ''} ${payload?.message ?? ''} ${payload?.error_description ?? ''}`.toLowerCase()
  return code === '23505' || text.includes('duplicate key') || text.includes('already been registered') || text.includes('already exists')
}

/**
 * @param {object} req  Incoming request (Vercel/Node signature).
 * @param {object} res  Outgoing response.
 * @param {{ env?: Record<string, string|undefined>, fetchImpl?: typeof fetch }} [deps]
 */
export async function handleRegister(req, res, deps = {}) {
  const env = deps.env ?? process.env
  const doFetch = deps.fetchImpl ?? fetch
  const method = (req.method || 'GET').toUpperCase()
  const origin = getHeader(req, 'origin')
  // Echo the caller's origin only when it is actually allowed: the health check is public,
  // but it must not hand a foreign page a readable CORS grant.
  const echoOrigin = isOriginAllowed(origin, req, env) ? origin : ''

  if (method === 'OPTIONS') {
    if (!echoOrigin) {
      return sendJson(res, 403, { ok: false, error: 'ORIGIN_NOT_ALLOWED' }, { origin: '' })
    }
    res.statusCode = 204
    for (const [k, v] of Object.entries(corsHeaders(echoOrigin))) res.setHeader(k, v)
    res.end()
    return
  }

  const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || ''
  const fpSalt = resolveFpSalt(env)

  if (method === 'GET') {
    return sendJson(
      res,
      200,
      {
        ok: true,
        service: 'freshblox-register-account',
        status: 'healthy',
        configured: Boolean(supabaseUrl && serviceRoleKey && fpSalt),
        deviceLock: Boolean(fpSalt),
      },
      { origin: echoOrigin },
    )
  }

  if (method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' }, { origin: echoOrigin })
  }

  if (!isOriginAllowed(origin, req, env)) {
    return sendJson(res, 403, { ok: false, error: 'ORIGIN_NOT_ALLOWED' }, { origin: '' })
  }

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[register-account] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return sendJson(res, 500, { ok: false, error: 'SERVER_MISCONFIGURED' }, { origin: echoOrigin })
  }
  if (!fpSalt) {
    console.error(
      `[register-account] FRESHBLOX_FP_SALT missing or shorter than ${SALT_MIN_LENGTH} characters — refusing to issue device locks with a predictable salt`,
    )
    return sendJson(res, 500, { ok: false, error: 'SERVER_MISCONFIGURED' }, { origin: echoOrigin })
  }

  try {
    const parsed = await readJsonBody(req)
    if (parsed.kind === 'too-large') {
      return sendJson(res, 413, { ok: false, error: 'PAYLOAD_TOO_LARGE' }, { origin: echoOrigin })
    }
    if (parsed.kind !== 'ok') {
      return sendJson(res, 400, { ok: false, error: 'INVALID_PAYLOAD' }, { origin: echoOrigin })
    }
    const body = parsed.body
    const fail = (status, error, extra = {}) => sendJson(res, status, { ok: false, error }, { origin: echoOrigin, ...extra })

    const action = body.action === 'check' ? 'check' : 'register'
    const deviceToken = typeof body.deviceToken === 'string' ? body.deviceToken.trim() : ''
    const browserFp = typeof body.browserFp === 'string' ? body.browserFp.trim() : ''
    const coreHw = typeof body.coreHw === 'string' ? body.coreHw.trim() : ''

    if (deviceToken.length < 16 || browserFp.length < 16 || coreHw.length < 8) {
      return fail(400, 'INVALID_DEVICE_PROOF')
    }

    const clientIp = extractClientIp(req)
    const deviceTokenHash = hmacHex(fpSalt, `tok:${deviceToken}`)
    const fpIpHash = hmacHex(fpSalt, `fp:${browserFp}|ip:${clientIp}`)
    const coreHwIpHash = hmacHex(fpSalt, `hw:${coreHw}|ip:${clientIp}`)
    const ipHash = hmacHex(fpSalt, `ip:${clientIp}`)

    // 1. Has this device already registered an account?
    //
    // Only the mirrored device token and the browser fingerprint bound to the IP are proof:
    // the hardware signature is shared by identical machines on one network, so matching on
    // it alone locked siblings/classmates out of accounts they never created. It is still
    // recorded below (and rate-limited per network) but it never decides a rejection here.
    const orFilter = `or=(device_token_hash.eq.${deviceTokenHash},fp_ip_hash.eq.${fpIpHash})`
    const lookupRes = await doFetch(
      `${supabaseUrl}/rest/v1/fb_device_registrations?select=id&${orFilter}&limit=1`,
      { method: 'GET', headers: serviceHeaders(serviceRoleKey) },
    )

    if (!lookupRes.ok) {
      const errTxt = await lookupRes.text().catch(() => '')
      console.error('[register-account] Device lookup failed:', lookupRes.status, errTxt)
      return fail(500, 'SERVER_ERROR')
    }

    const existingDevice = await lookupRes.json().catch(() => [])
    const alreadyRegistered = Array.isArray(existingDevice) && existingDevice.length > 0

    if (action === 'check') {
      return sendJson(res, 200, { ok: true, allowed: !alreadyRegistered }, { origin: echoOrigin })
    }

    if (alreadyRegistered) return fail(403, 'DEVICE_LIMIT_REACHED')

    // 2. Validate username and password
    const cleanUsername = typeof body.username === 'string' ? body.username.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!USERNAME_REGEX.test(cleanUsername)) return fail(400, 'INVALID_USERNAME')
    if (password.length < 6 || password.length > 128) return fail(400, 'SHORT_PASSWORD')

    // 3. Per-network cap. This one fails closed: if we cannot read the counter we do not
    // know whether the network is over its budget, and creating accounts blind is worse
    // than asking the player to retry in a minute.
    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const rateRes = await doFetch(
      `${supabaseUrl}/rest/v1/fb_device_registrations?select=id&ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(sinceIso)}`,
      { method: 'GET', headers: serviceHeaders(serviceRoleKey) },
    )
    if (!rateRes.ok) {
      const errTxt = await rateRes.text().catch(() => '')
      console.error('[register-account] Network rate check failed:', rateRes.status, errTxt)
      return fail(503, 'SERVER_BUSY', { 'Retry-After': String(DEFAULT_RETRY_AFTER) })
    }
    const recentRows = await rateRes.json().catch(() => [])
    if (Array.isArray(recentRows) && recentRows.length >= MAX_ACCOUNTS_PER_NETWORK_PER_DAY) {
      return fail(429, 'NETWORK_RATE_LIMIT')
    }

    // 4. Friendly case-insensitive availability check. Best effort only: the unique index
    // on lower(username) is the real guard, and a duplicate is reported as USERNAME_TAKEN below.
    const availRes = await doFetch(`${supabaseUrl}/rest/v1/rpc/is_freshblox_username_available`, {
      method: 'POST',
      headers: serviceHeaders(serviceRoleKey),
      body: JSON.stringify({ p_username: cleanUsername }),
    })
    if (availRes.ok) {
      const isAvailable = await availRes.json().catch(() => true)
      if (isAvailable === false) return fail(409, 'USERNAME_TAKEN')
    } else {
      console.warn('[register-account] Availability RPC unavailable, relying on the unique index:', availRes.status)
    }

    // 5. Create the Auth user through the GoTrue Admin API (works with public signup disabled).
    const slug = cleanUsername.toLowerCase().replace(/[^a-z0-9_-]/g, '')
    const syntheticEmail = `u_${slug}_${randomHex(4)}@accounts.freshblox.app`

    const createRes = await doFetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: serviceHeaders(serviceRoleKey),
      body: JSON.stringify({
        email: syntheticEmail,
        password,
        email_confirm: true,
        user_metadata: { username: cleanUsername },
      }),
    })

    const createdJson = await createRes.json().catch(() => null)
    const createdUserId = createdJson?.id || createdJson?.user?.id || null

    if (!createRes.ok || !createdUserId) {
      console.error('[register-account] Create user failed:', createRes.status, createdJson)
      if (looksLikeDuplicateUsername(createdJson)) return fail(409, 'USERNAME_TAKEN')
      const errMsg =
        createdJson?.msg || createdJson?.message || createdJson?.error_description || 'CREATE_USER_FAILED'
      return fail(400, errMsg)
    }

    // 6. Lock the device; roll the freshly created user back if a concurrent request won the race.
    const lockRes = await doFetch(`${supabaseUrl}/rest/v1/fb_device_registrations`, {
      method: 'POST',
      headers: serviceHeaders(serviceRoleKey, { Prefer: 'return=minimal' }),
      body: JSON.stringify({
        user_id: createdUserId,
        device_token_hash: deviceTokenHash,
        fp_ip_hash: fpIpHash,
        core_hw_ip_hash: coreHwIpHash,
        ip_hash: ipHash,
      }),
    })

    if (!lockRes.ok) {
      const lockErrJson = await lockRes.json().catch(() => null)
      console.error('[register-account] Device lock insert failed, rolling back user:', lockRes.status, lockErrJson)
      await doFetch(`${supabaseUrl}/auth/v1/admin/users/${createdUserId}`, {
        method: 'DELETE',
        headers: serviceHeaders(serviceRoleKey),
      }).catch(() => {})

      if (lockRes.status === 409 || lockErrJson?.code === '23505') {
        return fail(403, 'DEVICE_LIMIT_REACHED')
      }
      return fail(500, 'SERVER_ERROR')
    }

    return sendJson(
      res,
      201,
      { ok: true, loginEmail: syntheticEmail, username: cleanUsername },
      { origin },
    )
  } catch (err) {
    console.error('[register-account] Unexpected error:', err)
    return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' }, { origin: echoOrigin })
  }
}

export default async function handler(req, res) {
  return handleRegister(req, res)
}
