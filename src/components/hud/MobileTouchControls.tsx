import React, { useRef, useState } from 'react'
import { ArrowUp, Crosshair, RotateCcw, Smile, Zap } from 'lucide-react'
import { PlayerPose } from '../../lib/multiplayer'

export interface MobileTouchControlsProps {
  onMoveVector: (x: number, y: number, autoSprint?: boolean) => void
  onJump: () => void
  onJumpHoldChange?: (held: boolean) => void
  sprintActive: boolean
  onToggleSprint: () => void
  activeEmote: PlayerPose | null
  onEmote: (pose: PlayerPose) => void
  onRecenterCamera?: () => void
  onQuickRespawn?: () => void
  compactHeight?: boolean
  labels: {
    jumpBtn: string
    sprintBtn: string
    emotesLabel: string
    recenterBtn?: string
    respawnBtn?: string
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

/**
 * Ergonomic Roblox-grade mobile touch HUD:
 * - Floating / forgiving left thumbstick zone (touch anywhere in the lower-left zone; centers under your thumb!).
 * - Outer-ring auto-sprint (> 84% deflection) + dedicated Sprint lock toggle.
 * - Arc-shaped right-thumb action cluster (never stacks tall vertically, never clips on short landscape screens!).
 * - Hold-to-jump support on the primary Jump button for effortless Obby chaining.
 * - Dedicated quick camera-recenter (and quick respawn in Obby).
 */
export const MobileTouchControls: React.FC<MobileTouchControlsProps> = ({
  onMoveVector,
  onJump,
  onJumpHoldChange,
  sprintActive,
  onToggleSprint,
  activeEmote,
  onEmote,
  onRecenterCamera,
  onQuickRespawn,
  compactHeight = false,
  labels,
}) => {
  const zoneRef = useRef<HTMLDivElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  const jumpPointerIdRef = useRef<number | null>(null)
  const originRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const [stickOffset, setStickOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [knob, setKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [joystickActive, setJoystickActive] = useState(false)
  const [outerSprint, setOuterSprint] = useState(false)
  const [jumpPressed, setJumpPressed] = useState(false)
  const [emotesOpen, setEmotesOpen] = useState(false)

  const maxRadius = compactHeight ? 34 : 42

  const updateStick = (clientX: number, clientY: number) => {
    const dx = clientX - originRef.current.x
    const dy = clientY - originRef.current.y
    const dist = Math.hypot(dx, dy)
    const deadzone = 4
    if (dist <= deadzone) {
      setKnob({ x: 0, y: 0 })
      setOuterSprint(false)
      onMoveVector(0, 0, false)
      return
    }
    const clamped = Math.min(dist, maxRadius)
    const angle = Math.atan2(dy, dx)
    const nx = Math.cos(angle) * clamped
    const ny = Math.sin(angle) * clamped
    const ratio = clamped / maxRadius
    const autoSprint = ratio >= 0.86
    setKnob({ x: nx, y: ny })
    setOuterSprint(autoSprint)
    onMoveVector(nx / maxRadius, ny / maxRadius, autoSprint)
  }

  const handleZoneDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (pointerIdRef.current !== null) return
    pointerIdRef.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)

    const zoneRect = zoneRef.current?.getBoundingClientRect()
    if (zoneRect) {
      // Allow the joystick base to float smoothly where the player's left thumb lands!
      const defaultCx = zoneRect.left + (compactHeight ? 62 : 72)
      const defaultCy = zoneRect.bottom - (compactHeight ? 60 : 70)
      const pad = compactHeight ? 48 : 56
      const cx = Math.max(zoneRect.left + pad, Math.min(zoneRect.right - pad, e.clientX))
      const cy = Math.max(zoneRect.top + pad, Math.min(zoneRect.bottom - pad, e.clientY))
      originRef.current = { x: cx, y: cy }
      setStickOffset({ x: cx - defaultCx, y: cy - defaultCy })
    } else {
      originRef.current = { x: e.clientX, y: e.clientY }
      setStickOffset({ x: 0, y: 0 })
    }

    setJoystickActive(true)
    setKnob({ x: 0, y: 0 })
    setOuterSprint(false)
    onMoveVector(0, 0, false)
  }

  const handleZoneMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (e.pointerId !== pointerIdRef.current) return
    updateStick(e.clientX, e.clientY)
  }

  const resetStick = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (e.pointerId !== pointerIdRef.current) return
    pointerIdRef.current = null
    setJoystickActive(false)
    setOuterSprint(false)
    setStickOffset({ x: 0, y: 0 })
    setKnob({ x: 0, y: 0 })
    onMoveVector(0, 0, false)
  }

