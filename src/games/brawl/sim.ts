/**
 * Blok Brawl — deterministic arena sumo simulation.
 *
 * Everything lives in normalised ring units: the platform starts at radius 1 and
 * shrinks to RING_MIN. Both fighters are circles; the loser is whoever leaves the
 * platform. The sim is pure (no DOM, no renderer) so it can be stepped headlessly
 * by tests and by the bot.
 */

export type Side = 0 | 1
export type Phase = 'countdown' | 'live' | 'ko' | 'over'
export type BotLevel = 0 | 1 | 2

export const RING_MAX = 1
export const RING_MIN = 0.4
export const SHRINK_TIME = 26
export const WIN_SCORE = 3
export const COUNTDOWN = 2.4
export const KO_TIME = 1.9

const ACCEL = 3.4
const DAMP = 3.4
const VMAX = 1.05
const DASH_SPEED = 2.9
const DASH_TIME = 0.16
const DASH_CD = 1.5
const BODY = 0.1
const HIT_STUN = 0.16

export interface InputFrame {
  dx: number
  dy: number
  dash: boolean
}

export interface Fighter {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  dashCd: number
  dashT: number
  stun: number
  face: number
  flash: number
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
  spin: number
}

export interface Ghost {
  x: number
  y: number
  life: number
  max: number
  color: string
}

export interface Match {
  f: [Fighter, Fighter]
  ring: number
  round: number
  score: [number, number]
  phase: Phase
  t: number
  clock: number
  roundT: number
  particles: Particle[]
  ghosts: Ghost[]
  rng: () => number
  koSide: Side | null
  /** In online play the other fighter's fall is scored by their own client. */
  remoteSide: Side | null
}

/** Small deterministic LCG so bot behaviour is reproducible per round. */
function makeRng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const idleInput = (): InputFrame => ({ dx: 0, dy: 0, dash: false })
export const emptyInputs = (): [InputFrame, InputFrame] => [idleInput(), idleInput()]

function makeFighter(side: Side): Fighter {
  return {
    x: side === 0 ? -0.45 : 0.45,
    y: 0,
    vx: 0,
    vy: 0,
    r: BODY,
    dashCd: 0,
    dashT: 0,
    stun: 0,
    face: side === 0 ? 0 : Math.PI,
    flash: 0,
  }
}

export function createMatch(seed = 1): Match {
  return {
    f: [makeFighter(0), makeFighter(1)],
    ring: RING_MAX,
    round: 1,
    score: [0, 0],
    phase: 'countdown',
    t: COUNTDOWN,
    clock: 0,
    roundT: 0,
    particles: [],
    ghosts: [],
    rng: makeRng(seed),
    koSide: null,
    remoteSide: null,
  }
}

function resetRound(m: Match, nextRound: number) {
  m.f = [makeFighter(0), makeFighter(1)]
  m.ring = RING_MAX
  m.round = nextRound
  m.phase = 'countdown'
  m.t = COUNTDOWN
  m.roundT = 0
  m.koSide = null
  m.ghosts.length = 0
}

function burst(m: Match, x: number, y: number, color: string, n: number, power: number) {
  for (let i = 0; i < n; i++) {
    const a = m.rng() * Math.PI * 2,
      sp = power * (0.35 + m.rng() * 0.9)
    m.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.5 + m.rng() * 0.5,
      max: 1,
      size: 0.012 + m.rng() * 0.02,
      color,
      spin: m.rng() * 6,
    })
  }
}

