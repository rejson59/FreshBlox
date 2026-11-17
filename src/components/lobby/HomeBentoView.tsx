import React, { useState } from 'react'
import {
  Play,
  Users,
  Sparkles,
  Trophy,
  Star,
  Wifi,
  UserCircle2,
  KeyRound,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  Plus,
} from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from '../../data/brandTheme'
import { Lang, LOCALES } from '../../data/locales'
import { DAILY_QUESTS, getRankForXp, LOBBY_ROOMS, QuestDef } from '../../data/catalog'
import { PlayerProfile } from '../../store/usePlayerStore'
import { FreshGemShard } from '../brand/FreshBloxBrand'
import { sfx } from '../../lib/sfx'

interface HomeBentoViewProps {
  profile: PlayerProfile
  mode: ThemeMode
  lang: Lang
  onEnterRoom: (roomId: string) => void
  onOpenAvatar: () => void
  onClaimQuest: (questId: QuestDef['id']) => boolean
}

export const HomeBentoView: React.FC<HomeBentoViewProps> = ({
  profile,
  mode,
  lang,
  onEnterRoom,
  onOpenAvatar,
  onClaimQuest,
}) => {
  const [joinCode, setJoinCode] = useState('')
  const [createdRoom, setCreatedRoom] = useState<string | null>(null)
  const [copiedInvite, setCopiedInvite] = useState(false)

  const t = LOCALES[lang].home
  const tokens = getThemeTokens(mode)
  const rank = getRankForXp(profile.xp)
  const xpSpan = Math.max(1, rank.nextXp - rank.minXp)
  const xpPct = Math.min(100, Math.round(((profile.xp - rank.minXp) / xpSpan) * 100))

  const handleCreatePrivateRoom = () => {
    const code = `SKY-${Math.floor(100 + Math.random() * 899)}`
    setCreatedRoom(code)
    sfx.playChatPop()
  }

  const handleCopyInvite = (code: string) => {
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(code)}`
    navigator.clipboard?.writeText(url).catch(() => {})
    setCopiedInvite(true)
    setTimeout(() => setCopiedInvite(false), 2200)
  }

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = joinCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12)
    if (!clean) return
    onEnterRoom(clean)
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 sm:space-y-8 px-3 py-5 sm:px-6 sm:py-8 overflow-x-clip">
      {/* === CREATOR BENTO (UI-02) TOP GRID === */}
      <section className="grid gap-4 sm:gap-5 lg:grid-cols-12">
        {/* Main Hero Bento Tile: Lobby Główne 3D */}
        <div
          className="relative min-w-0 flex flex-col justify-between overflow-hidden rounded-3xl border p-4 sm:p-8 lg:col-span-7"
          style={{
            background: tokens.heroGradient,
            borderColor: `${ARCTIC_SKY.skyMain}58`,
            boxShadow: `0 20px 55px ${mode === 'dark' ? 'rgba(2, 14, 34, 0.55)' : 'rgba(14, 165, 233, 0.16)'}`,
          }}
        >
          {/* Decorative glossy 3D block shapes */}
          <div
            className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full blur-3xl opacity-45"
            style={{ background: ARCTIC_SKY.auraGlow }}
          />
          <div className="pointer-events-none absolute right-8 bottom-8 hidden h-24 w-24 rotate-12 rounded-3xl border-2 border-white/25 bg-sky-400/15 backdrop-blur-sm sm:block" />
          <div className="pointer-events-none absolute right-24 bottom-20 hidden h-12 w-12 -rotate-12 rounded-2xl border border-white/30 bg-white/15 sm:block" />

          <div className="relative space-y-3 min-w-0">
            <span
              className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] sm:text-[11px] font-extrabold tracking-wide"
              style={{ background: tokens.badgeBg, color: tokens.badgeText, borderColor: `${ARCTIC_SKY.skyMain}44` }}
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              <span>{t.liveBadge}</span>
            </span>

            <h1 className="font-display text-2xl font-extrabold tracking-tight leading-tight sm:text-4xl break-words" style={{ color: tokens.textPrimary }}>
              {t.heroTitle}
            </h1>

            <p className="max-w-xl text-xs sm:text-sm leading-relaxed" style={{ color: tokens.textSecondary }}>
              {t.heroDesc}
            </p>
          </div>

          {/* Primary Actions + Private Friend Room Creator */}
          <div className="relative mt-5 sm:mt-6 space-y-3 sm:space-y-4 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <button
                onClick={() => onEnterRoom('PUBLIC-1')}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl px-5 py-3 sm:px-6 sm:py-3.5 text-sm font-extrabold text-white shadow-xl transition hover:scale-[1.02] hover:brightness-110 cursor-pointer"
                style={{
                  background: tokens.buttonGradient,
                  boxShadow: `0 12px 32px rgba(56, 189, 248, 0.35)`,
                }}
              >
                <Play className="h-4 w-4 fill-current shrink-0" />
                <span>{t.enterLobby}</span>
              </button>

              <button
                onClick={onOpenAvatar}
                className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-2xl border px-3.5 py-3 sm:px-4 sm:py-3.5 text-xs sm:text-sm font-bold transition hover:scale-[1.02] cursor-pointer backdrop-blur-md"
                style={{ borderColor: tokens.cardBorder, background: tokens.cardBg, color: tokens.textPrimary }}
              >
                <UserCircle2 className="h-4 w-4 shrink-0" style={{ color: ARCTIC_SKY.skyMain }} />
                <span>{t.editAvatar}</span>
              </button>

              <button
                onClick={handleCreatePrivateRoom}
                className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-2xl border px-3.5 py-3 sm:px-4 sm:py-3.5 text-xs font-bold transition hover:scale-[1.02] cursor-pointer backdrop-blur-md"
                style={{ borderColor: `${ARCTIC_SKY.skyMain}50`, background: tokens.mutedBg, color: tokens.badgeText }}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">{t.createPrivate}</span>
              </button>
            </div>

            {/* Created Private Room Invite Banner OR Join By Code */}
            <div className="flex flex-wrap items-center gap-2.5 min-w-0">
              {createdRoom ? (
                <div
                  className="flex w-full sm:w-auto flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 text-xs backdrop-blur-md"
                  style={{ borderColor: `${ARCTIC_SKY.skyMain}66`, background: tokens.cardBg }}
                >
                  <KeyRound className="h-3.5 w-3.5 shrink-0" style={{ color: ARCTIC_SKY.skyMain }} />
                  <span className="font-mono-code font-extrabold" style={{ color: tokens.textPrimary }}>
                    #{createdRoom}
                  </span>
                  <button
                    onClick={() => handleCopyInvite(createdRoom)}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer"
                    style={{ background: tokens.badgeBg, color: tokens.badgeText }}
                  >
                    {copiedInvite ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedInvite ? t.inviteCopied : t.copyInvite}
                  </button>
                  <button
                    onClick={() => onEnterRoom(createdRoom)}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-1 text-[11px] font-extrabold text-white cursor-pointer"
                    style={{ background: tokens.buttonGradient }}
                  >
                    <Play className="h-3 w-3 fill-current" />
                    {t.playNow}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleJoinSubmit} className="flex w-full sm:w-auto items-center gap-2 min-w-0">
                  <div
                    className="flex min-w-0 flex-1 sm:flex-none items-center gap-2 rounded-xl border px-3 py-2 sm:py-1.5 backdrop-blur-md"
                    style={{ borderColor: tokens.cardBorder, background: tokens.cardBg }}
                  >
                    <KeyRound className="h-3.5 w-3.5 shrink-0" style={{ color: ARCTIC_SKY.skyMain }} />
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder={t.codePlaceholder}
                      maxLength={12}
                      className="min-w-0 w-full sm:w-28 bg-transparent font-mono-code text-xs font-bold uppercase outline-none"
                      style={{ color: tokens.textPrimary }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="shrink-0 rounded-xl border px-3 py-2 sm:py-1.5 text-xs font-bold transition cursor-pointer"
                    style={{ borderColor: tokens.cardBorder, background: tokens.cardBg, color: tokens.textPrimary }}
                  >
                    {t.joinByCode}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Right Bento Stack: Season Rank + Online Friends + Daily FreshGems Quests */}
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:col-span-5">
          {/* Season Rank Bento Card */}
          <div
            className="min-w-0 flex flex-col justify-between rounded-3xl border p-4 sm:p-5 backdrop-blur-md"
            style={{ background: tokens.cardBg, borderColor: tokens.cardBorder }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: tokens.textSecondary }}>
                {t.seasonRank}
              </span>
              <Trophy className="h-5 w-5" style={{ color: ARCTIC_SKY.skyMain }} />
            </div>

            <div className="my-3">
              <div className="font-display text-2xl font-extrabold" style={{ color: tokens.textPrimary }}>
                {rank.name}
              </div>
              <div className="mt-0.5 text-xs font-semibold" style={{ color: tokens.textSecondary }}>
                {profile.xp} XP • {t.nextRank}: {Math.max(0, rank.nextXp - profile.xp)} XP
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full" style={{ background: tokens.mutedBg }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${xpPct}%`, background: tokens.buttonGradient }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-bold">
              <span className="inline-flex items-center gap-1" style={{ color: ARCTIC_SKY.skyMain }}>
                <Sparkles className="h-3.5 w-3.5" />
                {profile.badges.length} {lang === 'pl' ? 'odznak' : 'badges'}
              </span>
              <span className="inline-flex items-center gap-1" style={{ color: tokens.textPrimary }}>
                <FreshGemShard size={16} />
                {profile.freshGems.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Friends Online Bento Card */}
          <div
            className="min-w-0 flex flex-col justify-between rounded-3xl border p-4 sm:p-5 backdrop-blur-md"
            style={{ background: tokens.cardBg, borderColor: tokens.cardBorder }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: tokens.textSecondary }}>
                {t.onlineFriends}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                style={{ background: tokens.badgeBg, color: tokens.badgeText }}
              >
                {profile.friends.length}
              </span>
            </div>

            <div className="my-3 space-y-2">
              {profile.friends.slice(0, 3).map((fr) => (
                <div key={fr.id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                    <div className="min-w-0">
                      <div className="truncate font-bold" style={{ color: tokens.textPrimary }}>
                        {fr.username}
                      </div>
                      <div className="truncate text-[10px]" style={{ color: tokens.textSecondary }}>
                        #{fr.roomCode ?? 'PUBLIC-1'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onEnterRoom(fr.roomCode ?? 'PUBLIC-1')}
                    className="shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-extrabold transition hover:brightness-110 cursor-pointer"
                    style={{ background: tokens.badgeBg, color: tokens.badgeText }}
                  >
                    {t.join}
                  </button>
                </div>
              ))}
            </div>

            <div className="text-[11px]" style={{ color: tokens.textSecondary }}>
              {t.friendsInRoom}
            </div>
          </div>

          {/* Daily FreshGems Quests Bento Card (Full width across right stack!) */}
          <div
            className="min-w-0 rounded-3xl border p-4 sm:p-5 backdrop-blur-md sm:col-span-2"
            style={{ background: tokens.cardBg, borderColor: tokens.cardBorder }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider" style={{ color: tokens.badgeText }}>
                <FreshGemShard size={18} />
                {t.dailyQuests}
              </span>
              <span className="text-[11px] font-semibold" style={{ color: tokens.textSecondary }}>
                {DAILY_QUESTS.filter((q) => profile.quests.claimed[q.id]).length}/{DAILY_QUESTS.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {DAILY_QUESTS.slice(0, 4).map((q) => {
                const prog = profile.quests.progress[q.id] ?? 0
                const done = prog >= q.target
                const claimed = profile.quests.claimed[q.id]
                const pct = Math.min(100, Math.round((prog / q.target) * 100))

                return (
                  <div
                    key={q.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-2"
                    style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 text-xs font-bold" style={{ color: tokens.textPrimary }}>
                        <span className="truncate">{lang === 'pl' ? q.titlePl : q.titleEn}</span>
                        <span className="shrink-0 font-mono-code text-[10px]" style={{ color: ARCTIC_SKY.skyMain }}>
                          {prog}/{q.target}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-500/25">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: tokens.buttonGradient }} />
                      </div>
                    </div>

                    {claimed ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t.claimed}
                      </span>
                    ) : done ? (
                      <button
                        onClick={() => {
                          if (onClaimQuest(q.id)) sfx.playQuestClaim()
                        }}
                        className="inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-extrabold text-white shadow-md transition hover:scale-105 cursor-pointer"
                        style={{ background: tokens.buttonGradient }}
                      >
                        <FreshGemShard size={13} /> +{q.rewardGems} {t.claim}
                      </button>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold" style={{ color: tokens.textSecondary }}>
                        <FreshGemShard size={13} /> +{q.rewardGems}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* === PRO STATS (C-03) ROOM & UPCOMING PORTALS CARDS === */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-extrabold sm:text-2xl" style={{ color: tokens.textPrimary }}>
              {t.roomsHeading}
            </h2>
            <p className="text-xs sm:text-sm" style={{ color: tokens.textSecondary }}>
              {t.roomsSub}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LOBBY_ROOMS.map((room) => {
            const isLive = room.status === 'live'
            return (
              <div
                key={room.id}
                className="group flex flex-col justify-between overflow-hidden rounded-3xl border transition-all duration-200 hover:-translate-y-1 backdrop-blur-md"
                style={{
                  background: tokens.cardBg,
                  borderColor: isLive ? `${ARCTIC_SKY.skyMain}44` : tokens.cardBorder,
                  opacity: isLive ? 1 : 0.82,
                }}
              >
                {/* C-03 Pro Stats Top Banner */}
                <div className="relative h-28 overflow-hidden p-3" style={{ background: room.gradient }}>
                  <div className="pointer-events-none absolute -right-4 -bottom-4 h-20 w-20 rotate-12 rounded-2xl border border-white/40 bg-white/20" />
                  <div className="relative flex items-start justify-between gap-2">
                    <span className="rounded-lg bg-slate-950/60 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                      {lang === 'pl' ? room.tagPl : room.tagEn}
                    </span>
                    {isLive ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-950/65 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300 backdrop-blur">
                        <Star className="h-2.5 w-2.5 fill-current" /> {room.rating}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-950/70 px-2 py-0.5 text-[10px] font-extrabold text-sky-200 backdrop-blur">
                        <Clock className="h-2.5 w-2.5" /> {t.comingSoon}
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-2.5 left-3">
                    <span className="rounded-md bg-slate-950/55 px-2 py-0.5 font-mono-code text-[10px] font-bold text-sky-100 backdrop-blur">
                      {isLive ? `● ${t.liveNow} • #${room.code}` : `PORTAL • ${room.code}`}
                    </span>
                  </div>
                </div>

                {/* C-03 Pro Stats Body */}
                <div className="flex flex-1 flex-col justify-between p-4">
                  <h3 className="font-display text-base font-extrabold leading-snug" style={{ color: tokens.textPrimary }}>
                    {lang === 'pl' ? room.titlePl : room.titleEn}
                  </h3>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 text-xs" style={{ color: tokens.textSecondary }}>
                      <span className="inline-flex items-center gap-1 font-bold" style={{ color: ARCTIC_SKY.skyMain }}>
                        <Users className="h-3.5 w-3.5" />
                        {isLive ? `${room.players}/${room.maxPlayers}` : '0'}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono-code text-[11px]">
                        <Wifi className="h-3 w-3 text-emerald-400" /> {room.pingMs}ms
                      </span>
                    </div>

                    {isLive ? (
                      <button
                        onClick={() => onEnterRoom(room.code)}
                        className="inline-flex items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-extrabold text-white shadow-md transition hover:brightness-110 cursor-pointer"
                        style={{ background: tokens.buttonGradient }}
                      >
                        <Play className="h-3 w-3 fill-current" />
                        {t.playNow}
                      </button>
                    ) : (
                      <span
                        className="rounded-xl border px-3 py-1.5 text-[11px] font-bold"
                        style={{ borderColor: tokens.cardBorder, color: tokens.textSecondary }}
                      >
                        {t.notifySoon}
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
  )
}
