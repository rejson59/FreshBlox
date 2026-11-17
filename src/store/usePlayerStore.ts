import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BACK_CATALOG,
  BackId,
  DAILY_QUESTS,
  FaceId,
  GEMS_SYSTEM_IN_PROGRESS,
  HatId,
  OUTFIT_CATALOG,
  HAT_CATALOG,
  FACE_CATALOG,
  OutfitId,
  PET_CATALOG,
  PetId,
  QuestDef,
  R6AvatarConfig,
  TRAIL_CATALOG,
  TrailId,
  WorldKind,
} from '../data/catalog'
import { isSupabaseConfigured, supabase, supabaseAnonKey, supabaseUrl } from '../lib/supabase'
import {
  collectDeviceRegistrationProof,
  hasLocalDeviceRegisteredFlag,
  markDeviceRegisteredLocally,
} from '../lib/deviceGuard'

export interface FriendEntry {
  id: string
  friendUserId?: string
  username: string
  freshTag?: string
  status: 'online' | 'in-lobby' | 'offline'
  roomCode?: string
  world?: WorldKind
  obbyBestStage?: number
}

export interface SavedOutfitSlot {
  slot: number
  name: string
  avatar: R6AvatarConfig
}

export interface QuestProgressState {
  progress: Record<QuestDef['id'], number>
  claimed: Record<QuestDef['id'], boolean>
}

export type AccountRole = 'player' | 'moderator' | 'admin' | 'owner'

export function normalizeAccountRole(raw?: string | null): AccountRole {
  if (raw === 'owner' || raw === 'admin' || raw === 'moderator') return raw
  return 'player'
}

export function hasAdminAccess(role?: AccountRole | null): boolean {
  return role === 'owner' || role === 'admin'
}

export function getAccountRoleMeta(
  role: AccountRole,
  lang: 'pl' | 'en',
): { label: string; color: string; bg: string; border: string } {
  switch (role) {
    case 'owner':
      return {
        label: lang === 'pl' ? 'Właściciel' : 'Owner',
        color: '#FDE047',
        bg: 'rgba(245, 158, 11, 0.2)',
        border: 'rgba(250, 204, 21, 0.5)',
      }
    case 'admin':
      return {
        label: 'Admin',
        color: '#F472B6',
        bg: 'rgba(236, 72, 153, 0.18)',
        border: 'rgba(244, 114, 182, 0.45)',
      }
    case 'moderator':
      return {
        label: lang === 'pl' ? 'Moderator' : 'Mod',
        color: '#34D399',
        bg: 'rgba(16, 185, 129, 0.18)',
        border: 'rgba(52, 211, 153, 0.42)',
      }
    default:
      return {
        label: lang === 'pl' ? 'Gracz' : 'Player',
        color: '#94A3B8',
        bg: 'rgba(148, 163, 184, 0.12)',
        border: 'rgba(148, 163, 184, 0.25)',
      }
  }
}

export interface PlayerProfile {
  playerId: string
  username: string
  freshTag: string
  role: AccountRole
  clanId: string | null
  clanTag: string | null
  freshGems: number
  xp: number
  avatar: R6AvatarConfig
  unlockedOutfits: OutfitId[]
  unlockedHats: HatId[]
  unlockedFaces: FaceId[]
  unlockedTrails: TrailId[]
  unlockedBacks: BackId[]
  unlockedPets: PetId[]
  savedOutfits: SavedOutfitSlot[]
  badges: string[]
  pinnedBadge: string | null
  quests: QuestProgressState
  friends: FriendEntry[]
  obbyStage: number
  obbyBestStage: number
  obbyCompletions: number
  obbyBestTimeMs: number | null
  arenaEliminations: number
  arenaWins: number
  arenaBestSpeed: number
  frisbeeWins: number
  frisbeeSlices: number
  frisbeeCatches: number
}

export interface AuthUserInfo {
  id: string
  email: string | null
}

export interface CloudPlayerSummary {
  id: string
  username: string
  freshTag: string
  xp: number
  obbyBestStage: number
  obbyCompletions: number
  obbyBestTimeMs: number | null
  lastWorld: WorldKind
  lastRoom: string
  isOnline: boolean
}

export const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/

export function validateFreshBloxUsername(raw: string): { valid: boolean; clean: string } {
  const clean = raw.trim()
  return { valid: USERNAME_REGEX.test(clean), clean }
}

const STORAGE_KEY = 'freshblox_player_profile_v2'
const LEGACY_STORAGE_KEY = 'freshblox_player_profile_v1'

const DEFAULT_QUEST_PROGRESS: QuestProgressState = {
  progress: {
    q_obby: 0,
    q_chat: 0,
    q_emote: 0,
    q_jumppad: 0,
    q_tower: 0,
  },
  claimed: {
    q_obby: false,
    q_chat: false,
    q_emote: false,
    q_jumppad: false,
    q_tower: false,
  },
}

function createDefaultProfile(): PlayerProfile {
  const rnd = Math.floor(1000 + Math.random() * 8999)
  return {
    playerId: `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    username: `FreshPlayer${rnd.toString().slice(0, 2)}`,
    freshTag: `#FB-${rnd}`,
    role: 'player',
    clanId: null,
    clanTag: null,
    freshGems: 0,
    xp: 0,
    avatar: {
      outfitId: 'fresh-creator',
      faceId: 'fresh-smile',
      hatId: 'none',
      skinColor: '#FDE0B6',
      trailId: 'none',
      backId: 'none',
      petId: 'none',
    },
    unlockedOutfits: ['fresh-creator', 'classic-remaster'],
    unlockedHats: ['none'],
    unlockedFaces: ['fresh-smile', 'wink-pro'],
    unlockedTrails: TRAIL_CATALOG.filter((t) => !t.rewardOnly && t.price === 0).map((t) => t.id),
    unlockedBacks: BACK_CATALOG.filter((b) => !b.rewardOnly && b.price === 0).map((b) => b.id),
    unlockedPets: PET_CATALOG.filter((p) => !p.rewardOnly && p.price === 0).map((p) => p.id),
    savedOutfits: [],
    badges: ['pioneer'],
    pinnedBadge: null,
    quests: {
      progress: { ...DEFAULT_QUEST_PROGRESS.progress },
      claimed: { ...DEFAULT_QUEST_PROGRESS.claimed },
    },
    friends: [],
    obbyStage: 1,
    obbyBestStage: 1,
    obbyCompletions: 0,
    obbyBestTimeMs: null,
    arenaEliminations: 0,
    arenaWins: 0,
    arenaBestSpeed: 0,
    frisbeeWins: 0,
    frisbeeSlices: 0,
    frisbeeCatches: 0,
  }
}

