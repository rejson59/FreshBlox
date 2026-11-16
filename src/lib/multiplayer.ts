import { RealtimeChannel } from '@supabase/supabase-js'
import { R6AvatarConfig } from '../data/catalog'
import { isSupabaseConfigured, supabase } from './supabase'

export type PlayerPose =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'fall'
  | 'wave'
  | 'dance'
  | 'cheer'
  | 'sit'
  | 'spin'
  | 'backflip'

export interface RemotePlayerState {
  id: string
  username: string
  rank: string
  x: number
  y: number
  z: number
  rotY: number
  pose: PlayerPose
  avatar: R6AvatarConfig
  lastSeen: number
}

export interface LobbyChatMessage {
  id: string
  senderId: string
  username: string
  text: string
  timestamp: number
  system?: boolean
}

interface SyncPayload {
  type: 'state' | 'chat' | 'leave'
  senderId: string
  state?: RemotePlayerState
  chat?: LobbyChatMessage
}

/**
 * Dual-transport realtime multiplayer sync for Lobby Główne:
 * 1) Uses Supabase Realtime Broadcast when VITE_SUPABASE_URL/KEY are set
 * 2) Uses BroadcastChannel locally so 2+ browser tabs play together in real time immediately!
 */
export class LobbyMultiplayerClient {
  private roomId: string
  private selfId: string
  private bc: BroadcastChannel | null = null
  private sbChannel: RealtimeChannel | null = null
  private onState: (p: RemotePlayerState) => void
  private onLeave: (id: string) => void
  private onChat: (msg: LobbyChatMessage) => void

  constructor(opts: {
    roomId: string
    selfId: string
    onState: (p: RemotePlayerState) => void
    onLeave: (id: string) => void
    onChat: (msg: LobbyChatMessage) => void
  }) {
    this.roomId = opts.roomId
    this.selfId = opts.selfId
    this.onState = opts.onState
    this.onLeave = opts.onLeave
    this.onChat = opts.onChat
  }

  connect() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.bc = new BroadcastChannel(`freshblox-room-${this.roomId}`)
      this.bc.onmessage = (ev: MessageEvent<SyncPayload>) => {
        this.handlePayload(ev.data)
      }
    }

    if (isSupabaseConfigured && supabase) {
      this.sbChannel = supabase
        .channel(`freshblox:room:${this.roomId}`, {
          config: { broadcast: { self: false } },
        })
        .on('broadcast', { event: 'sync' }, ({ payload }) => {
          this.handlePayload(payload as SyncPayload)
        })
        .subscribe()
    }
  }

  private handlePayload(data: SyncPayload) {
    if (!data || data.senderId === this.selfId) return
    if (data.type === 'state' && data.state) {
      this.onState({ ...data.state, lastSeen: Date.now() })
    } else if (data.type === 'chat' && data.chat) {
      this.onChat(data.chat)
    } else if (data.type === 'leave') {
      this.onLeave(data.senderId)
    }
  }

  broadcastState(state: RemotePlayerState) {
    const payload: SyncPayload = { type: 'state', senderId: this.selfId, state }
    this.bc?.postMessage(payload)
    this.sbChannel?.send({ type: 'broadcast', event: 'sync', payload }).catch(() => {})
  }

  broadcastChat(msg: LobbyChatMessage) {
    const payload: SyncPayload = { type: 'chat', senderId: this.selfId, chat: msg }
    this.bc?.postMessage(payload)
    this.sbChannel?.send({ type: 'broadcast', event: 'sync', payload }).catch(() => {})
  }

  disconnect() {
    const leavePayload: SyncPayload = { type: 'leave', senderId: this.selfId }
    this.bc?.postMessage(leavePayload)
    this.bc?.close()
    this.bc = null
    if (this.sbChannel && supabase) {
      this.sbChannel.send({ type: 'broadcast', event: 'sync', payload: leavePayload }).catch(() => {})
      supabase.removeChannel(this.sbChannel)
      this.sbChannel = null
    }
  }
}