function stepFighter(f: Fighter, input: InputFrame, dt: number) {
  f.dashCd = Math.max(0, f.dashCd - dt)
  f.dashT = Math.max(0, f.dashT - dt)
  f.stun = Math.max(0, f.stun - dt)
  f.flash = Math.max(0, f.flash - dt)

  let dx = input.dx,
    dy = input.dy
  const mag = Math.hypot(dx, dy)
  if (mag > 1) {
    dx /= mag
    dy /= mag
  }
  if (mag > 0.05) f.face = Math.atan2(dy, dx)

  if (f.stun <= 0 && mag > 0.05) {
    f.vx += dx * ACCEL * dt
    f.vy += dy * ACCEL * dt
  }

  if (input.dash && f.dashCd <= 0 && f.stun <= 0) {
    const len = Math.hypot(dx, dy) || 1
    f.vx = (dx / len) * DASH_SPEED
    f.vy = (dy / len) * DASH_SPEED
    f.dashCd = DASH_CD
    f.dashT = DASH_TIME
    f.face = Math.atan2(dy / len, dx / len)
  }

  const damp = Math.exp(-DAMP * dt)
  f.vx *= damp
  f.vy *= damp
  // Only ordinary running is capped — a dash or a shove is meant to be a burst.
  if (f.dashT <= 0 && f.stun <= 0) {
    const sp = Math.hypot(f.vx, f.vy)
    if (sp > VMAX) {
      f.vx = (f.vx / sp) * VMAX
      f.vy = (f.vy / sp) * VMAX
    }
  }

  f.x += f.vx * dt
  f.y += f.vy * dt
}

/** Contact normal and the impulse that should land on `b`. Pure — no mutation. */
export function contactImpulse(a: Fighter, b: Fighter): { nx: number; ny: number; j: number; heavy: number } | null {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    d = Math.hypot(dx, dy) || 1e-6,
    min = a.r + b.r
  if (d >= min) return null

  const nx = dx / d,
    ny = dy / d,
    rvx = b.vx - a.vx,
    rvy = b.vy - a.vy,
    closing = -(rvx * nx + rvy * ny)
  if (closing <= 0) return null

  const heavy = a.dashT > 0 ? 1.9 : 1
  return { nx, ny, j: Math.max(0.16, closing * 0.62), heavy }
}

/** Applies a shove to `f`, opposite to the normal when `sign` is negative. */
export function shove(f: Fighter, nx: number, ny: number, j: number, heavy: number, sign: 1 | -1) {
  f.vx += nx * j * heavy * sign
  f.vy += ny * j * heavy * sign
  f.stun = Math.max(f.stun, HIT_STUN)
  f.flash = 0.18
}

function collide(a: Fighter, b: Fighter, m: Match) {
  const hit = contactImpulse(a, b)
  if (!hit) return

  const dx = b.x - a.x,
    dy = b.y - a.y,
    d = Math.hypot(dx, dy) || 1e-6,
    overlap = (a.r + b.r - d) / 2
  a.x -= (dx / d) * overlap
  a.y -= (dy / d) * overlap
  b.x += (dx / d) * overlap
  b.y += (dy / d) * overlap

  const heavyA = a.dashT > 0 ? 1.9 : 1,
    heavyB = b.dashT > 0 ? 1.9 : 1
  shove(a, hit.nx, hit.ny, hit.j, heavyB, -1)
  shove(b, hit.nx, hit.ny, hit.j, heavyA, 1)

  const strength = Math.min(1, hit.j / 1.4)
  if (strength > 0.3) {
    const cx = a.x + hit.nx * a.r,
      cy = a.y + hit.ny * a.r
    burst(m, cx, cy, '#0a1b2e', Math.round(4 + strength * 10), 0.5 + strength * 0.8)
  }
}

