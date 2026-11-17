import React, { useState } from 'react'
import {
  Activity,
  Box,
  Cpu,
  Flag,
  FlaskConical,
  Gauge,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  VolumeX,
  Zap,
} from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from '../../data/brandTheme'
import { Lang } from '../../data/locales'
import { WorldKind } from '../../data/catalog'
import { hasAdminAccess, PlayerProfile } from '../../store/usePlayerStore'
import { DEFAULT_LAB_FLAGS, FreshLabFlags } from '../../lib/labFlags'
import { LoadingShowcasePanel } from './LoadingShowcasePanel'
import { LoaderPresetId } from '../loading/FreshLoaders'
import {
  regenerateWorldThumbnails,
  useWorldThumbnails,
  WorldPreviewKey,
  WorldThumbnailMap,
} from '../../engine/worldThumbnails'
import { isSupabaseConfigured } from '../../lib/supabase'

type BooleanLabFlagKey =
  | 'showPerfOverlay'
  | 'unlockAllObbyStages'
  | 'turboMovement'
  | 'verboseDebugBadges'

type LabSubTab = 'loaders' | 'tools'

interface TestLabViewProps {
  profile: PlayerProfile
  mode: ThemeMode
  lang: Lang
  flags: FreshLabFlags
  onChangeFlags: (next: FreshLabFlags) => void
  onLaunchObbyStage: (stage: number) => void
  onEnterWorld: (world: WorldKind, roomId: string) => void
}

const PRESET_STAGES = [1, 10, 25, 50, 75, 90, 99, 100]

const PREVIEW_ITEMS: { key: WorldPreviewKey; label: string }[] = [
  { key: 'lobby', label: 'Lobby Główne' },
  { key: 'obby', label: 'Test Obby 100' },
  { key: 'sky-drift', label: 'Sky Drift' },
  { key: 'parkour-arena', label: 'Parkour Arena' },
]

