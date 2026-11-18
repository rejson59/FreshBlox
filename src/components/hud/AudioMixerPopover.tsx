import React, { useEffect, useState } from 'react'
import { Volume2, VolumeX, Music, Sparkles, MessageSquare } from 'lucide-react'
import { audioEngine, AudioPrefs } from '../../lib/audioEngine'

interface AudioMixerPanelProps {
  lang: 'pl' | 'en'
  compact?: boolean
}

export const AudioMixerPanel: React.FC<AudioMixerPanelProps> = ({ lang, compact = false }) => {
  const [prefs, setPrefs] = useState<AudioPrefs>(() => audioEngine.getPrefs())

  useEffect(() => {
    return audioEngine.subscribe(setPrefs)
  }, [])

  const rows: Array<{
    key: 'master' | 'sfx' | 'music' | 'ui'
    labelPl: string
    labelEn: string
    icon: React.ReactNode
    accent: string
  }> = [
    {
      key: 'master',
      labelPl: 'Głośność główna (Master)',
      labelEn: 'Master Volume',
      icon: prefs.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />,
      accent: '#38BDF8',
    },
    {
      key: 'sfx',
      labelPl: 'Efekty 3D & Fizyka (SFX)',
      labelEn: '3D SFX & Physics',
      icon: <Sparkles className="w-3.5 h-3.5" />,
      accent: '#22D3EE',
    },
    {
      key: 'music',
      labelPl: 'Muzyka i Ambient Światów',
      labelEn: 'World Music & Ambient',
      icon: <Music className="w-3.5 h-3.5" />,
      accent: '#A855F7',
    },
    {
      key: 'ui',
      labelPl: 'Interfejs & Czat (UI)',
      labelEn: 'UI & Chat Sounds',
      icon: <MessageSquare className="w-3.5 h-3.5" />,
      accent: '#F59E0B',
    },
  ]

  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-extrabold text-white flex items-center gap-1.5">
            {prefs.muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-sky-400" />}
            {lang === 'pl' ? 'Mikser Audio 2.0' : 'Audio 2.0 Mixer'}
          </p>
          <p className="text-[10px] text-slate-400">
            {lang === 'pl'
              ? 'Dźwięk 3D przestrzenny, kroki i muzyka światów'
              : '3D spatial audio, surface footsteps & world music'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            audioEngine.unlock()
            audioEngine.toggleMute()
          }}
          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold border transition cursor-pointer ${
            prefs.muted
              ? 'bg-rose-500/20 border-rose-400/40 text-rose-200 hover:bg-rose-500/30'
              : 'bg-sky-500/20 border-sky-400/40 text-sky-200 hover:bg-sky-500/30'
          }`}
        >
          {prefs.muted ? (lang === 'pl' ? 'Wyciszono' : 'Muted') : (lang === 'pl' ? 'Włączono' : 'Active')}
        </button>
      </div>

      <div className="space-y-2.5">
        {rows.map((row) => {
          const pct = Math.round(prefs[row.key] * 100)
          return (
            <div key={row.key} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <span style={{ color: row.accent }}>{row.icon}</span>
                  {lang === 'pl' ? row.labelPl : row.labelEn}
                </span>
                <span className="font-mono text-[10px] font-bold text-slate-400">{pct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={pct}
                disabled={prefs.muted && row.key !== 'master'}
                onChange={(e) => {
                  audioEngine.unlock()
                  const v = Number(e.target.value) / 100
                  audioEngine.setPrefs({ [row.key]: v, ...(row.key === 'master' && v > 0 ? { muted: false } : {}) })
                }}
                onPointerUp={() => {
                  if (row.key === 'ui') audioEngine.playClick()
                  else if (row.key === 'sfx') audioEngine.playJump()
                }}
                className="w-full h-1.5 rounded-full accent-sky-400 cursor-pointer disabled:opacity-40"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface AudioMixerPopoverProps {
  lang: 'pl' | 'en'
}

export const AudioMixerPopover: React.FC<AudioMixerPopoverProps> = ({ lang }) => {
  const [open, setOpen] = useState(false)
  const [prefs, setPrefs] = useState<AudioPrefs>(() => audioEngine.getPrefs())

  useEffect(() => {
    return audioEngine.subscribe(setPrefs)
  }, [])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          audioEngine.unlock()
          audioEngine.playClick()
          setOpen((v) => !v)
        }}
        title={lang === 'pl' ? 'Mikser Audio 2.0' : 'Audio 2.0 Mixer'}
        className={`flex items-center justify-center w-9 h-9 rounded-xl border transition cursor-pointer ${
          prefs.muted
            ? 'bg-rose-500/15 border-rose-400/35 text-rose-300 hover:bg-rose-500/25'
            : 'bg-slate-800/80 border-sky-400/25 text-sky-300 hover:bg-slate-700/80 hover:border-sky-400/50'
        }`}
      >
        {prefs.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[80]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-sky-400/25 bg-slate-950/95 backdrop-blur-xl shadow-2xl p-4 z-[85]">
            <AudioMixerPanel lang={lang} compact />
          </div>
        </>
      )}
    </div>
  )
}
