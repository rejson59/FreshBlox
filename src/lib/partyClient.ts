import { RealtimeChannel } from '@supabase/supabase-js'
import { WorldKind } from '../data/catalog'
import { isSupabaseConfigured, supabase } from './supabase'

export interface PartyMember {
  id: string
  username: string
  isLeader: boolean
  lastSeen: number
}

interface PartyPacket {
  type: 'heartbeat' | 'leave' | 'launch'
  senderId: string
  username: string
  isLeader?: boolean
  world?: WorldKind
  roomCode?: string
}

export class PartySessionClient {
  readonly code: string
  private selfId: string
  private selfUsername: string
  private isLeader: boolean
  private bc: BroadcastChannel | null = null
  private sbChannel: RealtimeChannel | null = null
  private sbReady = false
  private members = new Map<string, PartyMember>()
  private hbTimer: number | null = null
  private onMembersChange: (members: PartyMember[]) => void
  private onLaunch: (world: WorldKind, roomCode: string, leaderName: string) => void

  constructor(opts: {
    code: string
    selfId: string
    selfUsername: string
    isLeader: boolean
    onMembersChange: (members: PartyMember[]) => void
    onLaunch: (world: WorldKind, roomCode: string, leaderName: string) => void
  }) {
    this.code = opts.code.toUpperCase()
    this.selfId = opts.selfId
    this.selfUsername = opts.selfUsername
    this.isLeader = opts.isLeader
    this.onMembersChange = opts.onMembersChange
    this.onLaunch = opts.onLaunch
  }

  connect() {
    this.members.set(this.selfId, {
      id: this.selfId,
      username: this.selfUsername,
      isLeader: this.isLeader,
      lastSeen: Date.now(),
    })
    this.emitMembers()

    if (typeof BroadcastChannel !== 'undefined') {
      this.bc = new BroadcastChannel(`freshblox-party-${this.code}`)
      this.bc.onmessage = (ev: MessageEvent<PartyPacket>) => this.handlePacket(ev.data)
    }

    if (isSupabaseConfigured && supabase) {
      this.sbChannel = supabase
        .channel(`freshblox:party:${this.code}`, {
          config: { broadcast: { self: false } },
        })
        .on('broadcast', { event: 'party' }, ({ payload }) => {
          this.handlePacket(payload as PartyPacket)
        })
        .subscribe((status) => {
          this.sbReady = status === 'SUBSCRIBED'
          if (this.sbReady) {
            this.sendHeartbeat()
          }
        })
    }

    this.sendHeartbeat()
    this.hbTimer = window.setInterval(() => {
      this.sendHeartbeat()
      const now = Date.now()
      let changed = false
      for (const [id, m] of this.members) {
        if (id !== this.selfId && now - m.lastSeen > 12_000) {
          this.members.delete(id)
          changed = true
        }
      }
      if (changed) this.emitMembers()
    }, 3000)
  }

  private sendPacket(packet: PartyPacket) {
    this.bc?.postMessage(packet)
    if (this.sbChannel && this.sbReady) {
      this.sbChannel.send({ type: 'broadcast', event: 'party', payload: packet }).catch(() => {})
    }
  }

  private sendHeartbeat() {
    this.members.set(this.selfId, {
      id: this.selfId,
      username: this.selfUsername,
      isLeader: this.isLeader,
      lastSeen: Date.now(),
    })
    this.sendPacket({
      type: 'heartbeat',
      senderId: this.selfId,
      username: this.selfUsername,
      isLeader: this.isLeader,
    })
  }

  private handlePacket(pkt: PartyPacket) {
    if (!pkt || pkt.senderId === this.selfId) return
    if (pkt.type === 'heartbeat') {
      this.members.set(pkt.senderId, {
        id: pkt.senderId,
        username: pkt.username,
        isLeader: Boolean(pkt.isLeader),
        lastSeen: Date.now(),
      })
      this.emitMembers()
    } else if (pkt.type === 'leave') {
      if (this.members.delete(pkt.senderId)) {
        this.emitMembers()
      }
    } else if (pkt.type === 'launch' && pkt.world && pkt.roomCode) {
      this.onLaunch(pkt.world, pkt.roomCode, pkt.username)
    }
  }

  private emitMembers() {
    const arr = Array.from(this.members.values()).sort((a, b) => {
      if (a.isLeader !== b.isLeader) return a.isLeader ? -1 : 1
      return a.username.localeCompare(b.username)
    })
    this.onMembersChange(arr)
  }

  broadcastLaunch(world: WorldKind, roomCode: string) {
    this.sendPacket({
      type: 'launch',
      senderId: this.selfId,
      username: this.selfUsername,
      isLeader: this.isLeader,
      world,
      roomCode,
    })
  }

  disconnect() {
    if (this.hbTimer) {
      window.clearInterval(this.hbTimer)
      this.hbTimer = null
    }
    this.sendPacket({
      type: 'leave',
      senderId: this.selfId,
      username: this.selfUsername,
    })
    this.bc?.close()
    this.bc = null
    if (this.sbChannel && supabase) {
      supabase.removeChannel(this.sbChannel)
      this.sbChannel = null
      this.sbReady = false
    }
  }
}

export function generatePartyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = 'PRT-'
  for (let i = 0; i < 4; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}
