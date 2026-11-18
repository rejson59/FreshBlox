import React, { useState } from 'react'
import { Check, Copy, Crown, LogOut, Play, Plus, Users, X } from 'lucide-react'
import { Lang } from '../../data/locales'
import { WorldKind } from '../../data/catalog'
import { PartyMember } from '../../lib/partyClient'

interface PartyBarModalProps {
  open: boolean
  lang: Lang
  partyCode: string | null
  members: PartyMember[]
  isLeader: boolean
  onClose: () => void
  onCreateParty: () => void
  onJoinParty: (code: string) => void
  onLeaveParty: () => void
  onLaunchWorld: (world: WorldKind) => void
}

export const PartyBarModal: React.FC<PartyBarModalProps> = ({
  open,
  lang,
  partyCode,
  members,
  isLeader,
  onClose,
  onCreateParty,
  onJoinParty,
  onLeaveParty,
  onLaunchWorld,
}) => {
  const isPl = lang === 'pl'
  const [joinInput, setJoinInput] = useState('')
  const [copied, setCopied] = useState(false)

  if (!open) return null

  const copyCode = () => {
    if (!partyCode) return
    navigator.clipboard?.writeText(partyCode).catch(() => {})
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-sky-400/25 bg-[#091224] text-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-base font-extrabold">
                {isPl ? 'Drużyna / Impreza (Party)' : 'Party / Squad'}
              </h3>
              <p className="text-[11px] text-sky-200/70">
                {isPl
                  ? 'Wchodźcie razem do tego samego pokoju 3D'
                  : 'Launch into the same 3D room together'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {!partyCode ? (
            <>
              <button
                type="button"
                onClick={onCreateParty}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 py-3 text-sm font-extrabold text-slate-950 shadow-lg transition hover:brightness-105 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                {isPl ? 'Utwórz nową drużynę' : 'Create new party'}
              </button>

              <div className="relative flex items-center py-1">
                <div className="flex-1 border-t border-white/10" />
                <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {isPl ? 'lub dołącz po kodzie' : 'or join by code'}
                </span>
                <div className="flex-1 border-t border-white/10" />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const code = joinInput.trim().toUpperCase()
                  if (code.length >= 3) {
                    onJoinParty(code)
                    setJoinInput('')
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                  placeholder="SQ-4821"
                  maxLength={14}
                  className="flex-1 rounded-xl border border-white/15 bg-slate-950/75 px-3.5 py-2.5 font-mono text-sm font-bold uppercase text-white outline-none focus:border-sky-400"
                />
                <button
                  type="submit"
                  className="rounded-xl border border-sky-400/35 bg-sky-500/20 px-4 py-2.5 text-xs font-extrabold text-sky-200 hover:bg-sky-500/30 cursor-pointer"
                >
                  {isPl ? 'Dołącz' : 'Join'}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Active party header */}
              <div className="flex items-center justify-between rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-3">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-sky-300">
                    {isPl ? 'Kod drużyny' : 'Party code'}
                  </div>
                  <div className="font-mono text-xl font-black text-white">{partyCode}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={copyCode}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-sky-100 hover:bg-white/15 cursor-pointer"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? (isPl ? 'Skopiowano' : 'Copied') : isPl ? 'Kopiuj' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={onLeaveParty}
                    title={isPl ? 'Opuść drużynę' : 'Leave party'}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Members */}
              <div>
                <div className="mb-2 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  <span>{isPl ? 'Członkowie drużyny' : 'Party members'}</span>
                  <span className="font-mono text-sky-300">{members.length}/8</span>
                </div>
                <div className="space-y-1.5">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        <span className="truncate text-xs font-bold text-white">{m.username}</span>
                      </div>
                      {m.isLeader && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/35 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-300">
                          <Crown className="h-3 w-3" />
                          {isPl ? 'Lider' : 'Leader'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Leader Launch */}
              {isLeader ? (
                <div className="space-y-2 border-t border-white/10 pt-3">
                  <div className="text-[11px] font-bold text-sky-200/80">
                    {isPl
                      ? 'Uruchom grę — cała drużyna wejdzie razem do tego samego pokoju:'
                      : 'Launch a world — everyone in your party joins together:'}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onLaunchWorld('lobby')
                        onClose()
                      }}
                      className="flex items-center justify-center gap-1 rounded-xl bg-sky-500 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-sky-400 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5 fill-slate-950" />
                      Lobby
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onLaunchWorld('obby')
                        onClose()
                      }}
                      className="flex items-center justify-center gap-1 rounded-xl bg-amber-400 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-amber-300 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5 fill-slate-950" />
                      Parkour
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onLaunchWorld('arena')
                        onClose()
                      }}
                      className="flex items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-cyan-400 to-orange-400 py-2.5 text-xs font-extrabold text-slate-950 hover:brightness-110 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5 fill-slate-950" />
                      Portal Arena
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onLaunchWorld('frisbee')
                        onClose()
                      }}
                      className="flex items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-orange-500 to-amber-300 py-2.5 text-xs font-extrabold text-slate-950 hover:brightness-110 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5 fill-slate-950" />
                      Frisbee King
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center text-xs text-slate-300">
                  {isPl
                    ? 'Czekasz na lidera — gdy uruchomi grę, przeniesiesz się razem z nim!'
                    : 'Waiting for party leader — you’ll join their room automatically!'}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
