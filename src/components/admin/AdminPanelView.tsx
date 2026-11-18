import React, { useCallback, useEffect, useState } from 'react'
import {
  Bug,
  Check,
  Crown,
  Flag,
  Lightbulb,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ThumbsUp,
  Trash2,
  Users,
  Wifi,
} from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from '../../data/brandTheme'
import { Lang } from '../../data/locales'
import {
  AccountRole,
  getAccountRoleMeta,
  hasAdminAccess,
  PlayerProfile,
} from '../../store/usePlayerStore'
import {
  adjustAdminPlayer,
  AdminFeedbackRow,
  AdminFeedbackStatus,
  AdminPlatformStats,
  AdminPlayerRow,
  deleteAdminFeedback,
  fetchAdminFeedback,
  fetchAdminPlatformStats,
  fetchAdminPlayers,
  setAdminFeedbackStatus,
  setAdminPlayerRole,
} from '../../lib/adminApi'

interface AdminPanelViewProps {
  profile: PlayerProfile
  mode: ThemeMode
  lang: Lang
  onRefreshSelf: () => Promise<void>
}

type AdminTab = 'players' | 'feedback'

const ROLE_OPTIONS: AccountRole[] = ['player', 'moderator', 'admin', 'owner']

const FEEDBACK_STATUS_META: Record<
  AdminFeedbackStatus,
  { pl: string; en: string; color: string; bg: string }
> = {
  new: { pl: 'Nowe', en: 'New', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.16)' },
  reviewing: { pl: 'Analiza', en: 'Reviewing', color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.16)' },
  planned: { pl: 'Planowane', en: 'Planned', color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.16)' },
  done: { pl: 'Gotowe', en: 'Done', color: '#34D399', bg: 'rgba(52, 211, 153, 0.16)' },
}

