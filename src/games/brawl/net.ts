import type { RealtimeChannel } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'

/** Everything two brawlers need to exchange. Positions are owned by each client. */
export type DuelPacket =
  | { t: 'hello'; name: string; tie: number }
  | {
      t: 'state'
      x: number
      y: number
      vx: number
      vy: number
      face: number
      dashCd: number
      score: number
      round: number
    }
  | { t: 'hit'; jx: number; jy: number }
  | { t: 'rematch' }
  | { t: 'fall' }
  | { t: 'bye' }

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function makeRoomCode() {
  let out = ''
  for (let i = 0; i < 4; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  return `BRAWL-${out}`
}

export function normalizeRoom(raw: string) {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^BRAWL/, '')
  return clean ? `BRAWL-${clean.slice(0, 4)}` : ''
}

/**
 * Room-scoped realtime channel for Blok Brawl.
 *
 * Works in two layers exactly like the rest of FreshBlox: a BroadcastChannel keeps
 * tabs in the same browser in sync instantly, and Supabase Realtime carries the
 * packets across the internet when the project is configured.
 */
export class DuelNet {
  readonly room: string
  private readonly selfId: string
  private readonly onPacket: (p: DuelPacket, from: string) => void
  private bc: BroadcastChannel | null = null
  private channel: RealtimeChannel | null = null
  private ready = false

  constructor(room: string, selfId: string, onPacket: (p: DuelPacket, from: string) => void) {
    this.room = room
    this.selfId = selfId
    this.onPacket = onPacket
  }

  connect() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.bc = new BroadcastChannel(`freshblox-brawl-${this.room}`)
      this.bc.onmessage = (ev: MessageEvent<{ from: string; packet: DuelPacket }>) => {
        if (ev.data?.from && ev.data.from !== this.selfId) this.onPacket(ev.data.packet, ev.data.from)
      }
    }
    if (isSupabaseConfigured && supabase) {
      this.channel = supabase.channel(`freshblox:brawl:${this.room}`, {
        config: { broadcast: { self: false } },
      })
      this.channel
        .on('broadcast', { event: 'duel' }, ({ payload }) => {
          const data = payload as { from?: string; packet?: DuelPacket } | null
          if (data?.packet && data.from && data.from !== this.selfId) {
            this.onPacket(data.packet, data.from)
          }
        })
        .subscribe((status) => {
          this.ready = status === 'SUBSCRIBED'
        })
    }
  }

  send(packet: DuelPacket) {
    const envelope = { from: this.selfId, packet }
    this.bc?.postMessage(envelope)
    if (this.channel && this.ready) {
      this.channel.send({ type: 'broadcast', event: 'duel', payload: envelope }).catch(() => {})
    }
  }

  close() {
    this.send({ t: 'bye' })
    this.bc?.close()
    this.bc = null
    if (this.channel && supabase) {
      supabase.removeChannel(this.channel)
      this.channel = null
      this.ready = false
    }
  }
}
