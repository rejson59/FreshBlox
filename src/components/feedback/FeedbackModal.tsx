import React, { useCallback, useEffect, useState } from 'react'
import {
  Bug,
  CheckCircle2,
  Clock,
  Lightbulb,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
  ThumbsUp,
  X,
} from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from '../../data/brandTheme'
import { Lang } from '../../data/locales'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { isTouchMobileDevice } from '../../lib/mobileFullscreen'
import { sfx } from '../../lib/sfx'

export type FeedbackKind = 'bug' | 'idea'
export type FeedbackStatus = 'new' | 'reviewing' | 'planned' | 'done'

interface FeedbackRow {
  id: string
  user_id: string
  username: string
  kind: FeedbackKind
  title: string
  description: string
  context: string
  device_info: string
  status: FeedbackStatus
  upvotes: number
  created_at: string
}

export interface FeedbackModalProps {
  open: boolean
  mode: ThemeMode
  lang: Lang
  userId: string
  username: string
  contextLabel: string
  onClose: () => void
}

const COPY = {
  pl: {
    heading: 'Zgłoś błąd lub pomysł',
    subheading: 'Pomóż rozwijać FreshBlox — każde zgłoszenie trafia bezpośrednio do twórcy.',
    tabSubmit: 'Nowe zgłoszenie',
    tabIdeas: 'Pomysły graczy',
    tabMine: 'Moje zgłoszenia',
    kindBug: 'Zgłoś błąd',
    kindBugDesc: 'Kolizje, skok, grafika, konto lub coś nie działa',
    kindIdea: 'Pomysł na aktualizację',
    kindIdeaDesc: 'Nowy tryb, przedmiot, mechanika lub ulepszenie',
    titleLabel: 'Krótki tytuł',
    titlePlaceholderBug: 'np. Gracz zacina się na krawędzi na Stage 18',
    titlePlaceholderIdea: 'np. Dodajcie tryb Wyścig po Lodzie albo nowe czapki',
    descLabel: 'Szczegółowy opis',
    descPlaceholderBug: 'Opisz co się stało i jak to powtórzyć (np. na którym etapie, na telefonie czy PC)...',
    descPlaceholderIdea: 'Opisz swój pomysł — jak miałby działać w FreshBlox?',
    contextPrefix: 'Kontekst:',
    submitBtn: 'Wyślij zgłoszenie',
    submitting: 'Wysyłanie...',
    successBug: 'Dzięki! Zgłoszenie błędu zostało zapisane w bazie.',
    successIdea: 'Super! Twój pomysł jest już widoczny na tablicy pomysłów.',
    errTitleShort: 'Tytuł musi mieć co najmniej 3 znaki.',
    errDescShort: 'Opis musi mieć co najmniej 5 znaków.',
    errGeneric: 'Nie udało się wysłać zgłoszenia. Spróbuj ponownie za chwilę.',
    errNoCloud: 'Połączenie z chmurą nie jest skonfigurowane.',
    emptyIdeas: 'Brak pomysłów graczy — bądź pierwszą osobą, która doda propozycję!',
    emptyMine: 'Nie wysłałeś jeszcze żadnego zgłoszenia ani pomysłu.',
    loading: 'Ładowanie zgłoszeń...',
    upvote: 'Głosuj',
    bugBadge: 'Błąd',
    ideaBadge: 'Pomysł',
    statusLabels: {
      new: 'Nowe',
      reviewing: 'W analizie',
      planned: 'Planowane',
      done: 'Wdrożone',
    } as Record<FeedbackStatus, string>,
  },
  en: {
    heading: 'Report a Bug or Suggest an Idea',
    subheading: 'Help shape FreshBlox — every submission goes straight to the developer.',
    tabSubmit: 'Submit',
    tabIdeas: 'Community Ideas',
    tabMine: 'My Submissions',
    kindBug: 'Report a Bug',
    kindBugDesc: 'Physics, jump, visuals, account, or broken behavior',
    kindIdea: 'Update Idea',
    kindIdeaDesc: 'New game mode, wardrobe item, mechanic, or feature',
    titleLabel: 'Short title',
    titlePlaceholderBug: 'e.g. Player clips at edge on Stage 18',
    titlePlaceholderIdea: 'e.g. Add an Ice Racing mode or new hats',
    descLabel: 'Details',
    descPlaceholderBug: 'Describe what happened and how to reproduce it (stage, mobile vs PC)...',
    descPlaceholderIdea: 'Describe your idea and how it would work in FreshBlox...',
    contextPrefix: 'Context:',
    submitBtn: 'Send Feedback',
    submitting: 'Sending...',
    successBug: 'Thanks! Your bug report has been saved.',
    successIdea: 'Awesome! Your idea is now live on the Community Ideas board.',
    errTitleShort: 'Title must be at least 3 characters.',
    errDescShort: 'Description must be at least 5 characters.',
    errGeneric: 'Could not send feedback. Please try again in a moment.',
    errNoCloud: 'Cloud connection is not configured.',
    emptyIdeas: 'No community ideas yet — be the first to pitch one!',
    emptyMine: "You haven't submitted any bugs or ideas yet.",
    loading: 'Loading submissions...',
    upvote: 'Vote',
    bugBadge: 'Bug',
    ideaBadge: 'Idea',
    statusLabels: {
      new: 'New',
      reviewing: 'Reviewing',
      planned: 'Planned',
      done: 'Shipped',
    } as Record<FeedbackStatus, string>,
  },
}

