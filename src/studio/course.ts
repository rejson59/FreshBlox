/** A share link contains geometry, not code or a database ID. Only this vocabulary is accepted. */
import type { ObbyBlockKind } from '../engine/obbyCourse'
export const kinds = ['solid', 'ice', 'bounce', 'checkpoint'] as const satisfies readonly ObbyBlockKind[]
export type PieceKind = (typeof kinds)[number]
export type Piece = { kind: PieceKind; level: number }
export type Course = { v: 1; title: string; pieces: Piece[] }
export const LIMIT = 10
export const pieceInfo = {
  solid: { pl: 'Trawa', en: 'Grass', color: '#85c65c' },
  ice: { pl: 'Lód', en: 'Ice', color: '#87dce9' },
  bounce: { pl: 'Trampolina', en: 'Spring', color: '#ff9950' },
  checkpoint: { pl: 'Checkpoint', en: 'Checkpoint', color: '#b89aee' },
}
export const skyline: Course = {
  v: 1,
  title: 'Skyline Rush',
  pieces: [
    { kind: 'solid', level: 0 },
    { kind: 'solid', level: 1 },
    { kind: 'checkpoint', level: 1 },
    { kind: 'ice', level: 0 },
    { kind: 'bounce', level: 0 },
    { kind: 'solid', level: 2 },
  ],
}
export const starter: Course = {
  v: 1,
  title: 'Cloud Circuit',
  pieces: [
    { kind: 'solid', level: 0 },
    { kind: 'bounce', level: 0 },
    { kind: 'checkpoint', level: 1 },
  ],
}
export function parseCourse(input: unknown): Course | null {
  if (!input || typeof input !== 'object') return null
  const c = input as Partial<Course>
  if (
    c.v !== 1 ||
    typeof c.title !== 'string' ||
    c.title.length > 40 ||
    !Array.isArray(c.pieces) ||
    c.pieces.length < 1 ||
    c.pieces.length > LIMIT
  )
    return null
  const pieces: Piece[] = []
  for (const p of c.pieces) {
    if (!p || !kinds.includes(p.kind) || !Number.isInteger(p.level) || p.level < 0 || p.level > 2) return null
    pieces.push({ kind: p.kind, level: p.level })
  }
  return {
    v: 1,
    title: c.title.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').trim() || 'Mini-Parkour',
    pieces,
  }
}
export function encodeCourse(c: Course) {
  const valid = parseCourse(c)
  if (!valid) throw new Error('Invalid course')
  return btoa(
    Array.from(new TextEncoder().encode(JSON.stringify(valid)), (n) => String.fromCharCode(n)).join(''),
  )
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}
export function decodeCourse(raw: string) {
  if (!raw || raw.length > 1500 || !/^[\w-]+$/.test(raw)) return null
  try {
    return parseCourse(
      JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(
          Uint8Array.from(atob(raw.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
        ),
      ),
    )
  } catch {
    return null
  }
}
export type Island = { kind: PieceKind | 'start' | 'finish'; x: number; top: number; width: number }
export function layout(c: Course): Island[] {
  const islands: Island[] = [{ kind: 'start', x: 0, top: 0, width: 4.6 }]
  for (const p of [...c.pieces, { kind: 'finish' as const, level: 0 }]) {
    const last = islands[islands.length - 1],
      width = p.kind === 'finish' ? 5 : p.kind === 'bounce' ? 3.3 : 3.9
    islands.push({ kind: p.kind, x: last.x + (last.width + width) / 2 + 1.25, width, top: p.level * 0.47 })
  }
  return islands
}