export function stepMatch(
  m: Match,
  dt: number,
  inputs: [InputFrame, InputFrame],
  opts: { skipCollide?: boolean } = {},
) {
  if (m.phase === 'over') return
  m.clock += dt
  m.t -= dt

  if (m.phase === 'countdown') {
    if (m.t <= 0) {
      m.phase = 'live'
      m.t = 0
    }
    return
  }

  if (m.phase === 'ko') {
    if (m.t <= 0) {
      if (m.score[0] >= WIN_SCORE || m.score[1] >= WIN_SCORE) {
        m.phase = 'over'
      } else {
        resetRound(m, m.round + 1)
      }
    }
    return
  }

  // live
  m.roundT += dt
  m.ring = Math.max(RING_MIN, RING_MAX - (RING_MAX - RING_MIN) * Math.min(1, m.roundT / SHRINK_TIME))

  for (let s = 0; s < 2; s++) {
    const f = m.f[s as Side]
    const before = { x: f.x, y: f.y }
    stepFighter(f, inputs[s], dt)
    if (f.dashT > 0 && Math.hypot(f.x - before.x, f.y - before.y) > 0.001) {
      m.ghosts.push({ x: f.x, y: f.y, life: 0.28, max: 0.28, color: s === 0 ? '#38bdf8' : '#8ed8b0' })
    }
    if (Math.hypot(f.x, f.y) > m.ring + f.r * 0.4 && m.remoteSide !== s) fallOut(m, s as Side)
  }
  if (m.phase !== 'live') return

  if (!opts.skipCollide) collide(m.f[0], m.f[1], m)

  for (const p of m.particles) {
    p.life -= dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vx *= 0.94
    p.vy *= 0.94
  }
  m.particles = m.particles.filter((p) => p.life > 0)
  for (const g of m.ghosts) g.life -= dt
  m.ghosts = m.ghosts.filter((g) => g.life > 0)
}

function fallOut(m: Match, side: Side) {
  if (m.phase !== 'live') return
  const f = m.f[side]
  m.phase = 'ko'
  m.t = KO_TIME
  m.koSide = side
  m.score[side === 0 ? 1 : 0] += 1
  burst(m, f.x, f.y, side === 0 ? '#38bdf8' : '#8ed8b0', 26, 1.6)
  burst(m, f.x, f.y, '#0a1b2e', 10, 1)
}

/* --------------------------------------------------------------------- bot */

/**
 * Bot brain. Level 0 wanders and rarely dashes, level 2 circles the edge and
 * punishes you the moment you drift towards it.
 */
export function botInput(m: Match, side: Side, level: BotLevel): InputFrame {
  const me = m.f[side],
    foe = m.f[side === 0 ? 1 : 0]
  if (m.phase !== 'live') return idleInput()

  const toFoeX = foe.x - me.x,
    toFoeY = foe.y - me.y,
    distFoe = Math.hypot(toFoeX, toFoeY) || 1e-6,
    dc = Math.hypot(me.x, me.y),
    edge = m.ring * (level === 2 ? 0.78 : 0.68)

  let dx = toFoeX / distFoe,
    dy = toFoeY / distFoe

  // Survival first: if we are close to the rim, get back to the middle.
  if (dc > edge) {
    const panic = Math.min(1, (dc - edge) / (m.ring * 0.2) + 0.4)
    dx = dx * (1 - panic) + (-me.x / (dc || 1)) * panic
    dy = dy * (1 - panic) + (-me.y / (dc || 1)) * panic
  }

  // Orbit a little so the bot does not just walk into you in a straight line.
  if (level > 0 && distFoe > 0.3) {
    const orbit = (side === 0 ? 1 : -1) * (level === 2 ? 0.55 : 0.3)
    dx += (-toFoeY / distFoe) * orbit
    dy += (toFoeX / distFoe) * orbit
  }

  // Aim the dash so the shove pushes the rival towards the nearest rim.
  let dash = false
  if (me.dashCd <= 0 && distFoe < (level === 2 ? 0.42 : 0.34)) {
    const foeOut = Math.hypot(foe.x, foe.y) / m.ring
    const chance = level === 2 ? 0.95 : level === 1 ? 0.62 : 0.3
    if (m.rng() < chance && (level === 2 || foeOut > 0.35 || m.rng() < 0.35)) {
      dash = true
      dx = toFoeX / distFoe
      dy = toFoeY / distFoe
    }
  }

  const jitter = level === 0 ? 0.5 : level === 1 ? 0.22 : 0.08
  dx += (m.rng() - 0.5) * jitter
  dy += (m.rng() - 0.5) * jitter

  return { dx, dy, dash }
}

/** True when `side` has been shoved off the platform during this step. */
export const isOut = (m: Match, side: Side) => m.koSide === side && m.phase === 'ko'