const STATUS_STYLE: Record<FeedbackStatus, { bg: string; color: string; border: string }> = {
  new: { bg: 'rgba(56, 189, 248, 0.14)', color: '#38BDF8', border: 'rgba(56, 189, 248, 0.35)' },
  reviewing: { bg: 'rgba(251, 191, 36, 0.14)', color: '#FBBF24', border: 'rgba(251, 191, 36, 0.35)' },
  planned: { bg: 'rgba(167, 139, 250, 0.16)', color: '#A78BFA', border: 'rgba(167, 139, 250, 0.35)' },
  done: { bg: 'rgba(52, 211, 153, 0.16)', color: '#34D399', border: 'rgba(52, 211, 153, 0.35)' },
}

function formatShortDate(iso: string, lang: Lang): string {
  try {
    return new Date(iso).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-US', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  open,
  mode,
  lang,
  userId,
  username,
  contextLabel,
  onClose,
}) => {
  const t = COPY[lang]
  const tokens = getThemeTokens(mode)

  const [tab, setTab] = useState<'submit' | 'ideas' | 'mine'>('submit')
  const [kind, setKind] = useState<FeedbackKind>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [ideas, setIdeas] = useState<FeedbackRow[]>([])
  const [mine, setMine] = useState<FeedbackRow[]>([])
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [loadingList, setLoadingList] = useState(false)
  const [votingId, setVotingId] = useState<string | null>(null)

  const deviceInfo =
    typeof window !== 'undefined'
      ? `${isTouchMobileDevice() ? 'Mobile' : 'PC'} · ${window.innerWidth}×${window.innerHeight}`
      : 'PC'

  const loadFeedbackLists = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) return
    setLoadingList(true)
    try {
      const [ideasRes, mineRes, votesRes] = await Promise.all([
        supabase
          .from('fb_feedback')
          .select('*')
          .eq('kind', 'idea')
          .order('upvotes', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('fb_feedback')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase.from('fb_feedback_votes').select('feedback_id').eq('user_id', userId),
      ])

      if (!ideasRes.error && ideasRes.data) {
        setIdeas(ideasRes.data as FeedbackRow[])
      }
      if (!mineRes.error && mineRes.data) {
        setMine(mineRes.data as FeedbackRow[])
      }
      if (!votesRes.error && votesRes.data) {
        setVotedIds(new Set(votesRes.data.map((r: { feedback_id: string }) => r.feedback_id)))
      }
    } catch {
      // Keep current list on transient error
    } finally {
      setLoadingList(false)
    }
  }, [userId])

  useEffect(() => {
    if (!open) return
    setErrorMsg(null)
    setSuccessMsg(null)
    void loadFeedbackLists()
  }, [open, loadFeedbackLists])

  // Escape closes modal cleanly
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    const cleanTitle = title.trim()
    const cleanDesc = description.trim()
    if (cleanTitle.length < 3) {
      setErrorMsg(t.errTitleShort)
      return
    }
    if (cleanDesc.length < 5) {
      setErrorMsg(t.errDescShort)
      return
    }
    if (!supabase || !isSupabaseConfigured) {
      setErrorMsg(t.errNoCloud)
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.from('fb_feedback').insert({
        user_id: userId,
        username,
        kind,
        title: cleanTitle.slice(0, 120),
        description: cleanDesc.slice(0, 1500),
        context: contextLabel.slice(0, 80),
        device_info: deviceInfo.slice(0, 60),
      })
      if (error) {
        setErrorMsg(t.errGeneric)
      } else {
        sfx.playQuestClaim()
        setTitle('')
        setDescription('')
        setSuccessMsg(kind === 'bug' ? t.successBug : t.successIdea)
        await loadFeedbackLists()
      }
    } catch {
      setErrorMsg(t.errGeneric)
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleVote = async (feedbackId: string) => {
    if (!supabase || !isSupabaseConfigured || votingId) return
    setVotingId(feedbackId)
    sfx.playClick()
    try {
      const { data, error } = await supabase.rpc('toggle_feedback_upvote', {
        p_feedback_id: feedbackId,
      })
      if (!error && data && typeof data === 'object') {
        const res = data as { voted: boolean; upvotes: number }
        setVotedIds((prev) => {
          const next = new Set(prev)
          if (res.voted) next.add(feedbackId)
          else next.delete(feedbackId)
          return next
        })
        setIdeas((prev) =>
          prev
            .map((item) => (item.id === feedbackId ? { ...item, upvotes: res.upvotes } : item))
            .sort((a, b) => b.upvotes - a.upvotes),
        )
        setMine((prev) => prev.map((item) => (item.id === feedbackId ? { ...item, upvotes: res.upvotes } : item)))
      }
    } finally {
      setVotingId(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-2.5 sm:p-4 backdrop-blur-md"
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border shadow-2xl"
        style={{
          background: mode === 'dark' ? '#0B162C' : '#F8FCFF',
          borderColor: tokens.cardBorder,
          color: tokens.textPrimary,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3.5 sm:px-5 sm:py-4"
          style={{ borderColor: tokens.cardBorder }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border"
              style={{
                background: `${ARCTIC_SKY.skyMain}1c`,
                borderColor: `${ARCTIC_SKY.skyMain}44`,
                color: ARCTIC_SKY.skyMain,
              }}
            >
              <MessageSquarePlus className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base sm:text-lg font-extrabold leading-tight truncate">
                {t.heading}
              </h2>
              <p className="text-[11px] sm:text-xs leading-snug mt-0.5" style={{ color: tokens.textSecondary }}>
                {t.subheading}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition hover:opacity-80 cursor-pointer"
            style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg, color: tokens.textSecondary }}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex shrink-0 items-center gap-1.5 border-b px-4 py-2.5 sm:px-5"
          style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
        >
          {(
            [
              { id: 'submit', label: t.tabSubmit, icon: Send },
              { id: 'ideas', label: `${t.tabIdeas} (${ideas.length})`, icon: Sparkles },
              { id: 'mine', label: `${t.tabMine} (${mine.length})`, icon: Clock },
            ] as const
          ).map((item) => {
            const Icon = item.icon
            const active = tab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  sfx.playClick()
                  setTab(item.id)
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] sm:text-xs font-extrabold transition cursor-pointer"
                style={{
                  background: active ? tokens.heroGradient : 'transparent',
                  borderColor: active ? `${ARCTIC_SKY.skyMain}60` : 'transparent',
                  color: active ? tokens.textPrimary : tokens.textSecondary,
                }}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: active ? ARCTIC_SKY.skyMain : undefined }} />
                <span className="truncate">{item.label}</span>
              </button>
            )
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {tab === 'submit' && (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Kind Switcher */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    sfx.playClick()
                    setKind('bug')
                    setSuccessMsg(null)
                  }}
                  className="flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition cursor-pointer"
                  style={{
                    background: kind === 'bug' ? 'rgba(244, 63, 94, 0.13)' : tokens.mutedBg,
                    borderColor: kind === 'bug' ? 'rgba(244, 63, 94, 0.55)' : tokens.cardBorder,
                  }}
                >
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold">
                    <Bug className="h-4 w-4 text-rose-400 shrink-0" />
                    <span>{t.kindBug}</span>
                  </div>
                  <span className="text-[10px] sm:text-[11px] leading-snug" style={{ color: tokens.textSecondary }}>
                    {t.kindBugDesc}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sfx.playClick()
                    setKind('idea')
                    setSuccessMsg(null)
                  }}
                  className="flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition cursor-pointer"
                  style={{
                    background: kind === 'idea' ? `${ARCTIC_SKY.skyMain}1c` : tokens.mutedBg,
                    borderColor: kind === 'idea' ? `${ARCTIC_SKY.skyMain}75` : tokens.cardBorder,
                  }}
                >
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold">
                    <Lightbulb className="h-4 w-4 text-sky-400 shrink-0" />
                    <span>{t.kindIdea}</span>
                  </div>
                  <span className="text-[10px] sm:text-[11px] leading-snug" style={{ color: tokens.textSecondary }}>
                    {t.kindIdeaDesc}
                  </span>
                </button>
              </div>

              {/* Automatic Context Pill */}
              <div
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[11px] font-semibold"
                style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg, color: tokens.textSecondary }}
              >
                <span>
                  {t.contextPrefix}{' '}
                  <strong style={{ color: tokens.textPrimary }}>{contextLabel}</strong>
                </span>
                <span className="font-mono text-[10px] opacity-80">{deviceInfo}</span>
              </div>

              {/* Title Input */}
              <div>
                <div className="mb-1 flex items-center justify-between text-xs font-bold">
                  <label htmlFor="fb-feedback-title">{t.titleLabel}</label>
                  <span className="font-mono text-[10px]" style={{ color: tokens.textSecondary }}>
                    {title.length}/120
                  </span>
                </div>
                <input
                  id="fb-feedback-title"
                  type="text"
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={kind === 'bug' ? t.titlePlaceholderBug : t.titlePlaceholderIdea}
                  className="w-full rounded-xl border px-3.5 py-2.5 text-sm font-medium outline-none transition focus:ring-2 focus:ring-sky-400/50"
                  style={{
                    background: tokens.mutedBg,
                    borderColor: tokens.cardBorder,
                    color: tokens.textPrimary,
                  }}
                />
              </div>

              {/* Description Textarea */}
              <div>
                <div className="mb-1 flex items-center justify-between text-xs font-bold">
                  <label htmlFor="fb-feedback-desc">{t.descLabel}</label>
                  <span className="font-mono text-[10px]" style={{ color: tokens.textSecondary }}>
                    {description.length}/1500
                  </span>
                </div>
                <textarea
                  id="fb-feedback-desc"
                  rows={4}
                  maxLength={1500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={kind === 'bug' ? t.descPlaceholderBug : t.descPlaceholderIdea}
                  className="w-full resize-none rounded-xl border px-3.5 py-2.5 text-sm font-medium outline-none transition focus:ring-2 focus:ring-sky-400/50"
                  style={{
                    background: tokens.mutedBg,
                    borderColor: tokens.cardBorder,
                    color: tokens.textPrimary,
                  }}
                />
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/12 px-3 py-2 text-xs font-bold text-rose-400">
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/12 px-3 py-2.5 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold text-white shadow-lg transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                style={{
                  background:
                    kind === 'bug'
                      ? 'linear-gradient(135deg, #E11D48 0%, #F43F5E 100%)'
                      : 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)',
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{t.submitting}</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>{t.submitBtn}</span>
                  </>
                )}
              </button>
            </form>
          )}

          {tab === 'ideas' && (
            <div className="space-y-2.5">
              {loadingList && ideas.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-10 text-xs font-bold" style={{ color: tokens.textSecondary }}>
                  <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                  <span>{t.loading}</span>
                </div>
              ) : ideas.length === 0 ? (
                <div
                  className="rounded-2xl border border-dashed p-6 text-center text-xs font-bold"
                  style={{ borderColor: tokens.cardBorder, color: tokens.textSecondary }}
                >
                  {t.emptyIdeas}
                </div>
              ) : (
                ideas.map((item) => {
                  const st = STATUS_STYLE[item.status] ?? STATUS_STYLE.new
                  const voted = votedIds.has(item.id)
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 rounded-2xl border p-3.5"
                      style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
                    >
                      <button
                        type="button"
                        disabled={votingId === item.id}
                        onClick={() => void handleToggleVote(item.id)}
                        className="flex min-w-[50px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 text-xs font-extrabold transition active:scale-95 cursor-pointer"
                        style={{
                          background: voted ? `${ARCTIC_SKY.skyMain}26` : 'transparent',
                          borderColor: voted ? ARCTIC_SKY.skyMain : tokens.cardBorder,
                          color: voted ? ARCTIC_SKY.skyMain : tokens.textSecondary,
                        }}
                        title={t.upvote}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        <span className="font-mono text-xs">{item.upvotes}</span>
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-sm font-extrabold leading-snug">{item.title}</h3>
                          <span
                            className="rounded-lg border px-1.5 py-0.5 text-[10px] font-extrabold"
                            style={{ background: st.bg, color: st.color, borderColor: st.border }}
                          >
                            {t.statusLabels[item.status] ?? item.status}
                          </span>
                        </div>
                        <p
                          className="mt-1 whitespace-pre-wrap text-xs leading-relaxed"
                          style={{ color: tokens.textSecondary }}
                        >
                          {item.description}
                        </p>
                        <div
                          className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold"
                          style={{ color: tokens.textSecondary }}
                        >
                          <span className="font-bold" style={{ color: tokens.textPrimary }}>
                            @{item.username}
                          </span>
                          <span>·</span>
                          <span>{formatShortDate(item.created_at, lang)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {tab === 'mine' && (
            <div className="space-y-2.5">
              {loadingList && mine.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-10 text-xs font-bold" style={{ color: tokens.textSecondary }}>
                  <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                  <span>{t.loading}</span>
                </div>
              ) : mine.length === 0 ? (
                <div
                  className="rounded-2xl border border-dashed p-6 text-center text-xs font-bold"
                  style={{ borderColor: tokens.cardBorder, color: tokens.textSecondary }}
                >
                  {t.emptyMine}
                </div>
              ) : (
                mine.map((item) => {
                  const st = STATUS_STYLE[item.status] ?? STATUS_STYLE.new
                  const isBug = item.kind === 'bug'
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border p-3.5"
                      style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-extrabold"
                            style={{
                              background: isBug ? 'rgba(244, 63, 94, 0.14)' : `${ARCTIC_SKY.skyMain}1c`,
                              borderColor: isBug ? 'rgba(244, 63, 94, 0.35)' : `${ARCTIC_SKY.skyMain}45`,
                              color: isBug ? '#FB7185' : ARCTIC_SKY.skyMain,
                            }}
                          >
                            {isBug ? <Bug className="h-3 w-3" /> : <Lightbulb className="h-3 w-3" />}
                            {isBug ? t.bugBadge : t.ideaBadge}
                          </span>
                          <span
                            className="rounded-lg border px-1.5 py-0.5 text-[10px] font-extrabold"
                            style={{ background: st.bg, color: st.color, borderColor: st.border }}
                          >
                            {t.statusLabels[item.status] ?? item.status}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold" style={{ color: tokens.textSecondary }}>
                          {formatShortDate(item.created_at, lang)}
                        </span>
                      </div>

                      <h3 className="mt-1.5 text-sm font-extrabold leading-snug">{item.title}</h3>
                      <p
                        className="mt-1 whitespace-pre-wrap text-xs leading-relaxed"
                        style={{ color: tokens.textSecondary }}
                      >
                        {item.description}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[10px] font-semibold" style={{ color: tokens.textSecondary }}>
                        <span>{item.context}</span>
                        {!isBug && (
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-sky-400">
                            <ThumbsUp className="h-3 w-3" /> {item.upvotes}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