export const TestLabView: React.FC<TestLabViewProps> = ({
  profile,
  mode,
  lang,
  flags,
  onChangeFlags,
  onLaunchObbyStage,
  onEnterWorld,
}) => {
  const initialThumbs = useWorldThumbnails()
  const [localThumbs, setLocalThumbs] = useState<WorldThumbnailMap | null>(null)
  const [renderingThumbs, setRenderingThumbs] = useState(false)
  const [lastRenderMs, setLastRenderMs] = useState<number | null>(null)
  const [customStage, setCustomStage] = useState<string>(String(profile.obbyStage))
  const [subTab, setSubTab] = useState<LabSubTab>('loaders')

  const thumbs = localThumbs ?? initialThumbs
  const tokens = getThemeTokens(mode)
  const isDark = mode === 'dark'
  const isPl = lang === 'pl'

  const panelSurface = isDark ? '#0B1323' : '#FFFFFF'
  const panelBorder = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(14, 165, 233, 0.18)'
  const subtleSurface = isDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(14, 165, 233, 0.06)'

  if (!hasAdminAccess(profile.role)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <ShieldAlert className="h-10 w-10 text-rose-400" />
        <p className="text-sm font-extrabold" style={{ color: tokens.textPrimary }}>
          {isPl ? 'Zakładka Testy jest dostępna tylko dla administracji' : 'Test Lab is restricted to staff'}
        </p>
      </div>
    )
  }

  const toggleFlag = (key: BooleanLabFlagKey) => {
    onChangeFlags({ ...flags, [key]: !flags[key] })
  }

  const handleSelectLoader = (loaderPreset: LoaderPresetId) => {
    onChangeFlags({ ...flags, loaderPreset })
  }

  const handleRerenderThumbs = async () => {
    setRenderingThumbs(true)
    const t0 = performance.now()
    const fresh = await regenerateWorldThumbnails()
    setLastRenderMs(Math.round(performance.now() - t0))
    setLocalThumbs(fresh)
    setRenderingThumbs(false)
  }

  const handleCustomStageLaunch = (e: React.FormEvent) => {
    e.preventDefault()
    const num = Math.max(1, Math.min(100, Number.parseInt(customStage, 10) || 1))
    onLaunchObbyStage(num)
  }

  const flagItems: Array<{
    key: BooleanLabFlagKey
    icon: React.ComponentType<{ className?: string }>
    title: string
    desc: string
    accent: string
  }> = [
    {
      key: 'showPerfOverlay',
      icon: Gauge,
      title: isPl ? 'Telemetria FPS (3D)' : '3D FPS Telemetry',
      desc: isPl ? 'Nakładka wydajności podczas testów map 3D' : 'Performance overlay while testing 3D maps',
      accent: '#38BDF8',
    },
    {
      key: 'unlockAllObbyStages',
      icon: Flag,
      title: isPl ? 'Odblokuj skok Obby 1–100' : 'Unlock Obby Stage Jump 1–100',
      desc: isPl ? 'Pozwala testować dowolny etap niezależnie od postępu' : 'Jump to any stage regardless of progress',
      accent: '#F59E0B',
    },
    {
      key: 'turboMovement',
      icon: Zap,
      title: isPl ? 'Tryb Turbo (testy)' : 'Turbo Movement (testing)',
      desc: isPl ? 'Szybsze poruszanie po mapach podczas testów' : 'Faster traversal when testing worlds',
      accent: '#34D399',
    },
    {
      key: 'verboseDebugBadges',
      icon: Cpu,
      title: isPl ? 'Znaczniki Debug UI' : 'Verbose Debug Badges',
      desc: isPl ? 'Dodatkowe informacje techniczne w interfejsie' : 'Extra diagnostic indicators in UI',
      accent: '#A78BFA',
    },
  ]

  return (
    <div className="w-full space-y-5 p-4 sm:p-5 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl border"
            style={{
              background: 'rgba(16, 185, 129, 0.16)',
              borderColor: 'rgba(52, 211, 153, 0.42)',
              color: '#34D399',
            }}
          >
            <FlaskConical className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-lg sm:text-xl font-extrabold" style={{ color: tokens.textPrimary }}>
              {isPl ? 'Testy' : 'Test Lab'}
            </h1>
            <span
              className="rounded-md border px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-emerald-300"
              style={{
                background: 'rgba(16, 185, 129, 0.14)',
                borderColor: 'rgba(52, 211, 153, 0.35)',
              }}
            >
              SANDBOX
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onChangeFlags({ ...DEFAULT_LAB_FLAGS })}
          className="inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-extrabold transition hover:brightness-110 cursor-pointer"
          style={{ background: panelSurface, borderColor: panelBorder, color: tokens.textSecondary }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>{isPl ? 'Reset flag' : 'Reset flags'}</span>
        </button>
      </div>

      {/* System Status Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] font-bold"
          style={{ background: panelSurface, borderColor: panelBorder, color: tokens.textPrimary }}
        >
          <Activity className="h-3.5 w-3.5 text-emerald-400" />
          Supabase: {isSupabaseConfigured ? 'LIVE' : 'OFFLINE'}
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] font-bold"
          style={{ background: panelSurface, borderColor: panelBorder, color: tokens.textSecondary }}
        >
          <VolumeX className="h-3.5 w-3.5 text-amber-400" />
          Audio: {isPl ? 'WYŁĄCZONE (później)' : 'DISABLED (later)'}
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] font-bold"
          style={{ background: panelSurface, borderColor: panelBorder, color: tokens.textSecondary }}
        >
          <Sparkles className="h-3.5 w-3.5 text-sky-400" />
          Role: {profile.role.toUpperCase()}
        </span>
      </div>

      {/* Sub-navigation tabs inside Test Lab */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSubTab('loaders')}
          className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-extrabold transition cursor-pointer"
          style={{
            background: subTab === 'loaders' ? 'rgba(14, 165, 233, 0.16)' : panelSurface,
            borderColor: subTab === 'loaders' ? 'rgba(56, 189, 248, 0.45)' : panelBorder,
            color: subTab === 'loaders' ? ARCTIC_SKY.skyBright : tokens.textSecondary,
          }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>{isPl ? 'Animacje ładowania (16)' : 'Loading Animations (16)'}</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('tools')}
          className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-extrabold transition cursor-pointer"
          style={{
            background: subTab === 'tools' ? 'rgba(16, 185, 129, 0.16)' : panelSurface,
            borderColor: subTab === 'tools' ? 'rgba(52, 211, 153, 0.45)' : panelBorder,
            color: subTab === 'tools' ? '#34D399' : tokens.textSecondary,
          }}
        >
          <FlaskConical className="h-3.5 w-3.5" />
          <span>{isPl ? 'Narzędzia i światy 3D' : '3D Tools & Flags'}</span>
        </button>
      </div>

      {subTab === 'loaders' && (
        <LoadingShowcasePanel
          mode={mode}
          lang={lang}
          selectedLoader={flags.loaderPreset}
          onSelectLoader={handleSelectLoader}
        />
      )}

      {subTab === 'tools' && (
      <>
      <div className="grid gap-4 lg:grid-cols-12">
        {/* === LEFT: FEATURE FLAGS & EXPERIMENTS === */}
        <section
          className="space-y-3 rounded-xl border p-4 lg:col-span-6"
          style={{ background: panelSurface, borderColor: panelBorder }}
        >
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-emerald-400" />
            <h2 className="text-xs font-extrabold uppercase tracking-wider" style={{ color: tokens.textPrimary }}>
              {isPl ? 'Flagi eksperymentalne' : 'Experimental Flags'}
            </h2>
          </div>

          <div className="space-y-2">
            {flagItems.map((item) => {
              const Icon = item.icon
              const enabled = flags[item.key]
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleFlag(item.key)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:brightness-110 cursor-pointer"
                  style={{
                    background: enabled ? `${item.accent}14` : subtleSurface,
                    borderColor: enabled ? `${item.accent}48` : panelBorder,
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `${item.accent}1E`, color: item.accent }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-extrabold" style={{ color: tokens.textPrimary }}>
                        {item.title}
                      </div>
                      <div className="truncate text-[11px]" style={{ color: tokens.textSecondary }}>
                        {item.desc}
                      </div>
                    </div>
                  </div>

                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-black uppercase"
                    style={{
                      background: enabled ? item.accent : 'rgba(148, 163, 184, 0.2)',
                      color: enabled ? '#0F172A' : tokens.textSecondary,
                    }}
                  >
                    {enabled ? 'ON' : 'OFF'}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* === RIGHT: QUICK WORLD / STAGE TEST LAUNCHERS === */}
        <section
          className="space-y-4 rounded-xl border p-4 lg:col-span-6"
          style={{ background: panelSurface, borderColor: panelBorder }}
        >
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-sky-400" />
            <h2 className="text-xs font-extrabold uppercase tracking-wider" style={{ color: tokens.textPrimary }}>
              {isPl ? 'Szybkie testy światów' : 'Quick World Launchers'}
            </h2>
          </div>

          {/* Direct Obby Stage Jump */}
          <div className="space-y-2.5 rounded-xl border p-3" style={{ background: subtleSurface, borderColor: panelBorder }}>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold" style={{ color: tokens.textPrimary }}>
                <Flag className="h-3.5 w-3.5 text-amber-400" />
                {isPl ? 'Skocz na etap Test Obby 100' : 'Launch Obby 100 at Stage'}
              </span>
              <form onSubmit={handleCustomStageLaunch} className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={customStage}
                  onChange={(e) => setCustomStage(e.target.value)}
                  className="h-7 w-14 rounded-lg border bg-transparent text-center font-mono text-xs font-bold outline-none"
                  style={{ borderColor: panelBorder, color: tokens.textPrimary }}
                />
                <button
                  type="submit"
                  className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px] font-extrabold text-slate-950 cursor-pointer"
                  style={{ background: '#F59E0B' }}
                >
                  <Play className="h-3 w-3 fill-current" />
                  GO
                </button>
              </form>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRESET_STAGES.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => onLaunchObbyStage(st)}
                  className="rounded-lg border px-2.5 py-1 font-mono text-xs font-extrabold transition hover:scale-105 cursor-pointer"
                  style={{
                    background: st === 100 ? 'rgba(245, 158, 11, 0.2)' : panelSurface,
                    borderColor: st === 100 ? 'rgba(245, 158, 11, 0.5)' : panelBorder,
                    color: st === 100 ? '#FBBF24' : tokens.textPrimary,
                  }}
                >
                  #{st}
                </button>
              ))}
            </div>
          </div>

          {/* Private Dev Lobby */}
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3" style={{ background: subtleSurface, borderColor: panelBorder }}>
            <div className="flex items-center gap-2.5">
              <Box className="h-4 w-4 text-sky-400" />
              <div>
                <div className="text-xs font-extrabold" style={{ color: tokens.textPrimary }}>
                  {isPl ? 'Prywatny pokój testowy Lobby' : 'Private Dev Lobby Room'}
                </div>
                <div className="font-mono text-[11px]" style={{ color: tokens.textSecondary }}>
                  #DEV-LAB
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onEnterWorld('lobby', 'DEV-LAB')}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-extrabold text-white transition hover:brightness-110 cursor-pointer"
              style={{ background: ARCTIC_SKY.skyMain }}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{isPl ? 'Wejdź' : 'Enter'}</span>
            </button>
          </div>
        </section>
      </div>

      {/* === 3D MAP RENDERER TEST BENCH === */}
      <section
        className="space-y-3 rounded-xl border p-4"
        style={{ background: panelSurface, borderColor: panelBorder }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-sky-400" />
            <h2 className="text-xs font-extrabold uppercase tracking-wider" style={{ color: tokens.textPrimary }}>
              {isPl ? 'Podgląd renderów 3D z lotu ptaka' : '3D Bird\'s-Eye Render Bench'}
            </h2>
            {lastRenderMs !== null && (
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                {lastRenderMs} ms
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={renderingThumbs}
            onClick={() => void handleRerenderThumbs()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-extrabold transition hover:brightness-110 cursor-pointer disabled:opacity-60"
            style={{ background: subtleSurface, borderColor: panelBorder, color: tokens.textPrimary }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${renderingThumbs ? 'animate-spin' : ''}`} />
            <span>{isPl ? 'Przerenderuj 3D' : 'Re-render 3D'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PREVIEW_ITEMS.map((item) => (
            <div
              key={item.key}
              className="overflow-hidden rounded-xl border"
              style={{ background: subtleSurface, borderColor: panelBorder }}
            >
              <div className="aspect-[16/9] w-full bg-slate-900">
                {thumbs[item.key] && (
                  <img
                    src={thumbs[item.key]}
                    alt={item.label}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                )}
              </div>
              <div className="flex items-center justify-between px-2.5 py-2 text-[11px] font-bold">
                <span style={{ color: tokens.textPrimary }}>{item.label}</span>
                <span className="font-mono text-[10px]" style={{ color: tokens.textSecondary }}>
                  960×540
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
      </>
      )}
    </div>
  )
}
