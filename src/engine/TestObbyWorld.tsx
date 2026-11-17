import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Crown,
  Flag,
  Home,
  Keyboard,
  Maximize2,
  MessageSquare,
  MessageSquarePlus,
  RotateCcw,
  Send,
  Shirt,
  Sparkles,
  Trophy,
} from 'lucide-react'
import {
  FaceId,
  getRankForXp,
  HatId,
  OutfitId,
  R6AvatarConfig,
} from '../data/catalog'
import { Lang, LOCALES } from '../data/locales'
import {
  LobbyChatMessage,
  LobbyMultiplayerClient,
  PlayerPose,
  RemotePlayerState,
} from '../lib/multiplayer'
import { isSupabaseConfigured } from '../lib/supabase'
import { sfx } from '../lib/sfx'
import { createR6Rig, R6RigHandle } from './r6Builder'
import { cloneFreshTexturesWithRepeat, FreshSurfaceKind, getFreshTexturePair } from './freshTextures'
import { generateTestObbyCourse, OBBY_ZONES, ObbyBlockDef } from './obbyCourse'
import { MobileTouchControls } from '../components/hud/MobileTouchControls'
import { InGameWardrobeDrawer } from '../components/hud/InGameWardrobeDrawer'
import { InGameMenuDrawer, MenuDrawerTab } from '../components/hud/InGameMenuDrawer'
import { ShortcutsOverlayModal } from '../components/hud/ShortcutsOverlayModal'
import { FreshBloxLogo } from '../components/brand/FreshBloxBrand'
import {
  enterGameFullscreenLandscape,
  exitGameFullscreen,
  isDocumentFullscreen,
  isTouchMobileDevice,
} from '../lib/mobileFullscreen'
import { loadMousePrefs, saveMousePrefs } from '../lib/mousePrefs'
import { useVisualViewport } from '../lib/useVisualViewport'

type GraphicsQuality = 'low' | 'medium' | 'high'
type WorldTimeOfDay = 'day' | 'night'

interface RuntimeBlock {
  def: ObbyBlockDef
  mesh: THREE.Mesh
  curX: number
  curY: number
  curZ: number
  prevX: number
  prevY: number
  prevZ: number
  // For fading & fake glass tiles
  fadeState: 'solid' | 'shaking' | 'gone'
  fadeTimer: number
  // For spinners (optional second perpendicular cross blade)
  spinAngle: number
  crossBladeMesh?: THREE.Mesh
  // For bounce pad squash animation
  bouncePulse: number
  // For checkpoints
  flagMesh?: THREE.Mesh
}

interface RemoteObbyEntity {
  id: string
  username: string
  rank: string
  stage: number
  avatarKey: string
  rig: R6RigHandle
  targetPos: THREE.Vector3
  currentPos: THREE.Vector3
  targetRotY: number
  pose: PlayerPose
  lastSeen: number
}

interface TestObbyWorldProps {
  roomCode: string
  lang: Lang
  playerId: string
  authUserId: string | null
  username: string
  freshGems: number
  xp: number
  avatar: R6AvatarConfig
  unlockedOutfits: OutfitId[]
  unlockedHats: HatId[]
  unlockedFaces: FaceId[]
  initialStage: number
  bestStage: number
  completions: number
  isFullscreen: boolean
  onBackHome: () => void
  onSwitchToLobby: () => void
  onBuyAndEquip: (category: 'outfit' | 'hat' | 'face', itemId: string, price: number) => boolean
  onBuyBundle: (items: Array<{ category: 'outfit' | 'hat' | 'face'; id: string; price: number }>) => boolean
  onSkinChange: (hex: string) => void
  onStageReached: (stage: number, elapsedMs?: number) => void
  onSetCurrentStage: (stage: number) => void
  onChatSent: () => void
  onEmoteUsed: () => void
  onJumpPadUsed: () => void
  feedbackOpen?: boolean
  onOpenFeedback?: (context: string) => void
}

function makeStageSignTexture(stageNum: number, isFinish: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const ctx = c.getContext('2d')!
  ctx.fillStyle = isFinish ? '#FEF3C7' : '#0F172A'
  ctx.fillRect(0, 0, 256, 128)
  ctx.strokeStyle = isFinish ? '#F59E0B' : '#38BDF8'
  ctx.lineWidth = 8
  ctx.strokeRect(6, 6, 244, 116)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = isFinish ? '#B45309' : '#7DD3FC'
  ctx.font = '700 24px Inter, sans-serif'
  ctx.fillText(isFinish ? 'FINISH' : 'STAGE', 128, 36)
  ctx.fillStyle = isFinish ? '#92400E' : '#FFFFFF'
  ctx.font = '900 54px Outfit, sans-serif'
  ctx.fillText(String(stageNum), 128, 86)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeConveyorArrowTexture(dir: 'fwd' | 'back' | 'left' | 'right'): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')!
  // Textured dark slate-sky rubberized belt base
  ctx.fillStyle = '#075985'
  ctx.fillRect(0, 0, 128, 128)
  ctx.fillStyle = '#0369A1'
  ctx.fillRect(8, 4, 112, 120)

  // Subtle horizontal belt tread ribs
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
  for (let y = 0; y < 128; y += 16) {
    ctx.fillRect(10, y, 108, 4)
  }
  // Brushed side rails
  ctx.fillStyle = '#0C4A6E'
  ctx.fillRect(0, 0, 10, 128)
  ctx.fillRect(118, 0, 10, 128)

  ctx.save()
  ctx.translate(64, 64)
  if (dir === 'back') ctx.rotate(Math.PI)
  else if (dir === 'left') ctx.rotate(-Math.PI / 2)
  else if (dir === 'right') ctx.rotate(Math.PI / 2)

  // Clean crisp architectural chevron arrow (zero neon!)
  ctx.fillStyle = '#F8FAFC'
  ctx.beginPath()
  ctx.moveTo(0, -40)
  ctx.lineTo(36, 8)
  ctx.lineTo(17, 8)
  ctx.lineTo(17, 36)
  ctx.lineTo(-17, 36)
  ctx.lineTo(-17, 8)
  ctx.lineTo(-36, 8)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(2, 3)
  return tex
}

function formatTimeMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export const TestObbyWorld: React.FC<TestObbyWorldProps> = ({
  roomCode,
  lang,
  playerId,
  authUserId,
  username,
  freshGems,
  xp,
  avatar,
  unlockedOutfits,
  unlockedHats,
  unlockedFaces,
  initialStage,
  bestStage,
  completions,
  isFullscreen,
  onBackHome,
  onSwitchToLobby,
  onBuyAndEquip,
  onBuyBundle,
  onSkinChange,
  onStageReached,
  onSetCurrentStage,
  onChatSent,
  onEmoteUsed,
  onJumpPadUsed,
  feedbackOpen = false,
  onOpenFeedback,
}) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const vp = useVisualViewport()
  const t = LOCALES[lang].world
  const rank = getRankForXp(xp)

  const course = useMemo(() => generateTestObbyCourse(), [])

  const [currentStage, setCurrentStage] = useState<number>(() => Math.max(1, Math.min(100, initialStage)))
  const [maxUnlockedStage, setMaxUnlockedStage] = useState<number>(() => Math.max(1, Math.min(100, bestStage)))
  const [finishedBanner, setFinishedBanner] = useState<{ elapsedMs: number } | null>(null)
  const [elapsedMs, setElapsedMs] = useState<number>(0)
  const runStartTimeRef = useRef<number>(Date.now())

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true)
  const [touchMode, setTouchMode] = useState<boolean>(() => isTouchMobileDevice())
  const [touchSprint, setTouchSprint] = useState<boolean>(false)
  const [shiftLockActive, setShiftLockActive] = useState<boolean>(false)
  const [mousePrefs, setMousePrefs] = useState(() => loadMousePrefs())
  const [activeEmoteUi, setActiveEmoteUi] = useState<PlayerPose | null>(null)
  const [isPortraitMobile, setIsPortraitMobile] = useState<boolean>(false)
  const [quality, setQuality] = useState<GraphicsQuality>(() => (isTouchMobileDevice() ? 'low' : 'medium'))
  const [worldTime, setWorldTime] = useState<WorldTimeOfDay>('day')
  const [hubOpen, setHubOpen] = useState<boolean>(false)
  const [hubTab, setHubTab] = useState<MenuDrawerTab>('overview')
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false)
  const [wardrobeOpen, setWardrobeOpen] = useState<boolean>(false)
  const [previewAvatar, setPreviewAvatar] = useState<R6AvatarConfig>(() => ({ ...avatar }))
  const [chatOpen, setChatOpen] = useState<boolean>(() => !isTouchMobileDevice())
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<LobbyChatMessage[]>(() => [
    {
      id: 'welcome-obby',
      senderId: 'system',
      username: 'FreshBlox',
      text: LOCALES[lang].world.welcomeObbyChat,
      timestamp: Date.now(),
      system: true,
    },
  ])
  const [onlineCount, setOnlineCount] = useState(1)
  const [roster, setRoster] = useState<Array<{ id: string; username: string; rank: string; stage: number; isSelf?: boolean }>>([])
  const [toast, setToast] = useState<string | null>(null)
  const [copiedInvite, setCopiedInvite] = useState(false)

  // Keep synced with props when account loads from cloud
  useEffect(() => {
    setMaxUnlockedStage((prev) => Math.max(prev, bestStage))
  }, [bestStage])

  useEffect(() => {
    setPreviewAvatar((prev) => ({ ...prev, skinColor: avatar.skinColor }))
  }, [avatar.skinColor])

  const displayedAvatar = wardrobeOpen ? previewAvatar : avatar

  // Refs shared with RAF loop
  const qualityRef = useRef<GraphicsQuality>(quality)
  qualityRef.current = quality
  const worldTimeRef = useRef<WorldTimeOfDay>(worldTime)
  worldTimeRef.current = worldTime
  const hubOpenRef = useRef<boolean>(hubOpen)
  hubOpenRef.current = hubOpen
  const hubTabRef = useRef<MenuDrawerTab>(hubTab)
  hubTabRef.current = hubTab
  const shortcutsOpenRef = useRef<boolean>(shortcutsOpen)
  shortcutsOpenRef.current = shortcutsOpen
  const wasLockedBeforeUiRef = useRef<boolean>(false)
  const touchModeRef = useRef<boolean>(touchMode)
  touchModeRef.current = touchMode
  const wardrobeOpenRef = useRef<boolean>(wardrobeOpen)
  wardrobeOpenRef.current = wardrobeOpen
  const chatOpenRef = useRef<boolean>(chatOpen)
  chatOpenRef.current = chatOpen
  const clickToLockRef = useRef<boolean>(mousePrefs.clickToLock)
  clickToLockRef.current = mousePrefs.clickToLock
  const shiftLockAlignRef = useRef<boolean>(mousePrefs.shiftLockAlign)
  shiftLockAlignRef.current = mousePrefs.shiftLockAlign
  const mouseSensRef = useRef<number>(mousePrefs.sensitivity)
  mouseSensRef.current = mousePrefs.sensitivity
  const usernameRef = useRef(username)
  usernameRef.current = username
  const rankRef = useRef(rank.name)
  rankRef.current = rank.name
  const avatarRef = useRef(avatar)
  avatarRef.current = avatar
  const displayedAvatarRef = useRef(displayedAvatar)
  displayedAvatarRef.current = displayedAvatar
  const authUserIdRef = useRef(authUserId)
  authUserIdRef.current = authUserId

  const currentStageRef = useRef<number>(currentStage)
  currentStageRef.current = currentStage
  const maxUnlockedRef = useRef<number>(maxUnlockedStage)
  maxUnlockedRef.current = maxUnlockedStage
  const feedbackOpenRef = useRef<boolean>(feedbackOpen)
  feedbackOpenRef.current = feedbackOpen

  // Release pointer lock cleanly whenever any overlay opens
  useEffect(() => {
    if ((hubOpen || wardrobeOpen || shortcutsOpen || feedbackOpen || Boolean(finishedBanner)) && document.pointerLockElement) {
      document.exitPointerLock?.()
    }
  }, [hubOpen, wardrobeOpen, shortcutsOpen, feedbackOpen, finishedBanner])

  const updateMousePrefs = useCallback((patch: Partial<typeof mousePrefs>) => {
    setMousePrefs((prev) => {
      const next = { ...prev, ...patch }
      saveMousePrefs(next)
      return next
    })
  }, [])

  const callbacksRef = useRef({
    onStageReached,
    onSetCurrentStage,
    onChatSent,
    onEmoteUsed,
    onJumpPadUsed,
    onOpenFeedback,
  })
  callbacksRef.current = {
    onStageReached,
    onSetCurrentStage,
    onChatSent,
    onEmoteUsed,
    onJumpPadUsed,
    onOpenFeedback,
  }

  // Input & camera refs
  const keysRef = useRef<Set<string>>(new Set())
  const joyRef = useRef<{ x: number; y: number; autoSprint: boolean }>({ x: 0, y: 0, autoSprint: false })
  const touchSprintRef = useRef<boolean>(false)
  const jumpRequestRef = useRef<boolean>(false)
  const jumpHeldRef = useRef<boolean>(false)
  const shiftLockRef = useRef<boolean>(false)
  const activeEmoteRef = useRef<{ pose: PlayerPose; until: number } | null>(null)
  const respawnToStageRef = useRef<((stage: number, resetTimer?: boolean) => void) | null>(null)
  const focusWardrobeCamRef = useRef<(() => void) | null>(null)
  const recenterCamRef = useRef<(() => void) | null>(null)
  const toggleShiftLockRef = useRef<(() => void) | null>(null)
  const lockMouseRef = useRef<(() => void) | null>(null)
  const pointerLockReleasedAtRef = useRef<number>(0)

  const mpRef = useRef<LobbyMultiplayerClient | null>(null)
  const localRigRef = useRef<R6RigHandle | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const applyTimeOfDayRef = useRef<((tod: WorldTimeOfDay) => void) | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev))
    }, 2400)
  }, [])

  // Session run timer
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!finishedBanner) {
        setElapsedMs(Date.now() - runStartTimeRef.current)
      }
    }, 500)
    return () => window.clearInterval(id)
  }, [finishedBanner])

  // Portrait mobile detection
  useEffect(() => {
    const check = () => {
      const mobile = isTouchMobileDevice()
      setIsPortraitMobile(mobile && window.innerHeight > window.innerWidth)
    }
    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, chatOpen])

  // Apply quality changes live
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return
    const dpr = window.devicePixelRatio || 1
    if (quality === 'low') {
      renderer.setPixelRatio(Math.min(dpr, 1.0))
      renderer.shadowMap.enabled = false
    } else if (quality === 'medium') {
      renderer.setPixelRatio(Math.min(dpr, 1.25))
      renderer.shadowMap.enabled = true
    } else {
      renderer.setPixelRatio(Math.min(dpr, 1.75))
      renderer.shadowMap.enabled = true
    }
  }, [quality])

  useEffect(() => {
    applyTimeOfDayRef.current?.(worldTime)
  }, [worldTime])

  // Live 0ms hot-swap of local R6 rig inside Test Obby
  useEffect(() => {
    const scene = sceneRef.current
    const oldRig = localRigRef.current
    if (!scene || !oldRig) return

    const pos = oldRig.root.position.clone()
    const rotY = oldRig.root.rotation.y
    const newRig = createR6Rig({
      avatar: displayedAvatar,
      username,
      rank: rank.name,
      showNameplate: true,
      castShadow: qualityRef.current !== 'low',
    })
    newRig.root.position.copy(pos)
    newRig.root.rotation.y = rotY
    scene.remove(oldRig.root)
    oldRig.dispose()
    scene.add(newRig.root)
    localRigRef.current = newRig
  }, [
    displayedAvatar.outfitId,
    displayedAvatar.hatId,
    displayedAvatar.faceId,
    displayedAvatar.skinColor,
    username,
    rank.name,
  ])

  const openLiveWardrobe = useCallback(() => {
    setPreviewAvatar({ ...avatarRef.current })
    setHubOpen(false)
    setShortcutsOpen(false)
    if (touchMode) setChatOpen(false)
    setWardrobeOpen(true)
    focusWardrobeCamRef.current?.()
    sfx.playClick()
  }, [touchMode])

  const closeLiveWardrobe = useCallback(() => {
    setWardrobeOpen(false)
    setPreviewAvatar({ ...avatarRef.current })
    sfx.playClick()
  }, [])

  const shortcutActionsRef = useRef({
    openChatAndFocus: () => {},
    toggleWardrobe: () => {},
    toggleHubTab: (_tab: MenuDrawerTab) => {},
    toggleShortcuts: () => {},
    openFeedback: () => {},
    toggleShiftLockAlign: () => {},
    toggleWorldTime: () => {},
    toggleSoundWithToast: () => {},
    toggleFullscreen: () => {},
    stepStage: (_delta: -1 | 1) => {},
  })

  // Keyboard bindings (focus-safe so clicking HUD buttons NEVER eats Space jump!)
  useEffect(() => {
    const isTextFieldFocused = () => {
      const el = document.activeElement
      if (!el) return false
      if (el === chatInputRef.current) return true
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (feedbackOpenRef.current) return
      const code = e.code

      if (e.key === 'Escape' && isTextFieldFocused()) {
        e.preventDefault()
        ;(document.activeElement as HTMLElement | null)?.blur()
        wasLockedBeforeUiRef.current = false
        sfx.playClick()
        return
      }

      if (isTextFieldFocused()) return
      if (e.ctrlKey || e.metaKey || e.altKey) return

      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'F1'].includes(code)) {
        e.preventDefault()
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        wasLockedBeforeUiRef.current = false
        if (shortcutsOpenRef.current) {
          setShortcutsOpen(false)
          sfx.playClick()
          return
        }
        if (wardrobeOpenRef.current) {
          closeLiveWardrobe()
          return
        }
        if (hubOpenRef.current) {
          setHubOpen(false)
          sfx.playClick()
          return
        }
        // If Esc just released pointer lock, don't force the menu open immediately
        if (performance.now() - pointerLockReleasedAtRef.current < 220) {
          return
        }
        setHubTab('overview')
        setHubOpen(true)
        sfx.playClick()
        return
      }

      // Single-key UI & quick-toggle shortcuts (all work cleanly while Mouse Lock is active!)
      if (!e.repeat) {
        if (code === 'KeyT' || code === 'Slash') {
          e.preventDefault()
          keysRef.current.clear()
          shortcutActionsRef.current.openChatAndFocus()
          return
        }
        if (code === 'KeyI') {
          e.preventDefault()
          keysRef.current.clear()
          shortcutActionsRef.current.toggleWardrobe()
          return
        }
        if (code === 'KeyH') {
          e.preventDefault()
          keysRef.current.clear()
          shortcutActionsRef.current.toggleHubTab('overview')
          return
        }
        if (code === 'KeyP') {
          e.preventDefault()
          keysRef.current.clear()
          shortcutActionsRef.current.toggleHubTab('players')
          return
        }
        if (code === 'KeyO') {
          e.preventDefault()
          keysRef.current.clear()
          shortcutActionsRef.current.toggleHubTab('settings')
          return
        }
        if (code === 'KeyB') {
          e.preventDefault()
          keysRef.current.clear()
          shortcutActionsRef.current.openFeedback()
          return
        }
        if (code === 'KeyK' || code === 'F1' || e.key === '?') {
          e.preventDefault()
          keysRef.current.clear()
          shortcutActionsRef.current.toggleShortcuts()
          return
        }
        if (code === 'Tab' || code === 'KeyM') {
          e.preventDefault()
          if (hubOpenRef.current || wardrobeOpenRef.current || shortcutsOpenRef.current) {
            setHubOpen(false)
            setWardrobeOpen(false)
            setShortcutsOpen(false)
            setPreviewAvatar({ ...avatarRef.current })
          }
          toggleShiftLockRef.current?.()
          return
        }
        if (code === 'KeyL') {
          shortcutActionsRef.current.toggleShiftLockAlign()
          return
        }
        if (code === 'KeyN') {
          shortcutActionsRef.current.toggleWorldTime()
          return
        }
        if (code === 'KeyV') {
          shortcutActionsRef.current.toggleSoundWithToast()
          return
        }
        if (code === 'KeyF') {
          shortcutActionsRef.current.toggleFullscreen()
          return
        }
        if (code === 'BracketLeft') {
          shortcutActionsRef.current.stepStage(-1)
          return
        }
        if (code === 'BracketRight') {
          shortcutActionsRef.current.stepStage(1)
          return
        }
      }

      if (hubOpenRef.current || shortcutsOpenRef.current) return

      if (code === 'KeyC') {
        recenterCamRef.current?.()
        return
      }
      if (code === 'Space') {
        e.preventDefault()
        // If a HUD button kept focus, blur it so Space always triggers a crisp jump instead of clicking UI!
        const activeEl = document.activeElement as HTMLElement | null
        if (activeEl && activeEl.tagName === 'BUTTON') {
          activeEl.blur()
        }
        if (!e.repeat) {
          jumpRequestRef.current = true
        }
        jumpHeldRef.current = true
      }
      if (code === 'KeyR') {
        respawnToStageRef.current?.(currentStageRef.current)
        return
      }
      keysRef.current.add(code)

      if (code === 'Digit1') triggerEmote('wave')
      if (code === 'Digit2') triggerEmote('dance')
      if (code === 'Digit3') triggerEmote('cheer')
      if (code === 'Digit4') triggerEmote('sit')
      if (code === 'Digit5') triggerEmote('spin')
      if (code === 'Digit6') triggerEmote('backflip')
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        jumpHeldRef.current = false
      }
      keysRef.current.delete(e.code)
    }
    const onWindowBlur = () => {
      keysRef.current.clear()
      jumpHeldRef.current = false
      jumpRequestRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onWindowBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [closeLiveWardrobe])

  const triggerEmote = useCallback((pose: PlayerPose) => {
    const dur =
      pose === 'dance' || pose === 'sit' ? 4200 : pose === 'spin' || pose === 'backflip' ? 1400 : 2100
    activeEmoteRef.current = { pose, until: performance.now() + dur }
    setActiveEmoteUi(pose)
    window.setTimeout(() => {
      setActiveEmoteUi((cur) => (cur === pose ? null : cur))
    }, dur)
    if (pose === 'backflip' || pose === 'spin') {
      sfx.playJump()
    } else {
      sfx.playClick()
    }
    callbacksRef.current.onEmoteUsed()
  }, [])

  const handleSendChat = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      const clean = chatInput.trim().slice(0, 140)
      if (!clean) {
        chatInputRef.current?.blur()
        if (wasLockedBeforeUiRef.current && clickToLockRef.current) {
          wasLockedBeforeUiRef.current = false
          lockMouseRef.current?.()
        }
        return
      }
      const msg: LobbyChatMessage = {
        id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        senderId: playerId,
        username: usernameRef.current,
        text: clean,
        timestamp: Date.now(),
      }
      setChatMessages((prev) => [...prev.slice(-45), msg])
      setChatInput('')
      chatInputRef.current?.blur()
      localRigRef.current?.setSpeech(clean)
      window.setTimeout(() => localRigRef.current?.setSpeech(null), 5000)
      mpRef.current?.broadcastChat(msg, authUserIdRef.current)
      sfx.playChatPop()
      callbacksRef.current.onChatSent()

      if (wasLockedBeforeUiRef.current && clickToLockRef.current) {
        wasLockedBeforeUiRef.current = false
        lockMouseRef.current?.()
      }
    },
    [chatInput, playerId],
  )

  const handleCopyInvite = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}?world=obby&room=${encodeURIComponent(roomCode)}`
    navigator.clipboard?.writeText(url).catch(() => {})
    setCopiedInvite(true)
    sfx.playClick()
    setTimeout(() => setCopiedInvite(false), 2000)
  }, [roomCode])

  const toggleSound = useCallback(() => {
    const next = !soundEnabled
    sfx.setEnabled(next)
    setSoundEnabled(next)
    if (next) sfx.playClick()
  }, [soundEnabled])

  const jumpToStage = useCallback(
    (target: number) => {
      const clamped = Math.max(1, Math.min(maxUnlockedRef.current, target))
      setCurrentStage(clamped)
      currentStageRef.current = clamped
      callbacksRef.current.onSetCurrentStage(clamped)
      respawnToStageRef.current?.(clamped)
      sfx.playClick()
    },
    [],
  )

  shortcutActionsRef.current = {
    openChatAndFocus: () => {
      if (shiftLockRef.current) {
        wasLockedBeforeUiRef.current = true
        document.exitPointerLock?.()
      }
      setHubOpen(false)
      setWardrobeOpen(false)
      setShortcutsOpen(false)
      setChatOpen(true)
      setUnreadCount(0)
      sfx.playClick()
      window.setTimeout(() => {
        chatInputRef.current?.focus()
      }, 25)
    },
    toggleWardrobe: () => {
      if (wardrobeOpenRef.current) {
        closeLiveWardrobe()
        if (wasLockedBeforeUiRef.current && clickToLockRef.current) {
          wasLockedBeforeUiRef.current = false
          lockMouseRef.current?.()
        }
      } else {
        if (shiftLockRef.current) {
          wasLockedBeforeUiRef.current = true
        }
        openLiveWardrobe()
      }
    },
    toggleHubTab: (targetTab: MenuDrawerTab) => {
      if (hubOpenRef.current && hubTabRef.current === targetTab) {
        setHubOpen(false)
        sfx.playClick()
        if (wasLockedBeforeUiRef.current && clickToLockRef.current) {
          wasLockedBeforeUiRef.current = false
          lockMouseRef.current?.()
        }
      } else {
        if (!hubOpenRef.current && shiftLockRef.current) {
          wasLockedBeforeUiRef.current = true
        }
        setWardrobeOpen(false)
        setShortcutsOpen(false)
        setHubTab(targetTab)
        setHubOpen(true)
        sfx.playClick()
      }
    },
    toggleShortcuts: () => {
      if (shortcutsOpenRef.current) {
        setShortcutsOpen(false)
        sfx.playClick()
        if (wasLockedBeforeUiRef.current && clickToLockRef.current) {
          wasLockedBeforeUiRef.current = false
          lockMouseRef.current?.()
        }
      } else {
        if (shiftLockRef.current) {
          wasLockedBeforeUiRef.current = true
        }
        setHubOpen(false)
        setWardrobeOpen(false)
        setShortcutsOpen(true)
        sfx.playClick()
      }
    },
    openFeedback: () => {
      if (!callbacksRef.current.onOpenFeedback) return
      if (shiftLockRef.current) {
        document.exitPointerLock?.()
      }
      setHubOpen(false)
      setShortcutsOpen(false)
      sfx.playClick()
      callbacksRef.current.onOpenFeedback(`Test Obby 100 · Stage ${currentStageRef.current}`)
    },
    toggleShiftLockAlign: () => {
      const next = !shiftLockAlignRef.current
      updateMousePrefs({ shiftLockAlign: next })
      sfx.playClick()
      showToast(
        lang === 'pl'
          ? `Shift-Lock: ${next ? 'WŁ.' : 'WYŁ.'}`
          : `Shift-Lock: ${next ? 'ON' : 'OFF'}`,
      )
    },
    toggleWorldTime: () => {
      const next: WorldTimeOfDay = worldTimeRef.current === 'day' ? 'night' : 'day'
      setWorldTime(next)
      sfx.playClick()
      showToast(
        lang === 'pl'
          ? `Pora dnia: ${next === 'night' ? 'Noc' : 'Dzień'}`
          : `Time of day: ${next === 'night' ? 'Night' : 'Day'}`,
      )
    },
    toggleSoundWithToast: () => {
      setSoundEnabled((prev) => {
        const next = !prev
        sfx.setEnabled(next)
        if (next) sfx.playClick()
        showToast(
          lang === 'pl'
            ? `Dźwięki SFX: ${next ? 'WŁ.' : 'WYŁ.'}`
            : `SFX Audio: ${next ? 'ON' : 'OFF'}`,
        )
        return next
      })
    },
    toggleFullscreen: () => {
      sfx.playClick()
      if (isDocumentFullscreen()) {
        exitGameFullscreen()
      } else {
        enterGameFullscreenLandscape()
      }
    },
    stepStage: (delta: -1 | 1) => {
      const next = currentStageRef.current + delta
      if (next < 1 || next > maxUnlockedRef.current) {
        showToast(
          lang === 'pl'
            ? next < 1
              ? 'Jesteś na Stage 1'
              : `Odblokowano do Stage ${maxUnlockedRef.current}`
            : next < 1
              ? 'Already at Stage 1'
              : `Unlocked up to Stage ${maxUnlockedRef.current}`,
        )
        return
      }
      jumpToStage(next)
      showToast(`Stage ${next} / 100`)
    },
  }

  const handleRestartFromOne = useCallback(() => {
    setFinishedBanner(null)
    runStartTimeRef.current = Date.now()
    setElapsedMs(0)
    setCurrentStage(1)
    currentStageRef.current = 1
    callbacksRef.current.onSetCurrentStage(1)
    respawnToStageRef.current?.(1, true)
    sfx.playClick()
  }, [])

  // === MAIN THREE.JS 100-STAGE OBBY ENGINE ===
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const geometriesToDispose: THREE.BufferGeometry[] = []
    const materialsToDispose: THREE.Material[] = []
    const texturesToDispose: THREE.Texture[] = []

    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      geometriesToDispose.push(g)
      return g
    }
    const trackMat = <T extends THREE.Material>(m: T): T => {
      materialsToDispose.push(m)
      return m
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: !isTouchMobileDevice(),
      powerPreference: 'high-performance',
    })
    const initDpr = window.devicePixelRatio || 1
    renderer.setPixelRatio(
      qualityRef.current === 'low'
        ? Math.min(initDpr, 1.0)
        : qualityRef.current === 'medium'
          ? Math.min(initDpr, 1.25)
          : Math.min(initDpr, 1.75),
    )
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight)
    renderer.shadowMap.enabled = qualityRef.current !== 'low'
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    container.innerHTML = ''
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#74C5FF')
    scene.fog = new THREE.Fog('#B8E3FF', 75, 220)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(
      62,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.2,
      340,
    )

    // Lighting — clean natural Day / Night (Zero Neon!)
    const hemi = new THREE.HemisphereLight('#F0F9FF', '#5894C4', 1.15)
    scene.add(hemi)

    const sun = new THREE.DirectionalLight('#FFFDF7', 1.48)
    sun.position.set(45, 95, 40)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.near = 10
    sun.shadow.camera.far = 220
    const dCam = 48
    sun.shadow.camera.left = -dCam
    sun.shadow.camera.right = dCam
    sun.shadow.camera.top = dCam
    sun.shadow.camera.bottom = -dCam
    sun.shadow.bias = -0.0008
    scene.add(sun)
    scene.add(sun.target)

    const fill = new THREE.DirectionalLight('#BAE6FD', 0.45)
    fill.position.set(-36, 40, -30)
    scene.add(fill)

    // Sky elements (Day sun + Night moon & stars — follow player like a true skybox up to Stage 100!)
    const daySkyGroup = new THREE.Group()
    const sunDisc = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(9, 20, 16)),
      trackMat(new THREE.MeshBasicMaterial({ color: '#FFFBEB', fog: false })),
    )
    sunDisc.position.set(70, 95, -155)
    daySkyGroup.add(sunDisc)
    scene.add(daySkyGroup)

    const nightSkyGroup = new THREE.Group()
    nightSkyGroup.visible = false
    const moonMesh = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(7, 20, 16)),
      trackMat(new THREE.MeshBasicMaterial({ color: '#F1F5F9', fog: false })),
    )
    moonMesh.position.set(-65, 90, -155)
    nightSkyGroup.add(moonMesh)

    const starPos = new Float32Array(260 * 3)
    for (let i = 0; i < 260; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 320
      starPos[i * 3 + 1] = 20 + Math.random() * 140
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 320
    }
    const starGeo = trackGeo(new THREE.BufferGeometry())
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    nightSkyGroup.add(
      new THREE.Points(
        starGeo,
        trackMat(new THREE.PointsMaterial({ color: '#E2E8F0', size: 1.0, sizeAttenuation: true, fog: false })),
      ),
    )
    scene.add(nightSkyGroup)

    const applyTimeOfDay = (tod: WorldTimeOfDay) => {
      if (tod === 'day') {
        scene.background = new THREE.Color('#74C5FF')
        scene.fog = new THREE.Fog('#B8E3FF', 75, 220)
        hemi.color.set('#F0F9FF')
        hemi.groundColor.set('#5894C4')
        hemi.intensity = 1.15
        sun.color.set('#FFFDF7')
        sun.intensity = 1.48
        fill.color.set('#BAE6FD')
        fill.intensity = 0.45
        daySkyGroup.visible = true
        nightSkyGroup.visible = false
      } else {
        scene.background = new THREE.Color('#0B1528')
        scene.fog = new THREE.Fog('#0E1B33', 70, 210)
        hemi.color.set('#93B8E0')
        hemi.groundColor.set('#14233C')
        hemi.intensity = 0.78
        sun.color.set('#DBEAFE')
        sun.intensity = 1.08
        fill.color.set('#FFE6C4')
        fill.intensity = 0.52
        daySkyGroup.visible = false
        nightSkyGroup.visible = true
      }
    }
    applyTimeOfDayRef.current = applyTimeOfDay
    applyTimeOfDay(worldTimeRef.current)

    // Autorskie materiały FreshBlox z mapami albedo + bumpMap (zero studsów z Robloksa, zero płaskiego plastiku!)
    const trackTex = <T extends THREE.Texture>(t: T): T => {
      texturesToDispose.push(t)
      return t
    }
    const matCache = new Map<string, THREE.MeshStandardMaterial>()
    const getSurfaceMat = (
      surface: FreshSurfaceKind,
      hex: string,
      rx = 1,
      ry = 1,
      roughness = 0.34,
      metalness = 0.07,
    ): THREE.MeshStandardMaterial => {
      const key = `${surface}_${hex}_${rx}_${ry}_${roughness}_${metalness}`
      const existing = matCache.get(key)
      if (existing) return existing
      const pair = cloneFreshTexturesWithRepeat(surface, rx, ry, trackTex)
      const m = trackMat(
        new THREE.MeshStandardMaterial({
          color: hex,
          map: pair.map,
          bumpMap: pair.bumpMap,
          bumpScale: pair.bumpScale,
          roughness,
          metalness,
        }),
      )
      matCache.set(key, m)
      return m
    }

    const hazardPair = getFreshTexturePair('hazard')
    const hazardMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#EF4444',
        map: hazardPair.map,
        bumpMap: hazardPair.bumpMap,
        bumpScale: hazardPair.defaultBumpScale,
        roughness: 0.32,
        metalness: 0.08,
      }),
    )
    const gripPair = getFreshTexturePair('grip')
    const jumpPadMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#0EA5E9',
        map: gripPair.map,
        bumpMap: gripPair.bumpMap,
        bumpScale: gripPair.defaultBumpScale,
        roughness: 0.26,
        metalness: 0.14,
      }),
    )
    const icePair = getFreshTexturePair('ice')
    const iceMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#BAE6FD',
        map: icePair.map,
        bumpMap: icePair.bumpMap,
        bumpScale: icePair.defaultBumpScale,
        roughness: 0.1,
        metalness: 0.14,
        transparent: true,
        opacity: 0.88,
      }),
    )
    const marblePair = getFreshTexturePair('marble')
    const conveyorTexFwd = makeConveyorArrowTexture('fwd')
    const conveyorTexBack = makeConveyorArrowTexture('back')
    const conveyorTexLeft = makeConveyorArrowTexture('left')
    const conveyorTexRight = makeConveyorArrowTexture('right')
    texturesToDispose.push(conveyorTexFwd, conveyorTexBack, conveyorTexLeft, conveyorTexRight)

    const conveyorMatFwd = trackMat(new THREE.MeshStandardMaterial({ map: conveyorTexFwd, bumpMap: gripPair.bumpMap, bumpScale: 0.03, roughness: 0.38, metalness: 0.08 }))
    const conveyorMatBack = trackMat(new THREE.MeshStandardMaterial({ map: conveyorTexBack, bumpMap: gripPair.bumpMap, bumpScale: 0.03, roughness: 0.38, metalness: 0.08 }))
    const conveyorMatLeft = trackMat(new THREE.MeshStandardMaterial({ map: conveyorTexLeft, bumpMap: gripPair.bumpMap, bumpScale: 0.03, roughness: 0.38, metalness: 0.08 }))
    const conveyorMatRight = trackMat(new THREE.MeshStandardMaterial({ map: conveyorTexRight, bumpMap: gripPair.bumpMap, bumpScale: 0.03, roughness: 0.38, metalness: 0.08 }))

    const poleMat = trackMat(new THREE.MeshStandardMaterial({ color: '#E2E8F0', roughness: 0.3, metalness: 0.35 }))
    const whiteTrimMat = getSurfaceMat('marble', '#F8FAFC', 1, 1, 0.28, 0.06)
    const flagInactiveMat = trackMat(new THREE.MeshStandardMaterial({ color: '#38BDF8', roughness: 0.32 }))
    const flagActiveMat = trackMat(new THREE.MeshStandardMaterial({ color: '#22C55E', roughness: 0.3 }))
    const goldMat = getSurfaceMat('marble', '#FBBF24', 1, 1, 0.24, 0.42)

    // Shared geometries
    const unitBoxGeo = trackGeo(new THREE.BoxGeometry(1, 1, 1))
    const unitCylGeo = trackGeo(new THREE.CylinderGeometry(0.5, 0.5, 1, 20))
    const poleGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.13, 3.3, 10))
    const flagGeo = trackGeo(new THREE.BoxGeometry(1.15, 0.72, 0.1))
    const signBoardGeo = trackGeo(new THREE.BoxGeometry(1.75, 0.9, 0.14))
    const spinnerHubGeo = trackGeo(new THREE.CylinderGeometry(0.45, 0.56, 0.8, 14))

    // Build 10 zone groups for instant culling (always 60 FPS across all 100 levels!)
    const zoneGroups: THREE.Group[] = Array.from({ length: 10 }, () => {
      const g = new THREE.Group()
      scene.add(g)
      return g
    })

    const runtimeBlocks: RuntimeBlock[] = []
    const checkpointFlagMap = new Map<number, THREE.Mesh>()

    for (const b of course.blocks) {
      const zg = zoneGroups[b.zone]
      let mat: THREE.MeshStandardMaterial
      let geo: THREE.BufferGeometry = unitBoxGeo

      // Proportional UV repeats so long bridges & wide decks stay razor-crisp (never stretched!)
      const rx = Math.max(1, Math.min(6, Math.round(b.w / 3.2)))
      const rz = Math.max(1, Math.min(8, Math.round(Math.max(b.d, b.h) / 3.2)))

      if (b.kind === 'hazard' || b.kind === 'spinner') {
        mat = hazardMat
      } else if (b.kind === 'jumppad') {
        mat = jumpPadMat
      } else if (b.kind === 'ice') {
        mat = iceMat
      } else if (b.kind === 'conveyor') {
        const vx = b.conveyorVx ?? 0
        const vz = b.conveyorVz ?? 0
        if (Math.abs(vx) > Math.abs(vz)) {
          mat = vx > 0 ? conveyorMatRight : conveyorMatLeft
        } else {
          mat = vz <= 0 ? conveyorMatFwd : conveyorMatBack
        }
      } else if (b.kind === 'checkpoint') {
        mat = getSurfaceMat('marble', b.color, Math.max(2, rx), Math.max(2, rz), 0.28, b.checkpointStage === 100 ? 0.28 : 0.06)
      } else if (b.kind === 'fade') {
        mat = trackMat(
          new THREE.MeshStandardMaterial({
            color: b.color,
            map: marblePair.map,
            bumpMap: marblePair.bumpMap,
            bumpScale: marblePair.defaultBumpScale,
            roughness: 0.28,
            metalness: 0.06,
            transparent: true,
            opacity: 1,
          }),
        )
      } else if (b.kind === 'fake') {
        // Frosted semi-transparent glass (smooth, no architectural bevels — observant players can spot the real marble slabs!)
        mat = trackMat(
          new THREE.MeshStandardMaterial({
            color: b.color,
            roughness: 0.12,
            metalness: 0.1,
            transparent: true,
            opacity: 0.62,
          }),
        )
      } else if (b.kind === 'pillar') {
        geo = unitCylGeo
        mat = getSurfaceMat('fluted', b.color, 2, 1, 0.34, 0.06)
      } else if (b.kind === 'bounce') {
        geo = unitCylGeo
        mat = getSurfaceMat('grip', b.color, 2, 2, 0.26, 0.08)
      } else if (b.kind === 'pusher') {
        mat = getSurfaceMat('grip', b.color, 2, 1, 0.3, 0.16)
      } else if (b.kind === 'decor') {
        mat = getSurfaceMat('fluted', b.color, 1, Math.max(1, Math.round(b.h / 2.5)), 0.36, 0.06)
      } else if (b.kind === 'moving') {
        mat = getSurfaceMat('terrazzo', b.color, rx, rz, 0.32, 0.1)
      } else {
        mat = getSurfaceMat('facetTile', b.color, rx, rz, 0.32, 0.07)
      }

      const mesh = new THREE.Mesh(geo, mat)
      mesh.scale.set(b.w, b.h, b.d)
      mesh.position.set(b.x, b.y, b.z)
      mesh.receiveShadow = b.kind !== 'hazard' && b.kind !== 'spinner'
      mesh.castShadow = b.kind === 'moving' || b.kind === 'spinner' || b.kind === 'pusher' || b.kind === 'decor'
      zg.add(mesh)

      const rb: RuntimeBlock = {
        def: b,
        mesh,
        curX: b.x,
        curY: b.y,
        curZ: b.z,
        prevX: b.x,
        prevY: b.y,
        prevZ: b.z,
        fadeState: 'solid',
        fadeTimer: 0,
        spinAngle: b.spinnerPhase ?? 0,
        bouncePulse: 0,
      }

      if (b.kind === 'spinner') {
        const hub = new THREE.Mesh(spinnerHubGeo, poleMat)
        hub.position.set(b.x, b.y - 0.05, b.z)
        zg.add(hub)
        if (b.spinnerCross) {
          const cross = new THREE.Mesh(unitBoxGeo, hazardMat)
          cross.scale.set(b.w, b.h, b.d)
          cross.position.set(b.x, b.y, b.z)
          cross.rotation.y = (b.spinnerPhase ?? 0) + Math.PI / 2
          cross.castShadow = true
          zg.add(cross)
          rb.crossBladeMesh = cross
        }
      }

      if (b.kind === 'bounce') {
        // Clean white top ring on bounce cushion
        const ring = new THREE.Mesh(unitCylGeo, whiteTrimMat)
        ring.scale.set(b.w * 0.66, 0.08, b.d * 0.66)
        ring.position.set(b.x, b.y + b.h / 2 + 0.04, b.z)
        zg.add(ring)
      }

      if (b.kind === 'jumppad') {
        // Clean gold trim pad on top of jump pad
        const trim = new THREE.Mesh(unitBoxGeo, goldMat)
        trim.scale.set(b.w * 0.72, 0.08, b.d * 0.72)
        trim.position.set(b.x, b.y + b.h / 2 + 0.04, b.z)
        zg.add(trim)
      }

      if (b.kind === 'checkpoint' && b.checkpointStage) {
        const stg = b.checkpointStage
        const topY = b.y + b.h / 2
        const cornerX = b.x + b.w / 2 - 0.9
        const cornerZ = b.z - b.d / 2 + 0.9

        // Checkpoint pole & color-changing flag
        const pole = new THREE.Mesh(poleGeo, poleMat)
        pole.position.set(cornerX, topY + 1.65, cornerZ)
        zg.add(pole)

        const flag = new THREE.Mesh(
          flagGeo,
          stg <= maxUnlockedRef.current ? flagActiveMat : flagInactiveMat,
        )
        flag.position.set(cornerX - 0.62, topY + 2.85, cornerZ)
        zg.add(flag)
        rb.flagMesh = flag
        checkpointFlagMap.set(stg, flag)

        // Stage number sign on left corner of platform
        const signTex = makeStageSignTexture(stg, stg === 100)
        texturesToDispose.push(signTex)
        const signMat = trackMat(new THREE.MeshBasicMaterial({ map: signTex }))
        const signSideMat = trackMat(new THREE.MeshStandardMaterial({ color: '#1E293B', roughness: 0.4 }))
        const signPost = new THREE.Mesh(poleGeo, poleMat)
        signPost.scale.set(0.85, 0.62, 0.85)
        signPost.position.set(b.x - b.w / 2 + 1.1, topY + 1.0, cornerZ)
        zg.add(signPost)

        const signBoard = new THREE.Mesh(signBoardGeo, [
          signSideMat,
          signSideMat,
          signSideMat,
          signSideMat,
          signMat,
          signMat,
        ])
        signBoard.position.set(b.x - b.w / 2 + 1.1, topY + 2.15, cornerZ)
        zg.add(signBoard)
      }

      runtimeBlocks.push(rb)
    }

    // Celebratory Stage 100 Golden Trophy + Floating Paper Confetti (Zero Neon!)
    const finishCp = course.checkpoints[99]
    const trophyGroup = new THREE.Group()
    if (finishCp) {
      const base = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.95, 1.15, 0.45, 16)), goldMat)
      base.position.y = 0.22
      const stem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.28, 0.36, 1.1, 14)), goldMat)
      stem.position.y = 0.95
      const cup = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.15, 0.55, 1.45, 18)), goldMat)
      cup.position.y = 2.1
      const crown = new THREE.Mesh(
        trackGeo(new RoundedBoxGeometry(0.9, 0.9, 0.9, 3, 0.12)),
        getSurfaceMat('ice', '#38BDF8', 1, 1, 0.16, 0.28),
      )
      crown.position.y = 3.25
      trophyGroup.add(base, stem, cup, crown)
      trophyGroup.position.set(finishCp.x, finishCp.y + 1.45, finishCp.z - 3.6)
      zoneGroups[9].add(trophyGroup)
    }

    // Confetti pieces floating around Stage 100 island
    const confettiColors = ['#38BDF8', '#FACC15', '#34D399', '#F472B6', '#FFFFFF']
    const confettiMeshes: Array<{ mesh: THREE.Mesh; baseY: number; phase: number; speed: number }> = []
    if (finishCp) {
      const confGeo = trackGeo(new THREE.BoxGeometry(0.38, 0.1, 0.38))
      for (let i = 0; i < 36; i++) {
        const cm = new THREE.Mesh(
          confGeo,
          getSurfaceMat('facetTile', confettiColors[i % confettiColors.length], 1, 1, 0.32, 0.05),
        )
        const ang = (i / 36) * Math.PI * 2
        const rad = 3.5 + (i % 5) * 1.4
        const by = finishCp.y + 2.5 + (i % 6) * 0.9
        cm.position.set(finishCp.x + Math.cos(ang) * rad, by, finishCp.z + Math.sin(ang) * rad)
        zoneGroups[9].add(cm)
        confettiMeshes.push({ mesh: cm, baseY: by, phase: i * 0.6, speed: 1.4 + (i % 4) * 0.35 })
      }
    }

    // Fluffy scenic FreshBlox clouds distributed along the 100-stage ascent
    const cloudMat = trackMat(new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.85, metalness: 0 }))
    const cloudGeo = trackGeo(new RoundedBoxGeometry(1, 1, 1, 2, 0.22))
    for (let i = 0; i < 10; i++) {
      const cpSample = course.checkpoints[Math.min(99, i * 10 + 4)]
      if (!cpSample) continue
      for (let side = -1; side <= 1; side += 2) {
        const cg = new THREE.Group()
        const c1 = new THREE.Mesh(cloudGeo, cloudMat)
        c1.scale.set(9, 2.4, 5.5)
        const c2 = new THREE.Mesh(cloudGeo, cloudMat)
        c2.scale.set(6, 2.8, 4.5)
        c2.position.set(2.2, 1.0, 0.4)
        cg.add(c1, c2)
        cg.position.set(cpSample.x + side * (22 + (i % 3) * 6), cpSample.y + 4 + (i % 3) * 2.5, cpSample.z - 10)
        zoneGroups[i].add(cg)
      }
    }

    // Helper: update which zones are visible based on current stage
    const updateZoneVisibility = (stage: number) => {
      const activeZone = Math.min(9, Math.floor((stage - 1) / 10))
      for (let z = 0; z < 10; z++) {
        zoneGroups[z].visible = z >= activeZone - 1 && z <= activeZone + 2
      }
    }
    updateZoneVisibility(currentStageRef.current)

    // === LOCAL R6 PLAYER ===
    const startCp = course.checkpoints[Math.max(0, Math.min(99, currentStageRef.current - 1))]
    const localRig = createR6Rig({
      avatar: displayedAvatarRef.current,
      username: usernameRef.current,
      rank: rankRef.current,
      showNameplate: true,
      castShadow: qualityRef.current !== 'low',
    })
    localRig.root.position.set(startCp.x, startCp.spawnY, startCp.z)
    scene.add(localRig.root)
    localRigRef.current = localRig

    interface LedgeMantleState {
      elapsed: number
      duration: number
      startX: number
      startY: number
      startZ: number
      grabX: number
      grabY: number
      grabZ: number
      endX: number
      endY: number
      endZ: number
      faceYaw: number
      block: RuntimeBlock
    }

    const player = {
      x: startCp.x,
      y: startCp.spawnY,
      z: startCp.z,
      vx: 0,
      vy: 0,
      vz: 0,
      rotY: Math.PI, // face -Z along the course!
      grounded: true,
      coyoteTimer: 0.15,
      jumpBufferTimer: 0,
      pose: 'idle' as PlayerPose,
      wasGrounded: true,
      standingBlock: null as RuntimeBlock | null,
      mantle: null as LedgeMantleState | null,
      mantleCooldown: 0,
    }

    // Third-person orbit camera (facing -Z initially!)
    const camState = {
      yaw: 0,
      pitch: 0.34,
      dist: 11.2,
      dragging: false,
      lastX: 0,
      lastY: 0,
      lookTarget: new THREE.Vector3(startCp.x, startCp.spawnY + 2.0, startCp.z),
      wardrobeOffset: 0,
    }

    focusWardrobeCamRef.current = () => {
      camState.yaw = player.rotY
      camState.pitch = 0.14
    }

    const respawnToStage = (stage: number, resetTimer = false) => {
      const cp = course.checkpoints[Math.max(0, Math.min(99, stage - 1))]
      if (!cp) return
      player.x = cp.x
      player.y = cp.spawnY + 0.3
      player.z = cp.z
      player.vx = 0
      player.vy = 0
      player.vz = 0
      player.rotY = Math.PI
      player.grounded = false
      player.standingBlock = null
      player.mantle = null
      player.mantleCooldown = 0
      player.coyoteTimer = 0
      player.jumpBufferTimer = 0
      camState.yaw = 0
      camState.pitch = 0.34
      updateZoneVisibility(stage)
      if (resetTimer) {
        runStartTimeRef.current = Date.now()
      }
    }
    respawnToStageRef.current = respawnToStage

    recenterCamRef.current = () => {
      camState.yaw = 0
      camState.pitch = 0.34
      sfx.playClick()
    }

    // Mouse / Touch camera controls + Desktop Mouse Lock (Click 3D / Tab / M — no dragging needed!)
    const dom = renderer.domElement
    const activeTouchPointers = new Map<number, { x: number; y: number }>()
    let lastPinchDist = 0

    const requestLockSafe = () => {
      if (touchModeRef.current) return
      if (document.pointerLockElement === dom) return
      try {
        const res = (dom.requestPointerLock as unknown as () => Promise<void> | void)?.()
        if (res && typeof (res as Promise<void>).catch === 'function') {
          ;(res as Promise<void>).catch(() => {})
        }
      } catch {
        // Ignore browser rejection if called without user gesture
      }
    }

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === dom
      if (!locked && shiftLockRef.current) {
        pointerLockReleasedAtRef.current = performance.now()
      }
      shiftLockRef.current = locked
      setShiftLockActive(locked)
      if (locked) {
        camState.dragging = false
      }
    }
    document.addEventListener('pointerlockchange', onPointerLockChange)

    lockMouseRef.current = () => {
      requestLockSafe()
    }

    toggleShiftLockRef.current = () => {
      if (document.pointerLockElement === dom) {
        document.exitPointerLock?.()
      } else {
        requestLockSafe()
      }
      sfx.playClick()
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        activeTouchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (activeTouchPointers.size === 1) {
          camState.dragging = true
          camState.lastX = e.clientX
          camState.lastY = e.clientY
        } else if (activeTouchPointers.size === 2) {
          const pts = Array.from(activeTouchPointers.values())
          lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
        }
        return
      }
      // Desktop PC: Left-clicking the 3D scene automatically locks the mouse when Mouse Lock mode is on!
      if (
        !touchModeRef.current &&
        clickToLockRef.current &&
        e.button === 0 &&
        document.pointerLockElement !== dom &&
        !hubOpenRef.current &&
        !wardrobeOpenRef.current &&
        !shortcutsOpenRef.current &&
        !feedbackOpenRef.current
      ) {
        const activeEl = document.activeElement as HTMLElement | null
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'BUTTON')) {
          activeEl.blur()
        }
        requestLockSafe()
        return
      }
      if (e.button === 0 || e.button === 2) {
        camState.dragging = true
        camState.lastX = e.clientX
        camState.lastY = e.clientY
      }
    }

    let lastLockMoveTs = 0
    const applyPointerLockDelta = (mx: number, my: number, ts: number) => {
      if (ts === lastLockMoveTs) return
      lastLockMoveTs = ts
      // Guard against occasional Chromium huge jump spikes right after pointer lock engages
      if (Math.abs(mx) > 350 || Math.abs(my) > 350) return
      const s = mouseSensRef.current
      camState.yaw -= mx * 0.0038 * s
      camState.pitch = Math.max(0.05, Math.min(1.18, camState.pitch + my * 0.0034 * s))
    }

    const onLockedMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === dom) {
        applyPointerLockDelta(e.movementX, e.movementY, e.timeStamp)
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (document.pointerLockElement === dom) {
        applyPointerLockDelta(e.movementX, e.movementY, e.timeStamp)
        return
      }
      if (e.pointerType === 'touch') {
        if (!activeTouchPointers.has(e.pointerId)) return
        activeTouchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (activeTouchPointers.size === 2) {
          const pts = Array.from(activeTouchPointers.values())
          const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
          if (lastPinchDist > 0) {
            camState.dist = Math.max(5.5, Math.min(20, camState.dist - (dist - lastPinchDist) * 0.04))
          }
          lastPinchDist = dist
          return
        }
      }
      if (!camState.dragging) return
      const dx = e.clientX - camState.lastX
      const dy = e.clientY - camState.lastY
      camState.lastX = e.clientX
      camState.lastY = e.clientY
      const sens = e.pointerType === 'touch' ? 0.0082 : 0.0055 * mouseSensRef.current
      camState.yaw -= dx * sens
      camState.pitch = Math.max(0.05, Math.min(1.18, camState.pitch + dy * sens))
    }

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        activeTouchPointers.delete(e.pointerId)
        if (activeTouchPointers.size < 2) lastPinchDist = 0
        if (activeTouchPointers.size === 0) camState.dragging = false
        return
      }
      camState.dragging = false
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      camState.dist = Math.max(5.5, Math.min(20, camState.dist + e.deltaY * 0.01))
    }

    const onContextMenu = (e: MouseEvent) => e.preventDefault()

    dom.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    document.addEventListener('mousemove', onLockedMouseMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    dom.addEventListener('wheel', onWheel, { passive: false })
    dom.addEventListener('contextmenu', onContextMenu)

    // === MULTIPLAYER SYNC (Supabase Realtime + BroadcastChannel) ===
    const remotes = new Map<string, RemoteObbyEntity>()
    const avatarKeyOf = (a: R6AvatarConfig) => `${a.outfitId}|${a.hatId}|${a.faceId}|${a.skinColor}`

    const rebuildRoster = () => {
      const list = [
        {
          id: playerId,
          username: usernameRef.current,
          rank: rankRef.current,
          stage: currentStageRef.current,
          isSelf: true,
        },
        ...Array.from(remotes.values()).map((r) => ({
          id: r.id,
          username: r.username,
          rank: r.rank,
          stage: r.stage,
        })),
      ].sort((a, b) => b.stage - a.stage)
      setRoster(list)
      setOnlineCount(1 + remotes.size)
    }
    rebuildRoster()

    const mp = new LobbyMultiplayerClient({
      roomId: roomCode,
      world: 'obby',
      selfId: playerId,
      onState: (state: RemotePlayerState) => {
        const nextKey = avatarKeyOf(state.avatar)
        let ent = remotes.get(state.id)
        if (!ent) {
          const rig = createR6Rig({
            avatar: state.avatar,
            username: state.username,
            rank: state.rank,
            showNameplate: true,
            castShadow: qualityRef.current !== 'low',
          })
          rig.root.position.set(state.x, state.y, state.z)
          scene.add(rig.root)
          ent = {
            id: state.id,
            username: state.username,
            rank: state.rank,
            stage: state.stage ?? 1,
            avatarKey: nextKey,
            rig,
            targetPos: new THREE.Vector3(state.x, state.y, state.z),
            currentPos: new THREE.Vector3(state.x, state.y, state.z),
            targetRotY: state.rotY,
            pose: state.pose,
            lastSeen: Date.now(),
          }
          remotes.set(state.id, ent)
          rebuildRoster()
        } else {
          if (ent.avatarKey !== nextKey || ent.username !== state.username) {
            const pos = ent.rig.root.position.clone()
            const rotY = ent.rig.root.rotation.y
            scene.remove(ent.rig.root)
            ent.rig.dispose()
            const freshRig = createR6Rig({
              avatar: state.avatar,
              username: state.username,
              rank: state.rank,
              showNameplate: true,
              castShadow: qualityRef.current !== 'low',
            })
            freshRig.root.position.copy(pos)
            freshRig.root.rotation.y = rotY
            scene.add(freshRig.root)
            ent.rig = freshRig
            ent.avatarKey = nextKey
            ent.username = state.username
          }
          const stageChanged = (state.stage ?? 1) !== ent.stage
          ent.stage = state.stage ?? 1
          ent.targetPos.set(state.x, state.y, state.z)
          ent.targetRotY = state.rotY
          ent.pose = state.pose
          ent.lastSeen = Date.now()
          if (stageChanged) rebuildRoster()
        }
      },
      onLeave: (id: string) => {
        const ent = remotes.get(id)
        if (ent) {
          scene.remove(ent.rig.root)
          ent.rig.dispose()
          remotes.delete(id)
          rebuildRoster()
        }
      },
      onChat: (msg: LobbyChatMessage) => {
        setChatMessages((prev) => [...prev.slice(-45), msg])
        if (!chatOpenRef.current) setUnreadCount((c) => Math.min(99, c + 1))
        const ent = remotes.get(msg.senderId)
        if (ent) {
          ent.rig.setSpeech(msg.text)
          window.setTimeout(() => ent.rig.setSpeech(null), 5000)
        }
        sfx.playChatPop()
      },
      onHistory: (history) => {
        setChatMessages((prev) => {
          const existing = new Set(prev.map((m) => m.id))
          const merged = [...prev, ...history.filter((h) => !existing.has(h.id))]
          return merged.slice(-50)
        })
      },
    })
    mp.connect()
    mpRef.current = mp

    // === MAIN SIMULATION & RENDER LOOP ===
    const WALK_SPEED = 11.4
    const SPRINT_SPEED = 16.4
    const JUMP_VEL = 13.8
    const GRAVITY = -34
    const STEP_HEIGHT = 0.56
    const PLAYER_R = 0.52 // Tight body radius matching visual R6 avatar limbs/torso
    const LAND_R = 0.56 // Slightly forgiving foot radius for fair platform edge landings
    const HAZARD_R = 0.34 // Fair hurtbox radius inside visual feet/torso (no invisible-air deaths!)
    const PLAYER_H = 3.15

    let lastFrame = performance.now()
    let simTime = 0
    let lastBroadcast = 0
    let rafId = 0

    const onResize = () => {
      if (!container) return
      const w = container.clientWidth || window.innerWidth
      const h = container.clientHeight || window.innerHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(container)
    window.addEventListener('resize', onResize)

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - lastFrame) / 1000)
      lastFrame = now
      simTime += dt

      // Animate conveyor belt chevron texture smoothly!
      conveyorTexFwd.offset.y = (simTime * 1.8) % 1
      conveyorTexBack.offset.y = -(simTime * 1.4) % 1
      conveyorTexLeft.offset.x = (simTime * 1.5) % 1
      conveyorTexRight.offset.x = -(simTime * 1.5) % 1

      const activeStg = currentStageRef.current
      const activeZone = Math.min(9, Math.floor((activeStg - 1) / 10))

      // 1. Update dynamic blocks (moving platforms, pushers, fading/fake tiles, bounce pads, spinners)
      for (const rb of runtimeBlocks) {
        if (rb.def.zone < activeZone - 1 || rb.def.zone > activeZone + 2) continue

        rb.prevX = rb.curX
        rb.prevY = rb.curY
        rb.prevZ = rb.curZ

        if (rb.def.kind === 'moving') {
          const amp = rb.def.moveAmp ?? 2.5
          const ampY = rb.def.moveAmpY ?? amp
          const spd = rb.def.moveSpeed ?? 1.5
          const ph = rb.def.movePhase ?? 0
          const s = Math.sin(simTime * spd + ph)
          if (rb.def.moveAxis === 'xy') {
            rb.curX = rb.def.x + s * amp
            rb.curY = rb.def.y + Math.cos(simTime * spd + ph) * ampY
            rb.curZ = rb.def.z
          } else {
            rb.curX = rb.def.x + (rb.def.moveAxis === 'x' ? s * amp : 0)
            rb.curY = rb.def.y + (rb.def.moveAxis === 'y' ? s * amp : 0)
            rb.curZ = rb.def.z + (rb.def.moveAxis === 'z' ? s * amp : 0)
          }
          rb.mesh.position.set(rb.curX, rb.curY, rb.curZ)
        } else if (rb.def.kind === 'pusher') {
          const amp = rb.def.moveAmp ?? 1.65
          const spd = rb.def.moveSpeed ?? 2.0
          const ph = rb.def.movePhase ?? 0
          const offset = Math.sin(simTime * spd + ph) * amp
          rb.curX = rb.def.x + offset
          rb.curY = rb.def.y
          rb.curZ = rb.def.z
          rb.mesh.position.set(rb.curX, rb.curY, rb.curZ)
        } else if (rb.def.kind === 'spinner') {
          rb.spinAngle = (rb.def.spinnerPhase ?? 0) + simTime * (rb.def.spinnerSpeed ?? 1.4)
          rb.mesh.rotation.y = rb.spinAngle
          if (rb.crossBladeMesh) {
            rb.crossBladeMesh.rotation.y = rb.spinAngle + Math.PI / 2
          }
        } else if (rb.def.kind === 'bounce' && rb.bouncePulse > 0) {
          rb.bouncePulse = Math.max(0, rb.bouncePulse - dt * 5)
          const squash = 1 - Math.sin(rb.bouncePulse * Math.PI) * 0.35
          rb.mesh.scale.set(rb.def.w * (1 + (1 - squash) * 0.18), rb.def.h * squash, rb.def.d * (1 + (1 - squash) * 0.18))
        } else if (rb.def.kind === 'fade' || rb.def.kind === 'fake') {
          const shakeLimit = rb.def.kind === 'fake' ? 0.11 : 0.68
          if (rb.fadeState === 'shaking') {
            rb.fadeTimer += dt
            const frac = Math.min(1, rb.fadeTimer / shakeLimit)
            rb.mesh.position.y = rb.def.y + Math.sin(rb.fadeTimer * 44) * 0.06
            ;(rb.mesh.material as THREE.MeshStandardMaterial).opacity =
              (rb.def.kind === 'fake' ? 0.62 : 1) * (1 - frac * 0.75)
            if (rb.fadeTimer >= shakeLimit) {
              rb.fadeState = 'gone'
              rb.fadeTimer = 0
              rb.mesh.visible = false
            }
          } else if (rb.fadeState === 'gone') {
            rb.fadeTimer += dt
            if (rb.fadeTimer >= 2.3) {
              rb.fadeState = 'solid'
              rb.fadeTimer = 0
              rb.mesh.visible = true
              rb.mesh.position.y = rb.def.y
              ;(rb.mesh.material as THREE.MeshStandardMaterial).opacity = rb.def.kind === 'fake' ? 0.62 : 1
            }
          }
        }
      }

      // Animate Stage 100 trophy & confetti
      if (zoneGroups[9].visible) {
        trophyGroup.rotation.y = simTime * 1.1
        for (const c of confettiMeshes) {
          c.mesh.position.y = c.baseY + Math.sin(simTime * c.speed + c.phase) * 0.65
          c.mesh.rotation.x = simTime * 1.6 + c.phase
          c.mesh.rotation.y = simTime * 1.2 + c.phase
        }
      }

      // 2. Carry player (or active ledge mantle!) with moving platform / conveyor / ice
      let standingOnIce = false
      let convVx = 0
      let convVz = 0
      if (player.mantle) {
        const mb = player.mantle.block
        if (mb.def.kind === 'moving') {
          const mdx = mb.curX - mb.prevX
          const mdy = mb.curY - mb.prevY
          const mdz = mb.curZ - mb.prevZ
          player.mantle.startX += mdx
          player.mantle.startY += mdy
          player.mantle.startZ += mdz
          player.mantle.grabX += mdx
          player.mantle.grabY += mdy
          player.mantle.grabZ += mdz
          player.mantle.endX += mdx
          player.mantle.endY += mdy
          player.mantle.endZ += mdz
        }
      } else if (player.grounded && player.standingBlock) {
        const sb = player.standingBlock
        if (sb.def.kind === 'moving') {
          player.x += sb.curX - sb.prevX
          player.y += sb.curY - sb.prevY
          player.z += sb.curZ - sb.prevZ
        } else if (sb.def.kind === 'conveyor') {
          convVx = sb.def.conveyorVx ?? 0
          convVz = sb.def.conveyorVz ?? 0
        } else if (sb.def.kind === 'ice') {
          standingOnIce = true
        }
      }

      // 3. Movement input + smooth Q/E camera rotation
      const keys = keysRef.current
      const inputBlocked =
        wardrobeOpenRef.current ||
        feedbackOpenRef.current ||
        hubOpenRef.current ||
        shortcutsOpenRef.current
      if (!inputBlocked) {
        if (keys.has('KeyQ')) camState.yaw += 2.2 * dt
        if (keys.has('KeyE')) camState.yaw -= 2.2 * dt
      }

      let inputFwd = 0
      let inputRight = 0
      if (!inputBlocked) {
        if (keys.has('KeyW') || keys.has('ArrowUp')) inputFwd += 1
        if (keys.has('KeyS') || keys.has('ArrowDown')) inputFwd -= 1
        if (keys.has('KeyD') || keys.has('ArrowRight')) inputRight += 1
        if (keys.has('KeyA') || keys.has('ArrowLeft')) inputRight -= 1
        inputRight += joyRef.current.x
        inputFwd -= joyRef.current.y
      }
      const mag = Math.hypot(inputFwd, inputRight)
      if (mag > 1) {
        inputFwd /= mag
        inputRight /= mag
      }

      const sprinting =
        keys.has('ShiftLeft') || keys.has('ShiftRight') || touchSprintRef.current || joyRef.current.autoSprint
      const speed = sprinting ? SPRINT_SPEED : WALK_SPEED

      const camFwdX = -Math.sin(camState.yaw)
      const camFwdZ = -Math.cos(camState.yaw)
      const camRightX = Math.cos(camState.yaw)
      const camRightZ = -Math.sin(camState.yaw)

      const moveX = camFwdX * inputFwd + camRightX * inputRight
      const moveZ = camFwdZ * inputFwd + camRightZ * inputRight

      // Helper: trigger checkpoint / fade tile upon stepping or mantling onto a platform
      const handleLandedBlockEffects = (landedBlock: RuntimeBlock) => {
        if (landedBlock.def.kind === 'fade' && landedBlock.fadeState === 'solid') {
          landedBlock.fadeState = 'shaking'
          landedBlock.fadeTimer = 0
        }
        if (landedBlock.def.kind === 'checkpoint' && landedBlock.def.checkpointStage) {
          const stg = landedBlock.def.checkpointStage
          if (stg > currentStageRef.current) {
            currentStageRef.current = stg
            setCurrentStage(stg)
            if (stg > maxUnlockedRef.current) {
              maxUnlockedRef.current = stg
              setMaxUnlockedStage(stg)
            }
            updateZoneVisibility(stg)
            const flagMesh = checkpointFlagMap.get(stg)
            if (flagMesh) flagMesh.material = flagActiveMat

            const nowElapsed = Date.now() - runStartTimeRef.current
            if (stg === 100) {
              sfx.playQuestClaim()
              setFinishedBanner({ elapsedMs: nowElapsed })
              callbacksRef.current.onStageReached(100, nowElapsed)
              showToast(`👑 ${t.obbyFinishedTitle}`)
            } else {
              sfx.playGemCollect()
              callbacksRef.current.onStageReached(stg)
              showToast(`Stage ${stg} / 100 ✓`)
            }
            rebuildRoster()
          }
        }
      }

      // Tick mantle cooldown
      player.mantleCooldown = Math.max(0, player.mantleCooldown - dt)

      // Update jump buffer (generous 180ms buffer + instant hold-to-jump — zero felt cooldown!)
      const holdJump = !inputBlocked && (jumpHeldRef.current || keys.has('Space'))
      if (jumpRequestRef.current && !inputBlocked) {
        player.jumpBufferTimer = 0.18
        jumpRequestRef.current = false
      } else {
        player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt)
      }

      const isSolidPlatformKind = (k: RuntimeBlock['def']['kind']) =>
        k === 'solid' ||
        k === 'checkpoint' ||
        k === 'moving' ||
        k === 'ice' ||
        k === 'conveyor' ||
        k === 'pillar' ||
        k === 'fade'

      // Verify standing headroom at candidate climb-up destination
      const hasHeadroomAt = (tx: number, ty: number, tz: number, ignore: RuntimeBlock): boolean => {
        for (const ob of runtimeBlocks) {
          if (ob === ignore || !isSolidPlatformKind(ob.def.kind)) continue
          if (ob.def.kind === 'fade' && ob.fadeState === 'gone') continue
          if (Math.abs(ob.curZ - tz) > Math.max(ob.def.d, ob.def.w) * 0.5 + 3) continue
          const oTop = ob.curY + ob.def.h / 2
          const oBot = ob.curY - ob.def.h / 2
          if (ty + PLAYER_H - 0.1 <= oBot || ty + 0.15 >= oTop) continue
          const oHW = ob.def.w / 2
          const oHD = ob.def.d / 2
          if (ob.def.kind === 'pillar') {
            const rad = oHW + PLAYER_R * 0.72
            if ((tx - ob.curX) ** 2 + (tz - ob.curZ) ** 2 < rad * rad) return false
          } else {
            if (
              tx > ob.curX - oHW - PLAYER_R * 0.75 &&
              tx < ob.curX + oHW + PLAYER_R * 0.75 &&
              tz > ob.curZ - oHD - PLAYER_R * 0.75 &&
              tz < ob.curZ + oHD + PLAYER_R * 0.75
            ) {
              return false
            }
          }
        }
        return true
      }

      // === ACTIVE LEDGE GRAB & CLIMB-UP MANTLE ===
      if (player.mantle) {
        const m = player.mantle
        // If a fading tile vanishes mid-climb, abort cleanly so player falls
        if (m.block.def.kind === 'fade' && m.block.fadeState === 'gone') {
          player.mantle = null
          player.grounded = false
          player.standingBlock = null
          player.vy = -1.5
        } else {
          m.elapsed += dt
          const p = Math.min(1, m.elapsed / m.duration)
          // Rotate smoothly to face the platform ledge during climb
          let diff = m.faceYaw - player.rotY
          while (diff > Math.PI) diff -= Math.PI * 2
          while (diff < -Math.PI) diff += Math.PI * 2
          player.rotY += diff * Math.min(1, dt * 22)

          if (p < 0.3) {
            // Phase 1: Hands catch the ledge lip against the side wall
            const k = 1 - Math.pow(1 - p / 0.3, 2)
            player.x = m.startX + (m.grabX - m.startX) * k
            player.y = m.startY + (m.grabY - m.startY) * k
            player.z = m.startZ + (m.grabZ - m.startZ) * k
          } else {
            // Phase 2: Lift body cleanly UP first, then glide forward onto the top deck (never clips corner!)
            const t = (p - 0.3) / 0.7
            const ty = 1 - Math.pow(1 - Math.min(1, t / 0.76), 2)
            const rawXZ = Math.max(0, Math.min(1, (t - 0.22) / 0.78))
            const txz = rawXZ < 0.5 ? 4 * rawXZ * rawXZ * rawXZ : 1 - Math.pow(-2 * rawXZ + 2, 3) / 2
            player.x = m.grabX + (m.endX - m.grabX) * txz
            player.y = m.grabY + (m.endY - m.grabY) * ty
            player.z = m.grabZ + (m.endZ - m.grabZ) * txz
          }

          player.vx = 0
          player.vy = 0
          player.vz = 0
          player.grounded = false
          player.pose = 'mantle'

          if (p >= 1) {
            player.x = m.endX
            player.y = m.endY
            player.z = m.endZ
            player.vy = 0
            player.grounded = true
            player.coyoteTimer = 0.16
            player.standingBlock = m.block
            player.mantle = null
            player.mantleCooldown = 0.14
            handleLandedBlockEffects(m.block)
            // If player buffered or held jump at the end of mantle, launch smoothly right away!
            if (player.jumpBufferTimer > 0) {
              player.vy = JUMP_VEL
              player.grounded = false
              player.standingBlock = null
              player.coyoteTimer = 0
              player.jumpBufferTimer = 0
              sfx.playJump()
            }
          }
        }
      } else {
        // Horizontal movement acceleration
        if (mag > 0.08) {
          activeEmoteRef.current = null
          const targetVx = moveX * speed + convVx
          const targetVz = moveZ * speed + convVz
          if (standingOnIce) {
            const iceAccel = Math.min(1, dt * 3.1)
            player.vx += (targetVx - player.vx) * iceAccel
            player.vz += (targetVz - player.vz) * iceAccel
          } else {
            const groundAccel = player.grounded ? Math.min(1, dt * 22) : Math.min(1, dt * 11.5)
            player.vx += (targetVx - player.vx) * groundAccel
            player.vz += (targetVz - player.vz) * groundAccel
          }
          if (shiftLockRef.current && shiftLockAlignRef.current) {
            const desiredRot = camState.yaw + Math.PI
            let diff = desiredRot - player.rotY
            while (diff > Math.PI) diff -= Math.PI * 2
            while (diff < -Math.PI) diff += Math.PI * 2
            player.rotY += diff * Math.min(1, dt * 18)
          } else {
            const desiredRot = Math.atan2(moveX, moveZ)
            let diff = desiredRot - player.rotY
            while (diff > Math.PI) diff -= Math.PI * 2
            while (diff < -Math.PI) diff += Math.PI * 2
            player.rotY += diff * Math.min(1, dt * 15)
          }
        } else {
          if (shiftLockRef.current && shiftLockAlignRef.current) {
            const desiredRot = camState.yaw + Math.PI
            let diff = desiredRot - player.rotY
            while (diff > Math.PI) diff -= Math.PI * 2
            while (diff < -Math.PI) diff += Math.PI * 2
            player.rotY += diff * Math.min(1, dt * 16)
          }
          if (standingOnIce) {
            const iceGlide = Math.max(0, 1 - dt * 1.45)
            player.vx *= iceGlide
            player.vz *= iceGlide
          } else {
            const stopRate = Math.min(1, dt * 16)
            player.vx += (convVx - player.vx) * stopRate
            player.vz += (convVz - player.vz) * stopRate
          }
        }

        // Coyote Time (150ms forgiveness when stepping off ledges!)
        if (player.grounded) {
          player.coyoteTimer = 0.15
        } else {
          player.coyoteTimer = Math.max(0, player.coyoteTimer - dt)
        }

        // Instant zero-cooldown jump execution (tap buffer OR held jump on ground!)
        const tryExecuteJump = () => {
          if (inputBlocked) return false
          const canJump = player.grounded || player.coyoteTimer > 0
          const wantsJump = player.jumpBufferTimer > 0 || (holdJump && player.grounded)
          if (canJump && wantsJump) {
            player.vy = JUMP_VEL
            player.grounded = false
            player.standingBlock = null
            player.coyoteTimer = 0
            player.jumpBufferTimer = 0
            activeEmoteRef.current = null
            sfx.playJump()
            return true
          }
          return false
        }

        tryExecuteJump()

        // 4. Sub-stepped 3D collision resolution (ZERO tunneling, solid side walls, ceiling checks, & Ledge Grab!)
        const subSteps = Math.max(1, Math.min(4, Math.ceil(dt / 0.011)))
        const sdt = dt / subSteps

        // Exact inverse-Y rotation (matching Three.js mesh.rotation.y = angle!) + circle-vs-OBB hurtbox!
        const testSpinnerBlade = (angle: number, rb: RuntimeBlock, px: number, py: number, pz: number) => {
          const dx = px - rb.curX
          const dz = pz - rb.curZ
          // Three.js Ry(angle) maps local (lx, lz) -> world (cos*lx + sin*lz, -sin*lx + cos*lz)
          // Inverse transpose maps world (dx, dz) -> local (cos*dx - sin*dz, sin*dx + cos*dz)
          const cos = Math.cos(angle)
          const sin = Math.sin(angle)
          const lx = dx * cos - dz * sin
          const lz = dx * sin + dz * cos

          const halfLen = Math.max(0.1, rb.def.w / 2 - 0.06)
          const halfThick = Math.max(0.08, rb.def.d / 2 - 0.04)
          const closestX = Math.max(-halfLen, Math.min(halfLen, lx))
          const closestZ = Math.max(-halfThick, Math.min(halfThick, lz))
          const ox = lx - closestX
          const oz = lz - closestZ
          if (ox * ox + oz * oz > HAZARD_R * HAZARD_R) return false

          const barMinY = rb.curY - rb.def.h / 2
          const barMaxY = rb.curY + rb.def.h / 2
          return py < barMaxY - 0.12 && py + PLAYER_H - 0.18 > barMinY
        }

        let hitHazard = false
        let startedMantle = false

        for (let step = 0; step < subSteps; step++) {
          player.vy += GRAVITY * sdt

          const prevX = player.x
          const prevY = player.y
          const prevZ = player.z
          let nextX = prevX + player.vx * sdt
          let nextZ = prevZ + player.vz * sdt
          let nextY = prevY + player.vy * sdt

          let groundedNow = false
          let landedBlock: RuntimeBlock | null = null
          let hitJumpPadVel = 0
          let hitBounceBlock: RuntimeBlock | null = null
          let autoStepY = prevY

          // Pass A: Horizontal side collisions + Ledge Grab & Mantle detection against solid blocks
          for (const rb of runtimeBlocks) {
            if (rb.def.kind === 'decor') continue
            if (Math.abs(rb.curZ - nextZ) > Math.max(rb.def.d, rb.def.w) * 0.5 + 8) continue
            if ((rb.def.kind === 'fade' || rb.def.kind === 'fake') && rb.fadeState === 'gone') continue

            if (rb.def.kind === 'spinner') {
              if (
                testSpinnerBlade(rb.spinAngle, rb, nextX, nextY, nextZ) ||
                (rb.def.spinnerCross && testSpinnerBlade(rb.spinAngle + Math.PI / 2, rb, nextX, nextY, nextZ))
              ) {
                hitHazard = true
                break
              }
              continue
            }

            const halfW = rb.def.w / 2
            const halfD = rb.def.d / 2
            const topY = rb.curY + rb.def.h / 2
            const botY = rb.curY - rb.def.h / 2

            if (rb.def.kind === 'hazard') {
              // Exact circle (HAZARD_R) vs AABB hurtbox — fair corners, no invisible-air deaths!
              const cHalfW = Math.max(0.05, halfW - 0.04)
              const cHalfD = Math.max(0.05, halfD - 0.04)
              const closestX = Math.max(rb.curX - cHalfW, Math.min(rb.curX + cHalfW, nextX))
              const closestZ = Math.max(rb.curZ - cHalfD, Math.min(rb.curZ + cHalfD, nextZ))
              const ox = nextX - closestX
              const oz = nextZ - closestZ
              if (
                ox * ox + oz * oz <= HAZARD_R * HAZARD_R &&
                nextY < topY - 0.08 &&
                nextY + PLAYER_H - 0.18 > botY
              ) {
                hitHazard = true
                break
              }
              continue
            }

            if (rb.def.kind === 'pusher') {
              const inside =
                nextX >= rb.curX - halfW - PLAYER_R &&
                nextX <= rb.curX + halfW + PLAYER_R &&
                nextZ >= rb.curZ - halfD - PLAYER_R &&
                nextZ <= rb.curZ + halfD + PLAYER_R
              if (inside) {
                if (prevY < topY - 0.14 && prevY + PLAYER_H > botY + 0.08) {
                  const pushDir = nextX >= rb.curX ? 1 : -1
                  const deltaMove = rb.curX - rb.prevX
                  nextX = rb.curX + pushDir * (halfW + PLAYER_R + 0.08)
                  player.vx = (deltaMove !== 0 ? Math.sign(deltaMove) : pushDir) * 9.5
                }
              }
              continue
            }

            if (!isSolidPlatformKind(rb.def.kind)) continue

            // Only perform side-wall collision when player's body overlaps the block's vertical side span
            if (!(prevY < topY - 0.08 && prevY + PLAYER_H > botY + 0.08)) continue

            if (rb.def.kind === 'pillar') {
              const rad = halfW + PLAYER_R * 0.86
              const dx = nextX - rb.curX
              const dz = nextZ - rb.curZ
              const distSq = dx * dx + dz * dz
              if (distSq < rad * rad) {
                const ledgeDelta = topY - prevY
                if (player.grounded && ledgeDelta > 0 && ledgeDelta <= STEP_HEIGHT && hasHeadroomAt(nextX, topY, nextZ, rb)) {
                  autoStepY = Math.max(autoStepY, topY)
                } else {
                  const dist = Math.max(0.0001, Math.sqrt(distSq))
                  const nx = dx / dist
                  const nz = dz / dist

                  // Check last-second Ledge Grab & Mantle onto pillar top!
                  const towardDot =
                    (mag > 0.08 ? moveX * -nx + moveZ * -nz : 0) +
                    (player.vx * -nx + player.vz * -nz) * 0.08 +
                    (Math.sin(player.rotY) * -nx + Math.cos(player.rotY) * -nz) * 0.35
                  if (
                    !player.grounded &&
                    player.mantleCooldown <= 0 &&
                    player.vy <= 6.2 &&
                    ledgeDelta >= 0.28 &&
                    ledgeDelta <= 2.35 &&
                    (towardDot > -0.15 || holdJump || player.jumpBufferTimer > 0)
                  ) {
                    const inset = Math.min(0.45, halfW * 0.65)
                    const endX = rb.curX + nx * Math.max(0, halfW - inset)
                    const endZ = rb.curZ + nz * Math.max(0, halfW - inset)
                    if (hasHeadroomAt(endX, topY, endZ, rb)) {
                      player.mantle = {
                        elapsed: 0,
                        duration: 0.34,
                        startX: prevX,
                        startY: prevY,
                        startZ: prevZ,
                        grabX: rb.curX + nx * (rad + 0.02),
                        grabY: Math.min(topY - 1.35, Math.max(prevY, topY - 1.75)),
                        grabZ: rb.curZ + nz * (rad + 0.02),
                        endX,
                        endY: topY,
                        endZ,
                        faceYaw: Math.atan2(-nx, -nz),
                        block: rb,
                      }
                      player.pose = 'mantle'
                      activeEmoteRef.current = null
                      sfx.playLedgeGrab()
                      startedMantle = true
                      break
                    }
                  }

                  // Solid cylindrical wall pushout (prevents clipping into pillar!)
                  nextX = rb.curX + nx * (rad + 0.005)
                  nextZ = rb.curZ + nz * (rad + 0.005)
                  const vn = player.vx * nx + player.vz * nz
                  if (vn < 0) {
                    player.vx -= vn * nx
                    player.vz -= vn * nz
                  }
                }
              }
              continue
            }

            // Box AABB side collision
            const penX = halfW + PLAYER_R - Math.abs(nextX - rb.curX)
            const penZ = halfD + PLAYER_R - Math.abs(nextZ - rb.curZ)
            if (penX > 0 && penZ > 0) {
              const ledgeDelta = topY - prevY
              if (player.grounded && ledgeDelta > 0 && ledgeDelta <= STEP_HEIGHT && hasHeadroomAt(nextX, topY, nextZ, rb)) {
                autoStepY = Math.max(autoStepY, topY)
              } else {
                // Determine closest side wall normal (nx, nz) pointing OUT of the block
                let nx = 0
                let nz = 0
                if (penX < penZ) {
                  nx = nextX >= rb.curX ? 1 : -1
                } else {
                  nz = nextZ >= rb.curZ ? 1 : -1
                }

                // Check last-second Ledge Grab & Mantle!
                const towardDot =
                  (mag > 0.08 ? moveX * -nx + moveZ * -nz : 0) +
                  (player.vx * -nx + player.vz * -nz) * 0.08 +
                  (Math.sin(player.rotY) * -nx + Math.cos(player.rotY) * -nz) * 0.35

                if (
                  !player.grounded &&
                  player.mantleCooldown <= 0 &&
                  player.vy <= 6.2 &&
                  ledgeDelta >= 0.28 &&
                  ledgeDelta <= 2.35 &&
                  (towardDot > -0.15 || holdJump || player.jumpBufferTimer > 0)
                ) {
                  const grabX = nx !== 0 ? rb.curX + nx * (halfW + PLAYER_R + 0.02) : Math.max(rb.curX - halfW + 0.25, Math.min(rb.curX + halfW - 0.25, nextX))
                  const grabZ = nz !== 0 ? rb.curZ + nz * (halfD + PLAYER_R + 0.02) : Math.max(rb.curZ - halfD + 0.25, Math.min(rb.curZ + halfD - 0.25, nextZ))
                  const insetX = Math.min(0.55, halfW * 0.72)
                  const insetZ = Math.min(0.55, halfD * 0.72)
                  const endX =
                    nx !== 0
                      ? rb.curX + nx * Math.max(0, halfW - insetX)
                      : Math.max(rb.curX - halfW + 0.28, Math.min(rb.curX + halfW - 0.28, nextX))
                  const endZ =
                    nz !== 0
                      ? rb.curZ + nz * Math.max(0, halfD - insetZ)
                      : Math.max(rb.curZ - halfD + 0.28, Math.min(rb.curZ + halfD - 0.28, nextZ))

                  if (hasHeadroomAt(endX, topY, endZ, rb)) {
                    player.mantle = {
                      elapsed: 0,
                      duration: 0.34,
                      startX: prevX,
                      startY: prevY,
                      startZ: prevZ,
                      grabX,
                      grabY: Math.min(topY - 1.35, Math.max(prevY, topY - 1.75)),
                      grabZ,
                      endX,
                      endY: topY,
                      endZ,
                      faceYaw: Math.atan2(-nx, -nz),
                      block: rb,
                    }
                    player.pose = 'mantle'
                    activeEmoteRef.current = null
                    sfx.playLedgeGrab()
                    startedMantle = true
                    break
                  }
                }

                // Solid side-wall pushout (player NEVER clips through platforms when falling short!)
                if (nx !== 0) {
                  nextX = rb.curX + nx * (halfW + PLAYER_R + 0.005)
                  if (player.vx * nx < 0) player.vx = 0
                } else {
                  nextZ = rb.curZ + nz * (halfD + PLAYER_R + 0.005)
                  if (player.vz * nz < 0) player.vz = 0
                }
              }
            }
          }

          if (hitHazard || startedMantle) break

          if (autoStepY > prevY) {
            nextY = Math.max(nextY, autoStepY)
            player.vy = Math.max(0, player.vy)
          }

          // Pass B: Vertical landing, ceiling bump, bounce cushions, jump pads & fake glass
          for (const rb of runtimeBlocks) {
            if (rb.def.kind === 'decor' || rb.def.kind === 'spinner' || rb.def.kind === 'hazard') continue
            if (Math.abs(rb.curZ - nextZ) > Math.max(rb.def.d, rb.def.w) * 0.5 + 8) continue
            if ((rb.def.kind === 'fade' || rb.def.kind === 'fake') && rb.fadeState === 'gone') continue

            const halfW = rb.def.w / 2
            const halfD = rb.def.d / 2
            const topY = rb.curY + rb.def.h / 2
            const botY = rb.curY - rb.def.h / 2

            let insideXZ: boolean
            if (rb.def.kind === 'pillar' || rb.def.kind === 'bounce') {
              const rad = halfW + LAND_R * 0.9
              const dx = nextX - rb.curX
              const dz = nextZ - rb.curZ
              insideXZ = dx * dx + dz * dz <= rad * rad
            } else {
              insideXZ =
                nextX >= rb.curX - halfW - LAND_R &&
                nextX <= rb.curX + halfW + LAND_R &&
                nextZ >= rb.curZ - halfD - LAND_R &&
                nextZ <= rb.curZ + halfD + LAND_R
            }
            if (!insideXZ) continue

            if (rb.def.kind === 'jumppad') {
              if (nextY <= topY + 0.45 && nextY >= botY - 0.4) {
                hitJumpPadVel = rb.def.jumpVel ?? 22.0
              }
              continue
            }

            if (rb.def.kind === 'bounce') {
              if (player.vy <= 2 && prevY >= topY - 0.65 && nextY <= topY + 0.35) {
                hitJumpPadVel = Math.max(hitJumpPadVel, rb.def.jumpVel ?? 16.5)
                hitBounceBlock = rb
              }
              continue
            }

            if (rb.def.kind === 'fake') {
              if (prevY >= topY - 0.8 && nextY <= topY + 0.25 && rb.fadeState === 'solid') {
                rb.fadeState = 'shaking'
                rb.fadeTimer = 0
                sfx.playClick()
              }
              continue
            }

            if (rb.def.kind === 'pusher') {
              if (player.vy <= 0 && prevY >= topY - STEP_HEIGHT && nextY <= topY + 0.14) {
                if (!groundedNow || topY > nextY) {
                  nextY = topY
                  groundedNow = true
                  landedBlock = rb
                }
              }
              continue
            }

            // Solid platform: Top landing + Underside ceiling bump!
            const stickAllowance = player.standingBlock === rb && player.vy <= 0 ? 0.2 : 0.12
            if (player.vy <= 0 && prevY >= topY - STEP_HEIGHT && nextY <= topY + stickAllowance) {
              if (!groundedNow || topY > nextY) {
                nextY = topY
                groundedNow = true
                landedBlock = rb
              }
            } else if (player.vy > 0 && prevY + PLAYER_H <= botY + 0.24 && nextY + PLAYER_H >= botY) {
              // Head hits underside of overhead block (no clipping upwards through platforms!)
              nextY = botY - PLAYER_H
              player.vy = 0
            }
          }

          player.x = nextX
          player.z = nextZ
          player.y = nextY

          if (hitJumpPadVel > 0) {
            player.vy = hitJumpPadVel
            player.grounded = false
            player.standingBlock = null
            if (hitBounceBlock) {
              hitBounceBlock.bouncePulse = 1
            }
            sfx.playJumpPad()
            callbacksRef.current.onJumpPadUsed()
          } else if (groundedNow && landedBlock) {
            player.vy = 0
            player.grounded = true
            player.coyoteTimer = 0.15
            player.standingBlock = landedBlock
            handleLandedBlockEffects(landedBlock)
            // Instant re-jump on exact landing frame if Space/Jump was buffered or held (ZERO cooldown!)
            tryExecuteJump()
          } else {
            player.grounded = false
            player.standingBlock = null
          }
        }

        if (hitHazard) {
          sfx.playClick()
          respawnToStage(currentStageRef.current)
        } else if (!startedMantle) {
          // Void fall respawn check
          const cpRef = course.checkpoints[Math.max(0, Math.min(99, currentStageRef.current - 1))]
          const floorCutoff = (cpRef?.y ?? 0) - 14
          if (player.y < floorCutoff) {
            sfx.playClick()
            respawnToStage(currentStageRef.current)
          }
        }
      }

      // Determine R6 pose
      const hSpeed = Math.hypot(player.vx, player.vz)
      const activeEmote = activeEmoteRef.current
      if (player.mantle) {
        player.pose = 'mantle'
      } else if (activeEmote && now < activeEmote.until) {
        player.pose = activeEmote.pose
      } else {
        activeEmoteRef.current = null
        if (!player.grounded) {
          player.pose = player.vy > 0.5 ? 'jump' : 'fall'
        } else if (hSpeed > 12.2) {
          player.pose = 'run'
        } else if (hSpeed > 0.7) {
          player.pose = 'walk'
        } else {
          player.pose = 'idle'
        }
      }

      player.wasGrounded = player.grounded

      // Update local R6 rig
      if (localRigRef.current) {
        localRigRef.current.root.position.set(player.x, player.y, player.z)
        localRigRef.current.root.rotation.y = player.rotY
        localRigRef.current.update(dt, simTime, player.pose)
      }

      // Move sun shadow frustum & skybox with player so lighting & sky stay crisp all the way to Stage 100!
      sun.position.set(player.x + 36, player.y + 68, player.z + 28)
      sun.target.position.set(player.x, player.y, player.z - 8)
      sun.target.updateMatrixWorld()
      daySkyGroup.position.set(player.x, player.y, player.z)
      nightSkyGroup.position.set(player.x, player.y, player.z)

      // Smooth third-person camera + dressing-room framing when Live Wardrobe is open
      const inWardrobe = wardrobeOpenRef.current
      camState.wardrobeOffset += ((inWardrobe ? 1.15 : 0) - camState.wardrobeOffset) * Math.min(1, dt * 9)
      const effectiveDist = inWardrobe ? 5.85 : camState.dist
      const targetLookX = player.x + Math.cos(camState.yaw) * camState.wardrobeOffset
      const targetLookZ = player.z - Math.sin(camState.yaw) * camState.wardrobeOffset
      const desiredLook = new THREE.Vector3(targetLookX, player.y + (inWardrobe ? 1.85 : 2.1), targetLookZ)
      camState.lookTarget.lerp(desiredLook, Math.min(1, dt * 13))

      const camX = camState.lookTarget.x + Math.sin(camState.yaw) * Math.cos(camState.pitch) * effectiveDist
      const camY = camState.lookTarget.y + Math.sin(camState.pitch) * effectiveDist
      const camZ = camState.lookTarget.z + Math.cos(camState.yaw) * Math.cos(camState.pitch) * effectiveDist
      camera.position.set(camX, camY, camZ)
      camera.lookAt(camState.lookTarget)

      // 5. Update remote players
      for (const [id, ent] of remotes.entries()) {
        if (now - ent.lastSeen > 12000) {
          scene.remove(ent.rig.root)
          ent.rig.dispose()
          remotes.delete(id)
          rebuildRoster()
          continue
        }
        ent.currentPos.lerp(ent.targetPos, Math.min(1, dt * 12))
        ent.rig.root.position.copy(ent.currentPos)
        let dRot = ent.targetRotY - ent.rig.root.rotation.y
        while (dRot > Math.PI) dRot -= Math.PI * 2
        while (dRot < -Math.PI) dRot += Math.PI * 2
        ent.rig.root.rotation.y += dRot * Math.min(1, dt * 12)
        ent.rig.update(dt, simTime + 0.8, ent.pose)
      }

      // 6. Broadcast own state over Supabase Realtime + BroadcastChannel (~12 Hz)
      if (now - lastBroadcast > 85) {
        lastBroadcast = now
        mp.broadcastState({
          id: playerId,
          username: usernameRef.current,
          rank: rankRef.current,
          x: player.x,
          y: player.y,
          z: player.z,
          rotY: player.rotY,
          pose: player.pose,
          avatar: avatarRef.current,
          stage: currentStageRef.current,
          lastSeen: Date.now(),
        })
      }

      renderer.render(scene, camera)
    }

    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      if (document.pointerLockElement === dom) {
        document.exitPointerLock?.()
      }
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      window.removeEventListener('resize', onResize)
      dom.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('mousemove', onLockedMouseMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      dom.removeEventListener('wheel', onWheel)
      dom.removeEventListener('contextmenu', onContextMenu)
      mp.disconnect()
      mpRef.current = null
      localRigRef.current?.dispose()
      localRigRef.current = null
      for (const ent of remotes.values()) ent.rig.dispose()
      remotes.clear()
      for (const g of geometriesToDispose) g.dispose()
      for (const m of materialsToDispose) m.dispose()
      for (const tex of texturesToDispose) tex.dispose()
      renderer.dispose()
      rendererRef.current = null
      sceneRef.current = null
    }
  }, [course, playerId, roomCode, showToast, t.obbyFinishedTitle])

  const currentZone = OBBY_ZONES[Math.min(9, Math.floor((currentStage - 1) / 10))]
  const currentCp = course.checkpoints[Math.max(0, Math.min(99, currentStage - 1))]
  const stageTitle = currentCp ? (lang === 'pl' ? currentCp.titlePl : currentCp.titleEn) : ''
  const progressPct = Math.round((currentStage / 100) * 100)

  return (
    <div
      className="fixed inset-x-0 z-30 w-full overflow-hidden bg-sky-950 select-none"
      style={{
        top: vp.offsetTop,
        height: vp.height,
        overscrollBehavior: 'none',
      }}
    >
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="h-full w-full touch-none" />

      {/* === TOP HUD BAR (Zero-clipping across all mobile portrait, landscape & desktop viewports!) === */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-1.5 sm:gap-2"
        style={{
          paddingTop: 'max(0.45rem, calc(env(safe-area-inset-top) + 0.3rem))',
          paddingLeft: 'max(0.55rem, calc(env(safe-area-inset-left) + 0.35rem))',
          paddingRight: 'max(0.55rem, calc(env(safe-area-inset-right) + 0.35rem))',
        }}
      >
        {/* Left: FreshBlox Quick Hub + Chat toggle */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-2xl border border-white/15 bg-slate-950/65 p-1 backdrop-blur-xl shadow-lg">
            <button
              type="button"
              onClick={() => {
                setHubOpen((open) => {
                  const next = !open
                  if (next) {
                    setHubTab('overview')
                    setWardrobeOpen(false)
                    setShortcutsOpen(false)
                    if (touchMode) setChatOpen(false)
                  }
                  return next
                })
                sfx.playClick()
              }}
              title="FreshBlox Hub (H / Esc)"
              className={`flex h-8 items-center justify-center gap-1 rounded-xl px-1.5 sm:px-2 transition active:scale-95 cursor-pointer ${
                hubOpen ? 'bg-sky-500/30 ring-1 ring-sky-300/60' : 'hover:bg-white/10'
              }`}
            >
              <FreshBloxLogo size={23} />
              {!touchMode && (
                <kbd className="hidden md:inline-flex rounded border border-white/15 bg-black/35 px-1 py-0.2 font-mono text-[9px] font-bold text-sky-200/80">
                  H
                </kbd>
              )}
            </button>

            <div className="mx-0.5 h-4 w-[1px] bg-white/15" />

            <button
              type="button"
              onClick={() => {
                setChatOpen((open) => {
                  const next = !open
                  if (next) {
                    setUnreadCount(0)
                    setHubOpen(false)
                    setShortcutsOpen(false)
                    if (touchMode) setWardrobeOpen(false)
                  }
                  return next
                })
                sfx.playClick()
              }}
              title={`${t.chatTitle} (T / /)`}
              className={`relative flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold transition active:scale-95 cursor-pointer ${
                chatOpen ? 'bg-sky-500/28 text-white ring-1 ring-sky-300/50' : 'text-sky-100 hover:bg-white/10'
              }`}
            >
              <MessageSquare className="h-4 w-4 text-sky-300" />
              <span className="hidden lg:inline">{t.chatTitle}</span>
              {!touchMode && (
                <kbd className="hidden md:inline-flex rounded border border-white/15 bg-black/35 px-1 py-0.2 font-mono text-[9px] font-bold text-sky-200/80">
                  T
                </kbd>
              )}
              {unreadCount > 0 && !chatOpen && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Center: Stage 1–100 Progress Pill + Unlocked Stage Jumpers + Respawn */}
        <div className="pointer-events-auto flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5 sm:gap-2 rounded-2xl border border-white/15 bg-slate-950/72 px-2.5 py-1.5 sm:px-3.5 text-white backdrop-blur-xl shadow-lg">
            <button
              type="button"
              disabled={currentStage <= 1}
              onClick={() => jumpToStage(currentStage - 1)}
              className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 cursor-pointer"
              title={lang === 'pl' ? 'Poprzedni Stage ([)' : 'Previous Stage ([)'}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            <div className="flex flex-col items-center px-1 min-w-[115px] sm:min-w-[190px]">
              <div className="flex items-center gap-1.5 text-[11px] sm:text-sm font-black tracking-tight">
                <Flag className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                <span>
                  Stage <span className="text-sky-300">{currentStage}</span> / 100
                </span>
                <span
                  className="hidden sm:inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-extrabold leading-none"
                  style={{
                    borderColor: `${currentZone.difficultyColor}66`,
                    background: `${currentZone.difficultyColor}22`,
                    color: currentZone.difficultyColor,
                  }}
                >
                  {lang === 'pl' ? currentZone.difficultyPl : currentZone.difficultyEn}
                </span>
              </div>
              <div className="mt-0.5 flex w-full items-center gap-1.5">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="font-mono text-[9px] font-bold text-sky-200">{formatTimeMs(elapsedMs)}</span>
              </div>
              <div className="max-w-[140px] sm:max-w-[215px] truncate text-[9px] font-bold tracking-wide text-sky-100/90">
                {stageTitle}
                <span className="hidden md:inline text-sky-300/75">
                  {' · '}
                  {lang === 'pl' ? currentZone.namePl : currentZone.nameEn}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={currentStage >= maxUnlockedStage}
              onClick={() => jumpToStage(currentStage + 1)}
              className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 cursor-pointer"
              title={lang === 'pl' ? 'Następny odblokowany Stage (])' : 'Next unlocked Stage (])'}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>

            <div className="h-5 w-[1px] bg-white/15" />

            <button
              type="button"
              onClick={() => {
                respawnToStageRef.current?.(currentStage)
                sfx.playClick()
              }}
              title="Respawn (R)"
              className="flex items-center gap-1 rounded-xl bg-sky-500/25 px-2 py-1 text-[11px] font-extrabold text-sky-100 hover:bg-sky-500/40 active:scale-95 transition cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.obbyRespawnBtn}</span>
              {!touchMode && (
                <kbd className="hidden md:inline-flex rounded border border-white/15 bg-black/35 px-1 py-0.2 font-mono text-[9px] font-bold text-sky-200/85">
                  R
                </kbd>
              )}
            </button>
          </div>
        </div>

        {/* Right: Feedback + Shortcuts + PC Mouse Lock + Live Wardrobe button */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          {onOpenFeedback && (
            <button
              type="button"
              onClick={() => {
                sfx.playClick()
                onOpenFeedback(`Test Obby 100 · Stage ${currentStage}`)
              }}
              title={lang === 'pl' ? 'Zgłoś błąd lub pomysł (B)' : 'Report bug or idea (B)'}
              className="flex h-9 items-center gap-1 rounded-2xl border border-white/15 bg-slate-950/65 px-2.5 text-xs font-bold text-sky-100 backdrop-blur-xl shadow-lg transition hover:bg-slate-900/80 active:scale-95 cursor-pointer"
            >
              <MessageSquarePlus className="h-4 w-4 text-sky-300" />
              <span className="hidden xl:inline">{lang === 'pl' ? 'Zgłoś' : 'Feedback'}</span>
              {!touchMode && (
                <kbd className="hidden md:inline-flex rounded border border-white/15 bg-black/35 px-1 py-0.2 font-mono text-[9px] font-bold text-sky-200/80">
                  B
                </kbd>
              )}
            </button>
          )}
          {!touchMode && (
            <button
              type="button"
              onClick={() => {
                setHubOpen(false)
                setWardrobeOpen(false)
                setShortcutsOpen((v) => !v)
                sfx.playClick()
              }}
              title={lang === 'pl' ? 'Skróty klawiszowe (K / ?)' : 'Keyboard Shortcuts (K / ?)'}
              className={`hidden sm:flex h-9 items-center gap-1 rounded-2xl border px-2.5 text-xs font-bold backdrop-blur-xl shadow-lg active:scale-95 transition cursor-pointer ${
                shortcutsOpen
                  ? 'border-sky-300/80 bg-sky-500/35 text-white'
                  : 'border-white/15 bg-slate-950/65 text-sky-100 hover:bg-slate-900/80'
              }`}
            >
              <Keyboard className="h-4 w-4 text-sky-300" />
              <kbd className="rounded border border-white/15 bg-black/35 px-1 py-0.2 font-mono text-[9px] font-bold text-sky-200/85">
                K
              </kbd>
            </button>
          )}
          {!touchMode && (
            <button
              type="button"
              onClick={() => toggleShiftLockRef.current?.()}
              title={
                lang === 'pl'
                  ? 'Lock myszy (Klik / Tab / M — obrót kamery bez przeciągania)'
                  : 'Mouse Lock (Click / Tab / M — look without dragging)'
              }
              className={`flex h-9 items-center gap-1.5 rounded-2xl border px-2.5 text-xs font-extrabold backdrop-blur-xl shadow-lg transition cursor-pointer ${
                shiftLockActive
                  ? 'border-sky-300/80 bg-sky-500/40 text-white ring-1 ring-sky-300/40'
                  : 'border-white/15 bg-slate-950/65 text-sky-100 hover:bg-slate-900/80'
              }`}
            >
              <Crosshair className={`h-3.5 w-3.5 ${shiftLockActive ? 'text-white' : 'text-sky-300'}`} />
              <span className="hidden lg:inline">
                {shiftLockActive
                  ? lang === 'pl'
                    ? 'Mysz zablok.'
                    : 'Locked'
                  : lang === 'pl'
                    ? 'Lock myszy'
                    : 'Mouse Lock'}
              </span>
              <kbd className="hidden md:inline-flex rounded border border-white/15 bg-black/35 px-1 py-0.2 font-mono text-[9px] font-bold text-sky-100/90">
                Tab
              </kbd>
            </button>
          )}
          <button
            type="button"
            onClick={() => (wardrobeOpen ? closeLiveWardrobe() : openLiveWardrobe())}
            title={`${t.quickAvatar} (I)`}
            className={`flex h-9 items-center gap-1.5 rounded-2xl border px-2.5 sm:px-3 text-xs font-extrabold backdrop-blur-xl shadow-lg transition active:scale-95 cursor-pointer ${
              wardrobeOpen
                ? 'border-sky-300/70 bg-sky-500 text-white'
                : 'border-white/15 bg-slate-950/65 text-white hover:bg-slate-900/80'
            }`}
          >
            <Shirt className="h-4 w-4 text-sky-300" />
            <span className="hidden sm:inline">{t.quickAvatar}</span>
            {!touchMode && (
              <kbd className="hidden md:inline-flex rounded border border-white/15 bg-black/35 px-1 py-0.2 font-mono text-[9px] font-bold text-sky-200/80">
                I
              </kbd>
            )}
          </button>
        </div>
      </div>

      {/* === LIVE IN-GAME WARDROBE DRAWER === */}
      {wardrobeOpen && (
        <InGameWardrobeDrawer
          lang={lang}
          freshGems={freshGems}
          ownedAvatar={avatar}
          previewAvatar={previewAvatar}
          unlockedOutfits={unlockedOutfits}
          unlockedHats={unlockedHats}
          unlockedFaces={unlockedFaces}
          onPreviewChange={setPreviewAvatar}
          onBuyAndEquip={onBuyAndEquip}
          onBuyBundle={onBuyBundle}
          onSkinChange={onSkinChange}
          onTestEmote={triggerEmote}
          onClose={closeLiveWardrobe}
        />
      )}

      {/* === UPGRADED FRESHBLOX IN-GAME MENU (Logo F / H / Esc) === */}
      <InGameMenuDrawer
        open={hubOpen}
        activeTab={hubTab}
        onTabChange={setHubTab}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        worldKind="obby"
        lang={lang}
        roomCode={roomCode}
        username={username}
        rankName={rank.name}
        onlineCount={onlineCount}
        roster={roster}
        currentStage={currentStage}
        maxUnlockedStage={maxUnlockedStage}
        stageTitle={`${stageTitle} · ${lang === 'pl' ? currentZone.namePl : currentZone.nameEn}`}
        difficultyLabel={lang === 'pl' ? currentZone.difficultyPl : currentZone.difficultyEn}
        difficultyColor={currentZone.difficultyColor}
        touchMode={touchMode}
        pointerLocked={shiftLockActive}
        clickToLock={mousePrefs.clickToLock}
        shiftLockAlign={mousePrefs.shiftLockAlign}
        mouseSensitivity={mousePrefs.sensitivity}
        onTogglePointerLock={() => toggleShiftLockRef.current?.()}
        onChangeClickToLock={(enabled) => updateMousePrefs({ clickToLock: enabled })}
        onChangeShiftLockAlign={(enabled) => updateMousePrefs({ shiftLockAlign: enabled })}
        onChangeMouseSensitivity={(sensitivity) => updateMousePrefs({ sensitivity })}
        worldTime={worldTime}
        soundEnabled={soundEnabled}
        quality={quality}
        isFullscreen={isFullscreen}
        supabaseConnected={isSupabaseConfigured}
        copiedInvite={copiedInvite}
        onChangeWorldTime={setWorldTime}
        onToggleSound={toggleSound}
        onChangeQuality={setQuality}
        onToggleTouchMode={() => setTouchMode((m) => !m)}
        onToggleFullscreen={() => {
          if (isFullscreen) {
            exitGameFullscreen()
          } else {
            enterGameFullscreenLandscape()
          }
        }}
        onClose={() => setHubOpen(false)}
        onResumeAndLock={() => {
          setHubOpen(false)
          lockMouseRef.current?.()
        }}
        onOpenWardrobe={openLiveWardrobe}
        onCopyInvite={handleCopyInvite}
        onResetPosition={() => respawnToStageRef.current?.(currentStage)}
        onSwitchWorld={onSwitchToLobby}
        onLeaveToHome={onBackHome}
        onOpenFeedback={() => onOpenFeedback?.(`Test Obby 100 · Stage ${currentStage}`)}
      />

      {/* === PC KEYBOARD SHORTCUTS OVERLAY (K / ?) === */}
      <ShortcutsOverlayModal
        open={shortcutsOpen}
        worldKind="obby"
        lang={lang}
        onClose={() => {
          setShortcutsOpen(false)
          wasLockedBeforeUiRef.current = false
        }}
        onResumeAndLock={
          !touchMode && mousePrefs.clickToLock
            ? () => {
                setShortcutsOpen(false)
                wasLockedBeforeUiRef.current = false
                lockMouseRef.current?.()
              }
            : undefined
        }
      />

      {/* === LIVE CHAT OVERLAY === */}
      {chatOpen && (
        <div
          className="pointer-events-auto absolute left-2.5 sm:left-3.5 z-20 flex w-[min(300px,calc(100vw-20px))] flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-950/65 text-white shadow-xl backdrop-blur-xl"
          style={{ top: 'max(4.4rem, calc(env(safe-area-inset-top) + 3.8rem))' }}
        >
          <div className="max-h-36 sm:max-h-44 space-y-1.5 overflow-y-auto px-3 py-2 text-xs">
            {chatMessages.map((m) => (
              <div key={m.id} className="leading-snug break-words">
                {m.system ? (
                  <span className="font-semibold text-sky-300">{m.text}</span>
                ) : (
                  <>
                    <span className="font-extrabold text-sky-300">{m.username}: </span>
                    <span className="text-white/95">{m.text}</span>
                  </>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSendChat} className="flex items-center gap-1.5 border-t border-white/10 p-1.5">
            <input
              ref={chatInputRef}
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={t.chatPlaceholder}
              maxLength={140}
              className="min-w-0 flex-1 rounded-xl bg-white/10 px-2.5 py-1.5 text-xs text-white placeholder-sky-200/60 outline-none focus:ring-1 focus:ring-sky-400"
            />
            <button
              type="submit"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white hover:bg-sky-400 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* === STAGE 100 VICTORY BANNER === */}
      {finishedBanner && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-amber-300/55 bg-slate-950/94 p-6 text-center text-white shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-300 border border-amber-300/40">
              <Trophy className="h-9 w-9" />
            </div>
            <h2 className="mt-3 font-display text-2xl font-black text-amber-300">{t.obbyFinishedTitle}</h2>
            <p className="mt-1 text-xs text-sky-100/85">{t.obbyFinishedSub}</p>

            {/* Exclusive Champion Crown Reward Card */}
            <div className="mt-4 rounded-2xl border border-amber-400/45 bg-gradient-to-r from-amber-500/18 via-yellow-500/12 to-sky-500/15 p-3.5 text-left">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-300/60 bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 shadow">
                  <Crown className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                    {lang === 'pl' ? 'Odblokowano ekskluzywną nagrodę!' : 'Exclusive Reward Unlocked!'}
                  </div>
                  <div className="font-display text-sm font-black text-white">
                    {lang === 'pl' ? 'Korona Mistrza Obby' : 'Obby 100 Champion Crown'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={avatar.hatId === 'obby-crown'}
                onClick={() => {
                  const ok = onBuyAndEquip('hat', 'obby-crown', 0)
                  if (ok) {
                    setPreviewAvatar((prev) => ({ ...prev, hatId: 'obby-crown' }))
                    sfx.playQuestClaim()
                    triggerEmote('cheer')
                  }
                }}
                className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold transition cursor-pointer ${
                  avatar.hatId === 'obby-crown'
                    ? 'bg-emerald-500/25 border border-emerald-400/50 text-emerald-200 cursor-default'
                    : 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow hover:brightness-110 active:scale-[0.98]'
                }`}
              >
                {avatar.hatId === 'obby-crown' ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>{lang === 'pl' ? 'Korona założona na awatarze!' : 'Crown equipped on avatar!'}</span>
                  </>
                ) : (
                  <>
                    <Crown className="h-4 w-4" />
                    <span>{lang === 'pl' ? 'Załóż Koronę Mistrza teraz' : 'Equip Champion Crown now'}</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-[10px] font-bold uppercase text-sky-200/70">
                  {lang === 'pl' ? 'Czas biegu' : 'Run time'}
                </div>
                <div className="mt-0.5 font-mono text-lg font-black text-white">
                  {formatTimeMs(finishedBanner.elapsedMs)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-[10px] font-bold uppercase text-sky-200/70">
                  {lang === 'pl' ? 'Ukończenia' : 'Completions'}
                </div>
                <div className="mt-0.5 font-mono text-lg font-black text-emerald-300">
                  {Math.max(1, completions)}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRestartFromOne}
                className="flex-1 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 py-3 text-xs font-extrabold text-white shadow-lg hover:brightness-110 cursor-pointer"
              >
                {t.obbyRestartBtn}
              </button>
              <button
                type="button"
                onClick={() => setFinishedBanner(null)}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs font-extrabold text-white hover:bg-white/15 cursor-pointer"
              >
                OK
              </button>
              <button
                type="button"
                onClick={onSwitchToLobby}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-sky-200 hover:bg-white/10 cursor-pointer"
              >
                <Home className="h-3.5 w-3.5" />
                <span>{t.switchToLobby}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === CHECKPOINT TOAST === */}
      {toast && (
        <div className="pointer-events-none absolute top-20 left-1/2 z-30 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-2xl border border-sky-300/45 bg-slate-950/85 px-4 py-2 text-xs sm:text-sm font-black text-white shadow-xl backdrop-blur-xl">
            <Sparkles className="h-4 w-4 text-sky-300" />
            <span>{toast}</span>
          </div>
        </div>
      )}

      {/* === PORTRAIT MOBILE SUGGESTION === */}
      {isPortraitMobile && !isFullscreen && (
        <div className="pointer-events-auto absolute bottom-20 left-1/2 z-20 -translate-x-1/2">
          <button
            type="button"
            onClick={() => enterGameFullscreenLandscape()}
            className="flex items-center gap-2 rounded-2xl border border-sky-300/40 bg-slate-950/80 px-3.5 py-2 text-xs font-extrabold text-white shadow-lg backdrop-blur-xl"
          >
            <Maximize2 className="h-3.5 w-3.5 text-sky-300" />
            <span>{t.rotateBannerBtn}</span>
          </button>
        </div>
      )}

      {/* === DESKTOP BOTTOM EMOTE & CONTROLS BAR === */}
      {!touchMode && !wardrobeOpen && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex flex-col items-center gap-1.5 px-4">
          <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/15 bg-slate-950/65 p-1 backdrop-blur-xl shadow-lg">
            {(['wave', 'dance', 'cheer', 'sit', 'spin', 'backflip'] as const).map((pose, idx) => (
              <button
                key={pose}
                type="button"
                onClick={() => triggerEmote(pose)}
                className="rounded-xl px-2.5 py-1 text-[11px] font-bold text-sky-100 hover:bg-white/15 active:scale-95 transition cursor-pointer"
              >
                <span className="mr-1 font-mono text-[10px] text-sky-400">{idx + 1}</span>
                {t.emotes[pose]}
              </button>
            ))}
          </div>
          <div className="rounded-full bg-slate-950/70 border border-white/10 px-3 py-1 text-[10px] font-semibold text-sky-100/90 backdrop-blur-md">
            {shiftLockActive
              ? lang === 'pl'
                ? '[R] Respawn · [ [ / ] ] Stage · [T] Czat · [I] Szatnia · [H] Menu · [L] Shift-Lock · [K] Skróty · [ESC/Tab] Kursor'
                : '[R] Respawn · [ [ / ] ] Stage · [T] Chat · [I] Wardrobe · [H] Menu · [L] Shift-Lock · [K] Shortcuts · [ESC/Tab] Cursor'
              : mousePrefs.clickToLock
                ? lang === 'pl'
                  ? 'Kliknij 3D lub [Tab/M] = Lock myszy · [R] Respawn · [T] Czat · [I] Szatnia · [H] Menu · [K] Wszystkie skróty'
                  : 'Click 3D or [Tab/M] = Mouse Lock · [R] Respawn · [T] Chat · [I] Wardrobe · [H] Menu · [K] All shortcuts'
                : t.obbyControlsList}
          </div>
        </div>
      )}

      {/* === MOUSE LOCK / SHIFT-LOCK RETICLE (Desktop) === */}
      {shiftLockActive && !touchMode && (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
          {mousePrefs.shiftLockAlign ? (
            <Crosshair className="h-5 w-5 text-sky-200 drop-shadow-[0_1px_4px_rgba(2,132,199,0.95)]" />
          ) : (
            <div className="h-2.5 w-2.5 rounded-full border-2 border-white/95 bg-sky-400/90 shadow-[0_0_8px_rgba(56,189,248,0.95)]" />
          )}
        </div>
      )}

      {/* === MOBILE TOUCH CONTROLS (Ergonomic Floating Joystick + Auto-Sprint + Hold-to-Jump + Respawn) === */}
      {touchMode && !wardrobeOpen && (
        <MobileTouchControls
          onMoveVector={(x, y, autoSprint) => {
            joyRef.current.x = x
            joyRef.current.y = y
            joyRef.current.autoSprint = Boolean(autoSprint)
          }}
          onJump={() => {
            jumpRequestRef.current = true
          }}
          onJumpHoldChange={(held) => {
            jumpHeldRef.current = held
          }}
          sprintActive={touchSprint}
          onToggleSprint={() => {
            setTouchSprint((prev) => {
              const next = !prev
              touchSprintRef.current = next
              return next
            })
          }}
          activeEmote={activeEmoteUi}
          onEmote={triggerEmote}
          onRecenterCamera={() => recenterCamRef.current?.()}
          onQuickRespawn={() => {
            respawnToStageRef.current?.(currentStage)
            sfx.playClick()
          }}
          compactHeight={vp.isCompactHeight}
          labels={{
            jumpBtn: t.jumpBtn,
            sprintBtn: t.sprintBtn,
            emotesLabel: t.emotesLabel,
            respawnBtn: t.obbyRespawnBtn,
            recenterBtn: lang === 'pl' ? 'Centruj kamerę' : 'Center camera',
            emotes: t.emotes,
          }}
        />
      )}
    </div>
  )
}
