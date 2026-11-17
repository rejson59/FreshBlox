import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DAILY_QUESTS,
  FaceId,
  GEMS_SYSTEM_IN_PROGRESS,
  HatId,
  OUTFIT_CATALOG,
  HAT_CATALOG,
  FACE_CATALOG,
  OutfitId,
  QuestDef,
  R6AvatarConfig,
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
  username: string
  freshTag?: string
  status: 'online' | 'in-lobby' | 'offline'
  roomCode?: string
  world?: WorldKind
  obbyBestStage?: number
}

export interface QuestProgressState {
  progress: Record<QuestDef['id'], number>
  claimed: Record<QuestDef['id'], boolean>
}

export interface PlayerProfile {
  playerId: string
  username: string
  freshTag: string
  freshGems: number
  xp: number
  avatar: R6AvatarConfig
  unlockedOutfits: OutfitId[]
  unlockedHats: HatId[]
  unlockedFaces: FaceId[]
  badges: string[]
  quests: QuestProgressState
  friends: FriendEntry[]
  obbyStage: number
  obbyBestStage: number
  obbyCompletions: number
  obbyBestTimeMs: number | null
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
    freshGems: 0,
    xp: 0,
    avatar: {
      outfitId: 'fresh-creator',
      faceId: 'fresh-smile',
      hatId: 'none',
      skinColor: '#FDE0B6',
    },
    unlockedOutfits: ['fresh-creator', 'classic-remaster'],
    unlockedHats: ['none'],
    unlockedFaces: ['fresh-smile', 'wink-pro'],
    badges: ['pioneer'],
    quests: {
      progress: { ...DEFAULT_QUEST_PROGRESS.progress },
      claimed: { ...DEFAULT_QUEST_PROGRESS.claimed },
    },
    friends: [],
    obbyStage: 1,
    obbyBestStage: 1,
    obbyCompletions: 0,
    obbyBestTimeMs: null,
  }
}

function migrateOutfitId(id?: string): OutfitId {
  if (id === 'midnight-neon') return 'midnight-slate'
  if (OUTFIT_CATALOG.some((o) => o.id === id)) return id as OutfitId
  return 'fresh-creator'
}

function normalizeUnlocked(items: string[] | undefined) {
  const set = new Set((items ?? []).map((x) => (x === 'midnight-neon' ? 'midnight-slate' : x)))
  const outfits = OUTFIT_CATALOG.filter((o) => o.price === 0 || set.has(o.id)).map((o) => o.id)
  const hats = HAT_CATALOG.filter((h) => h.price === 0 || set.has(h.id)).map((h) => h.id)
  const faces = FACE_CATALOG.filter((f) => f.price === 0 || set.has(f.id)).map((f) => f.id)
  return { outfits, hats, faces }
}

function loadLocalProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return createDefaultProfile()
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>
    const def = createDefaultProfile()
    const unlockedOutfits = Array.isArray(parsed.unlockedOutfits)
      ? Array.from(new Set(['fresh-creator', 'classic-remaster', ...parsed.unlockedOutfits.map((id) => migrateOutfitId(id))]))
      : def.unlockedOutfits
    const unlockedHats = Array.isArray(parsed.unlockedHats)
      ? Array.from(new Set(['none', ...parsed.unlockedHats])) as HatId[]
      : def.unlockedHats
    const unlockedFaces = Array.isArray(parsed.unlockedFaces)
      ? Array.from(new Set(['fresh-smile', 'wink-pro', ...parsed.unlockedFaces])) as FaceId[]
      : def.unlockedFaces

    return {
      ...def,
      ...parsed,
      freshGems: GEMS_SYSTEM_IN_PROGRESS ? 0 : (parsed.freshGems ?? 0),
      unlockedOutfits: unlockedOutfits as OutfitId[],
      unlockedHats,
      unlockedFaces,
      avatar: {
        outfitId: migrateOutfitId(parsed.avatar?.outfitId),
        faceId: parsed.avatar?.faceId ?? def.avatar.faceId,
        hatId: parsed.avatar?.hatId ?? def.avatar.hatId,
        skinColor: parsed.avatar?.skinColor ?? def.avatar.skinColor,
      },
      quests: {
        progress: { ...DEFAULT_QUEST_PROGRESS.progress, ...(parsed.quests?.progress ?? {}) },
        claimed: { ...DEFAULT_QUEST_PROGRESS.claimed, ...(parsed.quests?.claimed ?? {}) },
      },
      friends: Array.isArray(parsed.friends) ? parsed.friends : [],
      badges: Array.isArray(parsed.badges) ? parsed.badges : def.badges,
      obbyStage: Math.max(1, Math.min(100, Number(parsed.obbyStage) || 1)),
      obbyBestStage: Math.max(1, Math.min(100, Number(parsed.obbyBestStage) || 1)),
      obbyCompletions: Math.max(0, Number(parsed.obbyCompletions) || 0),
      obbyBestTimeMs: typeof parsed.obbyBestTimeMs === 'number' ? parsed.obbyBestTimeMs : null,
    }
  } catch {
    return createDefaultProfile()
  }
}

interface DbProfileRow {
  id: string
  username: string
  fresh_tag: string
  fresh_gems: number
  xp: number
  avatar_config: Partial<R6AvatarConfig> | null
  unlocked_items: string[] | null
  badges: string[] | null
  quests: Partial<QuestProgressState> | null
  obby_stage: number | null
  obby_best_stage: number | null
  obby_completions: number | null
  obby_best_time_ms: number | null
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
        username: matched?.username ?? r.friend_username,
        freshTag: matched?.fresh_tag,
        status: online ? 'in-lobby' : 'offline',
        roomCode: matched?.last_room ?? 'PUBLIC-1',
        world: (matched?.last_world === 'obby' ? 'obby' : 'lobby') as WorldKind,
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
          const unlocked = normalizeUnlocked(data.unlocked_items ?? undefined)
          const friends = await loadFriendsFromCloud(userId)

