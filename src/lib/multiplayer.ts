import { RealtimeChannel } from '@supabase/supabase-js'
import { R6AvatarConfig, WorldKind } from '../data/catalog'
import { isSupabaseConfigured, supabase } from './supabase'

/** Messages older than 20 minutes are automatically purged from live room chat */
export const CHAT_MESSAGE_TTL_MS = 20 * 60 * 1000

export type PlayerPose =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'fall'
  | 'mantle'
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
  stage?: number
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
 * Ephemeral, zero-database-write realtime multiplayer sync for Main Lobby & Test Obby 100:
 * - Uses lightweight Supabase Realtime Broadcast (no Postgres INSERT/SELECT per chat message)
 * - Uses local BroadcastChannel so multiple tabs stay synced immediately
 * - Joining players start with a clean empty chat and receive only live messages sent during their session
 * - When all players leave a room, zero chat data remains anywhere on the server
 */
export class LobbyMultiplayerClient {
  private roomId: string
  private world: WorldKind
  private selfId: string
  private bc: BroadcastChannel | null = null
  private sbChannel: RealtimeChannel | null = null
  private sbReady = false
  private onState: (p: RemotePlayerState) => void
  private onLeave: (id: string) => void
  private onChat: (msg: LobbyChatMessage) => void

  constructor(opts: {
    roomId: string
    world?: WorldKind
    selfId: string
    onState: (p: RemotePlayerState) => void
    onLeave: (id: string) => void
    onChat: (msg: LobbyChatMessage) => void
  }) {
    this.roomId = opts.roomId
    this.world = opts.world ?? 'lobby'
    this.selfId = opts.selfId
    this.onState = opts.onState
    this.onLeave = opts.onLeave
    this.onChat = opts.onChat
  }

  private get channelKey() {
    return `${this.world}:${this.roomId}`
  }

  connect() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.bc = new BroadcastChannel(`freshblox-room-${this.channelKey}`)
      this.bc.onmessage = (ev: MessageEvent<SyncPayload>) => {
        this.handlePayload(ev.data)
      }
    }

    if (isSupabaseConfigured && supabase) {
      const dbRoomKey = this.channelKey
      this.sbChannel = supabase
        .channel(`freshblox:room:${dbRoomKey}`, {
          config: { broadcast: { self: false } },
        })
        .on('broadcast', { event: 'sync' }, ({ payload }) => {
          this.handlePayload(payload as SyncPayload)
        })
        .subscribe((status) => {
          this.sbReady = status === 'SUBSCRIBED'
        })
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
    if (this.sbChannel && this.sbReady) {
      this.sbChannel.send({ type: 'broadcast', event: 'sync', payload }).catch(() => {})
    }
  }

  broadcastChat(msg: LobbyChatMessage, _authUserId?: string | null) {
    const payload: SyncPayload = { type: 'chat', senderId: this.selfId, chat: msg }
    this.bc?.postMessage(payload)
    if (this.sbChannel && this.sbReady) {
      this.sbChannel.send({ type: 'broadcast', event: 'sync', payload }).catch(() => {})
    }
  }

  disconnect() {
    const leavePayload: SyncPayload = { type: 'leave', senderId: this.selfId }
    this.bc?.postMessage(leavePayload)
    this.bc?.close()
    this.bc = null
    if (this.sbChannel && supabase) {
      if (this.sbReady) {
        this.sbChannel.send({ type: 'broadcast', event: 'sync', payload: leavePayload }).catch(() => {})
      }
      supabase.removeChannel(this.sbChannel)
      this.sbChannel = null
      this.sbReady = false
    }
  }
}

/** Filter helper that removes any chat messages older than 20 minutes */
export function pruneExpiredChatMessages(messages: LobbyChatMessage[], now = Date.now()): LobbyChatMessage[] {
  return messages.filter((m) => now - m.timestamp < CHAT_MESSAGE_TTL_MS)
}
