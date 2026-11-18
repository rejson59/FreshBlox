import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bug,
  Check,
  Inbox,
  Lightbulb,
  RefreshCw,
  Search,
  ShieldAlert,
  ThumbsUp,
  Trash2,
} from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from '../../data/brandTheme'
import { Lang } from '../../data/locales'
import { hasAdminAccess, PlayerProfile } from '../../store/usePlayerStore'
import {
  AdminFeedbackRow,
  AdminFeedbackStatus,
  deleteAdminFeedback,
  fetchAdminFeedback,
  setAdminFeedbackStatus,
} from '../../lib/adminApi'

interface FeedbackInboxViewProps {
  profile: PlayerProfile
  mode: ThemeMode
  lang: Lang
  onNewCountChange?: (count: number) => void
}

const STATUS_META: Record<
  AdminFeedbackStatus,
  { pl: string; en: string; color: string; bg: string }
> = {
  new: { pl: 'Nowe', en: 'New', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.16)' },
  reviewing: { pl: 'Analiza', en: 'Reviewing', color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.16)' },
  planned: { pl: 'Planowane', en: 'Planned', color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.16)' },
  done: { pl: 'Gotowe', en: 'Done', color: '#34D399', bg: 'rgba(52, 211, 153, 0.16)' },
}

const ALL_STATUSES: AdminFeedbackStatus[] = ['new', 'reviewing', 'planned', 'done']

