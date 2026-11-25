import assert from 'node:assert/strict'
import test from 'node:test'
import {
  COUNTDOWN,
  KO_TIME,
  RING_MAX,
  RING_MIN,
  SHRINK_TIME,
  WIN_SCORE,
  botInput,
  contactImpulse,
  createMatch,
  emptyInputs,
  isOut,
  shove,
  stepMatch,
} from '../src/games/brawl/sim.ts'

const DT = 1 / 60
const IDLE = { dx: 0, dy: 0, dash: false }
const run = (m, seconds, inputs = emptyInputs()) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) stepMatch(m, DT, inputs)
}
const goLive = (m) => {
  let guard = 0
  while (m.phase === 'countdown' && guard++ < 1000) stepMatch(m, DT, emptyInputs())
  assert.equal(m.phase, 'live')
}
const walkOffWest = (m) => {
  let guard = 0
  while (m.phase === 'live' && guard++ < 600) stepMatch(m, DT, [{ dx: -1, dy: 0, dash: false }, IDLE])
  assert.equal(m.phase, 'ko')
}
const snapshot = (m) =>
  JSON.stringify({
    f: m.f.map(({ x, y, vx, vy, dashCd, stun }) => [x, y, vx, vy, dashCd, stun]),
    ring: m.ring,
    score: m.score,
    phase: m.phase,
    round: m.round,
    particles: m.particles.length,
    ghosts: m.ghosts.length,
  })

test('countdown hands over to a live round and the platform shrinks to its floor', () => {
  const m = createMatch()
  assert.equal(m.phase, 'countdown')
  assert.deepEqual(botInput(m, 1, 2), IDLE, 'the bot waits for the round to start')
  run(m, COUNTDOWN - 0.2)
  assert.equal(m.phase, 'countdown')
  run(m, 0.4)
  assert.equal(m.phase, 'live')
  assert.ok(Math.abs(m.ring - RING_MAX) < 0.01)

  // Park both fighters in the middle so only the shrinking ring is under test.
  m.f[0].x = -0.1
  m.f[1].x = 0.1
  run(m, SHRINK_TIME / 2)
  assert.ok(Math.abs(m.ring - (RING_MAX + RING_MIN) / 2) < 0.01, `mid-shrink ring ${m.ring}`)
  run(m, SHRINK_TIME)
  assert.equal(m.ring, RING_MIN, 'the ring never collapses past RING_MIN')
})

test('walking off the rim scores for the rival, pauses, and the first to three wins', () => {
  const m = createMatch()
  goLive(m)
  walkOffWest(m)
  assert.ok(isOut(m, 0))
  assert.deepEqual(m.score, [0, 1], 'the fighter who fell loses the round')

  run(m, KO_TIME / 2)
  assert.equal(m.phase, 'ko', 'the KO callout gets its pause')
  run(m, KO_TIME)
  assert.equal(m.phase, 'countdown')
  assert.equal(m.round, 2)
  assert.equal(m.ring, RING_MAX, 'a new round starts on a full platform')
  assert.deepEqual(m.score, [0, 1], 'the score carries over between rounds')

  // Two more falls close the match.
  for (let i = 0; i < 2; i++) {
    goLive(m)
    walkOffWest(m)
    run(m, KO_TIME + 0.1)
  }
  assert.deepEqual(m.score, [0, WIN_SCORE])
  assert.equal(m.phase, 'over')

  const before = snapshot(m)
  run(m, 1, [{ dx: 1, dy: 0, dash: true }, IDLE])
  assert.equal(snapshot(m), before, 'nothing moves once the match is over')
})

test('a fall on the remote side is ignored locally — their own client reports it', () => {
  const m = createMatch()
  goLive(m)
  m.remoteSide = 1
  m.f[1].x = 5
  stepMatch(m, DT, emptyInputs())
  assert.equal(m.phase, 'live')
  assert.equal(m.koSide, null)

  m.remoteSide = null
  stepMatch(m, DT, emptyInputs())
  assert.equal(m.phase, 'ko')
  assert.equal(m.koSide, 1)
  assert.deepEqual(m.score, [1, 0])
})

test('contactImpulse points from the striker to the target and only while closing in', () => {
  const a = { x: -0.05, y: 0, vx: 1, vy: 0, r: 0.1, dashT: 0, dashCd: 0, stun: 0, face: 0, flash: 0 }
  const b = { x: 0.05, y: 0, vx: 0, vy: 0, r: 0.1, dashT: 0, dashCd: 0, stun: 0, face: 0, flash: 0 }
  const hit = contactImpulse(a, b)
  assert.ok(hit)
  assert.ok(Math.abs(hit.nx - 1) < 1e-6 && Math.abs(hit.ny) < 1e-6, 'normal runs from a to b')
  assert.ok(hit.j >= 0.16 && hit.j <= 0.7)
  assert.equal(hit.heavy, 1)

  a.dashT = 0.1
  assert.equal(contactImpulse(a, b).heavy, 1.9, 'a dash lands heavier')

  a.vx = -1
  assert.equal(contactImpulse(a, b), null, 'no impulse once they are separating')
  a.vx = 1
  b.x = 0.3
  assert.equal(contactImpulse(a, b), null, 'no impulse when they do not touch')

  const c = { ...b, x: 0.05 }
  shove(c, 1, 0, 0.5, 1.9, 1)
  assert.ok(c.vx > 0 && c.stun > 0, 'the target is pushed along the normal')
  const d = { ...a, vx: 0 }
  shove(d, 1, 0, 0.5, 1.9, -1)
  assert.ok(d.vx < 0, 'the striker recoils the other way')
})

test('a dash is a burst above running speed and is gated by its cooldown', () => {
  const m = createMatch()
  goLive(m)
  stepMatch(m, DT, [{ dx: 1, dy: 0, dash: true }, IDLE])
  const burst = Math.hypot(m.f[0].vx, m.f[0].vy)
  assert.ok(burst > 1.5, `dash speed ${burst}`)
  assert.ok(m.f[0].dashCd > 1)
  assert.equal(m.ghosts.length, 1, 'the dash leaves a ghost trail')

  // Dashing again right away does nothing; plain running settles at the cap.
  const afterBurst = m.f[0].dashCd
  stepMatch(m, DT, [{ dx: 1, dy: 0, dash: true }, IDLE])
  assert.equal(m.f[0].dashCd, afterBurst - DT, 'cooldown keeps ticking, no second burst')
  run(m, 2, [{ dx: 1, dy: 0, dash: false }, IDLE])
  assert.ok(Math.hypot(m.f[0].vx, m.f[0].vy) <= 1.05 + 1e-9)
})

test('the same seed replays the same brawl, and the host alone resolves contact', () => {
  const play = (seed, skipCollide) => {
    const m = createMatch(seed)
    goLive(m)
    // The player stands still; the level-1 bot walks up and shoves it off the rim.
    for (let i = 0; i < 150; i++) stepMatch(m, DT, [IDLE, botInput(m, 1, 1)], { skipCollide })
    return m
  }
  assert.equal(snapshot(play(7, false)), snapshot(play(7, false)), 'deterministic replay')
  assert.notEqual(snapshot(play(7, false)), snapshot(play(8, false)), 'the seed drives the bot')

  const host = play(7, false)
  const relay = play(7, true)
  assert.deepEqual([host.phase, ...host.score], ['ko', 0, 1], 'the bot shoves the player off')
  assert.deepEqual([relay.phase, ...relay.score], ['live', 0, 0], 'without contact nobody is pushed off')
})
