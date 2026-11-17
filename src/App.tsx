import React, { useEffect, useState } from 'react'
import { Home, Box, UserCircle2, Users, Sun, Moon, Globe } from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from './data/brandTheme'
import { Lang, LOCALES } from './data/locales'
import { FreshBloxLogo, FreshBloxWordmark, FreshGemShard } from './components/brand/FreshBloxBrand'
import { usePlayerStore } from './store/usePlayerStore'
import { HomeBentoView } from './components/lobby/HomeBentoView'
import { MainLobbyWorld } from './engine/MainLobbyWorld'
import { AvatarEditorView } from './components/avatar/AvatarEditorView'
import { SocialProfileView } from './components/social/SocialProfileView'
import {
  enterGameFullscreenLandscape,
  exitGameFullscreen,
  isDocumentFullscreen,
  isTouchMobileDevice,
} from './lib/mobileFullscreen'

type AppView = 'home' | 'world' | 'avatar' | 'social'

function getInitialRoomFromUrl(): { roomId: string; autoEnter: boolean } {
  if (typeof window === 'undefined') return { roomId: 'PUBLIC-1', autoEnter: false }
  const params = new URLSearchParams(window.location.search)
  const room = params.get('room')?.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12)
  if (room) return { roomId: room, autoEnter: true }
  return { roomId: 'PUBLIC-1', autoEnter: false }
}

export function App() {
  const initialRoom = getInitialRoomFromUrl()
  const [view, setView] = useState<AppView>(initialRoom.autoEnter ? 'world' : 'home')
  const [activeRoomId, setActiveRoomId] = useState<string>(initialRoom.roomId)
  const [mode, setMode] = useState<ThemeMode>('dark')
  const [lang, setLang] = useState<Lang>('pl')
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => isDocumentFullscreen())

  const {
    profile,
    setUsername,
    updateAvatar,
    awardGemsAndXp,
    incrementQuest,
    claimQuest,
    buyAndEquip,
    buyBundle,
    addFriend,
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

  const tokens = getThemeTokens(mode)
  const t = LOCALES[lang].nav

  const navigateView = (nextView: AppView, roomId?: string) => {
    if (nextView === 'world') {
      if (roomId) setActiveRoomId(roomId)
      // Automatically engage Fullscreen + Landscape on mobile/tablet inside the user's tap gesture!
      if (isTouchMobileDevice()) {
        enterGameFullscreenLandscape()
      }
    } else if (view === 'world') {
      exitGameFullscreen()
    }
    setView(nextView)
  }

  const handleEnterRoom = (roomId: string) => {
    navigateView('world', roomId)
  }

  const navItems: Array<{
    id: AppView
    label: string
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  }> = [
    { id: 'home', label: t.home, icon: Home },
    { id: 'world', label: t.world, icon: Box },
    { id: 'avatar', label: t.avatar, icon: UserCircle2 },
    { id: 'social', label: t.social, icon: Users },
  ]

  const hideTopChrome = view === 'world'

  return (
    <div
      className="min-h-dvh w-full max-w-full overflow-x-clip transition-colors duration-300"
      style={{ background: tokens.pageBg, color: tokens.textPrimary }}
    >
      {/* === STICKY ARCTIC SKY HEADER (always hidden inside 3D gameplay for full immersion!) === */}
      {!hideTopChrome && (
        <header
          className="sticky top-0 z-30 h-14 sm:h-16 w-full max-w-full border-b backdrop-blur-xl transition-colors"
          style={{ background: tokens.navBg, borderColor: tokens.cardBorder }}
        >
          <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-1.5 sm:gap-3 px-2.5 sm:px-6">
            {/* Official Brand Lockup: F-03 (0% Aura) + T-03 Glacier Flow Italic */}
            <button
              onClick={() => navigateView('home')}
              className="flex min-w-0 shrink items-center gap-1 sm:gap-2 text-left cursor-pointer"
            >
              <FreshBloxLogo size={28} className="shrink-0 sm:h-9 sm:w-9" />
              <FreshBloxWordmark mode={mode} size="sm" className="w-[92px] h-auto sm:w-[116px] shrink-0" />
            </button>

            {/* Main Navigation */}
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = view === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateView(item.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition cursor-pointer"
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

            {/* Right Controls: FreshGems Wallet + Dark/Light + PL/EN */}
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <button
                onClick={() => navigateView('avatar')}
                className="flex items-center gap-1 rounded-xl border px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-extrabold transition hover:scale-105 cursor-pointer"
                style={{ borderColor: `${ARCTIC_SKY.skyMain}55`, background: tokens.badgeBg, color: tokens.textPrimary }}
                title="FreshGems"
              >
                <FreshGemShard size={14} className="sm:h-4 sm:w-4 shrink-0" />
                <span>{profile.freshGems.toLocaleString()}</span>
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

      {/* Mobile Bottom Quick Nav (when not in 3D world) */}
      {view !== 'world' && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t py-2 backdrop-blur-xl md:hidden"
          style={{ background: tokens.navBg, borderColor: tokens.cardBorder }}
        >
          {navItems.map((item) => {
            const Icon = item.icon
            const active = view === item.id
            return (
              <button
                key={item.id}
                onClick={() => navigateView(item.id)}
                className="flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-bold cursor-pointer"
                style={{ color: active ? ARCTIC_SKY.skyMain : tokens.textSecondary }}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* === ACTIVE VIEW === */}
      <main className={view !== 'world' ? 'pb-16 md:pb-8' : ''}>
        {view === 'home' && (
          <HomeBentoView
            profile={profile}
            mode={mode}
            lang={lang}
            onEnterRoom={handleEnterRoom}
            onOpenAvatar={() => navigateView('avatar')}
            onClaimQuest={claimQuest}
          />
        )}

        {view === 'world' && (
          <MainLobbyWorld
            roomCode={activeRoomId}
            lang={lang}
            playerId={profile.playerId}
            username={profile.username}
            freshGems={profile.freshGems}
            xp={profile.xp}
            avatar={profile.avatar}
            isFullscreen={isFullscreen}
            onBackHome={() => navigateView('home')}
            onOpenAvatar={() => navigateView('avatar')}
            onCollectGem={() => {
              awardGemsAndXp(10, 15)
              incrementQuest('q_gems', 1)
            }}
            onChatSent={() => incrementQuest('q_chat', 1)}
            onEmoteUsed={() => incrementQuest('q_emote', 1)}
            onJumpPadUsed={() => incrementQuest('q_jumppad', 1)}
            onReachTerrace={() => {
              awardGemsAndXp(0, 25)
              incrementQuest('q_tower', 1)
            }}
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
            onEnterLobby={() => navigateView('world')}
          />
        )}

        {view === 'social' && (
          <SocialProfileView
            profile={profile}
            mode={mode}
            lang={lang}
            onChangeUsername={setUsername}
            onAddFriend={addFriend}
            onJoinRoom={handleEnterRoom}
          />
        )}
      </main>
    </div>
  )
}

export default App
