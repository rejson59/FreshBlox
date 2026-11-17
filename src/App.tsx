import React, { useEffect, useState } from 'react'
import {
  ArrowRight,
  Compass,
  Crown,
  FlaskConical,
  Hash,
  Inbox,
  Loader2,
  LogOut,
  MessageSquarePlus,
  Moon,
  Plus,
  ShieldCheck,
  Shirt,
  Sun,
  Users,
} from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from './data/brandTheme'
import { Lang, LOCALES } from './data/locales'
import { getRankForXp, WorldKind } from './data/catalog'
import { FreshBloxLogo, FreshBloxWordmark } from './components/brand/FreshBloxBrand'
import { getAccountRoleMeta, hasAdminAccess, usePlayerStore } from './store/usePlayerStore'
import { HomeBentoView } from './components/lobby/HomeBentoView'
import { MainLobbyWorld } from './engine/MainLobbyWorld'
import { TestObbyWorld } from './engine/TestObbyWorld'
import { AvatarEditorView } from './components/avatar/AvatarEditorView'
import { SocialProfileView } from './components/social/SocialProfileView'
import { AdminPanelView } from './components/admin/AdminPanelView'
import { FeedbackInboxView } from './components/admin/FeedbackInboxView'
import { TestLabView } from './components/tests/TestLabView'
import { AuthScreen } from './components/auth/AuthScreen'
import { FeedbackModal } from './components/feedback/FeedbackModal'
import { fetchAdminPlatformStats } from './lib/adminApi'
import { FreshLabFlags, loadLabFlags, saveLabFlags } from './lib/labFlags'
import { sfx } from './lib/sfx'
import {
  enterGameFullscreenLandscape,
  exitGameFullscreen,
  isDocumentFullscreen,
  isTouchMobileDevice,
} from './lib/mobileFullscreen'

type AppView = 'home' | 'world' | 'obby' | 'avatar' | 'social' | 'admin' | 'inbox' | 'tests'

function getInitialLaunchFromUrl(): { view: AppView; roomId: string; hasInvite: boolean } {
  if (typeof window === 'undefined') return { view: 'home', roomId: 'PUBLIC-1', hasInvite: false }
  const params = new URLSearchParams(window.location.search)
  const worldParam = params.get('world')?.toLowerCase()
  const room = params.get('room')?.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12)
  if (worldParam === 'obby') {
    return { view: 'obby', roomId: room || 'OBBY-1', hasInvite: true }
  }
  if (room) {
    return { view: 'world', roomId: room, hasInvite: true }
  }
  return { view: 'home', roomId: 'PUBLIC-1', hasInvite: false }
}

