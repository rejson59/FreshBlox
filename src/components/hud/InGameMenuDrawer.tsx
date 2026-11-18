import React, { useState } from 'react'
import {
  ArrowRight,
  Check,
  CloudSnow,
  Compass,
  Crosshair,
  Disc,
  Eye,
  Flag,
  Gamepad2,
  Gauge,
  Ghost,
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
  Smartphone,
  Sparkles,
  Sun,
  Users,
  Wifi,
  X,
} from 'lucide-react'
import { FreshBloxLogo } from '../brand/FreshBloxBrand'
import { Lang } from '../../data/locales'
import { LobbyWeatherMode } from '../../lib/mousePrefs'
import { sfx } from '../../lib/sfx'
import { AudioMixerPanel } from './AudioMixerPopover'

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
  worldKind: 'lobby' | 'obby' | 'arena' | 'frisbee' | 'racing'
  lang: Lang
  roomCode: string
  username: string
  rankName: string
  onlineCount: number
  roster: InGameRosterMember[]
  fpsDisplay?: number
  currentStage?: number
  maxUnlockedStage?: number
  stageTitle?: string
  difficultyLabel?: string
  difficultyColor?: string
  touchMode: boolean
  pointerLocked: boolean
  clickToLock: boolean
  shiftLockAlign: boolean
  mouseSensitivity: number
  fov?: number
  weather?: LobbyWeatherMode
  autoDayCycle?: boolean
  showGhost?: boolean
  onTogglePointerLock: () => void
  onChangeClickToLock: (enabled: boolean) => void
  onChangeShiftLockAlign: (enabled: boolean) => void
  onChangeMouseSensitivity: (sens: number) => void
  onChangeFov?: (fov: number) => void
  onChangeWeather?: (weather: LobbyWeatherMode) => void
  onChangeAutoDayCycle?: (enabled: boolean) => void
  onChangeShowGhost?: (enabled: boolean) => void
  worldTime: MenuWorldTime
  quality: MenuQuality
  isFullscreen: boolean
  supabaseConnected: boolean
  copiedInvite: boolean
  onChangeWorldTime: (time: MenuWorldTime) => void
  onChangeQuality: (q: MenuQuality) => void
  onToggleTouchMode: () => void
  onToggleFullscreen: () => void
  onClose: () => void
  onResumeAndLock?: () => void
  onOpenWardrobe: () => void
  onCopyInvite: () => void
  onResetPosition: () => void
  onSwitchWorld: () => void
  onSwitchToArena?: () => void
  onSwitchToFrisbee?: () => void
  onLeaveToHome: () => void
  onOpenFeedback: () => void
  onTeleportToMember?: (memberId: string) => void
}

