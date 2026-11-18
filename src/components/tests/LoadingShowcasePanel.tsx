import React, { useEffect, useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Moon,
  Sparkles,
  Sun,
  X,
} from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from '../../data/brandTheme'
import { Lang } from '../../data/locales'
import { FreshBloxLogo, FreshBloxWordmark } from '../brand/FreshBloxBrand'
import {
  FRESH_LOADERS,
  FreshLoaderAnimation,
  LoaderCategory,
  LoaderMeta,
  LoaderPresetId,
} from '../loading/FreshLoaders'

interface LoadingShowcasePanelProps {
  mode: ThemeMode
  lang: Lang
  selectedLoader: LoaderPresetId
  onSelectLoader: (id: LoaderPresetId) => void
}

type CategoryFilter = 'all' | LoaderCategory

const SIM_STEPS_PL = [
  'Łączenie z serwerem FreshBlox…',
  'Wczytywanie geometrii świata 3D…',
  'Generowanie tekstur PBR i oświetlenia…',
  'Synchronizacja awatarów 3D…',
  'Gotowe — wchodzisz do świata!',
]

const SIM_STEPS_EN = [
  'Connecting to FreshBlox server…',
  'Loading 3D world geometry…',
  'Generating PBR materials & lighting…',
  'Syncing 3D avatars…',
  'Ready — entering world!',
]

