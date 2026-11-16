import { useCallback, useEffect, useState } from 'react'
import {
  DAILY_QUESTS,
  FaceId,
  HatId,
  OutfitId,
  QuestDef,
  R6AvatarConfig,
} from '../data/catalog'

export interface FriendEntry {
  id: string
  username: string
  status: 'online' | 'in-lobby' | 'offline'
  roomCode?: string
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
}

const STORAGE_KEY = 'freshblox_player_profile_v1'

function createDefaultProfile(): PlayerProfile {
  const rnd = Math.floor(1000 + Math.random() * 8999)
  return {
    playerId: `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    username: `FreshPlayer${rnd.toString().slice(0, 2)}`,
    freshTag: `#FB-${rnd}`,
    freshGems: 250,
    xp: 80,
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
      progress: {
        q_gems: 0,
        q_chat: 0,
        q_emote: 0,
        q_jumppad: 0,
        q_tower: 0,
      },
      claimed: {
        q_gems: false,
        q_chat: false,
        q_emote: false,
        q_jumppad: false,
        q_tower: false,
      },
    },
    friends: [
      { id: 'f1', username: 'KubaDev', status: 'in-lobby', roomCode: 'PUBLIC-1' },
      { id: 'f2', username: 'NadiaSky', status: 'in-lobby', roomCode: 'PUBLIC-1' },
      { id: 'f3', username: 'MatiBlox', status: 'online', roomCode: 'CHILL-PL' },
    ],
  }
}

function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultProfile()
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>
    const def = createDefaultProfile()
    return {
      ...def,
      ...parsed,
      avatar: {
        outfitId: parsed.avatar?.outfitId ?? def.avatar.outfitId,
        faceId: parsed.avatar?.faceId ?? def.avatar.faceId,
        hatId: parsed.avatar?.hatId ?? def.avatar.hatId,
        skinColor: parsed.avatar?.skinColor ?? def.avatar.skinColor,
      },
      quests: {
        progress: { ...def.quests.progress, ...(parsed.quests?.progress ?? {}) },
        claimed: { ...def.quests.claimed, ...(parsed.quests?.claimed ?? {}) },
      },
      friends: Array.isArray(parsed.friends) ? parsed.friends : def.friends,
      badges: Array.isArray(parsed.badges) ? parsed.badges : def.badges,
    }
  } catch {
    return createDefaultProfile()
  }
}

export function usePlayerStore() {
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    } catch {
      // ignore storage quota
    }
  }, [profile])

  const setUsername = useCallback((name: string) => {
    const clean = name.trim().slice(0, 20)
    if (!clean) return
    setProfile((p) => ({ ...p, username: clean }))
  }, [])

  const updateAvatar = useCallback((patch: Partial<R6AvatarConfig>) => {
    setProfile((p) => ({ ...p, avatar: { ...p.avatar, ...patch } }))
  }, [])

  const awardGemsAndXp = useCallback((gems: number, xp: number) => {
    setProfile((p) => ({
      ...p,
      freshGems: p.freshGems + gems,
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
      if (questId === 'q_gems' && next >= 5 && !badges.includes('collector')) badges.push('collector')
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
        freshGems: p.freshGems + def.rewardGems,
        xp: p.xp + def.rewardXp,
        quests: {
          ...p.quests,
          claimed: { ...p.quests.claimed, [questId]: true },
        },
      }
    })
    return claimedNow
  }, [])

  const buyAndEquip = useCallback(
    (category: 'outfit' | 'hat' | 'face', itemId: string, price: number): boolean => {
      let ok = false
      setProfile((p) => {
        const listKey =
          category === 'outfit' ? 'unlockedOutfits' : category === 'hat' ? 'unlockedHats' : 'unlockedFaces'
        const currentList = p[listKey] as string[]
        const alreadyOwned = currentList.includes(itemId)
        if (!alreadyOwned && p.freshGems < price) return p

        ok = true
        const nextBadges =
          !alreadyOwned && price > 0 && !p.badges.includes('stylist') ? [...p.badges, 'stylist'] : p.badges

        const nextAvatar: R6AvatarConfig = {
          ...p.avatar,
          ...(category === 'outfit' ? { outfitId: itemId as OutfitId } : {}),
          ...(category === 'hat' ? { hatId: itemId as HatId } : {}),
          ...(category === 'face' ? { faceId: itemId as FaceId } : {}),
        }

        return {
          ...p,
          freshGems: alreadyOwned ? p.freshGems : p.freshGems - price,
          badges: nextBadges,
          avatar: nextAvatar,
          [listKey]: alreadyOwned ? currentList : [...currentList, itemId],
        }
      })
      return ok
    },
    [],
  )

  const addFriend = useCallback((username: string) => {
    const clean = username.trim().slice(0, 20)
    if (!clean) return
    setProfile((p) => {
      if (p.friends.some((f) => f.username.toLowerCase() === clean.toLowerCase())) return p
      return {
        ...p,
        friends: [
          { id: `fr_${Date.now()}`, username: clean, status: 'online', roomCode: 'PUBLIC-1' },
          ...p.friends,
        ],
      }
    })
  }, [])

  return {
    profile,
    setUsername,
    updateAvatar,
    awardGemsAndXp,
    unlockBadge,
    incrementQuest,
    claimQuest,
    buyAndEquip,
    addFriend,
  }
}
