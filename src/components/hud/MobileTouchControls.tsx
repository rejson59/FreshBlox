import React, { useRef, useState } from 'react'
import { ArrowUp, Smile, Zap } from 'lucide-react'
import { PlayerPose } from '../../lib/multiplayer'

interface MobileTouchControlsProps {
  onMoveVector: (x: number, y: number) => void
  onJump: () => void
  sprintActive: boolean
  onToggleSprint: () => void
  activeEmote: PlayerPose | null
  onEmote: (pose: PlayerPose) => void
  labels: {
    jumpBtn: string
    sprintBtn: string
    emotesLabel: string
    emotes: {
      wave: string
      dance: string
      cheer: string
      sit: string
      spin: string
      backflip: string
    }
  }
}

const MAX_RADIUS = 44

export const MobileTouchControls: React.FC<MobileTouchControlsProps> = ({
  onMoveVector,
  onJump,
  sprintActive,
  onToggleSprint,
  activeEmote,
  onEmote,
  labels,
}) => {
  const padRef = useRef<HTMLDivElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  const centerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const [knob, setKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [joystickActive, setJoystickActive] = useState(false)
  const [emotesOpen, setEmotesOpen] = useState(false)

  const handlePadDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (pointerIdRef.current !== null) return
    pointerIdRef.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = padRef.current!.getBoundingClientRect()
    centerRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    setJoystickActive(true)
    updateStick(e.clientX, e.clientY)
  }

  const updateStick = (clientX: number, clientY: number) => {
    const dx = clientX - centerRef.current.x
    const dy = clientY - centerRef.current.y
    const dist = Math.hypot(dx, dy)
    const clamped = Math.min(dist, MAX_RADIUS)
    const angle = Math.atan2(dy, dx)
    const nx = dist > 2 ? Math.cos(angle) * clamped : 0
    const ny = dist > 2 ? Math.sin(angle) * clamped : 0
    setKnob({ x: nx, y: ny })
    // Normalized [-1..1]; up on stick is forward (+1 on y or -1 depending on convention; we pass standard screen dy normalized)
    onMoveVector(nx / MAX_RADIUS, ny / MAX_RADIUS)
  }

  const handlePadMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (e.pointerId !== pointerIdRef.current) return
    updateStick(e.clientX, e.clientY)
  }

  const resetStick = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (e.pointerId !== pointerIdRef.current) return
    pointerIdRef.current = null
    setJoystickActive(false)
    setKnob({ x: 0, y: 0 })
    onMoveVector(0, 0)
  }

  const emoteList: Array<{ pose: PlayerPose; label: string }> = [
    { pose: 'wave', label: labels.emotes.wave },
    { pose: 'dance', label: labels.emotes.dance },
    { pose: 'cheer', label: labels.emotes.cheer },
    { pose: 'sit', label: labels.emotes.sit },
    { pose: 'spin', label: labels.emotes.spin },
    { pose: 'backflip', label: labels.emotes.backflip },
  ]

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex items-end justify-between px-4 sm:px-6 select-none">
      {/* LEFT VIRTUAL THUMBSTICK */}
      <div
        ref={padRef}
        onPointerDown={handlePadDown}
        onPointerMove={handlePadMove}
        onPointerUp={resetStick}
        onPointerCancel={resetStick}
        style={{ touchAction: 'none' }}
        className={`pointer-events-auto relative flex h-32 w-32 items-center justify-center rounded-full border-2 transition-colors ${
          joystickActive
            ? 'border-sky-300/80 bg-slate-950/55 shadow-[0_0_24px_rgba(56,189,248,0.35)]'
            : 'border-sky-300/35 bg-slate-950/40'
        } backdrop-blur-md`}
        aria-label="Virtual Movement Joystick"
      >
        {/* Subtle cardinal crosshairs */}
        <div className="pointer-events-none absolute h-16 w-[1px] bg-sky-200/20" />
        <div className="pointer-events-none absolute h-[1px] w-16 bg-sky-200/20" />

        {/* Thumb knob */}
        <div
          style={{
            transform: `translate3d(${knob.x}px, ${knob.y}px, 0)`,
            background: 'linear-gradient(135deg, #E0F2FE 0%, #38BDF8 55%, #0284C7 100%)',
          }}
          className="pointer-events-none h-14 w-14 rounded-full border-2 border-white/80 shadow-[0_6px_18px_rgba(2,132,199,0.55)]"
        />
      </div>

      {/* RIGHT ERGONOMIC ACTION CLUSTER */}
      <div className="pointer-events-auto flex flex-col items-end gap-2.5" style={{ touchAction: 'none' }}>
        {/* Collapsible Mobile Emotes Bar */}
        {emotesOpen && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="mb-1 flex flex-wrap justify-end gap-1.5 rounded-2xl border border-sky-300/30 bg-slate-950/85 p-2 shadow-2xl backdrop-blur-xl max-w-[240px]"
          >
            {emoteList.map((em) => (
              <button
                key={em.pose}
                type="button"
                onClick={() => {
                  onEmote(em.pose)
                  setEmotesOpen(false)
                }}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-bold transition ${
                  activeEmote === em.pose
                    ? 'bg-sky-400 text-slate-950'
                    : 'bg-sky-500/15 text-sky-100 active:bg-sky-400/35'
                }`}
              >
                {em.label}
              </button>
            ))}
          </div>
        )}

        {/* Secondary row: Emotes + Sprint toggle */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation()
              setEmotesOpen((o) => !o)
            }}
            className={`flex h-12 w-12 flex-col items-center justify-center rounded-full border text-[10px] font-extrabold backdrop-blur-md transition active:scale-95 ${
              emotesOpen || activeEmote
                ? 'border-sky-300 bg-sky-500/35 text-white'
                : 'border-sky-300/35 bg-slate-950/60 text-sky-100'
            }`}
            aria-label={labels.emotesLabel}
          >
            <Smile className="h-5 w-5" />
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation()
              onToggleSprint()
            }}
            className={`flex h-12 px-3.5 items-center gap-1 rounded-full border text-xs font-extrabold backdrop-blur-md transition active:scale-95 ${
              sprintActive
                ? 'border-sky-200 bg-sky-400 text-slate-950 shadow-[0_0_16px_rgba(56,189,248,0.6)]'
                : 'border-sky-300/35 bg-slate-950/60 text-sky-100'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            {labels.sprintBtn}
          </button>
        </div>

        {/* Primary big Jump button */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation()
            onJump()
          }}
          style={{
            background: 'linear-gradient(135deg, #0284C7 0%, #38BDF8 60%, #BAE6FD 100%)',
          }}
          className="flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full border-2 border-white/80 text-slate-950 shadow-[0_8px_28px_rgba(14,165,233,0.55)] transition active:scale-90"
        >
          <ArrowUp className="h-6 w-6 stroke-[2.8]" />
          <span className="text-[10px] font-black tracking-wide leading-none">{labels.jumpBtn}</span>
        </button>
      </div>
    </div>
  )
}