function migrateOutfitId(id?: string): OutfitId {
  if (id === 'midnight-neon') return 'midnight-slate'
  if (OUTFIT_CATALOG.some((o) => o.id === id)) return id as OutfitId
  return 'fresh-creator'
}

function normalizeUnlocked(
  items: string[] | undefined,
  obbyCompleted = false,
  arenaWins = 0,
  arenaBestSpeed = 0,
  frisbeeWins = 0,
) {
  const set = new Set((items ?? []).map((x) => (x === 'midnight-neon' ? 'midnight-slate' : x)))
  const outfits = OUTFIT_CATALOG.filter((o) => (!o.rewardOnly && o.price === 0) || set.has(o.id)).map((o) => o.id)
  const hats = HAT_CATALOG.filter(
    (h) =>
      (!h.rewardOnly && h.price === 0) ||
      set.has(h.id) ||
      (h.rewardOnly === 'obby100' && obbyCompleted),
  ).map((h) => h.id)
  const faces = FACE_CATALOG.filter((f) => (!f.rewardOnly && f.price === 0) || set.has(f.id)).map((f) => f.id)
  const trails = TRAIL_CATALOG.filter(
    (t) =>
      (!t.rewardOnly && t.price === 0) ||
      set.has(t.id) ||
      (t.rewardOnly === 'arenaMeteor' && (arenaBestSpeed >= 95 || arenaWins >= 1)) ||
      (t.rewardOnly === 'frisbeeWin' && frisbeeWins >= 1),
  ).map((t) => t.id)
  const backs = BACK_CATALOG.filter(
    (b) =>
      (!b.rewardOnly && b.price === 0) ||
      set.has(b.id) ||
      (b.rewardOnly === 'arenaWin' && arenaWins >= 1),
  ).map((b) => b.id)
  const pets = PET_CATALOG.filter((p) => (!p.rewardOnly && p.price === 0) || set.has(p.id)).map((p) => p.id)
  return { outfits, hats, faces, trails, backs, pets }
}

function loadLocalProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return createDefaultProfile()
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>
    const def = createDefaultProfile()
    const obbyBestStage = Math.max(1, Math.min(100, Number(parsed.obbyBestStage) || 1))
    const obbyCompletions = Math.max(0, Number(parsed.obbyCompletions) || 0)
    const arenaWins = Math.max(0, Number(parsed.arenaWins) || 0)
    const arenaBestSpeed = Math.max(0, Number(parsed.arenaBestSpeed) || 0)
    const arenaEliminations = Math.max(0, Number(parsed.arenaEliminations) || 0)
    const frisbeeWins = Math.max(0, Number(parsed.frisbeeWins) || 0)
    const frisbeeSlices = Math.max(0, Number(parsed.frisbeeSlices) || 0)
    const frisbeeCatches = Math.max(0, Number(parsed.frisbeeCatches) || 0)
    const unlockedOutfits = Array.isArray(parsed.unlockedOutfits)
      ? Array.from(new Set(['fresh-creator', 'classic-remaster', ...parsed.unlockedOutfits.map((id) => migrateOutfitId(id))]))
      : def.unlockedOutfits
    const baseHats = Array.isArray(parsed.unlockedHats)
      ? (['none', ...parsed.unlockedHats] as HatId[])
      : [...def.unlockedHats]
    if (obbyBestStage >= 100 || obbyCompletions >= 1) {
      baseHats.push('obby-crown')
    }
    const unlockedHats = Array.from(new Set(baseHats)) as HatId[]
    const unlockedFaces = Array.isArray(parsed.unlockedFaces)
      ? Array.from(new Set(['fresh-smile', 'wink-pro', ...parsed.unlockedFaces])) as FaceId[]
      : def.unlockedFaces
    const unlockedTrails = Array.from(
      new Set([
        ...def.unlockedTrails,
        ...(Array.isArray(parsed.unlockedTrails) ? parsed.unlockedTrails : []),
        ...(arenaBestSpeed >= 95 || arenaWins >= 1 ? (['golden-meteor'] as TrailId[]) : []),
        ...(frisbeeWins >= 1 ? (['blaze-disc'] as TrailId[]) : []),
      ]),
    ) as TrailId[]
    const unlockedBacks = Array.from(
      new Set([
        ...def.unlockedBacks,
        ...(Array.isArray(parsed.unlockedBacks) ? parsed.unlockedBacks : []),
        ...(arenaWins >= 1 ? (['solar-halo-wings'] as BackId[]) : []),
      ]),
    ) as BackId[]
    const unlockedPets = Array.from(
      new Set([...def.unlockedPets, ...(Array.isArray(parsed.unlockedPets) ? parsed.unlockedPets : [])]),
    ) as PetId[]

    return {
      ...def,
      ...parsed,
      role: normalizeAccountRole(parsed.role),
      clanId: typeof parsed.clanId === 'string' ? parsed.clanId : null,
      clanTag: typeof parsed.clanTag === 'string' ? parsed.clanTag : null,
      freshGems: GEMS_SYSTEM_IN_PROGRESS ? 0 : (parsed.freshGems ?? 0),
      unlockedOutfits: unlockedOutfits as OutfitId[],
      unlockedHats,
      unlockedFaces,
      unlockedTrails,
      unlockedBacks,
      unlockedPets,
      avatar: {
        outfitId: migrateOutfitId(parsed.avatar?.outfitId),
        faceId: parsed.avatar?.faceId ?? def.avatar.faceId,
        hatId: parsed.avatar?.hatId ?? def.avatar.hatId,
        skinColor: parsed.avatar?.skinColor ?? def.avatar.skinColor,
        trailId: parsed.avatar?.trailId ?? 'none',
        backId: parsed.avatar?.backId ?? 'none',
        petId: parsed.avatar?.petId ?? 'none',
      },
      quests: {
        progress: { ...DEFAULT_QUEST_PROGRESS.progress, ...(parsed.quests?.progress ?? {}) },
        claimed: { ...DEFAULT_QUEST_PROGRESS.claimed, ...(parsed.quests?.claimed ?? {}) },
      },
      friends: Array.isArray(parsed.friends) ? parsed.friends : [],
      savedOutfits: Array.isArray(parsed.savedOutfits) ? parsed.savedOutfits.slice(0, 5) : [],
      badges: Array.isArray(parsed.badges) ? parsed.badges : def.badges,
      pinnedBadge: typeof parsed.pinnedBadge === 'string' ? parsed.pinnedBadge : null,
      obbyStage: Math.max(1, Math.min(100, Number(parsed.obbyStage) || 1)),
      obbyBestStage,
      obbyCompletions,
      obbyBestTimeMs: typeof parsed.obbyBestTimeMs === 'number' ? parsed.obbyBestTimeMs : null,
      arenaEliminations,
      arenaWins,
      arenaBestSpeed,
      frisbeeWins,
      frisbeeSlices,
      frisbeeCatches,
    }
  } catch {
    return createDefaultProfile()
  }
}

