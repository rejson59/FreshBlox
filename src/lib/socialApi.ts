import { R6AvatarConfig, WorldKind } from '../data/catalog'
import { isSupabaseConfigured, supabase } from './supabase'

export type PrivateRoomAccessMode = 'password' | 'friends'

export interface PrivateRoomMeta {
  room_code: string
  world_kind: WorldKind
  host_id: string
  host_username: string
  access_mode: PrivateRoomAccessMode
  created_at: string
  expires_at: string
}

export interface VerifyRoomAccessResult {
  allowed: boolean
  is_private: boolean
  world_kind?: WorldKind | null
  access_mode?: PrivateRoomAccessMode
  host_username?: string
  reason?: 'PASSWORD_REQUIRED' | 'WRONG_PASSWORD' | 'FRIENDS_ONLY' | null
}

export interface DirectMessageRow {
  /** uuid in the schema (`fb_direct_messages.id`); treated as an opaque key by the UI. */
  id: number | string
  sender_id: string
  recipient_id: string
  sender_username: string
  content: string
  room_invite_world: WorldKind | null
  room_invite_code: string | null
  read_at: string | null
  created_at: string
}

export interface ObbyChampionEntry {
  id: string
  username: string
  fresh_tag: string
  xp: number
  obby_best_stage: number
  obby_completions: number
  obby_best_time_ms: number | null
  avatar_config: R6AvatarConfig
  role: string
  pinned_badge: string | null
}

export interface UserNotificationItem {
  id: string
  kind: 'dm' | 'invite' | 'feedback'
  title: string
  body: string
  createdAt: string
  fromUserId?: string
  fromUsername?: string
  inviteWorld?: WorldKind
  inviteRoom?: string
}

export async function createPrivateRoom(opts: {
  roomCode: string
  worldKind: WorldKind
  accessMode: PrivateRoomAccessMode
  password?: string
}): Promise<{ data: { room_code: string; world_kind: WorldKind } | null; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { data: null, error: 'Chmura niedostępna' }
  const { data, error } = await supabase.rpc('create_private_room', {
    p_room_code: opts.roomCode,
    p_world_kind: opts.worldKind,
    p_access_mode: opts.accessMode,
    p_password: opts.password ?? null,
  })
  if (error) return { data: null, error: error.message }
  return { data: data as { room_code: string; world_kind: WorldKind }, error: null }
}

export async function verifyPrivateRoomAccess(
  roomCode: string,
  password?: string,
): Promise<{ data: VerifyRoomAccessResult | null; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: { allowed: true, is_private: false }, error: null }
  }
  const { data, error } = await supabase.rpc('verify_private_room_access', {
    p_room_code: roomCode,
    p_password: password ?? null,
  })
  if (error) return { data: null, error: error.message }
  return { data: data as VerifyRoomAccessResult, error: null }
}

export async function listActivePrivateRooms(): Promise<PrivateRoomMeta[]> {
  if (!isSupabaseConfigured || !supabase) return []
  const { data } = await supabase
    .from('fb_private_rooms')
    .select('room_code, world_kind, host_id, host_username, access_mode, created_at, expires_at')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(20)
  return (data ?? []) as PrivateRoomMeta[]
}

export async function fetchDirectMessages(otherUserId: string, selfId: string): Promise<DirectMessageRow[]> {
  if (!isSupabaseConfigured || !supabase) return []
  const { data } = await supabase
    .from('fb_direct_messages')
    .select('id, sender_id, recipient_id, sender_username, content, room_invite_world, room_invite_code, read_at, created_at')
    .or(
      `and(sender_id.eq.${selfId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${selfId})`,
    )
    .order('created_at', { ascending: true })
    .limit(60)
  return (data ?? []) as DirectMessageRow[]
}

export async function sendDirectMessage(opts: {
  recipientId: string
  content: string
  inviteWorld?: WorldKind | null
  inviteCode?: string | null
}): Promise<{ data: DirectMessageRow | null; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { data: null, error: 'Chmura niedostępna' }
  const { data, error } = await supabase.rpc('send_direct_message', {
    p_recipient_id: opts.recipientId,
    p_content: opts.content,
    p_invite_world: opts.inviteWorld ?? null,
    p_invite_code: opts.inviteCode ?? null,
  })
  if (error) return { data: null, error: error.message }
  return { data: data as DirectMessageRow, error: null }
}

export async function markDmThreadRead(otherUserId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return
  await supabase.rpc('mark_dm_thread_read', { p_other_user_id: otherUserId })
}

