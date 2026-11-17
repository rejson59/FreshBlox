import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Bell,
  Compass,
  Crown,
  FlaskConical,
  Hash,
  Inbox,
  Lock,
  LogOut,
  MessageSquarePlus,
  Palette,
  ShieldCheck,
  Shirt,
  Users,
} from 'lucide-react'
import {
  applyThemeCssVars,
  FRESH_THEMES,
  getThemePreset,
  getThemeTokens,
  loadThemePreset,
  saveThemePreset,
  ThemeMode,
  ThemePresetId,
} from './data/brandTheme'
import { Lang, LOCALES } from './data/locales'
import { getRankForXp, WorldKind } from './data/catalog'
import { FreshBloxLogo, FreshBloxWordmark } from './components/brand/FreshBloxBrand'
import { getAccountRoleMeta, hasAdminAccess, usePlayerStore } from './store/usePlayerStore'
import { HomeBentoView } from './components/lobby/HomeBentoView'
import { MainLobbyWorld } from './engine/MainLobbyWorld'
import { TestObbyWorld } from './engine/TestObbyWorld'
import { PortalArenaWorld } from './engine/PortalArenaWorld'
import { FrisbeeKingWorld } from './engine/FrisbeeKingWorld'
import { AvatarEditorView } from './components/avatar/AvatarEditorView'
import { SocialProfileView } from './components/social/SocialProfileView'
import { AdminPanelView } from './components/admin/AdminPanelView'
import { FeedbackInboxView } from './components/admin/FeedbackInboxView'
import { TestLabView } from './components/tests/TestLabView'
import { FreshLoaderAnimation } from './components/loading/FreshLoaders'
import { WorldTransitionOverlay } from './components/loading/WorldTransitionOverlay'
import { PartyBarModal } from './components/social/PartyBarModal'
import { PrivateRoomModal } from './components/lobby/PrivateRoomModal'
import { NotificationsPopover } from './components/hud/NotificationsPopover'
import { AudioMixerPopover } from './components/hud/AudioMixerPopover'
import { AuthScreen } from './components/auth/AuthScreen'
import { FeedbackModal } from './components/feedback/FeedbackModal'
import { fetchAdminPlatformStats, fetchWorldLiveStats } from './lib/adminApi'
import { fetchUserNotifications, UserNotificationItem } from './lib/socialApi'
import { generatePartyCode, PartyMember, PartySessionClient } from './lib/partyClient'
import { FreshLabFlags, loadLabFlags, saveLabFlags } from './lib/labFlags'
import { sfx } from './lib/sfx'
import {
  enterGameFullscreenLandscape,
  exitGameFullscreen,
  isDocumentFullscreen,
  isTouchMobileDevice,
} from './lib/mobileFullscreen'

type AppView = 'home' | 'world' | 'obby' | 'arena' | 'frisbee' | 'avatar' | 'social' | 'admin' | 'inbox' | 'tests'