  const handleJumpDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    jumpPointerIdRef.current = e.pointerId
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore if capture unavailable
    }
    setJumpPressed(true)
    onJumpHoldChange?.(true)
    onJump()
  }

  const handleJumpUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (jumpPointerIdRef.current !== null && e.pointerId !== jumpPointerIdRef.current) return
    jumpPointerIdRef.current = null
    setJumpPressed(false)
    onJumpHoldChange?.(false)
  }

  const emoteList: Array<{ pose: PlayerPose; label: string }> = [
    { pose: 'wave', label: labels.emotes.wave },
    { pose: 'dance', label: labels.emotes.dance },
    { pose: 'cheer', label: labels.emotes.cheer },
    { pose: 'sit', label: labels.emotes.sit },
    { pose: 'spin', label: labels.emotes.spin },
    { pose: 'backflip', label: labels.emotes.backflip },
  ]

  const stickOuterClass = compactHeight ? 'h-24 w-24' : 'h-28 w-28 sm:h-32 sm:w-32'
  const stickKnobClass = compactHeight ? 'h-10 w-10' : 'h-12 w-12 sm:h-14 sm:w-14'
  const jumpBtnClass = compactHeight ? 'h-[62px] w-[62px]' : 'h-[70px] w-[70px] sm:h-[76px] sm:w-[76px]'
  const secBtnClass = compactHeight ? 'h-9 w-9' : 'h-10 w-10 sm:h-11 sm:w-11'

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between select-none"
      style={{
        paddingBottom: 'max(0.95rem, calc(env(safe-area-inset-bottom) + 0.55rem))',
        paddingLeft: 'max(0.85rem, calc(env(safe-area-inset-left) + 0.5rem))',
        paddingRight: 'max(0.85rem, calc(env(safe-area-inset-right) + 0.5rem))',
      }}
    >
      {/* LEFT FLOATING THUMBSTICK TOUCH ZONE */}
      <div
        ref={zoneRef}
        onPointerDown={handleZoneDown}
        onPointerMove={handleZoneMove}
        onPointerUp={resetStick}
        onPointerCancel={resetStick}
        style={{ touchAction: 'none' }}
        className={`pointer-events-auto relative flex items-end justify-start ${
          compactHeight ? 'h-36 w-40' : 'h-44 w-48 sm:h-48 sm:w-52'
        }`}
        aria-label="Virtual Movement Joystick"
      >
        <div
          style={{
            transform: `translate3d(${stickOffset.x}px, ${stickOffset.y}px, 0)`,
          }}
          className={`pointer-events-none relative ml-2 mb-1 flex ${stickOuterClass} items-center justify-center rounded-full border-2 transition-colors ${
            outerSprint
              ? 'border-sky-300 bg-sky-500/25 shadow-lg'
              : joystickActive
                ? 'border-white/60 bg-slate-950/50'
                : 'border-white/25 bg-slate-950/32'
          } backdrop-blur-md`}
        >
          {/* Subtle inner directional guides */}
          <div className="pointer-events-none absolute h-10 w-[1px] bg-white/15" />
          <div className="pointer-events-none absolute h-[1px] w-10 bg-white/15" />

          {/* Outer sprint ring hint */}
          <div
            className={`pointer-events-none absolute inset-1.5 rounded-full border border-dashed transition-opacity ${
              joystickActive ? 'border-sky-200/40 opacity-100' : 'border-white/15 opacity-50'
            }`}
          />

          {/* Thumbstick Knob */}
          <div
            style={{
              transform: `translate3d(${knob.x}px, ${knob.y}px, 0)`,
              background: outerSprint
                ? 'linear-gradient(135deg, #FFFFFF 0%, #7DD3FC 50%, #0EA5E9 100%)'
                : 'linear-gradient(135deg, #E0F2FE 0%, #38BDF8 55%, #0284C7 100%)',
            }}
            className={`pointer-events-none ${stickKnobClass} rounded-full border-2 border-white/90 shadow-xl`}
          />
        </div>
      </div>

      {/* RIGHT ERGONOMIC THUMB ARC — Compact horizontal+arc layout so JUMP is NEVER clipped! */}
      <div
        className="pointer-events-auto relative flex flex-col items-end gap-1.5"
        style={{ touchAction: 'none' }}
      >
        {/* Collapsible Mobile Emotes Bar (opens cleanly above buttons) */}
        {emotesOpen && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="mb-0.5 flex flex-wrap justify-end gap-1 rounded-2xl border border-white/15 bg-slate-950/88 p-1.5 shadow-2xl backdrop-blur-xl max-w-[235px]"
          >
            {emoteList.map((em) => (
              <button
                key={em.pose}
                type="button"
                onClick={() => {
                  onEmote(em.pose)
                  setEmotesOpen(false)
                }}
                className={`rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition ${
                  activeEmote === em.pose
                    ? 'bg-sky-400 text-slate-950'
                    : 'bg-white/10 text-sky-50 active:bg-white/20'
                }`}
              >
                {em.label}
              </button>
            ))}
          </div>
        )}

        {/* Single ergonomic arc row: Utility buttons + Big Primary JUMP right at bottom-right thumb! */}
        <div className="flex items-end gap-2">
          {/* Secondary utility arc beside JUMP */}
          <div className="flex flex-col items-end gap-1.5 pb-0.5">
            {/* Top mini utilities: Camera Recenter + Quick Respawn (Obby) */}
            <div className="flex items-center gap-1.5">
              {onQuickRespawn && (
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    onQuickRespawn()
                  }}
                  title={labels.respawnBtn ?? 'Respawn'}
                  aria-label={labels.respawnBtn ?? 'Respawn'}
                  className={`flex ${secBtnClass} items-center justify-center rounded-full border border-white/25 bg-slate-950/60 text-sky-100 backdrop-blur-md transition active:scale-90`}
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}

              {onRecenterCamera && (
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    onRecenterCamera()
                  }}
                  title={labels.recenterBtn ?? 'Centruj kamerę'}
                  aria-label={labels.recenterBtn ?? 'Centruj kamerę'}
                  className={`flex ${secBtnClass} items-center justify-center rounded-full border border-white/25 bg-slate-950/60 text-sky-100 backdrop-blur-md transition active:scale-90`}
                >
                  <Crosshair className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  setEmotesOpen((o) => !o)
                }}
                className={`flex ${secBtnClass} items-center justify-center rounded-full border backdrop-blur-md transition active:scale-90 ${
                  emotesOpen || activeEmote
                    ? 'border-sky-300 bg-sky-500/40 text-white'
                    : 'border-white/25 bg-slate-950/60 text-sky-100'
                }`}
                aria-label={labels.emotesLabel}
              >
                <Smile className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </button>
            </div>

            {/* Sprint Lock Toggle right next to JUMP */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation()
                onToggleSprint()
              }}
              className={`flex ${compactHeight ? 'h-9 px-3' : 'h-10 px-3.5'} items-center gap-1 rounded-full border text-[11px] font-extrabold backdrop-blur-md transition active:scale-95 ${
                sprintActive || outerSprint
                  ? 'border-white/80 bg-sky-400 text-slate-950 shadow-md'
                  : 'border-white/25 bg-slate-950/60 text-sky-100'
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>{labels.sprintBtn}</span>
            </button>
          </div>

          {/* PRIMARY JUMP BUTTON — Always 100% visible, supports instant Hold-to-Jump (zero cooldown!) */}
          <button
            type="button"
            onPointerDown={handleJumpDown}
            onPointerUp={handleJumpUp}
            onPointerCancel={handleJumpUp}
            onLostPointerCapture={handleJumpUp}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              touchAction: 'none',
              background: jumpPressed
                ? 'linear-gradient(135deg, #38BDF8 0%, #BAE6FD 70%, #FFFFFF 100%)'
                : 'linear-gradient(135deg, #0284C7 0%, #38BDF8 62%, #BAE6FD 100%)',
            }}
            className={`flex ${jumpBtnClass} flex-col items-center justify-center rounded-full border-2 border-white/90 text-slate-950 shadow-2xl transition-transform ${
              jumpPressed ? 'scale-90' : 'scale-100'
            }`}
            aria-label={labels.jumpBtn}
          >
            <ArrowUp className="h-5 w-5 sm:h-6 sm:w-6 stroke-[3]" />
            <span className="text-[9px] sm:text-[10px] font-black tracking-wide leading-none">
              {labels.jumpBtn}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
