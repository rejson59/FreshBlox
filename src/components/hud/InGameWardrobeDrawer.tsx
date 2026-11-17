import React, { useMemo, useState } from 'react'
import { Check, Crown, Eye, Lock, Palette, RotateCcw, Shirt, ShoppingBag, Smile, Sparkles, Trophy, X } from 'lucide-react'
import {
  CatalogItem,
  FACE_CATALOG,
  FaceId,
  GEMS_SYSTEM_IN_PROGRESS,
  HAT_CATALOG,
  HatId,
  OUTFIT_CATALOG,
  OutfitId,
  R6AvatarConfig,
  SKIN_SWATCHES,
} from '../../data/catalog'
import { Lang, LOCALES } from '../../data/locales'
import { PlayerPose } from '../../lib/multiplayer'
import { sfx } from '../../lib/sfx'
import { FreshGemShard } from '../brand/FreshBloxBrand'

type TabId = 'outfits' | 'hats' | 'faces' | 'skin'

const OUTFIT_SWATCHES: Record<OutfitId, { torso: string; arms: string; legs: string }> = {
  'fresh-creator': { torso: '#0EA5E9', arms: '#38BDF8', legs: '#1E3A8A' },
  'classic-remaster': { torso: '#2563EB', arms: '#FDE0B6', legs: '#22C55E' },
  'arctic-frost': { torso: '#E0F2FE', arms: '#7DD3FC', legs: '#0369A1' },
  'midnight-slate': { torso: '#0F172A', arms: '#0284C7', legs: '#1E293B' },
  'glacier-captain': { torso: '#0891B2', arms: '#E0F2FE', legs: '#0C4A6E' },
  'crystal-royal': { torso: '#38BDF8', arms: '#F8FAFC', legs: '#1D4ED8' },
}

interface InGameWardrobeDrawerProps {
  lang: Lang
  freshGems: number
  ownedAvatar: R6AvatarConfig
  previewAvatar: R6AvatarConfig
  unlockedOutfits: OutfitId[]
  unlockedHats: HatId[]
  unlockedFaces: FaceId[]
  onPreviewChange: (next: R6AvatarConfig) => void
  onBuyAndEquip: (category: 'outfit' | 'hat' | 'face', itemId: string, price: number) => boolean
  onBuyBundle: (items: Array<{ category: 'outfit' | 'hat' | 'face'; id: string; price: number }>) => boolean
  onSkinChange: (hex: string) => void
  onTestEmote: (pose: PlayerPose) => void
  onClose: () => void
}

