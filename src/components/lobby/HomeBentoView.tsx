import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  CheckCircle2,
  Clock,
  Crown,
  Disc,
  Flame,
  Flag,
  Gamepad2,
  Lock,
  Orbit,
  Play,
  RefreshCw,
  Shirt,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from '../../data/brandTheme'
import { Lang } from '../../data/locales'
import { DAILY_QUESTS, getRankForXp, QuestDef, WorldKind } from '../../data/catalog'
import { FreshGemShard } from '../brand/FreshBloxBrand'
import { CloudPlayerSummary, getAccountRoleMeta, PlayerProfile } from '../../store/usePlayerStore'
import { useWorldThumbnails, WorldPreviewKey } from '../../engine/worldThumbnails'
import { fetchWorldLiveStats, WorldLiveStats } from '../../lib/adminApi'

interface HomeBentoViewProps {
  profile: PlayerProfile
  mode: ThemeMode
  lang: Lang
  searchQuery?: string
  partyCode?: string | null
  partyCount?: number
  onOpenParty?: () => void
  onOpenPrivateRoom?: (world?: WorldKind) => void
  onEnterWorld: (world: WorldKind, roomId: string) => void
  onOpenAvatar: () => void
  onOpenProfile?: () => void
  onClaimQuest: (questId: QuestDef['id']) => void
  onFetchLeaderboard: () => Promise<CloudPlayerSummary[]>
}

interface WorldCardSpec {
  id: WorldPreviewKey
  worldKind?: WorldKind
  roomId?: string
  titlePl: string
  titleEn: string
  tagPl: string
  tagEn: string
  live: boolean
  accent: string
  fallbackBg: string
}

const WORLD_CARDS: WorldCardSpec[] = [
  {
    id: 'lobby',
    worldKind: 'lobby',
    roomId: 'PUBLIC-1',
    titlePl: 'Lobby Główne',
    titleEn: 'Main Lobby',
    tagPl: 'Hub 3D',
    tagEn: '3D Hub',
    live: true,
    accent: '#38BDF8',
    fallbackBg: 'linear-gradient(135deg, #0C2544 0%, #0EA5E9 100%)',
  },
  {
    id: 'obby',
    worldKind: 'obby',
    roomId: 'OBBY-1',
    titlePl: 'Test Obby 100',
    titleEn: 'Test Obby 100',
    tagPl: '100 Etapów',
    tagEn: '100 Stages',
    live: true,
    accent: '#F59E0B',
    fallbackBg: 'linear-gradient(135deg, #3B2308 0%, #F59E0B 100%)',
  },
  {
    id: 'arena',
    worldKind: 'arena',
    roomId: 'ARENA-1',
    titlePl: 'Portal Arena 2.0',
    titleEn: 'Portal Arena 2.0',
    tagPl: 'Portale Live + Solo',
    tagEn: 'Live Portals + Solo',
    live: true,
    accent: '#22D3EE',
    fallbackBg: 'linear-gradient(135deg, #06182A 0%, #0E7490 50%, #F97316 100%)',
  },
  {
    id: 'frisbee',
    worldKind: 'frisbee',
    roomId: 'FRISBEE-1',
    titlePl: 'Frisbee King',
    titleEn: 'Frisbee King',
    tagPl: '3 Rundy · Ogniste Cięcie',
    tagEn: '3 Rounds · Blazing Slice',
    live: true,
    accent: '#F97316',
    fallbackBg: 'linear-gradient(135deg, #1E1B4B 0%, #C2410C 55%, #FACC15 100%)',
  },
]

