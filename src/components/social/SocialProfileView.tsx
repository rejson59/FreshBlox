import React, { useEffect, useState } from 'react'
import {
  Award,
  Check,
  Cloud,
  Flag,
  LogOut,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from '../../data/brandTheme'
import { Lang, LOCALES } from '../../data/locales'
import { BADGE_CATALOG, getRankForXp, WorldKind } from '../../data/catalog'
import { CloudPlayerSummary, PlayerProfile } from '../../store/usePlayerStore'
import { isSupabaseConfigured } from '../../lib/supabase'
import { sfx } from '../../lib/sfx'

interface SocialProfileViewProps {
  profile: PlayerProfile
  cloudStatus: 'guest' | 'syncing' | 'synced' | 'offline'
  mode: ThemeMode
  lang: Lang
  onChangeUsername: (name: string) => Promise<{ ok: boolean; error?: string }>
  onAddFriend: (name: string) => Promise<{ ok: boolean; error?: string }>
  onRefreshFriends: () => Promise<void>
  onSearchPlayers: (query: string) => Promise<CloudPlayerSummary[]>
  onJoinWorld: (world: WorldKind, roomId: string) => void
  onSignOut: () => Promise<void>
}

export const SocialProfileView: React.FC<SocialProfileViewProps> = ({
  profile,
  cloudStatus,
  mode,
  lang,
  onChangeUsername,
  onAddFriend,
  onRefreshFriends,
  onSearchPlayers,
  onJoinWorld,
  onSignOut,
}) => {
  const [nickInput, setNickInput] = useState(profile.username)
  const [nickSaved, setNickSaved] = useState(false)
  const [nickError, setNickError] = useState<string | null>(null)
  const [friendInput, setFriendInput] = useState('')
  const [friendMsg, setFriendMsg] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [cloudPlayers, setCloudPlayers] = useState<CloudPlayerSummary[]>([])

  useEffect(() => {
    setNickInput(profile.username)
  }, [profile.username])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      onSearchPlayers(searchQuery).then((res) => {
        if (active) setCloudPlayers(res)
      })
    }, 220)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [searchQuery, onSearchPlayers])

  const t = LOCALES[lang].social
  const ta = LOCALES[lang].auth
  const tokens = getThemeTokens(mode)
  const rank = getRankForXp(profile.xp)

  const handleSaveNick = async (e: React.FormEvent) => {
    e.preventDefault()
    setNickError(null)
    if (!nickInput.trim()) return
    const res = await onChangeUsername(nickInput)
    if (!res.ok) {
      setNickError(res.error ?? 'Error')
      return
    }
    sfx.playChatPop()
    setNickSaved(true)
    setTimeout(() => setNickSaved(false), 1800)
  }

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault()
    setFriendMsg(null)
    if (!friendInput.trim()) return
    const res = await onAddFriend(friendInput)
    if (!res.ok && res.error) {
      setFriendMsg(res.error)
      return
    }
    setFriendInput('')
    sfx.playChatPop()
  }

  return (
    <div className="w-full space-y-4 p-4 sm:p-5 lg:p-6 overflow-x-clip">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Users className="h-5 w-5" style={{ color: ARCTIC_SKY.skyMain }} />
          <h1 className="font-display text-lg font-extrabold sm:text-xl" style={{ color: tokens.textPrimary }}>
            {t.title}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => {
            sfx.playClick()
            void onSignOut()
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-400/35 bg-rose-500/15 px-3 py-1.5 text-xs font-extrabold text-rose-400 hover:bg-rose-500/25 cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>{ta.logout}</span>
        </button>
      </div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-12">
        {/* Profile Card */}
        <div
          className="min-w-0 space-y-4 rounded-3xl border p-4 sm:p-6 backdrop-blur-md lg:col-span-6"
          style={{ background: tokens.cardBg, borderColor: `${ARCTIC_SKY.skyMain}44` }}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-extrabold" style={{ color: tokens.textPrimary }}>
              {t.profileCard}
            </h2>
            <span
              className="rounded-lg px-2.5 py-1 font-mono-code text-xs font-bold"
              style={{ background: tokens.badgeBg, color: tokens.badgeText }}
            >
              {profile.freshTag}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border p-3" style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}>
              <div className="text-[10px] font-bold uppercase" style={{ color: tokens.textSecondary }}>
                Test Obby
              </div>
              <div className="mt-1 flex items-center gap-1 text-base font-extrabold" style={{ color: tokens.textPrimary }}>
                <Flag className="h-4 w-4 text-amber-400" />
                <span>{profile.obbyBestStage}/100</span>
              </div>
            </div>
            <div className="rounded-2xl border p-3" style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}>
              <div className="text-[10px] font-bold uppercase" style={{ color: tokens.textSecondary }}>
                Rank
              </div>
              <div className="mt-1 font-display text-base font-extrabold" style={{ color: ARCTIC_SKY.skyMain }}>
                {rank.name}
              </div>
            </div>
            <div className="rounded-2xl border p-3" style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}>
              <div className="text-[10px] font-bold uppercase" style={{ color: tokens.textSecondary }}>
                XP
              </div>
              <div className="mt-1 font-mono-code text-lg font-extrabold" style={{ color: tokens.textPrimary }}>
                {profile.xp}
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveNick} className="space-y-2 pt-1">
            <label className="block text-xs font-bold" style={{ color: tokens.textSecondary }}>
              {t.nicknameLabel}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nickInput}
                onChange={(e) => setNickInput(e.target.value)}
                maxLength={20}
                className="min-w-0 flex-1 rounded-xl border px-3.5 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-sky-400/50"
                style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg, color: tokens.textPrimary }}
              />
              <button
                type="submit"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-extrabold text-white cursor-pointer"
                style={{ background: tokens.buttonGradient }}
              >
                {nickSaved && <Check className="h-3.5 w-3.5" />}
                {nickSaved ? t.saved : t.saveNick}
              </button>
            </div>
            {nickError && <div className="text-xs font-semibold text-rose-400">{nickError}</div>}
            <p className="text-[11px]" style={{ color: tokens.textSecondary }}>
              {ta.loginNameNote}
            </p>
          </form>

          {/* Cloud account pill inside profile */}
          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-xs"
            style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
          >
            <div className="min-w-0">
              <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                <Cloud className="h-3.5 w-3.5" />
                <span>{cloudStatus === 'syncing' ? ta.cloudSyncing : ta.cloudSynced}</span>
              </div>
              <div className="truncate text-[11px]" style={{ color: tokens.textSecondary }}>
                {ta.loggedAs}: <strong style={{ color: tokens.textPrimary }}>@{profile.username}</strong>
              </div>
            </div>
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
          </div>
        </div>

        {/* Friends Card */}
        <div
          className="min-w-0 flex flex-col justify-between space-y-4 rounded-3xl border p-4 sm:p-6 backdrop-blur-md lg:col-span-6"
          style={{ background: tokens.cardBg, borderColor: tokens.cardBorder }}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-extrabold" style={{ color: tokens.textPrimary }}>
                <Users className="h-5 w-5" style={{ color: ARCTIC_SKY.skyMain }} />
                {t.friendsCard}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void onRefreshFriends()}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border hover:opacity-80 cursor-pointer"
                  style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg, color: tokens.textPrimary }}
                  title="Odśwież"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: tokens.badgeBg, color: tokens.badgeText }}>
                  {profile.friends.length}
                </span>
              </div>
            </div>

            <form onSubmit={handleAddFriend} className="flex gap-2">
              <input
                type="text"
                value={friendInput}
                onChange={(e) => setFriendInput(e.target.value)}
                placeholder={t.addFriendPlaceholder}
                maxLength={20}
                className="min-w-0 flex-1 rounded-xl border px-3.5 py-2 text-xs font-semibold outline-none"
                style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg, color: tokens.textPrimary }}
              />
              <button
                type="submit"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold text-white cursor-pointer"
                style={{ background: tokens.buttonGradient }}
              >
                <UserPlus className="h-3.5 w-3.5" />
                {t.addFriendBtn}
              </button>
            </form>
            {friendMsg && <div className="text-xs font-semibold text-rose-400">{friendMsg}</div>}

            <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
              {profile.friends.length === 0 ? (
                <div className="rounded-2xl border p-4 text-center text-xs" style={{ borderColor: tokens.cardBorder, color: tokens.textSecondary }}>
                  {lang === 'pl'
                    ? 'Brak znajomych na liście — wyszukaj gracza poniżej albo wpisz jego nick!'
                    : 'No friends yet — search for a player below or add by username!'}
                </div>
              ) : (
                profile.friends.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded-2xl border px-3.5 py-2.5"
                    style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          f.status === 'offline' ? 'bg-slate-400' : 'bg-emerald-400'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-extrabold" style={{ color: tokens.textPrimary }}>
                          {f.username} {f.freshTag && <span className="font-mono text-[10px] opacity-65">{f.freshTag}</span>}
                        </div>
                        <div className="font-mono-code text-[10px]" style={{ color: tokens.textSecondary }}>
                          {f.world === 'obby' ? 'Test Obby 100' : 'Lobby'} #{f.roomCode ?? 'PUBLIC-1'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => onJoinWorld(f.world ?? 'lobby', f.roomCode ?? 'PUBLIC-1')}
                      className="inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-extrabold text-white cursor-pointer"
                      style={{ background: tokens.buttonGradient }}
                    >
                      <Play className="h-3 w-3 fill-current" />
                      {LOCALES[lang].home.join}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Cloud Player Directory */}
        <div
          className="min-w-0 space-y-4 rounded-3xl border p-4 sm:p-6 backdrop-blur-md lg:col-span-6"
          style={{ background: tokens.cardBg, borderColor: tokens.cardBorder }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-lg font-extrabold" style={{ color: tokens.textPrimary }}>
              <Search className="h-5 w-5" style={{ color: ARCTIC_SKY.skyMain }} />
              {t.searchPlayersHeading}
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/12">
              <Cloud className="h-3 w-3" />
              {isSupabaseConfigured ? 'Live' : 'Local'}
            </span>
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full rounded-xl border px-3.5 py-2 text-xs font-semibold outline-none"
            style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg, color: tokens.textPrimary }}
          />

          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {cloudPlayers.length === 0 ? (
              <div className="rounded-2xl border p-4 text-center text-xs" style={{ borderColor: tokens.cardBorder, color: tokens.textSecondary }}>
                {t.noPlayersFound}
              </div>
            ) : (
              cloudPlayers.map((p) => {
                const isSelf = p.id === profile.playerId
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5"
                    style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.isOnline ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-extrabold" style={{ color: tokens.textPrimary }}>
                          {p.username}{' '}
                          <span className="font-mono text-[10px] opacity-65">{p.freshTag}</span>
                        </div>
                        <div className="text-[10px]" style={{ color: tokens.textSecondary }}>
                          Obby {p.obbyBestStage}/100 • {p.xp} XP
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => {
                            void onAddFriend(p.username)
                            sfx.playChatPop()
                          }}
                          className="rounded-lg border px-2.5 py-1 text-[10px] font-extrabold cursor-pointer"
                          style={{ borderColor: tokens.cardBorder, background: tokens.cardBg, color: tokens.textPrimary }}
                        >
                          + {t.addFriendBtn}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onJoinWorld(p.lastWorld, p.lastRoom)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-extrabold text-white cursor-pointer"
                        style={{ background: tokens.buttonGradient }}
                      >
                        <Play className="h-2.5 w-2.5 fill-current" />
                        {LOCALES[lang].home.join}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Badges Card */}
        <div
          className="min-w-0 space-y-4 rounded-3xl border p-4 sm:p-6 backdrop-blur-md lg:col-span-6"
          style={{ background: tokens.cardBg, borderColor: tokens.cardBorder }}
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-extrabold" style={{ color: tokens.textPrimary }}>
              <Award className="h-5 w-5" style={{ color: ARCTIC_SKY.skyMain }} />
              {t.badgesCard}
            </h2>
            <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: tokens.badgeText }}>
              <Sparkles className="h-3.5 w-3.5" />
              {profile.badges.length}/{BADGE_CATALOG.length}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {BADGE_CATALOG.map((b) => {
              const unlocked = profile.badges.includes(b.id)
              return (
                <div
                  key={b.id}
                  className="rounded-2xl border p-3.5 transition"
                  style={{
                    background: unlocked ? tokens.heroGradient : tokens.mutedBg,
                    borderColor: unlocked ? `${ARCTIC_SKY.skyMain}66` : tokens.cardBorder,
                    opacity: unlocked ? 1 : 0.55,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl">{b.icon}</span>
                    {unlocked && (
                      <span className="rounded-md px-1.5 py-0.5 text-[10px] font-extrabold" style={{ background: tokens.badgeBg, color: tokens.badgeText }}>
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-xs font-extrabold" style={{ color: tokens.textPrimary }}>
                    {lang === 'pl' ? b.namePl : b.nameEn}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug" style={{ color: tokens.textSecondary }}>
                    {lang === 'pl' ? b.descPl : b.descEn}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