export const LoadingShowcasePanel: React.FC<LoadingShowcasePanelProps> = ({
  mode,
  lang,
  selectedLoader,
  onSelectLoader,
}) => {
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [previewId, setPreviewId] = useState<LoaderPresetId | null>(null)
  const [previewMode, setPreviewMode] = useState<ThemeMode>(mode)
  const [simProgress, setSimProgress] = useState(0)

  const tokens = getThemeTokens(mode)
  const isDark = mode === 'dark'
  const isPl = lang === 'pl'

  const panelSurface = isDark ? '#0B1323' : '#FFFFFF'
  const panelBorder = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(14, 165, 233, 0.18)'
  const stageBg = isDark
    ? 'radial-gradient(circle at 50% 42%, rgba(14, 165, 233, 0.14), rgba(5, 11, 23, 0.96) 72%)'
    : 'radial-gradient(circle at 50% 42%, rgba(56, 189, 248, 0.18), rgba(240, 249, 255, 0.96) 72%)'

  useEffect(() => {
    setPreviewMode(mode)
  }, [mode])

  // Simulated loading progress inside fullscreen preview modal
  useEffect(() => {
    if (!previewId) return
    setSimProgress(0)
    const id = window.setInterval(() => {
      setSimProgress((p) => (p >= 100 ? 0 : Math.min(100, p + 2)))
    }, 90)
    return () => window.clearInterval(id)
  }, [previewId])

  // Keyboard navigation in fullscreen preview (←, →, Esc)
  useEffect(() => {
    if (!previewId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewId(null)
      } else if (e.key === 'ArrowRight') {
        const idx = FRESH_LOADERS.findIndex((l) => l.id === previewId)
        setPreviewId(FRESH_LOADERS[(idx + 1) % FRESH_LOADERS.length].id)
      } else if (e.key === 'ArrowLeft') {
        const idx = FRESH_LOADERS.findIndex((l) => l.id === previewId)
        setPreviewId(FRESH_LOADERS[(idx - 1 + FRESH_LOADERS.length) % FRESH_LOADERS.length].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewId])

  const filtered =
    category === 'all' ? FRESH_LOADERS : FRESH_LOADERS.filter((item) => item.category === category)

  const activeMeta = FRESH_LOADERS.find((l) => l.id === selectedLoader) ?? FRESH_LOADERS[0]
  const previewMeta: LoaderMeta | null = previewId
    ? FRESH_LOADERS.find((l) => l.id === previewId) ?? null
    : null

  const catLabels: Record<CategoryFilter, { pl: string; en: string }> = {
    all: { pl: 'Wszystkie', en: 'All' },
    blocks: { pl: 'Klocki / 3D', en: 'Blocks / 3D' },
    minimal: { pl: 'Minimal', en: 'Minimal' },
    gaming: { pl: 'Gaming / HUD', en: 'Gaming / HUD' },
    brand: { pl: 'Brand', en: 'Brand' },
  }

  const catBadgeColor: Record<LoaderCategory, string> = {
    blocks: '#38BDF8',
    minimal: '#94A3B8',
    gaming: '#34D399',
    brand: '#F59E0B',
  }

  const countFor = (cat: CategoryFilter) =>
    cat === 'all' ? FRESH_LOADERS.length : FRESH_LOADERS.filter((l) => l.category === cat).length

  const simSteps = isPl ? SIM_STEPS_PL : SIM_STEPS_EN
  const simStepText = simSteps[Math.min(simSteps.length - 1, Math.floor((simProgress / 100) * simSteps.length))]

  const stepPreview = (delta: number) => {
    if (!previewId) return
    const idx = FRESH_LOADERS.findIndex((l) => l.id === previewId)
    const next = FRESH_LOADERS[(idx + delta + FRESH_LOADERS.length) % FRESH_LOADERS.length]
    setPreviewId(next.id)
  }

  return (
    <section
      className="space-y-4 rounded-xl border p-4"
      style={{ background: panelSurface, borderColor: panelBorder }}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-sky-400" />
            <h2 className="text-xs font-extrabold uppercase tracking-wider" style={{ color: tokens.textPrimary }}>
              {isPl ? 'Galeria animacji ładowania' : 'Loading Animations Showcase'}
            </h2>
            <span
              className="rounded-md border px-2 py-0.5 font-mono text-[10px] font-black"
              style={{
                background: 'rgba(14, 165, 233, 0.14)',
                borderColor: 'rgba(56, 189, 248, 0.35)',
                color: ARCTIC_SKY.skyBright,
              }}
            >
              {FRESH_LOADERS.length} {isPl ? 'wariantów' : 'presets'}
            </span>
          </div>
          <p className="text-[11px]" style={{ color: tokens.textSecondary }}>
            {isPl
              ? `Aktywna: ${activeMeta.code} (${activeMeta.namePl}) — kliknij „Pełny ekran”, aby obejrzeć symulację wejścia do gry.`
              : `Active: ${activeMeta.code} (${activeMeta.nameEn}) — click Fullscreen to preview as a real loading screen.`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setPreviewId(selectedLoader)}
          className="inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold text-white transition hover:brightness-110 cursor-pointer"
          style={{ background: ARCTIC_SKY.skyMain }}
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <span>
            {isPl ? `Testuj ${activeMeta.code} na pełnym ekranie` : `Fullscreen ${activeMeta.code}`}
          </span>
        </button>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(['all', 'blocks', 'minimal', 'gaming', 'brand'] as CategoryFilter[]).map((cat) => {
          const active = category === cat
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer"
              style={{
                background: active ? 'rgba(14, 165, 233, 0.18)' : 'transparent',
                borderColor: active ? 'rgba(56, 189, 248, 0.45)' : panelBorder,
                color: active ? ARCTIC_SKY.skyBright : tokens.textSecondary,
              }}
            >
              <span>{isPl ? catLabels[cat].pl : catLabels[cat].en}</span>
              <span className="font-mono text-[10px] opacity-80">{countFor(cat)}</span>
            </button>
          )
        })}
      </div>

      {/* 16 Loading Cards Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((item) => {
          const isSelected = item.id === selectedLoader
          const catColor = catBadgeColor[item.category]
          return (
            <div
              key={item.id}
              className="group flex flex-col overflow-hidden rounded-xl border transition-all"
              style={{
                background: isDark ? '#0D172B' : '#F8FBFF',
                borderColor: isSelected ? ARCTIC_SKY.skyBright : panelBorder,
                boxShadow: isSelected ? '0 0 0 1px rgba(56, 189, 248, 0.45)' : 'none',
              }}
            >
              {/* Animation Stage */}
              <div
                onClick={() => setPreviewId(item.id)}
                className="relative flex h-32 w-full items-center justify-center overflow-hidden cursor-pointer"
                style={{ background: stageBg }}
              >
                {/* Top-left code badge */}
                <span
                  className="absolute left-2 top-2 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-black tracking-wider"
                  style={{
                    background: isDark ? 'rgba(7, 13, 25, 0.8)' : 'rgba(255, 255, 255, 0.88)',
                    borderColor: isSelected ? 'rgba(56, 189, 248, 0.5)' : panelBorder,
                    color: isSelected ? ARCTIC_SKY.skyBright : tokens.textPrimary,
                  }}
                >
                  {item.code}
                </span>

                {/* Top-right category chip */}
                <span
                  className="absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
                  style={{
                    background: `${catColor}20`,
                    color: catColor,
                  }}
                >
                  {isPl ? catLabels[item.category].pl : catLabels[item.category].en}
                </span>

                <FreshLoaderAnimation id={item.id} size="md" mode={mode} />

                {/* Subtle hover fullscreen hint */}
                <div className="pointer-events-none absolute bottom-1.5 right-2 flex items-center gap-1 rounded-md bg-slate-950/70 px-1.5 py-0.5 text-[9px] font-bold text-sky-200 opacity-0 transition group-hover:opacity-100">
                  <Maximize2 className="h-2.5 w-2.5" />
                  <span>{isPl ? 'Powiększ' : 'Expand'}</span>
                </div>
              </div>

              {/* Meta & Actions */}
              <div className="flex flex-1 flex-col justify-between gap-2.5 p-3">
                <div>
                  <h3 className="truncate text-xs font-extrabold" style={{ color: tokens.textPrimary }}>
                    {isPl ? item.namePl : item.nameEn}
                  </h3>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug" style={{ color: tokens.textSecondary }}>
                    {isPl ? item.descPl : item.descEn}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSelectLoader(item.id)}
                    className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border text-[11px] font-extrabold transition cursor-pointer"
                    style={{
                      background: isSelected ? ARCTIC_SKY.skyMain : 'transparent',
                      borderColor: isSelected ? ARCTIC_SKY.skyMain : panelBorder,
                      color: isSelected ? '#FFFFFF' : tokens.textPrimary,
                    }}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                    <span>{isSelected ? (isPl ? 'Wybrana' : 'Selected') : isPl ? 'Wybierz' : 'Select'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewId(item.id)}
                    className="inline-flex h-7 w-8 shrink-0 items-center justify-center rounded-lg border transition hover:brightness-110 cursor-pointer"
                    style={{ borderColor: panelBorder, color: tokens.textSecondary }}
                    title={isPl ? 'Podgląd pełnoekranowy' : 'Fullscreen preview'}
                    aria-label={isPl ? 'Podgląd pełnoekranowy' : 'Fullscreen preview'}
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* === FULLSCREEN REALISTIC LOADING SCREEN SIMULATOR === */}
      {previewMeta && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-between p-5 sm:p-8"
          style={{
            background:
              previewMode === 'dark'
                ? 'radial-gradient(circle at 50% 42%, #0C2344 0%, #070D19 64%, #040812 100%)'
                : 'radial-gradient(circle at 50% 42%, #E0F2FE 0%, #EFF6FF 65%, #DBEAFE 100%)',
            color: previewMode === 'dark' ? '#F8FAFC' : '#0F172A',
          }}
        >
          {/* Top toolbar */}
          <div className="flex w-full max-w-4xl items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="rounded-lg border px-2.5 py-1 font-mono text-xs font-black"
                style={{
                  background: previewMode === 'dark' ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.8)',
                  borderColor: 'rgba(56, 189, 248, 0.35)',
                  color: ARCTIC_SKY.skyMain,
                }}
              >
                {previewMeta.code}
              </span>
              <span className="text-xs sm:text-sm font-extrabold">
                {isPl ? previewMeta.namePl : previewMeta.nameEn}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPreviewMode((m) => (m === 'dark' ? 'light' : 'dark'))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border transition cursor-pointer"
                style={{
                  background: previewMode === 'dark' ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.85)',
                  borderColor: 'rgba(148, 163, 184, 0.25)',
                }}
                title={isPl ? 'Zmień tło Jasne/Ciemne' : 'Toggle Dark/Light backdrop'}
              >
                {previewMode === 'dark' ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4 text-sky-600" />}
              </button>

              <button
                type="button"
                onClick={() => onSelectLoader(previewMeta.id)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-extrabold text-white transition cursor-pointer"
                style={{
                  background: selectedLoader === previewMeta.id ? '#10B981' : ARCTIC_SKY.skyMain,
                }}
              >
                <Check className="h-3.5 w-3.5" />
                <span>
                  {selectedLoader === previewMeta.id
                    ? isPl
                      ? 'Aktywna'
                      : 'Active'
                    : isPl
                    ? 'Wybierz tę'
                    : 'Use this'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewId(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border transition cursor-pointer"
                style={{
                  background: previewMode === 'dark' ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.85)',
                  borderColor: 'rgba(148, 163, 184, 0.25)',
                }}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Center simulated loading screen */}
          <div className="flex flex-col items-center gap-7 text-center">
            <div className="flex items-center gap-2.5 opacity-95">
              <FreshBloxLogo size={38} />
              <FreshBloxWordmark mode={previewMode} size="md" />
            </div>

            <div className="flex h-28 w-28 items-center justify-center">
              <FreshLoaderAnimation id={previewMeta.id} size="lg" mode={previewMode} />
            </div>

            <div className="w-72 max-w-[82vw] space-y-2">
              <div
                className="h-1.5 w-full overflow-hidden rounded-full"
                style={{
                  background: previewMode === 'dark' ? 'rgba(148, 163, 184, 0.16)' : 'rgba(14, 165, 233, 0.16)',
                }}
              >
                <div
                  className="h-full rounded-full transition-all duration-100"
                  style={{
                    width: `${simProgress}%`,
                    background: `linear-gradient(90deg, ${ARCTIC_SKY.skyDeep}, ${ARCTIC_SKY.skyBright})`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold opacity-75">
                <span className="truncate">{simStepText}</span>
                <span className="font-mono">{simProgress}%</span>
              </div>
            </div>
          </div>

          {/* Bottom prev / next switcher */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => stepPreview(-1)}
              className="inline-flex h-9 items-center gap-1 rounded-xl border px-3 text-xs font-extrabold transition cursor-pointer"
              style={{
                background: previewMode === 'dark' ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.85)',
                borderColor: 'rgba(148, 163, 184, 0.25)',
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>{isPl ? 'Poprzednia' : 'Prev'}</span>
            </button>

            <span className="px-2 font-mono text-xs font-bold opacity-70">
              {FRESH_LOADERS.findIndex((l) => l.id === previewMeta.id) + 1} / {FRESH_LOADERS.length}
            </span>

            <button
              type="button"
              onClick={() => stepPreview(1)}
              className="inline-flex h-9 items-center gap-1 rounded-xl border px-3 text-xs font-extrabold transition cursor-pointer"
              style={{
                background: previewMode === 'dark' ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.85)',
                borderColor: 'rgba(148, 163, 184, 0.25)',
              }}
            >
              <span>{isPl ? 'Następna' : 'Next'}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
