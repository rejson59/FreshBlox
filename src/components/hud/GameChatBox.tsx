import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MessageSquare, Minus, Send, Sparkles, Users } from 'lucide-react'
import { Lang } from '../../data/locales'
import { LobbyChatMessage } from '../../lib/multiplayer'

interface GameChatBoxProps {
  open: boolean
  roomCode: string
  onlineCount: number
  lang: Lang
  touchMode: boolean
  selfId: string
  messages: LobbyChatMessage[]
  chatInput: string
  chatInputRef: React.RefObject<HTMLInputElement | null>
  onChatInputChange: (val: string) => void
  onFocusChange: (focused: boolean) => void
  onSend: (e: React.FormEvent) => void
  onSendQuickText: (text: string) => void
  onClose: () => void
  onOpen: () => void
  worldKind: 'lobby' | 'obby'
}

const NAME_PALETTE = [
  '#38BDF8',
  '#34D399',
  '#FBBF24',
  '#A78BFA',
  '#FB7185',
  '#22D3EE',
  '#60A5FA',
  '#F472B6',
]

function colorForUsername(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return NAME_PALETTE[Math.abs(hash) % NAME_PALETTE.length]
}

function formatHHMM(ts: number): string {
  const d = new Date(ts)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export const GameChatBox: React.FC<GameChatBoxProps> = ({
  open,
  roomCode,
  onlineCount,
  lang,
  touchMode,
  selfId,
  messages,
  chatInput,
  chatInputRef,
  onChatInputChange,
  onFocusChange,
  onSend,
  onSendQuickText,
  onClose,
  onOpen,
  worldKind,
}) => {
  const isPl = lang === 'pl'
  const [quickOpen, setQuickOpen] = useState(false)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const listRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const quickPhrases = useMemo(
    () =>
      worldKind === 'obby'
        ? isPl
          ? ['Hej!', 'GG!', 'Ładny skok!', 'Czekaj na mnie!', 'Zaraz 100!']
          : ['Hey!', 'GG!', 'Nice jump!', 'Wait for me!', 'Almost 100!']
        : isPl
        ? ['Hej!', 'GG!', 'Kto na Obby?', 'Chodź tu!', 'Fajny styl!']
        : ['Hey!', 'GG!', 'Who wants Obby?', 'Come here!', 'Cool look!'],
    [worldKind, isPl],
  )

  // Auto-scroll to bottom when new messages arrive or drawer opens
  useEffect(() => {
    if (!open) return
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, open])

  // Gentle 1s ticker only while collapsed & recent messages exist (for 7s ephemeral toast preview)
  useEffect(() => {
    if (open || messages.length === 0) return
    const latest = messages[messages.length - 1]
    if (!latest || Date.now() - latest.timestamp > 8000) return
    const id = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [open, messages])

  // Fresh ephemeral floating preview lines while chat is minimized (auto-fade after 7s)
  const recentCollapsedMessages = useMemo(() => {
    if (open) return []
    return messages.filter((m) => nowTick - m.timestamp < 7000).slice(-2)
  }, [open, messages, nowTick])

  if (!open) {
    if (recentCollapsedMessages.length === 0) return null
    return (
      <div
        className={`pointer-events-none fixed z-20 flex w-[min(280px,calc(100vw-24px))] flex-col gap-1 ${
          touchMode ? 'top-14' : 'bottom-4'
        }`}
        style={{ left: 'max(0.75rem, env(safe-area-inset-left))' }}
      >
        {recentCollapsedMessages.map((m) => {
          const isSelf = m.senderId === selfId
          const nameColor = isSelf ? '#7DD3FC' : colorForUsername(m.username)
          return (
            <button
              key={m.id}
              type="button"
              onClick={onOpen}
              onPointerDown={(e) => e.stopPropagation()}
              className="pointer-events-auto flex items-baseline gap-1.5 rounded-xl border border-white/10 bg-slate-950/65 px-2.5 py-1.5 text-left text-xs text-white/95 shadow-lg backdrop-blur-md transition hover:bg-slate-950/80 cursor-pointer"
            >
              <span className="shrink-0 font-extrabold" style={{ color: nameColor }}>
                {m.username}:
              </span>
              <span className="truncate text-white/90">{m.text}</span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className={`pointer-events-auto absolute z-25 flex w-[min(332px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-sky-300/20 bg-slate-950/82 text-white shadow-[0_18px_48px_rgba(2,8,23,0.68)] backdrop-blur-xl ${
        touchMode ? 'top-14 max-h-[calc(100dvh-195px)]' : 'bottom-4 max-h-[300px]'
      }`}
      style={{ left: 'max(0.75rem, env(safe-area-inset-left))' }}
    >
      {/* Clean Minimal Header — ZERO technical server strings */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-sky-500/18 text-sky-300 border border-sky-400/30">
            <MessageSquare className="h-3.5 w-3.5" />
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-xs font-extrabold tracking-tight text-sky-50">
              {isPl ? 'Czat' : 'Chat'}
            </span>
            <span className="truncate rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-200/80">
              #{roomCode}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded-md bg-emerald-500/12 border border-emerald-400/25 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300"
            title={isPl ? 'Gracze w pokoju' : 'Players in room'}
          >
            <Users className="h-2.5 w-2.5" />
            {onlineCount}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-sky-200/75 transition hover:bg-white/10 hover:text-white cursor-pointer"
            title={isPl ? 'Zwiń czat' : 'Minimize chat'}
            aria-label={isPl ? 'Zwiń czat' : 'Minimize chat'}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Messages Feed */}
      <div
        ref={listRef}
        className="flex-1 min-h-[120px] overflow-y-auto px-3 py-2.5 space-y-2 text-xs"
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[100px] flex-col items-center justify-center gap-2.5 py-3 text-center">
            <p className="text-[11px] font-semibold text-sky-100/55">
              {isPl ? 'Brak wiadomości w pokoju' : 'No messages in this room yet'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1">
              {quickPhrases.slice(0, 3).map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => onSendQuickText(phrase)}
                  className="rounded-full border border-sky-400/25 bg-sky-500/12 px-2.5 py-1 text-[10px] font-bold text-sky-200 transition hover:bg-sky-500/25 hover:text-white cursor-pointer"
                >
                  {phrase}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, idx) => {
            const isSelf = m.senderId === selfId
            const prev = idx > 0 ? messages[idx - 1] : null
            const groupedWithPrev =
              Boolean(prev) &&
              !m.system &&
              !prev!.system &&
              prev!.senderId === m.senderId &&
              m.timestamp - prev!.timestamp < 60_000
            const nameColor = isSelf ? '#7DD3FC' : colorForUsername(m.username)
            const initial = (m.username.trim()[0] || '?').toUpperCase()

            if (m.system) {
              return (
                <div
                  key={m.id}
                  className="rounded-lg bg-sky-500/10 border border-sky-400/15 px-2.5 py-1 text-[11px] font-semibold text-sky-200/90"
                >
                  {m.text}
                </div>
              )
            }

            return (
              <div
                key={m.id}
                className={`flex items-start gap-2 ${groupedWithPrev ? '-mt-1 pl-7' : ''}`}
              >
                {!groupedWithPrev && (
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-slate-950 shadow-sm"
                    style={{ background: nameColor }}
                  >
                    {initial}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  {!groupedWithPrev && (
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[11px] font-extrabold" style={{ color: nameColor }}>
                        {m.username}
                      </span>
                      {isSelf && (
                        <span className="rounded bg-sky-500/20 px-1 py-0.2 text-[9px] font-extrabold text-sky-300">
                          {isPl ? 'Ty' : 'You'}
                        </span>
                      )}
                      <span className="font-mono text-[9px] text-slate-400/80">
                        {formatHHMM(m.timestamp)}
                      </span>
                    </div>
                  )}
                  <p className="break-words text-xs leading-snug text-white/95">
                    {m.text}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Expandable Quick-Chat Phrases Bar */}
      {quickOpen && (
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-t border-white/10 bg-slate-900/75 px-2.5 py-1.5">
          {quickPhrases.map((phrase) => (
            <button
              key={phrase}
              type="button"
              onClick={() => {
                onSendQuickText(phrase)
                setQuickOpen(false)
              }}
              className="rounded-lg border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-sky-100 transition hover:bg-sky-500/25 hover:border-sky-400/40 cursor-pointer"
            >
              {phrase}
            </button>
          ))}
        </div>
      )}

      {/* Modern Input Composer */}
      <form
        onSubmit={onSend}
        className="flex shrink-0 items-center gap-1.5 border-t border-white/10 bg-slate-950/75 p-2"
      >
        <button
          type="button"
          onClick={() => setQuickOpen((v) => !v)}
          title={isPl ? 'Szybkie wiadomości' : 'Quick phrases'}
          aria-label={isPl ? 'Szybkie wiadomości' : 'Quick phrases'}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition cursor-pointer ${
            quickOpen
              ? 'border-sky-400/50 bg-sky-500/25 text-sky-200'
              : 'border-white/10 bg-white/[0.05] text-sky-200/75 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
        </button>

        <div className="relative flex min-w-0 flex-1 items-center">
          <input
            ref={chatInputRef}
            type="text"
            value={chatInput}
            maxLength={220}
            onChange={(e) => onChatInputChange(e.target.value)}
            onFocus={() => onFocusChange(true)}
            onBlur={() => onFocusChange(false)}
            placeholder={isPl ? 'Napisz wiadomość…' : 'Type a message…'}
            className="h-8 w-full rounded-xl border border-white/15 bg-slate-900/90 pl-2.5 pr-9 text-xs text-white placeholder-sky-200/45 outline-none transition focus:border-sky-400/70"
          />
          {chatInput.length >= 140 && (
            <span className="pointer-events-none absolute right-2 font-mono text-[9px] font-bold text-amber-300">
              {220 - chatInput.length}
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={!chatInput.trim()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-slate-950 transition hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-sky-500 cursor-pointer"
          aria-label={isPl ? 'Wyślij' : 'Send'}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  )
}
