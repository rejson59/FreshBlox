import { isSupabaseConfigured, supabase } from './supabase'

export interface ClanInfo {
  id: string
  tag: string
  name: string
  accent_color: string
  invite_code: string
  owner_id: string
  created_at: string
}

export interface ClanMemberRow {
  user_id: string
  username: string
  fresh_tag: string
  role: 'leader' | 'officer' | 'member'
  xp: number
  obby_best_stage: number
  arena_eliminations: number
  arena_wins: number
  is_online: boolean
}

export interface ClanMessageRow {
  id: number
  clan_id: string
  sender_id: string
  sender_username: string
  content: string
  created_at: string
}

export interface MyClanBundle {
  clan: ClanInfo
  members: ClanMemberRow[]
  messages: ClanMessageRow[]
}

export type SeasonLeaderboardCategory = 'obby' | 'arena' | 'frisbee' | 'xp' | 'clans'

export interface SeasonalPlayerRow {
  id: string
  username: string
  fresh_tag: string
  clan_tag: string | null
  role: string
  pinned_badge: string | null
  xp: number
  arena_eliminations: number
  arena_wins: number
  arena_best_speed: number
  frisbee_wins: number
  frisbee_slices: number
  frisbee_catches: number
  obby_best_stage: number
  obby_best_time_ms: number | null
  is_online: boolean
}

export interface SeasonalClanRow {
  id: string
  tag: string
  name: string
  accent_color: string
  member_count: number
  total_xp: number
  total_elims: number
  total_wins: number
  score: number
}

export const CURRENT_SEASON = {
  number: 1,
  namePl: 'Sezon 1 — Era Portali',
  nameEn: 'Season 1 — Portal Era',
  endsLabelPl: 'Koniec sezonu: 31 Gru 2026',
  endsLabelEn: 'Season ends: Dec 31, 2026',
}

export async function fetchMyClan(): Promise<MyClanBundle | null> {
  if (!isSupabaseConfigured || !supabase) return null
  const { data, error } = await supabase.rpc('get_my_clan')
  if (error || !data) return null
  const bundle = data as Partial<MyClanBundle>
  if (!bundle.clan) return null
  return {
    clan: bundle.clan,
    members: Array.isArray(bundle.members) ? bundle.members : [],
    messages: Array.isArray(bundle.messages) ? bundle.messages : [],
  }
}

export async function createClan(
  tag: string,
  name: string,
  accentColor = '#38BDF8',
): Promise<{ ok: boolean; clan?: { id: string; tag: string; name: string; invite_code: string }; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: 'Chmura niedostępna' }
  const { data, error } = await supabase.rpc('create_clan', {
    p_tag: tag,
    p_name: name,
    p_color: accentColor,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, clan: data as { id: string; tag: string; name: string; invite_code: string } }
}

export async function joinClanByCode(
  codeOrTag: string,
): Promise<{ ok: boolean; clan?: { id: string; tag: string; name: string }; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: 'Chmura niedostępna' }
  const { data, error } = await supabase.rpc('join_clan_by_code', {
    p_invite_code: codeOrTag,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, clan: data as { id: string; tag: string; name: string } }
}

export async function leaveClan(): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: 'Chmura niedostępna' }
  const { error } = await supabase.rpc('leave_clan')
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function sendClanMessage(
  content: string,
): Promise<{ ok: boolean; message?: ClanMessageRow; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: 'Chmura niedostępna' }
  const { data, error } = await supabase.rpc('send_clan_message', { p_content: content })
  if (error) return { ok: false, error: error.message }
  return { ok: true, message: data as ClanMessageRow }
}

export async function fetchSeasonalLeaderboard(
  category: 'obby' | 'arena' | 'frisbee' | 'xp',
  limit?: number,
): Promise<SeasonalPlayerRow[]>
export async function fetchSeasonalLeaderboard(
  category: 'clans',
  limit?: number,
): Promise<SeasonalClanRow[]>
export async function fetchSeasonalLeaderboard(
  category: SeasonLeaderboardCategory,
  limit = 100,
): Promise<SeasonalPlayerRow[] | SeasonalClanRow[]> {
  if (!isSupabaseConfigured || !supabase) return []
  const { data, error } = await supabase.rpc('get_seasonal_leaderboard', {
    p_category: category,
    p_limit: limit,
  })
  if (error || !Array.isArray(data)) return []
  return data as SeasonalPlayerRow[] | SeasonalClanRow[]
}
