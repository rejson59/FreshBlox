import React from 'react'
import { Bell, CheckCircle2, MessageSquare, Play, RefreshCw, Sparkles, X } from 'lucide-react'
import { Lang } from '../../data/locales'
import { WorldKind } from '../../data/catalog'
import { UserNotificationItem } from '../../lib/socialApi'

interface NotificationsPopoverProps {
  open: boolean
  lang: Lang
  items: UserNotificationItem[]
  loading: boolean
  onRefresh: () => void
  onClose: () => void
  onOpenDm: (username: string) => void
  onJoinRoom: (world: WorldKind, roomCode: string) => void
}

export const NotificationsPopover: React.FC<NotificationsPopoverProps> = ({
  open,
  lang,
  items,
  loading,
  onRefresh,
  onClose,
  onOpenDm,
  onJoinRoom,
}) => {
  if (!open) return null
  const isPl = lang === 'pl'

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-end bg-slate-950/30 p-3 pt-16 sm:p-5 sm:pt-16"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-sky-400/25 bg-[#091224]/95 text-white shadow-2xl backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-sky-400" />
            <span className="font-display text-sm font-extrabold">
              {isPl ? 'Powiadomienia' : 'Notifications'}
            </span>
            {items.length > 0 && (
              <span className="rounded-full bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] font-black text-sky-300">
                {items.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onRefresh}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 cursor-pointer"
              title={isPl ? 'Odśwież' : 'Refresh'}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto p-2.5">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-slate-400">
              <Sparkles className="h-6 w-6 text-sky-400/60" />
              <p className="text-xs font-semibold">
                {isPl ? 'Brak nowych powiadomień.' : 'You are all caught up.'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-sky-400/30"
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        item.kind === 'dm'
                          ? 'bg-sky-500/20 text-sky-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {item.kind === 'dm' ? (
                        <MessageSquare className="h-3.5 w-3.5" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-extrabold text-white">{item.title}</div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-300">{item.body}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {(item.kind === 'dm' || item.kind === 'invite') && item.fromUsername && (
                          <button
                            type="button"
                            onClick={() => {
                              onOpenDm(item.fromUsername!)
                              onClose()
                            }}
                            className="rounded-lg bg-sky-500/20 px-2 py-1 text-[10px] font-extrabold text-sky-200 hover:bg-sky-500/30 cursor-pointer"
                          >
                            {isPl ? 'Otwórz czat' : 'Open chat'}
                          </button>
                        )}
                        {item.inviteRoom && (
                          <button
                            type="button"
                            onClick={() => {
                              onJoinRoom(item.inviteWorld ?? 'lobby', item.inviteRoom!)
                              onClose()
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2 py-1 text-[10px] font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                          >
                            <Play className="h-2.5 w-2.5 fill-slate-950" />
                            {isPl ? `Dołącz #${item.inviteRoom}` : `Join #${item.inviteRoom}`}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
