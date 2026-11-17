import React, { useState } from 'react'
import {
  Check,
  Compass,
  Crosshair,
  Flag,
  Gamepad2,
  Gauge,
  Keyboard,
  Lock,
  LogOut,
  Maximize2,
  MessageSquarePlus,
  Minimize2,
  Moon,
  MousePointerClick,
  Navigation,
  Play,
  RotateCcw,
  Settings,
  Share2,
  Shirt,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  X,
} from 'lucide-react'
import { FreshBloxLogo } from '../brand/FreshBloxBrand'
import { Lang, LOCALES } from '../../data/locales'
import { sfx } from '../../lib/sfx'

export type MenuQuality = 'low' | 'medium' | 'high'
export type MenuWorldTime = 'day' | 'night'
export type MenuDrawerTab = 'overview' | 'players' | 'settings'

export interface InGameRosterMember {
  id: string
  username: string
  rank: string
  isSelf?: boolean
  stage?: number
}

export interface InGameMenuDrawerProps {
  open: boolean
  activeTab?: MenuDrawerTab
  onTabChange?: (tab: MenuDrawerTab) => void
  onOpenShortcuts?: () => void
  worldKind: 'lobby' | 'obby'
  lang: Lang
  roomCode: string
  username: string
  rankName: string
  onlineCount: number
  roster: InGameRosterMember[]
  fpsDisplay?: number
  // Obby progress (optional)
  currentStage?: number
  maxUnlockedStage?: number
  stageTitle?: string
  difficultyLabel?: string
  difficultyColor?: string
  // Controls & mouse lock settings
  touchMode: boolean
  pointerLocked: boolean
  clickToLock: boolean
  shiftLockAlign: boolean
  mouseSensitivity: number
  onTogglePointerLock: () => void
  onChangeClickToLock: (enabled: boolean) => void
  onChangeShiftLockAlign: (enabled: boolean) => void
  onChangeMouseSensitivity: (sens: number) => void
  // World & display settings
  worldTime: MenuWorldTime
  soundEnabled: boolean
  quality: MenuQuality
  isFullscreen: boolean
  supabaseConnected: boolean
  copiedInvite: boolean
  onChangeWorldTime: (time: MenuWorldTime) => void
  onToggleSound: () => void
  onChangeQuality: (q: MenuQuality) => void
  onToggleTouchMode: () => void
  onToggleFullscreen: () => void
  // Actions
  onClose: () => void
  onResumeAndLock?: () => void
  onOpenWardrobe: () => void
  onCopyInvite: () => void
  onResetPosition: () => void
  onSwitchWorld: () => void
  onLeaveToHome: () => void
  onOpenFeedback: () => void
  onTeleportToMember?: (memberId: string) => void
}

