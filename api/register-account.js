import crypto from 'node:crypto'

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store',
}

function sendJson(res, status, body) {
  res.statusCode = status
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.setHeader(k, v)
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function getHeader(req, name) {
  const val = req.headers?.[name.toLowerCase()]
  if (Array.isArray(val)) return val[0] || ''
  return typeof val === 'string' ? val : ''
}

function extractClientIp(req) {
  const raw =
    getHeader(req, 'x-vercel-forwarded-for').split(',')[0].trim() ||
    getHeader(req, 'cf-connecting-ip').trim() ||
    getHeader(req, 'x-real-ip').trim() ||
    getHeader(req, 'x-forwarded-for').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'

  const cleaned = String(raw).trim().toLowerCase().replace(/^::ffff:/, '')
  // Normalize IPv6 to /64 prefix so privacy-extension suffix rotation cannot bypass device lock
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':').filter(Boolean)
    return parts.slice(0, 4).join(':') || cleaned
  }
  return cleaned
}

function hmacHex(secret, message) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex')
}

function randomHex(bytes = 4) {
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

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body)
    } catch {
      return null
    }
  }

  return new Promise((resolve) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size <= 32768) chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : null)
      } catch {
        resolve(null)
      }
    })
    req.on('error', () => resolve(null))
  })
}

export default async function handler(req, res) {
  const method = (req.method || 'GET').toUpperCase()

  if (method === 'OPTIONS') {
    res.statusCode = 200
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      res.setHeader(k, v)
    }
    res.end('ok')
    return
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const fpSalt = process.env.FRESHBLOX_FP_SALT || serviceRoleKey || 'freshblox-default-salt'

  if (method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      service: 'freshblox-register-account',
      status: 'healthy',
      configured: Boolean(supabaseUrl && serviceRoleKey),
    })
  }

  if (method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[register-account] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return sendJson(res, 500, { ok: false, error: 'SERVER_MISCONFIGURED' })
  }

  try {
    const body = await readJsonBody(req)
    if (!body || typeof body !== 'object') {
      return sendJson(res, 400, { ok: false, error: 'INVALID_PAYLOAD' })
    }

    const action = body.action === 'check' ? 'check' : 'register'
    const deviceToken = typeof body.deviceToken === 'string' ? body.deviceToken.trim() : ''
    const browserFp = typeof body.browserFp === 'string' ? body.browserFp.trim() : ''
    const coreHw = typeof body.coreHw === 'string' ? body.coreHw.trim() : ''

    if (deviceToken.length < 16 || browserFp.length < 16 || coreHw.length < 8) {
      return sendJson(res, 400, { ok: false, error: 'INVALID_DEVICE_PROOF' })
    }

    const clientIp = extractClientIp(req)
    const deviceTokenHash = hmacHex(fpSalt, `tok:${deviceToken}`)
    const fpIpHash = hmacHex(fpSalt, `fp:${browserFp}|ip:${clientIp}`)
    const coreHwIpHash = hmacHex(fpSalt, `hw:${coreHw}|ip:${clientIp}`)
    const ipHash = hmacHex(fpSalt, `ip:${clientIp}`)

    // 1. Check if this device already registered an account
    const orFilter = `or=(device_token_hash.eq.${deviceTokenHash},fp_ip_hash.eq.${fpIpHash},core_hw_ip_hash.eq.${coreHwIpHash})`
    const lookupRes = await fetch(
      `${supabaseUrl}/rest/v1/fb_device_registrations?select=id&${orFilter}&limit=1`,
      {
        method: 'GET',
        headers: serviceHeaders(serviceRoleKey),
      },
    )

    if (!lookupRes.ok) {
      const errTxt = await lookupRes.text().catch(() => '')
      console.error('[register-account] Device lookup failed:', lookupRes.status, errTxt)
      return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' })
    }

    const existingDevice = await lookupRes.json().catch(() => [])
    const alreadyRegistered = Array.isArray(existingDevice) && existingDevice.length > 0

    if (action === 'check') {
      return sendJson(res, 200, { ok: true, allowed: !alreadyRegistered })
    }

    if (alreadyRegistered) {
      return sendJson(res, 403, { ok: false, error: 'DEVICE_LIMIT_REACHED' })
    }

    // 2. Validate username & password
    const cleanUsername = typeof body.username === 'string' ? body.username.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!USERNAME_REGEX.test(cleanUsername)) {
      return sendJson(res, 400, { ok: false, error: 'INVALID_USERNAME' })
    }
    if (password.length < 6 || password.length > 128) {
      return sendJson(res, 400, { ok: false, error: 'SHORT_PASSWORD' })
    }

    // 3. Network anti-bot rate limit (allows up to 6 distinct devices on the same home/school Wi-Fi per 24h)
    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const rateRes = await fetch(
      `${supabaseUrl}/rest/v1/fb_device_registrations?select=id&ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(sinceIso)}`,
      {
        method: 'GET',
        headers: serviceHeaders(serviceRoleKey),
      },
    )
    if (rateRes.ok) {
      const recentRows = await rateRes.json().catch(() => [])
      if (Array.isArray(recentRows) && recentRows.length >= 6) {
        return sendJson(res, 429, { ok: false, error: 'NETWORK_RATE_LIMIT' })
      }
    }

    // 4. Case-insensitive username availability check via Postgres RPC
    const availRes = await fetch(`${supabaseUrl}/rest/v1/rpc/is_freshblox_username_available`, {
      method: 'POST',
      headers: serviceHeaders(serviceRoleKey),
      body: JSON.stringify({ p_username: cleanUsername }),
    })
    if (availRes.ok) {
      const isAvailable = await availRes.json().catch(() => true)
      if (isAvailable === false) {
        return sendJson(res, 409, { ok: false, error: 'USERNAME_TAKEN' })
      }
    }

    // 5. Create Auth user via GoTrue Admin API (works even when public signup is disabled!)
    const slug = cleanUsername.toLowerCase().replace(/[^a-z0-9_-]/g, '')
    const syntheticEmail = `u_${slug}_${randomHex(4)}@accounts.freshblox.app`

    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
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
      const errMsg =
        createdJson?.msg || createdJson?.message || createdJson?.error_description || 'CREATE_USER_FAILED'
      return sendJson(res, 400, { ok: false, error: errMsg })
    }

    // 6. Atomically lock this device in fb_device_registrations (rollback user if race triggers UNIQUE violation)
    const lockRes = await fetch(`${supabaseUrl}/rest/v1/fb_device_registrations`, {
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
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${createdUserId}`, {
        method: 'DELETE',
        headers: serviceHeaders(serviceRoleKey),
      }).catch(() => {})

      if (lockRes.status === 409 || lockErrJson?.code === '23505') {
        return sendJson(res, 403, { ok: false, error: 'DEVICE_LIMIT_REACHED' })
      }
      return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' })
    }

    return sendJson(res, 201, {
      ok: true,
      loginEmail: syntheticEmail,
      username: cleanUsername,
    })
  } catch (err) {
    console.error('[register-account] Unexpected error:', err)
    return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' })
  }
}