function isOnlineRecent(lastSeen: string | null): boolean {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  profile,
  mode,
  lang,
  onRefreshSelf,
}) => {
  const [tab, setTab] = useState<AdminTab>('players')
  const [stats, setStats] = useState<AdminPlatformStats | null>(null)
  const [players, setPlayers] = useState<AdminPlayerRow[]>([])
  const [feedback, setFeedback] = useState<AdminFeedbackRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [stageDrafts, setStageDrafts] = useState<Record<string, string>>({})

  const tokens = getThemeTokens(mode)
  const isDark = mode === 'dark'
  const isPl = lang === 'pl'
  const isOwner = profile.role === 'owner'
  const roleMeta = getAccountRoleMeta(profile.role, lang)

  const panelSurface = isDark ? '#0B1323' : '#FFFFFF'
  const panelBorder = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(14, 165, 233, 0.18)'
  const subtleSurface = isDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(14, 165, 233, 0.06)'

  const flash = useCallback((ok: boolean, text: string) => {
    setNotice({ ok, text })
    window.setTimeout(() => {
      setNotice((cur) => (cur?.text === text ? null : cur))
    }, 2600)
  }, [])

  const loadAll = useCallback(
    async (queryStr = search) => {
      setLoading(true)
      try {
        const [stRes, plRes, fbRes] = await Promise.all([
          fetchAdminPlatformStats(),
          fetchAdminPlayers(queryStr),
          fetchAdminFeedback(),
        ])
        if (stRes.data) setStats(stRes.data)
        if (plRes.data) setPlayers(plRes.data)
        if (fbRes.data) setFeedback(fbRes.data)
        const err = stRes.error || plRes.error || fbRes.error
        if (err) flash(false, err)
      } finally {
        setLoading(false)
      }
    },
    [search, flash],
  )

  useEffect(() => {
    if (!hasAdminAccess(profile.role)) return
    void loadAll('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.role])

  useEffect(() => {
    if (!hasAdminAccess(profile.role)) return
    const t = window.setTimeout(() => {
      void fetchAdminPlayers(search).then((r) => {
        if (!r.error) setPlayers(r.data)
      })
    }, 220)
    return () => window.clearTimeout(t)
  }, [search, profile.role])

  if (!hasAdminAccess(profile.role)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <ShieldAlert className="h-10 w-10 text-rose-400" />
        <p className="text-sm font-extrabold" style={{ color: tokens.textPrimary }}>
          {isPl ? 'Brak uprawnień administratora' : 'Admin access required'}
        </p>
      </div>
    )
  }

  const handleRoleChange = async (target: AdminPlayerRow, newRole: AccountRole) => {
    if (!isOwner) return
    setBusyId(target.id)
    const res = await setAdminPlayerRole(target.id, newRole)
    setBusyId(null)
    if (!res.ok) {
      flash(false, res.error ?? 'Error')
      return
    }
    setPlayers((prev) => prev.map((p) => (p.id === target.id ? { ...p, role: newRole } : p)))
    flash(true, `${target.username} → ${getAccountRoleMeta(newRole, lang).label}`)
    if (target.id === profile.playerId) await onRefreshSelf()
  }

  const handleQuickXp = async (target: AdminPlayerRow, delta: number) => {
    const nextXp = Math.max(0, target.xp + delta)
    setBusyId(target.id)
    const res = await adjustAdminPlayer(target.id, { xp: nextXp })
    setBusyId(null)
    if (!res.ok) {
      flash(false, res.error ?? 'Error')
      return
    }
    setPlayers((prev) => prev.map((p) => (p.id === target.id ? { ...p, xp: nextXp } : p)))
    flash(true, `${target.username}: ${nextXp} XP`)
    if (target.id === profile.playerId) await onRefreshSelf()
  }

  const handleSetObbyStage = async (target: AdminPlayerRow) => {
    const raw = stageDrafts[target.id]
    const parsed = Math.max(1, Math.min(100, Number.parseInt(raw || String(target.obby_best_stage), 10) || 1))
    setBusyId(target.id)
    const res = await adjustAdminPlayer(target.id, {
      obbyStage: parsed,
      obbyBestStage: Math.max(target.obby_best_stage, parsed),
    })
    setBusyId(null)
    if (!res.ok) {
      flash(false, res.error ?? 'Error')
      return
    }
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === target.id
          ? { ...p, obby_stage: parsed, obby_best_stage: Math.max(p.obby_best_stage, parsed) }
          : p,
      ),
    )
    flash(true, `${target.username}: Parkour ${parsed}/100`)
    if (target.id === profile.playerId) await onRefreshSelf()
  }

  const handleFeedbackStatus = async (item: AdminFeedbackRow, status: AdminFeedbackStatus) => {
    setBusyId(item.id)
    const res = await setAdminFeedbackStatus(item.id, status)
    setBusyId(null)
    if (!res.ok) {
      flash(false, res.error ?? 'Error')
      return
    }
    setFeedback((prev) => prev.map((f) => (f.id === item.id ? { ...f, status } : f)))
    flash(true, `${FEEDBACK_STATUS_META[status][lang]}`)
  }

  const handleFeedbackDelete = async (item: AdminFeedbackRow) => {
    setBusyId(item.id)
    const res = await deleteAdminFeedback(item.id)
    setBusyId(null)
    if (!res.ok) {
      flash(false, res.error ?? 'Error')
      return
    }
    setFeedback((prev) => prev.filter((f) => f.id !== item.id))
    flash(true, isPl ? 'Usunięto zgłoszenie' : 'Feedback deleted')
  }

  return (
    <div className="w-full space-y-5 p-4 sm:p-5 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl border"
            style={{ background: roleMeta.bg, borderColor: roleMeta.border, color: roleMeta.color }}
          >
            {isOwner ? <Crown className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-lg sm:text-xl font-extrabold" style={{ color: tokens.textPrimary }}>
                {isPl ? 'Panel Admina' : 'Admin Panel'}
              </h1>
              <span
                className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                style={{ background: roleMeta.bg, borderColor: roleMeta.border, color: roleMeta.color }}
              >
                {roleMeta.label}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {notice && (
            <span
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold"
              style={{
                borderColor: notice.ok ? 'rgba(52, 211, 153, 0.4)' : 'rgba(244, 63, 94, 0.4)',
                background: notice.ok ? 'rgba(16, 185, 129, 0.14)' : 'rgba(244, 63, 94, 0.14)',
                color: notice.ok ? '#34D399' : '#FB7185',
              }}
            >
              <Check className="h-3.5 w-3.5" />
              {notice.text}
            </span>
          )}

          <button
            type="button"
            onClick={() => void loadAll(search)}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-extrabold transition hover:brightness-110 cursor-pointer"
            style={{ background: panelSurface, borderColor: panelBorder, color: tokens.textPrimary }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{isPl ? 'Odśwież' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Live Platform Stats Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            icon: Users,
            color: '#38BDF8',
            label: isPl ? 'Gracze' : 'Players',
            value: stats?.total_players ?? players.length,
          },
          {
            icon: Wifi,
            color: '#34D399',
            label: 'Online',
            value: stats?.online_players ?? 0,
          },
          {
            icon: MessageSquare,
            color: '#FBBF24',
            label: isPl ? 'Nowe zgłoszenia' : 'New feedback',
            value: `${stats?.new_feedback ?? 0} / ${stats?.total_feedback ?? feedback.length}`,
          },
          {
            icon: Flag,
            color: '#F59E0B',
            label: 'Parkour',
            value: stats?.obby_100_clears ?? 0,
          },
        ].map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className="flex items-center justify-between rounded-xl border px-3.5 py-3"
              style={{ background: panelSurface, borderColor: panelBorder }}
            >
              <div>
                <div className="text-[11px] font-bold" style={{ color: tokens.textSecondary }}>
                  {card.label}
                </div>
                <div className="mt-0.5 font-mono text-lg font-black" style={{ color: tokens.textPrimary }}>
                  {card.value}
                </div>
              </div>
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: `${card.color}1C`, color: card.color }}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>
          )
        })}
      </div>

      {/* Section Switch Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex items-center gap-1 rounded-xl border p-1"
          style={{ background: panelSurface, borderColor: panelBorder }}
        >
          <button
            type="button"
            onClick={() => setTab('players')}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold transition cursor-pointer"
            style={{
              background: tab === 'players' ? `${ARCTIC_SKY.skyMain}22` : 'transparent',
              color: tab === 'players' ? ARCTIC_SKY.skyMain : tokens.textSecondary,
            }}
          >
            <Users className="h-3.5 w-3.5" />
            <span>{isPl ? 'Gracze' : 'Players'}</span>
            <span className="font-mono text-[10px] opacity-80">{players.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('feedback')}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold transition cursor-pointer"
            style={{
              background: tab === 'feedback' ? `${ARCTIC_SKY.skyMain}22` : 'transparent',
              color: tab === 'feedback' ? ARCTIC_SKY.skyMain : tokens.textSecondary,
            }}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{isPl ? 'Zgłoszenia' : 'Feedback'}</span>
            <span className="font-mono text-[10px] opacity-80">{feedback.length}</span>
          </button>
        </div>

        {tab === 'players' && (
          <div
            className="flex w-full sm:w-64 items-center gap-2 rounded-xl border px-3 py-1.5"
            style={{ background: panelSurface, borderColor: panelBorder }}
          >
            <Search className="h-3.5 w-3.5 shrink-0" style={{ color: tokens.textSecondary }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isPl ? 'Szukaj gracza...' : 'Search player...'}
              className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none"
              style={{ color: tokens.textPrimary }}
            />
          </div>
        )}
      </div>

      {/* === TAB 1: PLAYERS MANAGEMENT === */}
      {tab === 'players' && (
        <div
          className="overflow-hidden rounded-xl border"
          style={{ background: panelSurface, borderColor: panelBorder }}
        >
          <div className="divide-y" style={{ borderColor: panelBorder }}>
            {players.map((p) => {
              const online = isOnlineRecent(p.last_seen)
              const meta = getAccountRoleMeta(p.role, lang)
              const isSelf = p.id === profile.playerId
              const isBusy = busyId === p.id
              return (
                <div
                  key={p.id}
                  className="flex flex-col gap-3 p-3.5 lg:flex-row lg:items-center lg:justify-between"
                  style={{ borderColor: panelBorder }}
                >
                  {/* Player identity */}
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-black text-white"
                      style={{
                        background:
                          p.role === 'owner'
                            ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                            : 'linear-gradient(135deg, #0EA5E9 0%, #2563EB 100%)',
                      }}
                    >
                      {p.role === 'owner' ? <Crown className="h-4 w-4 text-slate-950" /> : p.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-slate-500/60'}`}
                        />
                        <span className="truncate text-sm font-extrabold" style={{ color: tokens.textPrimary }}>
                          {p.username}
                        </span>
                        <span className="font-mono text-[10px]" style={{ color: tokens.textSecondary }}>
                          {p.fresh_tag}
                        </span>
                        <span
                          className="rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold uppercase"
                          style={{ background: meta.bg, borderColor: meta.border, color: meta.color }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3 font-mono text-[11px]" style={{ color: tokens.textSecondary }}>
                        <span className="text-sky-400">{p.xp} XP</span>
                        <span className="text-amber-400">Parkour {p.obby_best_stage}/100</span>
                        {p.last_world && (
                          <span>
                            {p.last_world} #{p.last_room ?? 'PUBLIC-1'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Admin Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Role Selector (Owner only) */}
                    {isOwner && (
                      <div className="inline-flex items-center gap-1">
                        <Shield className="h-3.5 w-3.5" style={{ color: tokens.textSecondary }} />
                        <select
                          value={p.role}
                          disabled={isBusy || isSelf}
                          onChange={(e) => void handleRoleChange(p, e.target.value as AccountRole)}
                          className="h-8 rounded-lg border px-2 text-xs font-bold outline-none cursor-pointer disabled:opacity-55"
                          style={{
                            background: isDark ? '#080F1D' : '#F8FAFC',
                            borderColor: panelBorder,
                            color: tokens.textPrimary,
                          }}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {getAccountRoleMeta(r, lang).label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Quick +100 XP */}
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleQuickXp(p, 100)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 font-mono text-[11px] font-extrabold transition hover:brightness-110 cursor-pointer disabled:opacity-50"
                      style={{
                        background: subtleSurface,
                        borderColor: panelBorder,
                        color: ARCTIC_SKY.skyMain,
                      }}
                    >
                      <Plus className="h-3 w-3" />
                      100 XP
                    </button>

                    {/* Set Parkour stage */}
                    <div
                      className="inline-flex h-8 items-center overflow-hidden rounded-lg border"
                      style={{ borderColor: panelBorder, background: subtleSurface }}
                    >
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={stageDrafts[p.id] ?? String(p.obby_stage)}
                        onChange={(e) => setStageDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        className="w-12 bg-transparent px-2 text-center font-mono text-xs font-bold outline-none"
                        style={{ color: tokens.textPrimary }}
                        title="Parkour Stage (1-100)"
                      />
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleSetObbyStage(p)}
                        className="flex h-full items-center gap-1 border-l px-2 text-[11px] font-extrabold text-amber-400 hover:bg-amber-500/15 cursor-pointer"
                        style={{ borderColor: panelBorder }}
                        title={isPl ? 'Ustaw etap Parkour' : 'Set Parkour stage'}
                      >
                        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Flag className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {players.length === 0 && !loading && (
              <div className="p-8 text-center text-xs font-bold" style={{ color: tokens.textSecondary }}>
                {isPl ? 'Brak wyników' : 'No players found'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === TAB 2: FEEDBACK & IDEAS MODERATION === */}
      {tab === 'feedback' && (
        <div className="space-y-2.5">
          {feedback.map((item) => {
            const st = FEEDBACK_STATUS_META[item.status] ?? FEEDBACK_STATUS_META.new
            const isBusy = busyId === item.id
            return (
              <div
                key={item.id}
                className="rounded-xl border p-3.5"
                style={{ background: panelSurface, borderColor: panelBorder }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase"
                        style={{
                          background: item.kind === 'bug' ? 'rgba(244, 63, 94, 0.16)' : 'rgba(56, 189, 248, 0.16)',
                          color: item.kind === 'bug' ? '#FB7185' : '#38BDF8',
                        }}
                      >
                        {item.kind === 'bug' ? <Bug className="h-3 w-3" /> : <Lightbulb className="h-3 w-3" />}
                        {item.kind === 'bug' ? (isPl ? 'Błąd' : 'Bug') : isPl ? 'Pomysł' : 'Idea'}
                      </span>
                      <span className="text-sm font-extrabold" style={{ color: tokens.textPrimary }}>
                        {item.title}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-sky-400">
                        <ThumbsUp className="h-3 w-3" />
                        {item.upvotes}
                      </span>
                    </div>

                    <p className="text-xs leading-relaxed" style={{ color: tokens.textSecondary }}>
                      {item.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 font-mono text-[10px]" style={{ color: tokens.textSecondary }}>
                      <span>@{item.username}</span>
                      {item.context && <span>{item.context}</span>}
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Status selector + Delete */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <select
                      value={item.status}
                      disabled={isBusy}
                      onChange={(e) => void handleFeedbackStatus(item, e.target.value as AdminFeedbackStatus)}
                      className="h-8 rounded-lg border px-2 text-xs font-extrabold outline-none cursor-pointer"
                      style={{
                        background: st.bg,
                        borderColor: `${st.color}45`,
                        color: st.color,
                      }}
                    >
                      {(['new', 'reviewing', 'planned', 'done'] as AdminFeedbackStatus[]).map((k) => (
                        <option key={k} value={k} style={{ background: '#0B1323', color: '#F8FAFC' }}>
                          {FEEDBACK_STATUS_META[k][lang]}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleFeedbackDelete(item)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/12 text-rose-400 hover:bg-rose-500/25 cursor-pointer"
                      title={isPl ? 'Usuń' : 'Delete'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {feedback.length === 0 && !loading && (
            <div
              className="rounded-xl border p-8 text-center text-xs font-bold"
              style={{ background: panelSurface, borderColor: panelBorder, color: tokens.textSecondary }}
            >
              {isPl ? 'Brak zgłoszeń' : 'No feedback items yet'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
