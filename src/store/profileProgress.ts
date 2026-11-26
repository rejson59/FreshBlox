import type { PlayerProfile } from './usePlayerStore.ts'
import {
  BACK_CATALOG,
  DAILY_QUESTS,
  FACE_CATALOG,
  GEMS_SYSTEM_IN_PROGRESS,
  HAT_CATALOG,
  OUTFIT_CATALOG,
  PET_CATALOG,
  TRAIL_CATALOG,
} from '../data/catalog.ts'
import type {
  BackId,
  FaceId,
  HatId,
  OutfitId,
  PetId,
  QuestDef,
  R6AvatarConfig,
  TrailId,
} from '../data/catalog.ts'

/**
 * Pure profile arithmetic.
 *
 * Every function here takes the current profile and returns the next one, so the store
 * never has to mutate a captured flag inside a setState updater. That pattern looked
 * convenient but only worked because React happened to evaluate the updater eagerly;
 * under batching or StrictMode the caller read a stale `false` while the state had
 * already changed.
 */

export type CosmeticCategory = 'outfit' | 'hat' | 'face' | 'trail' | 'back' | 'pet'
export type BundleCategory = 'outfit' | 'hat' | 'face'

type UnlockListKey =
  | 'unlockedOutfits'
  | 'unlockedHats'
  | 'unlockedFaces'
  | 'unlockedTrails'
  | 'unlockedBacks'
  | 'unlockedPets'

const UNLOCK_KEY: Record<CosmeticCategory, UnlockListKey> = {
  outfit: 'unlockedOutfits',
  hat: 'unlockedHats',
  face: 'unlockedFaces',
  trail: 'unlockedTrails',
  back: 'unlockedBacks',
  pet: 'unlockedPets',
}

const AVATAR_KEY: Record<CosmeticCategory, keyof R6AvatarConfig> = {
  outfit: 'outfitId',
  hat: 'hatId',
  face: 'faceId',
  trail: 'trailId',
  back: 'backId',
  pet: 'petId',
}

type CatalogEntry = { id: string; price: number; rewardOnly?: string }

function catalogEntry(category: CosmeticCategory, id: string): CatalogEntry | undefined {
  switch (category) {
    case 'outfit':
      return OUTFIT_CATALOG.find((item) => item.id === id)
    case 'hat':
      return HAT_CATALOG.find((item) => item.id === id)
    case 'face':
      return FACE_CATALOG.find((item) => item.id === id)
    case 'trail':
      return TRAIL_CATALOG.find((item) => item.id === id)
    case 'back':
      return BACK_CATALOG.find((item) => item.id === id)
    case 'pet':
      return PET_CATALOG.find((item) => item.id === id)
    default:
      return undefined
  }
}

function unlockedList(profile: PlayerProfile, category: CosmeticCategory): string[] {
  return profile[UNLOCK_KEY[category]] as string[]
}

export function isRewardOnlyItem(category: CosmeticCategory, itemId: string): boolean {
  return Boolean(catalogEntry(category, itemId)?.rewardOnly)
}

export interface ProfileTransition {
  ok: boolean
  profile: PlayerProfile
}

/**
 * Buys (or re-equips) a cosmetic with FreshGems.
 * Milestone rewards can only be worn once they were earned — never bought.
 */
export function purchaseWithGems(
  profile: PlayerProfile,
  category: CosmeticCategory,
  itemId: string,
  price: number,
): ProfileTransition {
  const owned = unlockedList(profile, category).includes(itemId)
  if (!owned && isRewardOnlyItem(category, itemId)) return { ok: false, profile }
  if (!owned && GEMS_SYSTEM_IN_PROGRESS) return { ok: false, profile }

  const cost = owned ? 0 : Math.max(0, Math.floor(Number.isFinite(price) ? price : 0))
  if (cost > profile.freshGems) return { ok: false, profile }

  const nextAvatar: R6AvatarConfig = { ...profile.avatar, [AVATAR_KEY[category]]: itemId }
  const nextList = owned ? unlockedList(profile, category) : [...unlockedList(profile, category), itemId]

  return {
    ok: true,
    profile: {
      ...profile,
      freshGems: profile.freshGems - cost,
      avatar: nextAvatar,
      [UNLOCK_KEY[category]]: nextList,
    } as PlayerProfile,
  }
}

/**
 * Buys several cosmetics in one transaction-like step: either everything payable is
 * unlocked and the total is charged, or nothing happens.
 */
