import assert from 'node:assert/strict'
import test from 'node:test'
import { fallbackFingerprintHash, fingerprintPayloads, sha256Hex } from '../src/lib/deviceGuard.ts'

// A representative desktop: 1920x1080 at 1x, 8 cores, one GPU family.
function sources(overrides = {}) {
  return {
    screenWidth: 1920,
    screenHeight: 1080,
    devicePixelRatio: 1,
    colorDepth: 24,
    availHeight: 1040,
    hardwareConcurrency: 8,
    deviceMemory: 8,
    pointerKind: 'pointer',
    timeZone: 'Europe/Warsaw',
    language: 'pl-PL',
    osFamily: 'windows',
    gpuVendor: 'Google Inc. (NVIDIA)',
    gpuRenderer: 'ANGLE (NVIDIA GeForce RTX 3060)',
    gpuParams: '4096|16|16|false',
    gpuCore: 'nvidia',
    audioSample: '0.04213',
    canvasSample: 'data:image/png;base64,AAAA',
    ...overrides,
  }
}

test('rotating the screen does not change the fingerprint', () => {
  const landscape = fingerprintPayloads(sources({ screenWidth: 1920, screenHeight: 1080 }))
  const portrait = fingerprintPayloads(sources({ screenWidth: 1080, screenHeight: 1920 }))
  assert.deepEqual(portrait, landscape)
})

test('a genuinely different machine produces different payloads', () => {
  const base = fingerprintPayloads(sources())
  const otherCpu = fingerprintPayloads(sources({ hardwareConcurrency: 4 }))
  const otherGpu = fingerprintPayloads(sources({ gpuCore: 'amd', gpuRenderer: 'ANGLE (AMD Radeon)' }))
  const otherTimezone = fingerprintPayloads(sources({ timeZone: 'America/New_York' }))
  assert.notEqual(otherCpu.browserRaw, base.browserRaw)
  assert.notEqual(otherGpu.browserRaw, base.browserRaw)
  assert.notEqual(otherTimezone.coreHwRaw, base.coreHwRaw)
})

test('the payloads are stable for the same inputs and keep the documented shape', () => {
  const { browserRaw, coreHwRaw } = fingerprintPayloads(sources())
  // Pinned on purpose: the server compares these strings across sessions, so a silent
  // reordering here would invalidate every stored device lock.
  assert.equal(
    browserRaw,
    '1920x1080|100|24|8|8|pointer|Europe/Warsaw|windows|Google Inc. (NVIDIA)|ANGLE (NVIDIA GeForce RTX 3060)|4096|16|16|false|0.04213|data:image/png;base64,AAAA',
  )
  assert.equal(
    coreHwRaw,
    '1920x1080|1040|24|8|8|pointer|Europe/Warsaw|pl-pl|windows|nvidia|4096|16|16|false',
  )
  // Language must be normalized so `pl-pl` and `pl-PL` cannot split one device into two.
  assert.equal(fingerprintPayloads(sources({ language: 'PL-pl' })).coreHwRaw, coreHwRaw)
})

test('child processes inherit the same signature — a second browser profile is not a second device', () => {
  // The same machine reports identical values from a different userDataDir/incognito session,
  // which is exactly what the mirrored device token is for. This documents the assumption.
  assert.deepEqual(fingerprintPayloads(sources()), fingerprintPayloads(sources()))
})

test('the non-WebCrypto fallback is deterministic, 32 hex chars and input-sensitive', () => {
  const a = fallbackFingerprintHash('machine-a')
  const b = fallbackFingerprintHash('machine-a')
  const c = fallbackFingerprintHash('machine-b')
  assert.equal(a, b)
  assert.notEqual(a, c)
  assert.match(a, /^[0-9a-f]{32}$/)
})

test('sha256Hex matches a reference SHA-256 and stays hex-encoded', async () => {
  const { createHash } = await import('node:crypto')
  const expected = createHash('sha256').update('freshblox').digest('hex')
  const digest = await sha256Hex('freshblox')
  assert.match(digest, /^[0-9a-f]{64}$/)
  assert.equal(digest, expected)
})
