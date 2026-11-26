import assert from 'node:assert/strict'
import test from 'node:test'
import {
  claimQuestReward,
  isGuestProfileId,
  mergeGuestProgress,
  purchaseBundleWithGems,
  purchaseWithGems,
  sanitizeSearchQuery,
} from '../src/store/profileProgress.ts'
import { DAILY_QUESTS, OUTFIT_CATALOG, HAT_CATALOG } from '../src/data/catalog.ts'

function profile(overrides = {}) {
  return {
    playerId: 'player-1',
    username: 'Tester',
    freshTag: '#FB-1234',
    role: 'player',
    clanId: null,
    clanTag: null,
    freshGems: 500,
    freshCoins: 0,
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
    unlockedOutfits: ['fresh-creator'],
    unlockedHats: ['none'],
    unlockedFaces: ['fresh-smile'],
    unlockedTrails: ['none'],
    unlockedBacks: ['none'],
    unlockedPets: ['none'],
    savedOutfits: [],
    badges: ['pioneer'],
    pinnedBadge: null,
    quests: { progress: {}, claimed: {} },
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
    ...overrides,
  }
}

const paidOutfit = OUTFIT_CATALOG.find((item) => !item.rewardOnly && item.price > 0)
const rewardHat = HAT_CATALOG.find((item) => item.rewardOnly)

test('buying a cosmetic charges gems, equips it and unlocks it in one step', () => {
  const before = profile()
  const result = purchaseWithGems(before, 'outfit', paidOutfit.id, paidOutfit.price)

  assert.equal(result.ok, true)
  assert.equal(result.profile.freshGems, before.freshGems - paidOutfit.price)
  assert.equal(result.profile.avatar.outfitId, paidOutfit.id)
  assert.ok(result.profile.unlockedOutfits.includes(paidOutfit.id))
  assert.equal(before.freshGems, 500, 'the input profile is never mutated')
  assert.equal(before.unlockedOutfits.includes(paidOutfit.id), false)
})

test('re-equipping something already owned is free', () => {
  const owned = profile({ unlockedOutfits: ['fresh-creator', paidOutfit.id], freshGems: 10 })
  const result = purchaseWithGems(owned, 'outfit', paidOutfit.id, paidOutfit.price)
  assert.equal(result.ok, true)
  assert.equal(result.profile.freshGems, 10, 'no second charge')
  assert.equal(result.profile.avatar.outfitId, paidOutfit.id)
})

test('milestone rewards can never be bought before they are earned', () => {
  assert.ok(rewardHat, 'the catalog still has at least one milestone-only hat')
  const result = purchaseWithGems(profile({ freshGems: 99_999 }), 'hat', rewardHat.id, 0)
  assert.equal(result.ok, false)
  assert.equal(result.profile.freshGems, 99_999)
})

test('an unaffordable purchase changes nothing', () => {
  const poor = profile({ freshGems: paidOutfit.price - 1 })
  const result = purchaseWithGems(poor, 'outfit', paidOutfit.id, paidOutfit.price)
  assert.equal(result.ok, false)
  assert.equal(result.profile, poor, 'the same object comes back, so React would not even re-render')
})

test('the buy decision is synchronous, which is what callers rely on for feedback', () => {
  // Previously the flag was set inside a setState updater, so the caller could read `false`
  // while the state had already changed. The helper has no such gap.
  const result = purchaseWithGems(profile(), 'outfit', paidOutfit.id, paidOutfit.price)
  assert.equal(result.ok, true)
  assert.ok(result.profile.freshGems < 500)
})

test('a bundle either charges for everything payable or does nothing', () => {
  const hat = HAT_CATALOG.find((item) => !item.rewardOnly && item.price > 0 && item.id !== 'none')
  const items = [
    { category: 'outfit', id: paidOutfit.id, price: paidOutfit.price },
    { category: 'hat', id: hat.id, price: hat.price },
  ]
  const rich = purchaseBundleWithGems(profile({ freshGems: 10_000 }), items)
  assert.equal(rich.ok, true)
  assert.equal(rich.profile.freshGems, 10_000 - paidOutfit.price - hat.price)
  assert.equal(rich.profile.avatar.hatId, hat.id)

  const tooPoor = purchaseBundleWithGems(profile({ freshGems: paidOutfit.price }), items)
  assert.equal(tooPoor.ok, false)
  assert.equal(tooPoor.profile.freshGems, paidOutfit.price)

  const alreadyOwned = purchaseBundleWithGems(
    profile({ unlockedOutfits: ['fresh-creator', paidOutfit.id], unlockedHats: ['none', hat.id] }),
    items,
  )
  assert.equal(alreadyOwned.ok, false, 'nothing payable means nothing happens')
})

