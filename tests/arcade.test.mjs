import test from 'node:test'
import assert from 'node:assert/strict'
import { encodeCourse, decodeCourse, parseCourse, layout, skyline, starter } from '../src/studio/course.ts'
import { step, spawn } from '../src/studio/physics.ts'
import { roomWorld, cleanRoom, gameIds, defaultRoom, socialWorldIds, worlds } from '../src/data/worlds.ts'
import { access } from 'node:fs/promises'

test('every published room code resolves back to its world; solo Kart is not a party destination', async () => {
  for (const id of gameIds) assert.equal(roomWorld(' #' + defaultRoom(id).toLowerCase() + ' '), id)
  assert.equal(cleanRoom('  #kart-1  '), 'KART-1')
  assert.ok(!socialWorldIds.includes('racing'))
  for (const w of Object.values(worlds)) await access(new URL(`../public${w.cover}`, import.meta.url))
})
test('shared course round-trips Polish text, pins a version and carries no executable content', () => {
  const course = { ...starter, title: 'Łąka i śnieg 🟧' }
  const code = encodeCourse(course)
  assert.deepEqual(decodeCourse(code), course)
  assert.match(code, /^[\w-]+$/)
  assert.deepEqual(parseCourse({ ...course, extra: 'ignored' }), course)
})
test('broken, oversized or unknown course payloads are rejected before creating a world', () => {
  for (const bad of ['', '#', 'abc', 'a'.repeat(1501)]) assert.equal(decodeCourse(bad), null)
  for (const bad of [
    { ...starter, v: 2 },
    { ...starter, pieces: [] },
    { ...starter, pieces: Array(11).fill(starter.pieces[0]) },
    { ...starter, pieces: [{ kind: 'custom', level: 0 }] },
    { ...starter, pieces: [{ kind: 'ice', level: -1 }] },
    { ...starter, title: 'x'.repeat(41) },
  ])
    assert.equal(parseCourse(bad), null)
})
test('each allowed step including the highest transition can be jumped with normal controls', () => {
  for (const c of [
    skyline,
    starter,
    {
      ...starter,
      pieces: Array.from({ length: 10 }, (_, i) => ({
        kind: i % 2 ? 'ice' : 'bounce',
        level: i % 2 ? 2 : 0,
      })),
    },
  ]) {
    const track = layout(c),
      r = spawn()
    let lastGround = 0
    for (let tick = 0; tick < 60 * 120 && !r.done; tick++) {
      if (r.ground >= 0) lastGround = r.ground
      const p = track[lastGround]
      step(r, track, 1, r.ground >= 0 && r.x >= p.x + p.width / 2 - 0.95, 1 / 120)
    }
    assert.equal(r.done, true)
    assert.equal(r.falls, 0)
  }
})
test('falling returns to the last checkpoint, not to the finish', () => {
  const track = layout(starter),
    r = spawn(),
    i = track.findIndex((p) => p.kind === 'checkpoint')
  r.x = track[i].x
  r.y = track[i].top
  r.ground = -1
  step(r, track, 0, false, 1 / 120)
  assert.equal(r.checkpoint, i)
  r.y = -6
  step(r, track, 0, false, 1 / 120)
  assert.equal(r.x, track[i].x)
  assert.equal(r.falls, 1)
  assert.equal(r.done, false)
})