const MENU_COPY = {
  pl: {
    tabOverview: 'Menu',
    tabPlayers: 'Gracze',
    tabSettings: 'Ustawienia',
    lobbyTitle: 'Lobby Główne',
    obbyTitle: 'Test Obby 100',
    resume: 'Wznów grę',
    reportTitle: 'Zgłoś błąd lub pomysł',
    reportSub: 'Wyślij zgłoszenie bez wychodzenia z rozgrywki',
    quickActions: 'Szybkie akcje',
    wardrobe: 'Szatnia R6',
    invite: 'Zaproś linkiem',
    inviteCopied: 'Skopiowano!',
    resetLobby: 'Wróć na środek',
    resetObby: 'Respawn',
    switchToObby: 'Wejdź do Test Obby 100',
    switchToLobby: 'Przejdź do Lobby Głównego',
    leaveHome: 'Menu główne',
    playersTitle: 'Gracze w tym pokoju',
    teleport: 'Dołącz',
    youTag: 'Ty',
    mouseSection: 'Sterowanie myszą (PC)',
    clickToLockLabel: 'Lock myszy (bez przeciągania)',
    clickToLockDesc: 'Kliknij ekran 3D albo naciśnij Tab / M, aby swobodnie obracać kamerą myszą.',
    lockNowBtn: 'Zablokuj mysz teraz',
    lockedBadge: 'Zablokowana',
    shiftLockLabel: 'Tryb Shift-Lock',
    shiftLockDesc: 'Gdy mysz jest zablokowana, awatar zawsze patrzy tam gdzie celuje kamera.',
    sensLabel: 'Czułość myszy',
    worldSection: 'Świat i grafika',
    timeLabel: 'Pora dnia',
    day: 'Dzień',
    night: 'Noc',
    soundLabel: 'Dźwięki SFX',
    on: 'Wł.',
    off: 'Wył.',
    qualityLabel: 'Jakość grafiki',
    qLow: 'Niska',
    qMed: 'Średnia',
    qHigh: 'Wysoka',
    touchLabel: 'Sterowanie',
    touchPc: 'PC',
    touchMobile: 'Dotyk',
    fullscreenLabel: 'Pełny ekran',
    controlsTitle: 'Skróty klawiszowe (PC)',
    shortcutsBtn: 'Pełna lista skrótów',
    controlsList: [
      ['WASD / Strzałki', 'Poruszanie się'],
      ['Spacja (przytrzymaj)', 'Skok bez cooldownu'],
      ['Shift', 'Sprint'],
      ['Klik / Tab / M', 'Lock myszy (kamera 360°)'],
      ['L', 'Przełącz Shift-Lock w locie'],
      ['T lub /', 'Otwórz Czat i pisz'],
      ['I', 'Szatnia R6 (auto-zwolnienie myszy)'],
      ['H / P / O', 'Menu / Gracze / Ustawienia'],
      ['B', 'Zgłoś błąd lub pomysł'],
      ['K lub ?', 'Ściągawka wszystkich skrótów'],
      ['C / R', 'Centruj kamerę / Respawn'],
      ['[ / ] (Obby)', 'Poprzedni / Następny Stage'],
      ['N / V / F', 'Dzień-Noc / Dźwięk / Pełny ekran'],
      ['1 – 6', 'Emotki i salto'],
      ['Esc', 'Zwolnij mysz / Zamknij panel'],
    ] as Array<[string, string]>,
    cloudOnline: 'Multiplayer online',
    cloudLocal: 'Tryb lokalny',
    bestStage: 'Rekord',
  },
  en: {
    tabOverview: 'Menu',
    tabPlayers: 'Players',
    tabSettings: 'Settings',
    lobbyTitle: 'Main Lobby',
    obbyTitle: 'Test Obby 100',
    resume: 'Resume Game',
    reportTitle: 'Report Bug or Idea',
    reportSub: 'Send feedback right from gameplay without leaving',
    quickActions: 'Quick Actions',
    wardrobe: 'R6 Wardrobe',
    invite: 'Copy Invite',
    inviteCopied: 'Copied!',
    resetLobby: 'Reset Spawn',
    resetObby: 'Respawn',
    switchToObby: 'Play Test Obby 100',
    switchToLobby: 'Switch to Main Lobby',
    leaveHome: 'Home Menu',
    playersTitle: 'Players in this room',
    teleport: 'Teleport',
    youTag: 'You',
    mouseSection: 'Mouse Controls (PC)',
    clickToLockLabel: 'Mouse Lock (no dragging)',
    clickToLockDesc: 'Click the 3D view or press Tab / M to look around freely with your mouse.',
    lockNowBtn: 'Lock Mouse Now',
    lockedBadge: 'Locked',
    shiftLockLabel: 'Shift-Lock Alignment',
    shiftLockDesc: 'While mouse is locked, your avatar always faces the camera direction.',
    sensLabel: 'Mouse Sensitivity',
    worldSection: 'World & Graphics',
    timeLabel: 'Time of Day',
    day: 'Day',
    night: 'Night',
    soundLabel: 'SFX Audio',
    on: 'On',
    off: 'Off',
    qualityLabel: 'Graphics Quality',
    qLow: 'Low',
    qMed: 'Med',
    qHigh: 'High',
    touchLabel: 'Input Mode',
    touchPc: 'PC',
    touchMobile: 'Touch',
    fullscreenLabel: 'Fullscreen',
    controlsTitle: 'Keyboard Shortcuts (PC)',
    shortcutsBtn: 'All Shortcuts',
    controlsList: [
      ['WASD / Arrows', 'Move'],
      ['Space (hold)', 'Zero-cooldown jump'],
      ['Shift', 'Sprint'],
      ['Click / Tab / M', 'Mouse Lock (360° camera)'],
      ['L', 'Toggle Shift-Lock on the fly'],
      ['T or /', 'Open Chat & start typing'],
      ['I', 'R6 Wardrobe (auto-unlocks mouse)'],
      ['H / P / O', 'Menu / Players / Settings'],
      ['B', 'Report Bug or Idea'],
      ['K or ?', 'All Keyboard Shortcuts overlay'],
      ['C / R', 'Center camera / Respawn'],
      ['[ / ] (Obby)', 'Previous / Next unlocked Stage'],
      ['N / V / F', 'Day-Night / Audio / Fullscreen'],
      ['1 – 6', 'Emotes & backflip'],
      ['Esc', 'Release mouse / Close panel'],
    ] as Array<[string, string]>,
    cloudOnline: 'Multiplayer live',
    cloudLocal: 'Local mode',
    bestStage: 'Best',
  },
}