export const InGameWardrobeDrawer: React.FC<InGameWardrobeDrawerProps> = ({
  lang,
  freshGems,
  ownedAvatar,
  previewAvatar,
  unlockedOutfits,
  unlockedHats,
  unlockedFaces,
  onPreviewChange,
  onBuyAndEquip,
  onBuyBundle,
  onSkinChange,
  onTestEmote,
  onClose,
}) => {
  const [tab, setTab] = useState<TabId>('outfits')
  const t = LOCALES[lang].avatar
  const tw = LOCALES[lang].world

  const triedUnowned = useMemo(() => {
    const list: Array<{
      category: 'outfit' | 'hat' | 'face'
      id: string
      name: string
      price: number
      rewardOnly?: 'obby100'
    }> = []
    if (!unlockedOutfits.includes(previewAvatar.outfitId)) {
      const it = OUTFIT_CATALOG.find((x) => x.id === previewAvatar.outfitId)
      if (it)
        list.push({
          category: 'outfit',
          id: it.id,
          name: lang === 'pl' ? it.namePl : it.nameEn,
          price: it.price,
          rewardOnly: it.rewardOnly,
        })
    }
    if (!unlockedHats.includes(previewAvatar.hatId)) {
      const it = HAT_CATALOG.find((x) => x.id === previewAvatar.hatId)
      if (it)
        list.push({
          category: 'hat',
          id: it.id,
          name: lang === 'pl' ? it.namePl : it.nameEn,
          price: it.price,
          rewardOnly: it.rewardOnly,
        })
    }
    if (!unlockedFaces.includes(previewAvatar.faceId)) {
      const it = FACE_CATALOG.find((x) => x.id === previewAvatar.faceId)
      if (it)
        list.push({
          category: 'face',
          id: it.id,
          name: lang === 'pl' ? it.namePl : it.nameEn,
          price: it.price,
          rewardOnly: it.rewardOnly,
        })
    }
    return list
  }, [previewAvatar, unlockedOutfits, unlockedHats, unlockedFaces, lang])

  const purchasableTried = useMemo(() => triedUnowned.filter((i) => !i.rewardOnly), [triedUnowned])
  const hasRewardOnlyTried = useMemo(() => triedUnowned.some((i) => Boolean(i.rewardOnly)), [triedUnowned])
  const totalTryOnPrice = useMemo(() => purchasableTried.reduce((s, i) => s + i.price, 0), [purchasableTried])

  const handleCardSelect = (category: 'outfit' | 'hat' | 'face', itemId: string, isOwned: boolean) => {
    sfx.playClick()
    const next: R6AvatarConfig = {
      ...previewAvatar,
      ...(category === 'outfit' ? { outfitId: itemId as OutfitId } : {}),
      ...(category === 'hat' ? { hatId: itemId as HatId } : {}),
      ...(category === 'face' ? { faceId: itemId as FaceId } : {}),
    }
    onPreviewChange(next)
    if (isOwned) {
      onBuyAndEquip(category, itemId, 0)
    }
  }

  const handleBuySingle = (
    e: React.MouseEvent,
    category: 'outfit' | 'hat' | 'face',
    itemId: string,
    price: number,
  ) => {
    e.stopPropagation()
    if (freshGems < price) return
    if (onBuyAndEquip(category, itemId, price)) {
      sfx.playGemCollect()
      onPreviewChange({
        ...previewAvatar,
        ...(category === 'outfit' ? { outfitId: itemId as OutfitId } : {}),
        ...(category === 'hat' ? { hatId: itemId as HatId } : {}),
        ...(category === 'face' ? { faceId: itemId as FaceId } : {}),
      })
    }
  }

  const handleBuyBundle = () => {
    if (freshGems < totalTryOnPrice || purchasableTried.length === 0) return
    if (onBuyBundle(purchasableTried.map(({ category, id, price }) => ({ category, id, price })))) {
      sfx.playQuestClaim()
    }
  }

  const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'outfits', label: t.tabs.outfits, icon: Shirt },
    { id: 'hats', label: t.tabs.hats, icon: Crown },
    { id: 'faces', label: t.tabs.faces, icon: Smile },
    { id: 'skin', label: t.tabs.skin, icon: Palette },
  ]

  const renderGrid = <T extends string>(
    category: 'outfit' | 'hat' | 'face',
    items: CatalogItem<T>[],
    unlocked: T[],
    equippedOwnedId: T,
    previewedId: T,
  ) => (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => {
        const isOwned = unlocked.includes(item.id)
        const isEquipped = isOwned && equippedOwnedId === item.id
        const isTryingOn = !isOwned && previewedId === item.id
        const isSelected = previewedId === item.id
        const isRewardOnly = Boolean(item.rewardOnly)
        const canAfford = !isRewardOnly && !GEMS_SYSTEM_IN_PROGRESS && freshGems >= item.price
        const sw = category === 'outfit' ? OUTFIT_SWATCHES[item.id as OutfitId] : null

        return (
          <div
            key={item.id}
            onClick={() => handleCardSelect(category, item.id, isOwned)}
            className={`flex flex-col justify-between rounded-2xl border p-2.5 transition cursor-pointer ${
              isTryingOn
                ? 'border-amber-400/80 bg-amber-500/15'
                : isSelected
                  ? 'border-sky-400 bg-sky-500/18'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            <div className="flex items-start gap-2">
              {sw ? (
                <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl border border-white/15 bg-slate-900/70 p-1">
                  <div className="flex items-center gap-[1.5px]">
                    <span className="h-3.5 w-1.5 rounded-[1.5px]" style={{ background: sw.arms }} />
                    <span className="h-3.5 w-3.5 rounded-[2px] border border-white/25" style={{ background: sw.torso }} />
                    <span className="h-3.5 w-1.5 rounded-[1.5px]" style={{ background: sw.arms }} />
                  </div>
                  <div className="mt-[1.5px] flex gap-[1.5px]">
                    <span className="h-3 w-1.5 rounded-[1.5px]" style={{ background: sw.legs }} />
                    <span className="h-3 w-1.5 rounded-[1.5px]" style={{ background: sw.legs }} />
                  </div>
                </div>
              ) : (
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/20"
                  style={{ background: `radial-gradient(circle at 30% 30%, ${item.accent}, rgba(15,23,42,0.8))` }}
                >
                  {category === 'hat' ? (
                    <Crown className="h-4 w-4 text-white" />
                  ) : (
                    <Smile className="h-4 w-4 text-white" />
                  )}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-extrabold text-white leading-tight">
                  {lang === 'pl' ? item.namePl : item.nameEn}
                </div>
                <div className="mt-1">
                  {isEquipped ? (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-sky-400 px-1.5 py-0.5 text-[9px] font-black text-slate-950">
                      <Check className="h-2.5 w-2.5" /> {t.equipped}
                    </span>
                  ) : isTryingOn ? (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-400 px-1.5 py-0.5 text-[9px] font-black text-slate-950">
                      <Eye className="h-2.5 w-2.5" /> {t.tryingOn}
                    </span>
                  ) : isOwned ? (
                    <span className="inline-flex items-center rounded-md bg-white/12 px-1.5 py-0.5 text-[9px] font-bold text-sky-100">
                      {t.equip}
                    </span>
                  ) : isRewardOnly ? (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-400/20 border border-amber-300/40 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-200">
                      <Trophy className="h-2.5 w-2.5" />
                      {lang === 'pl' ? item.rewardLabelPl : item.rewardLabelEn}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-extrabold text-sky-200">
                      <FreshGemShard size={11} />
                      {item.price}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {!isOwned &&
              (isRewardOnly ? (
                <div className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-amber-400/35 bg-amber-500/12 py-1 text-[10px] font-extrabold text-amber-200">
                  <Trophy className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">
                    {lang === 'pl' ? 'Przejdź Obby 100' : 'Beat Obby 100'}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!canAfford}
                  onClick={(e) => handleBuySingle(e, category, item.id, item.price)}
                  className={`mt-2 flex w-full items-center justify-center gap-1 rounded-xl py-1 text-[10px] font-extrabold transition cursor-pointer ${
                    canAfford
                      ? 'bg-sky-400 text-slate-950 hover:bg-sky-300 active:scale-95'
                      : 'bg-amber-500/15 text-amber-200/90 opacity-85 cursor-not-allowed'
                  }`}
                >
                  {!canAfford && <Lock className="h-2.5 w-2.5" />}
                  <span>
                    {GEMS_SYSTEM_IN_PROGRESS
                      ? LOCALES[lang].gemsNotice.shopLocked
                      : canAfford
                        ? `${t.buy} • ${item.price}`
                        : t.notEnough}
                  </span>
                </button>
              ))}
          </div>
        )
      })}
    </div>
  )

  return (
    <aside
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute inset-y-2.5 z-40 flex w-[min(352px,calc(100vw-24px))] flex-col overflow-hidden rounded-3xl border border-white/15 bg-slate-950/90 text-sky-50 shadow-2xl backdrop-blur-2xl"
      style={{ right: 'max(0.65rem, env(safe-area-inset-right))' }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 border border-sky-400/25">
            <Sparkles className="h-4 w-4 text-sky-300" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-extrabold text-white leading-tight">
              {tw.liveWardrobeTitle}
            </div>
            <div className="truncate text-[10px] text-sky-200/75">{tw.liveWardrobeSub}</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {GEMS_SYSTEM_IN_PROGRESS ? (
            <div className="flex items-center gap-1 rounded-xl bg-amber-500/15 border border-amber-400/30 px-2 py-1 text-[10px] font-extrabold text-amber-200">
              <FreshGemShard size={12} />
              <span>{LOCALES[lang].nav.gemsWipPill}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded-xl bg-white/8 border border-white/10 px-2 py-1 text-xs font-extrabold text-sky-100">
              <FreshGemShard size={13} />
              <span>{freshGems}</span>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={tw.liveWardrobeDone}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/8 text-sky-100 hover:bg-white/15 active:scale-95 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="grid shrink-0 grid-cols-4 gap-1 border-b border-white/10 bg-slate-950/50 p-1.5">
        {tabs.map((tb) => {
          const Icon = tb.icon
          const active = tab === tb.id
          return (
            <button
              key={tb.id}
              type="button"
              onClick={() => {
                setTab(tb.id)
                sfx.playClick()
              }}
              className={`flex items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-bold transition cursor-pointer ${
                active ? 'bg-sky-400 text-slate-950 shadow' : 'text-sky-100/80 hover:bg-white/10'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{tb.label}</span>
            </button>
          )
        })}
      </div>

      {/* Scrollable Catalog */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
        {tab === 'outfits' &&
          renderGrid('outfit', OUTFIT_CATALOG, unlockedOutfits, ownedAvatar.outfitId, previewAvatar.outfitId)}
        {tab === 'hats' &&
          renderGrid('hat', HAT_CATALOG, unlockedHats, ownedAvatar.hatId, previewAvatar.hatId)}
        {tab === 'faces' &&
          renderGrid('face', FACE_CATALOG, unlockedFaces, ownedAvatar.faceId, previewAvatar.faceId)}
        {tab === 'skin' && (
          <div className="grid grid-cols-2 gap-2">
            {SKIN_SWATCHES.map((sw) => {
              const active = previewAvatar.skinColor === sw.hex
              return (
                <button
                  key={sw.hex}
                  type="button"
                  onClick={() => {
                    onSkinChange(sw.hex)
                    onPreviewChange({ ...previewAvatar, skinColor: sw.hex })
                    sfx.playChatPop()
                  }}
                  className={`flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition cursor-pointer ${
                    active ? 'border-sky-400 bg-sky-500/18' : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <span
                    className="h-8 w-8 shrink-0 rounded-xl border-2 border-white/60 shadow-inner"
                    style={{ background: sw.hex }}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-extrabold text-white">
                      {lang === 'pl' ? sw.namePl : sw.nameEn}
                    </div>
                    <div className="font-mono text-[9px] text-sky-200/65">{sw.hex}</div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Live Try-On Checkout Banner (whenever trying on 1+ unowned items live in-game!) */}
      {triedUnowned.length > 0 && (
        <div className="shrink-0 border-t border-amber-400/35 bg-amber-500/12 px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 font-extrabold text-amber-300">
              <Eye className="h-3.5 w-3.5" />
              {t.tryingOn} ({triedUnowned.length})
            </span>
            <button
              type="button"
              onClick={() => {
                onPreviewChange({ ...ownedAvatar })
                sfx.playClick()
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-0.5 text-[10px] font-bold text-sky-100 hover:bg-white/20 cursor-pointer"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              {t.resetPreview}
            </button>
          </div>

          {hasRewardOnlyTried && purchasableTried.length === 0 ? (
            <div className="rounded-xl bg-slate-950/60 border border-amber-400/35 px-2.5 py-1.5 text-[10px] font-bold text-amber-200 leading-snug">
              {lang === 'pl'
                ? '👑 Ekskluzywna nagroda! Dotrzyj do Stage 100 w Test Obby 100, aby odblokować ją na stałe.'
                : '👑 Exclusive reward! Reach Stage 100 in Test Obby 100 to unlock permanently.'}
            </div>
          ) : GEMS_SYSTEM_IN_PROGRESS ? (
            <div className="rounded-xl bg-slate-950/60 border border-amber-400/25 px-2.5 py-1.5 text-[10px] font-semibold text-amber-100/90 leading-snug">
              {LOCALES[lang].gemsNotice.short}
            </div>
          ) : (
            <button
              type="button"
              disabled={freshGems < totalTryOnPrice}
              onClick={handleBuyBundle}
              className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold transition cursor-pointer ${
                freshGems >= totalTryOnPrice
                  ? 'bg-sky-400 text-slate-950 hover:bg-sky-300 active:scale-[0.98]'
                  : 'bg-rose-500/20 text-rose-300 cursor-not-allowed'
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>
                {freshGems >= totalTryOnPrice
                  ? `${t.buySelected} (${totalTryOnPrice} Gems)`
                  : `${t.notEnough} (${totalTryOnPrice} Gems)`}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Footer: Quick Pose Preview + Done button */}
      <div className="shrink-0 border-t border-white/10 bg-slate-950/65 px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {(['wave', 'dance', 'spin', 'backflip'] as const).map((pose) => (
            <button
              key={pose}
              type="button"
              onClick={() => onTestEmote(pose)}
              className="rounded-lg bg-white/8 px-2 py-1 text-[10px] font-bold text-sky-100 hover:bg-white/15 active:scale-95 transition cursor-pointer shrink-0"
            >
              {tw.emotes[pose]}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-xl bg-sky-500 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-sky-400 active:scale-95 transition cursor-pointer"
        >
          {tw.liveWardrobeDone}
        </button>
      </div>
    </aside>
  )
}
