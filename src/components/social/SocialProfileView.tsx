import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Award,
  Check,
  Cloud,
  Crown,
  Flag,
  LogOut,
  MessageSquare,
  Pin,
  Play,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Timer,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from '../../data/brandTheme'
import { Lang, LOCALES } from '../../data/locales'
import { BADGE_CATALOG, getRankForXp, WorldKind } from '../../data/catalog'
import { CloudPlayerSummary, FriendEntry, getAccountRoleMeta, PlayerProfile } from '../../store/usePlayerStore'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
  DirectMessageRow,
  fetchDirectMessages,
  formatSpeedrunTime,
  markDmThreadRead,
  sendDirectMessage,
} from '../../lib/socialApi'
import { sfx } from '../../lib/sfx'

interface SocialProfileViewProps {
  profile: PlayerProfile
  cloudStatus: 'guest' | 'syncing' | 'synced' | 'offline'
  mode: ThemeMode
  lang: Lang
  activeRoomCode?: string
  initialDmUsername?: string | null
  onConsumedInitialDm?: () => void
  onPinBadge?: (badgeId: string | null) => void
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
  activeRoomCode = 'PUBLIC-1',
  initialDmUsername,
  onConsumedInitialDm,
  onPinBadge,
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

  // U-09: Direct Message 1-on-1 drawer state
  const [dmTarget, setDmTarget] = useState<{ userId: string; username: string } | null>(null)
  const [dmMessages, setDmMessages] = useState<DirectMessageRow[]>([])
  const [dmDraft, setDmDraft] = useState('')
  const [dmLoading, setDmLoading] = useState(false)
  const [dmSending, setDmSending] = useState(false)
  const dmScrollRef = useRef<HTMLDivElement | null>(null)

  const openDmWith = useCallback((userId: string, username: string) => {
    setDmTarget({ userId, username })
  }, [])

  // Support opening DM straight from Notifications Center
  useEffect(() => {
    if (!initialDmUsername) return
    const friend = profile.friends.find(
      (f) => f.username.toLowerCase() === initialDmUsername.toLowerCase() && f.friendUserId,
    )
    if (friend?.friendUserId) {
      setDmTarget({ userId: friend.friendUserId, username: friend.username })
      onConsumedInitialDm?.()
    } else {
      onSearchPlayers(initialDmUsername).then((list) => {
        const hit = list.find((p) => p.username.toLowerCase() === initialDmUsername.toLowerCase())
        if (hit) setDmTarget({ userId: hit.id, username: hit.username })
        onConsumedInitialDm?.()
      })
    }
  }, [initialDmUsername, profile.friends, onSearchPlayers, onConsumedInitialDm])

