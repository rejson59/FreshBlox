/**
 * Multi-layer device registration guard (1 account creation per device, unlimited sign-ins).
 * Combines:
 *  1. Self-healing persistent device token mirrored across localStorage, IndexedDB, cookie, and CacheStorage.
 *  2. Deterministic browser+GPU+Canvas+Audio hardware fingerprint (survives clearing storage & Incognito).
 *  3. Cross-browser core hardware signature (screen physical size, GPU core, CPU cores, timezone, OS family).
 * The proofs are HMAC-hashed server-side in the Vercel function `api/register-account.js`.
 *
 * Only the mirrored device token is unique per device. The hardware signatures are
 * coarse on purpose (they survive storage wipes), which means two identical machines on
 * the same network produce the same value — the server therefore treats them as one
 * signal among several, never as proof on their own.
 */

const TOKEN_KEY = 'fb_dev_tok_v1'
const REGISTERED_KEY = 'fb_dev_reg_v1'
const IDB_NAME = 'freshblox_device_vault'
const IDB_STORE = 'kv'
const CACHE_NAME = 'freshblox-dev-v1'

export interface DeviceRegistrationProof {
  deviceToken: string
  browserFp: string
  coreHw: string
}

/**
 * Deterministic non-cryptographic hash used only when WebCrypto is unavailable
 * (an insecure LAN origin). Exported so the degradation is visible and testable instead
 * of silently changing what the server receives.
 */
export function fallbackFingerprintHash(input: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x9e3779b9
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0
  }
  return (
    h1.toString(16).padStart(8, '0') +
    h2.toString(16).padStart(8, '0') +
    (h1 ^ h2).toString(16).padStart(8, '0') +
    Math.imul(h1 | 1, h2 | 1)
      .toString(16)
      .replace('-', 'f')
      .padStart(8, '0')
  )
}

export async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(input)
    const digest = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  return fallbackFingerprintHash(input)
}

function generateRandomToken(): string {
  const bytes = new Uint8Array(24)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// --- Storage helpers (4 independent layers) ---

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key: string, val: string): void {
  try {
    localStorage.setItem(key, val)
  } catch {
    // ignore
  }
}

function readCookie(name: string): string | null {
  try {
    const prefix = `${name}=`
    const parts = document.cookie.split(';')
    for (const part of parts) {
      const trimmed = part.trim()
      if (trimmed.startsWith(prefix)) {
        return decodeURIComponent(trimmed.slice(prefix.length))
      }
    }
    return null
  } catch {
    return null
  }
}

