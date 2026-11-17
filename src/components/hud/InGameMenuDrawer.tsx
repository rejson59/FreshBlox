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
  Smartphone,
  Sun,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  X,
} from 'lucide-react'
import { FreshBloxLogo } from '../brand/FreshBloxBrand'
import { Lang } from '../../data/locales'
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
  onTogglePointerLock: () => void
  onChangeClickToLock: (enabled: boolean) => void
  onChangeShiftLockAlign: (enabled: boolean) => void
  onChangeMouseSensitivity: (sens: number) => void
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

const COPY = {
  pl: {
    menu: 'Menu',
    players: 'Gracze',
    settings: 'Opcje',
    lobby: 'Lobby Główne',
    obby: 'Test Obby 100',
    resume: 'Wznów',
    wardrobe: 'Szatnia',
    report: 'Zgłoś',
    invite: 'Zaproś',
    copied: 'Skopiowano',
    spawn: 'Spawn',
    respawn: 'Respawn',
    sound: 'Dźwięk',
    shortcuts: 'Skróty',
    fullscreen: 'Ekran',
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
    input: 'Tryb',
    qLow: 'N',
    qMed: 'Ś',
    qHigh: 'W',
    on: 'Wł.',
    off: 'Wył.',
    allShortcuts: 'Skróty klawiszowe',
    lockNow: 'Zablokuj mysz',
  },
  en: {
    menu: 'Menu',
    players: 'Players',
    settings: 'Options',
    lobby: 'Main Lobby',
    obby: 'Test Obby 100',
    resume: 'Resume',
    wardrobe: 'Wardrobe',
    report: 'Feedback',
    invite: 'Invite',
    copied: 'Copied',
    spawn: 'Spawn',
    respawn: 'Respawn',
    sound: 'Audio',
    shortcuts: 'Keys',
    fullscreen: 'Screen',
    toObby: 'Test Obby 100',
    toLobby: 'Main Lobby',
    leave: 'Home',
    you: 'You',
    teleport: 'Join',
    mouseLock: 'Mouse Lock',
    shiftLock: 'Shift-Lock',
    sensitivity: 'Sensitivity',
    time: 'Time',
    quality: 'Quality',
    input: 'Input',
    qLow: 'L',
    qMed: 'M',
    qHigh: 'H',
    on: 'On',
    off: 'Off',
    allShortcuts: 'Keyboard Shortcuts',
    lockNow: 'Lock Mouse',
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
  const t = COPY[lang]

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
        className="flex h-full w-[min(340px,calc(100vw-16px))] flex-col overflow-hidden border-r border-white/15 bg-[#081326]/95 text-sky-50 shadow-2xl backdrop-blur-2xl"
        style={{
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
          paddingLeft: 'env(safe-area-inset-left)',
        }}
      >
        {/* === COMPACT HEADER === */}
        <div className="shrink-0 border-b border-white/10 px-4 pt-3 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-500/15">
                <FreshBloxLogo size={24} />
              </div>
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-black text-white">
                  {worldKind === 'obby' ? t.obby : t.lobby}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-sky-200/75">
                  <span className="truncate max-w-[100px] text-white">{username}</span>
                  <span className="opacity-40">·</span>
                  <span className="font-mono text-sky-300">#{roomCode}</span>
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
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/8 text-sky-100 hover:bg-white/15 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Minimal status strip */}
          {worldKind === 'obby' && currentStage !== undefined ? (
            <div className="mt-2.5 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: difficultyColor ?? '#38BDF8' }}
              />
              <span className="font-mono text-xs font-black text-white">
                {currentStage}/100
              </span>
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
          ) : (
            <div className="mt-2.5 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-bold text-sky-200">
              <span className="inline-flex items-center gap-1.5 text-emerald-300">
                <Wifi className="h-3.5 w-3.5" />
                <span>{supabaseConnected ? onlineCount : `${onlineCount} (local)`}</span>
              </span>
              <span className="text-sky-300/80">{rankName}</span>
              {fpsDisplay !== undefined && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-sky-200/75">
                  <Gauge className="h-3 w-3 text-sky-400" />
                  {fpsDisplay}
                </span>
              )}
            </div>
          )}

          {/* 3-Tab Pill */}
          <div className="mt-2.5 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-slate-950/75 p-1">
            {(
              [
                { id: 'overview', label: t.menu, icon: Gamepad2, kbd: 'H' },
                { id: 'players', label: `${onlineCount}`, icon: Users, kbd: 'P', title: t.players },
                { id: 'settings', label: t.settings, icon: Settings, kbd: 'O' },
              ] as const
            ).map((item) => {
              const Icon = item.icon
              const active = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  title={'title' in item ? item.title : item.label}
                  onClick={() => {
                    sfx.playClick()
                    setTab(item.id)
                  }}
                  className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold transition cursor-pointer ${
                    active
                      ? 'bg-sky-500/35 text-white ring-1 ring-sky-300/45 shadow'
                      : 'text-sky-200/70 hover:bg-white/6 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                  <span className="truncate">{item.label}</span>
                  {!touchMode && (
                    <span className="font-mono text-[9px] font-bold text-sky-200/55">{item.kbd}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* === SCROLLABLE BODY === */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
          {/* TAB 1: ICON ACTION TILES */}
          {tab === 'overview' && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sfx.playClick()
                    onOpenWardrobe()
                  }}
                  className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-sky-400/30 bg-sky-500/12 py-3.5 px-2 text-[11px] font-extrabold text-white hover:bg-sky-500/22 active:scale-95 transition cursor-pointer"
                >
                  <Shirt className="h-5 w-5 text-sky-300" />
                  <span className="truncate">{t.wardrobe}</span>
                  {!touchMode && (
                    <span className="absolute top-1.5 right-2 font-mono text-[9px] text-sky-200/60">I</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sfx.playClick()
                    onClose()
                    onOpenFeedback()
                  }}
                  className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-sky-400/25 bg-white/[0.05] py-3.5 px-2 text-[11px] font-extrabold text-white hover:bg-white/12 active:scale-95 transition cursor-pointer"
                >
                  <MessageSquarePlus className="h-5 w-5 text-sky-300" />
                  <span className="truncate">{t.report}</span>
                  {!touchMode && (
                    <span className="absolute top-1.5 right-2 font-mono text-[9px] text-sky-200/60">B</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sfx.playClick()
                    onResetPosition()
                    onClose()
                  }}
                  className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] py-3.5 px-2 text-[11px] font-extrabold text-white hover:bg-white/12 active:scale-95 transition cursor-pointer"
                >
                  <RotateCcw className="h-5 w-5 text-sky-300" />
                  <span className="truncate">{worldKind === 'obby' ? t.respawn : t.spawn}</span>
                  {!touchMode && (
                    <span className="absolute top-1.5 right-2 font-mono text-[9px] text-sky-200/60">R</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onCopyInvite}
                  className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] py-3.5 px-2 text-[11px] font-extrabold text-white hover:bg-white/12 active:scale-95 transition cursor-pointer"
                >
                  {copiedInvite ? (
                    <Check className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <Share2 className="h-5 w-5 text-sky-300" />
                  )}
                  <span className="truncate">{copiedInvite ? t.copied : t.invite}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sfx.playClick()
                    onToggleSound()
                  }}
                  className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] py-3.5 px-2 text-[11px] font-extrabold text-white hover:bg-white/12 active:scale-95 transition cursor-pointer"
                >
                  {soundEnabled ? (
                    <Volume2 className="h-5 w-5 text-emerald-300" />
                  ) : (
                    <VolumeX className="h-5 w-5 text-slate-400" />
                  )}
                  <span className="truncate">{t.sound}</span>
                  {!touchMode && (
                    <span className="absolute top-1.5 right-2 font-mono text-[9px] text-sky-200/60">V</span>
                  )}
                </button>

                {!touchMode && onOpenShortcuts ? (
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick()
                      onClose()
                      onOpenShortcuts()
                    }}
                    className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] py-3.5 px-2 text-[11px] font-extrabold text-white hover:bg-white/12 active:scale-95 transition cursor-pointer"
                  >
                    <Keyboard className="h-5 w-5 text-sky-300" />
                    <span className="truncate">{t.shortcuts}</span>
                    <span className="absolute top-1.5 right-2 font-mono text-[9px] text-sky-200/60">K</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick()
                      onToggleFullscreen()
                    }}
                    className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] py-3.5 px-2 text-[11px] font-extrabold text-white hover:bg-white/12 active:scale-95 transition cursor-pointer"
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-5 w-5 text-sky-300" />
                    ) : (
                      <Maximize2 className="h-5 w-5 text-sky-300" />
                    )}
                    <span className="truncate">{t.fullscreen}</span>
                  </button>
                )}
              </div>

              {/* Switch world CTA */}
              <button
                type="button"
                onClick={() => {
                  sfx.playClick()
                  onClose()
                  onSwitchWorld()
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-300/35 bg-gradient-to-r from-sky-500 to-blue-600 py-3 px-4 text-xs font-extrabold text-white shadow-md hover:brightness-110 active:scale-[0.98] transition cursor-pointer"
              >
                {worldKind === 'lobby' ? (
                  <Flag className="h-4 w-4 text-amber-200" />
                ) : (
                  <Compass className="h-4 w-4 text-sky-100" />
                )}
                <span>{worldKind === 'lobby' ? t.toObby : t.toLobby}</span>
              </button>

              {!touchMode && !pointerLocked && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onTogglePointerLock()
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-2.5 text-xs font-bold text-sky-200 hover:bg-white/10 transition cursor-pointer"
                >
                  <Crosshair className="h-3.5 w-3.5 text-sky-300" />
                  <span>{t.lockNow}</span>
                  <kbd className="rounded border border-white/15 bg-black/30 px-1.5 py-0.5 font-mono text-[9px]">
                    Tab
                  </kbd>
                </button>
              )}
            </>
          )}

          {/* TAB 2: PLAYERS */}
          {tab === 'players' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-200/70">
                  #{roomCode} · {onlineCount}
                </span>
                <button
                  type="button"
                  onClick={onCopyInvite}
                  className="inline-flex items-center gap-1 rounded-xl border border-sky-400/30 bg-sky-500/15 px-2.5 py-1 text-[11px] font-bold text-sky-100 hover:bg-sky-500/25 cursor-pointer"
                >
                  {copiedInvite ? <Check className="h-3 w-3 text-emerald-400" /> : <Share2 className="h-3 w-3" />}
                  <span>{copiedInvite ? t.copied : t.invite}</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {roster.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          m.isSelf ? 'bg-sky-400' : 'bg-emerald-400'
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

          {/* TAB 3: COMPACT SETTINGS */}
          {tab === 'settings' && (
            <div className="space-y-2">
              {/* PC Mouse Controls */}
              {!touchMode && (
                <>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                    <span className="flex items-center gap-2 text-xs font-bold text-white">
                      <MousePointerClick className="h-4 w-4 text-sky-300" />
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
                      <Lock className="h-4 w-4 text-sky-300" />
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

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                    <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
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
                </>
              )}

              {/* Day / Night */}
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                <span className="flex items-center gap-2 text-xs font-bold text-white">
                  {worldTime === 'day' ? (
                    <Sun className="h-4 w-4 text-amber-300" />
                  ) : (
                    <Moon className="h-4 w-4 text-sky-300" />
                  )}
                  {t.time}
                  {!touchMode && <span className="font-mono text-[9px] text-sky-300/60">N</span>}
                </span>
                <div className="flex rounded-xl border border-white/10 bg-slate-950/80 p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick()
                      onChangeWorldTime('day')
                    }}
                    aria-label="Day"
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
                    aria-label="Night"
                    className={`flex h-7 w-8 items-center justify-center rounded-lg transition cursor-pointer ${
                      worldTime === 'night' ? 'bg-sky-400 text-slate-950' : 'text-sky-200/75 hover:text-white'
                    }`}
                  >
                    <Moon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

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
                      className={`h-7 w-8 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                        quality === q.id ? 'bg-sky-400 text-slate-950' : 'text-sky-200/75 hover:text-white'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compact icon toggles row: Input Mode + Fullscreen */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sfx.playClick()
                    onToggleTouchMode()
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] py-2.5 text-xs font-bold text-white hover:bg-white/12 cursor-pointer"
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
                  className="flex items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] py-2.5 text-xs font-bold text-white hover:bg-white/12 cursor-pointer"
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-3.5 w-3.5 text-sky-300" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5 text-sky-300" />
                  )}
                  <span>{t.fullscreen}</span>
                </button>
              </div>

              {!touchMode && onOpenShortcuts && (
                <button
                  type="button"
                  onClick={() => {
                    sfx.playClick()
                    onClose()
                    onOpenShortcuts()
                  }}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-bold text-sky-100 hover:bg-white/10 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Keyboard className="h-4 w-4 text-sky-300" />
                    {t.allShortcuts}
                  </span>
                  <kbd className="rounded border border-white/15 bg-black/35 px-1.5 py-0.5 font-mono text-[10px]">
                    K
                  </kbd>
                </button>
              )}
            </div>
          )}
        </div>

        {/* === PINNED FOOTER === */}
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
              onLeaveToHome()
            }}
            title={t.leave}
            aria-label={t.leave}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-500/18 text-rose-200 hover:bg-rose-500/30 active:scale-95 transition cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </div>
  )
}
