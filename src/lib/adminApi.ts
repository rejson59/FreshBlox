import { supabase } from './supabase'
import { AccountRole, normalizeAccountRole } from '../store/usePlayerStore'

export interface AdminPlatformStats {
  total_players: number
  online_players: number
  total_feedback: number
  new_feedback: number
  obby_100_clears: number
  device_locks: number
}

export interface AdminPlayerRow {
  id: string
  username: string
  fresh_tag: string
  role: AccountRole
  xp: number
  obby_stage: number
  obby_best_stage: number
  obby_completions: number
  last_world: string | null
  last_room: string | null
  last_seen: string | null
  updated_at: string | null
}

export type AdminFeedbackStatus = 'new' | 'reviewing' | 'planned' | 'done'

export interface AdminFeedbackRow {
  id: string
  user_id: string
  username: string
  kind: 'bug' | 'idea'
  title: string
  description: string
  context: string | null
  device_info: string | null
  status: AdminFeedbackStatus
  upvotes: number
  created_at: string
}

export async function fetchAdminPlatformStats(): Promise<{ data: AdminPlatformStats | null; error?: string }> {
  if (!supabase) return { data: null, error: 'Supabase offline' }
  const { data, error } = await supabase.rpc('admin_platform_stats')
  if (error) return { data: null, error: error.message }
  return { data: data as AdminPlatformStats }
}

export async function fetchAdminPlayers(search = ''): Promise<{ data: AdminPlayerRow[]; error?: string }> {
  if (!supabase) return { data: [], error: 'Supabase offline' }
  const { data, error } = await supabase.rpc('admin_list_players', {
    p_search: search,
    p_limit: 80,
  })
  if (error) return { data: [], error: error.message }
  const rows = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    username: String(r.username ?? ''),
    fresh_tag: String(r.fresh_tag ?? ''),
    role: normalizeAccountRole(String(r.role ?? 'player')),
    xp: Number(r.xp ?? 0),
    obby_stage: Number(r.obby_stage ?? 1),
    obby_best_stage: Number(r.obby_best_stage ?? 1),
    obby_completions: Number(r.obby_completions ?? 0),
    last_world: r.last_world ? String(r.last_world) : null,
    last_room: r.last_room ? String(r.last_room) : null,
    last_seen: r.last_seen ? String(r.last_seen) : null,
    updated_at: r.updated_at ? String(r.updated_at) : null,
  }))
  return { data: rows }
}

export async function setAdminPlayerRole(
  targetId: string,
  newRole: AccountRole,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase offline' }
  const { error } = await supabase.rpc('admin_update_player_role', {
    p_target_id: targetId,
    p_new_role: newRole,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function adjustAdminPlayer(
  targetId: string,
  patch: { xp?: number; obbyStage?: number; obbyBestStage?: number },
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase offline' }
  const { error } = await supabase.rpc('admin_adjust_player', {
    p_target_id: targetId,
    p_xp: patch.xp ?? null,
    p_obby_stage: patch.obbyStage ?? null,
    p_obby_best_stage: patch.obbyBestStage ?? null,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function fetchAdminFeedback(): Promise<{ data: AdminFeedbackRow[]; error?: string }> {
  if (!supabase) return { data: [], error: 'Supabase offline' }
  const { data, error } = await supabase.rpc('admin_list_feedback', { p_limit: 120 })
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as AdminFeedbackRow[] }
}

export async function setAdminFeedbackStatus(
  feedbackId: string,
  status: AdminFeedbackStatus,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase offline' }
  const { error } = await supabase.rpc('admin_update_feedback_status', {
    p_feedback_id: feedbackId,
    p_status: status,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deleteAdminFeedback(feedbackId: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase offline' }
  const { error } = await supabase.rpc('admin_delete_feedback', {
    p_feedback_id: feedbackId,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export interface WorldLiveStats {
  lobby_online: number
  obby_online: number
  platform_online: number
  total_players: number
  obby_100_clears: number
  obby_total_completions: number
}

export async function fetchWorldLiveStats(): Promise<WorldLiveStats | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('get_world_live_stats')
  if (error || !data) return null
  const raw = data as Partial<WorldLiveStats>
  return {
    lobby_online: Number(raw.lobby_online ?? 0),
    obby_online: Number(raw.obby_online ?? 0),
    platform_online: Number(raw.platform_online ?? 0),
    total_players: Number(raw.total_players ?? 0),
    obby_100_clears: Number(raw.obby_100_clears ?? 0),
    obby_total_completions: Number(raw.obby_total_completions ?? 0),
  }
}