          hydratedFromCloudRef.current = true
          setProfile({
            playerId: data.id,
            username: data.username,
            freshTag: data.fresh_tag,
            freshGems: GEMS_SYSTEM_IN_PROGRESS ? 0 : (data.fresh_gems ?? 0),
            xp: data.xp ?? 0,
            avatar: {
              outfitId: migrateOutfitId(data.avatar_config?.outfitId),
              faceId: (data.avatar_config?.faceId as FaceId) ?? 'fresh-smile',
              hatId: (data.avatar_config?.hatId as HatId) ?? 'none',
              skinColor: data.avatar_config?.skinColor ?? '#FDE0B6',
            },
            unlockedOutfits: unlocked.outfits,
            unlockedHats: unlocked.hats,
            unlockedFaces: unlocked.faces,
            badges: Array.isArray(data.badges) && data.badges.length > 0 ? data.badges : ['pioneer'],
            quests: {
              progress: { ...DEFAULT_QUEST_PROGRESS.progress, ...(data.quests?.progress ?? {}) },
              claimed: { ...DEFAULT_QUEST_PROGRESS.claimed, ...(data.quests?.claimed ?? {}) },
            },
            friends,
            obbyStage: Math.max(1, Math.min(100, data.obby_stage ?? 1)),
            obbyBestStage: Math.max(1, Math.min(100, data.obby_best_stage ?? 1)),
            obbyCompletions: Math.max(0, data.obby_completions ?? 0),
            obbyBestTimeMs: data.obby_best_time_ms ?? null,
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
        new Set([...profile.unlockedOutfits, ...profile.unlockedHats, ...profile.unlockedFaces]),
      )
      supabase
        .from('fb_profiles')
        .update({
          xp: profile.xp,
          avatar_config: profile.avatar,
          unlocked_items: unlockedItems,
          badges: profile.badges,
          quests: profile.quests,
          obby_stage: profile.obbyStage,
          obby_best_stage: profile.obbyBestStage,
          obby_completions: profile.obbyCompletions,
          obby_best_time_ms: profile.obbyBestTimeMs,
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
    profile.badges,
    profile.quests,
    profile.obbyStage,
    profile.obbyBestStage,
    profile.obbyCompletions,
    profile.obbyBestTimeMs,
  ])

  const checkDeviceRegistrationAllowed = useCallback(async (): Promise<boolean> => {
    const localBlocked = await hasLocalDeviceRegisteredFlag()
    if (localBlocked) return false
    if (!supabaseUrl || !supabaseAnonKey) return true

    try {
      const proof = await collectDeviceRegistrationProof()
      const res = await fetch(`${supabaseUrl}/functions/v1/register-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          action: 'check',
          deviceToken: proof.deviceToken,
          browserFp: proof.browserFp,
          coreHw: proof.coreHw,
        }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; allowed?: boolean } | null
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

      let resp: Response
      try {
        resp = await fetch(`${supabaseUrl}/functions/v1/register-account`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            action: 'register',
            username: clean,
            password,
            deviceToken: proof.deviceToken,
            browserFp: proof.browserFp,
            coreHw: proof.coreHw,
          }),
        })
      } catch {
        return { ok: false, error: 'NETWORK_ERROR' }
      }

      const json = (await resp.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        loginEmail?: string
      } | null

      if (!resp.ok || !json?.ok || !json.loginEmail) {
        const errCode = json?.error || 'SERVER_ERROR'
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

      // Resolve current username -> synthetic auth email via Postgres RPC
      const { data: resolvedEmail, error: resolveErr } = await supabase.rpc('resolve_freshblox_login_email', {
        p_username: clean,
      })
      if (resolveErr || !resolvedEmail || typeof resolvedEmail !== 'string') {
        return { ok: false, error: 'INVALID_CREDENTIALS' }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      })
      if (error) return { ok: false, error: 'INVALID_CREDENTIALS' }
      if (data.user) {
        await hydrateCloudProfile(data.user.id, data.user.email ?? null)
        setAuthUser({ id: data.user.id, email: data.user.email ?? null })
      }
      return { ok: true }
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

  const updatePresenceLocation = useCallback((world: WorldKind, roomCode: string) => {
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
    (category: 'outfit' | 'hat' | 'face', itemId: string, price: number): boolean => {
      let ok = false
      setProfile((p) => {
        const listKey =
          category === 'outfit' ? 'unlockedOutfits' : category === 'hat' ? 'unlockedHats' : 'unlockedFaces'
        const currentList = p[listKey] as string[]
        const alreadyOwned = currentList.includes(itemId) || price === 0

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
      lastWorld: (r.last_world === 'obby' ? 'obby' : 'lobby') as WorldKind,
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
      lastWorld: (r.last_world === 'obby' ? 'obby' : 'lobby') as WorldKind,
      lastRoom: r.last_room ?? 'PUBLIC-1',
      isOnline: isRecentlyOnline(r.last_seen),
    }))
  }, [])

  return {
    profile,
    authUser,
    authLoading,
    cloudStatus,
    checkDeviceRegistrationAllowed,
    signUp,
    signIn,
    signOut,
    updatePresenceLocation,
    setUsername,
    updateAvatar,
    awardGemsAndXp,
    unlockBadge,
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
