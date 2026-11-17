import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function extractClientIp(req: Request): string {
  const raw =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
    'unknown'

  const cleaned = raw.trim().toLowerCase()
  // Normalize IPv6 to /64 prefix so privacy-extension suffix rotation cannot bypass device lock
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':').filter(Boolean)
    return parts.slice(0, 4).join(':') || cleaned
  }
  return cleaned
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function randomHex(bytes = 6): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const fpSalt = Deno.env.get('FRESHBLOX_FP_SALT') || serviceRoleKey || 'freshblox-default-salt'

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ ok: false, error: 'SERVER_MISCONFIGURED' }, 500)
    }

    const body = (await req.json().catch(() => null)) as {
      action?: 'check' | 'register'
      username?: string
      password?: string
      deviceToken?: string
      browserFp?: string
      coreHw?: string
    } | null

    if (!body) {
      return jsonResponse({ ok: false, error: 'INVALID_PAYLOAD' }, 400)
    }

    const action = body.action === 'check' ? 'check' : 'register'
    const deviceToken = typeof body.deviceToken === 'string' ? body.deviceToken.trim() : ''
    const browserFp = typeof body.browserFp === 'string' ? body.browserFp.trim() : ''
    const coreHw = typeof body.coreHw === 'string' ? body.coreHw.trim() : ''

    if (deviceToken.length < 16 || browserFp.length < 16 || coreHw.length < 8) {
      return jsonResponse({ ok: false, error: 'INVALID_DEVICE_PROOF' }, 400)
    }

    const clientIp = extractClientIp(req)
    const [deviceTokenHash, fpIpHash, coreHwIpHash, ipHash] = await Promise.all([
      hmacHex(fpSalt, `tok:${deviceToken}`),
      hmacHex(fpSalt, `fp:${browserFp}|ip:${clientIp}`),
      hmacHex(fpSalt, `hw:${coreHw}|ip:${clientIp}`),
      hmacHex(fpSalt, `ip:${clientIp}`),
    ])

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Check if this device already created an account (matches persistent token OR browser FP+IP OR cross-browser HW+IP)
    const { data: existingDevice, error: lookupErr } = await supabaseAdmin
      .from('fb_device_registrations')
      .select('id')
      .or(
        `device_token_hash.eq.${deviceTokenHash},fp_ip_hash.eq.${fpIpHash},core_hw_ip_hash.eq.${coreHwIpHash}`,
      )
      .limit(1)

    if (lookupErr) {
      console.error('Device lookup error:', lookupErr)
      return jsonResponse({ ok: false, error: 'SERVER_ERROR' }, 500)
    }

    const alreadyRegistered = Array.isArray(existingDevice) && existingDevice.length > 0

    if (action === 'check') {
      return jsonResponse({ ok: true, allowed: !alreadyRegistered }, 200)
    }

    if (alreadyRegistered) {
      return jsonResponse({ ok: false, error: 'DEVICE_LIMIT_REACHED' }, 403)
    }

    // Validate username & password
    const cleanUsername = typeof body.username === 'string' ? body.username.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!USERNAME_REGEX.test(cleanUsername)) {
      return jsonResponse({ ok: false, error: 'INVALID_USERNAME' }, 400)
    }
    if (password.length < 6 || password.length > 128) {
      return jsonResponse({ ok: false, error: 'SHORT_PASSWORD' }, 400)
    }

    // Network anti-bot rate limit (allows up to 6 distinct devices on the same home/school Wi-Fi per 24h)
    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: recentIpCount } = await supabaseAdmin
      .from('fb_device_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', sinceIso)

    if (typeof recentIpCount === 'number' && recentIpCount >= 6) {
      return jsonResponse({ ok: false, error: 'NETWORK_RATE_LIMIT' }, 429)
    }

    // Check case-insensitive username availability
    const { data: isAvailable, error: availErr } = await supabaseAdmin.rpc(
      'is_freshblox_username_available',
      { p_username: cleanUsername },
    )
    if (!availErr && isAvailable === false) {
      return jsonResponse({ ok: false, error: 'USERNAME_TAKEN' }, 409)
    }

    // Create auth user via admin API (works even when public GoTrue signup is disabled!)
    const slug = cleanUsername.toLowerCase().replace(/[^a-z0-9_-]/g, '')
    const syntheticEmail = `u_${slug}_${randomHex(4)}@accounts.freshblox.app`

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      user_metadata: { username: cleanUsername },
    })

    if (createErr || !created.user) {
      console.error('Create user error:', createErr)
      return jsonResponse({ ok: false, error: createErr?.message || 'CREATE_USER_FAILED' }, 400)
    }

    // Atomically lock this device in fb_device_registrations (rollback user if race condition triggers UNIQUE violation)
    const { error: insertErr } = await supabaseAdmin.from('fb_device_registrations').insert({
      user_id: created.user.id,
      device_token_hash: deviceTokenHash,
      fp_ip_hash: fpIpHash,
      core_hw_ip_hash: coreHwIpHash,
      ip_hash: ipHash,
    })

    if (insertErr) {
      console.error('Device lock insert race/error, rolling back user:', insertErr)
      await supabaseAdmin.auth.admin.deleteUser(created.user.id).catch(() => {})
      if (insertErr.code === '23505') {
        return jsonResponse({ ok: false, error: 'DEVICE_LIMIT_REACHED' }, 403)
      }
      return jsonResponse({ ok: false, error: 'SERVER_ERROR' }, 500)
    }

    return jsonResponse(
      {
        ok: true,
        loginEmail: syntheticEmail,
        username: cleanUsername,
      },
      201,
    )
  } catch (err) {
    console.error('Unexpected register-account error:', err)
    return jsonResponse({ ok: false, error: 'SERVER_ERROR' }, 500)
  }
})