interface DbProfileRow {
  id: string
  username: string
  fresh_tag: string
  role?: string | null
  clan_id?: string | null
  clan_tag?: string | null
  fresh_gems: number
  xp: number
  avatar_config: Partial<R6AvatarConfig> | null
  unlocked_items: string[] | null
  saved_outfits?: SavedOutfitSlot[] | null
  badges: string[] | null
  pinned_badge?: string | null
  quests: Partial<QuestProgressState> | null
  obby_stage: number | null
  obby_best_stage: number | null
  obby_completions: number | null
  obby_best_time_ms: number | null
  arena_eliminations?: number | null
  arena_wins?: number | null
  arena_best_speed?: number | null
  frisbee_wins?: number | null
  frisbee_slices?: number | null
  frisbee_catches?: number | null
  last_world?: string | null
  last_room?: string | null
  last_seen?: string | null
}

function isRecentlyOnline(lastSeen?: string | null): boolean {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000
}

export function usePlayerStore() {
  const [profile, setProfile] = useState<PlayerProfile>(() => loadLocalProfile())
  const [authUser, setAuthUser] = useState<AuthUserInfo | null>(null)
  const [authLoading, setAuthLoading] = useState<boolean>(isSupabaseConfigured)
  const [cloudStatus, setCloudStatus] = useState<'guest' | 'syncing' | 'synced' | 'offline'>(
    isSupabaseConfigured ? 'guest' : 'offline',
  )

  const syncTimerRef = useRef<number | null>(null)
  const hydratedFromCloudRef = useRef<boolean>(false)
  const authUserRef = useRef<AuthUserInfo | null>(null)
  authUserRef.current = authUser

  // Save guest/cached profile locally
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    } catch {
      // ignore storage quota
    }
  }, [profile])

  const loadFriendsFromCloud = useCallback(async (userId: string): Promise<FriendEntry[]> => {
    if (!supabase) return []
    const { data: rows } = await supabase
      .from('fb_friendships')
      .select('id, friend_id, friend_username, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!rows || rows.length === 0) return []

    const usernames = rows.map((r) => r.friend_username)
    const { data: profilesData } = await supabase
      .from('fb_profiles')
      .select('id, username, fresh_tag, last_world, last_room, last_seen, obby_best_stage')
      .in('username', usernames)

    const byName = new Map<string, DbProfileRow>()
    for (const p of (profilesData ?? []) as unknown as DbProfileRow[]) {
      byName.set(p.username.toLowerCase(), p)
    }

    return rows.map((r) => {
      const matched = byName.get(r.friend_username.toLowerCase())
      const online = isRecentlyOnline(matched?.last_seen)
      return {
        id: r.id,
        friendUserId: matched?.id ?? r.friend_id ?? undefined,
        username: matched?.username ?? r.friend_username,
        freshTag: matched?.fresh_tag,
        status: online ? 'in-lobby' : 'offline',
        roomCode: matched?.last_room ?? 'PUBLIC-1',
        world: (matched?.last_world === 'obby'
          ? 'obby'
          : matched?.last_world === 'arena'
            ? 'arena'
            : 'lobby') as WorldKind,
        obbyBestStage: matched?.obby_best_stage ?? 1,
      }
    })
  }, [])

  const hydrateCloudProfile = useCallback(
    async (userId: string, email: string | null) => {
      if (!supabase) return
      setCloudStatus('syncing')
      try {
        let { data } = await supabase
          .from('fb_profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle<DbProfileRow>()

        // Wait briefly once if trigger just fired on brand new signup
        if (!data) {
          await new Promise((r) => setTimeout(r, 350))
          const retry = await supabase
            .from('fb_profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle<DbProfileRow>()
          data = retry.data
        }

        if (!data) {
          // Ensure profile row exists as safety fallback
          const rnd = Math.floor(1000 + Math.random() * 8999)
          const fallbackName = (email?.split('@')[0] ?? `FreshPlayer${rnd}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) || `Fresh${rnd}`
          const inserted = await supabase
            .from('fb_profiles')
            .upsert({
              id: userId,
              username: `${fallbackName}_${rnd}`,
              fresh_tag: `#FB-${rnd}`,
              fresh_gems: 0,
              xp: 0,
            })
            .select('*')
            .single<DbProfileRow>()
          data = inserted.data
        }

        if (data) {
          const obbyCompleted = (data.obby_best_stage ?? 1) >= 100 || (data.obby_completions ?? 0) >= 1
          const arenaWins = Math.max(0, data.arena_wins ?? 0)
          const arenaBestSpeed = Math.max(0, data.arena_best_speed ?? 0)
          const arenaEliminations = Math.max(0, data.arena_eliminations ?? 0)
          const frisbeeWins = Math.max(0, data.frisbee_wins ?? 0)
          const frisbeeSlices = Math.max(0, data.frisbee_slices ?? 0)
          const frisbeeCatches = Math.max(0, data.frisbee_catches ?? 0)
          const unlocked = normalizeUnlocked(
            data.unlocked_items ?? undefined,
            obbyCompleted,
            arenaWins,
            arenaBestSpeed,
            frisbeeWins,
          )
          const friends = await loadFriendsFromCloud(userId)

          hydratedFromCloudRef.current = true
          setProfile({
            playerId: data.id,
            username: data.username,
            freshTag: data.fresh_tag,
            role: normalizeAccountRole(data.role),
            clanId: data.clan_id ?? null,
            clanTag: data.clan_tag ?? null,
            freshGems: GEMS_SYSTEM_IN_PROGRESS ? 0 : (data.fresh_gems ?? 0),
            xp: data.xp ?? 0,
            avatar: {
              outfitId: migrateOutfitId(data.avatar_config?.outfitId),
              faceId: (data.avatar_config?.faceId as FaceId) ?? 'fresh-smile',
              hatId: (data.avatar_config?.hatId as HatId) ?? 'none',
              skinColor: data.avatar_config?.skinColor ?? '#FDE0B6',
              trailId: (data.avatar_config?.trailId as TrailId) ?? 'none',
              backId: (data.avatar_config?.backId as BackId) ?? 'none',
              petId: (data.avatar_config?.petId as PetId) ?? 'none',
            },
            unlockedOutfits: unlocked.outfits,
            unlockedHats: unlocked.hats,
            unlockedFaces: unlocked.faces,
            unlockedTrails: unlocked.trails,
            unlockedBacks: unlocked.backs,
            unlockedPets: unlocked.pets,
            savedOutfits: Array.isArray(data.saved_outfits) ? data.saved_outfits.slice(0, 5) : [],
            badges: Array.isArray(data.badges) && data.badges.length > 0 ? data.badges : ['pioneer'],
            pinnedBadge: typeof data.pinned_badge === 'string' ? data.pinned_badge : null,
            quests: {
              progress: { ...DEFAULT_QUEST_PROGRESS.progress, ...(data.quests?.progress ?? {}) },
              claimed: { ...DEFAULT_QUEST_PROGRESS.claimed, ...(data.quests?.claimed ?? {}) },
            },
            friends,
            obbyStage: Math.max(1, Math.min(100, data.obby_stage ?? 1)),
            obbyBestStage: Math.max(1, Math.min(100, data.obby_best_stage ?? 1)),
            obbyCompletions: Math.max(0, data.obby_completions ?? 0),
            obbyBestTimeMs: data.obby_best_time_ms ?? null,
            arenaEliminations,
            arenaWins,
            arenaBestSpeed,
            frisbeeWins,
            frisbeeSlices,
            frisbeeCatches,
          })
          setCloudStatus('synced')
        }
      } catch {
        setCloudStatus('offline')
      }
    },
    [loadFriendsFromCloud],
  )

  // Listen to Supabase Auth session
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthLoading(false)
      setCloudStatus('offline')
      return
    }

    let mounted = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (session?.user) {
        const info = { id: session.user.id, email: session.user.email ?? null }
        setAuthUser(info)
        void hydrateCloudProfile(info.id, info.email).finally(() => {
          if (mounted) setAuthLoading(false)
        })
      } else {
        setAuthUser(null)
        setCloudStatus('guest')
        setAuthLoading(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (session?.user) {
        const info = { id: session.user.id, email: session.user.email ?? null }
        if (event === 'SIGNED_IN' && !hydratedFromCloudRef.current) {
          void hydrateCloudProfile(info.id, info.email).finally(() => {
            if (mounted) setAuthUser(info)
          })
        } else {
          setAuthUser(info)
          if (!hydratedFromCloudRef.current) {
            void hydrateCloudProfile(info.id, info.email)
          }
        }
      } else {
        hydratedFromCloudRef.current = false
        setAuthUser(null)
        setCloudStatus('guest')
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [hydrateCloudProfile])

  // Debounced cloud sync whenever profile changes while signed in
  useEffect(() => {
    if (!authUser || !supabase || !hydratedFromCloudRef.current) return
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current)
    setCloudStatus('syncing')
    syncTimerRef.current = window.setTimeout(() => {
      if (!supabase || !authUserRef.current) return
      const unlockedItems = Array.from(
        new Set([
          ...profile.unlockedOutfits,
          ...profile.unlockedHats,
          ...profile.unlockedFaces,
          ...profile.unlockedTrails,
          ...profile.unlockedBacks,
          ...profile.unlockedPets,
        ]),
      )
      supabase
        .from('fb_profiles')
        .update({
          xp: profile.xp,
          avatar_config: profile.avatar,
          unlocked_items: unlockedItems,
          saved_outfits: profile.savedOutfits.slice(0, 5),
          badges: profile.badges,
          pinned_badge: profile.pinnedBadge,
          quests: profile.quests,
          obby_stage: profile.obbyStage,
          obby_best_stage: profile.obbyBestStage,
          obby_completions: profile.obbyCompletions,
          obby_best_time_ms: profile.obbyBestTimeMs,
          arena_eliminations: profile.arenaEliminations,
          arena_wins: profile.arenaWins,
          arena_best_speed: profile.arenaBestSpeed,
          frisbee_wins: profile.frisbeeWins,
          frisbee_slices: profile.frisbeeSlices,
          frisbee_catches: profile.frisbeeCatches,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', authUserRef.current.id)
        .then(({ error }) => {
          setCloudStatus(error ? 'offline' : 'synced')
        })
    }, 650)

    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current)
    }
  }, [
    authUser,
    profile.xp,
    profile.avatar,
    profile.unlockedOutfits,
    profile.unlockedHats,
    profile.unlockedFaces,
    profile.unlockedTrails,
    profile.unlockedBacks,
    profile.unlockedPets,
    profile.savedOutfits,
    profile.badges,
    profile.pinnedBadge,
    profile.quests,
    profile.obbyStage,
    profile.obbyBestStage,
    profile.obbyCompletions,
    profile.obbyBestTimeMs,
    profile.arenaEliminations,
    profile.arenaWins,
    profile.arenaBestSpeed,
    profile.frisbeeWins,
    profile.frisbeeSlices,
    profile.frisbeeCatches,
  ])

const REGISTER_API_PATH = '/api/register-account'

async function postRegisterApi(
  payload: Record<string, unknown>,
  retries = 1,
  timeoutMs = 15000,
): Promise<{ response?: Response; networkError?: boolean }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(REGISTER_API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      window.clearTimeout(timer)
      // Retry once on transient 502/503/504 gateway glitches
      if (attempt < retries && (response.status === 502 || response.status === 503 || response.status === 504)) {
        await new Promise((r) => window.setTimeout(r, 650))
        continue
      }
      return { response }
    } catch {
      window.clearTimeout(timer)
      if (attempt < retries) {
        await new Promise((r) => window.setTimeout(r, 650))
        continue
      }
      return { networkError: true }
    }
  }
  return { networkError: true }
}

  const checkDeviceRegistrationAllowed = useCallback(async (): Promise<boolean> => {
    const localBlocked = await hasLocalDeviceRegisteredFlag()
    if (localBlocked) return false
    if (!supabaseUrl || !supabaseAnonKey) return true

    try {
      const proof = await collectDeviceRegistrationProof()
      const { response } = await postRegisterApi(
        {
          action: 'check',
          deviceToken: proof.deviceToken,
          browserFp: proof.browserFp,
          coreHw: proof.coreHw,
        },
        0,
        8000,
      )
      if (!response) return true
      const json = (await response.json().catch(() => null)) as { ok?: boolean; allowed?: boolean } | null
      if (json && json.allowed === false) {
        await markDeviceRegisteredLocally()
        return false
      }
      return true
    } catch {
      return true
    }
  }, [])

  const signUp = useCallback(
    async (username: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      if (!supabase || !supabaseUrl || !supabaseAnonKey) {
        return { ok: false, error: 'SUPABASE_NOT_CONFIGURED' }
      }
      const { valid, clean } = validateFreshBloxUsername(username)
      if (!valid) return { ok: false, error: 'INVALID_USERNAME' }
      if (password.length < 6) return { ok: false, error: 'SHORT_PASSWORD' }

      // Fast local check before network roundtrip
      if (await hasLocalDeviceRegisteredFlag()) {
        return { ok: false, error: 'DEVICE_LIMIT_REACHED' }
      }

      const proof = await collectDeviceRegistrationProof()

      const { response: resp, networkError } = await postRegisterApi(
        {
          action: 'register',
          username: clean,
          password,
          deviceToken: proof.deviceToken,
          browserFp: proof.browserFp,
          coreHw: proof.coreHw,
        },
        1,
        15000,
      )

      if (networkError || !resp) {
        return { ok: false, error: 'NETWORK_ERROR' }
      }

      const json = (await resp.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        loginEmail?: string
      } | null

      if (!resp.ok || !json?.ok || !json.loginEmail) {
        const errCode = json?.error || (resp.status >= 500 ? 'SERVER_ERROR' : 'CREATE_USER_FAILED')
        if (errCode === 'DEVICE_LIMIT_REACHED') {
          await markDeviceRegisteredLocally()
        }
        return { ok: false, error: errCode }
      }

      // Lock device locally across all 4 storage layers right after server confirmation
      await markDeviceRegisteredLocally()

      // Immediately sign into the newly created account
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: json.loginEmail,
        password,
      })
      if (signInErr) {
        return { ok: false, error: signInErr.message }
      }
      if (signInData.user) {
        await hydrateCloudProfile(signInData.user.id, signInData.user.email ?? null)
        setAuthUser({ id: signInData.user.id, email: signInData.user.email ?? null })
      }
      return { ok: true }
    },
    [hydrateCloudProfile],
  )

  const signIn = useCallback(
    async (username: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      if (!supabase) return { ok: false, error: 'SUPABASE_NOT_CONFIGURED' }
      const clean = username.trim()
      if (clean.length < 2 || !password) {
        return { ok: false, error: 'INVALID_CREDENTIALS' }
      }

      try {
        // Resolve current username -> synthetic auth email via Postgres RPC
        const { data: resolvedEmail, error: resolveErr } = await supabase.rpc('resolve_freshblox_login_email', {
          p_username: clean,
        })
        if (resolveErr) {
          const msg = (resolveErr.message || '').toLowerCase()
          if (msg.includes('fetch') || msg.includes('network')) {
            return { ok: false, error: 'NETWORK_ERROR' }
          }
          return { ok: false, error: 'INVALID_CREDENTIALS' }
        }
        if (!resolvedEmail || typeof resolvedEmail !== 'string') {
          return { ok: false, error: 'INVALID_CREDENTIALS' }
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: resolvedEmail,
          password,
        })
        if (error) {
          const msg = (error.message || '').toLowerCase()
          if (msg.includes('fetch') || msg.includes('network')) {
            return { ok: false, error: 'NETWORK_ERROR' }
          }
          return { ok: false, error: 'INVALID_CREDENTIALS' }
        }
        if (data.user) {
          await hydrateCloudProfile(data.user.id, data.user.email ?? null)
          setAuthUser({ id: data.user.id, email: data.user.email ?? null })
        }
        return { ok: true }
      } catch {
        return { ok: false, error: 'NETWORK_ERROR' }
      }
    },
    [hydrateCloudProfile],
  )

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    hydratedFromCloudRef.current = false
    setAuthUser(null)
    setCloudStatus('guest')
    setProfile(createDefaultProfile())
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  const updatePresenceLocation = useCallback((world: WorldKind | 'launcher', roomCode: string) => {
    if (!supabase || !authUserRef.current) return
    void supabase
      .from('fb_profiles')
      .update({
        last_world: world,
        last_room: roomCode,
        last_seen: new Date().toISOString(),
      })
      .eq('id', authUserRef.current.id)
      .then(() => {})
  }, [])

  const setUsername = useCallback(async (name: string): Promise<{ ok: boolean; error?: string }> => {
    const { valid, clean } = validateFreshBloxUsername(name)
    if (!valid) {
      return {
        ok: false,
        error: '3–20 znaków: litery (A-Z), cyfry (0-9), _ lub -',
      }
    }

    if (supabase && authUserRef.current) {
      const { error } = await supabase
        .from('fb_profiles')
        .update({ username: clean, updated_at: new Date().toISOString() })
        .eq('id', authUserRef.current.id)
      if (error) {
        return { ok: false, error: error.code === '23505' ? 'Ten nick jest już zajęty!' : error.message }
      }
    }

    setProfile((p) => ({ ...p, username: clean }))
    return { ok: true }
  }, [])

  const updateAvatar = useCallback((patch: Partial<R6AvatarConfig>) => {
    setProfile((p) => ({ ...p, avatar: { ...p.avatar, ...patch } }))
  }, [])

  const awardGemsAndXp = useCallback((gems: number, xp: number) => {
    setProfile((p) => ({
      ...p,
      freshGems: GEMS_SYSTEM_IN_PROGRESS ? p.freshGems : p.freshGems + gems,
      xp: p.xp + xp,
    }))
  }, [])

  const unlockBadge = useCallback((badgeId: string) => {
    setProfile((p) => (p.badges.includes(badgeId) ? p : { ...p, badges: [...p.badges, badgeId] }))
  }, [])

  const incrementQuest = useCallback((questId: QuestDef['id'], delta = 1) => {
    setProfile((p) => {
      const def = DAILY_QUESTS.find((q) => q.id === questId)
      if (!def) return p
      const cur = p.quests.progress[questId] ?? 0
      const next = Math.min(def.target, cur + delta)
      if (next === cur) return p
      const badges = [...p.badges]
      if (questId === 'q_chat' && next >= 1 && !badges.includes('social')) badges.push('social')
      if (questId === 'q_emote' && next >= 2 && !badges.includes('dancer')) badges.push('dancer')
      if (questId === 'q_tower' && next >= 1 && !badges.includes('explorer')) badges.push('explorer')
      return {
        ...p,
        badges,
        quests: {
          ...p.quests,
          progress: { ...p.quests.progress, [questId]: next },
        },
      }
    })
  }, [])

  const claimQuest = useCallback((questId: QuestDef['id']): boolean => {
    let claimedNow = false
    setProfile((p) => {
      const def = DAILY_QUESTS.find((q) => q.id === questId)
      if (!def) return p
      if (p.quests.claimed[questId]) return p
      if ((p.quests.progress[questId] ?? 0) < def.target) return p
      claimedNow = true
      return {
        ...p,
        freshGems: GEMS_SYSTEM_IN_PROGRESS ? p.freshGems : p.freshGems + def.rewardGems,
        xp: p.xp + def.rewardXp,
        quests: {
          ...p.quests,
          claimed: { ...p.quests.claimed, [questId]: true },
        },
      }
    })
    return claimedNow
  }, [])

  const recordObbyStage = useCallback((stage: number, completionElapsedMs?: number) => {
    const clamped = Math.max(1, Math.min(100, Math.floor(stage)))
    setProfile((p) => {
      const gainedNewBest = clamped > p.obbyBestStage
      const stageDelta = gainedNewBest ? clamped - p.obbyBestStage : 0
      const isFinish = clamped === 100 && p.obbyStage < 100

      const badges = [...p.badges]
      if (clamped >= 10 && !badges.includes('obby_runner')) badges.push('obby_runner')
      if (clamped >= 100 && !badges.includes('obby_master')) badges.push('obby_master')

      // Unlock the exclusive Obby 100 Champion Crown upon reaching Stage 100!
      const unlockedHats =
        clamped >= 100 && !p.unlockedHats.includes('obby-crown')
          ? ([...p.unlockedHats, 'obby-crown'] as HatId[])
          : p.unlockedHats

      const qDef = DAILY_QUESTS.find((q) => q.id === 'q_obby')
      const curQ = p.quests.progress.q_obby ?? 0
      const nextQ = qDef ? Math.min(qDef.target, curQ + (stageDelta > 0 ? stageDelta : clamped > p.obbyStage ? 1 : 0)) : curQ

      let nextBestTime = p.obbyBestTimeMs
      if (isFinish && typeof completionElapsedMs === 'number' && completionElapsedMs > 1000) {
        if (nextBestTime === null || completionElapsedMs < nextBestTime) {
          nextBestTime = Math.round(completionElapsedMs)
        }
      }

      const bonusXp = (gainedNewBest ? stageDelta * 12 : 0) + (isFinish ? 200 : 0)

      return {
        ...p,
        obbyStage: clamped,
        obbyBestStage: Math.max(p.obbyBestStage, clamped),
        obbyCompletions: isFinish ? p.obbyCompletions + 1 : p.obbyCompletions,
        obbyBestTimeMs: nextBestTime,
        xp: p.xp + bonusXp,
        badges,
        unlockedHats,
        quests: {
          ...p.quests,
          progress: { ...p.quests.progress, q_obby: nextQ },
        },
      }
    })
  }, [])

  const setObbyCurrentStage = useCallback((stage: number) => {
    setProfile((p) => {
      const clamped = Math.max(1, Math.min(p.obbyBestStage, Math.floor(stage)))
      if (clamped === p.obbyStage) return p
      return { ...p, obbyStage: clamped }
    })
  }, [])

  const buyAndEquip = useCallback(
    (category: 'outfit' | 'hat' | 'face' | 'trail' | 'back' | 'pet', itemId: string, price: number): boolean => {
      let ok = false
      setProfile((p) => {
        const listKey =
          category === 'outfit'
            ? 'unlockedOutfits'
            : category === 'hat'
              ? 'unlockedHats'
              : category === 'face'
                ? 'unlockedFaces'
                : category === 'trail'
                  ? 'unlockedTrails'
                  : category === 'back'
                    ? 'unlockedBacks'
                    : 'unlockedPets'
        const currentList = p[listKey] as string[]
        const catalogDef =
          category === 'outfit'
            ? OUTFIT_CATALOG.find((x) => x.id === itemId)
            : category === 'hat'
              ? HAT_CATALOG.find((x) => x.id === itemId)
              : category === 'face'
                ? FACE_CATALOG.find((x) => x.id === itemId)
                : category === 'trail'
                  ? TRAIL_CATALOG.find((x) => x.id === itemId)
                  : category === 'back'
                    ? BACK_CATALOG.find((x) => x.id === itemId)
                    : PET_CATALOG.find((x) => x.id === itemId)
        const isRewardOnly = Boolean(catalogDef?.rewardOnly)
        const alreadyOwned = currentList.includes(itemId) || (!isRewardOnly && price === 0)

        // Milestone-only rewards (like Obby 100 Crown or Arena Wings) cannot be bought before unlocking!
        if (isRewardOnly && !alreadyOwned) {
          return p
        }

        // While FreshGems economy is under construction, only owned/free items can be equipped!
        if (!alreadyOwned && (GEMS_SYSTEM_IN_PROGRESS || p.freshGems < price)) {
          return p
        }

        ok = true
        const nextAvatar: R6AvatarConfig = {
          ...p.avatar,
          ...(category === 'outfit' ? { outfitId: itemId as OutfitId } : {}),
          ...(category === 'hat' ? { hatId: itemId as HatId } : {}),
          ...(category === 'face' ? { faceId: itemId as FaceId } : {}),
          ...(category === 'trail' ? { trailId: itemId as TrailId } : {}),
          ...(category === 'back' ? { backId: itemId as BackId } : {}),
          ...(category === 'pet' ? { petId: itemId as PetId } : {}),
        }

        return {
          ...p,
          freshGems: alreadyOwned ? p.freshGems : p.freshGems - price,
          avatar: nextAvatar,
          [listKey]: currentList.includes(itemId) ? currentList : [...currentList, itemId],
        }
      })
      return ok
    },
    [],
  )

  const buyBundle = useCallback(
    (items: Array<{ category: 'outfit' | 'hat' | 'face'; id: string; price: number }>): boolean => {
      if (items.length === 0 || GEMS_SYSTEM_IN_PROGRESS) return false
      let ok = false
      setProfile((p) => {
        let totalCost = 0
        const toBuy = items.filter((item) => {
          const catalogDef =
            item.category === 'outfit'
              ? OUTFIT_CATALOG.find((x) => x.id === item.id)
              : item.category === 'hat'
                ? HAT_CATALOG.find((x) => x.id === item.id)
                : FACE_CATALOG.find((x) => x.id === item.id)
          if (catalogDef?.rewardOnly) return false
          const listKey =
            item.category === 'outfit'
              ? 'unlockedOutfits'
              : item.category === 'hat'
                ? 'unlockedHats'
                : 'unlockedFaces'
          const owned = (p[listKey] as string[]).includes(item.id)
          if (!owned) totalCost += item.price
          return !owned
        })
        if (toBuy.length === 0 || p.freshGems < totalCost) return p

        ok = true
        let unlockedOutfits = [...p.unlockedOutfits]
        let unlockedHats = [...p.unlockedHats]
        let unlockedFaces = [...p.unlockedFaces]
        const nextAvatar: R6AvatarConfig = { ...p.avatar }

        for (const item of toBuy) {
          if (item.category === 'outfit') {
            unlockedOutfits = [...unlockedOutfits, item.id as OutfitId]
            nextAvatar.outfitId = item.id as OutfitId
          } else if (item.category === 'hat') {
            unlockedHats = [...unlockedHats, item.id as HatId]
            nextAvatar.hatId = item.id as HatId
          } else if (item.category === 'face') {
            unlockedFaces = [...unlockedFaces, item.id as FaceId]
            nextAvatar.faceId = item.id as FaceId
          }
        }

        return {
          ...p,
          freshGems: p.freshGems - totalCost,
          avatar: nextAvatar,
          unlockedOutfits,
          unlockedHats,
          unlockedFaces,
        }
      })
      return ok
    },
    [],
  )

  const addFriend = useCallback(
    async (usernameOrTag: string): Promise<{ ok: boolean; error?: string }> => {
      const clean = usernameOrTag.trim().slice(0, 20)
      if (!clean) return { ok: false }

      if (supabase && authUserRef.current) {
        const isTag = clean.startsWith('#')
        const { data: found } = isTag
          ? await supabase
              .from('fb_profiles')
              .select('id, username, fresh_tag, last_world, last_room, last_seen, obby_best_stage')
              .ilike('fresh_tag', clean)
              .maybeSingle<DbProfileRow>()
          : await supabase
              .from('fb_profiles')
              .select('id, username, fresh_tag, last_world, last_room, last_seen, obby_best_stage')
              .ilike('username', clean)
              .maybeSingle<DbProfileRow>()

        const targetName = found?.username ?? clean
        if (found?.id === authUserRef.current.id) {
          return { ok: false, error: 'Nie możesz dodać samego siebie!' }
        }

        await supabase.from('fb_friendships').upsert(
          {
            user_id: authUserRef.current.id,
            friend_id: found?.id ?? null,
            friend_username: targetName,
            status: 'accepted',
          },
          { onConflict: 'user_id,friend_username' },
        )

        const refreshed = await loadFriendsFromCloud(authUserRef.current.id)
        setProfile((p) => ({ ...p, friends: refreshed }))
        return { ok: true }
      }

      setProfile((p) => {
        if (p.friends.some((f) => f.username.toLowerCase() === clean.toLowerCase())) return p
        return {
          ...p,
          friends: [
            { id: `fr_${Date.now()}`, username: clean, status: 'online', roomCode: 'PUBLIC-1', world: 'lobby' },
            ...p.friends,
          ],
        }
      })
      return { ok: true }
    },
    [loadFriendsFromCloud],
  )

  const refreshFriends = useCallback(async () => {
    if (!authUserRef.current) return
    const list = await loadFriendsFromCloud(authUserRef.current.id)
    setProfile((p) => ({ ...p, friends: list }))
  }, [loadFriendsFromCloud])

  const searchPlayers = useCallback(async (query: string): Promise<CloudPlayerSummary[]> => {
    if (!supabase) return []
    const q = query.trim()
    let req = supabase
      .from('fb_profiles')
      .select('id, username, fresh_tag, xp, obby_best_stage, obby_completions, obby_best_time_ms, last_world, last_room, last_seen')
      .order('last_seen', { ascending: false })
      .limit(12)

    if (q) {
      req = req.ilike('username', `%${q}%`)
    }

    const { data } = await req
    return ((data ?? []) as unknown as DbProfileRow[]).map((r) => ({
      id: r.id,
      username: r.username,
      freshTag: r.fresh_tag,
      xp: r.xp ?? 0,
      obbyBestStage: r.obby_best_stage ?? 1,
      obbyCompletions: r.obby_completions ?? 0,
      obbyBestTimeMs: r.obby_best_time_ms ?? null,
      lastWorld: (r.last_world === 'obby' ? 'obby' : r.last_world === 'arena' ? 'arena' : 'lobby') as WorldKind,
      lastRoom: r.last_room ?? 'PUBLIC-1',
      isOnline: isRecentlyOnline(r.last_seen),
    }))
  }, [])

  const fetchObbyLeaderboard = useCallback(async (): Promise<CloudPlayerSummary[]> => {
    if (!supabase) return []
    const { data } = await supabase
      .from('fb_profiles')
      .select('id, username, fresh_tag, xp, obby_best_stage, obby_completions, obby_best_time_ms, last_world, last_room, last_seen')
      .order('obby_best_stage', { ascending: false })
      .order('obby_completions', { ascending: false })
      .order('xp', { ascending: false })
      .limit(8)

    return ((data ?? []) as unknown as DbProfileRow[]).map((r) => ({
      id: r.id,
      username: r.username,
      freshTag: r.fresh_tag,
      xp: r.xp ?? 0,
      obbyBestStage: r.obby_best_stage ?? 1,
      obbyCompletions: r.obby_completions ?? 0,
      obbyBestTimeMs: r.obby_best_time_ms ?? null,
      lastWorld: (r.last_world === 'obby' ? 'obby' : r.last_world === 'arena' ? 'arena' : 'lobby') as WorldKind,
      lastRoom: r.last_room ?? 'PUBLIC-1',
      isOnline: isRecentlyOnline(r.last_seen),
    }))
  }, [])

  const saveOutfitSlot = useCallback((slot: number, name: string, avatarCfg: R6AvatarConfig) => {
    const cleanSlot = Math.max(1, Math.min(5, slot))
    const cleanName = name.trim().slice(0, 22) || `Zestaw #${cleanSlot}`
    setProfile((p) => {
      const filtered = p.savedOutfits.filter((s) => s.slot !== cleanSlot)
      const next = [...filtered, { slot: cleanSlot, name: cleanName, avatar: { ...avatarCfg } }].sort(
        (a, b) => a.slot - b.slot,
      )
      return { ...p, savedOutfits: next }
    })
  }, [])

  const deleteOutfitSlot = useCallback((slot: number) => {
    setProfile((p) => ({
      ...p,
      savedOutfits: p.savedOutfits.filter((s) => s.slot !== slot),
    }))
  }, [])

  const setPinnedBadge = useCallback((badgeId: string | null) => {
    setProfile((p) => ({ ...p, pinnedBadge: badgeId }))
  }, [])

  const recordObbySpeedrun = useCallback((elapsedMs: number) => {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 5000) return
    const rounded = Math.round(elapsedMs)
    setProfile((p) => {
      const isNewPb = p.obbyBestTimeMs === null || rounded < p.obbyBestTimeMs
      const badges = new Set(p.badges)
      if (rounded <= 10 * 60 * 1000) badges.add('speedrunner')
      return {
        ...p,
        obbyBestTimeMs: isNewPb ? rounded : p.obbyBestTimeMs,
        badges: Array.from(badges),
      }
    })
  }, [])

  const recordArenaProgress = useCallback(
    (opts: { eliminationsDelta?: number; win?: boolean; peakSpeedKmh?: number; meteorKill?: boolean }) => {
      const elimsDelta = Math.max(0, Math.floor(opts.eliminationsDelta ?? 0))
      const peak = Math.max(0, Math.round(opts.peakSpeedKmh ?? 0))
      setProfile((p) => {
        const nextElims = p.arenaEliminations + elimsDelta
        const nextWins = p.arenaWins + (opts.win ? 1 : 0)
        const nextBestSpeed = Math.max(p.arenaBestSpeed, peak)
        const badges = new Set(p.badges)
        const unlockedTrails = new Set(p.unlockedTrails)
        const unlockedBacks = new Set(p.unlockedBacks)

        if (opts.meteorKill || nextBestSpeed >= 98) {
          badges.add('arena_meteor')
          unlockedTrails.add('golden-meteor')
        }
        if (opts.win) {
          badges.add('arena_winner')
          unlockedBacks.add('solar-halo-wings')
        }

        const bonusXp = elimsDelta * 25 + (opts.win ? 140 : 0)
        return {
          ...p,
          arenaEliminations: nextElims,
          arenaWins: nextWins,
          arenaBestSpeed: nextBestSpeed,
          xp: p.xp + bonusXp,
          badges: Array.from(badges),
          unlockedTrails: Array.from(unlockedTrails) as TrailId[],
          unlockedBacks: Array.from(unlockedBacks) as BackId[],
        }
      })
    },
    [],
  )

  const recordFrisbeeProgress = useCallback(
    (opts: { slicesDelta?: number; catchesDelta?: number; matchWin?: boolean; trickSlice?: boolean }) => {
      const slicesDelta = Math.max(0, Math.floor(opts.slicesDelta ?? 0))
      const catchesDelta = Math.max(0, Math.floor(opts.catchesDelta ?? 0))
      setProfile((p) => {
        const nextSlices = p.frisbeeSlices + slicesDelta
        const nextCatches = p.frisbeeCatches + catchesDelta
        const nextWins = p.frisbeeWins + (opts.matchWin ? 1 : 0)
        const badges = new Set(p.badges)
        const unlockedTrails = new Set(p.unlockedTrails)

        if (opts.matchWin) {
          badges.add('frisbee_king')
          unlockedTrails.add('blaze-disc')
        }
        if (opts.trickSlice || nextCatches >= 3) {
          badges.add('frisbee_trick')
        }

        const bonusXp = slicesDelta * 30 + catchesDelta * 12 + (opts.matchWin ? 160 : 0)
        return {
          ...p,
          frisbeeSlices: nextSlices,
          frisbeeCatches: nextCatches,
          frisbeeWins: nextWins,
          xp: p.xp + bonusXp,
          badges: Array.from(badges),
          unlockedTrails: Array.from(unlockedTrails) as TrailId[],
        }
      })
    },
    [],
  )

  const setClanInfo = useCallback((clanId: string | null, clanTag: string | null) => {
    setProfile((p) => ({ ...p, clanId, clanTag }))
  }, [])

  const refreshProfile = useCallback(async () => {
    const user = authUserRef.current
    if (!user) return
    await hydrateCloudProfile(user.id, user.email)
  }, [hydrateCloudProfile])

  return {
    profile,
    authUser,
    authLoading,
    cloudStatus,
    checkDeviceRegistrationAllowed,
    signUp,
    signIn,
    signOut,
    refreshProfile,
    updatePresenceLocation,
    setUsername,
    updateAvatar,
    awardGemsAndXp,
    unlockBadge,
    setPinnedBadge,
    saveOutfitSlot,
    deleteOutfitSlot,
    recordObbySpeedrun,
    recordArenaProgress,
    recordFrisbeeProgress,
    setClanInfo,
    incrementQuest,
    claimQuest,
    recordObbyStage,
    setObbyCurrentStage,
    buyAndEquip,
    buyBundle,
    addFriend,
    refreshFriends,
    searchPlayers,
    fetchObbyLeaderboard,
  }
}