export const FeedbackInboxView: React.FC<FeedbackInboxViewProps> = ({
  profile,
  mode,
  lang,
  onNewCountChange,
}) => {
  const [items, setItems] = useState<AdminFeedbackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [kindFilter, setKindFilter] = useState<'all' | 'bug' | 'idea'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | AdminFeedbackStatus>('all')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const tokens = getThemeTokens(mode)
  const isDark = mode === 'dark'
  const isPl = lang === 'pl'

  const panelSurface = isDark ? '#0B1323' : '#FFFFFF'
  const panelBorder = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(14, 165, 233, 0.18)'
  const subtleSurface = isDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(14, 165, 233, 0.06)'

  const syncNewCount = useCallback(
    (rows: AdminFeedbackRow[]) => {
      onNewCountChange?.(rows.filter((r) => r.status === 'new').length)
    },
    [onNewCountChange],
  )

  const loadFeedback = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchAdminFeedback()
      if (!res.error) {
        setItems(res.data)
        syncNewCount(res.data)
      }
    } finally {
      setLoading(false)
    }
  }, [syncNewCount])

  useEffect(() => {
    if (!hasAdminAccess(profile.role)) return
    void loadFeedback()
  }, [profile.role, loadFeedback])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (kindFilter !== 'all' && item.kind !== kindFilter) return false
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (q) {
        const hay = `${item.title} ${item.description} ${item.username} ${item.context ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [items, kindFilter, statusFilter, search])

  const counts = useMemo(
    () => ({
      all: items.length,
      new: items.filter((i) => i.status === 'new').length,
      bugs: items.filter((i) => i.kind === 'bug').length,
      ideas: items.filter((i) => i.kind === 'idea').length,
    }),
    [items],
  )

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

  const flash = (text: string) => {
    setNotice(text)
    window.setTimeout(() => {
      setNotice((cur) => (cur === text ? null : cur))
    }, 2200)
  }

  const handleStatusChange = async (item: AdminFeedbackRow, next: AdminFeedbackStatus) => {
    if (item.status === next) return
    setBusyId(item.id)
    const res = await setAdminFeedbackStatus(item.id, next)
    setBusyId(null)
    if (!res.ok) return
    const updated = items.map((r) => (r.id === item.id ? { ...r, status: next } : r))
    setItems(updated)
    syncNewCount(updated)
    flash(`${STATUS_META[next][lang]}`)
  }

  const handleDelete = async (item: AdminFeedbackRow) => {
    setBusyId(item.id)
    const res = await deleteAdminFeedback(item.id)
    setBusyId(null)
    if (!res.ok) return
    const updated = items.filter((r) => r.id !== item.id)
    setItems(updated)
    syncNewCount(updated)
    flash(isPl ? 'Usunięto' : 'Deleted')
  }

  return (
    <div className="w-full space-y-4 p-4 sm:p-5 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl border"
            style={{
              background: 'rgba(56, 189, 248, 0.16)',
              borderColor: 'rgba(56, 189, 248, 0.4)',
              color: '#38BDF8',
            }}
          >
            <Inbox className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-lg sm:text-xl font-extrabold" style={{ color: tokens.textPrimary }}>
              {isPl ? 'Lista zgłoszeń' : 'Feedback Inbox'}
            </h1>
            {counts.new > 0 && (
              <span className="rounded-md bg-sky-500/20 border border-sky-400/40 px-2 py-0.5 font-mono text-[11px] font-black text-sky-300">
                {counts.new} {isPl ? 'nowe' : 'new'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {notice && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-300">
              <Check className="h-3.5 w-3.5" />
              {notice}
            </span>
          )}
          <button
            type="button"
            onClick={() => void loadFeedback()}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-extrabold transition hover:brightness-110 cursor-pointer"
            style={{ background: panelSurface, borderColor: panelBorder, color: tokens.textPrimary }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{isPl ? 'Odśwież' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Kind Filter */}
          <div
            className="inline-flex items-center gap-1 rounded-xl border p-1"
            style={{ background: panelSurface, borderColor: panelBorder }}
          >
            {[
              { id: 'all' as const, label: `${isPl ? 'Wszystkie' : 'All'} (${counts.all})` },
              { id: 'bug' as const, label: `${isPl ? 'Błędy' : 'Bugs'} (${counts.bugs})` },
              { id: 'idea' as const, label: `${isPl ? 'Pomysły' : 'Ideas'} (${counts.ideas})` },
            ].map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKindFilter(k.id)}
                className="rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer"
                style={{
                  background: kindFilter === k.id ? `${ARCTIC_SKY.skyMain}24` : 'transparent',
                  color: kindFilter === k.id ? ARCTIC_SKY.skyMain : tokens.textSecondary,
                }}
              >
                {k.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div
            className="inline-flex items-center gap-1 rounded-xl border p-1"
            style={{ background: panelSurface, borderColor: panelBorder }}
          >
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className="rounded-lg px-2 py-1 text-[11px] font-extrabold transition cursor-pointer"
              style={{
                background: statusFilter === 'all' ? subtleSurface : 'transparent',
                color: statusFilter === 'all' ? tokens.textPrimary : tokens.textSecondary,
              }}
            >
              {isPl ? 'Każdy status' : 'Any status'}
            </button>
            {ALL_STATUSES.map((st) => {
              const meta = STATUS_META[st]
              const active = statusFilter === st
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className="rounded-lg px-2 py-1 text-[11px] font-extrabold transition cursor-pointer"
                  style={{
                    background: active ? meta.bg : 'transparent',
                    color: active ? meta.color : tokens.textSecondary,
                  }}
                >
                  {meta[lang]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Search */}
        <div
          className="flex w-full sm:w-60 items-center gap-2 rounded-xl border px-3 py-1.5"
          style={{ background: panelSurface, borderColor: panelBorder }}
        >
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: tokens.textSecondary }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isPl ? 'Szukaj w zgłoszeniach...' : 'Search feedback...'}
            className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none"
            style={{ color: tokens.textPrimary }}
          />
        </div>
      </div>

      {/* Feedback Cards List */}
      <div className="space-y-2.5">
        {filtered.map((item) => {
          const isBusy = busyId === item.id
          return (
            <article
              key={item.id}
              className="rounded-xl border p-4 transition-colors"
              style={{
                background: panelSurface,
                borderColor: item.status === 'new' ? 'rgba(56, 189, 248, 0.32)' : panelBorder,
              }}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                      style={{
                        background:
                          item.kind === 'bug' ? 'rgba(244, 63, 94, 0.16)' : 'rgba(56, 189, 248, 0.16)',
                        color: item.kind === 'bug' ? '#FB7185' : '#38BDF8',
                      }}
                    >
                      {item.kind === 'bug' ? <Bug className="h-3 w-3" /> : <Lightbulb className="h-3 w-3" />}
                      {item.kind === 'bug' ? (isPl ? 'Błąd' : 'Bug') : isPl ? 'Pomysł' : 'Idea'}
                    </span>

                    <h2 className="text-sm font-extrabold" style={{ color: tokens.textPrimary }}>
                      {item.title}
                    </h2>

                    <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] font-bold text-sky-400">
                      <ThumbsUp className="h-3 w-3" />
                      {item.upvotes}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: tokens.textSecondary }}>
                    {item.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-0.5 font-mono text-[10px]" style={{ color: tokens.textSecondary }}>
                    <span className="font-bold text-sky-300">@{item.username}</span>
                    {item.context && <span>• {item.context}</span>}
                    {item.device_info && <span className="hidden sm:inline">• {item.device_info}</span>}
                    <span>• {new Date(item.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {/* One-click Status Pill Bar + Delete */}
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <div
                    className="inline-flex items-center gap-1 rounded-xl border p-1"
                    style={{ background: subtleSurface, borderColor: panelBorder }}
                  >
                    {ALL_STATUSES.map((st) => {
                      const meta = STATUS_META[st]
                      const active = item.status === st
                      return (
                        <button
                          key={st}
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleStatusChange(item, st)}
                          className="rounded-lg px-2 py-1 text-[10px] font-extrabold transition cursor-pointer disabled:opacity-50"
                          style={{
                            background: active ? meta.bg : 'transparent',
                            color: active ? meta.color : tokens.textSecondary,
                          }}
                        >
                          {meta[lang]}
                        </button>
                      )
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleDelete(item)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/12 text-rose-400 hover:bg-rose-500/25 cursor-pointer disabled:opacity-50"
                    title={isPl ? 'Usuń zgłoszenie' : 'Delete item'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </article>
          )
        })}

        {filtered.length === 0 && !loading && (
          <div
            className="rounded-xl border p-10 text-center text-xs font-bold"
            style={{ background: panelSurface, borderColor: panelBorder, color: tokens.textSecondary }}
          >
            {isPl ? 'Brak zgłoszeń dla wybranych filtrów' : 'No matching feedback items'}
          </div>
        )}
      </div>
    </div>
  )
}