  // Load & poll active DM thread
  useEffect(() => {
    if (!dmTarget) return
    let active = true
    const load = async (initial = false) => {
      if (initial) setDmLoading(true)
      const rows = await fetchDirectMessages(dmTarget.userId, profile.playerId)
      if (!active) return
      setDmMessages(rows)
      if (initial) setDmLoading(false)
      await markDmThreadRead(dmTarget.userId)
    }
    void load(true)
    const timer = window.setInterval(() => void load(false), 4500)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [dmTarget, profile.playerId])

  useEffect(() => {
    if (dmScrollRef.current) {
      dmScrollRef.current.scrollTop = dmScrollRef.current.scrollHeight
    }
  }, [dmMessages.length])

  const handleSendDm = async (e: React.FormEvent, inviteRoom?: string, inviteWorld?: WorldKind) => {
    e.preventDefault()
    if (!dmTarget || dmSending) return
    const text = inviteRoom
      ? lang === 'pl'
        ? `Zapraszam do pokoju #${inviteRoom}!`
        : `Join my room #${inviteRoom}!`
      : dmDraft.trim()
    if (!text) return
    setDmSending(true)
    const res = await sendDirectMessage({
      recipientId: dmTarget.userId,
      content: text,
      inviteWorld: inviteRoom ? (inviteWorld ?? 'lobby') : null,
      inviteCode: inviteRoom ?? null,
    })
    setDmSending(false)
    if (!res.error) {
      if (!inviteRoom) setDmDraft('')
      const rows = await fetchDirectMessages(dmTarget.userId, profile.playerId)
      setDmMessages(rows)
    }
  }

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
  const roleMeta = getAccountRoleMeta(profile.role, lang)

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
          {profile.role !== 'player' && (
            <span
              className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
              style={{
                background: roleMeta.bg,
                borderColor: roleMeta.border,
                color: roleMeta.color,
              }}
            >
              {profile.role === 'owner' && <Crown className="h-3 w-3" />}
              {roleMeta.label}
            </span>
          )}
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

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                {lang === 'pl' ? 'Rekord PB' : 'Best Time'}
              </div>
              <div className="mt-1 flex items-center gap-1 font-mono text-sm font-extrabold text-cyan-400">
                <Timer className="h-3.5 w-3.5 shrink-0" />
                <span>{formatSpeedrunTime(profile.obbyBestTimeMs)}</span>
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

          {profile.pinnedBadge && (() => {
            const pinned = BADGE_CATALOG.find((b) => b.id === profile.pinnedBadge)
            if (!pinned) return null
            return (
              <div
                className="flex items-center justify-between gap-2 rounded-2xl border px-3.5 py-2 text-xs"
                style={{ borderColor: `${ARCTIC_SKY.skyMain}55`, background: tokens.heroGradient }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{pinned.icon}</span>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                      {lang === 'pl' ? 'Przypięta odznaka' : 'Pinned Badge'}
                    </div>
                    <div className="font-extrabold" style={{ color: tokens.textPrimary }}>
                      {lang === 'pl' ? pinned.namePl : pinned.nameEn}
                    </div>
                  </div>
                </div>
                <Pin className="h-4 w-4 text-sky-400" />
              </div>
            )
          })()}

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
                    <div className="flex shrink-0 items-center gap-1.5">
                      {f.friendUserId && (
                        <button
                          type="button"
                          onClick={() => openDmWith(f.friendUserId!, f.username)}
                          title={lang === 'pl' ? 'Napisz wiadomość (DM)' : 'Send direct message'}
                          className="inline-flex items-center gap-1 rounded-xl border border-sky-400/35 bg-sky-500/15 px-2.5 py-1.5 text-[11px] font-extrabold text-sky-300 hover:bg-sky-500/25 cursor-pointer"
                        >
                          <MessageSquare className="h-3 w-3" />
                          <span>DM</span>
                        </button>
                      )}
                      <button
                        onClick={() => onJoinWorld(f.world ?? 'lobby', f.roomCode ?? 'PUBLIC-1')}
                        className="inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-extrabold text-white cursor-pointer"
                        style={{ background: tokens.buttonGradient }}
                      >
                        <Play className="h-3 w-3 fill-current" />
                        {LOCALES[lang].home.join}
                      </button>
                    </div>
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
                        <>
                          <button
                            type="button"
                            onClick={() => openDmWith(p.id, p.username)}
                            title={lang === 'pl' ? 'Wiadomość prywatna (DM)' : 'Direct message'}
                            className="inline-flex items-center gap-1 rounded-lg border border-sky-400/35 bg-sky-500/15 px-2 py-1 text-[10px] font-extrabold text-sky-300 hover:bg-sky-500/25 cursor-pointer"
                          >
                            <MessageSquare className="h-3 w-3" />
                            DM
                          </button>
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
                        </>
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
              const pinned = profile.pinnedBadge === b.id
              return (
                <div
                  key={b.id}
                  className="rounded-2xl border p-3.5 transition"
                  style={{
                    background: unlocked ? tokens.heroGradient : tokens.mutedBg,
                    borderColor: pinned
                      ? '#FBBF24'
                      : unlocked
                        ? `${ARCTIC_SKY.skyMain}66`
                        : tokens.cardBorder,
                    opacity: unlocked ? 1 : 0.55,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xl">{b.icon}</span>
                    {unlocked && (
                      <button
                        type="button"
                        onClick={() => onPinBadge?.(pinned ? null : b.id)}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-extrabold transition cursor-pointer"
                        style={{
                          background: pinned ? 'rgba(251,191,36,0.2)' : tokens.badgeBg,
                          borderColor: pinned ? 'rgba(251,191,36,0.6)' : 'transparent',
                          color: pinned ? '#FBBF24' : tokens.badgeText,
                        }}
                      >
                        <Pin className="h-2.5 w-2.5" />
                        {pinned
                          ? lang === 'pl'
                            ? 'Przypięta'
                            : 'Pinned'
                          : lang === 'pl'
                            ? 'Przypnij'
                            : 'Pin'}
                      </button>
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

      {/* U-09: Direct Message 1-on-1 Modal */}
      {dmTarget && (
        <div
          onClick={() => setDmTarget(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-[min(520px,82dvh)] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-sky-400/30 bg-[#091224] text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquare className="h-4 w-4 text-sky-400 shrink-0" />
                <div className="min-w-0">
                  <div className="truncate font-display text-sm font-extrabold">@{dmTarget.username}</div>
                  <div className="text-[10px] text-sky-300/75">
                    {lang === 'pl' ? 'Wiadomości prywatne 1-na-1' : 'Direct Messages'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => void handleSendDm(e, activeRoomCode, 'lobby')}
                  className="rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-extrabold text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
                >
                  + {lang === 'pl' ? `Zaproś #${activeRoomCode}` : `Invite #${activeRoomCode}`}
                </button>
                <button
                  type="button"
                  onClick={() => setDmTarget(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div ref={dmScrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
              {dmLoading ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  {lang === 'pl' ? 'Wczytywanie wiadomości…' : 'Loading messages…'}
                </div>
              ) : dmMessages.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  {lang === 'pl'
                    ? 'Brak wiadomości — przywitaj się albo wyślij zaproszenie do pokoju!'
                    : 'No messages yet — say hello or send a room invite!'}
                </div>
              ) : (
                dmMessages.map((msg) => {
                  const mine = msg.sender_id === profile.playerId
                  return (
                    <div key={msg.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                          mine
                            ? 'bg-sky-500 text-slate-950 font-semibold'
                            : 'border border-white/10 bg-white/[0.06] text-slate-100'
                        }`}
                      >
                        <div>{msg.content}</div>
                        {msg.room_invite_code && (
                          <button
                            type="button"
                            onClick={() => {
                              onJoinWorld(msg.room_invite_world ?? 'lobby', msg.room_invite_code!)
                              setDmTarget(null)
                            }}
                            className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-400 px-2.5 py-1 text-[10px] font-black text-slate-950 hover:bg-emerald-300 cursor-pointer"
                          >
                            <Play className="h-2.5 w-2.5 fill-slate-950" />
                            {lang === 'pl' ? `Dołącz #${msg.room_invite_code}` : `Join #${msg.room_invite_code}`}
                          </button>
                        )}
                      </div>
                      <span className="mt-0.5 text-[9px] text-slate-500">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )
                })
              )}
            </div>

            <form onSubmit={(e) => void handleSendDm(e)} className="flex gap-2 border-t border-white/10 p-3">
              <input
                type="text"
                value={dmDraft}
                onChange={(e) => setDmDraft(e.target.value)}
                maxLength={240}
                placeholder={lang === 'pl' ? 'Napisz wiadomość…' : 'Type a message…'}
                className="flex-1 rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-xs text-white outline-none focus:border-sky-400"
              />
              <button
                type="submit"
                disabled={dmSending || !dmDraft.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-slate-950 hover:bg-sky-400 disabled:opacity-50 cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
