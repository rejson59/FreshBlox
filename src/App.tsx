import React, { useEffect, useState } from 'react'
import { Home, Box, UserCircle2, Users, Sun, Moon, Globe, Flag, Cloud, LogOut, Loader2 } from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from './data/brandTheme'
import { Lang, LOCALES } from './data/locales'
import { WorldKind } from './data/catalog'
import { FreshBloxLogo, FreshBloxWordmark } from './components/brand/FreshBloxBrand'
import { usePlayerStore } from './store/usePlayerStore'
import { HomeBentoView } from './components/lobby/HomeBentoView'
import { MainLobbyWorld } from './engine/MainLobbyWorld'
import { TestObbyWorld } from './engine/TestObbyWorld'
import { AvatarEditorView } from './components/avatar/AvatarEditorView'
import { SocialProfileView } from './components/social/SocialProfileView'
import { AuthScreen } from './components/auth/AuthScreen'
import {
  enterGameFullscreenLandscape,
  exitGameFullscreen,
  isDocumentFullscreen,
  isTouchMobileDevice,
} from './lib/mobileFullscreen'

type AppView = 'home' | 'world' | 'obby' | 'avatar' | 'social'

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

  const {
    profile,
    authUser,
    authLoading,
    cloudStatus,
    signUp,
    signIn,
    signOut,
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
    const bg = mode === 'dark' ? '#050C1B' : '#E8F6FF'
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

  // Presence heartbeat in Supabase while inside a 3D world
  useEffect(() => {
    if (!authUser || (view !== 'world' && view !== 'obby')) return
    const wk: WorldKind = view === 'obby' ? 'obby' : 'lobby'
    updatePresenceLocation(wk, activeRoomId)
    const id = window.setInterval(() => {
      updatePresenceLocation(wk, activeRoomId)
    }, 60_000)
    return () => window.clearInterval(id)
  }, [view, activeRoomId, updatePresenceLocation, authUser])

  const tokens = getThemeTokens(mode)
  const t = LOCALES[lang].nav
  const ta = LOCALES[lang].auth

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
        style={{ background: tokens.pageBg, color: tokens.textPrimary }}
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

  const navItems: Array<{
    id: AppView
    label: string
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  }> = [
    { id: 'home', label: t.home, icon: Home },
    { id: 'world', label: t.world, icon: Box },
    { id: 'obby', label: t.obby, icon: Flag },
    { id: 'avatar', label: t.avatar, icon: UserCircle2 },
    { id: 'social', label: t.social, icon: Users },
  ]

  return (
    <div
      className="min-h-dvh w-full max-w-full overflow-x-clip transition-colors duration-300"
      style={{ background: tokens.pageBg, color: tokens.textPrimary }}
    >
      {/* === STICKY ARCTIC SKY HEADER (always hidden inside 3D gameplay for full immersion!) === */}
      {!isIn3DGame && (
        <header
          className="sticky top-0 z-30 h-14 sm:h-16 w-full max-w-full border-b backdrop-blur-xl transition-colors"
          style={{ background: tokens.navBg, borderColor: tokens.cardBorder }}
        >
          <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-1.5 sm:gap-3 px-2.5 sm:px-6">
            <button
              onClick={() => navigateView('home')}
              className="flex min-w-0 shrink items-center gap-1 sm:gap-2 text-left cursor-pointer"
            >
              <FreshBloxLogo size={28} className="shrink-0 sm:h-9 sm:w-9" />
              <FreshBloxWordmark mode={mode} size="sm" className="w-[88px] h-auto sm:w-[112px] shrink-0" />
            </button>

            <nav className="hidden items-center gap-1 lg:flex">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = view === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateView(item.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition cursor-pointer"
                    style={{
                      background: active ? tokens.heroGradient : 'transparent',
                      borderColor: active ? `${ARCTIC_SKY.skyMain}58` : 'transparent',
                      color: active ? tokens.textPrimary : tokens.textSecondary,
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: active ? ARCTIC_SKY.skyMain : undefined }} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </nav>

            {/* Right Controls: Signed-in Account Pill + Sign Out + Dark/Light + PL/EN */}
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <button
                onClick={() => navigateView('social')}
                className="flex items-center gap-1.5 rounded-xl border px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-extrabold transition hover:scale-105 cursor-pointer"
                style={{
                  borderColor: 'rgba(52, 211, 153, 0.45)',
                  background: tokens.badgeBg,
                  color: tokens.textPrimary,
                }}
                title={profile.username}
              >
                <Cloud className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="max-w-[74px] sm:max-w-[110px] truncate">{profile.username}</span>
              </button>

              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl border transition hover:bg-rose-500/15 hover:text-rose-400 cursor-pointer"
                style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg, color: tokens.textSecondary }}
                title={ta.logout}
                aria-label={ta.logout}
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>

              <div
                className="flex items-center rounded-xl border p-0.5"
                style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
              >
                <button
                  onClick={() => setMode('dark')}
                  className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg transition cursor-pointer"
                  style={{
                    background: mode === 'dark' ? tokens.buttonGradient : 'transparent',
                    color: mode === 'dark' ? '#FFFFFF' : tokens.textSecondary,
                  }}
                  aria-label="Dark mode"
                >
                  <Moon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </button>
                <button
                  onClick={() => setMode('light')}
                  className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg transition cursor-pointer"
                  style={{
                    background: mode === 'light' ? tokens.buttonGradient : 'transparent',
                    color: mode === 'light' ? '#FFFFFF' : tokens.textSecondary,
                  }}
                  aria-label="Light mode"
                >
                  <Sun className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </button>
              </div>

              <button
                onClick={() => setLang((l) => (l === 'pl' ? 'en' : 'pl'))}
                className="inline-flex items-center gap-1 rounded-xl border px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold transition hover:scale-105 cursor-pointer"
                style={{ borderColor: tokens.cardBorder, background: tokens.cardBg, color: tokens.textPrimary }}
              >
                <Globe className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" style={{ color: ARCTIC_SKY.skyMain }} />
                <span>{lang.toUpperCase()}</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Mobile / Tablet Bottom Quick Nav (hidden inside 3D gameplay) */}
      {!isIn3DGame && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t py-2 backdrop-blur-xl lg:hidden"
          style={{ background: tokens.navBg, borderColor: tokens.cardBorder }}
        >
          {navItems.map((item) => {
            const Icon = item.icon
            const active = view === item.id
            return (
              <button
                key={item.id}
                onClick={() => navigateView(item.id)}
                className="flex flex-col items-center gap-0.5 px-1.5 py-1 text-[10px] font-bold cursor-pointer"
                style={{ color: active ? ARCTIC_SKY.skyMain : tokens.textSecondary }}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate max-w-[68px]">{item.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* === ACTIVE VIEW === */}
      <main className={!isIn3DGame ? 'pb-16 lg:pb-8' : ''}>
        {view === 'home' && (
          <HomeBentoView
            profile={profile}
            mode={mode}
            lang={lang}
            onEnterWorld={handleEnterWorld}
            onOpenAvatar={() => navigateView('avatar')}
            onClaimQuest={claimQuest}
            onFetchLeaderboard={fetchObbyLeaderboard}
          />
        )}

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
            bestStage={profile.obbyBestStage}
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
      </main>
    </div>
  )
}

export default App
