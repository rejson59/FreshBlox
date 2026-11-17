import React, { useCallback, useEffect, useState } from 'react'
import {
  Check,
  Copy,
  Crown,
  Flame,
  LogOut,
  Medal,
  Plus,
  RefreshCw,
  Send,
  Shield,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from '../../data/brandTheme'
import { Lang } from '../../data/locales'
import {
  createClan,
  CURRENT_SEASON,
  fetchMyClan,
  fetchSeasonalLeaderboard,
  joinClanByCode,
  leaveClan,
  MyClanBundle,
  SeasonalClanRow,
  SeasonalPlayerRow,
  SeasonLeaderboardCategory,
  sendClanMessage,
} from '../../lib/clanApi'
import { formatSpeedrunTime } from '../../lib/socialApi'
import { sfx } from '../../lib/sfx'

interface ClansAndSeasonsSectionProps {
  playerId: string
  mode: ThemeMode
  lang: Lang
  onClanChanged: (clanId: string | null, clanTag: string | null) => void
}

const CLAN_COLORS = ['#38BDF8', '#22D3EE', '#F97316', '#FACC15', '#A855F7', '#10B981', '#F43F5E']

export const ClansAndSeasonsSection: React.FC<ClansAndSeasonsSectionProps> = ({
  playerId,
  mode,
  lang,
  onClanChanged,
}) => {
  const isPl = lang === 'pl'
  const tokens = getThemeTokens(mode)

  // P-03: Clans state
  const [clanBundle, setClanBundle] = useState<MyClanBundle | null>(null)
  const [clanLoading, setClanLoading] = useState(true)
  const [clanTab, setClanTab] = useState<'create' | 'join'>('create')
  const [tagInput, setTagInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [colorInput, setColorInput] = useState('#38BDF8')
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [clanMsgDraft, setClanMsgDraft] = useState('')
  const [clanBusy, setClanBusy] = useState(false)
  const [clanError, setClanError] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)

  // P-06: Season TOP 100 state
  const [lbCategory, setLbCategory] = useState<SeasonLeaderboardCategory>('arena')
  const [lbPlayers, setLbPlayers] = useState<SeasonalPlayerRow[]>([])
  const [lbClans, setLbClans] = useState<SeasonalClanRow[]>([])
  const [lbLoading, setLbLoading] = useState(false)

  const loadClan = useCallback(async () => {
    setClanLoading(true)
    const data = await fetchMyClan()
    setClanBundle(data)
    onClanChanged(data?.clan.id ?? null, data?.clan.tag ?? null)
    setClanLoading(false)
  }, [onClanChanged])

  const loadSeasonBoard = useCallback(async (cat: SeasonLeaderboardCategory) => {
    setLbLoading(true)
    if (cat === 'clans') {
      const rows = await fetchSeasonalLeaderboard('clans', 100)
      setLbClans(rows)
    } else {
      const rows = await fetchSeasonalLeaderboard(cat, 100)
      setLbPlayers(rows)
    }
    setLbLoading(false)
  }, [])

  useEffect(() => {
    void loadClan()
  }, [loadClan])

  useEffect(() => {
    void loadSeasonBoard(lbCategory)
  }, [lbCategory, loadSeasonBoard])

  const mapClanError = (raw?: string): string => {
    const code = (raw ?? '').toUpperCase()
    if (code.includes('TAG_INVALID')) return isPl ? 'Tag musi mieć 2–5 liter/cyfr (A-Z, 0-9).' : 'Tag must be 2–5 alphanumeric chars.'
    if (code.includes('NAME_INVALID')) return isPl ? 'Nazwa klanu musi mieć 3–28 znaków.' : 'Clan name must be 3–28 characters.'
    if (code.includes('TAG_TAKEN')) return isPl ? 'Ten [TAG] jest już zajęty przez inny klan!' : 'This [TAG] is already taken!'
    if (code.includes('ALREADY_IN_CLAN')) return isPl ? 'Jesteś już w klanie.' : 'You are already in a clan.'
    if (code.includes('CLAN_NOT_FOUND')) return isPl ? 'Nie znaleziono klanu o takim kodzie lub tagu.' : 'Clan not found for that code or tag.'
    if (code.includes('CLAN_FULL')) return isPl ? 'Ten klan osiągnął limit 50 graczy.' : 'This clan is full (50 members).'
    return raw ?? (isPl ? 'Błąd operacji klanowej.' : 'Clan operation failed.')
  }

  const handleCreateClan = async (e: React.FormEvent) => {
    e.preventDefault()
    setClanError(null)
    setClanBusy(true)
    const res = await createClan(tagInput, nameInput, colorInput)
    setClanBusy(false)
    if (!res.ok) {
      setClanError(mapClanError(res.error))
      return
    }
    sfx.playQuestClaim()
    setTagInput('')
    setNameInput('')
    await loadClan()
    if (lbCategory === 'clans') void loadSeasonBoard('clans')
  }

  const handleJoinClan = async (e: React.FormEvent) => {
    e.preventDefault()
    setClanError(null)
    if (!joinCodeInput.trim()) return
    setClanBusy(true)
    const res = await joinClanByCode(joinCodeInput)
    setClanBusy(false)
    if (!res.ok) {
      setClanError(mapClanError(res.error))
      return
    }
    sfx.playQuestClaim()
    setJoinCodeInput('')
    await loadClan()
  }

  const handleLeaveClan = async () => {
    setClanBusy(true)
    await leaveClan()
    setClanBusy(false)
    sfx.playClick()
    await loadClan()
  }

  const handleSendClanMsg = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = clanMsgDraft.trim()
    if (!clean || clanBusy) return
    setClanBusy(true)
    const res = await sendClanMessage(clean)
    setClanBusy(false)
    if (res.ok && res.message) {
      setClanMsgDraft('')
      sfx.playChatPop()
      setClanBundle((prev) =>
        prev ? { ...prev, messages: [...prev.messages, res.message!].slice(-40) } : prev,
      )
    }
  }

  const handleCopyInvite = () => {
    if (!clanBundle) return
    void navigator.clipboard?.writeText(clanBundle.clan.invite_code)
    setCopiedCode(true)
    sfx.playClick()
    window.setTimeout(() => setCopiedCode(false), 1800)
  }

  return (
    <div className="grid gap-4 sm:gap-5 lg:grid-cols-12">
      {/* ==================== P-03: CLANS / GUILDS [TAG] ==================== */}
      <div
        className="min-w-0 space-y-4 rounded-3xl border p-4 sm:p-6 backdrop-blur-md lg:col-span-5"
        style={{ background: tokens.cardBg, borderColor: `${ARCTIC_SKY.skyMain}44` }}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold" style={{ color: tokens.textPrimary }}>
            <Shield className="h-5 w-5" style={{ color: ARCTIC_SKY.skyMain }} />
            {isPl ? 'Klany & Gildie [TAG]' : 'Clans & Guilds [TAG]'}
          </h2>
          <button
            type="button"
            onClick={() => void loadClan()}
            className="flex h-7 w-7 items-center justify-center rounded-lg border cursor-pointer hover:opacity-80"
            style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg, color: tokens.textPrimary }}
            title={isPl ? 'Odśwież' : 'Refresh'}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${clanLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {clanLoading ? (
          <div className="py-8 text-center text-xs" style={{ color: tokens.textSecondary }}>
            {isPl ? 'Wczytywanie danych klanu…' : 'Loading clan data…'}
          </div>
        ) : clanBundle ? (
          <div className="space-y-4">
            {/* Active Clan Header */}
            <div
              className="rounded-2xl border p-3.5"
              style={{
                borderColor: `${clanBundle.clan.accent_color}66`,
                background: `${clanBundle.clan.accent_color}18`,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-lg px-2 py-0.5 font-mono text-xs font-black text-slate-950"
                      style={{ background: clanBundle.clan.accent_color }}
                    >
                      [{clanBundle.clan.tag}]
                    </span>
                    <span className="font-display text-base font-extrabold" style={{ color: tokens.textPrimary }}>
                      {clanBundle.clan.name}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px]" style={{ color: tokens.textSecondary }}>
                    <span>
                      {isPl ? 'Kod zaproszenia:' : 'Invite code:'}{' '}
                      <strong className="font-mono" style={{ color: tokens.textPrimary }}>
                        {clanBundle.clan.invite_code}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyInvite}
                      className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold cursor-pointer"
                      style={{ borderColor: tokens.cardBorder, background: tokens.cardBg, color: tokens.textPrimary }}
                    >
                      {copiedCode ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copiedCode ? (isPl ? 'Skopiowano' : 'Copied') : isPl ? 'Kopiuj' : 'Copy'}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={clanBusy}
                  onClick={() => void handleLeaveClan()}
                  title={isPl ? 'Opuść klan' : 'Leave clan'}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-rose-400/35 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Members List */}
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider" style={{ color: tokens.textSecondary }}>
                <span>{isPl ? 'Członkowie' : 'Members'}</span>
                <span className="font-mono text-sky-400">{clanBundle.members.length}/50</span>
              </div>
              <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
                {clanBundle.members.map((m) => (
                  <div
                    key={m.user_id}
                    className="flex items-center justify-between rounded-xl border px-3 py-1.5 text-xs"
                    style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${m.is_online ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                      <span className="truncate font-extrabold" style={{ color: tokens.textPrimary }}>
                        {m.username}
                      </span>
                      {m.role === 'leader' && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                    </div>
                    <span className="shrink-0 font-mono text-[10px] font-bold" style={{ color: tokens.textSecondary }}>
                      {m.xp} XP · 🔥{m.arena_eliminations}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Clan Chat */}
            <div className="space-y-2">
              <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: tokens.textSecondary }}>
                {isPl ? 'Czat Klanowy' : 'Clan Chat'}
              </div>
              <div
                className="max-h-40 space-y-1.5 overflow-y-auto rounded-2xl border p-2.5"
                style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
              >
                {clanBundle.messages.length === 0 ? (
                  <div className="py-4 text-center text-[11px]" style={{ color: tokens.textSecondary }}>
                    {isPl ? 'Brak wiadomości klanowych — napisz pierwszą!' : 'No clan messages yet — say hi!'}
                  </div>
                ) : (
                  clanBundle.messages.map((msg) => (
                    <div key={msg.id} className="text-xs leading-snug">
                      <span className="font-extrabold text-sky-400">{msg.sender_username}: </span>
                      <span style={{ color: tokens.textPrimary }}>{msg.content}</span>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={(e) => void handleSendClanMsg(e)} className="flex gap-2">
                <input
                  type="text"
                  value={clanMsgDraft}
                  onChange={(e) => setClanMsgDraft(e.target.value)}
                  maxLength={220}
                  placeholder={isPl ? 'Napisz do klanu…' : 'Message clan…'}
                  className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-xs font-semibold outline-none"
                  style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg, color: tokens.textPrimary }}
                />
                <button
                  type="submit"
                  disabled={clanBusy || !clanMsgDraft.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-50 cursor-pointer"
                  style={{ background: tokens.buttonGradient }}
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed" style={{ color: tokens.textSecondary }}>
              {isPl
                ? 'Załóż własny klan lub dołącz po kodzie zaproszenia! Twój [TAG] pojawi się przed nickiem w 3D (Lobby, Obby, Portal Arena) oraz w rankingu klanów.'
                : 'Create a clan or join with an invite code! Your [TAG] appears over your 3D avatar in all worlds and on the Clans leaderboard.'}
            </p>

            <div className="grid grid-cols-2 gap-1.5 rounded-xl border p-1" style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}>
              <button
                type="button"
                onClick={() => {
                  setClanTab('create')
                  setClanError(null)
                }}
                className="rounded-lg py-1.5 text-xs font-extrabold transition cursor-pointer"
                style={{
                  background: clanTab === 'create' ? tokens.buttonGradient : 'transparent',
                  color: clanTab === 'create' ? '#FFFFFF' : tokens.textSecondary,
                }}
              >
                {isPl ? 'Załóż klan' : 'Create Clan'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setClanTab('join')
                  setClanError(null)
                }}
                className="rounded-lg py-1.5 text-xs font-extrabold transition cursor-pointer"
                style={{
                  background: clanTab === 'join' ? tokens.buttonGradient : 'transparent',
                  color: clanTab === 'join' ? '#FFFFFF' : tokens.textSecondary,
                }}
              >
                {isPl ? 'Dołącz kodem' : 'Join by Code'}
              </button>
            </div>

            {clanTab === 'create' ? (
              <form onSubmit={(e) => void handleCreateClan(e)} className="space-y-2.5">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase" style={{ color: tokens.textSecondary }}>
                      [TAG] (2-5)
                    </label>
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
                      placeholder="SKY"
                      maxLength={5}
                      className="w-full rounded-xl border px-3 py-2 font-mono text-xs font-black uppercase outline-none"
                      style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg, color: tokens.textPrimary }}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1 block text-[10px] font-bold uppercase" style={{ color: tokens.textSecondary }}>
                      {isPl ? 'Nazwa klanu' : 'Clan Name'}
                    </label>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value.slice(0, 28))}
                      placeholder={isPl ? 'np. Władcy Portali' : 'e.g. Portal Lords'}
                      maxLength={28}
                      className="w-full rounded-xl border px-3 py-2 text-xs font-bold outline-none"
                      style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg, color: tokens.textPrimary }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold" style={{ color: tokens.textSecondary }}>
                    {isPl ? 'Kolor tagu:' : 'Tag color:'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {CLAN_COLORS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setColorInput(hex)}
                        className={`h-6 w-6 rounded-full border-2 transition cursor-pointer ${
                          colorInput === hex ? 'scale-110 border-white' : 'border-transparent opacity-75'
                        }`}
                        style={{ background: hex }}
                      />
                    ))}
                  </div>
                </div>

                {clanError && <div className="text-xs font-bold text-rose-400">{clanError}</div>}

                <button
                  type="submit"
                  disabled={clanBusy || tagInput.length < 2 || nameInput.trim().length < 3}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold text-white disabled:opacity-50 cursor-pointer"
                  style={{ background: tokens.buttonGradient }}
                >
                  <Plus className="h-4 w-4" />
                  {isPl ? 'Utwórz Klan' : 'Create Clan'}
                </button>
              </form>
            ) : (
              <form onSubmit={(e) => void handleJoinClan(e)} className="space-y-2.5">
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder={isPl ? 'Wpisz kod (CLN-XXXXXX) lub [TAG]' : 'Enter code (CLN-XXXXXX) or [TAG]'}
                  maxLength={16}
                  className="w-full rounded-xl border px-3.5 py-2.5 font-mono text-xs font-bold uppercase outline-none"
                  style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg, color: tokens.textPrimary }}
                />
                {clanError && <div className="text-xs font-bold text-rose-400">{clanError}</div>}
                <button
                  type="submit"
                  disabled={clanBusy || joinCodeInput.trim().length < 2}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold text-white disabled:opacity-50 cursor-pointer"
                  style={{ background: tokens.buttonGradient }}
                >
                  <Users className="h-4 w-4" />
                  {isPl ? 'Dołącz do Klanu' : 'Join Clan'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* ==================== P-06: SEASONAL TOP 100 LEADERBOARDS ==================== */}
      <div
        className="min-w-0 space-y-4 rounded-3xl border p-4 sm:p-6 backdrop-blur-md lg:col-span-7"
        style={{ background: tokens.cardBg, borderColor: `${ARCTIC_SKY.skyMain}44` }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-extrabold" style={{ color: tokens.textPrimary }}>
              <Trophy className="h-5 w-5 text-amber-400" />
              {isPl ? 'Sezonowy Ranking TOP 100' : 'Seasonal TOP 100 Leaderboards'}
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-bold" style={{ color: tokens.textSecondary }}>
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-300">
                {isPl ? CURRENT_SEASON.namePl : CURRENT_SEASON.nameEn}
              </span>
              <span>{isPl ? CURRENT_SEASON.endsLabelPl : CURRENT_SEASON.endsLabelEn}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadSeasonBoard(lbCategory)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border cursor-pointer hover:opacity-80"
            style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg, color: tokens.textPrimary }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${lbLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Category Pills */}
        <div className="grid grid-cols-4 gap-1.5 rounded-2xl border p-1" style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}>
          {(
            [
              { id: 'arena', label: 'Portal Arena', icon: Flame },
              { id: 'obby', label: 'Obby 100', icon: Trophy },
              { id: 'clans', label: isPl ? 'Klany' : 'Clans', icon: Shield },
              { id: 'xp', label: 'XP', icon: Zap },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon
            const active = lbCategory === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  sfx.playClick()
                  setLbCategory(tab.id)
                }}
                className="flex items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-extrabold transition cursor-pointer"
                style={{
                  background: active ? tokens.buttonGradient : 'transparent',
                  color: active ? '#FFFFFF' : tokens.textSecondary,
                }}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* TOP 3 Reward Banner */}
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3.5 py-2 text-[11px]"
          style={{ borderColor: 'rgba(250, 204, 21, 0.35)', background: 'rgba(250, 204, 21, 0.08)' }}
        >
          <span className="flex items-center gap-1.5 font-extrabold text-amber-300">
            <Medal className="h-4 w-4 shrink-0" />
            {isPl
              ? 'Nagrody Sezonu 1: TOP 3 otrzymuje ekskluzywne złote odznaki sezonu!'
              : 'Season 1 Rewards: TOP 3 players earn exclusive gold seasonal badges!'}
          </span>
        </div>

        {/* Leaderboard Rows */}
        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {lbLoading ? (
            <div className="py-8 text-center text-xs" style={{ color: tokens.textSecondary }}>
              {isPl ? 'Ładowanie rankingu…' : 'Loading leaderboard…'}
            </div>
          ) : lbCategory === 'clans' ? (
            lbClans.length === 0 ? (
              <div className="py-8 text-center text-xs" style={{ color: tokens.textSecondary }}>
                {isPl ? 'Brak klanów w tym sezonie — załóż pierwszy obok!' : 'No clans yet this season — create the first one!'}
              </div>
            ) : (
              lbClans.map((c, idx) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs"
                  style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-6 text-center font-mono text-xs font-black"
                      style={{ color: idx === 0 ? '#FACC15' : idx === 1 ? '#CBD5E1' : idx === 2 ? '#FB923C' : tokens.textSecondary }}
                    >
                      #{idx + 1}
                    </span>
                    <span
                      className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-black text-slate-950"
                      style={{ background: c.accent_color || '#38BDF8' }}
                    >
                      [{c.tag}]
                    </span>
                    <span className="truncate font-extrabold" style={{ color: tokens.textPrimary }}>
                      {c.name}
                    </span>
                    <span className="text-[10px]" style={{ color: tokens.textSecondary }}>
                      ({c.member_count})
                    </span>
                  </div>
                  <div className="shrink-0 font-mono text-[11px] font-extrabold text-sky-400">
                    {c.score.toLocaleString()} pkt
                  </div>
                </div>
              ))
            )
          ) : lbPlayers.length === 0 ? (
            <div className="py-8 text-center text-xs" style={{ color: tokens.textSecondary }}>
              {isPl ? 'Brak wpisów w tej kategorii.' : 'No entries yet.'}
            </div>
          ) : (
            lbPlayers.map((p, idx) => {
              const isMe = p.id === playerId
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs"
                  style={{
                    borderColor: isMe ? ARCTIC_SKY.skyMain : tokens.cardBorder,
                    background: isMe ? `${ARCTIC_SKY.skyMain}1A` : tokens.mutedBg,
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-6 text-center font-mono text-xs font-black"
                      style={{ color: idx === 0 ? '#FACC15' : idx === 1 ? '#CBD5E1' : idx === 2 ? '#FB923C' : tokens.textSecondary }}
                    >
                      {idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `#${idx + 1}`}
                    </span>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${p.is_online ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    {p.clan_tag && (
                      <span className="rounded bg-sky-500/20 px-1 py-0.5 font-mono text-[10px] font-black text-sky-300">
                        [{p.clan_tag}]
                      </span>
                    )}
                    <span className="truncate font-extrabold" style={{ color: tokens.textPrimary }}>
                      {p.username}
                    </span>
                  </div>

                  <div className="shrink-0 font-mono text-[11px] font-extrabold">
                    {lbCategory === 'arena' && (
                      <span className="text-orange-300">
                        🏆 {p.arena_wins} · 🔥 {p.arena_eliminations} · ⚡ {p.arena_best_speed} km/h
                      </span>
                    )}
                    {lbCategory === 'obby' && (
                      <span className="text-amber-300">
                        {p.obby_best_stage}/100{' '}
                        {p.obby_best_time_ms ? `(${formatSpeedrunTime(p.obby_best_time_ms)})` : ''}
                      </span>
                    )}
                    {lbCategory === 'xp' && <span className="text-sky-300">{p.xp.toLocaleString()} XP</span>}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