test('a completed quest pays out exactly once', () => {
  const quest = DAILY_QUESTS[0]
  const ready = profile({
    quests: { progress: { [quest.id]: quest.target }, claimed: {} },
  })
  const first = claimQuestReward(ready, quest.id)
  assert.equal(first.ok, true)
  assert.equal(first.profile.freshGems, ready.freshGems + quest.rewardGems)
  assert.equal(first.profile.xp, quest.rewardXp)
  assert.equal(first.profile.quests.claimed[quest.id], true)

  const second = claimQuestReward(first.profile, quest.id)
  assert.equal(second.ok, false, 'no double payout')

  const unfinished = claimQuestReward(profile({ quests: { progress: {}, claimed: {} } }), quest.id)
  assert.equal(unfinished.ok, false, 'an unfinished quest cannot be claimed')
})

test('guest progress survives the first sign-in, but never leaks coins', () => {
  const cloud = profile({
    playerId: 'cloud-1',
    freshGems: 0,
    freshCoins: 40,
    xp: 100,
    obbyBestStage: 10,
    obbyBestTimeMs: 90_000,
    badges: ['pioneer'],
    quests: { progress: { q_chat: 1 }, claimed: {} },
  })
  const guest = {
    ...profile({
      playerId: undefined,
      freshGems: 30,
      freshCoins: 999,
      xp: 250,
      obbyBestStage: 42,
      obbyBestTimeMs: 60_000,
      badges: ['jango'],
      unlockedOutfits: ['fresh-creator', paidOutfit.id],
      quests: { progress: { q_chat: 3, q_emote: 1 }, claimed: { q_chat: true } },
    }),
  }

  const merged = mergeGuestProgress(cloud, guest)
  assert.equal(merged.playerId, 'cloud-1', 'the account identity always wins')
  assert.equal(merged.xp, 250, 'the higher XP is kept')
  assert.equal(merged.obbyBestStage, 42)
  assert.equal(merged.obbyBestTimeMs, 60_000, 'the faster time wins')
  assert.equal(merged.freshGems, 30)
  assert.equal(merged.freshCoins, 40, 'coins are server-side and must never be taken from local storage')
  assert.deepEqual(merged.badges, ['pioneer', 'jango'])
  assert.ok(merged.unlockedOutfits.includes(paidOutfit.id))
  assert.equal(merged.quests.progress.q_chat, 3)
  assert.equal(merged.quests.claimed.q_chat, true)
})

test('a cached account profile is never mistaken for guest progress', () => {
  assert.equal(isGuestProfileId(undefined), true)
  assert.equal(isGuestProfileId(null), true)
  assert.equal(isGuestProfileId('fb_lz4k2_ab12c'), true, 'createDefaultProfile ids')
  assert.equal(isGuestProfileId('11111111-1111-1111-1111-111111111111'), false, 'uuid account ids')
})

test('merging is idempotent, so repeated hydration cannot inflate progress', () => {
  const cloud = profile({ xp: 100, obbyBestStage: 10 })
  const guest = profile({ playerId: undefined, xp: 100, obbyBestStage: 10 })
  assert.deepEqual(mergeGuestProgress(cloud, guest), mergeGuestProgress(mergeGuestProgress(cloud, guest), guest))
})

test('player search input cannot break out of the ilike filter', () => {
  assert.equal(sanitizeSearchQuery('  Ala  '), 'Ala')
  assert.equal(sanitizeSearchQuery('%admin%'), 'admin')
  assert.equal(sanitizeSearchQuery('a,b),(c'), 'a b c')
  assert.equal(sanitizeSearchQuery('x'.repeat(80)).length, 24)
  assert.equal(sanitizeSearchQuery(''), '')
})