export const InGameMenuDrawer: React.FC<InGameMenuDrawerProps> = ({
  open,
  activeTab,
  onTabChange,
  onOpenShortcuts,
  worldKind,
  lang,
  roomCode,
  username,
  rankName,
  onlineCount,
  roster,
  fpsDisplay,
  currentStage,
  maxUnlockedStage,
  stageTitle,
  difficultyLabel,
  difficultyColor,
  touchMode,
  pointerLocked,
  clickToLock,
  shiftLockAlign,
  mouseSensitivity,
  onTogglePointerLock,
  onChangeClickToLock,
  onChangeShiftLockAlign,
  onChangeMouseSensitivity,
  worldTime,
  soundEnabled,
  quality,
  isFullscreen,
  supabaseConnected,
  copiedInvite,
  onChangeWorldTime,
  onToggleSound,
  onChangeQuality,
  onToggleTouchMode,
  onToggleFullscreen,
  onClose,
  onResumeAndLock,
  onOpenWardrobe,
  onCopyInvite,
  onResetPosition,
  onSwitchWorld,
  onLeaveToHome,
  onOpenFeedback,
  onTeleportToMember,
}) => {
  const [internalTab, setInternalTab] = useState<MenuDrawerTab>('overview')
  const tab = activeTab ?? internalTab
  const setTab = (next: MenuDrawerTab) => {
    setInternalTab(next)
    onTabChange?.(next)
  }
  const t = MENU_COPY[lang]

  if (!open) return null

  const progressPct = currentStage ? Math.min(100, Math.max(1, currentStage)) : 0

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 flex items-stretch justify-start bg-slate-950/50 backdrop-blur-[3px]"
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex h-full w-[min(390px,calc(100vw-16px))] flex-col overflow-hidden border-r border-white/15 bg-[#081326]/95 text-sky-50 shadow-2xl backdrop-blur-2xl"
        style={{
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
          paddingLeft: 'env(safe-area-inset-left)',
        }}
      >
        {/* === TOP HEADER === */}
        <div className="shrink-0 border-b border-white/10 px-4 pt-3 pb-3.5">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-400/35 bg-gradient-to-br from-sky-500/25 to-blue-600/20 shadow-inner">
                <FreshBloxLogo size={28} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-display text-base font-black tracking-tight text-white">
                    {worldKind === 'obby' ? t.obbyTitle : t.lobbyTitle}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-sky-200/80">
                  <span className="truncate max-w-[115px] text-white font-bold">{username}</span>
                  <span className="opacity-45">•</span>
                  <span className="truncate text-sky-300">{rankName}</span>
                  <span className="opacity-45">•</span>
                  <span className="font-mono text-sky-200">#{roomCode}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                sfx.playClick()
                onClose()
              }}
              aria-label={t.resume}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/8 text-sky-100 hover:bg-white/16 active:scale-95 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Live Context Strip (Obby Stage Progress OR Lobby Status) */}
          {worldKind === 'obby' && currentStage !== undefined ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 text-xs font-extrabold">
                <span className="text-white">
                  Stage <span className="text-sky-300">{currentStage}</span> / 100
                </span>
                {difficultyLabel && (
                  <span
                    className="rounded-lg border px-2 py-0.5 text-[10px] font-extrabold"
                    style={{
                      borderColor: `${difficultyColor ?? '#38BDF8'}55`,
                      background: `${difficultyColor ?? '#38BDF8'}20`,
                      color: difficultyColor ?? '#7DD3FC',
                    }}
                  >
                    {difficultyLabel}
                  </span>
                )}
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/12">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] font-semibold text-sky-200/80">
                <span className="truncate">{stageTitle}</span>
                <span className="shrink-0 font-mono text-sky-300">
                  {t.bestStage}: {maxUnlockedStage ?? currentStage}/100
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold">
              <span className="flex items-center gap-1.5 text-emerald-300">
                <Wifi className="h-3.5 w-3.5" />
                {supabaseConnected ? t.cloudOnline : t.cloudLocal} · {onlineCount} online
              </span>
              {fpsDisplay !== undefined && (
                <span className="flex items-center gap-1 font-mono text-sky-200/85">
                  <Gauge className="h-3 w-3 text-sky-400" />
                  {fpsDisplay} FPS
                </span>
              )}
            </div>
          )}

          {/* 3-Tab Switcher */}
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-slate-950/70 p-1">
            {(
              [
                { id: 'overview', label: t.tabOverview, icon: Gamepad2, kbd: 'H' },
                { id: 'players', label: `${t.tabPlayers} (${onlineCount})`, icon: Users, kbd: 'P' },
                { id: 'settings', label: t.tabSettings, icon: Settings, kbd: 'O' },
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
                  className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-extrabold transition cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-sky-500/35 to-blue-500/30 text-white ring-1 ring-sky-300/45 shadow'
                      : 'text-sky-200/75 hover:bg-white/6 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                  <span className="truncate">{item.label}</span>
                  {!touchMode && (
                    <kbd className="hidden sm:inline-flex rounded border border-white/15 bg-black/30 px-1 py-0.2 font-mono text-[9px] font-bold text-sky-200/85">
                      {item.kbd}
                    </kbd>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* === SCROLLABLE BODY === */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5">
          {/* TAB 1: OVERVIEW & QUICK ACTIONS */}
          {tab === 'overview' && (
            <>
              {/* Prominent Bug Report & Update Ideas CTA — right inside the menu! */}
              <button
                type="button"
                onClick={() => {
                  sfx.playClick()
                  onClose()
                  onOpenFeedback()
                }}
                className="group flex w-full items-center gap-3 rounded-2xl border border-sky-400/40 bg-gradient-to-r from-sky-500/20 via-cyan-500/15 to-blue-600/20 p-3.5 text-left transition hover:border-sky-300/70 hover:brightness-110 active:scale-[0.99] cursor-pointer"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-400/25 border border-sky-300/40 text-sky-200 group-hover:scale-105 transition">
                  <MessageSquarePlus className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold text-white leading-tight">{t.reportTitle}</span>
                    {!touchMode && (
                      <kbd className="rounded-md border border-sky-300/35 bg-slate-950/70 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-sky-200">
                        B
                      </kbd>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium text-sky-200/80 leading-snug">
                    {t.reportSub}
                  </div>
                </div>
              </button>

              {/* Desktop Mouse Lock Quick Toggle Card */}
              {!touchMode && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <MousePointerClick className="h-4 w-4 shrink-0 text-sky-300" />
                      <span className="truncate text-xs font-extrabold text-white">{t.clickToLockLabel}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        sfx.playClick()
                        onChangeClickToLock(!clickToLock)
                      }}
                      className={`rounded-xl px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer ${
                        clickToLock
                          ? 'bg-sky-400 text-slate-950'
                          : 'bg-white/10 text-sky-200/80 hover:bg-white/18'
                      }`}
                    >
                      {clickToLock ? t.on : t.off}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-snug text-sky-200/75">{t.clickToLockDesc}</p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      onTogglePointerLock()
                    }}
                    className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-sky-400/35 bg-sky-500/18 py-2 text-xs font-extrabold text-sky-100 hover:bg-sky-500/30 active:scale-[0.98] transition cursor-pointer"
                  >
                    <Crosshair className="h-3.5 w-3.5 text-sky-300" />
                    <span>{t.lockNowBtn} (Tab / M)</span>
                  </button>
                </div>
              )}

              {/* Quick Actions Grid */}
              <div>
                <div className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-sky-300/75">
                  {t.quickActions}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick()
                      onOpenWardrobe()
                    }}
                    className="flex items-center justify-between gap-1.5 rounded-2xl border border-sky-400/25 bg-sky-500/12 px-3 py-2.5 text-xs font-extrabold text-white hover:bg-sky-500/22 active:scale-[0.98] transition cursor-pointer"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Shirt className="h-4 w-4 shrink-0 text-sky-300" />
                      <span className="truncate">{t.wardrobe}</span>
                    </span>
                    {!touchMode && (
                      <kbd className="shrink-0 rounded border border-white/15 bg-black/30 px-1.5 py-0.5 font-mono text-[9px] font-bold text-sky-200">
                        I
                      </kbd>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={onCopyInvite}
                    className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-xs font-extrabold text-white hover:bg-white/12 active:scale-[0.98] transition cursor-pointer"
                  >
                    {copiedInvite ? (
                      <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <Share2 className="h-4 w-4 shrink-0 text-sky-300" />
                    )}
                    <span className="truncate">{copiedInvite ? t.inviteCopied : t.invite}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick()
                      onResetPosition()
                      onClose()
                    }}
                    className="flex items-center justify-between gap-1.5 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-xs font-extrabold text-white hover:bg-white/12 active:scale-[0.98] transition cursor-pointer"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <RotateCcw className="h-4 w-4 shrink-0 text-sky-300" />
                      <span className="truncate">{worldKind === 'obby' ? t.resetObby : t.resetLobby}</span>
                    </span>
                    {!touchMode && (
                      <kbd className="shrink-0 rounded border border-white/15 bg-black/30 px-1.5 py-0.5 font-mono text-[9px] font-bold text-sky-200">
                        R
                      </kbd>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick()
                      onToggleSound()
                    }}
                    className="flex items-center justify-between gap-1.5 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-xs font-extrabold text-white hover:bg-white/12 active:scale-[0.98] transition cursor-pointer"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {soundEnabled ? (
                        <Volume2 className="h-4 w-4 shrink-0 text-emerald-300" />
                      ) : (
                        <VolumeX className="h-4 w-4 shrink-0 text-slate-400" />
                      )}
                      <span className="truncate">
                        {t.soundLabel}: {soundEnabled ? t.on : t.off}
                      </span>
                    </span>
                    {!touchMode && (
                      <kbd className="shrink-0 rounded border border-white/15 bg-black/30 px-1.5 py-0.5 font-mono text-[9px] font-bold text-sky-200">
                        V
                      </kbd>
                    )}
                  </button>

                  {!touchMode && onOpenShortcuts && (
                    <button
                      type="button"
                      onClick={() => {
                        sfx.playClick()
                        onClose()
                        onOpenShortcuts()
                      }}
                      className="col-span-2 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-extrabold text-sky-100 hover:bg-white/12 active:scale-[0.98] transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Keyboard className="h-4 w-4 shrink-0 text-sky-300" />
                        <span>{t.shortcutsBtn}</span>
                      </span>
                      <kbd className="rounded border border-white/15 bg-black/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-200">
                        K / ?
                      </kbd>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick()
                      onClose()
                      onSwitchWorld()
                    }}
                    className="col-span-2 flex items-center justify-center gap-2 rounded-2xl border border-sky-300/40 bg-gradient-to-r from-sky-500 to-blue-600 py-2.5 px-3 text-xs font-extrabold text-white shadow-md hover:brightness-110 active:scale-[0.98] transition cursor-pointer"
                  >
                    {worldKind === 'lobby' ? (
                      <Flag className="h-4 w-4 text-amber-200" />
                    ) : (
                      <Compass className="h-4 w-4 text-sky-100" />
                    )}
                    <span>{worldKind === 'lobby' ? t.switchToObby : t.switchToLobby}</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: PLAYERS ROSTER */}
          {tab === 'players' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-extrabold text-sky-200/80">
                <span className="uppercase tracking-wider">{t.playersTitle}</span>
                <button
                  type="button"
                  onClick={onCopyInvite}
                  className="inline-flex items-center gap-1 rounded-lg border border-sky-400/35 bg-sky-500/15 px-2.5 py-1 text-[11px] font-bold text-sky-100 hover:bg-sky-500/25 cursor-pointer"
                >
                  {copiedInvite ? <Check className="h-3 w-3 text-emerald-400" /> : <Share2 className="h-3 w-3" />}
                  <span>{copiedInvite ? t.inviteCopied : t.invite}</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {roster.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          m.isSelf ? 'bg-sky-400' : 'bg-emerald-400'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-white">
                          <span className="truncate">{m.username}</span>
                          {m.isSelf && (
                            <span className="rounded bg-sky-500/25 px-1.5 py-0.5 text-[9px] text-sky-200">
                              {t.youTag}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-semibold text-sky-200/70">{m.rank}</div>
                      </div>
                    </div>

                    {m.stage !== undefined ? (
                      <span className="shrink-0 rounded-lg border border-sky-400/30 bg-sky-500/18 px-2 py-1 font-mono text-[11px] font-extrabold text-sky-200">
                        Stage {m.stage}
                      </span>
                    ) : !m.isSelf && onTeleportToMember ? (
                      <button
                        type="button"
                        onClick={() => {
                          sfx.playClick()
                          onTeleportToMember(m.id)
                          onClose()
                        }}
                        className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-sky-400/35 bg-sky-500/20 px-2.5 py-1.5 text-[11px] font-extrabold text-sky-100 hover:bg-sky-500/35 active:scale-95 transition cursor-pointer"
                      >
                        <Navigation className="h-3 w-3 text-sky-300" />
                        <span>{t.teleport}</span>
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: SETTINGS & CONTROLS */}
          {tab === 'settings' && (
            <div className="space-y-4">
              {/* Mouse & Camera Section (PC) */}
              {!touchMode && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-sky-300/75">
                    <span className="flex items-center gap-1.5">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      {t.mouseSection}
                    </span>
                    {pointerLocked && (
                      <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[9px] text-emerald-300">
                        {t.lockedBadge}
                      </span>
                    )}
                  </div>

                  {/* Click-to-Lock Toggle */}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-white">{t.clickToLockLabel}</div>
                        <div className="text-[10px] text-sky-200/70">{t.clickToLockDesc}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          sfx.playClick()
                          onChangeClickToLock(!clickToLock)
                        }}
                        className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                          clickToLock ? 'bg-sky-400 text-slate-950' : 'bg-white/10 text-sky-200'
                        }`}
                      >
                        {clickToLock ? t.on : t.off}
                      </button>
                    </div>

                    <div className="h-[1px] bg-white/10" />

                    {/* Shift-Lock Character Align Toggle */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-white">
                          <Lock className="h-3.5 w-3.5 text-sky-300" />
                          <span>{t.shiftLockLabel}</span>
                        </div>
                        <div className="text-[10px] text-sky-200/70">{t.shiftLockDesc}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          sfx.playClick()
                          onChangeShiftLockAlign(!shiftLockAlign)
                        }}
                        className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                          shiftLockAlign ? 'bg-sky-400 text-slate-950' : 'bg-white/10 text-sky-200'
                        }`}
                      >
                        {shiftLockAlign ? t.on : t.off}
                      </button>
                    </div>

                    <div className="h-[1px] bg-white/10" />

                    {/* Mouse Sensitivity Slider */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
                        <span className="text-sky-100">{t.sensLabel}</span>
                        <span className="font-mono text-sky-300">{mouseSensitivity.toFixed(2)}×</span>
                      </div>
                      <input
                        type="range"
                        min={0.4}
                        max={2.2}
                        step={0.05}
                        value={mouseSensitivity}
                        onChange={(e) => onChangeMouseSensitivity(parseFloat(e.target.value))}
                        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/15 accent-sky-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* World & Display Settings */}
              <div className="space-y-2">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-sky-300/75">
                  {t.worldSection}
                </div>

                {/* Day / Night */}
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2">
                  <span className="text-xs font-bold text-white">{t.timeLabel}</span>
                  <div className="flex rounded-xl border border-white/10 bg-slate-950/80 p-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        sfx.playClick()
                        onChangeWorldTime('day')
                      }}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer ${
                        worldTime === 'day' ? 'bg-sky-400 text-slate-950' : 'text-sky-200/75 hover:text-white'
                      }`}
                    >
                      <Sun className="h-3 w-3" />
                      {t.day}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        sfx.playClick()
                        onChangeWorldTime('night')
                      }}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer ${
                        worldTime === 'night' ? 'bg-sky-400 text-slate-950' : 'text-sky-200/75 hover:text-white'
                      }`}
                    >
                      <Moon className="h-3 w-3" />
                      {t.night}
                    </button>
                  </div>
                </div>

                {/* Quality */}
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2">
                  <span className="text-xs font-bold text-white">{t.qualityLabel}</span>
                  <div className="flex rounded-xl border border-white/10 bg-slate-950/80 p-0.5">
                    {(
                      [
                        { id: 'low', label: t.qLow },
                        { id: 'medium', label: t.qMed },
                        { id: 'high', label: t.qHigh },
                      ] as const
                    ).map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          sfx.playClick()
                          onChangeQuality(q.id)
                        }}
                        className={`rounded-lg px-2 py-1 text-[11px] font-extrabold transition cursor-pointer ${
                          quality === q.id ? 'bg-sky-400 text-slate-950' : 'text-sky-200/75 hover:text-white'
                        }`}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Compact Toggles Row */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick()
                      onToggleTouchMode()
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] py-2 text-xs font-bold text-white hover:bg-white/12 cursor-pointer"
                  >
                    <Smartphone className="h-3.5 w-3.5 text-sky-300" />
                    <span>
                      {t.touchLabel}: {touchMode ? t.touchMobile : t.touchPc}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick()
                      onToggleFullscreen()
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] py-2 text-xs font-bold text-white hover:bg-white/12 cursor-pointer"
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-3.5 w-3.5 text-sky-300" />
                    ) : (
                      <Maximize2 className="h-3.5 w-3.5 text-sky-300" />
                    )}
                    <span>{t.fullscreenLabel}</span>
                  </button>
                </div>
              </div>

              {/* Keyboard Cheatsheet */}
              {!touchMode && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-sky-300/75">
                    <Keyboard className="h-3.5 w-3.5" />
                    <span>{t.controlsTitle}</span>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-2.5 space-y-1.5">
                    {t.controlsList.map(([key, desc]) => (
                      <div key={key} className="flex items-center justify-between gap-2 text-[11px]">
                        <kbd className="rounded-md border border-white/15 bg-slate-900/90 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-200">
                          {key}
                        </kbd>
                        <span className="text-right font-medium text-sky-100/80">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-center text-[10px] font-medium text-sky-200/50">
                {LOCALES[lang].nav.gemsWipPill}
              </div>
            </div>
          )}
        </div>

        {/* === PINNED FOOTER ACTIONS === */}
        <div className="shrink-0 border-t border-white/10 bg-slate-950/60 p-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              sfx.playClick()
              if (!touchMode && clickToLock && onResumeAndLock) {
                onResumeAndLock()
              } else {
                onClose()
              }
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 py-2.5 text-xs font-extrabold text-white shadow hover:brightness-110 active:scale-[0.98] transition cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>{t.resume}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sfx.playClick()
              onClose()
              onOpenFeedback()
            }}
            title={t.reportTitle}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-400/35 bg-sky-500/18 text-sky-200 hover:bg-sky-500/30 active:scale-95 transition cursor-pointer"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              sfx.playClick()
              onClose()
              onLeaveToHome()
            }}
            title={t.leaveHome}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-500/18 px-3 py-2.5 text-xs font-extrabold text-rose-200 hover:bg-rose-500/30 active:scale-95 transition cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden xs:inline sm:inline">{t.leaveHome}</span>
          </button>
        </div>
      </aside>
    </div>
  )
}