export function purchaseBundleWithGems(
  profile: PlayerProfile,
  items: Array<{ category: BundleCategory; id: string; price: number }>,
): ProfileTransition {
  if (items.length === 0 || GEMS_SYSTEM_IN_PROGRESS) return { ok: false, profile }

  const toBuy = items.filter(
    (item) =>
      !isRewardOnlyItem(item.category, item.id) &&
      !unlockedList(profile, item.category).includes(item.id),
  )
  if (toBuy.length === 0) return { ok: false, profile }

  const totalCost = toBuy.reduce((sum, item) => sum + Math.max(0, Math.floor(item.price)), 0)
  if (totalCost > profile.freshGems) return { ok: false, profile }

  let unlockedOutfits = [...profile.unlockedOutfits]
  let unlockedHats = [...profile.unlockedHats]
  let unlockedFaces = [...profile.unlockedFaces]
  const nextAvatar: R6AvatarConfig = { ...profile.avatar }

  for (const item of toBuy) {
    if (item.category === 'outfit') {
      unlockedOutfits = [...unlockedOutfits, item.id as OutfitId]
      nextAvatar.outfitId = item.id as OutfitId
    } else if (item.category === 'hat') {
      unlockedHats = [...unlockedHats, item.id as HatId]
      nextAvatar.hatId = item.id as HatId
    } else {
      unlockedFaces = [...unlockedFaces, item.id as FaceId]
      nextAvatar.faceId = item.id as FaceId
    }
  }

  return {
    ok: true,
    profile: {
      ...profile,
      freshGems: profile.freshGems - totalCost,
      avatar: nextAvatar,
      unlockedOutfits,
      unlockedHats,
      unlockedFaces,
    },
  }
}

/** Claims a completed daily quest exactly once. */
export function claimQuestReward(profile: PlayerProfile, questId: QuestDef['id']): ProfileTransition {
  const def = DAILY_QUESTS.find((quest) => quest.id === questId)
  if (!def) return { ok: false, profile }
  if (profile.quests.claimed[questId]) return { ok: false, profile }
  if ((profile.quests.progress[questId] ?? 0) < def.target) return { ok: false, profile }

  return {
    ok: true,
    profile: {
      ...profile,
      freshGems: GEMS_SYSTEM_IN_PROGRESS ? profile.freshGems : profile.freshGems + def.rewardGems,
      xp: profile.xp + def.rewardXp,
      quests: {
        ...profile.quests,
        claimed: { ...profile.quests.claimed, [questId]: true },
      },
    },
  }
}

/**
 * Guest profiles get a local `fb_<timestamp>_<random>` id (see createDefaultProfile) while
 * real accounts use a UUID. That difference is how hydration tells "this browser has
 * unsaved guest progress" apart from "this browser cached a previous session".
 */
export function isGuestProfileId(playerId: string | undefined | null): boolean {
  return !playerId || playerId.startsWith('fb_')
}

function unionIds<T extends string>(a: readonly T[], b: readonly T[]): T[] {
  return Array.from(new Set([...a, ...b])) as T[]
}

function bestOfNullable(a: number | null, b: number | null): number | null {
  if (a === null) return b
  if (b === null) return a
  return Math.min(a, b)
}

/**
 * Folds progress a player made before signing in into the freshly hydrated cloud profile.
 * Only monotonic counters survive, and FreshCoins are never touched — the wallet is
 * server-authoritative and must not be taken from local storage.
 */
export function mergeGuestProgress(cloud: PlayerProfile, local: PlayerProfile): PlayerProfile {
  const progressKeys: Array<keyof PlayerProfile> = [
    'xp',
    'obbyStage',
    'obbyBestStage',
    'obbyCompletions',
    'arenaEliminations',
    'arenaWins',
    'arenaBestSpeed',
    'frisbeeWins',
    'frisbeeSlices',
    'frisbeeCatches',
  ]

  const merged: PlayerProfile = { ...cloud }
  for (const key of progressKeys) {
    const cloudValue = Number(cloud[key] ?? 0)
    const localValue = Number(local[key] ?? 0)
    ;(merged as unknown as Record<string, number>)[key] = Math.max(cloudValue, localValue)
  }

  const progress: Record<string, number> = { ...cloud.quests.progress }
  for (const [questId, value] of Object.entries(local.quests.progress)) {
    progress[questId] = Math.max(Number(progress[questId] ?? 0), Number(value ?? 0))
  }

  return {
    ...merged,
    freshGems: Math.max(cloud.freshGems, local.freshGems),
    obbyBestTimeMs: bestOfNullable(cloud.obbyBestTimeMs, local.obbyBestTimeMs),
    badges: unionIds(cloud.badges, local.badges),
    unlockedOutfits: unionIds(cloud.unlockedOutfits, local.unlockedOutfits) as OutfitId[],
    unlockedHats: unionIds(cloud.unlockedHats, local.unlockedHats) as HatId[],
    unlockedFaces: unionIds(cloud.unlockedFaces, local.unlockedFaces) as FaceId[],
    unlockedTrails: unionIds(cloud.unlockedTrails, local.unlockedTrails) as TrailId[],
    unlockedBacks: unionIds(cloud.unlockedBacks, local.unlockedBacks) as BackId[],
    unlockedPets: unionIds(cloud.unlockedPets, local.unlockedPets) as PetId[],
    savedOutfits: cloud.savedOutfits.length > 0 ? cloud.savedOutfits : local.savedOutfits,
    quests: { progress, claimed: { ...cloud.quests.claimed, ...local.quests.claimed } },
  }
}

/**
 * Player search feeds user input straight into a PostgREST `ilike` filter: wildcards and
 * filter punctuation would otherwise widen the match or break the query.
 */
export function sanitizeSearchQuery(raw: string, maxLength = 24): string {
  return raw
    .replace(/[%_,()*\\'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}