const COPY = {
  pl: {
    menu: 'Menu',
    players: 'Gracze',
    settings: 'Opcje',
    lobby: 'Lobby Główne',
    obby: 'Test Obby 100',
    arena: 'Portal Arena',
    frisbee: 'Frisbee King',
    resume: 'Wznów grę',
    wardrobe: 'Szatnia',
    report: 'Zgłoś',
    invite: 'Zaproś',
    copied: 'Skopiowano!',
    spawn: 'Spawn',
    respawn: 'Respawn',
    day: 'Dzień',
    night: 'Noc',
    shortcuts: 'Skróty',
    fullscreen: 'Pełny ekran',
    toObby: 'Test Obby 100',
    toLobby: 'Lobby Główne',
    leave: 'Wyjdź',
    you: 'Ty',
    teleport: 'Dołącz',
    mouseLock: 'Lock myszy',
    shiftLock: 'Shift-Lock',
    sensitivity: 'Czułość',
    time: 'Pora dnia',
    quality: 'Grafika',
    input: 'Sterowanie',
    qLow: 'Niska',
    qMed: 'Śred.',
    qHigh: 'Wys.',
    on: 'Wł.',
    off: 'Wył.',
    allShortcuts: 'Skróty klawiszowe',
    lockNow: 'Zablokuj mysz',
    quickActions: 'Szybkie akcje',
    switchWorld: 'Przełącz świat',
    controlsSec: 'Sterowanie i kamera',
    displaySec: 'Grafika i świat',
    roomPlayers: 'Gracze w pokoju',
    obbySub: '100 etapów parkouru',
    lobbySub: 'Hub społeczności',
    arenaSub: 'Portale i lasery 3D',
    frisbeeSub: 'Rykoszety i triki 3D',
  },
  en: {
    menu: 'Menu',
    players: 'Players',
    settings: 'Options',
    lobby: 'Main Lobby',
    obby: 'Test Obby 100',
    arena: 'Portal Arena',
    frisbee: 'Frisbee King',
    resume: 'Resume Game',
    wardrobe: 'Wardrobe',
    report: 'Feedback',
    invite: 'Invite',
    copied: 'Copied!',
    spawn: 'Spawn',
    respawn: 'Respawn',
    day: 'Day',
    night: 'Night',
    shortcuts: 'Keys',
    fullscreen: 'Fullscreen',
    toObby: 'Test Obby 100',
    toLobby: 'Main Lobby',
    leave: 'Home',
    you: 'You',
    teleport: 'Join',
    mouseLock: 'Mouse Lock',
    shiftLock: 'Shift-Lock',
    sensitivity: 'Sensitivity',
    time: 'Time of Day',
    quality: 'Graphics',
    input: 'Input',
    qLow: 'Low',
    qMed: 'Med',
    qHigh: 'High',
    on: 'On',
    off: 'Off',
    allShortcuts: 'Keyboard Shortcuts',
    lockNow: 'Lock Mouse',
    quickActions: 'Quick Actions',
    switchWorld: 'Switch World',
    controlsSec: 'Controls & Camera',
    displaySec: 'Graphics & World',
    roomPlayers: 'Players in Room',
    obbySub: '100 parkour stages',
    lobbySub: 'Social 3D hub',
    arenaSub: 'Portals & lasers 3D',
    frisbeeSub: 'Trick shots & ricochets',
  },
}

