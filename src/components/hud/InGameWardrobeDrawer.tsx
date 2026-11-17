import React, { useMemo, useState } from 'react'
import {
  Bot,
  Check,
  Crown,
  Eye,
  Feather,
  Hand,
  Lock,
  Music,
  Palette,
  RefreshCw,
  RotateCcw,
  Shirt,
  ShoppingBag,
  Smile,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react'
import {
  BACK_CATALOG,
  BackId,
  CatalogItem,
  FACE_CATALOG,
  FaceId,
  GEMS_SYSTEM_IN_PROGRESS,
  HAT_CATALOG,
  HatId,
  OUTFIT_CATALOG,
  OutfitId,
  PET_CATALOG,
  PetId,
  R6AvatarConfig,
  SKIN_SWATCHES,
  TRAIL_CATALOG,
  TrailId,
} from '../../data/catalog'
import { Lang, LOCALES } from '../../data/locales'
import { PlayerPose } from '../../lib/multiplayer'
import { sfx } from '../../lib/sfx'
import { FreshGemShard } from '../brand/FreshBloxBrand'

type TabId = 'outfits' | 'hats' | 'faces' | 'backs' | 'pets' | 'trails' | 'skin'

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
  unlockedBacks?: BackId[]
  unlockedPets?: PetId[]
  unlockedTrails?: TrailId[]
  onPreviewChange: (next: R6AvatarConfig) => void
  onBuyAndEquip: (
    category: 'outfit' | 'hat' | 'face' | 'trail' | 'back' | 'pet',
    itemId: string,
    price: number,
  ) => boolean
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
  unlockedBacks = BACK_CATALOG.filter((b) => !b.rewardOnly && b.price === 0).map((b) => b.id),
  unlockedPets = PET_CATALOG.filter((p) => !p.rewardOnly && p.price === 0).map((p) => p.id),
  unlockedTrails = TRAIL_CATALOG.filter((t) => !t.rewardOnly && t.price === 0).map((t) => t.id),
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
      category: 'outfit' | 'hat' | 'face' | 'trail' | 'back' | 'pet'
      id: string
      price: number
      rewardOnly?: 'obby100' | 'arenaWin' | 'arenaMeteor'
    }> = []
    if (!unlockedOutfits.includes(previewAvatar.outfitId)) {
      const it = OUTFIT_CATALOG.find((x) => x.id === previewAvatar.outfitId)
      if (it) list.push({ category: 'outfit', id: it.id, price: it.price, rewardOnly: it.rewardOnly })
    }
    if (!unlockedHats.includes(previewAvatar.hatId)) {
      const it = HAT_CATALOG.find((x) => x.id === previewAvatar.hatId)
      if (it) list.push({ category: 'hat', id: it.id, price: it.price, rewardOnly: it.rewardOnly })
    }
    if (!unlockedFaces.includes(previewAvatar.faceId)) {
      const it = FACE_CATALOG.find((x) => x.id === previewAvatar.faceId)
      if (it) list.push({ category: 'face', id: it.id, price: it.price, rewardOnly: it.rewardOnly })
    }
    const bId = (previewAvatar.backId ?? 'none') as BackId
    if (!unlockedBacks.includes(bId)) {
      const it = BACK_CATALOG.find((x) => x.id === bId)
      if (it) list.push({ category: 'back', id: it.id, price: it.price, rewardOnly: it.rewardOnly })
    }
    const tId = (previewAvatar.trailId ?? 'none') as TrailId
    if (!unlockedTrails.includes(tId)) {
      const it = TRAIL_CATALOG.find((x) => x.id === tId)
      if (it) list.push({ category: 'trail', id: it.id, price: it.price, rewardOnly: it.rewardOnly })
    }
    const pId = (previewAvatar.petId ?? 'none') as PetId
    if (!unlockedPets.includes(pId)) {
      const it = PET_CATALOG.find((x) => x.id === pId)
      if (it) list.push({ category: 'pet', id: it.id, price: it.price, rewardOnly: it.rewardOnly })
    }
    return list
  }, [previewAvatar, unlockedOutfits, unlockedHats, unlockedFaces, unlockedBacks, unlockedTrails, unlockedPets])

  const purchasableTried = useMemo(
    () =>
      triedUnowned.filter(
        (i): i is { category: 'outfit' | 'hat' | 'face'; id: string; price: number } =>
          !i.rewardOnly && (i.category === 'outfit' || i.category === 'hat' || i.category === 'face'),
      ),
    [triedUnowned],
  )
  const hasRewardOnlyTried = useMemo(() => triedUnowned.some((i) => Boolean(i.rewardOnly)), [triedUnowned])
  const totalTryOnPrice = useMemo(() => purchasableTried.reduce((s, i) => s + i.price, 0), [purchasableTried])

  const handleCardSelect = (
    category: 'outfit' | 'hat' | 'face' | 'trail' | 'back' | 'pet',
    itemId: string,
    isOwned: boolean,
  ) => {
    sfx.playClick()
    const next: R6AvatarConfig = {
      ...previewAvatar,
      ...(category === 'outfit' ? { outfitId: itemId as OutfitId } : {}),
      ...(category === 'hat' ? { hatId: itemId as HatId } : {}),
      ...(category === 'face' ? { faceId: itemId as FaceId } : {}),
      ...(category === 'back' ? { backId: itemId as BackId } : {}),
      ...(category === 'trail' ? { trailId: itemId as TrailId } : {}),
      ...(category === 'pet' ? { petId: itemId as PetId } : {}),
    }
    onPreviewChange(next)
    if (isOwned) {
      onBuyAndEquip(category, itemId, 0)
    }
  }

  const handleBuySingle = (
    e: React.MouseEvent,
    category: 'outfit' | 'hat' | 'face' | 'trail' | 'back' | 'pet',
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
        ...(category === 'back' ? { backId: itemId as BackId } : {}),
        ...(category === 'trail' ? { trailId: itemId as TrailId } : {}),
        ...(category === 'pet' ? { petId: itemId as PetId } : {}),
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
    { id: 'backs', label: lang === 'pl' ? 'Skrzydła & Plecaki' : 'Wings & Backs', icon: Feather },
    { id: 'pets', label: lang === 'pl' ? 'Pety 3D' : '3D Pets', icon: Bot },
    { id: 'trails', label: lang === 'pl' ? 'Ślady stóp' : 'Trails', icon: Sparkles },
    { id: 'skin', label: t.tabs.skin, icon: Palette },
  ]

  const poseButtons: Array<{ pose: PlayerPose; icon: React.ComponentType<{ className?: string }>; label: string }> = [
    { pose: 'wave', icon: Hand, label: tw.emotes.wave },
    { pose: 'dance', icon: Music, label: tw.emotes.dance },
    { pose: 'spin', icon: RefreshCw, label: tw.emotes.spin },
    { pose: 'backflip', icon: Sparkles, label: tw.emotes.backflip },
  ]

  const renderGrid = <T extends string>(
    category: 'outfit' | 'hat' | 'face' | 'trail' | 'back' | 'pet',
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
            className={`relative flex flex-col justify-between rounded-2xl border p-2.5 transition cursor-pointer ${
              isTryingOn
                ? 'border-amber-400/80 bg-amber-500/15'
                : isSelected
                  ? 'border-sky-400 bg-sky-500/18'
                  : 'border-white/10 bg-white/[0.045] hover:bg-white/10'
            }`}
          >
            {/* Status corner icon */}
            <div className="absolute top-2 right-2">
              {isEquipped ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-400 text-slate-950">
                  <Check className="h-3 w-3 stroke-[3]" />
                </span>
              ) : isTryingOn ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-slate-950">
                  <Eye className="h-3 w-3" />
                </span>
              ) : !isOwned && isRewardOnly ? (
                <span
                  title={lang === 'pl' ? 'Odblokuj za Stage 100' : 'Unlock at Stage 100'}
                  className="inline-flex items-center gap-0.5 rounded-md bg-amber-400/20 px-1.5 py-0.5 font-mono text-[9px] font-black text-amber-300"
                >
                  <Trophy className="h-2.5 w-2.5" />
                  100
                </span>
              ) : !isOwned ? (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-white/8 px-1.5 py-0.5 font-mono text-[9px] font-bold text-sky-200/80">
                  {GEMS_SYSTEM_IN_PROGRESS ? (
                    <Lock className="h-2.5 w-2.5 text-amber-300" />
                  ) : (
                    <>
                      <FreshGemShard size={10} />
                      {item.price}
                    </>
                  )}
                </span>
              ) : null}
            </div>

            <div className="flex flex-col items-center pt-1 pb-0.5 text-center">
              {sw ? (
                <div className="flex h-11 w-11 flex-col items-center justify-center rounded-xl border border-white/15 bg-slate-900/75 p-1">
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
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20"
                  style={{ background: `radial-gradient(circle at 30% 30%, ${item.accent}, rgba(15,23,42,0.85))` }}
                >
                  {category === 'hat' ? (
                    <Crown className="h-4.5 w-4.5 text-white" />
                  ) : category === 'back' ? (
                    <Feather className="h-4.5 w-4.5 text-white" />
                  ) : category === 'pet' ? (
                    <Bot className="h-4.5 w-4.5 text-white" />
                  ) : category === 'trail' ? (
                    <Sparkles className="h-4.5 w-4.5 text-white" />
                  ) : (
                    <Smile className="h-4.5 w-4.5 text-white" />
                  )}
                </div>
              )}

              <div className="mt-2 w-full truncate text-[11px] font-extrabold text-white">
                {lang === 'pl' ? item.namePl : item.nameEn}
              </div>
            </div>

            {!isOwned && !isRewardOnly && !GEMS_SYSTEM_IN_PROGRESS && (
              <button
                type="button"
                disabled={!canAfford}
                onClick={(e) => handleBuySingle(e, category, item.id, item.price)}
                className={`mt-2 flex w-full items-center justify-center gap-1 rounded-xl py-1 text-[10px] font-extrabold transition cursor-pointer ${
                  canAfford
                    ? 'bg-sky-400 text-slate-950 hover:bg-sky-300'
                    : 'bg-white/8 text-sky-200/50 cursor-not-allowed'
                }`}
              >
                <FreshGemShard size={10} />
                <span>{item.price}</span>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <aside
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute inset-y-2.5 z-40 flex w-[min(324px,calc(100vw-24px))] flex-col overflow-hidden rounded-3xl border border-white/15 bg-slate-950/90 text-sky-50 shadow-2xl backdrop-blur-2xl"
      style={{ right: 'max(0.65rem, env(safe-area-inset-right))' }}
    >
      {/* Compact Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15 border border-sky-400/25">
            <Shirt className="h-4 w-4 text-sky-300" />
          </div>
          <span className="font-display text-sm font-black text-white">
            {lang === 'pl' ? 'Szatnia awatarów' : 'Avatar Wardrobe'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div
            title={GEMS_SYSTEM_IN_PROGRESS ? LOCALES[lang].gemsNotice.short : `${freshGems} FreshGems`}
            className={`flex items-center gap-1 rounded-xl border px-2 py-1 text-[11px] font-extrabold ${
              GEMS_SYSTEM_IN_PROGRESS
                ? 'bg-amber-500/12 border-amber-400/30 text-amber-200'
                : 'bg-white/8 border-white/10 text-sky-100'
            }`}
          >
            <FreshGemShard size={12} />
            {GEMS_SYSTEM_IN_PROGRESS ? <Lock className="h-3 w-3" /> : <span>{freshGems}</span>}
          </div>
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

      {/* Icon-Only Category Tabs */}
      <div className="grid shrink-0 grid-cols-7 gap-1 border-b border-white/10 bg-slate-950/50 p-1.5">
        {tabs.map((tb) => {
          const Icon = tb.icon
          const active = tab === tb.id
          return (
            <button
              key={tb.id}
              type="button"
              title={tb.label}
              aria-label={tb.label}
              onClick={() => {
                setTab(tb.id)
                sfx.playClick()
              }}
              className={`flex h-9 items-center justify-center rounded-xl transition cursor-pointer ${
                active ? 'bg-sky-400 text-slate-950 shadow' : 'text-sky-100/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          )
        })}
      </div>

      {/* Scrollable Catalog */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {tab === 'outfits' &&
          renderGrid('outfit', OUTFIT_CATALOG, unlockedOutfits, ownedAvatar.outfitId, previewAvatar.outfitId)}
        {tab === 'hats' &&
          renderGrid('hat', HAT_CATALOG, unlockedHats, ownedAvatar.hatId, previewAvatar.hatId)}
        {tab === 'faces' &&
          renderGrid('face', FACE_CATALOG, unlockedFaces, ownedAvatar.faceId, previewAvatar.faceId)}
        {tab === 'backs' &&
          renderGrid(
            'back',
            BACK_CATALOG,
            unlockedBacks,
            (ownedAvatar.backId ?? 'none') as BackId,
            (previewAvatar.backId ?? 'none') as BackId,
          )}
        {tab === 'pets' &&
          renderGrid(
            'pet',
            PET_CATALOG,
            unlockedPets,
            (ownedAvatar.petId ?? 'none') as PetId,
            (previewAvatar.petId ?? 'none') as PetId,
          )}
        {tab === 'trails' &&
          renderGrid(
            'trail',
            TRAIL_CATALOG,
            unlockedTrails,
            (ownedAvatar.trailId ?? 'none') as TrailId,
            (previewAvatar.trailId ?? 'none') as TrailId,
          )}
        {tab === 'skin' && (
          <div className="grid grid-cols-4 gap-2">
            {SKIN_SWATCHES.map((sw) => {
              const active = previewAvatar.skinColor === sw.hex
              return (
                <button
                  key={sw.hex}
                  type="button"
                  title={lang === 'pl' ? sw.namePl : sw.nameEn}
                  onClick={() => {
                    onSkinChange(sw.hex)
                    onPreviewChange({ ...previewAvatar, skinColor: sw.hex })
                    sfx.playChatPop()
                  }}
                  className={`flex h-12 items-center justify-center rounded-2xl border-2 transition cursor-pointer ${
                    active ? 'border-sky-400 scale-105 shadow-lg' : 'border-white/20 hover:scale-105'
                  }`}
                  style={{ background: sw.hex }}
                >
                  {active && <Check className="h-4 w-4 text-slate-950 drop-shadow" />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Compact Try-On Strip */}
      {triedUnowned.length > 0 && (
        <div className="shrink-0 border-t border-amber-400/30 bg-amber-500/12 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-amber-200">
            {hasRewardOnlyTried && purchasableTried.length === 0 ? (
              <>
                <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                <span className="truncate">{lang === 'pl' ? 'Nagroda: Obby 100' : 'Reward: Obby 100'}</span>
              </>
            ) : GEMS_SYSTEM_IN_PROGRESS ? (
              <>
                <Eye className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                <span className="truncate">{lang === 'pl' ? 'Podgląd (Gems wkrótce)' : 'Preview (Gems soon)'}</span>
              </>
            ) : (
              <button
                type="button"
                disabled={freshGems < totalTryOnPrice}
                onClick={handleBuyBundle}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-400 px-3 py-1 text-xs font-extrabold text-slate-950 disabled:opacity-40 cursor-pointer"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                <span>{totalTryOnPrice}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onPreviewChange({ ...ownedAvatar })
              sfx.playClick()
            }}
            title={t.resetPreview}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-sky-100 hover:bg-white/20 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Compact Footer: 4 Pose Icons + Done */}
      <div className="shrink-0 border-t border-white/10 bg-slate-950/65 px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {poseButtons.map((pb) => {
            const Icon = pb.icon
            return (
              <button
                key={pb.pose}
                type="button"
                onClick={() => onTestEmote(pb.pose)}
                title={pb.label}
                aria-label={pb.label}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/8 text-sky-100 hover:bg-white/16 active:scale-95 transition cursor-pointer"
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 rounded-xl bg-sky-500 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-sky-400 active:scale-95 transition cursor-pointer"
        >
          <Check className="h-3.5 w-3.5 stroke-[2.5]" />
          <span>{tw.liveWardrobeDone}</span>
        </button>
      </div>
    </aside>
  )
}