export function App() {
  const [initialLaunch] = useState(() => getInitialLaunchFromUrl())
  const [view, setView] = useState<AppView>(initialLaunch.view)
  const [activeRoomId, setActiveRoomId] = useState<string>(initialLaunch.roomId)
  const [mode, setMode] = useState<ThemeMode>('dark')
  const [lang, setLang] = useState<Lang>('pl')
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => isDocumentFullscreen())
  const [feedbackOpen, setFeedbackOpen] = useState<boolean>(false)
  const [feedbackContext, setFeedbackContext] = useState<string>('Strona główna')
  const [launcherInput, setLauncherInput] = useState<string>('')
  const [labFlags, setLabFlags] = useState<FreshLabFlags>(() => loadLabFlags())
  const [newFeedbackCount, setNewFeedbackCount] = useState<number>(0)

  const updateLabFlags = (next: FreshLabFlags) => {
    setLabFlags(next)
    saveLabFlags(next)
  }

  const {
    profile,
    authUser,
    authLoading,
    cloudStatus,
    checkDeviceRegistrationAllowed,
    signUp,
    signIn,
    signOut,
    refreshProfile,
    updatePresenceLocation,
    setUsername,
    updateAvatar,
    awardGemsAndXp,
    incrementQuest,
    claimQuest,
    recordObbyStage,
    setObbyCurrentStage,
    buyAndEquip,
    buyBundle,
    addFriend,
    refreshFriends,
    searchPlayers,
    fetchObbyLeaderboard,
  } = usePlayerStore()

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    const bg = mode === 'dark' ? '#070D19' : '#EFF6FF'
    document.documentElement.style.backgroundColor = bg
    document.body.style.backgroundColor = bg
  }, [mode])

  useEffect(() => {
    const syncFs = () => setIsFullscreen(isDocumentFullscreen())
    document.addEventListener('fullscreenchange', syncFs)
    document.addEventListener('webkitfullscreenchange', syncFs as EventListener)
    return () => {
      document.removeEventListener('fullscreenchange', syncFs)
      document.removeEventListener('webkitfullscreenchange', syncFs as EventListener)
    }
  }, [])

  // Real-time presence heartbeat in Supabase (exact location: lobby / obby / launcher)
  useEffect(() => {
    if (!authUser) return
    const loc = view === 'obby' ? 'obby' : view === 'world' ? 'lobby' : 'launcher'
    const room = view === 'world' || view === 'obby' ? activeRoomId : 'LAUNCHER'
    updatePresenceLocation(loc, room)
    const id = window.setInterval(() => {
      updatePresenceLocation(loc, room)
    }, 60_000)
    return () => window.clearInterval(id)
  }, [view, activeRoomId, updatePresenceLocation, authUser])

  // Fetch unread/new feedback badge count for Owner/Admin rail icon
  useEffect(() => {
    if (!authUser || !hasAdminAccess(profile.role)) return
    let alive = true
    const sync = () => {
      void fetchAdminPlatformStats().then((res) => {
        if (alive && res.data) {
          setNewFeedbackCount(res.data.new_feedback ?? 0)
        }
      })
    }
    sync()
    const id = window.setInterval(sync, 60_000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [authUser, profile.role])

  // Lock page scroll while inside 3D gameplay so mobile address bar / overscroll never clips HUD controls
  useEffect(() => {
    const inGame = Boolean(authUser) && (view === 'world' || view === 'obby')
    if (!inGame) return
    const prevBodyOverflow = document.body.style.overflow
    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevOverscroll = document.documentElement.style.overscrollBehavior
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.documentElement.style.overscrollBehavior = 'none'
    window.scrollTo(0, 0)
    return () => {
      document.body.style.overflow = prevBodyOverflow
      document.documentElement.style.overflow = prevHtmlOverflow
      document.documentElement.style.overscrollBehavior = prevOverscroll
    }
  }, [authUser, view])

  const tokens = getThemeTokens(mode)
  const ta = LOCALES[lang].auth
  const isDark = mode === 'dark'
  const rank = getRankForXp(profile.xp)

  // Deep Gaming Launcher Shell Colors
  const shellBg = isDark ? '#070D19' : '#EFF6FF'
  const railBg = isDark ? '#050A14' : '#E3EFFC'
  const topBarBg = isDark ? 'rgba(8, 15, 29, 0.92)' : 'rgba(248, 252, 255, 0.92)'
  const shellBorder = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(14, 165, 233, 0.18)'
  const inputBg = isDark ? 'rgba(255, 255, 255, 0.045)' : '#FFFFFF'

  const handleSignOut = async () => {
    exitGameFullscreen()
    setView('home')
    await signOut()
  }

  // 1) Wait for Supabase session check before rendering anything (prevents Home flash)
  if (authLoading) {
    return (
      <div
        className="flex min-h-dvh w-full flex-col items-center justify-center gap-4 px-4"
        style={{ background: shellBg, color: tokens.textPrimary }}
      >
        <div className="flex items-center gap-2.5">
          <FreshBloxLogo size={42} />
          <FreshBloxWordmark mode={mode} size="md" />
        </div>
        <div className="flex items-center gap-2 text-xs font-bold" style={{ color: tokens.textSecondary }}>
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: ARCTIC_SKY.skyMain }} />
          <span>{ta.checkingSession}</span>
        </div>
      </div>
    )
  }

  // 2) Mandatory Authentication Gate — Home & 3D worlds are strictly inaccessible until signed in
  if (!authUser) {
    return (
      <AuthScreen
        mode={mode}
        lang={lang}
        pendingInviteRoom={initialLaunch.hasInvite ? activeRoomId : null}
        onChangeMode={setMode}
        onToggleLang={() => setLang((l) => (l === 'pl' ? 'en' : 'pl'))}
        onCheckDeviceAllowed={checkDeviceRegistrationAllowed}
        onSignIn={signIn}
        onSignUp={signUp}
      />
    )
  }

  const isIn3DGame = view === 'world' || view === 'obby'

  const navigateView = (nextView: AppView, roomId?: string) => {
    const nextIs3D = nextView === 'world' || nextView === 'obby'
    if (nextIs3D) {
      if (roomId) setActiveRoomId(roomId)
      else if (nextView === 'obby' && !activeRoomId.startsWith('OBBY')) setActiveRoomId('OBBY-1')
      else if (nextView === 'world' && activeRoomId.startsWith('OBBY')) setActiveRoomId('PUBLIC-1')

      if (isTouchMobileDevice()) {
        enterGameFullscreenLandscape()
      }
    } else if (isIn3DGame) {
      exitGameFullscreen()
    }
    setView(nextView)
  }

  const handleEnterWorld = (world: WorldKind, roomId: string) => {
    navigateView(world === 'obby' ? 'obby' : 'world', roomId)
  }

  const handleLauncherBarSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = launcherInput
      .trim()
      .toUpperCase()
      .replace(/^#/, '')
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 12)
    if (!clean) return
    sfx.playClick()
    if (clean.startsWith('OBBY')) {
      handleEnterWorld('obby', clean)
    } else {
      handleEnterWorld('lobby', clean)
    }
    setLauncherInput('')
  }

  const handleCreatePrivateRoom = () => {
    const code = `SKY-${Math.floor(100 + Math.random() * 900)}`
    sfx.playClick()
    handleEnterWorld('lobby', code)
  }

  const openFeedback = (customContext?: string) => {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      try {
        document.exitPointerLock()
      } catch {
        // ignore
      }
    }
    if (customContext) {
      setFeedbackContext(customContext)
    } else if (view === 'avatar') {
      setFeedbackContext(lang === 'pl' ? 'Szatnia R6' : 'Avatar Wardrobe')
    } else if (view === 'social') {
      setFeedbackContext(lang === 'pl' ? 'Społeczność / Profil' : 'Social / Profile')
    } else if (view === 'admin') {
      setFeedbackContext(lang === 'pl' ? 'Panel Admina' : 'Admin Panel')
    } else if (view === 'inbox') {
      setFeedbackContext(lang === 'pl' ? 'Lista zgłoszeń' : 'Feedback Inbox')
    } else if (view === 'tests') {
      setFeedbackContext(lang === 'pl' ? 'Testy' : 'Test Lab')
    } else {
      setFeedbackContext(lang === 'pl' ? 'Odkrywaj' : 'Discover')
    }
    setFeedbackOpen(true)
  }

  const isStaff = hasAdminAccess(profile.role)
  const roleMeta = getAccountRoleMeta(profile.role, lang)

  const handleLaunchObbyStage = (stage: number) => {
    const clamped = Math.max(1, Math.min(100, stage))
    setObbyCurrentStage(clamped)
    handleEnterWorld('obby', 'OBBY-DEV')
  }

  const navItems: Array<{
    id: AppView
    label: string
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
    accent?: string
    badge?: number
  }> = [
    { id: 'home', label: lang === 'pl' ? 'Odkrywaj' : 'Discover', icon: Compass },
    { id: 'avatar', label: lang === 'pl' ? 'Szatnia R6' : 'Wardrobe', icon: Shirt },
    { id: 'social', label: lang === 'pl' ? 'Profil i Znajomi' : 'Profile', icon: Users },
  ]

  const staffNavItems: Array<{
    id: AppView
    label: string
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
    accent: string
    badge?: number
  }> = isStaff
    ? [
        { id: 'admin', label: lang === 'pl' ? 'Panel Admina' : 'Admin Panel', icon: ShieldCheck, accent: '#F59E0B' },
        {
          id: 'inbox',
          label: lang === 'pl' ? 'Lista zgłoszeń' : 'Feedback Inbox',
          icon: Inbox,
          accent: '#38BDF8',
          badge: newFeedbackCount,
        },
        { id: 'tests', label: lang === 'pl' ? 'Testy' : 'Test Lab', icon: FlaskConical, accent: '#34D399' },
      ]
    : []

  const allNavItems = [...navItems, ...staffNavItems]

  // Fullscreen 3D World Mode (zero shell chrome — 100% gameplay viewport)
  if (isIn3DGame) {
    return (
      <div className="min-h-dvh w-full max-w-full overflow-hidden" style={{ background: '#050C1B' }}>
        {view === 'world' && (
          <MainLobbyWorld
            roomCode={activeRoomId}
            lang={lang}
            playerId={profile.playerId}
            authUserId={authUser.id}
            username={profile.username}
            freshGems={profile.freshGems}
            xp={profile.xp}
            avatar={profile.avatar}
            unlockedOutfits={profile.unlockedOutfits}
            unlockedHats={profile.unlockedHats}
            unlockedFaces={profile.unlockedFaces}
            isFullscreen={isFullscreen}
            onBackHome={() => navigateView('home')}
            onEnterObby={() => handleEnterWorld('obby', 'OBBY-1')}
            onBuyAndEquip={buyAndEquip}
            onBuyBundle={buyBundle}
            onSkinChange={(hex) => updateAvatar({ skinColor: hex })}
            onChatSent={() => incrementQuest('q_chat', 1)}
            onEmoteUsed={() => incrementQuest('q_emote', 1)}
            onJumpPadUsed={() => incrementQuest('q_jumppad', 1)}
            onReachTerrace={() => {
              awardGemsAndXp(0, 50)
              incrementQuest('q_tower', 1)
            }}
            feedbackOpen={feedbackOpen}
            onOpenFeedback={openFeedback}
          />
        )}

        {view === 'obby' && (
          <TestObbyWorld
            roomCode={activeRoomId}
            lang={lang}
            playerId={profile.playerId}
            authUserId={authUser.id}
            username={profile.username}
            freshGems={profile.freshGems}
            xp={profile.xp}
            avatar={profile.avatar}
            unlockedOutfits={profile.unlockedOutfits}
            unlockedHats={profile.unlockedHats}
            unlockedFaces={profile.unlockedFaces}
            initialStage={profile.obbyStage}
            bestStage={isStaff && labFlags.unlockAllObbyStages ? 100 : profile.obbyBestStage}
            completions={profile.obbyCompletions}
            isFullscreen={isFullscreen}
            onBackHome={() => navigateView('home')}
            onSwitchToLobby={() => handleEnterWorld('lobby', 'PUBLIC-1')}
            onBuyAndEquip={buyAndEquip}
            onBuyBundle={buyBundle}
            onSkinChange={(hex) => updateAvatar({ skinColor: hex })}
            onStageReached={recordObbyStage}
            onSetCurrentStage={setObbyCurrentStage}
            onChatSent={() => incrementQuest('q_chat', 1)}
            onEmoteUsed={() => incrementQuest('q_emote', 1)}
            onJumpPadUsed={() => incrementQuest('q_jumppad', 1)}
            feedbackOpen={feedbackOpen}
            onOpenFeedback={openFeedback}
          />
        )}

        <FeedbackModal
          open={feedbackOpen}
          mode={mode}
          lang={lang}
          userId={authUser.id}
          username={profile.username}
          contextLabel={feedbackContext}
          onClose={() => setFeedbackOpen(false)}
        />
      </div>
    )
  }

  // Native Gaming Platform / Launcher App Shell (Desktop Left Rail + Top Bar + Full Viewport)
  return (
    <div
      className="flex h-dvh w-full max-w-full overflow-hidden transition-colors duration-200"
      style={{ background: shellBg, color: tokens.textPrimary }}
    >
      {/* === DESKTOP LEFT ICON RAIL (68px native launcher sidebar) === */}
      <aside
        className="hidden lg:flex w-[68px] shrink-0 flex-col items-center justify-between border-r py-3 select-none"
        style={{ background: railBg, borderColor: shellBorder }}
      >
        <div className="flex w-full flex-col items-center gap-3">
          {/* Brand App Emblem */}
          <button
            type="button"
            onClick={() => {
              sfx.playClick()
              navigateView('home')
            }}
            className="flex h-11 w-11 items-center justify-center rounded-xl transition hover:scale-105 active:scale-95 cursor-pointer"
            style={{
              background: isDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(14, 165, 233, 0.12)',
              border: `1px solid ${ARCTIC_SKY.skyMain}35`,
            }}
            title="FreshBlox"
          >
            <FreshBloxLogo size={28} />
          </button>

          <div className="h-px w-8" style={{ background: shellBorder }} />

          {/* Main Platform Destinations */}
          <nav className="flex w-full flex-col items-center gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = view === item.id
              const accent = item.accent ?? ARCTIC_SKY.skyMain
              return (
                <div key={item.id} className="relative flex w-full items-center justify-center">
                  {/* Left sharp active indicator pill */}
                  {active && (
                    <span
                      className="absolute left-0 h-6 w-[3px] rounded-r-full"
                      style={{ background: accent }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick()
                      navigateView(item.id)
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border transition-all hover:scale-105 cursor-pointer"
                    style={{
                      background: active ? `${accent}20` : 'transparent',
                      borderColor: active ? `${accent}50` : 'transparent',
                      color: active ? accent : tokens.textSecondary,
                    }}
                    title={item.label}
                    aria-label={item.label}
                  >
                    <Icon className="h-[19px] w-[19px]" />
                  </button>
                </div>
              )
            })}
          </nav>

          {/* Owner / Admin Exclusive Rail Section (Admin Panel + Test Lab) */}
          {staffNavItems.length > 0 && (
            <>
              <div className="h-px w-8" style={{ background: shellBorder }} />
              <nav className="flex w-full flex-col items-center gap-1.5">
                {staffNavItems.map((item) => {
                  const Icon = item.icon
                  const active = view === item.id
                  const accent = item.accent
                  return (
                    <div key={item.id} className="relative flex w-full items-center justify-center">
                      {active && (
                        <span
                          className="absolute left-0 h-6 w-[3px] rounded-r-full"
                          style={{ background: accent }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => navigateView(item.id)}
                        className="relative flex h-11 w-11 items-center justify-center rounded-xl border transition-all hover:scale-105 cursor-pointer"
                        style={{
                          background: active ? `${accent}24` : `${accent}0D`,
                          borderColor: active ? `${accent}58` : `${accent}28`,
                          color: accent,
                        }}
                        title={item.label}
                        aria-label={item.label}
                      >
                        <Icon className="h-[19px] w-[19px]" />
                        {typeof item.badge === 'number' && item.badge > 0 && (
                          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 font-mono text-[9px] font-black text-white shadow">
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        )}
                      </button>
                    </div>
                  )
                })}
              </nav>
            </>
          )}
        </div>

        {/* Bottom Utility Dock (Feedback, Theme, Lang, Sign Out) */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => openFeedback()}
            className="flex h-9 w-9 items-center justify-center rounded-xl border transition hover:scale-105 cursor-pointer"
            style={{
              borderColor: `${ARCTIC_SKY.skyMain}38`,
              background: `${ARCTIC_SKY.skyMain}14`,
              color: ARCTIC_SKY.skyMain,
            }}
            title={lang === 'pl' ? 'Zgłoś błąd / pomysł' : 'Feedback'}
            aria-label="Feedback"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              sfx.playClick()
              setMode((m) => (m === 'dark' ? 'light' : 'dark'))
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl border transition hover:scale-105 cursor-pointer"
            style={{ borderColor: shellBorder, background: inputBg, color: tokens.textSecondary }}
            title={mode === 'dark' ? 'Light mode' : 'Dark mode'}
            aria-label="Toggle theme"
          >
            {mode === 'dark' ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4 text-sky-600" />}
          </button>

          <button
            type="button"
            onClick={() => {
              sfx.playClick()
              setLang((l) => (l === 'pl' ? 'en' : 'pl'))
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl border font-mono text-[10px] font-extrabold transition hover:scale-105 cursor-pointer"
            style={{ borderColor: shellBorder, background: inputBg, color: tokens.textPrimary }}
            title="Language"
          >
            {lang.toUpperCase()}
          </button>

          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="flex h-9 w-9 items-center justify-center rounded-xl border transition hover:bg-rose-500/15 hover:text-rose-400 cursor-pointer"
            style={{ borderColor: shellBorder, background: inputBg, color: tokens.textSecondary }}
            title={ta.logout}
            aria-label={ta.logout}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* === RIGHT WORKSPACE COLUMN (TOP LAUNCHER BAR + FULL VIEWPORT) === */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Compact Native Launcher Top Bar */}
        <header
          className="z-20 flex h-13 shrink-0 items-center justify-between gap-2.5 border-b px-3 sm:px-5 backdrop-blur-xl"
          style={{ background: topBarBg, borderColor: shellBorder }}
        >
          {/* Left: Brand Wordmark + Quick Room / Search Launcher Input */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => navigateView('home')}
              className="flex shrink-0 items-center gap-1.5 cursor-pointer"
            >
              <FreshBloxLogo size={24} className="lg:hidden shrink-0" />
              <FreshBloxWordmark mode={mode} size="sm" className="w-[86px] sm:w-[98px] h-auto shrink-0" />
            </button>

            <div className="hidden h-5 w-px sm:block" style={{ background: shellBorder }} />

            {/* Launcher Room Join / Filter Bar */}
            <form
              onSubmit={handleLauncherBarSubmit}
              className="hidden sm:flex min-w-0 max-w-xs flex-1 items-center gap-1 rounded-xl border px-2.5 py-1"
              style={{ background: inputBg, borderColor: shellBorder }}
            >
              <Hash className="h-3.5 w-3.5 shrink-0" style={{ color: tokens.textSecondary }} />
              <input
                value={launcherInput}
                onChange={(e) => setLauncherInput(e.target.value)}
                placeholder={lang === 'pl' ? 'Szukaj lub kod pokoju...' : 'Search or room code...'}
                className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none placeholder:opacity-60"
                style={{ color: tokens.textPrimary }}
              />
              {launcherInput.trim() && (
                <button
                  type="submit"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white transition hover:brightness-110 cursor-pointer"
                  style={{ background: ARCTIC_SKY.skyMain }}
                  title={lang === 'pl' ? 'Dołącz do pokoju' : 'Join room'}
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </form>

            {/* Quick Private Room Button */}
            <button
              type="button"
              onClick={handleCreatePrivateRoom}
              className="hidden md:inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-extrabold transition hover:brightness-110 cursor-pointer"
              style={{
                borderColor: shellBorder,
                background: inputBg,
                color: tokens.textPrimary,
              }}
              title={lang === 'pl' ? 'Utwórz prywatny pokój' : 'Create private room'}
            >
              <Plus className="h-3.5 w-3.5 text-sky-400" />
              <span>{lang === 'pl' ? 'Pokój' : 'Room'}</span>
            </button>
          </div>

          {/* Right: Compact Player Pill + Mobile quick icons */}
          <div className="flex shrink-0 items-center gap-1.5">
            {/* Mobile-only quick tools (hidden on desktop because they live in Left Rail) */}
            <button
              type="button"
              onClick={() => openFeedback()}
              className="flex lg:hidden h-8 w-8 items-center justify-center rounded-xl border cursor-pointer"
              style={{
                borderColor: `${ARCTIC_SKY.skyMain}38`,
                background: `${ARCTIC_SKY.skyMain}14`,
                color: ARCTIC_SKY.skyMain,
              }}
              aria-label="Feedback"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setMode((m) => (m === 'dark' ? 'light' : 'dark'))}
              className="flex lg:hidden h-8 w-8 items-center justify-center rounded-xl border cursor-pointer"
              style={{ borderColor: shellBorder, background: inputBg, color: tokens.textSecondary }}
              aria-label="Toggle theme"
            >
              {mode === 'dark' ? <Sun className="h-3.5 w-3.5 text-amber-300" /> : <Moon className="h-3.5 w-3.5 text-sky-600" />}
            </button>

            <button
              type="button"
              onClick={() => setLang((l) => (l === 'pl' ? 'en' : 'pl'))}
              className="flex lg:hidden h-8 min-w-8 items-center justify-center rounded-xl border px-1.5 font-mono text-[10px] font-extrabold cursor-pointer"
              style={{ borderColor: shellBorder, background: inputBg, color: tokens.textPrimary }}
            >
              {lang.toUpperCase()}
            </button>

            {/* Active Player Launcher Chip */}
            <button
              type="button"
              onClick={() => {
                navigateView('social')
              }}
              className="flex h-8 items-center gap-2 rounded-xl border px-2.5 text-xs font-extrabold transition hover:brightness-110 cursor-pointer"
              style={{
                borderColor:
                  profile.role === 'owner'
                    ? roleMeta.border
                    : view === 'social'
                      ? `${ARCTIC_SKY.skyMain}55`
                      : shellBorder,
                background: inputBg,
                color: tokens.textPrimary,
              }}
              title={`${profile.username} · ${roleMeta.label} · ${rank.name}`}
            >
              {profile.role === 'owner' ? (
                <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" />
              ) : (
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              )}
              <span className="max-w-[84px] sm:max-w-[120px] truncate">{profile.username}</span>
              {profile.role !== 'player' && (
                <span
                  className="hidden md:inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                  style={{
                    background: roleMeta.bg,
                    borderColor: roleMeta.border,
                    color: roleMeta.color,
                  }}
                >
                  {roleMeta.label}
                </span>
              )}
              <span
                className="hidden sm:inline-flex rounded-md px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-sky-400"
                style={{ background: `${ARCTIC_SKY.skyMain}18` }}
              >
                {profile.xp} XP
              </span>
            </button>

            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="flex lg:hidden h-8 w-8 items-center justify-center rounded-xl border hover:text-rose-400 cursor-pointer"
              style={{ borderColor: shellBorder, background: inputBg, color: tokens.textSecondary }}
              title={ta.logout}
              aria-label={ta.logout}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        {/* Scrollable Full-Width Platform Content Area */}
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-clip pb-16 lg:pb-0">
          {view === 'home' && (
            <HomeBentoView
              profile={profile}
              mode={mode}
              lang={lang}
              searchQuery={launcherInput}
              onEnterWorld={handleEnterWorld}
              onOpenAvatar={() => navigateView('avatar')}
              onOpenProfile={() => navigateView('social')}
              onClaimQuest={claimQuest}
              onFetchLeaderboard={fetchObbyLeaderboard}
            />
          )}

          {view === 'avatar' && (
            <AvatarEditorView
              profile={profile}
              mode={mode}
              lang={lang}
              onBuyAndEquip={buyAndEquip}
              onBuyBundle={buyBundle}
              onSkinChange={(hex) => updateAvatar({ skinColor: hex })}
              onEnterLobby={() => handleEnterWorld('lobby', 'PUBLIC-1')}
            />
          )}

          {view === 'social' && (
            <SocialProfileView
              profile={profile}
              cloudStatus={cloudStatus}
              mode={mode}
              lang={lang}
              onChangeUsername={setUsername}
              onAddFriend={addFriend}
              onRefreshFriends={refreshFriends}
              onSearchPlayers={searchPlayers}
              onJoinWorld={handleEnterWorld}
              onSignOut={handleSignOut}
            />
          )}

          {view === 'admin' && isStaff && (
            <AdminPanelView
              profile={profile}
              mode={mode}
              lang={lang}
              onRefreshSelf={refreshProfile}
            />
          )}

          {view === 'inbox' && isStaff && (
            <FeedbackInboxView
              profile={profile}
              mode={mode}
              lang={lang}
              onNewCountChange={setNewFeedbackCount}
            />
          )}

          {view === 'tests' && isStaff && (
            <TestLabView
              profile={profile}
              mode={mode}
              lang={lang}
              flags={labFlags}
              onChangeFlags={updateLabFlags}
              onLaunchObbyStage={handleLaunchObbyStage}
              onEnterWorld={handleEnterWorld}
            />
          )}
        </main>
      </div>

      {/* === MOBILE BOTTOM APP BAR (native app style) === */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t pt-1.5 backdrop-blur-xl lg:hidden"
        style={{
          background: topBarBg,
          borderColor: shellBorder,
          paddingBottom: 'max(0.45rem, env(safe-area-inset-bottom))',
        }}
      >
        {allNavItems.map((item) => {
          const Icon = item.icon
          const active = view === item.id
          const accent = item.accent ?? ARCTIC_SKY.skyMain
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                navigateView(item.id)
              }}
              className="relative flex flex-col items-center gap-0.5 px-2.5 py-1.5 cursor-pointer"
              style={{ color: active ? accent : tokens.textSecondary }}
              aria-label={item.label}
            >
              {active && (
                <span
                  className="absolute -top-1.5 h-[2.5px] w-6 rounded-full"
                  style={{ background: accent }}
                />
              )}
              <Icon className="h-[19px] w-[19px]" />
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-500 px-1 font-mono text-[8px] font-black text-white">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <FeedbackModal
        open={feedbackOpen}
        mode={mode}
        lang={lang}
        userId={authUser.id}
        username={profile.username}
        contextLabel={feedbackContext}
        onClose={() => setFeedbackOpen(false)}
      />
    </div>
  )
}

export default App