export async function fetchUnreadDmCounts(selfId: string): Promise<Record<string, number>> {
  if (!isSupabaseConfigured || !supabase) return {}
  const { data } = await supabase
    .from('fb_direct_messages')
    .select('sender_id')
    .eq('recipient_id', selfId)
    .is('read_at', null)
    .limit(200)
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const sid = String((row as { sender_id: string }).sender_id)
    counts[sid] = (counts[sid] ?? 0) + 1
  }
  return counts
}

export async function fetchUserNotifications(selfId: string, lang: 'pl' | 'en'): Promise<UserNotificationItem[]> {
  if (!isSupabaseConfigured || !supabase) return []
  const items: UserNotificationItem[] = []

  // 1) Unread Direct Messages & Game Room Invites
  const { data: unreadDms } = await supabase
    .from('fb_direct_messages')
    .select('id, sender_id, sender_username, content, room_invite_world, room_invite_code, created_at')
    .eq('recipient_id', selfId)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(15)

  for (const dm of (unreadDms ?? []) as Array<{
    id: number
    sender_id: string
    sender_username: string
    content: string
    room_invite_world: WorldKind | null
    room_invite_code: string | null
    created_at: string
  }>) {
    items.push({
      id: `dm_${dm.id}`,
      kind: dm.room_invite_code ? 'invite' : 'dm',
      title: dm.room_invite_code
        ? lang === 'pl'
          ? `Zaproszenie od ${dm.sender_username}`
          : `Invite from ${dm.sender_username}`
        : lang === 'pl'
        ? `Wiadomość od ${dm.sender_username}`
        : `Message from ${dm.sender_username}`,
      body: dm.content,
      createdAt: dm.created_at,
      fromUserId: dm.sender_id,
      fromUsername: dm.sender_username,
      inviteWorld: dm.room_invite_world ?? undefined,
      inviteRoom: dm.room_invite_code ?? undefined,
    })
  }

  // 2) Status updates on the user's own submitted feedback (reviewing / planned / done)
  const { data: myFeedback } = await supabase
    .from('fb_feedback')
    .select('id, title, status, created_at')
    .eq('user_id', selfId)
    .neq('status', 'new')
    .order('created_at', { ascending: false })
    .limit(6)

  const statusLabel: Record<string, { pl: string; en: string }> = {
    reviewing: { pl: 'W analizie', en: 'Reviewing' },
    planned: { pl: 'Planowane', en: 'Planned' },
    done: { pl: 'Zrealizowane', en: 'Completed' },
  }

  for (const fb of (myFeedback ?? []) as Array<{ id: string; title: string; status: string; created_at: string }>) {
    const st = statusLabel[fb.status] ?? { pl: fb.status, en: fb.status }
    items.push({
      id: `fb_${fb.id}_${fb.status}`,
      kind: 'feedback',
      title: lang === 'pl' ? `Zgłoszenie: ${st.pl}` : `Feedback: ${st.en}`,
      body: fb.title,
      createdAt: fb.created_at,
    })
  }

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function fetchObbyTopChampions(limit = 10): Promise<ObbyChampionEntry[]> {
  if (!isSupabaseConfigured || !supabase) return []
  const { data, error } = await supabase.rpc('get_obby_top_champions', { p_limit: limit })
  if (error || !Array.isArray(data)) return []
  return data.map((row) => {
    const r = row as Record<string, unknown>
    const av = (r.avatar_config as Partial<R6AvatarConfig> | null) ?? {}
    return {
      id: String(r.id),
      username: String(r.username ?? 'Player'),
      fresh_tag: String(r.fresh_tag ?? '#FB-0000'),
      xp: Number(r.xp ?? 0),
      obby_best_stage: Number(r.obby_best_stage ?? 1),
      obby_completions: Number(r.obby_completions ?? 0),
      obby_best_time_ms: typeof r.obby_best_time_ms === 'number' ? r.obby_best_time_ms : null,
      avatar_config: {
        outfitId: (av.outfitId as R6AvatarConfig['outfitId']) ?? 'arctic-hoodie',
        hatId: (av.hatId as R6AvatarConfig['hatId']) ?? 'none',
        faceId: (av.faceId as R6AvatarConfig['faceId']) ?? 'classic-smile',
        skinColor: typeof av.skinColor === 'string' ? av.skinColor : '#FFE0C2',
      },
      role: String(r.role ?? 'player'),
      pinned_badge: typeof r.pinned_badge === 'string' ? r.pinned_badge : null,
    }
  })
}

export function formatSpeedrunTime(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return '--:--.--'
  const totalSec = Math.floor(ms / 1000)
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  const hundredths = Math.floor((ms % 1000) / 10)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`
}
