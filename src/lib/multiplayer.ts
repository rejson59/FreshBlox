import { RealtimeChannel } from '@supabase/supabase-js'
import { R6AvatarConfig, WorldKind } from '../data/catalog'
import { isSupabaseConfigured, supabase } from './supabase'

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
 * Dual-transport realtime multiplayer sync for Main Lobby & Test Obby 100:
 * 1) Uses Supabase Realtime Broadcast + persistent room chat (fb_lobby_messages)
 * 2) Uses BroadcastChannel locally so 2+ browser tabs also stay synced instantly
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
  private onHistory?: (msgs: LobbyChatMessage[]) => void

  constructor(opts: {
    roomId: string
    world?: WorldKind
    selfId: string
    onState: (p: RemotePlayerState) => void
    onLeave: (id: string) => void
    onChat: (msg: LobbyChatMessage) => void
    onHistory?: (msgs: LobbyChatMessage[]) => void
  }) {
    this.roomId = opts.roomId
    this.world = opts.world ?? 'lobby'
    this.selfId = opts.selfId
    this.onState = opts.onState
    this.onLeave = opts.onLeave
    this.onChat = opts.onChat
    this.onHistory = opts.onHistory
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

      // Fetch recent persistent room chat messages from Supabase
      if (this.onHistory) {
        supabase
          .from('fb_lobby_messages')
          .select('id, user_id, username, content, created_at')
          .eq('room_id', dbRoomKey)
          .order('created_at', { ascending: false })
          .limit(15)
          .then(({ data }) => {
            if (!data || data.length === 0 || !this.onHistory) return
            const mapped: LobbyChatMessage[] = [...data].reverse().map((row) => ({
              id: `db_${row.id}`,
              senderId: row.user_id ?? `guest_${row.username}`,
              username: row.username,
              text: row.content,
              timestamp: new Date(row.created_at).getTime(),
            }))
            this.onHistory(mapped)
          })
      }
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

  broadcastChat(msg: LobbyChatMessage, authUserId?: string | null) {
    const payload: SyncPayload = { type: 'chat', senderId: this.selfId, chat: msg }
    this.bc?.postMessage(payload)
    if (this.sbChannel && this.sbReady) {
      this.sbChannel.send({ type: 'broadcast', event: 'sync', payload }).catch(() => {})
    }

    // Persist chat in Postgres when signed into Supabase
    if (isSupabaseConfigured && supabase && authUserId) {
      void supabase
        .from('fb_lobby_messages')
        .insert({
          room_id: this.channelKey,
          user_id: authUserId,
          username: msg.username,
          content: msg.text.slice(0, 220),
        })
        .then(() => {})
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