export const HomeBentoView: React.FC<HomeBentoViewProps> = ({
  profile,
  mode,
  lang,
  searchQuery = '',
  partyCode = null,
  partyCount = 0,
  onOpenParty,
  onOpenPrivateRoom,
  onEnterWorld,
  onOpenAvatar,
  onOpenProfile,
  onClaimQuest,
  onFetchLeaderboard,
}) => {
  const [featured, setFeatured] = useState<'lobby' | 'obby' | 'arena' | 'frisbee'>('frisbee')
  const [leaderboard, setLeaderboard] = useState<CloudPlayerSummary[]>([])
  const [loadingBoard, setLoadingBoard] = useState(false)
  const [liveStats, setLiveStats] = useState<WorldLiveStats | null>(null)

  const thumbs = useWorldThumbnails()
  const tokens = getThemeTokens(mode)
  const isDark = mode === 'dark'
  const rank = getRankForXp(profile.xp)
  const roleMeta = getAccountRoleMeta(profile.role, lang)

  const panelSurface = isDark ? '#0B1323' : '#FFFFFF'
  const panelBorder = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(14, 165, 233, 0.18)'
  const sidebarSurface = isDark ? '#080F1D' : '#F4F9FF'
  const subtleSurface = isDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(14, 165, 233, 0.06)'

  const loadLeaderboard = useCallback(async () => {
    setLoadingBoard(true)
    try {
      const rows = await onFetchLeaderboard()
      setLeaderboard(rows)
    } finally {
      setLoadingBoard(false)
    }
  }, [onFetchLeaderboard])

  const loadLiveStats = useCallback(async () => {
    const res = await fetchWorldLiveStats()
    if (res) setLiveStats(res)
  }, [])

  useEffect(() => {
    void loadLeaderboard()
    void loadLiveStats()
    const timer = window.setInterval(() => {
      void loadLiveStats()
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [loadLeaderboard, loadLiveStats])

  const filteredWorlds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return WORLD_CARDS
    return WORLD_CARDS.filter(
      (w) =>
        w.titlePl.toLowerCase().includes(q) ||
        w.titleEn.toLowerCase().includes(q) ||
        w.tagPl.toLowerCase().includes(q) ||
        w.tagEn.toLowerCase().includes(q),
    )
  }, [searchQuery])

  const obbyPct = Math.min(100, Math.round((profile.obbyBestStage / 100) * 100))
  const completedQuestsCount = DAILY_QUESTS.filter((q) => profile.quests.claimed[q.id]).length
  const nextRankXp = rank.nextXp
  const xpPct = Math.min(
    100,
    Math.round(((profile.xp - rank.minXp) / Math.max(1, rank.nextXp - rank.minXp)) * 100),
  )

  const lobbyOnline = liveStats?.lobby_online ?? 0
  const obbyOnline = liveStats?.obby_online ?? 0
  const arenaOnline = liveStats?.arena_online ?? 0
  const arenaTotalElims = liveStats?.arena_total_elims ?? 0
  const frisbeeOnline = liveStats?.frisbee_online ?? 0
  const frisbeeTotalSlices = liveStats?.frisbee_total_slices ?? 0
  const obbyClears = liveStats?.obby_100_clears ?? 0
  const totalPlayers = liveStats?.total_players ?? 0

  const isFeaturedObby = featured === 'obby'
  const isFeaturedArena = featured === 'arena'
  const isFeaturedFrisbee = featured === 'frisbee'
  const featuredThumb = thumbs[featured]

  const launchWorld = (world: WorldKind, roomId: string) => {
    onEnterWorld(world, roomId)
  }

  return (
    <div className="flex min-h-full w-full flex-col xl:flex-row">
      {/* ============================================================
          CENTER WORKSPACE — SPOTLIGHT HERO + COMPACT LAUNCHER LIBRARY
      ============================================================ */}
      <div className="min-w-0 flex-1 space-y-5 p-4 sm:p-5 lg:p-6">
        {/* === SPOTLIGHT HERO BANNER (COMPACT HEIGHT + REAL 3D RENDER) === */}
        <section
          className="group relative overflow-hidden rounded-2xl border select-none"
          style={{
            borderColor: isFeaturedFrisbee
              ? 'rgba(249, 115, 22, 0.5)'
              : isFeaturedArena
                ? 'rgba(34, 211, 238, 0.45)'
                : isFeaturedObby
                  ? 'rgba(245, 158, 11, 0.38)'
                  : 'rgba(56, 189, 248, 0.36)',
            background: isFeaturedFrisbee
              ? 'linear-gradient(135deg, #1E1B4B 0%, #9A3412 52%, #EA580C 100%)'
              : isFeaturedArena
                ? 'linear-gradient(135deg, #051326 0%, #0E7490 55%, #C2410C 100%)'
                : isFeaturedObby
                  ? 'linear-gradient(135deg, #271605 0%, #92400E 100%)'
                  : 'linear-gradient(135deg, #07192E 0%, #0369A1 100%)',
          }}
        >
          <div className="relative h-[215px] sm:h-[240px] lg:h-[260px] w-full overflow-hidden">
            {featuredThumb && (
              <img
                src={featuredThumb}
                alt={isFeaturedFrisbee ? 'Frisbee King' : isFeaturedArena ? 'Portal Arena' : isFeaturedObby ? 'Test Obby 100' : 'Lobby Główne'}
                className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.025]"
                draggable={false}
              />
            )}

            {/* Cinematic bottom scrim for razor-sharp text & button contrast */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(to top, rgba(5, 10, 20, 0.94) 0%, rgba(5, 10, 20, 0.44) 48%, rgba(5, 10, 20, 0.1) 100%)',
              }}
            />

            {/* Top bar on Hero: LIVE status left + Spotlight switcher right */}
            <div className="absolute inset-x-3.5 top-3.5 sm:inset-x-5 sm:top-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950/75 px-2.5 py-1 text-[11px] font-extrabold text-emerald-300 backdrop-blur-md border border-emerald-400/25">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {isFeaturedFrisbee ? 'NOWA GRA · LIVE' : isFeaturedArena ? 'UPDATE 2.0 · LIVE' : 'LIVE'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-950/70 px-2.5 py-1 font-mono text-[11px] font-bold text-slate-200 backdrop-blur-md border border-white/10">
                  {isFeaturedFrisbee
                    ? '#FRISBEE-1'
                    : isFeaturedArena
                      ? '#ARENA-1'
                      : isFeaturedObby
                        ? `${profile.obbyStage}/100`
                        : '#PUBLIC-1'}
                </span>
                {isFeaturedObby && (
                  <span
                    className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-2 py-1 text-[11px] font-extrabold text-amber-200 backdrop-blur-md border border-amber-400/30"
                    title={lang === 'pl' ? 'Nagroda: Korona Obby 100' : 'Reward: Obby 100 Crown'}
                  >
                    <Crown className="h-3.5 w-3.5 text-amber-300" />
                    100
                  </span>
                )}
              </div>

              {/* Switch Spotlight preview between real 3D worlds */}
              <div className="flex items-center gap-1 rounded-xl bg-slate-950/75 p-1 backdrop-blur-md border border-white/10">
                <button
                  type="button"
                  onClick={() => setFeatured('frisbee')}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer"
                  style={{
                    background: featured === 'frisbee' ? 'linear-gradient(135deg, #F97316, #FACC15)' : 'transparent',
                    color: featured === 'frisbee' ? '#09111F' : '#94A3B8',
                  }}
                >
                  <Disc className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Frisbee King</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFeatured('arena')}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer"
                  style={{
                    background: featured === 'arena' ? 'linear-gradient(135deg, #22D3EE, #F97316)' : 'transparent',
                    color: featured === 'arena' ? '#09111F' : '#94A3B8',
                  }}
                >
                  <Orbit className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Portal Arena</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFeatured('lobby')}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer"
                  style={{
                    background: featured === 'lobby' ? '#0EA5E9' : 'transparent',
                    color: featured === 'lobby' ? '#FFFFFF' : '#94A3B8',
                  }}
                >
                  <Box className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Lobby</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFeatured('obby')}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer"
                  style={{
                    background: featured === 'obby' ? '#F59E0B' : 'transparent',
                    color: featured === 'obby' ? '#0F172A' : '#94A3B8',
                  }}
                >
                  <Flag className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Obby 100</span>
                </button>
              </div>
            </div>

            {/* Bottom bar on Hero: Title + 100% REAL stats left, bold PLAY button right */}
            <div className="absolute inset-x-3.5 bottom-3.5 sm:inset-x-5 sm:bottom-4 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow">
                  {isFeaturedFrisbee
                    ? 'Frisbee King'
                    : isFeaturedArena
                      ? 'Portal Arena 2.0'
                      : isFeaturedObby
                        ? 'Test Obby 100'
                        : lang === 'pl'
                          ? 'Lobby Główne'
                          : 'Main Lobby'}
                </h1>

                {isFeaturedFrisbee ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs font-bold text-orange-100/95">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${frisbeeOnline > 0 ? 'bg-emerald-400' : 'bg-slate-400'}`}
                      />
                      {frisbeeOnline} online
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-300">
                      <Flame className="h-3.5 w-3.5" />
                      {frisbeeTotalSlices} {lang === 'pl' ? 'przecięć' : 'slices'}
                    </span>
                    <span className="hidden sm:inline text-orange-200/90 font-semibold">
                      {lang === 'pl'
                        ? '3 Rundy · Kręta hala z rampami · Ogniste cięcie · Łapanie [PPM/E]'
                        : '3 Rounds · Winding ramp box · Fiery slice · Mid-air Catch [RMB/E]'}
                    </span>
                  </div>
                ) : isFeaturedArena ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs font-bold text-cyan-100/95">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${arenaOnline > 0 ? 'bg-emerald-400' : 'bg-slate-400'}`}
                      />
                      {arenaOnline} online
                    </span>
                    <span className="inline-flex items-center gap-1 text-orange-300">
                      <Flame className="h-3.5 w-3.5" />
                      {arenaTotalElims} {lang === 'pl' ? 'eliminacji' : 'elims'}
                    </span>
                    <span className="hidden sm:inline text-cyan-200/85 font-semibold">
                      {lang === 'pl'
                        ? 'Zamknięta komora (0 przepaści!) · Tafle portali na żywo · Trening Solo'
                        : 'Sealed box (0 pits!) · Live see-through portal panes · Solo Training'}
                    </span>
                  </div>
                ) : isFeaturedObby ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs font-bold text-amber-100/90">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${obbyOnline > 0 ? 'bg-emerald-400' : 'bg-slate-400'}`}
                      />
                      {obbyOnline} online
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-300">
                      <Trophy className="h-3.5 w-3.5" />
                      {obbyClears} {lang === 'pl' ? 'ukończyło' : 'cleared'}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 sm:w-32 overflow-hidden rounded-full bg-white/15">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${obbyPct}%`,
                            background: 'linear-gradient(90deg, #F59E0B 0%, #FDE047 100%)',
                          }}
                        />
                      </div>
                      <span className="font-mono text-[11px] font-extrabold text-amber-300">
                        {profile.obbyBestStage}/100
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs font-bold text-sky-100/90">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${lobbyOnline > 0 ? 'bg-emerald-400' : 'bg-slate-400'}`}
                      />
                      {lobbyOnline} online
                    </span>
                    {totalPlayers > 0 && (
                      <span className="inline-flex items-center gap-1 text-sky-200/80">
                        <Users className="h-3.5 w-3.5 text-sky-300" />
                        {totalPlayers} {lang === 'pl' ? 'kont' : 'players'}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  launchWorld(
                    isFeaturedFrisbee ? 'frisbee' : isFeaturedArena ? 'arena' : isFeaturedObby ? 'obby' : 'lobby',
                    isFeaturedFrisbee ? 'FRISBEE-1' : isFeaturedArena ? 'ARENA-1' : isFeaturedObby ? 'OBBY-1' : 'PUBLIC-1',
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-extrabold shadow-xl transition hover:brightness-110 active:scale-[0.98] cursor-pointer"
                style={{
                  background: isFeaturedFrisbee
                    ? 'linear-gradient(135deg, #F97316 0%, #FACC15 100%)'
                    : isFeaturedArena
                      ? 'linear-gradient(135deg, #22D3EE 0%, #F97316 100%)'
                      : isFeaturedObby
                        ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                        : 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
                  color: isFeaturedFrisbee || isFeaturedArena || isFeaturedObby ? '#0F172A' : '#FFFFFF',
                }}
              >
                <Play className="h-4 w-4 fill-current" />
                <span>{lang === 'pl' ? 'GRAJ' : 'PLAY'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* === COMPACT WORLDS LIBRARY (4-COL DESKTOP LAUNCHER GRID) === */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-4 w-4" style={{ color: ARCTIC_SKY.skyMain }} />
              <h2 className="text-xs font-extrabold uppercase tracking-wider" style={{ color: tokens.textPrimary }}>
                {lang === 'pl' ? 'Światy' : 'Worlds'}
              </h2>
              <span
                className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-extrabold"
                style={{ background: subtleSurface, color: tokens.textSecondary }}
              >
                {filteredWorlds.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {onOpenParty && (
                <button
                  type="button"
                  onClick={onOpenParty}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-extrabold transition hover:brightness-110 cursor-pointer"
                  style={{
                    borderColor: partyCode ? 'rgba(56,189,248,0.5)' : panelBorder,
                    background: partyCode ? 'rgba(14,165,233,0.16)' : panelSurface,
                    color: partyCode ? '#38BDF8' : tokens.textPrimary,
                  }}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>
                    {partyCode
                      ? `Party ${partyCode} (${partyCount})`
                      : lang === 'pl'
                        ? 'Drużyna (Party)'
                        : 'Party / Squad'}
                  </span>
                </button>
              )}

              {onOpenPrivateRoom && (
                <button
                  type="button"
                  onClick={() => onOpenPrivateRoom(featured)}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-extrabold transition hover:brightness-110 cursor-pointer"
                  style={{
                    borderColor: panelBorder,
                    background: panelSurface,
                    color: tokens.textPrimary,
                  }}
                >
                  <Lock className="h-3.5 w-3.5 text-sky-400" />
                  <span>{lang === 'pl' ? 'Prywatny pokój' : 'Private Room'}</span>
                </button>
              )}

              {liveStats && (
                <span className="ml-1 inline-flex items-center gap-1.5 font-mono text-[11px] font-bold" style={{ color: tokens.textSecondary }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {liveStats.platform_online} online
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filteredWorlds.map((world) => {
              const thumb = thumbs[world.id]
              const title = lang === 'pl' ? world.titlePl : world.titleEn
              const tag = lang === 'pl' ? world.tagPl : world.tagEn
              const worldOnlineCount =
                world.id === 'lobby'
                  ? lobbyOnline
                  : world.id === 'obby'
                    ? obbyOnline
                    : world.id === 'arena'
                      ? arenaOnline
                      : world.id === 'frisbee'
                        ? frisbeeOnline
                        : 0

              return (
                <div
                  key={world.id}
                  onClick={() => {
                    if (world.live && world.worldKind && world.roomId) {
                      launchWorld(world.worldKind, world.roomId)
                    }
                  }}
                  role={world.live ? 'button' : undefined}
                  tabIndex={world.live ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (world.live && world.worldKind && world.roomId && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      launchWorld(world.worldKind, world.roomId)
                    }
                  }}
                  className={`group relative flex flex-col overflow-hidden rounded-xl border transition-all duration-200 ${
                    world.live
                      ? 'cursor-pointer hover:-translate-y-1 hover:shadow-[0_12px_28px_-12px_rgba(14,165,233,0.45)]'
                      : 'opacity-70'
                  }`}
                  style={{
                    background: panelSurface,
                    borderColor: panelBorder,
                  }}
                >
                  {/* Crisp 16:10 Real 3D Bird's-eye Cover */}
                  <div
                    className="relative aspect-[16/10] w-full overflow-hidden"
                    style={{ background: world.fallbackBg }}
                  >
                    {thumb && (
                      <img
                        src={thumb}
                        alt={title}
                        className={`h-full w-full object-cover transition-transform duration-500 ${
                          world.live ? 'group-hover:scale-105' : 'grayscale-[35%] brightness-90'
                        }`}
                        draggable={false}
                      />
                    )}

                    {/* Soft bottom edge gradient */}
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          'linear-gradient(to top, rgba(5, 10, 20, 0.58) 0%, rgba(5, 10, 20, 0.04) 55%, rgba(5, 10, 20, 0.16) 100%)',
                      }}
                    />

                    {/* Subtle top-left status pill */}
                    <div className="absolute left-2.5 top-2.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-950/70 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300 backdrop-blur-md border border-emerald-400/25">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        LIVE
                      </span>
                    </div>

                    {/* Clean hover Play action button */}
                    {world.live && (
                      <div
                        className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold shadow-lg transition-all duration-200 sm:opacity-0 sm:translate-y-1 group-hover:opacity-100 group-hover:translate-y-0"
                        style={{
                          background:
                            world.id === 'frisbee'
                              ? 'linear-gradient(135deg, #F97316, #FACC15)'
                              : world.id === 'arena'
                                ? 'linear-gradient(135deg, #22D3EE, #F97316)'
                                : world.id === 'obby'
                                  ? '#F59E0B'
                                  : '#0EA5E9',
                          color: world.id === 'obby' || world.id === 'arena' || world.id === 'frisbee' ? '#0F172A' : '#FFFFFF',
                        }}
                      >
                        <Play className="h-3 w-3 fill-current" />
                        <span>{lang === 'pl' ? 'GRAJ' : 'PLAY'}</span>
                      </div>
                    )}
                  </div>

                  {/* Polished 2-line Launcher Card Footer with 100% REAL stats */}
                  <div className="flex flex-1 flex-col justify-between gap-1.5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="truncate text-sm font-extrabold tracking-tight"
                        style={{ color: tokens.textPrimary }}
                      >
                        {title}
                      </span>
                      <span
                        className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ background: subtleSurface, color: tokens.textSecondary }}
                      >
                        {tag}
                      </span>
                    </div>

                    {/* Real live stats row */}
                    <div className="flex items-center justify-between gap-2 font-mono text-[11px] font-bold" style={{ color: tokens.textSecondary }}>
                      {world.live ? (
                        <>
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                worldOnlineCount > 0 ? 'bg-emerald-400' : 'bg-slate-500/70'
                              }`}
                            />
                            <span style={{ color: worldOnlineCount > 0 ? tokens.textPrimary : tokens.textSecondary }}>
                              {worldOnlineCount}
                            </span>
                            <span className="text-[10px] opacity-80">online</span>
                          </span>

                          {world.id === 'obby' ? (
                            <span className="inline-flex items-center gap-2">
                              <span
                                className="inline-flex items-center gap-0.5 text-amber-400"
                                title={lang === 'pl' ? 'Twój rekord' : 'Your best stage'}
                              >
                                <Flag className="h-3 w-3" />
                                {profile.obbyBestStage}/100
                              </span>
                              <span
                                className="inline-flex items-center gap-0.5 text-sky-400"
                                title={lang === 'pl' ? 'Ukończenia 100/100 na serwerze' : 'Server 100/100 clears'}
                              >
                                <Trophy className="h-3 w-3" />
                                {obbyClears}
                              </span>
                            </span>
                          ) : world.id === 'arena' ? (
                            <span className="inline-flex items-center gap-2">
                              <span
                                className="inline-flex items-center gap-0.5 text-orange-400"
                                title={lang === 'pl' ? 'Twoje eliminacje' : 'Your eliminations'}
                              >
                                <Flame className="h-3 w-3" />
                                {profile.arenaEliminations}
                              </span>
                              <span
                                className="inline-flex items-center gap-0.5 text-cyan-400"
                                title={lang === 'pl' ? 'Twoje zwycięstwa' : 'Your Arena wins'}
                              >
                                <Trophy className="h-3 w-3" />
                                {profile.arenaWins}
                              </span>
                            </span>
                          ) : world.id === 'frisbee' ? (
                            <span className="inline-flex items-center gap-2">
                              <span
                                className="inline-flex items-center gap-0.5 text-orange-400"
                                title={lang === 'pl' ? 'Twoje przecięcia' : 'Your slices'}
                              >
                                <Flame className="h-3 w-3" />
                                {profile.frisbeeSlices}
                              </span>
                              <span
                                className="inline-flex items-center gap-0.5 text-amber-300"
                                title={lang === 'pl' ? 'Wygrane mecze Frisbee King' : 'Frisbee King wins'}
                              >
                                <Crown className="h-3 w-3" />
                                {profile.frisbeeWins}
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] opacity-80">
                              <Users className="h-3 w-3 text-sky-400" />
                              {totalPlayers}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] opacity-75">
                          {lang === 'pl' ? 'W przygotowaniu' : 'In development'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* ============================================================
          RIGHT ACTIVITY SIDEBAR (PLAYER + LEADERBOARD + QUESTS)
      ============================================================ */}
      <aside
        className="w-full shrink-0 border-t xl:w-[292px] xl:border-t-0 xl:border-l p-4 space-y-4"
        style={{ background: sidebarSurface, borderColor: panelBorder }}
      >
        {/* 1. Compact Player Card + Avatar Wardrobe Jump */}
        <div
          className="rounded-xl border p-3.5"
          style={{ background: panelSurface, borderColor: panelBorder }}
        >
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenProfile}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-sm font-black text-white shadow-sm cursor-pointer transition hover:scale-105"
              style={{
                background:
                  profile.role === 'owner'
                    ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                    : 'linear-gradient(135deg, #0EA5E9 0%, #2563EB 100%)',
              }}
              title={profile.username}
            >
              {profile.role === 'owner' ? (
                <Crown className="h-5 w-5 text-slate-950" />
              ) : (
                profile.username.slice(0, 2).toUpperCase()
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <span className="truncate text-sm font-extrabold" style={{ color: tokens.textPrimary }}>
                  {profile.clanTag ? `[${profile.clanTag}] ${profile.username}` : profile.username}
                </span>
                {profile.role !== 'player' && (
                  <span
                    className="shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase"
                    style={{
                      background: roleMeta.bg,
                      borderColor: roleMeta.border,
                      color: roleMeta.color,
                    }}
                  >
                    {roleMeta.label}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center justify-between text-[11px] font-bold" style={{ color: tokens.textSecondary }}>
                <span className="truncate">{rank.name}</span>
                <span className="font-mono text-sky-400">{profile.xp} XP</span>
              </div>
            </div>
          </div>

          {/* Slim XP progress bar */}
          <div
            className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(14,165,233,0.14)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${xpPct}%`, background: ARCTIC_SKY.skyMain }}
            />
          </div>
          <div className="mt-1 flex justify-end font-mono text-[10px] font-bold" style={{ color: tokens.textSecondary }}>
            {profile.xp} / {nextRankXp}
          </div>

          {/* Quick Avatar Wardrobe Button */}
          <button
            type="button"
            onClick={onOpenAvatar}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-xs font-extrabold transition hover:brightness-110 cursor-pointer"
            style={{
              borderColor: `${ARCTIC_SKY.skyMain}45`,
              background: `${ARCTIC_SKY.skyMain}18`,
              color: ARCTIC_SKY.skyMain,
            }}
          >
            <Shirt className="h-3.5 w-3.5" />
            <span>{lang === 'pl' ? 'Szatnia awatarów' : 'Avatar Wardrobe'}</span>
          </button>
        </div>

        {/* 2. Live TOP Obby 100 Leaderboard */}
        <div
          className="rounded-xl border p-3.5"
          style={{ background: panelSurface, borderColor: panelBorder }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: tokens.textPrimary }}>
                TOP Obby 100
              </span>
            </div>
            <button
              type="button"
              onClick={() => void loadLeaderboard()}
              className="flex h-6 w-6 items-center justify-center rounded-md border transition hover:scale-105 cursor-pointer"
              style={{ borderColor: panelBorder, background: subtleSurface, color: tokens.textSecondary }}
              title={lang === 'pl' ? 'Odśwież' : 'Refresh'}
              aria-label="Refresh leaderboard"
            >
              <RefreshCw className={`h-3 w-3 ${loadingBoard ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="mt-2.5 space-y-1">
            {leaderboard.slice(0, 5).map((entry, idx) => {
              const isMe = entry.username.toLowerCase() === profile.username.toLowerCase()
              const medalColor =
                idx === 0 ? '#FACC15' : idx === 1 ? '#CBD5E1' : idx === 2 ? '#FB923C' : tokens.textSecondary
              return (
                <div
                  key={`${entry.username}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs"
                  style={{
                    background: isMe ? `${ARCTIC_SKY.skyMain}1C` : subtleSurface,
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="w-4 text-center font-mono text-[11px] font-black" style={{ color: medalColor }}>
                      {idx + 1}
                    </span>
                    <span className="truncate font-bold" style={{ color: tokens.textPrimary }}>
                      {entry.username}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] font-extrabold text-amber-400">
                    {entry.obbyBestStage}/100
                  </span>
                </div>
              )
            })}

            {leaderboard.length === 0 && !loadingBoard && (
              <div className="rounded-lg py-3 text-center text-[11px] font-bold" style={{ color: tokens.textSecondary }}>
                {profile.username} · {profile.obbyBestStage}/100
              </div>
            )}
          </div>
        </div>

        {/* 3. Daily Quests */}
        <div
          className="rounded-xl border p-3.5"
          style={{ background: panelSurface, borderColor: panelBorder }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-sky-400" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: tokens.textPrimary }}>
                {lang === 'pl' ? 'Zadania' : 'Quests'}
              </span>
            </div>
            <span className="font-mono text-[11px] font-extrabold text-sky-400">
              {completedQuestsCount}/{DAILY_QUESTS.length}
            </span>
          </div>

          <div className="mt-2.5 space-y-1.5">
            {DAILY_QUESTS.map((q) => {
              const progress = profile.quests.progress[q.id] ?? 0
              const claimed = Boolean(profile.quests.claimed[q.id])
              const ready = progress >= q.target && !claimed
              const pct = Math.min(100, Math.round((progress / q.target) * 100))
              return (
                <div
                  key={q.id}
                  className="rounded-lg px-2.5 py-2"
                  style={{
                    background: subtleSurface,
                    opacity: claimed ? 0.6 : 1,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-bold" style={{ color: tokens.textPrimary }}>
                      {lang === 'pl' ? q.titlePl : q.titleEn}
                    </span>

                    {claimed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    ) : ready ? (
                      <button
                        type="button"
                        onClick={() => onClaimQuest(q.id)}
                        className="shrink-0 rounded-md px-2 py-0.5 font-mono text-[10px] font-extrabold text-slate-950 transition hover:brightness-110 cursor-pointer"
                        style={{ background: '#FACC15' }}
                      >
                        +{q.rewardXp}
                      </button>
                    ) : (
                      <span className="shrink-0 font-mono text-[10px] font-bold" style={{ color: tokens.textSecondary }}>
                        {progress}/{q.target}
                      </span>
                    )}
                  </div>
                  <div
                    className="mt-1.5 h-1 w-full overflow-hidden rounded-full"
                    style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(14,165,233,0.14)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: claimed ? '#10B981' : ready ? '#FACC15' : ARCTIC_SKY.skyMain,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 4. Ultra-slim Gems WIP status bar */}
        <div
          className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2"
          style={{ background: panelSurface, borderColor: panelBorder }}
        >
          <div className="flex items-center gap-2">
            <FreshGemShard size={16} />
            <span className="text-[11px] font-extrabold" style={{ color: tokens.textPrimary }}>
              FreshGems
            </span>
          </div>
          <span
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold text-amber-400"
            style={{ background: 'rgba(245, 158, 11, 0.12)' }}
          >
            <Clock className="h-2.5 w-2.5" />
            {lang === 'pl' ? 'Wkrótce' : 'Soon'}
          </span>
        </div>
      </aside>
    </div>
  )
}
