import type { Island } from './course'
export type Runner = {
  started: boolean
  x: number
  y: number
  vx: number
  vy: number
  ground: number
  checkpoint: number
  furthest: number
  falls: number
  done: boolean
  elapsed: number
}
export const spawn = (): Runner => ({
  started: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  ground: 0,
  checkpoint: 0,
  furthest: 0,
  falls: 0,
  done: false,
  elapsed: 0,
})
/** Fixed-step model shared by the keyboard and touch controls. Heights refer to the runner's feet. */
export function step(r: Runner, islands: Island[], axis: number, jump: boolean, dt: number) {
  if (r.done) return
  if (!r.started && !jump && !axis && r.ground === 0) return
  r.started = true
  r.elapsed += dt
  const ground = islands[r.ground],
    oldY = r.y
  r.vx += (axis * 5.2 - r.vx) * Math.min(1, dt * (ground?.kind === 'ice' ? 3.4 : 18))
  if (jump && ground) {
    r.vy = ground.kind === 'bounce' ? 10.3 : 8.65
    r.ground = -1
  }
  r.vy -= 20.5 * dt
  r.x = Math.max(-1.8, r.x + r.vx * dt)
  r.y += r.vy * dt
  r.ground = -1
  if (r.vy <= 0) {
    const i = islands.findIndex(
      (p) => Math.abs(r.x - p.x) <= p.width / 2 + 0.12 && oldY >= p.top - 0.015 && r.y <= p.top,
    )
    if (i >= 0) {
      r.ground = i
      r.vy = 0
      r.y = islands[i].top
      r.furthest = Math.max(r.furthest, i)
      if (islands[i].kind === 'checkpoint') r.checkpoint = i
      if (islands[i].kind === 'finish') r.done = true
    }
  }
  if (r.y < -5) {
    const p = islands[r.checkpoint]
    Object.assign(r, { x: p.x, y: p.top, vx: 0, vy: 0, ground: r.checkpoint, falls: r.falls + 1 })
  }
}
