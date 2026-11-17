import React from 'react'
import { Gamepad2, Keyboard, LayoutGrid, Sliders, X } from 'lucide-react'
import { Lang } from '../../data/locales'
import { sfx } from '../../lib/sfx'

export interface ShortcutsOverlayModalProps {
  open: boolean
  worldKind: 'lobby' | 'obby'
  lang: Lang
  onClose: () => void
  onResumeAndLock?: () => void
}

interface ShortcutRow {
  keys: string[]
  label: string
}

export const ShortcutsOverlayModal: React.FC<ShortcutsOverlayModalProps> = ({
  open,
  worldKind,
  lang,
  onClose,
  onResumeAndLock,
}) => {
  if (!open) return null

  const isPl = lang === 'pl'

  const movementRows: ShortcutRow[] = [
    { keys: ['W', 'A', 'S', 'D'], label: isPl ? 'Poruszanie się (lub Strzałki)' : 'Move (or Arrow keys)' },
    { keys: ['Space'], label: isPl ? 'Skok (przytrzymaj = bez cooldownu)' : 'Jump (hold = zero cooldown)' },
    { keys: ['Shift'], label: isPl ? 'Sprint' : 'Sprint' },
    { keys: ['Tab', 'M'], label: isPl ? 'Zablokuj / zwolnij mysz (kamera 360°)' : 'Toggle Mouse Lock (360° camera)' },
    { keys: ['C'], label: isPl ? 'Wycentruj kamerę za plecami' : 'Center camera behind avatar' },
    {
      keys: ['R'],
      label:
        worldKind === 'obby'
          ? isPl
            ? 'Respawn na aktualnym Stage'
            : 'Respawn at current Stage'
          : isPl
            ? 'Wróć na środek placu (Spawn)'
            : 'Return to center Spawn',
    },
    worldKind === 'obby'
      ? { keys: ['[', ']'], label: isPl ? 'Poprzedni / Następny odblokowany Stage' : 'Previous / Next unlocked Stage' }
      : { keys: ['E'], label: isPl ? 'Wejdź do portalu / Usiądź na ławce' : 'Enter portal / Sit on bench' },
    { keys: ['1 – 6'], label: isPl ? 'Emotki (machanie, taniec, salto...)' : 'Emotes (wave, dance, backflip...)' },
  ]

  const uiRows: ShortcutRow[] = [
    { keys: ['T', '/'], label: isPl ? 'Otwórz Czat i zacznij pisać' : 'Open Chat & focus input' },
    { keys: ['I'], label: isPl ? 'Szatnia R6 (zmiana stroju i czapek)' : 'R6 Wardrobe (outfits & hats)' },
    { keys: ['H'], label: isPl ? 'Menu gry (Hub)' : 'In-Game Menu (Hub)' },
    { keys: ['P'], label: isPl ? 'Lista graczy w pokoju' : 'Room Players list' },
    { keys: ['O'], label: isPl ? 'Ustawienia (czułość, grafika)' : 'Settings (sensitivity, graphics)' },
    { keys: ['B'], label: isPl ? 'Zgłoś błąd lub pomysł' : 'Report Bug or Idea' },
    { keys: ['K', '?'], label: isPl ? 'Pokaż / ukryj tę ściągawkę' : 'Show / hide this overlay' },
    { keys: ['Esc'], label: isPl ? 'Zwolnij mysz / Zamknij okno' : 'Release mouse / Close panel' },
  ]

  const quickToggleRows: ShortcutRow[] = [
    { keys: ['L'], label: isPl ? 'Przełącz Shift-Lock (obrót z kamerą)' : 'Toggle Shift-Lock alignment' },
    { keys: ['N'], label: isPl ? 'Przełącz Dzień / Noc' : 'Toggle Day / Night' },
    { keys: ['F'], label: isPl ? 'Pełny ekran (Fullscreen)' : 'Toggle Fullscreen' },
  ]

  const renderSection = (title: string, icon: React.ReactNode, rows: ShortcutRow[]) => (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3.5">
      <div className="mb-2.5 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-sky-300">
        {icon}
        <span>{title}</span>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-2.5 text-xs">
            <div className="flex shrink-0 items-center gap-1">
              {row.keys.map((k, idx) => (
                <React.Fragment key={k}>
                  {idx > 0 && row.keys.length <= 2 && row.keys[0] !== 'W' && (
                    <span className="text-[10px] font-bold text-sky-300/50">/</span>
                  )}
                  <kbd className="inline-flex min-w-[24px] items-center justify-center rounded-lg border border-sky-300/30 bg-slate-900/95 px-2 py-0.5 font-mono text-[11px] font-extrabold text-sky-100 shadow-sm">
                    {k}
                  </kbd>
                </React.Fragment>
              ))}
            </div>
            <span className="text-right font-medium text-sky-100/85 leading-tight">{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 sm:p-5 backdrop-blur-md"
      onClick={() => {
        sfx.playClick()
        onClose()
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#081326]/95 text-sky-50 shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-400/35 bg-sky-500/20 text-sky-300">
              <Keyboard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base sm:text-lg font-black text-white">
                {isPl ? 'Skróty klawiszowe (PC)' : 'Keyboard Shortcuts (PC)'}
              </h2>
              <p className="text-[11px] font-medium text-sky-200/75">
                {isPl
                  ? 'Wszystkie panele działają również przy zablokowanej myszy — kursor zwolni się automatycznie.'
                  : 'All panels work while Mouse Lock is active — your cursor releases automatically.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sfx.playClick()
              onClose()
            }}
            aria-label={isPl ? 'Zamknij' : 'Close'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/8 text-sky-100 hover:bg-white/16 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {renderSection(
              isPl ? 'Ruch i kamera' : 'Movement & Camera',
              <Gamepad2 className="h-3.5 w-3.5" />,
              movementRows,
            )}
            {renderSection(
              isPl ? 'Panele UI (auto-zwolnienie myszy)' : 'UI Panels (auto-unlock mouse)',
              <LayoutGrid className="h-3.5 w-3.5" />,
              uiRows,
            )}
          </div>

          {renderSection(
            isPl ? 'Szybkie przełączniki (działają bez zwalniania myszy)' : 'Instant Toggles (work without unlocking mouse)',
            <Sliders className="h-3.5 w-3.5" />,
            quickToggleRows,
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-slate-950/60 px-5 py-3">
          <span className="text-[11px] font-semibold text-sky-200/75">
            {isPl
              ? 'Wskazówka: ponowne wciśnięcie I / H / P / O / K zamyka okno i płynnie wraca do gry.'
              : 'Tip: press I / H / P / O / K again to close a panel and return straight to gameplay.'}
          </span>
          <button
            type="button"
            onClick={() => {
              sfx.playClick()
              if (onResumeAndLock) {
                onResumeAndLock()
              } else {
                onClose()
              }
            }}
            className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-xs font-extrabold text-white shadow hover:brightness-110 active:scale-[0.98] transition cursor-pointer"
          >
            {isPl ? 'Wróć do gry (K / Esc)' : 'Back to game (K / Esc)'}
          </button>
        </div>
      </div>
    </div>
  )
}