function getInitialLaunchFromUrl(): { view: AppView; roomId: string; hasInvite: boolean } {
  if (typeof window === 'undefined') return { view: 'home', roomId: 'PUBLIC-1', hasInvite: false }
  const params = new URLSearchParams(window.location.search)
  const worldParam = params.get('world')?.toLowerCase()
  const room = params.get('room')?.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12)
  if (worldParam === 'frisbee') {
    return { view: 'frisbee', roomId: room || 'FRISBEE-1', hasInvite: true }
  }
  if (worldParam === 'arena') {
    return { view: 'arena', roomId: room || 'ARENA-1', hasInvite: true }
  }
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
  const [themePreset, setThemePreset] = useState<ThemePresetId>(() => loadThemePreset())
  const [themePickerOpen, setThemePickerOpen] = useState<boolean>(false)
  const activeTheme = getThemePreset(themePreset)
  const mode: ThemeMode = activeTheme.mode
  const setMode = (next: ThemeMode | ((prev: ThemeMode) => ThemeMode)) => {
    const resolved = typeof next === 'function' ? next(mode) : next
    const targetPreset: ThemePresetId =
      resolved === 'light' ? 'nordic-frost' : themePreset === 'nordic-frost' ? 'arctic-sky' : themePreset
    setThemePreset(targetPreset)
    saveThemePreset(targetPreset)
  }
  const selectThemePreset = (id: ThemePresetId) => {
    setThemePreset(id)
    saveThemePreset(id)
    setThemePickerOpen(false)
  }

  const [lang, setLang] = useState<Lang>('pl')
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => isDocumentFullscreen())
  const [feedbackOpen, setFeedbackOpen] = useState<boolean>(false)
  const [feedbackContext, setFeedbackContext] = useState<string>('Strona główna')
  const [launcherInput, setLauncherInput] = useState<string>('')
  const [labFlags, setLabFlags] = useState<FreshLabFlags>(() => loadLabFlags())
  const [newFeedbackCount, setNewFeedbackCount] = useState<number>(0)
  const [worldTransition, setWorldTransition] = useState<{
    world: WorldKind
    room: string
    fading: boolean
    onlineCount: number | null
  } | null>(null)

  // U-08: Private Room modal
  const [privateRoomOpen, setPrivateRoomOpen] = useState<boolean>(false)
  const [privateRoomDefaultWorld, setPrivateRoomDefaultWorld] = useState<WorldKind>('lobby')

  // U-02: Party / Squad state
  const [partyModalOpen, setPartyModalOpen] = useState<boolean>(false)
  const [partyCode, setPartyCode] = useState<string | null>(null)
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([])
  const [partyIsLeader, setPartyIsLeader] = useState<boolean>(false)
  const partyClientRef = useRef<PartySessionClient | null>(null)

  // U-14: Notifications Center + DM deep-link
  const [notifOpen, setNotifOpen] = useState<boolean>(false)
  const [notifications, setNotifications] = useState<UserNotificationItem[]>([])
  const [notifLoading, setNotifLoading] = useState<boolean>(false)
  const [initialDmUsername, setInitialDmUsername] = useState<string | null>(null)

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
    setPinnedBadge,
    saveOutfitSlot,
    deleteOutfitSlot,
    recordObbySpeedrun,
    incrementQuest,
    claimQuest,
    recordObbyStage,
    setObbyCurrentStage,
    recordArenaProgress,
    recordFrisbeeProgress,
    setClanInfo,
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
    const th = getThemePreset(themePreset)
    applyThemeCssVars(themePreset)
    document.documentElement.style.backgroundColor = th.shellBg
    document.body.style.backgroundColor = th.shellBg
  }, [themePreset])

  // U-14: Fetch notifications periodically
  const loadNotifications = useCallback(async () => {
    if (!authUser) return
    setNotifLoading(true)
    const items = await fetchUserNotifications(authUser.id, lang)
    setNotifications(items)
    setNotifLoading(false)
  }, [authUser, lang])

  useEffect(() => {
    if (!authUser) return
    void loadNotifications()
    const id = window.setInterval(() => void loadNotifications(), 35_000)
    return () => window.clearInterval(id)
  }, [authUser, loadNotifications])

  // U-02: Party cleanup on unmount
  useEffect(() => {
    return () => {
      partyClientRef.current?.disconnect()
      partyClientRef.current = null
    }
  }, [])

  useEffect(() => {
    const syncFs = () => setIsFullscreen(isDocumentFullscreen())
    document.addEventListener('fullscreenchange', syncFs)
    document.addEventListener('webkitfullscreenchange', syncFs as EventListener)
    return () => {
      document.removeEventListener('fullscreenchange', syncFs)
      document.removeEventListener('webkitfullscreenchange', syncFs as EventListener)
    }
  }, [])

  // Real-time presence heartbeat in Supabase (exact location: lobby / obby / arena / frisbee / launcher)
  useEffect(() => {
    if (!authUser) return
    const loc =
      view === 'frisbee'
        ? 'frisbee'
        : view === 'arena'
          ? 'arena'
          : view === 'obby'
            ? 'obby'
            : view === 'world'
              ? 'lobby'
              : 'launcher'
    const room =
      view === 'world' || view === 'obby' || view === 'arena' || view === 'frisbee' ? activeRoomId : 'LAUNCHER'
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

  // Smooth 3D world loading overlay combining L-02 + W-01 + W-02 + W-03 with real player count
  useEffect(() => {
    if (!authUser || (view !== 'world' && view !== 'obby' && view !== 'arena' && view !== 'frisbee')) {
      setWorldTransition(null)
      return
    }
    const worldKind: WorldKind =
      view === 'frisbee' ? 'frisbee' : view === 'arena' ? 'arena' : view === 'obby' ? 'obby' : 'lobby'
    let alive = true
    setWorldTransition({ world: worldKind, room: activeRoomId, fading: false, onlineCount: null })
    void fetchWorldLiveStats().then((stats) => {
      if (!alive || !stats) return
      const cnt =
        worldKind === 'frisbee'
          ? Math.max(1, stats.frisbee_online ?? 1)
          : worldKind === 'arena'
            ? Math.max(1, stats.arena_online)
            : worldKind === 'obby'
              ? Math.max(1, stats.obby_online)
              : Math.max(1, stats.lobby_online)
      setWorldTransition((prev) => (prev ? { ...prev, onlineCount: cnt } : null))
    })
    const tFade = window.setTimeout(() => {
      setWorldTransition((prev) => (prev ? { ...prev, fading: true } : null))
    }, 640)
    const tClear = window.setTimeout(() => {
      setWorldTransition(null)
    }, 940)
    return () => {
      alive = false
      window.clearTimeout(tFade)
      window.clearTimeout(tClear)
    }
  }, [authUser, view, activeRoomId])

  // Lock page scroll while inside 3D gameplay so mobile address bar / overscroll never clips HUD controls
  useEffect(() => {
    const inGame =
      Boolean(authUser) && (view === 'world' || view === 'obby' || view === 'arena' || view === 'frisbee')
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

  // Deep Gaming Launcher Shell Colors driven by selected Theme Preset (T-01..T-06)
  const shellBg = activeTheme.shellBg
  const railBg = activeTheme.railBg
  const topBarBg = activeTheme.topBarBg
  const shellBorder = activeTheme.border
  const inputBg = isDark ? 'rgba(255, 255, 255, 0.045)' : '#FFFFFF'
  const themeAccent = activeTheme.accent

  const handleSignOut = async () => {
    partyClientRef.current?.disconnect()
    partyClientRef.current = null
    setPartyCode(null)
    setPartyMembers([])
    setPartyIsLeader(false)
    exitGameFullscreen()
    setView('home')
    await signOut()
  }

  // 1) Wait for Supabase session check before rendering anything (prevents Home flash)
  if (authLoading) {
    return (
      <div
        className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 px-4"
        style={{ background: shellBg, color: tokens.textPrimary }}
      >
        <div className="flex items-center gap-2.5">
          <FreshBloxLogo size={42} />
          <FreshBloxWordmark mode={mode} size="md" />
        </div>
        <div className="flex h-20 w-20 items-center justify-center">
          <FreshLoaderAnimation id={labFlags.loaderPreset} size="md" mode={mode} />
        </div>
        <div className="text-xs font-bold tracking-wide" style={{ color: tokens.textSecondary }}>
          {ta.checkingSession}
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

  const isIn3DGame = view === 'world' || view === 'obby' || view === 'arena' || view === 'frisbee'

  const navigateView = (nextView: AppView, roomId?: string) => {
    const nextIs3D = nextView === 'world' || nextView === 'obby' || nextView === 'arena' || nextView === 'frisbee'
    if (nextIs3D) {
      if (roomId) setActiveRoomId(roomId)
      else if (nextView === 'frisbee' && !activeRoomId.startsWith('FRISBEE')) setActiveRoomId('FRISBEE-1')
      else if (nextView === 'arena' && !activeRoomId.startsWith('ARENA')) setActiveRoomId('ARENA-1')
      else if (nextView === 'obby' && !activeRoomId.startsWith('OBBY')) setActiveRoomId('OBBY-1')
      else if (
        nextView === 'world' &&
        (activeRoomId.startsWith('OBBY') || activeRoomId.startsWith('ARENA') || activeRoomId.startsWith('FRISBEE'))
      )
        setActiveRoomId('PUBLIC-1')

      if (isTouchMobileDevice()) {
        enterGameFullscreenLandscape()
      }
    } else if (isIn3DGame) {
      exitGameFullscreen()
    }
    setView(nextView)
  }

  const handleEnterWorld = (world: WorldKind, roomId: string) => {
    navigateView(
      world === 'frisbee' ? 'frisbee' : world === 'arena' ? 'arena' : world === 'obby' ? 'obby' : 'world',
      roomId,
    )
  }

  // U-02: Party / Squad realtime session handlers
  const connectToParty = (code: string, asLeader: boolean) => {
    partyClientRef.current?.disconnect()
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 14)
    if (!clean) return
    const client = new PartySessionClient({
      code: clean,
      selfId: profile.playerId,
      selfUsername: profile.username,
      isLeader: asLeader,
      onMembersChange: (members) => setPartyMembers(members),
      onLaunch: (world, roomCode) => {
        handleEnterWorld(world, roomCode)
      },
    })
    client.connect()
    partyClientRef.current = client
    setPartyCode(clean)
    setPartyIsLeader(asLeader)
  }

  const handleCreateParty = () => {
    connectToParty(generatePartyCode(), true)
  }

  const handleJoinParty = (code: string) => {
    connectToParty(code, false)
  }

  const handleLeaveParty = () => {
    partyClientRef.current?.disconnect()
    partyClientRef.current = null
    setPartyCode(null)
    setPartyMembers([])
    setPartyIsLeader(false)
  }

  const handlePartyLaunchWorld = (world: WorldKind) => {
    const room = partyCode
      ? `PTY-${partyCode.replace(/[^A-Z0-9]/g, '').slice(-4)}`
      : world === 'frisbee'
        ? 'FRISBEE-1'
        : world === 'arena'
          ? 'ARENA-1'
          : world === 'obby'
            ? 'OBBY-1'
            : 'PUBLIC-1'
    if (partyClientRef.current && partyIsLeader) {
      partyClientRef.current.broadcastLaunch(world, room)
    }
    handleEnterWorld(world, room)
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
    if (clean.startsWith('FRISBEE')) {
      handleEnterWorld('frisbee', clean)
    } else if (clean.startsWith('ARENA')) {
      handleEnterWorld('arena', clean)
    } else if (clean.startsWith('OBBY')) {
      handleEnterWorld('obby', clean)
    } else {
      handleEnterWorld('lobby', clean)
    }
    setLauncherInput('')
  }

  const handleOpenPrivateRoom = (world: WorldKind = 'lobby') => {
    setPrivateRoomDefaultWorld(world)
    setPrivateRoomOpen(true)
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
      setFeedbackContext(lang === 'pl' ? 'Szatnia awatarów' : 'Avatar Wardrobe')
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
    { id: 'avatar', label: lang === 'pl' ? 'Szatnia awatarów' : 'Avatar Wardrobe', icon: Shirt },
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
            clanTag={profile.clanTag}
            freshGems={profile.freshGems}
            xp={profile.xp}
            avatar={profile.avatar}
            unlockedOutfits={profile.unlockedOutfits}
            unlockedHats={profile.unlockedHats}
            unlockedFaces={profile.unlockedFaces}
            unlockedTrails={profile.unlockedTrails}
            unlockedBacks={profile.unlockedBacks}
            unlockedPets={profile.unlockedPets}
            isFullscreen={isFullscreen}
            onBackHome={() => navigateView('home')}
            onEnterObby={() => handleEnterWorld('obby', 'OBBY-1')}
            onEnterArena={() => handleEnterWorld('arena', 'ARENA-1')}
            onEnterFrisbee={() => handleEnterWorld('frisbee', 'FRISBEE-1')}
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
            clanTag={profile.clanTag}
            freshGems={profile.freshGems}
            xp={profile.xp}
            avatar={profile.avatar}
            unlockedOutfits={profile.unlockedOutfits}
            unlockedHats={profile.unlockedHats}
            unlockedFaces={profile.unlockedFaces}
            unlockedTrails={profile.unlockedTrails}
            unlockedBacks={profile.unlockedBacks}
            unlockedPets={profile.unlockedPets}
            initialStage={profile.obbyStage}
            bestStage={isStaff && labFlags.unlockAllObbyStages ? 100 : profile.obbyBestStage}
            bestTimeMs={profile.obbyBestTimeMs}
            completions={profile.obbyCompletions}
            isFullscreen={isFullscreen}
            onBackHome={() => navigateView('home')}
            onSwitchToLobby={() => handleEnterWorld('lobby', 'PUBLIC-1')}
            onSwitchToArena={() => handleEnterWorld('arena', 'ARENA-1')}
            onSwitchToFrisbee={() => handleEnterWorld('frisbee', 'FRISBEE-1')}
            onBuyAndEquip={buyAndEquip}
            onBuyBundle={buyBundle}
            onSkinChange={(hex) => updateAvatar({ skinColor: hex })}
            onStageReached={(stg, ms) => {
              recordObbyStage(stg, ms)
              if (stg === 100 && typeof ms === 'number') {
                recordObbySpeedrun(ms)
              }
            }}
            onSetCurrentStage={setObbyCurrentStage}
            onChatSent={() => incrementQuest('q_chat', 1)}
            onEmoteUsed={() => incrementQuest('q_emote', 1)}
            onJumpPadUsed={() => incrementQuest('q_jumppad', 1)}
            feedbackOpen={feedbackOpen}
            onOpenFeedback={openFeedback}
          />
        )}

        {view === 'arena' && (
          <PortalArenaWorld
            roomCode={activeRoomId}
            playerId={profile.playerId}
            username={profile.username}
            clanTag={profile.clanTag}
            rankName={rank.name}
            freshGems={profile.freshGems}
            avatar={profile.avatar}
            unlockedOutfits={profile.unlockedOutfits}
            unlockedHats={profile.unlockedHats}
            unlockedFaces={profile.unlockedFaces}
            unlockedTrails={profile.unlockedTrails}
            unlockedBacks={profile.unlockedBacks}
            unlockedPets={profile.unlockedPets}
            lang={lang}
            onBuyAndEquip={buyAndEquip}
            onBuyBundle={buyBundle}
            onSkinChange={(hex) => updateAvatar({ skinColor: hex })}
            onArenaProgress={recordArenaProgress}
            onLeave={() => navigateView('home')}
            onSwitchToLobby={() => handleEnterWorld('lobby', 'PUBLIC-1')}
            onSwitchToObby={() => handleEnterWorld('obby', 'OBBY-1')}
            onSwitchToFrisbee={() => handleEnterWorld('frisbee', 'FRISBEE-1')}
            onOpenFeedback={() => openFeedback(`Portal Arena (${activeRoomId})`)}
          />
        )}

        {view === 'frisbee' && (
          <FrisbeeKingWorld
            roomCode={activeRoomId}
            playerId={profile.playerId}
            username={profile.username}
            clanTag={profile.clanTag}
            rankName={rank.name}
            freshGems={profile.freshGems}
            avatar={profile.avatar}
            unlockedOutfits={profile.unlockedOutfits}
            unlockedHats={profile.unlockedHats}
            unlockedFaces={profile.unlockedFaces}
            unlockedTrails={profile.unlockedTrails}
            unlockedBacks={profile.unlockedBacks}
            unlockedPets={profile.unlockedPets}
            lang={lang}
            onBuyAndEquip={buyAndEquip}
            onBuyBundle={buyBundle}
            onSkinChange={(hex) => updateAvatar({ skinColor: hex })}
            onFrisbeeProgress={recordFrisbeeProgress}
            onLeave={() => navigateView('home')}
            onSwitchToLobby={() => handleEnterWorld('lobby', 'PUBLIC-1')}
            onSwitchToArena={() => handleEnterWorld('arena', 'ARENA-1')}
            onOpenFeedback={() => openFeedback(`Frisbee King (${activeRoomId})`)}
          />
        )}

        {worldTransition && (
          <WorldTransitionOverlay
            world={worldTransition.world}
            roomCode={worldTransition.room}
            loaderPreset={labFlags.loaderPreset}
            lang={lang}
            fading={worldTransition.fading}
            onlineCount={worldTransition.onlineCount}
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
              background: `${themeAccent}1A`,
              border: `1px solid ${themeAccent}40`,
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
              const accent = item.accent ?? themeAccent
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

        {/* Bottom Utility Dock (Feedback, 6 Themes, Lang, Sign Out) */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => openFeedback()}
            className="flex h-9 w-9 items-center justify-center rounded-xl border transition hover:scale-105 cursor-pointer"
            style={{
              borderColor: `${themeAccent}38`,
              background: `${themeAccent}14`,
              color: themeAccent,
            }}
            title={lang === 'pl' ? 'Zgłoś błąd / pomysł' : 'Feedback'}
            aria-label="Feedback"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setThemePickerOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border transition hover:scale-105 cursor-pointer"
            style={{
              borderColor: themePickerOpen ? `${themeAccent}66` : shellBorder,
              background: themePickerOpen ? `${themeAccent}22` : inputBg,
              color: themeAccent,
            }}
            title={lang === 'pl' ? 'Motywy kolorystyczne (6)' : 'Color Themes (6)'}
            aria-label="Color themes"
          >
            <Palette className="h-4 w-4" />
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
        {/* Compact Native Launcher Top Bar (Zero overlap on 360px mobile!) */}
        <header
          className="z-20 flex h-13 shrink-0 items-center justify-between gap-2 border-b px-2.5 sm:px-5 backdrop-blur-xl"
          style={{ background: topBarBg, borderColor: shellBorder }}
        >
          {/* Left: Brand Logo (compact F-icon on mobile, full wordmark on sm+) + Quick Room / Search Launcher Input */}
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={() => navigateView('home')}
              className="flex shrink-0 items-center gap-1.5 cursor-pointer"
              aria-label="FreshBlox Home"
            >
              <FreshBloxLogo size={26} className="lg:hidden shrink-0" />
              <FreshBloxWordmark mode={mode} size="sm" className="hidden sm:block w-[96px] h-auto shrink-0" />
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
                  style={{ background: themeAccent }}
                  title={lang === 'pl' ? 'Dołącz do pokoju' : 'Join room'}
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </form>

            {/* U-08: Private Room Button */}
            <button
              type="button"
              onClick={() => handleOpenPrivateRoom('lobby')}
              className="hidden md:inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-extrabold transition hover:brightness-110 cursor-pointer"
              style={{
                borderColor: shellBorder,
                background: inputBg,
                color: tokens.textPrimary,
              }}
              title={lang === 'pl' ? 'Prywatny pokój na hasło / dla znajomych' : 'Private room'}
            >
              <Lock className="h-3.5 w-3.5" style={{ color: themeAccent }} />
              <span>{lang === 'pl' ? 'Prywatny' : 'Private'}</span>
            </button>

            {/* U-02: Party / Squad Button */}
            <button
              type="button"
              onClick={() => setPartyModalOpen(true)}
              className="hidden md:inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-extrabold transition hover:brightness-110 cursor-pointer"
              style={{
                borderColor: partyCode ? `${themeAccent}66` : shellBorder,
                background: partyCode ? `${themeAccent}20` : inputBg,
                color: partyCode ? themeAccent : tokens.textPrimary,
              }}
              title={lang === 'pl' ? 'Drużyna / Impreza (Party)' : 'Party / Squad'}
            >
              <Users className="h-3.5 w-3.5" style={{ color: themeAccent }} />
              <span>{partyCode ? `${partyCode} (${partyMembers.length})` : 'Party'}</span>
            </button>
          </div>

          {/* Right: Audio Mixer + Notifications Bell + Theme Picker + Player Chip */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {/* A-04: Audio 2.0 Mixer Popover */}
            <AudioMixerPopover lang={lang} />

            {/* U-14: Notifications Center Bell */}
            <button
              type="button"
              onClick={() => {
                setNotifOpen((o) => !o)
                void loadNotifications()
              }}
              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition hover:brightness-110 cursor-pointer"
              style={{
                borderColor: notifOpen ? `${themeAccent}66` : shellBorder,
                background: notifOpen ? `${themeAccent}20` : inputBg,
                color: tokens.textPrimary,
              }}
              title={lang === 'pl' ? 'Powiadomienia' : 'Notifications'}
              aria-label="Notifications"
            >
              <Bell className="h-3.5 w-3.5" style={{ color: notifications.length > 0 ? themeAccent : undefined }} />
              {notifications.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 font-mono text-[9px] font-black text-white shadow">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
            </button>

            {/* Quick feedback (sm..lg, hidden on ultra-narrow <sm so header stays breathable) */}
            <button
              type="button"
              onClick={() => openFeedback()}
              className="hidden sm:flex lg:hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl border cursor-pointer"
              style={{
                borderColor: `${themeAccent}38`,
                background: `${themeAccent}14`,
                color: themeAccent,
              }}
              aria-label="Feedback"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setThemePickerOpen((o) => !o)}
              className="flex lg:hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl border cursor-pointer"
              style={{ borderColor: shellBorder, background: inputBg, color: themeAccent }}
              aria-label="Color themes"
            >
              <Palette className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setLang((l) => (l === 'pl' ? 'en' : 'pl'))}
              className="flex lg:hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl border font-mono text-[10px] font-extrabold cursor-pointer"
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
              className="flex h-8 shrink-0 items-center gap-1.5 sm:gap-2 rounded-xl border px-2 sm:px-2.5 text-xs font-extrabold transition hover:brightness-110 cursor-pointer"
              style={{
                borderColor:
                  profile.role === 'owner'
                    ? roleMeta.border
                    : view === 'social'
                      ? `${themeAccent}55`
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
              <span className="max-w-[70px] sm:max-w-[140px] truncate">
                {profile.clanTag ? `[${profile.clanTag}] ${profile.username}` : profile.username}
              </span>
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
                className="hidden sm:inline-flex rounded-md px-1.5 py-0.5 font-mono text-[10px] font-extrabold"
                style={{ background: `${themeAccent}18`, color: themeAccent }}
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
              partyCode={partyCode}
              partyCount={partyMembers.length}
              onOpenParty={() => setPartyModalOpen(true)}
              onOpenPrivateRoom={handleOpenPrivateRoom}
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
              onSaveOutfitSlot={saveOutfitSlot}
              onDeleteOutfitSlot={deleteOutfitSlot}
              onApplySavedOutfit={(cfg) => updateAvatar(cfg)}
              onEnterLobby={() => handleEnterWorld('lobby', 'PUBLIC-1')}
            />
          )}

          {view === 'social' && (
            <SocialProfileView
              profile={profile}
              cloudStatus={cloudStatus}
              mode={mode}
              lang={lang}
              activeRoomCode={activeRoomId}
              initialDmUsername={initialDmUsername}
              onConsumedInitialDm={() => setInitialDmUsername(null)}
              onPinBadge={setPinnedBadge}
              onClanChanged={setClanInfo}
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
          const accent = item.accent ?? themeAccent
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

      {/* T-01..T-06: 6 Switchable Color Themes Picker */}
      {themePickerOpen && (
        <div
          onClick={() => setThemePickerOpen(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-4 backdrop-blur-sm sm:items-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border p-5 shadow-2xl"
            style={{
              background: isDark ? '#091224' : '#FFFFFF',
              borderColor: `${themeAccent}44`,
              color: tokens.textPrimary,
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4" style={{ color: themeAccent }} />
                <h3 className="font-display text-sm font-extrabold">
                  {lang === 'pl' ? 'Motywy kolorystyczne FreshBlox (6)' : 'FreshBlox Color Themes (6)'}
                </h3>
              </div>
              <span className="rounded-md px-2 py-0.5 font-mono text-[10px] font-black" style={{ background: `${themeAccent}1A`, color: themeAccent }}>
                {activeTheme.code}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {FRESH_THEMES.map((th) => {
                const selected = th.id === themePreset
                const swatches = [th.shellBg, th.accentDeep, th.accent]
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => selectThemePreset(th.id)}
                    className="flex flex-col gap-2 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 cursor-pointer"
                    style={{
                      background: selected ? `${th.accent}1A` : isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                      borderColor: selected ? th.accent : shellBorder,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-black" style={{ color: th.accent }}>
                        {th.code}
                      </span>
                      <div className="flex items-center gap-1">
                        {swatches.map((hex) => (
                          <span
                            key={hex}
                            className="h-3.5 w-3.5 rounded-full border border-white/25"
                            style={{ background: hex }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-extrabold" style={{ color: tokens.textPrimary }}>
                        {lang === 'pl' ? th.namePl : th.nameEn}
                      </div>
                      <div className="text-[10px]" style={{ color: tokens.textSecondary }}>
                        {th.mode === 'light'
                          ? lang === 'pl'
                            ? 'Jasny motyw'
                            : 'Light theme'
                          : lang === 'pl'
                            ? 'Ciemny motyw'
                            : 'Dark theme'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* U-02: Party / Squad Modal */}
      <PartyBarModal
        open={partyModalOpen}
        lang={lang}
        partyCode={partyCode}
        members={partyMembers}
        isLeader={partyIsLeader}
        onClose={() => setPartyModalOpen(false)}
        onCreateParty={handleCreateParty}
        onJoinParty={handleJoinParty}
        onLeaveParty={handleLeaveParty}
        onLaunchWorld={handlePartyLaunchWorld}
      />

      {/* U-08: Private Rooms (Password / Friends-only) */}
      <PrivateRoomModal
        open={privateRoomOpen}
        lang={lang}
        defaultWorld={privateRoomDefaultWorld}
        onClose={() => setPrivateRoomOpen(false)}
        onEnterRoom={handleEnterWorld}
      />

      {/* U-14: Notifications Center Popover */}
      <NotificationsPopover
        open={notifOpen}
        lang={lang}
        items={notifications}
        loading={notifLoading}
        onRefresh={() => void loadNotifications()}
        onClose={() => setNotifOpen(false)}
        onOpenDm={(uname) => {
          setInitialDmUsername(uname)
          navigateView('social')
        }}
        onJoinRoom={handleEnterWorld}
      />

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
