import React from 'react'
import { Armchair, Hand, Music, PartyPopper, RotateCw, Sparkles, X } from 'lucide-react'
import { Lang } from '../../data/locales'
import { PlayerPose } from '../../lib/multiplayer'

interface EmoteRadialWheelProps {
  open: boolean
  lang: Lang
  activeEmote: PlayerPose | null
  onSelect: (pose: PlayerPose) => void
  onClose: () => void
}

const WHEEL_EMOTES: Array<{
  pose: PlayerPose
  keyNum: string
  labelPl: string
  labelEn: string
  icon: React.ComponentType<{ className?: string }>
  accent: string
  angleDeg: number
}> = [
  { pose: 'wave', keyNum: '1', labelPl: 'Machanie', labelEn: 'Wave', icon: Hand, accent: '#38BDF8', angleDeg: -90 },
  { pose: 'dance', keyNum: '2', labelPl: 'Taniec', labelEn: 'Dance', icon: Music, accent: '#A78BFA', angleDeg: -30 },
  { pose: 'cheer', keyNum: '3', labelPl: 'Radość', labelEn: 'Cheer', icon: PartyPopper, accent: '#FBBF24', angleDeg: 30 },
  { pose: 'sit', keyNum: '4', labelPl: 'Usiądź', labelEn: 'Sit', icon: Armchair, accent: '#34D399', angleDeg: 90 },
  { pose: 'spin', keyNum: '5', labelPl: 'Obrót', labelEn: 'Spin', icon: RotateCw, accent: '#22D3EE', angleDeg: 150 },
  { pose: 'backflip', keyNum: '6', labelPl: 'Salto', labelEn: 'Backflip', icon: Sparkles, accent: '#FB7185', angleDeg: 210 },
]

export const EmoteRadialWheel: React.FC<EmoteRadialWheelProps> = ({
  open,
  lang,
  activeEmote,
  onSelect,
  onClose,
}) => {
  if (!open) return null
  const isPl = lang === 'pl'
  const radius = 104

  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 backdrop-blur-[2px]"
    >
      <div className="relative flex h-[286px] w-[286px] items-center justify-center">
        {/* Outer guide ring */}
        <div className="pointer-events-none absolute inset-6 rounded-full border border-sky-300/25 bg-slate-950/65 shadow-[0_0_50px_rgba(2,132,199,0.28)] backdrop-blur-xl" />

        {/* Center close hub */}
        <button
          type="button"
          onClick={onClose}
          className="relative z-10 flex h-16 w-16 flex-col items-center justify-center rounded-full border border-white/15 bg-slate-900/95 text-sky-100 shadow-xl transition hover:scale-105 hover:border-sky-400/50 cursor-pointer"
        >
          <X className="h-4 w-4 text-sky-300" />
          <span className="mt-0.5 font-mono text-[9px] font-black text-sky-200/75">G / ESC</span>
        </button>

        {/* 6 Radial Emote Slices */}
        {WHEEL_EMOTES.map((em) => {
          const Icon = em.icon
          const rad = (em.angleDeg * Math.PI) / 180
          const x = Math.cos(rad) * radius
          const y = Math.sin(rad) * radius
          const active = activeEmote === em.pose
          return (
            <button
              key={em.pose}
              type="button"
              onClick={() => {
                onSelect(em.pose)
                onClose()
              }}
              style={{
                transform: `translate(${x}px, ${y}px)`,
                borderColor: active ? em.accent : 'rgba(255,255,255,0.16)',
                background: active ? `${em.accent}35` : 'rgba(8, 15, 30, 0.92)',
              }}
              className="absolute flex h-[70px] w-[70px] flex-col items-center justify-center gap-1 rounded-2xl border text-white shadow-xl backdrop-blur-xl transition-all hover:scale-110 hover:brightness-115 cursor-pointer"
            >
              <span className="absolute right-1.5 top-1 font-mono text-[8px] font-black opacity-65">
                {em.keyNum}
              </span>
              <span style={{ color: em.accent }}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-[10px] font-extrabold leading-none">
                {isPl ? em.labelPl : em.labelEn}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
