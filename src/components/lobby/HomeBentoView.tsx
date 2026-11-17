import React, { useEffect, useState } from 'react'
import {
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  Flag,
  KeyRound,
  Play,
  Plus,
  Shirt,
  Sparkles,
  Trophy,
  Users,
  Wifi,
} from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from '../../data/brandTheme'
import { Lang } from '../../data/locales'
import { DAILY_QUESTS, getRankForXp, LOBBY_ROOMS, QuestDef, WorldKind } from '../../data/catalog'
import { CloudPlayerSummary, PlayerProfile } from '../../store/usePlayerStore'
import { sfx } from '../../lib/sfx'

interface HomeBentoViewProps {
  profile: PlayerProfile
  mode: ThemeMode
  lang: Lang
  onEnterWorld: (world: WorldKind, roomId: string) => void
  onOpenAvatar: () => void
  onClaimQuest: (questId: QuestDef['id']) => boolean
  onFetchLeaderboard: () => Promise<CloudPlayerSummary[]>
}

export const HomeBentoView: React.FC<HomeBentoViewProps> = ({
  profile,
  mode,
  lang,
  onEnterWorld,
  onOpenAvatar,
  onClaimQuest,
  onFetchLeaderboard,
}) => {
  const [joinCode, setJoinCode] = useState('')
  const [createdRoom, setCreatedRoom] = useState<string | null>(null)
  const [copiedInvite, setCopiedInvite] = useState(false)
  const [leaderboard, setLeaderboard] = useState<CloudPlayerSummary[]>([])

  useEffect(() => {
    let active = true
    onFetchLeaderboard().then((rows) => {
      if (active) setLeaderboard(rows)
    })
    return () => {
      active = false
    }
  }, [onFetchLeaderboard, profile.obbyBestStage])

  const isPl = lang === 'pl'
  const tokens = getThemeTokens(mode)
  const rank = getRankForXp(profile.xp)
  const xpSpan = Math.max(1, rank.nextXp - rank.minXp)
  const xpPct = Math.min(100, Math.round(((profile.xp - rank.minXp) / xpSpan) * 100))
  const obbyPct = Math.min(100, Math.max(1, profile.obbyStage))
  const hasCrown = profile.unlockedHats.includes('obby-crown')

  const upcomingRooms = LOBBY_ROOMS.filter((r) => r.status !== 'live')
  const claimedCount = DAILY_QUESTS.filter((q) => profile.quests.claimed[q.id]).length

  const handleCreatePrivateRoom = () => {
    const code = `SKY-${Math.floor(100 + Math.random() * 899)}`
    setCreatedRoom(code)
    sfx.playChatPop()
  }

  const handleCopyInvite = (code: string) => {
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(code)}`
    navigator.clipboard?.writeText(url).catch(() => {})
    setCopiedInvite(true)
    setTimeout(() => setCopiedInvite(false), 2000)
  }

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = joinCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12)
    if (!clean) return
    onEnterWorld('lobby', clean)
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-5 px-3 py-4 sm:px-6 sm:py-6 overflow-x-clip">
      {/* === ROW 1: TWO VISUAL LIVE WORLD CARDS === */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* Main Lobby Card */}
        <div
          onClick={() => onEnterWorld('lobby', 'PUBLIC-1')}
          className="group relative flex min-h-[196px] flex-col justify-between overflow-hidden rounded-3xl border p-5 sm:p-6 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.24) 0%, rgba(2, 132, 199, 0.14) 55%, rgba(15, 23, 42, 0.45) 100%)',
            borderColor: `${ARCTIC_SKY.skyMain}58`,
            boxShadow: `0 18px 45px ${mode === 'dark' ? 'rgba(2, 14, 34, 0.45)' : 'rgba(14, 165, 233, 0.14)'}`,
          }}
        >
          <div
            className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full blur-3xl opacity-45"
            style={{ background: ARCTIC_SKY.auraGlow }}
          />
          <div className="pointer-events-none absolute right-5 bottom-5 h-16 w-16 rotate-12 rounded-2xl border border-white/20 bg-sky-400/15 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105" />

          <div className="relative flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950/60 px-2.5 py-1 text-[10px] font-extrabold text-emerald-300 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              LIVE
            </span>
            <span className="rounded-lg bg-slate-950/50 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-200 backdrop-blur">
              #PUBLIC-1
            </span>
          </div>

          <div className="relative my-4">
            <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight" style={{ color: tokens.textPrimary }}>
              {isPl ? 'Lobby Główne' : 'Main Lobby'}
            </h1>
            <div className="mt-1.5 flex items-center gap-3 text-xs font-bold" style={{ color: tokens.textSecondary }}>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" style={{ color: ARCTIC_SKY.skyMain }} />
                16
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                <Wifi className="h-3 w-3 text-emerald-400" />
                22ms
              </span>
            </div>
          </div>

          <div className="relative flex items-center justify-between">
            <span
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-lg transition group-hover:brightness-110"
              style={{ background: tokens.buttonGradient }}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{isPl ? 'Graj' : 'Play'}</span>
            </span>
          </div>
        </div>

        {/* Test Obby 100 Card */}
        <div
          onClick={() => onEnterWorld('obby', 'OBBY-1')}
          className="group relative flex min-h-[196px] flex-col justify-between overflow-hidden rounded-3xl border p-5 sm:p-6 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.24) 0%, rgba(234, 88, 12, 0.14) 55%, rgba(15, 23, 42, 0.45) 100%)',
            borderColor: 'rgba(245, 158, 11, 0.52)',
            boxShadow: `0 18px 45px ${mode === 'dark' ? 'rgba(2, 14, 34, 0.45)' : 'rgba(245, 158, 11, 0.14)'}`,
          }}
        >
          <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-amber-400/35 blur-3xl" />
          <div className="pointer-events-none absolute right-5 bottom-5 h-16 w-16 -rotate-12 rounded-2xl border border-amber-200/25 bg-amber-400/15 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105" />

          <div className="relative flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950/60 px-2.5 py-1 font-mono text-[10px] font-extrabold text-amber-300 backdrop-blur">
              <Flag className="h-3 w-3" />
              {profile.obbyStage}/100
            </span>

            <span
              title={
                hasCrown
                  ? isPl
                    ? 'Korona Mistrza odblokowana'
                    : 'Champion Crown unlocked'
                  : isPl
                    ? 'Nagroda za Stage 100: Korona Mistrza'
                    : 'Stage 100 Reward: Champion Crown'
              }
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold backdrop-blur ${
                hasCrown
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                  : 'bg-slate-950/55 text-amber-300 border border-amber-400/35'
              }`}
            >
              <Crown className="h-3 w-3" />
              <span>{hasCrown ? '✓' : '100'}</span>
            </span>
          </div>

          <div className="relative my-4">
            <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight" style={{ color: tokens.textPrimary }}>
              Test Obby 100
            </h2>
            <div className="mt-2.5 flex items-center gap-2.5 max-w-[240px]">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-950/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                  style={{ width: `${obbyPct}%` }}
                />
              </div>
              <span className="font-mono text-[11px] font-extrabold text-amber-400">
                ★ {profile.obbyBestStage}
              </span>
            </div>
          </div>

          <div className="relative flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-lg transition group-hover:brightness-110">
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{isPl ? 'Graj' : 'Play'}</span>
            </span>
          </div>
        </div>
      </section>

      {/* === ROW 2: COMPACT PRIVATE ROOM BAR + UPCOMING PORTALS === */}
      <section
        className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border px-3.5 py-2.5 backdrop-blur-md"
        style={{ background: tokens.cardBg, borderColor: tokens.cardBorder }}
      >
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {createdRoom ? (
            <div className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 shrink-0" style={{ color: ARCTIC_SKY.skyMain }} />
              <span className="font-mono text-xs font-extrabold" style={{ color: tokens.textPrimary }}>
                #{createdRoom}
              </span>
              <button
                type="button"
                onClick={() => handleCopyInvite(createdRoom)}
                title={isPl ? 'Kopiuj link' : 'Copy link'}
                className="flex h-7 w-7 items-center justify-center rounded-lg transition cursor-pointer"
                style={{ background: tokens.badgeBg, color: tokens.badgeText }}
              >
                {copiedInvite ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => onEnterWorld('lobby', createdRoom)}
                className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px] font-extrabold text-white cursor-pointer"
                style={{ background: tokens.buttonGradient }}
              >
                <Play className="h-3 w-3 fill-current" />
                <span>{isPl ? 'Wejdź' : 'Join'}</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleJoinSubmit} className="flex items-center gap-1.5">
              <div
                className="flex h-8 items-center gap-1.5 rounded-xl border px-2.5"
                style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
              >
                <KeyRound className="h-3.5 w-3.5 shrink-0" style={{ color: ARCTIC_SKY.skyMain }} />
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="SKY-123"
                  maxLength={12}
                  className="w-24 bg-transparent font-mono text-xs font-bold uppercase outline-none"
                  style={{ color: tokens.textPrimary }}
                />
              </div>
              <button
                type="submit"
                title={isPl ? 'Dołącz kodem' : 'Join by code'}
                aria-label="Join"
                className="flex h-8 w-8 items-center justify-center rounded-xl border transition hover:scale-105 cursor-pointer"
                style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg, color: tokens.textPrimary }}
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleCreatePrivateRoom}
                title={isPl ? 'Nowy pokój prywatny' : 'Create private room'}
                className="inline-flex h-8 items-center gap-1 rounded-xl border px-2.5 text-xs font-bold transition hover:scale-105 cursor-pointer"
                style={{ borderColor: `${ARCTIC_SKY.skyMain}45`, background: tokens.badgeBg, color: tokens.badgeText }}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">{isPl ? 'Prywatny' : 'Private'}</span>
              </button>
            </form>
          )}
        </div>

        {/* Upcoming worlds as compact locked pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {upcomingRooms.map((room) => (
            <span
              key={room.id}
              title={isPl ? 'Wkrótce' : 'Coming soon'}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-bold opacity-70"
              style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg, color: tokens.textSecondary }}
            >
              <Clock className="h-3 w-3" />
              <span>{isPl ? room.titlePl : room.titleEn}</span>
            </span>
          ))}
        </div>
      </section>

      {/* === ROW 3: THREE CLEAN MINIMAL BENTO WIDGETS === */}
      <section className="grid gap-4 md:grid-cols-3">
        {/* 1. Rank & Quick Avatar */}
        <div
          className="flex flex-col justify-between rounded-3xl border p-4 sm:p-5 backdrop-blur-md"
          style={{ background: tokens.cardBg, borderColor: tokens.cardBorder }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4" style={{ color: ARCTIC_SKY.skyMain }} />
              <span className="font-display text-base font-extrabold" style={{ color: tokens.textPrimary }}>
                {rank.name}
              </span>
            </div>
            <span className="font-mono text-[11px] font-bold" style={{ color: tokens.textSecondary }}>
              {profile.xp}/{rank.nextXp} XP
            </span>
          </div>

          <div className="my-3.5 space-y-3">
            <div className="h-2 overflow-hidden rounded-full" style={{ background: tokens.mutedBg }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${xpPct}%`, background: tokens.buttonGradient }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div
                className="flex items-center justify-center gap-1.5 rounded-xl py-2 font-mono text-xs font-extrabold"
                style={{ background: tokens.mutedBg, color: ARCTIC_SKY.skyMain }}
              >
                <Flag className="h-3.5 w-3.5" />
                <span>{profile.obbyBestStage}/100</span>
              </div>
              <div
                className="flex items-center justify-center gap-1.5 rounded-xl py-2 font-mono text-xs font-extrabold"
                style={{ background: tokens.mutedBg, color: tokens.textPrimary }}
              >
                <Award className="h-3.5 w-3.5 text-amber-400" />
                <span>{profile.badges.length}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenAvatar}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border py-2.5 text-xs font-extrabold transition hover:scale-[1.01] cursor-pointer"
            style={{ borderColor: `${ARCTIC_SKY.skyMain}45`, background: tokens.badgeBg, color: tokens.textPrimary }}
          >
            <Shirt className="h-4 w-4" style={{ color: ARCTIC_SKY.skyMain }} />
            <span>{isPl ? 'Szatnia R6' : 'R6 Wardrobe'}</span>
          </button>
        </div>

        {/* 2. Top Obby 100 */}
        <div
          className="flex flex-col rounded-3xl border p-4 sm:p-5 backdrop-blur-md"
          style={{ background: tokens.cardBg, borderColor: tokens.cardBorder }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider" style={{ color: tokens.textSecondary }}>
              <Flag className="h-3.5 w-3.5 text-amber-400" />
              <span>TOP Obby</span>
            </span>
            <span className="font-mono text-[10px] font-bold" style={{ color: tokens.textSecondary }}>
              100
            </span>
          </div>

          <div className="flex-1 space-y-1.5">
            {leaderboard.length > 0 ? (
              leaderboard.slice(0, 5).map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-xs"
                  style={{ background: idx === 0 ? 'rgba(251, 191, 36, 0.1)' : tokens.mutedBg }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-black"
                      style={{
                        background: idx === 0 ? 'rgba(251,191,36,0.25)' : 'rgba(148,163,184,0.12)',
                        color: idx === 0 ? '#FBBF24' : tokens.textSecondary,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span className="truncate font-bold" style={{ color: tokens.textPrimary }}>
                      {p.username}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] font-extrabold" style={{ color: ARCTIC_SKY.skyMain }}>
                    {p.obbyBestStage}/100
                  </span>
                </div>
              ))
            ) : (
              <div className="flex h-full items-center justify-center py-6 text-xs font-semibold" style={{ color: tokens.textSecondary }}>
                —
              </div>
            )}
          </div>
        </div>

        {/* 3. Daily Quests */}
        <div
          className="flex flex-col rounded-3xl border p-4 sm:p-5 backdrop-blur-md"
          style={{ background: tokens.cardBg, borderColor: tokens.cardBorder }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider" style={{ color: tokens.textSecondary }}>
              <Sparkles className="h-3.5 w-3.5" style={{ color: ARCTIC_SKY.skyMain }} />
              <span>{isPl ? 'Zadania' : 'Quests'}</span>
            </span>
            <span className="font-mono text-[11px] font-bold" style={{ color: ARCTIC_SKY.skyMain }}>
              {claimedCount}/{DAILY_QUESTS.length}
            </span>
          </div>

          <div className="space-y-2">
            {DAILY_QUESTS.slice(0, 4).map((q) => {
              const prog = profile.quests.progress[q.id] ?? 0
              const done = prog >= q.target
              const claimed = profile.quests.claimed[q.id]
              const pct = Math.min(100, Math.round((prog / q.target) * 100))

              return (
                <div
                  key={q.id}
                  className="flex items-center justify-between gap-2.5 rounded-xl px-2.5 py-2"
                  style={{ background: tokens.mutedBg }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5 text-[11px] font-bold" style={{ color: tokens.textPrimary }}>
                      <span className="truncate">{isPl ? q.titlePl : q.titleEn}</span>
                      <span className="shrink-0 font-mono text-[10px]" style={{ color: tokens.textSecondary }}>
                        {prog}/{q.target}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-500/20">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: tokens.buttonGradient }}
                      />
                    </div>
                  </div>

                  {claimed ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : done ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (onClaimQuest(q.id)) sfx.playQuestClaim()
                      }}
                      className="shrink-0 rounded-lg px-2 py-1 font-mono text-[10px] font-black text-white shadow transition hover:scale-105 cursor-pointer"
                      style={{ background: tokens.buttonGradient }}
                    >
                      +{q.rewardXp}
                    </button>
                  ) : (
                    <span className="shrink-0 font-mono text-[10px] font-bold" style={{ color: tokens.textSecondary }}>
                      +{q.rewardXp}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