const WORLD_THEME = {
  lobby: {
    bar: 'from-sky-400 via-blue-500 to-cyan-400',
    badgeBorder: 'border-sky-400/35 bg-sky-500/15',
    tabActive: 'bg-sky-500/30 text-white ring-1 ring-sky-300/50',
    cta: 'from-sky-500 to-blue-600 shadow-sky-500/30',
    accentText: 'text-sky-300',
  },
  obby: {
    bar: 'from-emerald-400 via-sky-400 to-blue-500',
    badgeBorder: 'border-emerald-400/35 bg-emerald-500/15',
    tabActive: 'bg-emerald-500/28 text-white ring-1 ring-emerald-300/50',
    cta: 'from-emerald-500 to-sky-600 shadow-emerald-500/25',
    accentText: 'text-emerald-300',
  },
  arena: {
    bar: 'from-cyan-400 via-sky-400 to-orange-400',
    badgeBorder: 'border-cyan-400/40 bg-cyan-500/15',
    tabActive: 'bg-cyan-500/30 text-white ring-1 ring-cyan-300/50',
    cta: 'from-cyan-500 to-blue-600 shadow-cyan-500/30',
    accentText: 'text-cyan-300',
  },
  frisbee: {
    bar: 'from-orange-500 via-amber-400 to-cyan-400',
    badgeBorder: 'border-orange-400/40 bg-orange-500/15',
    tabActive: 'bg-orange-500/30 text-white ring-1 ring-orange-300/50',
    cta: 'from-orange-500 to-rose-500 shadow-orange-500/30',
    accentText: 'text-orange-300',
  },
  racing: {
    bar: 'from-cyan-400 via-blue-500 to-amber-400',
    badgeBorder: 'border-cyan-400/40 bg-cyan-500/15',
    tabActive: 'bg-cyan-500/30 text-white ring-1 ring-cyan-300/50',
    cta: 'from-cyan-500 to-blue-600 shadow-cyan-500/30',
    accentText: 'text-cyan-300',
  },
} as const

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
  difficultyColor,
  touchMode,
  pointerLocked,
  clickToLock,
  shiftLockAlign,
  mouseSensitivity,
  fov = 68,
  weather = 'clear',
  autoDayCycle = false,
  showGhost = true,
  onTogglePointerLock,
  onChangeClickToLock,
  onChangeShiftLockAlign,
  onChangeMouseSensitivity,
  onChangeFov,
  onChangeWeather,
  onChangeAutoDayCycle,
  onChangeShowGhost,
  worldTime,
  quality,
  isFullscreen,
  supabaseConnected,
  copiedInvite,
  onChangeWorldTime,
  onChangeQuality,
  onToggleTouchMode,
  onToggleFullscreen,
  onClose,
  onResumeAndLock,
  onOpenWardrobe,
  onCopyInvite,
  onResetPosition,
  onSwitchWorld,
  onSwitchToArena,
  onSwitchToFrisbee,
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
  const t = COPY[lang]
  const theme = WORLD_THEME[worldKind]

  if (!open) return null

  const progressPct = currentStage ? Math.min(100, Math.max(1, currentStage)) : 0
  const worldTitle =
    worldKind === 'obby'
      ? t.obby
      : worldKind === 'arena'
        ? t.arena
        : worldKind === 'frisbee'
          ? t.frisbee
          : t.lobby

  const tabs = [
    { id: 'overview' as const, label: t.menu, icon: Gamepad2, kbd: 'H' },
    { id: 'players' as const, label: `${t.players} (${onlineCount})`, shortLabel: `${onlineCount}`, icon: Users, kbd: 'P' },
    { id: 'settings' as const, label: t.settings, icon: Settings, kbd: 'O' },
  ]

  const handleResume = () => {
    sfx.playClick()
    if (!touchMode && clickToLock && onResumeAndLock) {
      onResumeAndLock()
    } else {
      onClose()
    }
  }

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 backdrop-blur-md"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.6rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.6rem, env(safe-area-inset-right))',
      }}
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Centered Floating Glass Game Overlay Card — adapts effortlessly to phone landscape, portrait & desktop! */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={worldTitle}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-[740px] max-h-full flex-col overflow-hidden rounded-[22px] sm:rounded-[26px] border border-white/15 bg-[#081326]/92 text-sky-50 shadow-[0_24px_80px_rgba(2,8,23,0.75)] backdrop-blur-2xl"
      >
        {/* Top Accent Glow Line */}
        <div className={`h-[3px] w-full shrink-0 bg-gradient-to-r ${theme.bar}`} />

        {/* === UNIFIED HEADER (1 sleek row on landscape/desktop, compact 2-row on narrow portrait) === */}
        <div className="shrink-0 border-b border-white/10 bg-white/[0.02] px-3.5 py-2.5 sm:px-5 sm:py-3">
          <div className="flex items-center justify-between gap-2.5">
            {/* Brand + World Identity */}
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border ${theme.badgeBorder}`}
              >
                <FreshBloxLogo size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-display text-sm sm:text-base font-black tracking-tight text-white">
                    {worldTitle}
                  </span>
                  {worldKind === 'obby' && currentStage !== undefined && (
                    <span className="hidden md:inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/8 px-2 py-0.5 font-mono text-[10px] font-black text-sky-200">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: difficultyColor ?? '#38BDF8' }} />
                      {currentStage}/100
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-200/75">
                  <span className="truncate max-w-[110px] text-white/95">{username}</span>
                  <span className="opacity-40">·</span>
                  <span className={`font-mono ${theme.accentText}`}>#{roomCode}</span>
                </div>
              </div>
            </div>

            {/* Inline 3-Tab Switcher on Landscape / Desktop (sm+) — saves vertical space! */}
            <div className="hidden sm:flex items-center gap-1 rounded-2xl border border-white/12 bg-slate-950/70 p-1">
              {tabs.map((item) => {
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
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                      active
                        ? `${theme.tabActive} shadow`
                        : 'text-sky-200/70 hover:bg-white/6 hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.id === 'players' ? item.shortLabel : item.label}</span>
                    {!touchMode && (
                      <span className="hidden md:inline font-mono text-[9px] font-bold opacity-55">
                        {item.kbd}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                sfx.playClick()
                onClose()
              }}
              aria-label={t.resume}
              className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/8 text-sky-100 hover:bg-white/16 active:scale-95 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mobile Portrait Tab Bar (< sm only) */}
          <div className="mt-2.5 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-slate-950/75 p-1 sm:hidden">
            {tabs.map((item) => {
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
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-extrabold transition cursor-pointer ${
                    active ? `${theme.tabActive} shadow` : 'text-sky-200/70 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.id === 'players' ? item.shortLabel : item.label}</span>
                </button>
              )
            })}
          </div>

          {/* Obby Progress Bar (compact inline strip when in Obby) */}
          {worldKind === 'obby' && currentStage !== undefined && (
            <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: difficultyColor ?? '#38BDF8' }}
              />
              <span className="font-mono text-[11px] font-black text-white">{currentStage}/100</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/12">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="font-mono text-[10px] font-bold text-sky-300">
                ★ {maxUnlockedStage ?? currentStage}
              </span>
            </div>
          )}
        </div>

        {/* === SCROLLABLE CONTENT BODY === */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3 sm:px-5 sm:py-4">
          {/* TAB 1: OVERVIEW — 2-column command grid on landscape/desktop, zero wasted space! */}
          {tab === 'overview' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:gap-4">
              {/* LEFT: Quick Action Tiles (6 clean tiles, all visible at once!) */}
              <div className="sm:col-span-7 flex flex-col">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-200/60">
                    {t.quickActions}
                  </span>
                  {!touchMode && !pointerLocked && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        onTogglePointerLock()
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/12 bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-sky-200 hover:bg-white/12 transition cursor-pointer"
                    >
                      <Crosshair className="h-3 w-3 text-sky-300" />
                      <span>{t.lockNow}</span>
                      <kbd className="rounded bg-black/35 px-1 font-mono text-[9px] text-sky-300">Tab</kbd>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick()
                      onOpenWardrobe()
                    }}
                    className="group relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-sky-400/28 bg-sky-500/12 py-3 px-2 text-[11px] font-extrabold text-white hover:bg-sky-500/22 active:scale-95 transition cursor-pointer"
                  >
                    <Shirt className="h-5 w-5 text-sky-300 transition-transform group-hover:scale-110" />
                    <span className="truncate max-w-full">{t.wardrobe}</span>
                    {!touchMode && (
                      <span className="absolute top-1.5 right-2 font-mono text-[9px] text-sky-200/55">I</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick()
                      onResetPosition()
                      onClose()
                    }}
                    className="group relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] py-3 px-2 text-[11px] font-extrabold text-white hover:bg-white/12 active:scale-95 transition cursor-pointer"
                  >
                    <RotateCcw className="h-5 w-5 text-sky-300 transition-transform group-hover:-rotate-45" />
                    <span className="truncate max-w-full">{worldKind === 'obby' ? t.respawn : t.spawn}</span>
                    {!touchMode && (
                      <span className="absolute top-1.5 right-2 font-mono text-[9px] text-sky-200/55">R</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={onCopyInvite}
                    className="group relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] py-3 px-2 text-[11px] font-extrabold text-white hover:bg-white/12 active:scale-95 transition cursor-pointer"
                  >
                    {copiedInvite ? (
                      <Check className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <Share2 className="h-5 w-5 text-sky-300 transition-transform group-hover:scale-110" />
                    )}
                    <span className="truncate max-w-full">{copiedInvite ? t.copied : t.invite}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleFullscreen}
                    className="group relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] py-3 px-2 text-[11px] font-extrabold text-white hover:bg-white/12 active:scale-95 transition cursor-pointer"
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-5 w-5 text-sky-300" />
                    ) : (
                      <Maximize2 className="h-5 w-5 text-sky-300 transition-transform group-hover:scale-110" />
                    )}
                    <span className="truncate max-w-full">{t.fullscreen}</span>
                    {!touchMode && (
                      <span className="absolute top-1.5 right-2 font-mono text-[9px] text-sky-200/55">F</span>
                    )}
                  </button>

                  {!touchMode && onOpenShortcuts ? (
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        onOpenShortcuts()
                      }}
                      className="group relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] py-3 px-2 text-[11px] font-extrabold text-white hover:bg-white/12 active:scale-95 transition cursor-pointer"
                    >
                      <Keyboard className="h-5 w-5 text-sky-300 transition-transform group-hover:scale-110" />
                      <span className="truncate max-w-full">{t.shortcuts}</span>
                      <span className="absolute top-1.5 right-2 font-mono text-[9px] text-sky-200/55">K</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        sfx.playClick()
                        onChangeWorldTime(worldTime === 'day' ? 'night' : 'day')
                      }}
                      className="group relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] py-3 px-2 text-[11px] font-extrabold text-white hover:bg-white/12 active:scale-95 transition cursor-pointer"
                    >
                      {worldTime === 'day' ? (
                        <Sun className="h-5 w-5 text-amber-300" />
                      ) : (
                        <Moon className="h-5 w-5 text-sky-300" />
                      )}
                      <span className="truncate max-w-full">{worldTime === 'day' ? t.day : t.night}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick()
                      onClose()
                      onOpenFeedback()
                    }}
                    className="group relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] py-3 px-2 text-[11px] font-extrabold text-white hover:bg-white/12 active:scale-95 transition cursor-pointer"
                  >
                    <MessageSquarePlus className="h-5 w-5 text-sky-300 transition-transform group-hover:scale-110" />
                    <span className="truncate max-w-full">{t.report}</span>
                    {!touchMode && (
                      <span className="absolute top-1.5 right-2 font-mono text-[9px] text-sky-200/55">B</span>
                    )}
                  </button>
                </div>
              </div>

              {/* RIGHT: Instant World Switcher Cards */}
              <div className="sm:col-span-5 flex flex-col">
                <span className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-sky-200/60">
                  {t.switchWorld}
                </span>

                <div className="flex flex-1 flex-col gap-2">
                  {/* Primary Switch World (Lobby <-> Obby) */}
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick()
                      onClose()
                      onSwitchWorld()
                    }}
                    className="group flex items-center justify-between gap-2.5 rounded-2xl border border-sky-400/30 bg-gradient-to-r from-sky-500/20 to-blue-600/20 px-3 py-2.5 text-left hover:from-sky-500/32 hover:to-blue-600/32 active:scale-[0.98] transition cursor-pointer"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/25 text-sky-200">
                        {worldKind === 'lobby' ? <Flag className="h-4 w-4 text-amber-200" /> : <Compass className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-black text-white">
                          {worldKind === 'lobby' ? t.toObby : t.toLobby}
                        </div>
                        <div className="truncate text-[10px] font-medium text-sky-200/70">
                          {worldKind === 'lobby' ? t.obbySub : t.lobbySub}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-sky-300/70 transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
                  </button>

                  {worldKind !== 'arena' && onSwitchToArena && (
                    <button
                      type="button"
                      onClick={() => {
                        sfx.playClick()
                        onClose()
                        onSwitchToArena()
                      }}
                      className="group flex items-center justify-between gap-2.5 rounded-2xl border border-cyan-400/35 bg-gradient-to-r from-cyan-500/20 via-sky-500/15 to-orange-500/20 px-3 py-2.5 text-left hover:from-cyan-500/32 hover:to-orange-500/32 active:scale-[0.98] transition cursor-pointer"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-400/25 text-cyan-200">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-black text-white">{t.arena}</div>
                          <div className="truncate text-[10px] font-medium text-cyan-100/70">{t.arenaSub}</div>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-cyan-300/75 transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
                    </button>
                  )}

                  {worldKind !== 'frisbee' && onSwitchToFrisbee && (
                    <button
                      type="button"
                      onClick={() => {
                        sfx.playClick()
                        onClose()
                        onSwitchToFrisbee()
                      }}
                      className="group flex items-center justify-between gap-2.5 rounded-2xl border border-orange-400/35 bg-gradient-to-r from-orange-500/22 to-amber-400/18 px-3 py-2.5 text-left hover:from-orange-500/35 hover:to-amber-400/30 active:scale-[0.98] transition cursor-pointer"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500/25 text-orange-200">
                          <Disc className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-black text-white">{t.frisbee}</div>
                          <div className="truncate text-[10px] font-medium text-amber-100/70">{t.frisbeeSub}</div>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-orange-300/75 transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PLAYERS — Clean 2-column responsive roster */}
          {tab === 'players' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-sky-200/70">
                  {t.roomPlayers} · #{roomCode} ({onlineCount})
                </span>
                <button
                  type="button"
                  onClick={onCopyInvite}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/35 bg-sky-500/15 px-3 py-1.5 text-[11px] font-extrabold text-sky-100 hover:bg-sky-500/25 active:scale-95 transition cursor-pointer"
                >
                  {copiedInvite ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
                  <span>{copiedInvite ? t.copied : t.invite}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {roster.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          m.isSelf ? 'bg-sky-400 shadow-[0_0_8px_#38BDF8]' : 'bg-emerald-400 shadow-[0_0_8px_#34D399]'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-white">
                          <span className="truncate">{m.username}</span>
                          {m.isSelf && (
                            <span className="rounded bg-sky-500/25 px-1.5 py-0.5 text-[9px] text-sky-200">
                              {t.you}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-medium text-sky-200/65">{m.rank}</div>
                      </div>
                    </div>

                    {m.stage !== undefined ? (
                      <span className="shrink-0 rounded-lg bg-sky-500/18 px-2 py-1 font-mono text-[11px] font-extrabold text-sky-200">
                        {m.stage}/100
                      </span>
                    ) : !m.isSelf && onTeleportToMember ? (
                      <button
                        type="button"
                        onClick={() => {
                          sfx.playClick()
                          onTeleportToMember(m.id)
                          onClose()
                        }}
                        title={t.teleport}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-400/35 bg-sky-500/20 text-sky-100 hover:bg-sky-500/35 active:scale-95 transition cursor-pointer"
                      >
                        <Navigation className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: SETTINGS — Clean 2-column layout (Controls/Camera on left, Graphics/Audio on right) */}
          {tab === 'settings' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* LEFT COLUMN: Controls, Camera & Display */}
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-200/60">
                  {t.controlsSec}
                </div>

                {/* Input Mode + Fullscreen */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick()
                      onToggleTouchMode()
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] py-2 px-2.5 text-xs font-bold text-white hover:bg-white/12 cursor-pointer"
                  >
                    <Smartphone className="h-3.5 w-3.5 text-sky-300" />
                    <span>{touchMode ? 'Touch' : 'PC'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick()
                      onToggleFullscreen()
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] py-2 px-2.5 text-xs font-bold text-white hover:bg-white/12 cursor-pointer"
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-3.5 w-3.5 text-sky-300" />
                    ) : (
                      <Maximize2 className="h-3.5 w-3.5 text-sky-300" />
                    )}
                    <span className="truncate">{t.fullscreen}</span>
                  </button>
                </div>

                {/* PC Mouse Controls */}
                {!touchMode && (
                  <>
                    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                      <span className="flex items-center gap-2 text-xs font-bold text-white">
                        <MousePointerClick className="h-3.5 w-3.5 text-sky-300" />
                        {t.mouseLock}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          sfx.playClick()
                          onChangeClickToLock(!clickToLock)
                        }}
                        className={`rounded-xl px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer ${
                          clickToLock ? 'bg-sky-400 text-slate-950' : 'bg-white/10 text-sky-200'
                        }`}
                      >
                        {clickToLock ? t.on : t.off}
                      </button>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                      <span className="flex items-center gap-2 text-xs font-bold text-white">
                        <Lock className="h-3.5 w-3.5 text-sky-300" />
                        {t.shiftLock}
                        <span className="font-mono text-[9px] text-sky-300/60">L</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          sfx.playClick()
                          onChangeShiftLockAlign(!shiftLockAlign)
                        }}
                        className={`rounded-xl px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer ${
                          shiftLockAlign ? 'bg-sky-400 text-slate-950' : 'bg-white/10 text-sky-200'
                        }`}
                      >
                        {shiftLockAlign ? t.on : t.off}
                      </button>
                    </div>
                  </>
                )}

                {/* Sensitivity Slider (works for both PC mouse and Mobile touch look!) */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <div className="mb-1 flex items-center justify-between text-xs font-bold">
                    <span className="text-sky-100">{t.sensitivity}</span>
                    <span className="font-mono text-sky-300">{mouseSensitivity.toFixed(2)}×</span>
                  </div>
                  <input
                    type="range"
                    min={0.4}
                    max={2.2}
                    step={0.05}
                    value={mouseSensitivity}
                    onChange={(e) => onChangeMouseSensitivity(parseFloat(e.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/15 accent-sky-400"
                  />
                </div>

                {/* Camera FOV Slider */}
                {onChangeFov && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                    <div className="mb-1 flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-1.5 text-sky-100">
                        <Eye className="h-3.5 w-3.5 text-sky-300" />
                        {lang === 'pl' ? 'Pole widzenia (FOV)' : 'Camera FOV'}
                      </span>
                      <span className="font-mono text-sky-300">{Math.round(fov)}°</span>
                    </div>
                    <input
                      type="range"
                      min={60}
                      max={100}
                      step={1}
                      value={fov}
                      onChange={(e) => onChangeFov(parseInt(e.target.value, 10))}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/15 accent-sky-400"
                    />
                  </div>
                )}

                {/* Quality */}
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <span className="text-xs font-bold text-white">{t.quality}</span>
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
                        className={`rounded-lg px-2 py-1 text-[10px] font-extrabold transition cursor-pointer ${
                          quality === q.id ? 'bg-sky-400 text-slate-950' : 'text-sky-200/75 hover:text-white'
                        }`}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Day / Night */}
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <span className="flex items-center gap-2 text-xs font-bold text-white">
                    {worldTime === 'day' ? (
                      <Sun className="h-3.5 w-3.5 text-amber-300" />
                    ) : (
                      <Moon className="h-3.5 w-3.5 text-sky-300" />
                    )}
                    {t.time}
                  </span>
                  <div className="flex rounded-xl border border-white/10 bg-slate-950/80 p-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        sfx.playClick()
                        onChangeWorldTime('day')
                      }}
                      aria-label={t.day}
                      className={`flex h-7 w-8 items-center justify-center rounded-lg transition cursor-pointer ${
                        worldTime === 'day' ? 'bg-sky-400 text-slate-950' : 'text-sky-200/75 hover:text-white'
                      }`}
                    >
                      <Sun className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        sfx.playClick()
                        onChangeWorldTime('night')
                      }}
                      aria-label={t.night}
                      className={`flex h-7 w-8 items-center justify-center rounded-lg transition cursor-pointer ${
                        worldTime === 'night' ? 'bg-sky-400 text-slate-950' : 'text-sky-200/75 hover:text-white'
                      }`}
                    >
                      <Moon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Audio Mixer & World-Specific Extras */}
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-200/60">
                  {t.displaySec}
                </div>

                <div className="rounded-2xl border border-sky-400/20 bg-white/[0.04] px-3 py-2.5">
                  <AudioMixerPanel lang={lang} compact />
                </div>

                {/* Obby PB Ghost toggle */}
                {worldKind === 'obby' && onChangeShowGhost && (
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                    <span className="flex items-center gap-2 text-xs font-bold text-white">
                      <Ghost className="h-3.5 w-3.5 text-cyan-300" />
                      {lang === 'pl' ? 'Duch rekordu (Ghost)' : 'PB Ghost Runner'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onChangeShowGhost(!showGhost)}
                      className={`rounded-xl px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer ${
                        showGhost ? 'bg-cyan-400 text-slate-950' : 'bg-white/10 text-sky-200'
                      }`}
                    >
                      {showGhost ? t.on : t.off}
                    </button>
                  </div>
                )}

                {/* Lobby Weather & Auto Day Cycle */}
                {worldKind === 'lobby' && onChangeWeather && (
                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <CloudSnow className="h-3.5 w-3.5 text-sky-300" />
                        {lang === 'pl' ? 'Pogoda' : 'Weather'}
                      </span>
                      <div className="flex rounded-xl border border-white/10 bg-slate-950/80 p-0.5">
                        {(
                          [
                            { id: 'clear', label: lang === 'pl' ? 'Czysto' : 'Clear' },
                            { id: 'snow', label: lang === 'pl' ? 'Śnieg' : 'Snow' },
                            { id: 'stars', label: lang === 'pl' ? 'Gwiazdy' : 'Stars' },
                          ] as const
                        ).map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => onChangeWeather(w.id)}
                            className={`rounded-lg px-2 py-1 text-[10px] font-extrabold transition cursor-pointer ${
                              weather === w.id ? 'bg-sky-400 text-slate-950' : 'text-sky-200/75 hover:text-white'
                            }`}
                          >
                            {w.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {onChangeAutoDayCycle && (
                      <div className="flex items-center justify-between border-t border-white/10 pt-1.5">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-sky-100">
                          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                          {lang === 'pl' ? 'Auto dzień / noc' : 'Auto Day/Night'}
                        </span>
                        <button
                          type="button"
                          onClick={() => onChangeAutoDayCycle(!autoDayCycle)}
                          className={`rounded-xl px-2.5 py-0.5 text-[10px] font-extrabold transition cursor-pointer ${
                            autoDayCycle ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-sky-200'
                          }`}
                        >
                          {autoDayCycle ? t.on : t.off}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {!touchMode && onOpenShortcuts && (
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick()
                      onClose()
                      onOpenShortcuts()
                    }}
                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-sky-100 hover:bg-white/10 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Keyboard className="h-3.5 w-3.5 text-sky-300" />
                      {t.allShortcuts}
                    </span>
                    <kbd className="rounded border border-white/15 bg-black/35 px-1.5 py-0.5 font-mono text-[10px]">
                      K
                    </kbd>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* === SLEEK STATUS & ACTION FOOTER === */}
        <div className="shrink-0 flex items-center justify-between gap-2.5 border-t border-white/10 bg-slate-950/65 px-3.5 py-2.5 sm:px-5 sm:py-3">
          {/* Left: Clear Exit Button + Compact Telemetry */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                sfx.playClick()
                onClose()
                onLeaveToHome()
              }}
              className="flex h-9 sm:h-10 shrink-0 items-center gap-1.5 rounded-xl border border-rose-400/35 bg-rose-500/15 px-3 text-xs font-extrabold text-rose-200 hover:bg-rose-500/28 active:scale-95 transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{t.leave}</span>
            </button>

            <div className="hidden sm:flex items-center gap-2.5 text-[11px] font-bold text-sky-200/75 truncate">
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <Wifi className="h-3.5 w-3.5" />
                {supabaseConnected ? onlineCount : `${onlineCount} local`}
              </span>
              <span className="opacity-30">•</span>
              <span className="truncate text-sky-200/90">{rankName}</span>
              {fpsDisplay !== undefined && (
                <>
                  <span className="opacity-30">•</span>
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-sky-300">
                    <Gauge className="h-3 w-3" />
                    {fpsDisplay} FPS
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right: Primary Resume CTA */}
          <button
            type="button"
            onClick={handleResume}
            className={`flex h-9 sm:h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r px-5 sm:px-7 text-xs font-black text-white shadow-lg hover:brightness-110 active:scale-[0.98] transition cursor-pointer ${theme.cta}`}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>{t.resume}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