function writeCookie(name: string, val: string): void {
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${name}=${encodeURIComponent(val)}; max-age=315360000; path=/; SameSite=Lax${secure}`
  } catch {
    // ignore
  }
}

function openVaultDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null)
        return
      }
      const req = indexedDB.open(IDB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function readIdb(key: string): Promise<string | null> {
  const db = await openVaultDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(key)
      req.onsuccess = () => {
        db.close()
        resolve(typeof req.result === 'string' ? req.result : null)
      }
      req.onerror = () => {
        db.close()
        resolve(null)
      }
    } catch {
      db.close()
      resolve(null)
    }
  })
}

async function writeIdb(key: string, val: string): Promise<void> {
  const db = await openVaultDb()
  if (!db) return
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(val, key)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        db.close()
        resolve()
      }
    } catch {
      db.close()
      resolve()
    }
  })
}

async function readCache(key: string): Promise<string | null> {
  try {
    if (typeof caches === 'undefined') return null
    const cache = await caches.open(CACHE_NAME)
    const res = await cache.match(`/__fb_vault__/${key}`)
    if (!res) return null
    const txt = await res.text()
    return txt || null
  } catch {
    return null
  }
}

async function writeCache(key: string, val: string): Promise<void> {
  try {
    if (typeof caches === 'undefined') return
    const cache = await caches.open(CACHE_NAME)
    await cache.put(
      `/__fb_vault__/${key}`,
      new Response(val, { headers: { 'Content-Type': 'text/plain' } }),
    )
  } catch {
    // ignore
  }
}

async function readMirroredValue(key: string): Promise<string | null> {
  const [fromIdb, fromCache] = await Promise.all([readIdb(key), readCache(key)])
  const fromLocal = readLocal(key)
  const fromCookie = readCookie(key)
  const found = fromLocal || fromIdb || fromCookie || fromCache || null
  if (found) {
    // Self-heal any layer that was cleared independently
    if (fromLocal !== found) writeLocal(key, found)
    if (fromCookie !== found) writeCookie(key, found)
    if (fromIdb !== found) void writeIdb(key, found)
    if (fromCache !== found) void writeCache(key, found)
  }
  return found
}

async function writeMirroredValue(key: string, val: string): Promise<void> {
  writeLocal(key, val)
  writeCookie(key, val)
  await Promise.all([writeIdb(key, val), writeCache(key, val)])
}

export async function getOrCreateDeviceToken(): Promise<string> {
  const existing = await readMirroredValue(TOKEN_KEY)
  if (existing && existing.length >= 20) return existing
  const fresh = generateRandomToken()
  await writeMirroredValue(TOKEN_KEY, fresh)
  return fresh
}

export async function markDeviceRegisteredLocally(): Promise<void> {
  await writeMirroredValue(REGISTERED_KEY, '1')
}

export async function hasLocalDeviceRegisteredFlag(): Promise<boolean> {
  const val = await readMirroredValue(REGISTERED_KEY)
  return val === '1'
}

// --- Hardware & Browser Fingerprint Collectors ---

function getWebGLInfo(): { vendor: string; renderer: string; params: string; coreGpu: string } {
  try {
    const canvas = document.createElement('canvas')
    const gl =
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null)
    if (!gl) return { vendor: 'none', renderer: 'none', params: 'none', coreGpu: 'none' }

    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const vendor = ext ? String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || '') : String(gl.getParameter(gl.VENDOR) || '')
    const renderer = ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '')
      : String(gl.getParameter(gl.RENDERER) || '')
    const params = [
      gl.getParameter(gl.MAX_TEXTURE_SIZE),
      gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
    ].join(',')

    // Extract browser-agnostic GPU model core (strips ANGLE(...) wrappers & Direct3D/OpenGL tags)
    let coreGpu = renderer.toLowerCase()
    const angleMatch = coreGpu.match(/angle\s*\([^,]+,\s*([^,()]+)/)
    if (angleMatch && angleMatch[1]) {
      coreGpu = angleMatch[1]
    }
    coreGpu = coreGpu
      .replace(/direct3d\d+|d3d\d+|vs_\d+_\d+|ps_\d+_\d+|opengl|metal|vulkan/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .slice(0, 48)

    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return { vendor, renderer, params, coreGpu: coreGpu || 'gpu' }
  } catch {
    return { vendor: 'err', renderer: 'err', params: 'err', coreGpu: 'err' }
  }
}

function getCanvas2dSample(): string {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 240
    canvas.height = 60
    const ctx = canvas.getContext('2d')
    if (!ctx) return 'no2d'
    ctx.fillStyle = '#0B162C'
    ctx.fillRect(0, 0, 240, 60)
    const grad = ctx.createLinearGradient(0, 0, 240, 60)
    grad.addColorStop(0, '#38BDF8')
    grad.addColorStop(1, '#0284C7')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(38, 30, 18, 0, Math.PI * 1.75)
    ctx.fill()
    ctx.font = 'bold 16px Arial, sans-serif'
    ctx.fillStyle = '#F8FAFC'
    ctx.fillText('FreshBlox-R6! 100', 64, 34)
    return canvas.toDataURL()
  } catch {
    return 'canvas_err'
  }
}

async function getAudioSample(): Promise<string> {
  try {
    const AudioCtx =
      window.OfflineAudioContext ||
      (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext
    if (!AudioCtx) return 'noaudio'

    const ctx = new AudioCtx(1, 1024, 44100)
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = 1000
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -36
    comp.knee.value = 30
    comp.ratio.value = 10
    osc.connect(comp)
    comp.connect(ctx.destination)
    osc.start(0)

    const rendered = await Promise.race<AudioBuffer | null>([
      ctx.startRendering(),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 160)),
    ])
    if (!rendered) return 'audio_timeout'
    const ch = rendered.getChannelData(0)
    let acc = 0
    for (let i = 200; i < Math.min(800, ch.length); i++) {
      acc += Math.abs(ch[i])
    }
    return acc.toFixed(5)
  } catch {
    return 'audio_err'
  }
}

function detectOsFamily(): string {
  const ua = (navigator.userAgent || '').toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  if (/windows/.test(ua)) return 'windows'
  if (/mac os x|macintosh/.test(ua)) return 'macos'
  if (/cros/.test(ua)) return 'chromeos'
  if (/linux/.test(ua)) return 'linux'
  return 'other'
}

export interface FingerprintSources {
  /** Physical screen size, already normalized so rotation cannot change it. */
  screenWidth: number
  screenHeight: number
  devicePixelRatio: number
  colorDepth: number
  availHeight: number
  hardwareConcurrency: number
  deviceMemory: number
  /** 'touch' or 'pointer' — kept as a string so the payload stays readable when debugging. */
  pointerKind: 'touch' | 'pointer'
  timeZone: string
  language: string
  osFamily: string
  gpuVendor: string
  gpuRenderer: string
  gpuParams: string
  /** A GPU family name that is stable across browser vendors on the same machine. */
  gpuCore: string
  audioSample: string
  canvasSample: string
}

/**
 * The two signed payloads, built without touching any browser API so the shape can be
 * pinned by tests: the server compares these strings across sessions and they must not
 * drift when nothing about the device changed.
 */
export function fingerprintPayloads(sources: FingerprintSources): {
  browserRaw: string
  coreHwRaw: string
} {
  // Largest dimension first: portrait/landscape rotation produces the same signature.
  const physicalScreen = `${Math.max(sources.screenWidth, sources.screenHeight)}x${Math.min(
    sources.screenWidth,
    sources.screenHeight,
  )}`

  const browserRaw = [
    physicalScreen,
    Math.round(sources.devicePixelRatio * 100),
    sources.colorDepth,
    sources.hardwareConcurrency,
    sources.deviceMemory,
    sources.pointerKind,
    sources.timeZone,
    sources.osFamily,
    sources.gpuVendor,
    sources.gpuRenderer,
    sources.gpuParams,
    sources.audioSample,
    sources.canvasSample,
  ].join('|')

  const coreHwRaw = [
    physicalScreen,
    sources.availHeight,
    sources.colorDepth,
    sources.hardwareConcurrency,
    sources.deviceMemory,
    sources.pointerKind,
    sources.timeZone,
    sources.language.toLowerCase(),
    sources.osFamily,
    sources.gpuCore,
    sources.gpuParams,
  ].join('|')

  return { browserRaw, coreHwRaw }
}

let cachedProofPromise: Promise<DeviceRegistrationProof> | null = null

export async function collectDeviceRegistrationProof(): Promise<DeviceRegistrationProof> {
  if (!cachedProofPromise) {
    cachedProofPromise = (async () => {
      const [deviceToken, audioSample] = await Promise.all([
        getOrCreateDeviceToken(),
        getAudioSample(),
      ])

      const glInfo = getWebGLInfo()
      const canvasSample = getCanvas2dSample()
      const dpr = window.devicePixelRatio || 1
      const physA = Math.round((window.screen?.width || 0) * dpr)
      const physB = Math.round((window.screen?.height || 0) * dpr)
      const tz = (() => {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone || 'utc'
        } catch {
          return 'utc'
        }
      })()

      const { browserRaw, coreHwRaw } = fingerprintPayloads({
        screenWidth: physA,
        screenHeight: physB,
        devicePixelRatio: dpr,
        colorDepth: window.screen?.colorDepth || 24,
        availHeight: window.screen?.availHeight || 0,
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        deviceMemory: (navigator as unknown as { deviceMemory?: number }).deviceMemory || 0,
        pointerKind: (navigator.maxTouchPoints || 0) > 0 ? 'touch' : 'pointer',
        timeZone: tz,
        language: navigator.language || 'en',
        osFamily: detectOsFamily(),
        gpuVendor: glInfo.vendor,
        gpuRenderer: glInfo.renderer,
        gpuParams: glInfo.params,
        gpuCore: glInfo.coreGpu,
        audioSample,
        canvasSample,
      })

      const [browserFp, coreHw] = await Promise.all([sha256Hex(browserRaw), sha256Hex(coreHwRaw)])

      return { deviceToken, browserFp, coreHw }
    })().catch((err) => {
      // Do not cache a failure: a transient WebGL/audio error would otherwise pin the
      // broken proof for the rest of the session.
      cachedProofPromise = null
      throw err
    })
  }
  return cachedProofPromise
}
