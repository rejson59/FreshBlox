import React, { useState } from 'react'
import { Check, Copy, KeyRound, Lock, Play, ShieldCheck, Users, X } from 'lucide-react'
import { Lang } from '../../data/locales'
import { WorldKind } from '../../data/catalog'
import { createPrivateRoom, verifyPrivateRoomAccess } from '../../lib/socialApi'

interface PrivateRoomModalProps {
  open: boolean
  lang: Lang
  defaultWorld?: WorldKind
  onClose: () => void
  onEnterRoom: (world: WorldKind, roomCode: string) => void
}

export const PrivateRoomModal: React.FC<PrivateRoomModalProps> = ({
  open,
  lang,
  defaultWorld = 'lobby',
  onClose,
  onEnterRoom,
}) => {
  const isPl = lang === 'pl'
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [world, setWorld] = useState<WorldKind>(defaultWorld)
  const [accessMode, setAccessMode] = useState<'password' | 'friends'>('password')
  const [passcode, setPasscode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinPass, setJoinPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdCode, setCreatedCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (!open) return null

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (accessMode === 'password' && passcode.trim().length < 3) {
      setError(isPl ? 'Podaj hasło (minimum 3 znaki).' : 'Enter a password (at least 3 chars).')
      return
    }
    const generatedCode = `PVT-${Math.floor(1000 + Math.random() * 9000)}`
    setBusy(true)
    const res = await createPrivateRoom({
      roomCode: generatedCode,
      worldKind: world,
      accessMode,
      password: accessMode === 'password' ? passcode.trim() : undefined,
    })
    setBusy(false)
    if (res.error || !res.data?.room_code) {
      setError(res.error ?? (isPl ? 'Nie udało się utworzyć pokoju.' : 'Failed to create room.'))
      return
    }
    setCreatedCode(res.data.room_code)
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const clean = joinCode.trim().toUpperCase()
    if (!clean) {
      setError(isPl ? 'Wpisz kod pokoju.' : 'Enter a room code.')
      return
    }
    setBusy(true)
    const res = await verifyPrivateRoomAccess(clean, joinPass.trim() || undefined)
    setBusy(false)
    if (res.error || !res.data?.allowed) {
      const msgMap: Record<string, string> = {
        PASSWORD_REQUIRED: isPl ? 'Ten pokój wymaga hasła.' : 'This room requires a password.',
        WRONG_PASSWORD: isPl ? 'Nieprawidłowe hasło do tego pokoju.' : 'Incorrect room password.',
        FRIENDS_ONLY: isPl
          ? 'Ten pokój jest tylko dla znajomych gospodarza.'
          : 'This room is restricted to the host’s friends.',
      }
      const reason = res.data?.reason ?? ''
      setError(msgMap[reason] ?? res.error ?? (isPl ? 'Brak dostępu.' : 'Access denied.'))
      return
    }
    onEnterRoom(res.data.world_kind ?? world, clean)
    onClose()
  }

  const copyCode = () => {
    if (!createdCode) return
    navigator.clipboard?.writeText(createdCode).catch(() => {})
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
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-base font-extrabold">
                {isPl ? 'Prywatny Pokój' : 'Private Room'}
              </h3>
              <p className="text-[11px] text-sky-200/70">
                {isPl ? 'Na hasło lub tylko dla znajomych' : 'Password-protected or friends-only'}
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

        {/* Mode switch */}
        <div className="grid grid-cols-2 gap-1.5 px-5 pt-4">
          <button
            type="button"
            onClick={() => {
              setTab('create')
              setError(null)
              setCreatedCode(null)
            }}
            className={`rounded-xl py-2 text-xs font-extrabold transition cursor-pointer ${
              tab === 'create'
                ? 'bg-sky-500 text-slate-950'
                : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            {isPl ? 'Utwórz prywatny' : 'Create private'}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('join')
              setError(null)
            }}
            className={`rounded-xl py-2 text-xs font-extrabold transition cursor-pointer ${
              tab === 'join'
                ? 'bg-sky-500 text-slate-950'
                : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            {isPl ? 'Dołącz po kodzie' : 'Join by code'}
          </button>
        </div>

        <div className="p-5">
          {tab === 'create' ? (
            createdCode ? (
              <div className="space-y-4 text-center">
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                  <div className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-300">
                    <ShieldCheck className="h-4 w-4" />
                    {isPl ? 'Pokój prywatny gotowy!' : 'Private room ready!'}
                  </div>
                  <div className="my-2 flex items-center justify-center gap-2">
                    <span className="font-mono text-2xl font-black tracking-wider text-white">
                      {createdCode}
                    </span>
                    <button
                      type="button"
                      onClick={copyCode}
                      className="rounded-lg border border-white/15 bg-white/10 p-2 text-sky-200 hover:bg-white/15 cursor-pointer"
                    >
                      {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {accessMode === 'friends'
                      ? isPl
                        ? 'Wejść mogą tylko Twoi znajomi z FreshBlox.'
                        : 'Only your FreshBlox friends can join.'
                      : isPl
                        ? 'Przekaż znajomym kod pokoju i ustalone hasło.'
                        : 'Share this room code and password with friends.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onEnterRoom(world, createdCode)
                    onClose()
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 py-3 text-sm font-extrabold text-slate-950 shadow-lg cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-slate-950" />
                  {isPl ? 'Wejdź do pokoju teraz' : 'Enter room now'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-3.5">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-sky-200/70">
                    {isPl ? 'Świat 3D' : '3D World'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['lobby', 'obby', 'arena', 'frisbee'] as WorldKind[]).map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setWorld(w)}
                        className={`rounded-xl border px-2 py-2 text-xs font-extrabold transition cursor-pointer ${
                          world === w
                            ? 'border-sky-400 bg-sky-500/20 text-white'
                            : 'border-white/10 bg-white/5 text-slate-300'
                        }`}
                      >
                        {w === 'lobby'
                          ? 'Lobby'
                          : w === 'obby'
                            ? 'Obby 100'
                            : w === 'arena'
                              ? 'Portal Arena'
                              : 'Frisbee King'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-sky-200/70">
                    {isPl ? 'Dostęp do pokoju' : 'Room Access'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAccessMode('password')}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-extrabold transition cursor-pointer ${
                        accessMode === 'password'
                          ? 'border-sky-400 bg-sky-500/20 text-white'
                          : 'border-white/10 bg-white/5 text-slate-300'
                      }`}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      {isPl ? 'Na hasło' : 'Password'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccessMode('friends')}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-extrabold transition cursor-pointer ${
                        accessMode === 'friends'
                          ? 'border-sky-400 bg-sky-500/20 text-white'
                          : 'border-white/10 bg-white/5 text-slate-300'
                      }`}
                    >
                      <Users className="h-3.5 w-3.5" />
                      {isPl ? 'Tylko znajomi' : 'Friends only'}
                    </button>
                  </div>
                </div>

                {accessMode === 'password' && (
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-sky-200/70">
                      {isPl ? 'Hasło pokoju' : 'Room Password'}
                    </label>
                    <input
                      type="text"
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      maxLength={24}
                      placeholder={isPl ? 'np. FRESH2026' : 'e.g. FRESH2026'}
                      className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3.5 py-2.5 text-sm font-semibold text-white outline-none focus:border-sky-400"
                    />
                  </div>
                )}

                {error && (
                  <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 py-3 text-sm font-extrabold text-slate-950 shadow-lg disabled:opacity-60 cursor-pointer"
                >
                  <Lock className="h-4 w-4" />
                  {busy
                    ? isPl
                      ? 'Tworzenie…'
                      : 'Creating…'
                    : isPl
                      ? 'Utwórz prywatny pokój'
                      : 'Create private room'}
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleJoin} className="space-y-3.5">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-sky-200/70">
                  {isPl ? 'Kod pokoju' : 'Room Code'}
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={18}
                  placeholder="PVT-4821"
                  className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3.5 py-2.5 font-mono text-sm font-bold uppercase text-white outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-sky-200/70">
                  {isPl ? 'Hasło (jeśli wymagane)' : 'Password (if required)'}
                </label>
                <input
                  type="password"
                  value={joinPass}
                  onChange={(e) => setJoinPass(e.target.value)}
                  maxLength={24}
                  placeholder="••••••"
                  className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3.5 py-2.5 text-sm font-semibold text-white outline-none focus:border-sky-400"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 py-3 text-sm font-extrabold text-slate-950 shadow-lg disabled:opacity-60 cursor-pointer"
              >
                <Play className="h-4 w-4 fill-slate-950" />
                {busy ? (isPl ? 'Sprawdzanie…' : 'Verifying…') : isPl ? 'Wejdź do pokoju' : 'Join room'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
