import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import {
  Armchair,
  Crosshair,
  Flag,
  MessageSquare,
  MessageSquarePlus,
  RotateCw,
  Send,
  Shirt,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { FaceId, getRankForXp, HatId, OutfitId, R6AvatarConfig } from '../data/catalog'
import { Lang, LOCALES } from '../data/locales'
import { LobbyChatMessage, LobbyMultiplayerClient, PlayerPose, RemotePlayerState } from '../lib/multiplayer'
import {
  enterGameFullscreenLandscape,
  exitGameFullscreen,
  isDocumentFullscreen,
  isTouchMobileDevice,
} from '../lib/mobileFullscreen'
import { loadMousePrefs, saveMousePrefs } from '../lib/mousePrefs'
import { useVisualViewport } from '../lib/useVisualViewport'
import { sfx } from '../lib/sfx'
import { isSupabaseConfigured } from '../lib/supabase'
import { FreshBloxLogo } from '../components/brand/FreshBloxBrand'
import { MobileTouchControls } from '../components/hud/MobileTouchControls'
import { InGameWardrobeDrawer } from '../components/hud/InGameWardrobeDrawer'
import { InGameMenuDrawer } from '../components/hud/InGameMenuDrawer'
import { createR6Rig, R6RigHandle } from './r6Builder'
import { cloneFreshTexturesWithRepeat, FreshSurfaceKind } from './freshTextures'

export type GraphicsQuality = 'low' | 'medium' | 'high'
type WorldTimeMode = 'day' | 'night'

interface LobbyRosterEntry {
  id: string
  username: string
  rank: string
  isBot: boolean
  isSelf?: boolean
}

interface AABB {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

interface BenchSpot {
  id: string
  x: number
  z: number
  rotY: number
  seatY: number
  /** Facing angle (+Z in local bench frame rotated by rotY) */
  faceAngle: number
}

interface JumpPad {
  x: number
  z: number
  y: number
  radius: number
  boost: number
  ring: THREE.Mesh
}

interface HangoutBot {
  id: string
  username: string
  rank: string
  rig: R6RigHandle
  x: number
  z: number
  rotY: number
  waypoints: Array<{ x: number; z: number; pause: number; emote?: PlayerPose; chat?: string }>
  wpIndex: number
  pauseTimer: number
  speechTimer: number
}

interface MainLobbyWorldProps {
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
  isFullscreen: boolean
  onChatSent: () => void
  onEmoteUsed: () => void
  onJumpPadUsed: () => void
  onReachTerrace: () => void
  onBackHome: () => void
  onEnterObby: () => void
  onBuyAndEquip: (category: 'outfit' | 'hat' | 'face', itemId: string, price: number) => boolean
  onBuyBundle: (items: Array<{ category: 'outfit' | 'hat' | 'face'; id: string; price: number }>) => boolean
  onSkinChange: (hex: string) => void
  feedbackOpen?: boolean
  onOpenFeedback?: (context: string) => void
}

function detectDefaultQuality(): GraphicsQuality {
  if (typeof window === 'undefined') return 'medium'
  const cores = navigator.hardwareConcurrency || 4
  const isTouch = isTouchMobileDevice()
  const narrow = window.innerWidth < 820
  if (cores <= 2) return 'low'
  if (isTouch || narrow || cores <= 4) return 'medium'
  return 'high'
}

const STEP_HEIGHT = 0.56 // Auto-step smoothly over walkways, plaza layers & low stairs without jumping!

function avatarKey(a: R6AvatarConfig): string {
  return `${a.outfitId}|${a.hatId}|${a.faceId}|${a.skinColor}`
}

export const MainLobbyWorld: React.FC<MainLobbyWorldProps> = ({
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
  isFullscreen,
  onChatSent,
  onEmoteUsed,
  onJumpPadUsed,
  onReachTerrace,
  onBackHome,
  onEnterObby,
  onBuyAndEquip,
  onBuyBundle,
  onSkinChange,
  feedbackOpen = false,
  onOpenFeedback,
}) => {
  const t = LOCALES[lang].world
  const mountRef = useRef<HTMLDivElement>(null)

  const [quality, setQuality] = useState<GraphicsQuality>(() => detectDefaultQuality())
  const [touchMode, setTouchMode] = useState<boolean>(() => isTouchMobileDevice())
  const [sprintLocked, setSprintLocked] = useState<boolean>(false)
  const [fpsDisplay, setFpsDisplay] = useState<number>(60)
  const [chatOpen, setChatOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 860 && !isTouchMobileDevice() : true,
  )
  const [hubOpen, setHubOpen] = useState(false)
  const [wardrobeOpen, setWardrobeOpen] = useState(false)
  const [previewAvatar, setPreviewAvatar] = useState<R6AvatarConfig>(() => ({ ...avatar }))
  const [worldTime, setWorldTime] = useState<WorldTimeMode>('day')
  const [roster, setRoster] = useState<LobbyRosterEntry[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  // Interactive bench state
  const [nearBench, setNearBench] = useState<BenchSpot | null>(null)
  const [seatedBench, setSeatedBench] = useState<BenchSpot | null>(null)

  // Portrait mobile rotate hint
  const [isPortraitMobile, setIsPortraitMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? isTouchMobileDevice() && window.innerHeight > window.innerWidth : false,
  )
  const [rotateBannerDismissed, setRotateBannerDismissed] = useState(false)

  const [botsEnabled, setBotsEnabled] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [copiedInvite, setCopiedInvite] = useState(false)
  const [onlineCount, setOnlineCount] = useState(1)
  const [activeEmote, setActiveEmote] = useState<PlayerPose | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState<LobbyChatMessage[]>([
    {
      id: 'sys-welcome',
      senderId: 'system',
      username: 'FreshBlox',
      text: t.welcomeChat,
      timestamp: Date.now(),
      system: true,
    },
  ])

  const botsEnabledRef = useRef(botsEnabled)
  botsEnabledRef.current = botsEnabled
  const qualityRef = useRef(quality)
  qualityRef.current = quality
  const sprintLockedRef = useRef(sprintLocked)
  sprintLockedRef.current = sprintLocked
  const chatOpenRef = useRef(chatOpen)
  chatOpenRef.current = chatOpen
  const hubOpenRef = useRef(hubOpen)
  hubOpenRef.current = hubOpen
  const touchModeRef = useRef(touchMode)
  touchModeRef.current = touchMode
  const wardrobeOpenRef = useRef(wardrobeOpen)
  wardrobeOpenRef.current = wardrobeOpen
  const focusWardrobeCamRef = useRef<() => void>(() => {})

  const [mousePrefs, setMousePrefs] = useState(() => loadMousePrefs())
  const clickToLockRef = useRef(mousePrefs.clickToLock)
  clickToLockRef.current = mousePrefs.clickToLock
  const shiftLockAlignRef = useRef(mousePrefs.shiftLockAlign)
  shiftLockAlignRef.current = mousePrefs.shiftLockAlign
  const mouseSensRef = useRef(mousePrefs.sensitivity)
  mouseSensRef.current = mousePrefs.sensitivity

  const updateMousePrefs = useCallback((patch: Partial<typeof mousePrefs>) => {
    setMousePrefs((prev) => {
      const next = { ...prev, ...patch }
      saveMousePrefs(next)
      return next
    })
  }, [])

  const nearBenchRef = useRef<BenchSpot | null>(null)
  const seatedBenchRef = useRef<BenchSpot | null>(null)
  const toggleSitActionRef = useRef<() => void>(() => {})
  const resetSpawnActionRef = useRef<() => void>(() => {})
  const teleportToMemberRef = useRef<(memberId: string) => void>(() => {})
  const recenterCamRef = useRef<() => void>(() => {})
  const toggleShiftLockRef = useRef<() => void>(() => {})
  const lockMouseRef = useRef<() => void>(() => {})
  const pointerLockReleasedAtRef = useRef<number>(0)

  const [shiftLockActive, setShiftLockActive] = useState(false)
  const shiftLockRef = useRef(false)
  const vp = useVisualViewport()

  // Release pointer lock cleanly whenever any menu/modal opens
  useEffect(() => {
    if ((hubOpen || wardrobeOpen || feedbackOpen) && document.pointerLockElement) {
      document.exitPointerLock?.()
    }
  }, [hubOpen, wardrobeOpen, feedbackOpen])

  const touchMoveRef = useRef<{ x: number; y: number; autoSprint: boolean }>({
    x: 0,
    y: 0,
    autoSprint: false,
  })
  const jumpQueuedRef = useRef<boolean>(false)
  const jumpHeldRef = useRef<boolean>(false)

  const avatarRef = useRef(avatar)
  avatarRef.current = avatar
  const displayedAvatar: R6AvatarConfig = wardrobeOpen ? previewAvatar : avatar
  const displayedAvatarRef = useRef<R6AvatarConfig>(displayedAvatar)
  displayedAvatarRef.current = displayedAvatar
  const localRigKeyRef = useRef<string>(avatarKey(displayedAvatar))
  const usernameRef = useRef(username)
  usernameRef.current = username
  const rankRef = useRef(getRankForXp(xp).name)
  rankRef.current = getRankForXp(xp).name
  const worldTimeRef = useRef<WorldTimeMode>(worldTime)
  worldTimeRef.current = worldTime

  const activeEmoteRef = useRef<PlayerPose | null>(null)
  const emoteTimerRef = useRef<number>(0)
  const chatInputFocusedRef = useRef(false)
  const feedbackOpenRef = useRef<boolean>(feedbackOpen)
  feedbackOpenRef.current = feedbackOpen
  const mpRef = useRef<LobbyMultiplayerClient | null>(null)
  const localRigRef = useRef<R6RigHandle | null>(null)
  const speechTimeoutRef = useRef<number | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null)
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cloudsGroupRef = useRef<THREE.Group | null>(null)
  const nightSkyGroupRef = useRef<THREE.Group | null>(null)

  const authUserIdRef = useRef(authUserId)
  authUserIdRef.current = authUserId
  const nearPortalRef = useRef<{ name: string; action?: 'obby' } | null>(null)
  const [nearPortalInfo, setNearPortalInfo] = useState<{ name: string; action?: 'obby' } | null>(null)

  const callbacksRef = useRef({
    onChatSent,
    onEmoteUsed,
    onJumpPadUsed,
    onReachTerrace,
    onEnterObby,
  })
  callbacksRef.current = {
    onChatSent,
    onEmoteUsed,
    onJumpPadUsed,
    onReachTerrace,
    onEnterObby,
  }

  // Track mobile orientation cleanly
  useEffect(() => {
    const checkOrient = () => {
      setIsPortraitMobile(isTouchMobileDevice() && window.innerHeight > window.innerWidth)
    }
    window.addEventListener('resize', checkOrient)
    window.addEventListener('orientationchange', checkOrient)
    return () => {
      window.removeEventListener('resize', checkOrient)
      window.removeEventListener('orientationchange', checkOrient)
    }
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => {
      setToast((cur) => (cur === msg ? null : cur))
    }, 2400)
  }, [])

  // Live graphics quality + natural Day / Night atmosphere application
  useEffect(() => {
    const renderer = rendererRef.current
    const sun = sunLightRef.current
    const hemi = hemiLightRef.current
    const scene = sceneRef.current
    const clouds = cloudsGroupRef.current
    const nightSky = nightSkyGroupRef.current
    if (!renderer || !scene) return

    const isNight = worldTime === 'night'
    const skyHex = isNight ? '#0B1528' : '#BAE6FD'
    scene.background = new THREE.Color(skyHex)

    if (hemi) {
      if (isNight) {
        hemi.color.set('#89AED8')
        hemi.groundColor.set('#14233C')
        hemi.intensity = 0.72
      } else {
        hemi.color.set('#F0F9FF')
        hemi.groundColor.set('#7DD3FC')
        hemi.intensity = 1.15
      }
    }

    if (sun) {
      if (isNight) {
        sun.color.set('#D8E8FF')
        sun.intensity = 1.05
      } else {
        sun.color.set('#FFFBEB')
        sun.intensity = 1.65
      }
    }

    if (nightSky) nightSky.visible = isNight

    const dpr = window.devicePixelRatio || 1
    if (quality === 'low') {
      renderer.setPixelRatio(Math.min(dpr, 1.0))
      renderer.shadowMap.enabled = false
      if (sun) sun.castShadow = false
      scene.fog = new THREE.Fog(skyHex, 40, 115)
      if (clouds) clouds.visible = false
    } else if (quality === 'medium') {
      renderer.setPixelRatio(Math.min(dpr, 1.35))
      renderer.shadowMap.enabled = true
      if (sun) sun.castShadow = true
      scene.fog = new THREE.Fog(skyHex, 54, 150)
      if (clouds) clouds.visible = !isNight
    } else {
      renderer.setPixelRatio(Math.min(dpr, 1.85))
      renderer.shadowMap.enabled = true
      if (sun) sun.castShadow = true
      scene.fog = new THREE.Fog(skyHex, 68, 178)
      if (clouds) clouds.visible = !isNight
    }
    renderer.shadowMap.needsUpdate = true
  }, [quality, worldTime])

  // LIVE HOT-SWAP LOCAL R6 AVATAR IN-GAME (0ms reload — instant outfit/hat/face/skin changes!)
  useEffect(() => {
    const nextKey = avatarKey(displayedAvatar)
    if (nextKey === localRigKeyRef.current) return
    const scene = sceneRef.current
    const oldRig = localRigRef.current
    if (!scene || !oldRig) return

    const pos = oldRig.root.position.clone()
    const rotY = oldRig.root.rotation.y
    scene.remove(oldRig.root)
    oldRig.dispose()

    const freshRig = createR6Rig({
      avatar: displayedAvatar,
      username: usernameRef.current,
      rank: rankRef.current,
      showNameplate: true,
      castShadow: qualityRef.current !== 'low',
    })
    freshRig.root.position.copy(pos)
    freshRig.root.rotation.y = rotY
    scene.add(freshRig.root)
    localRigRef.current = freshRig
    localRigKeyRef.current = nextKey
  }, [displayedAvatar])

  const openLiveWardrobe = useCallback(() => {
    setPreviewAvatar({ ...avatarRef.current })
    setHubOpen(false)
    setChatOpen(false)
    setWardrobeOpen(true)
    focusWardrobeCamRef.current()
    sfx.playClick()
  }, [])

  const closeLiveWardrobe = useCallback(() => {
    setWardrobeOpen(false)
    setPreviewAvatar({ ...avatarRef.current })
    sfx.playClick()
  }, [])

  const triggerEmote = useCallback((pose: PlayerPose) => {
    // If sitting on bench, stand up cleanly for non-sit emotes
    if (seatedBenchRef.current && pose !== 'sit') {
      seatedBenchRef.current = null
      setSeatedBench(null)
    }
    activeEmoteRef.current = pose
    const durations: Partial<Record<PlayerPose, number>> = {
      backflip: 1.75,
      spin: 1.45,
      dance: 6.4,
      cheer: 2.4,
      wave: 3.2,
      sit: 18,
    }
    emoteTimerRef.current = durations[pose] ?? 3.4
    setActiveEmote(pose)
    sfx.playClick()
    callbacksRef.current.onEmoteUsed()
  }, [])

  const handleTouchMoveVector = useCallback((x: number, y: number, autoSprint = false) => {
    touchMoveRef.current.x = x
    touchMoveRef.current.y = y
    touchMoveRef.current.autoSprint = autoSprint
  }, [])

  const handleTouchJump = useCallback(() => {
    jumpQueuedRef.current = true
  }, [])

  const handleTouchJumpHold = useCallback((held: boolean) => {
    jumpHeldRef.current = held
  }, [])

  const handleSendChat = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      const clean = chatInput.trim().slice(0, 140)
      if (!clean) return
      const msg: LobbyChatMessage = {
        id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        senderId: playerId,
        username: usernameRef.current,
        text: clean,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev.slice(-34), msg])
      setChatInput('')
      sfx.playChatPop()
      mpRef.current?.broadcastChat(msg, authUserIdRef.current)
      callbacksRef.current.onChatSent()

      localRigRef.current?.setSpeech(clean)
      if (speechTimeoutRef.current) window.clearTimeout(speechTimeoutRef.current)
      speechTimeoutRef.current = window.setTimeout(() => {
        localRigRef.current?.setSpeech(null)
      }, 5500)
    },
    [chatInput, playerId],
  )

  const handleCopyInvite = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomCode)}`
    navigator.clipboard?.writeText(url).catch(() => {})
    setCopiedInvite(true)
    sfx.playClick()
    window.setTimeout(() => setCopiedInvite(false), 2200)
  }, [roomCode])

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev
      sfx.setEnabled(next)
      if (next) sfx.playClick()
      return next
    })
  }, [])

  const handleToggleFullscreen = useCallback(() => {
    sfx.playClick()
    if (isDocumentFullscreen()) {
      exitGameFullscreen()
    } else {
      enterGameFullscreenLandscape()
    }
  }, [])

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const disposables: Array<{ dispose: () => void }> = []
    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      disposables.push(g)
      return g
    }
    const trackMat = <T extends THREE.Material>(m: T): T => {
      disposables.push(m)
      return m
    }
    const trackTex = <T extends THREE.Texture>(t2: T): T => {
      disposables.push(t2)
      return t2
    }

    const initQ = qualityRef.current
    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || window.innerHeight - 64

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#BAE6FD')
    scene.fog = new THREE.Fog('#BAE6FD', initQ === 'low' ? 40 : 62, initQ === 'low' ? 115 : 168)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(58, width / height, 0.2, 220)

    const renderer = new THREE.WebGLRenderer({
      antialias: initQ !== 'low',
      powerPreference: 'high-performance',
    })
    renderer.setSize(width, height)
    const dpr = window.devicePixelRatio || 1
    renderer.setPixelRatio(Math.min(dpr, initQ === 'low' ? 1 : initQ === 'medium' ? 1.35 : 1.85))
    renderer.shadowMap.enabled = initQ !== 'low'
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.06
    renderer.domElement.style.touchAction = 'none'
    container.innerHTML = ''
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Fresh-Day bright sky lighting (switches cleanly to natural moonlight in Night mode)
    const hemi = new THREE.HemisphereLight('#F0F9FF', '#7DD3FC', 1.15)
    scene.add(hemi)
    hemiLightRef.current = hemi

    const sun = new THREE.DirectionalLight('#FFFBEB', 1.65)
    sun.position.set(28, 46, 24)
    sun.castShadow = initQ !== 'low'
    const shadowRes = initQ === 'high' ? 1024 : 512
    sun.shadow.mapSize.set(shadowRes, shadowRes)
    sun.shadow.camera.near = 6
    sun.shadow.camera.far = 120
    const dShadow = 38
    sun.shadow.camera.left = -dShadow
    sun.shadow.camera.right = dShadow
    sun.shadow.camera.top = dShadow
    sun.shadow.camera.bottom = -dShadow
    sun.shadow.bias = -0.0007
    scene.add(sun)
    sunLightRef.current = sun

    // Autorskie materiały FreshBlox z mapami albedo + bumpMap (zero studsów z Robloksa, zero płaskiego plastiku!)
    const surfaceMatCache = new Map<string, THREE.MeshStandardMaterial>()

    const getSurfaceMat = (
      surface: FreshSurfaceKind,
      color: string,
      rx: number,
      rz: number,
      roughness = 0.32,
      metalness = 0.05,
    ) => {
      const key = `${surface}_${color}_${rx}_${rz}_${roughness}_${metalness}`
      const hit = surfaceMatCache.get(key)
      if (hit) return hit
      const pair = cloneFreshTexturesWithRepeat(surface, rx, rz, trackTex)
      const mat = trackMat(
        new THREE.MeshStandardMaterial({
          color,
          map: pair.map,
          bumpMap: pair.bumpMap,
          bumpScale: pair.bumpScale,
          roughness,
          metalness,
        }),
      )
      surfaceMatCache.set(key, mat)
      return mat
    }

    const colliders: AABB[] = []

    const addBlock = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      color: string,
      opts?: {
        solid?: boolean
        surface?: FreshSurfaceKind
        radius?: number
        roughness?: number
        metalness?: number
        tileUnit?: number
        castShadow?: boolean
      },
    ) => {
      const {
        solid = true,
        surface = 'facetTile',
        radius = 0.14,
        roughness = 0.32,
        metalness = 0.05,
        tileUnit = 2.6,
        castShadow = true,
      } = opts ?? {}
      const rx = Math.max(1, Math.round(w / tileUnit))
      const rz = Math.max(1, Math.round(Math.max(d, h) / tileUnit))
      const geo = trackGeo(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, h * 0.35)))
      const mat = getSurfaceMat(surface, color, rx, rz, roughness, metalness)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x, y, z)
      mesh.castShadow = castShadow
      mesh.receiveShadow = true
      scene.add(mesh)
      if (solid) {
        colliders.push({
          minX: x - w / 2,
          maxX: x + w / 2,
          minY: y - h / 2,
          maxY: y + h / 2,
          minZ: z - d / 2,
          maxZ: z + d / 2,
        })
      }
      return mesh
    }

    // === MAIN LOBBY (LOBBY GŁÓWNE) WORLD GEOMETRY ===
    // Main plaza deck: Arctic architectural terrazzo stone pavers
    addBlock(0, -1.5, 0, 74, 3, 74, '#E2F1FC', {
      surface: 'terrazzo',
      tileUnit: 4.5,
      radius: 0.28,
      roughness: 0.44,
      castShadow: false,
    })
    addBlock(0, -0.02, 0, 26, 0.3, 26, '#C4E5FB', {
      surface: 'marble',
      tileUnit: 3.6,
      radius: 0.12,
      roughness: 0.32,
      castShadow: false,
    })
    addBlock(0, 0.06, 0, 14, 0.26, 14, '#8FD4FC', {
      surface: 'facetTile',
      tileUnit: 2.8,
      radius: 0.1,
      roughness: 0.28,
      castShadow: false,
    })

    // Four cardinal walkway runners: honed light marble slabs
    addBlock(0, 0.055, 18, 6.2, 0.2, 22, '#F4F9FE', { surface: 'marble', tileUnit: 3.1, radius: 0.08, roughness: 0.3, castShadow: false })
    addBlock(0, 0.055, -18, 6.2, 0.2, 22, '#F4F9FE', { surface: 'marble', tileUnit: 3.1, radius: 0.08, roughness: 0.3, castShadow: false })
    addBlock(18, 0.055, 0, 22, 0.2, 6.2, '#F4F9FE', { surface: 'marble', tileUnit: 3.1, radius: 0.08, roughness: 0.3, castShadow: false })
    addBlock(-18, 0.055, 0, 22, 0.2, 6.2, '#F4F9FE', { surface: 'marble', tileUnit: 3.1, radius: 0.08, roughness: 0.3, castShadow: false })

    // Central FreshBlox Crystal Fountain Monument (Marble basin + sunlit stylized water + natural crystal)
    addBlock(0, 0.45, 0, 6.4, 0.9, 6.4, '#F8FAFC', { surface: 'marble', tileUnit: 2.4, radius: 0.16, roughness: 0.28 })
    const waterPair = cloneFreshTexturesWithRepeat('water', 2, 2, trackTex)
    const waterPoolMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#38BDF8',
        map: waterPair.map,
        bumpMap: waterPair.bumpMap,
        bumpScale: waterPair.bumpScale,
        roughness: 0.14,
        metalness: 0.12,
      }),
    )
    const waterPool = new THREE.Mesh(trackGeo(new RoundedBoxGeometry(5.2, 0.28, 5.2, 2, 0.08)), waterPoolMat)
    waterPool.position.set(0, 0.88, 0)
    waterPool.receiveShadow = true
    scene.add(waterPool)

    addBlock(0, 1.55, 0, 1.8, 1.4, 1.8, '#0284C7', { surface: 'fluted', tileUnit: 1.8, radius: 0.14, roughness: 0.28 })
    const crystalPair = cloneFreshTexturesWithRepeat('ice', 1, 1, trackTex)
    const centerCrystal = new THREE.Mesh(
      trackGeo(new THREE.OctahedronGeometry(1.15, 0)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: '#7DD3FC',
          map: crystalPair.map,
          bumpMap: crystalPair.bumpMap,
          bumpScale: 0.04,
          roughness: 0.12,
          metalness: 0.22,
        }),
      ),
    )
    centerCrystal.position.set(0, 3.85, 0)
    centerCrystal.castShadow = true
    scene.add(centerCrystal)

    // === INTERACTIVE HANGOUT BENCHES (5 sculpted timber-and-stone benches with backrests!) ===
    const benchSeatMat = getSurfaceMat('wood', '#C28A5B', 2, 1, 0.56, 0.02)
    const benchBackMat = getSurfaceMat('wood', '#B0774A', 2, 1, 0.58, 0.02)
    const benchLegMat = getSurfaceMat('terrazzo', '#E2E8F0', 1, 1, 0.42, 0.05)
    const benchSeatGeo = trackGeo(new RoundedBoxGeometry(3.6, 0.3, 1.2, 2, 0.08))
    const benchBackGeo = trackGeo(new RoundedBoxGeometry(3.6, 0.72, 0.24, 2, 0.06))
    const benchLegGeo = trackGeo(new RoundedBoxGeometry(0.4, 0.52, 0.96, 2, 0.06))

    const benches: BenchSpot[] = [
      { id: 'b1', x: -16, z: -8, rotY: 0.45, seatY: 0.82, faceAngle: 0.45 },
      { id: 'b2', x: -16, z: 8, rotY: Math.PI - 0.45, seatY: 0.82, faceAngle: Math.PI - 0.45 },
      { id: 'b3', x: -22, z: 0, rotY: Math.PI / 2, seatY: 0.82, faceAngle: Math.PI / 2 },
      { id: 'b4', x: -8.5, z: -8.5, rotY: Math.PI / 4, seatY: 0.82, faceAngle: Math.PI / 4 },
      { id: 'b5', x: 8.5, z: 8.5, rotY: -Math.PI * 0.75, seatY: 0.82, faceAngle: -Math.PI * 0.75 },
    ]

    for (const bp of benches) {
      const benchGroup = new THREE.Group()
      benchGroup.position.set(bp.x, 0, bp.z)
      benchGroup.rotation.y = bp.rotY

      const seat = new THREE.Mesh(benchSeatGeo, benchSeatMat)
      seat.position.set(0, 0.65, 0)
      seat.castShadow = true
      seat.receiveShadow = true
      benchGroup.add(seat)

      // Backrest on local -Z so sitting faces local +Z!
      const back = new THREE.Mesh(benchBackGeo, benchBackMat)
      back.position.set(0, 1.12, -0.52)
      back.rotation.x = -0.14
      back.castShadow = true
      benchGroup.add(back)

      for (const side of [-1.35, 1.35]) {
        const leg = new THREE.Mesh(benchLegGeo, benchLegMat)
        leg.position.set(side, 0.26, 0)
        benchGroup.add(leg)
      }
      scene.add(benchGroup)

      colliders.push({
        minX: bp.x - 1.35,
        maxX: bp.x + 1.35,
        minY: 0,
        maxY: 0.82,
        minZ: bp.z - 1.1,
        maxZ: bp.z + 1.1,
      })
    }

    // Hangout Stage / Dance Platform (South side) + Walk-up stairs!
    addBlock(0, 0.45, 24, 13, 0.9, 8.5, '#1E293B', { surface: 'terrazzo', tileUnit: 3.0, radius: 0.16, roughness: 0.44 })
    // Seamless auto-step-up front stair leading onto the stage
    addBlock(0, 0.22, 19.3, 6.4, 0.45, 1.4, '#38BDF8', { surface: 'facetTile', tileUnit: 2.0, radius: 0.08 })
    const danceFloorMat = getSurfaceMat('facetTile', '#0EA5E9', 5, 3, 0.24, 0.12)
    const danceFloor = new THREE.Mesh(trackGeo(new RoundedBoxGeometry(11.6, 0.16, 7.2, 2, 0.05)), danceFloorMat)
    danceFloor.position.set(0, 0.92, 24)
    danceFloor.receiveShadow = true
    scene.add(danceFloor)

    // Game Mode Portals (North side) — Test Obby 100 is LIVE!
    const portalZones: Array<{ name: string; x: number; z: number; action?: 'obby' }> = [
      { name: 'Test Obby 100', x: -11, z: -26, action: 'obby' },
      { name: 'Crystal Arena', x: 11, z: -26 },
    ]

    const createPortalArch = (x: number, z: number, label: string, sub: string, color: string) => {
      addBlock(x - 3.1, 3.1, z, 1.1, 6.2, 1.2, '#F8FAFC', { surface: 'fluted', tileUnit: 2.0, radius: 0.14, roughness: 0.34 })
      addBlock(x + 3.1, 3.1, z, 1.1, 6.2, 1.2, '#F8FAFC', { surface: 'fluted', tileUnit: 2.0, radius: 0.14, roughness: 0.34 })
      addBlock(x, 6.3, z, 7.4, 1.1, 1.3, color, { surface: 'facetTile', tileUnit: 2.2, radius: 0.16, roughness: 0.28 })

      const gate = new THREE.Mesh(
        trackGeo(new THREE.PlaneGeometry(5.1, 5.4)),
        trackMat(
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide,
          }),
        ),
      )
      gate.position.set(x, 3.1, z)
      scene.add(gate)

      const signCanvas = document.createElement('canvas')
      signCanvas.width = 420
      signCanvas.height = 128
      const sctx = signCanvas.getContext('2d')!
      sctx.fillStyle = '#071124'
      sctx.beginPath()
      sctx.roundRect(8, 8, 404, 112, 22)
      sctx.fill()
      sctx.strokeStyle = color
      sctx.lineWidth = 5
      sctx.stroke()
      sctx.fillStyle = '#F0F9FF'
      sctx.font = '900 32px Inter, system-ui, sans-serif'
      sctx.textAlign = 'center'
      sctx.fillText(label, 210, 56)
      sctx.fillStyle = '#7DD3FC'
      sctx.font = '700 22px Inter, system-ui, sans-serif'
      sctx.fillText(sub, 210, 96)
      const signTex = trackTex(new THREE.CanvasTexture(signCanvas))
      signTex.colorSpace = THREE.SRGBColorSpace
      const sign = new THREE.Mesh(
        trackGeo(new THREE.PlaneGeometry(5.8, 1.75)),
        trackMat(new THREE.MeshBasicMaterial({ map: signTex, transparent: true })),
      )
      sign.position.set(x, 7.75, z + 0.1)
      scene.add(sign)
    }

    createPortalArch(-11, -26, 'TEST OBBY 100', lang === 'pl' ? '100 LEVELI • GRAJ' : '100 STAGES • PLAY', '#F59E0B')
    createPortalArch(0, -28, 'LOBBY GŁÓWNE', roomCode, '#0EA5E9')
    createPortalArch(11, -26, 'Crystal Arena', lang === 'pl' ? 'WKRÓTCE' : 'COMING SOON', '#22D3EE')

    // Sky Observation Terrace Parkour (East side)
    const terraceSteps = [
      { x: 16, y: 1.0, z: -7, w: 4.5, h: 0.7, d: 4.5, c: '#38BDF8' },
      { x: 20.5, y: 2.35, z: -4, w: 4.2, h: 0.7, d: 4.2, c: '#0EA5E9' },
      { x: 24, y: 3.8, z: 1.5, w: 4.2, h: 0.7, d: 4.2, c: '#7DD3FC' },
      { x: 21.5, y: 5.3, z: 7.5, w: 4.5, h: 0.7, d: 4.5, c: '#38BDF8' },
      { x: 25.5, y: 6.8, z: 13.5, w: 8.6, h: 0.9, d: 8.6, c: '#F0F9FF' },
    ]
    for (let i = 0; i < terraceSteps.length; i++) {
      const s = terraceSteps[i]
      addBlock(s.x, s.y, s.z, s.w, s.h, s.d, s.c, {
        surface: i === terraceSteps.length - 1 ? 'marble' : 'facetTile',
        tileUnit: 2.2,
        radius: 0.14,
      })
    }

    const terraceBeacon = new THREE.Mesh(
      trackGeo(new THREE.OctahedronGeometry(0.9, 0)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: '#38BDF8',
          map: crystalPair.map,
          bumpMap: crystalPair.bumpMap,
          bumpScale: 0.04,
          roughness: 0.14,
          metalness: 0.24,
        }),
      ),
    )
    terraceBeacon.position.set(25.5, 9.2, 13.5)
    scene.add(terraceBeacon)

    // Stylized FreshBlox Sculpted Trees (textured wood bark + painterly leaf canopy!)
    const trunkGeo = trackGeo(new RoundedBoxGeometry(1.1, 3.6, 1.1, 2, 0.12))
    const trunkMat = getSurfaceMat('wood', '#9A633C', 1, 2, 0.68, 0.02)
    const foliageGeo1 = trackGeo(new RoundedBoxGeometry(3.8, 2.2, 3.8, 2, 0.28))
    const foliageGeo2 = trackGeo(new RoundedBoxGeometry(2.5, 1.6, 2.5, 2, 0.24))
    const foliageMat1 = getSurfaceMat('foliage', '#38BDF8', 2, 2, 0.42, 0.02)
    const foliageMat2 = getSurfaceMat('foliage', '#BAE6FD', 2, 2, 0.36, 0.02)

    const addTree = (x: number, z: number) => {
      const trunk = new THREE.Mesh(trunkGeo, trunkMat)
      trunk.position.set(x, 1.8, z)
      trunk.castShadow = true
      trunk.receiveShadow = true
      scene.add(trunk)
      const f1 = new THREE.Mesh(foliageGeo1, foliageMat1)
      f1.position.set(x, 4.1, z)
      f1.castShadow = true
      f1.receiveShadow = true
      scene.add(f1)
      const f2 = new THREE.Mesh(foliageGeo2, foliageMat2)
      f2.position.set(x, 5.5, z)
      f2.castShadow = true
      scene.add(f2)
      colliders.push({ minX: x - 0.65, maxX: x + 0.65, minY: 0, maxY: 3.6, minZ: z - 0.65, maxZ: z + 0.65 })
    }

    const treeCoords = [
      [-26, -22],
      [-28, -8],
      [-28, 12],
      [-20, 26],
      [20, -24],
      [29, -12],
      [15, 28],
      [-14, 28],
    ]
    for (const [tx, tz] of treeCoords) addTree(tx, tz)

    // Jump-Pads (tactile athletic grip deck + crisp satin sky ring — zero neon!)
    const jumpPads: JumpPad[] = []
    const padBaseGeo = trackGeo(new THREE.CylinderGeometry(1.55, 1.8, 0.28, 20))
    const padBaseMat = getSurfaceMat('grip', '#1E293B', 2, 2, 0.38, 0.12)
    const padRingGeo = trackGeo(new THREE.TorusGeometry(1.22, 0.14, 10, 24))
    const padRingMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#38BDF8',
        roughness: 0.2,
        metalness: 0.24,
      }),
    )

    const addJumpPad = (x: number, y: number, z: number, boost: number) => {
      const base = new THREE.Mesh(padBaseGeo, padBaseMat)
      base.position.set(x, y + 0.14, z)
      scene.add(base)
      const ring = new THREE.Mesh(padRingGeo, padRingMat)
      ring.rotation.x = Math.PI / 2
      ring.position.set(x, y + 0.34, z)
      scene.add(ring)
      jumpPads.push({ x, y, z, radius: 1.65, boost, ring })
    }

    addJumpPad(11.5, 0, -10.5, 16.5)
    addJumpPad(-11.5, 0, 12.5, 16.5)
    addJumpPad(12.5, 0, 14.5, 19.5)

    // FreshGems pickups removed from Main Lobby while the Gems economy is under construction

    // Soft floating Arctic Sky clouds (Day)
    const cloudsGroup = new THREE.Group()
    cloudsGroup.visible = initQ !== 'low' && worldTimeRef.current === 'day'
    const cloudMat = trackMat(new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.85 }))
    const cloudGeo = trackGeo(new RoundedBoxGeometry(10, 2.2, 5.5, 2, 0.7))
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Mesh(cloudGeo, cloudMat)
      c.position.set(-48 + i * 19, 25 + (i % 3) * 3.5, -42 + ((i * 23) % 80))
      cloudsGroup.add(c)
    }
    scene.add(cloudsGroup)
    cloudsGroupRef.current = cloudsGroup

    // Natural starry night sky with Moon (Night — zero neon!)
    const nightSkyGroup = new THREE.Group()
    nightSkyGroup.visible = worldTimeRef.current === 'night'
    const moonMesh = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(4.2, 18, 14)),
      trackMat(new THREE.MeshBasicMaterial({ color: '#F4F7FF', fog: false })),
    )
    moonMesh.position.set(36, 48, -68)
    nightSkyGroup.add(moonMesh)

    const starGeo = trackGeo(new THREE.OctahedronGeometry(0.42, 0))
    const starMat = trackMat(new THREE.MeshBasicMaterial({ color: '#E2ECFF', fog: false }))
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2 + (i % 3) * 0.25
      const dist = 56 + (i % 5) * 9
      const sy = 28 + (i % 6) * 6.5
      const st = new THREE.Mesh(starGeo, starMat)
      st.position.set(Math.cos(angle) * dist, sy, Math.sin(angle) * dist)
      st.scale.setScalar(0.65 + (i % 4) * 0.22)
      nightSkyGroup.add(st)
    }
    scene.add(nightSkyGroup)
    nightSkyGroupRef.current = nightSkyGroup

    // === LOCAL PLAYER CLEAN R6 RIG ===
    const localRig = createR6Rig({
      avatar: displayedAvatarRef.current,
      username: usernameRef.current,
      rank: rankRef.current,
      showNameplate: true,
      castShadow: initQ !== 'low',
    })
    scene.add(localRig.root)
    localRigRef.current = localRig
    localRigKeyRef.current = avatarKey(displayedAvatarRef.current)

    interface LobbyMantleState {
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
    }

    const player = {
      x: 0,
      y: 0.2,
      z: 9,
      vx: 0,
      vy: 0,
      vz: 0,
      rotY: Math.PI,
      grounded: false,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      mantle: null as LobbyMantleState | null,
      mantleCooldown: 0,
      reachedTerrace: false,
      visualStepOffset: 0,
    }

    // Bind sit/stand & spawn reset actions directly to physics player state!
    const standUpFromBench = () => {
      const b = seatedBenchRef.current
      if (!b) return
      // Step smoothly 1.5m forward off the bench seat
      player.x = b.x + Math.sin(b.faceAngle) * 1.55
      player.z = b.z + Math.cos(b.faceAngle) * 1.55
      player.y = 0.25
      player.vy = 0
      seatedBenchRef.current = null
      setSeatedBench(null)
      sfx.playClick()
    }

    const sitOnBench = (b: BenchSpot) => {
      player.x = b.x + Math.sin(b.faceAngle) * 0.14
      player.z = b.z + Math.cos(b.faceAngle) * 0.14
      player.y = b.seatY - 0.36
      player.vx = 0
      player.vy = 0
      player.vz = 0
      player.rotY = b.faceAngle
      player.grounded = true
      activeEmoteRef.current = null
      setActiveEmote(null)
      seatedBenchRef.current = b
      setSeatedBench(b)
      sfx.playClick()
    }

    toggleSitActionRef.current = () => {
      if (seatedBenchRef.current) {
        standUpFromBench()
      } else if (nearBenchRef.current) {
        sitOnBench(nearBenchRef.current)
      }
    }

    resetSpawnActionRef.current = () => {
      seatedBenchRef.current = null
      setSeatedBench(null)
      player.x = 0
      player.y = 0.5
      player.z = 9
      player.vx = 0
      player.vy = 0
      player.vz = 0
      player.rotY = Math.PI
      player.mantle = null
      player.mantleCooldown = 0
      player.coyoteTimer = 0
      player.jumpBufferTimer = 0
      sfx.playJump()
    }

    // === HANGOUT COMPANION BOTS ===
    const botConfigs: Array<{
      id: string
      username: string
      rank: string
      avatar: R6AvatarConfig
      waypoints: HangoutBot['waypoints']
    }> = [
      {
        id: 'bot_kuba',
        username: 'KubaDev',
        rank: 'Glacier Elite',
        avatar: { outfitId: 'arctic-frost', faceId: 'wink-pro', hatId: 'headphones', skinColor: '#FDE0B6' },
        waypoints: [
          { x: -6, z: 6, pause: 4.5, emote: 'wave', chat: lang === 'pl' ? 'Siema! Witaj w Lobby Głównym!' : 'Hey! Welcome to Main Lobby!' },
          { x: -13, z: 2, pause: 5, emote: 'idle' },
          { x: -4, z: 18, pause: 6, emote: 'dance', chat: lang === 'pl' ? 'Wpadaj na parkiet!' : 'Come dance on stage!' },
        ],
      },
      {
        id: 'bot_nadia',
        username: 'NadiaSky',
        rank: 'Crystal III',
        avatar: { outfitId: 'crystal-royal', faceId: 'star-eyes', hatId: 'crystal-halo', skinColor: '#F3C998' },
        waypoints: [
          { x: 6, z: -5, pause: 5, emote: 'cheer', chat: lang === 'pl' ? 'Można siadać na ławkach pod [E]!' : 'You can sit on benches with [E]!' },
          { x: 11, z: -8, pause: 4, emote: 'backflip' },
          { x: 4, z: 10, pause: 5, emote: 'wave' },
        ],
      },
      {
        id: 'bot_mati',
        username: 'MatiBlox',
        rank: 'Crystal II',
        avatar: { outfitId: 'classic-remaster', faceId: 'cool-shades', hatId: 'fresh-cap', skinColor: '#FACC15' },
        waypoints: [
          { x: 2.5, z: 23, pause: 6, emote: 'dance', chat: lang === 'pl' ? 'Kto wbija na Taras Widokowy?' : 'Who is climbing the Sky Terrace?' },
          { x: -8, z: 14, pause: 4, emote: 'spin' },
          { x: 8, z: 8, pause: 4, emote: 'idle' },
        ],
      },
    ]

    const botsGroup = new THREE.Group()
    scene.add(botsGroup)
    const bots: HangoutBot[] = botConfigs.map((bc) => {
      const rig = createR6Rig({
        avatar: bc.avatar,
        username: bc.username,
        rank: bc.rank,
        showNameplate: true,
        castShadow: initQ !== 'low',
      })
      const start = bc.waypoints[0]
      rig.root.position.set(start.x, 0.14, start.z)
      botsGroup.add(rig.root)
      return {
        id: bc.id,
        username: bc.username,
        rank: bc.rank,
        rig,
        x: start.x,
        z: start.z,
        rotY: 0,
        waypoints: bc.waypoints,
        wpIndex: 0,
        pauseTimer: 2,
        speechTimer: 0,
      }
    })

    // === REMOTE MULTIPLAYER PLAYERS ===
    const remotePlayers = new Map<
      string,
      { state: RemotePlayerState; rig: R6RigHandle; speechUntil: number }
    >()

    // Teleport right next to any player or companion bot in the room ("Meet" button in FreshBlox Quick Hub!)
    teleportToMemberRef.current = (memberId: string) => {
      let targetX: number | null = null
      let targetY = 0.25
      let targetZ: number | null = null
      let targetName = ''

      const remote = remotePlayers.get(memberId)
      if (remote) {
        targetX = remote.state.x
        targetY = Math.max(0.25, remote.state.y)
        targetZ = remote.state.z
        targetName = remote.state.username
      } else {
        const bot = bots.find((b) => b.id === memberId)
        if (bot) {
          targetX = bot.x
          targetY = 0.25
          targetZ = bot.z
          targetName = bot.username
        }
      }
      if (targetX === null || targetZ === null) return

      seatedBenchRef.current = null
      setSeatedBench(null)
      activeEmoteRef.current = null
      setActiveEmote(null)

      // Place player 2.3m cleanly beside target facing them
      const offsetAngle = Math.atan2(player.x - targetX, player.z - targetZ)
      const destX = Math.max(-33, Math.min(33, targetX + Math.sin(offsetAngle) * 2.35))
      const destZ = Math.max(-33, Math.min(33, targetZ + Math.cos(offsetAngle) * 2.35))
      player.x = destX
      player.y = targetY + 0.15
      player.z = destZ
      player.vx = 0
      player.vy = 0
      player.vz = 0
      player.rotY = Math.atan2(targetX - destX, targetZ - destZ)
      sfx.playJump()
      showToast(`${t.teleportedTo} ${targetName}`)
    }

    const mp = new LobbyMultiplayerClient({
      roomId: roomCode,
      world: 'lobby',
      selfId: playerId,
      onHistory: (history) => {
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id))
          return [...prev, ...history.filter((h) => !seen.has(h.id))].slice(-40)
        })
      },
      onState: (state) => {
        const existing = remotePlayers.get(state.id)
        if (!existing) {
          const rig = createR6Rig({
            avatar: state.avatar,
            username: state.username,
            rank: state.rank,
            showNameplate: true,
            castShadow: qualityRef.current !== 'low',
          })
          rig.root.position.set(state.x, state.y, state.z)
          scene.add(rig.root)
          remotePlayers.set(state.id, { state, rig, speechUntil: 0 })
        } else {
          // Live hot-swap remote player rig whenever a friend changes outfit/hat/face/skin in real time!
          if (avatarKey(existing.state.avatar) !== avatarKey(state.avatar)) {
            const pos = existing.rig.root.position.clone()
            const rotY = existing.rig.root.rotation.y
            scene.remove(existing.rig.root)
            existing.rig.dispose()
            const swapped = createR6Rig({
              avatar: state.avatar,
              username: state.username,
              rank: state.rank,
              showNameplate: true,
              castShadow: qualityRef.current !== 'low',
            })
            swapped.root.position.copy(pos)
            swapped.root.rotation.y = rotY
            scene.add(swapped.root)
            existing.rig = swapped
          }
          existing.state = state
        }
      },
      onLeave: (id) => {
        const entry = remotePlayers.get(id)
        if (entry) {
          scene.remove(entry.rig.root)
          entry.rig.dispose()
          remotePlayers.delete(id)
        }
      },
      onChat: (msg) => {
        setMessages((prev) => [...prev.slice(-34), msg])
        if (!chatOpenRef.current) setUnreadCount((n) => n + 1)
        sfx.playChatPop()
        const entry = remotePlayers.get(msg.senderId)
        if (entry) {
          entry.rig.setSpeech(msg.text)
          entry.speechUntil = performance.now() + 5500
        }
      },
    })
    mp.connect()
    mpRef.current = mp

    // === INPUT HANDLING: KEYBOARD + MOUSE + MULTI-TOUCH ORBIT & PINCH ZOOM ===
    const keys = new Set<string>()
    let camYaw = 0
    let camPitch = 0.34
    let camDist = 11.2

    // Smoothly swing camera to face the player's front when opening Live Wardrobe!
    focusWardrobeCamRef.current = () => {
      camYaw = player.rotY + 0.16
      camPitch = 0.22
    }

    recenterCamRef.current = () => {
      camYaw = player.rotY + Math.PI
      camPitch = 0.32
      sfx.playClick()
    }

    const requestLockSafe = () => {
      if (touchModeRef.current) return
      if (document.pointerLockElement === renderer.domElement) return
      try {
        const res = (renderer.domElement.requestPointerLock as unknown as () => Promise<void> | void)?.()
        if (res && typeof (res as Promise<void>).catch === 'function') {
          ;(res as Promise<void>).catch(() => {})
        }
      } catch {
        // Ignore browser rejection when called outside direct user gesture
      }
    }

    lockMouseRef.current = () => {
      requestLockSafe()
    }

    toggleShiftLockRef.current = () => {
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock?.()
      } else {
        requestLockSafe()
      }
      sfx.playClick()
    }

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === renderer.domElement
      if (!locked && shiftLockRef.current) {
        pointerLockReleasedAtRef.current = performance.now()
      }
      shiftLockRef.current = locked
      setShiftLockActive(locked)
      if (locked) {
        activePointers.clear()
      }
    }

    const activePointers = new Map<number, { x: number; y: number }>()
    let lastPinchDist = 0

    const isTextFieldFocused = () => {
      if (chatInputFocusedRef.current) return true
      const el = document.activeElement
      if (!el) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (feedbackOpenRef.current || isTextFieldFocused()) return
      const code = e.code
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code)) {
        e.preventDefault()
      }
      if (code === 'Space') {
        const activeEl = document.activeElement as HTMLElement | null
        if (activeEl && activeEl.tagName === 'BUTTON') {
          activeEl.blur()
        }
        if (!e.repeat) {
          jumpQueuedRef.current = true
        }
      }
      if (code === 'Tab' || code === 'KeyM') {
        e.preventDefault()
        toggleShiftLockRef.current()
        return
      }
      if (code === 'KeyC') {
        recenterCamRef.current()
        return
      }
      if (code === 'Escape') {
        e.preventDefault()
        if (wardrobeOpenRef.current) {
          setWardrobeOpen(false)
          setPreviewAvatar({ ...avatarRef.current })
          sfx.playClick()
          return
        }
        if (performance.now() - pointerLockReleasedAtRef.current < 220) {
          return
        }
        setHubOpen((open) => !open)
        sfx.playClick()
        return
      }
      keys.add(code)
      if (code === 'KeyE') {
        if (nearPortalRef.current?.action === 'obby') {
          sfx.playJump()
          callbacksRef.current.onEnterObby()
        } else if (seatedBenchRef.current || nearBenchRef.current) {
          toggleSitActionRef.current()
        }
      }
      if (code === 'Digit1') triggerEmote('wave')
      if (code === 'Digit2') triggerEmote('dance')
      if (code === 'Digit3') triggerEmote('cheer')
      if (code === 'Digit4') triggerEmote('sit')
      if (code === 'Digit5') triggerEmote('spin')
      if (code === 'Digit6') triggerEmote('backflip')
    }
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code)
    const onWindowBlur = () => {
      keys.clear()
      jumpQueuedRef.current = false
      jumpHeldRef.current = false
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return
      // Desktop PC: clicking the 3D scene automatically locks the mouse when Mouse Lock mode is enabled!
      if (
        !touchModeRef.current &&
        clickToLockRef.current &&
        e.pointerType !== 'touch' &&
        e.button === 0 &&
        document.pointerLockElement !== renderer.domElement &&
        !hubOpenRef.current &&
        !wardrobeOpenRef.current &&
        !feedbackOpenRef.current
      ) {
        const activeEl = document.activeElement as HTMLElement | null
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'BUTTON')) {
          activeEl.blur()
        }
        requestLockSafe()
        return
      }
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      try {
        renderer.domElement.setPointerCapture(e.pointerId)
      } catch {
        // ignore
      }
      if (activePointers.size === 2) {
        const pts = Array.from(activePointers.values())
        lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      }
    }

    let lastLockMoveTs = 0
    const applyPointerLockDelta = (mx: number, my: number, ts: number) => {
      if (ts === lastLockMoveTs) return
      lastLockMoveTs = ts
      if (Math.abs(mx) > 350 || Math.abs(my) > 350) return
      const s = mouseSensRef.current
      camYaw -= mx * 0.0038 * s
      camPitch = Math.max(0.08, Math.min(1.12, camPitch + my * 0.0034 * s))
    }

    const onLockedMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === renderer.domElement) {
        applyPointerLockDelta(e.movementX, e.movementY, e.timeStamp)
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (document.pointerLockElement === renderer.domElement) {
        applyPointerLockDelta(e.movementX, e.movementY, e.timeStamp)
        return
      }

      const prev = activePointers.get(e.pointerId)
      if (!prev) return

      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      prev.x = e.clientX
      prev.y = e.clientY

      if (activePointers.size === 1) {
        const sensitivity = e.pointerType === 'touch' ? 0.0092 : 0.0055 * mouseSensRef.current
        camYaw -= dx * sensitivity
        camPitch = Math.max(0.08, Math.min(1.12, camPitch + dy * sensitivity * 0.85))
      } else if (activePointers.size === 2) {
        const pts = Array.from(activePointers.values())
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
        if (lastPinchDist > 0) {
          camDist = Math.max(6.2, Math.min(18, camDist - (dist - lastPinchDist) * 0.03))
        }
        lastPinchDist = dist
      }
    }

    const onPointerEnd = (e: PointerEvent) => {
      activePointers.delete(e.pointerId)
      if (activePointers.size < 2) lastPinchDist = 0
    }

    const onWheel = (e: WheelEvent) => {
      camDist = Math.max(6.2, Math.min(18, camDist + e.deltaY * 0.008))
    }

    const onContext = (e: MouseEvent) => e.preventDefault()

    document.addEventListener('pointerlockchange', onPointerLockChange)
    document.addEventListener('mousemove', onLockedMouseMove)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onWindowBlur)
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerEnd)
    renderer.domElement.addEventListener('pointercancel', onPointerEnd)
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true })
    renderer.domElement.addEventListener('contextmenu', onContext)

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

    // Pre-allocated scratch vectors
    const camForward = new THREE.Vector3()
    const camRight = new THREE.Vector3()
    const moveVec = new THREE.Vector3()
    const desiredCamPos = new THREE.Vector3()
    const lookTarget = new THREE.Vector3()

    // Helper: checks if stepping up onto `targetY` at `(tx, tz)` has clear headroom!
    const playerR = 0.54
    const hasHeadroomAt = (tx: number, tz: number, targetY: number): boolean => {
      for (const b of colliders) {
        if (tx + playerR > b.minX && tx - playerR < b.maxX && tz + playerR > b.minZ && tz - playerR < b.maxZ) {
          if (targetY + 3.1 > b.minY + 0.15 && targetY < b.maxY - 0.05) {
            return false
          }
        }
      }
      return true
    }

    let rafId = 0
    let lastTime = performance.now()
    let elapsed = 0
    let lastBroadcast = 0
    let lastCountUpdate = 0
    let lastProximityCheck = 0
    let fpsFrames = 0
    let fpsLastTick = performance.now()

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate)
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      elapsed += dt

      // Lightweight FPS meter
      fpsFrames++
      if (now - fpsLastTick >= 500) {
        const measured = Math.round((fpsFrames * 1000) / (now - fpsLastTick))
        setFpsDisplay(measured)
        fpsFrames = 0
        fpsLastTick = now
      }

      // Combine keyboard + analog virtual thumbstick inputs
      const inputBlocked = feedbackOpenRef.current
      let inputX = 0
      let inputZ = 0
      if (!inputBlocked) {
        if (keys.has('KeyW') || keys.has('ArrowUp')) inputZ += 1
        if (keys.has('KeyS') || keys.has('ArrowDown')) inputZ -= 1
        if (keys.has('KeyA') || keys.has('ArrowLeft')) inputX -= 1
        if (keys.has('KeyD') || keys.has('ArrowRight')) inputX += 1

        const stickX = touchMoveRef.current.x
        const stickY = touchMoveRef.current.y
        if (Math.abs(stickX) > 0.08 || Math.abs(stickY) > 0.08) {
          inputX += stickX
          inputZ -= stickY
        }

        // Keyboard smooth camera yaw rotation (Q / E when not near bench/portal)
        if (keys.has('KeyQ')) camYaw += 2.2 * dt
        if (keys.has('KeyE') && !nearBenchRef.current && !seatedBenchRef.current && nearPortalRef.current?.action !== 'obby') {
          camYaw -= 2.2 * dt
        }
      }

      const isMoving = Math.abs(inputX) > 0.06 || Math.abs(inputZ) > 0.06
      const holdJump = !inputBlocked && (keys.has('Space') || jumpHeldRef.current)
      if (!inputBlocked && jumpQueuedRef.current) {
        player.jumpBufferTimer = 0.18
        jumpQueuedRef.current = false
      } else {
        player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt)
      }
      player.mantleCooldown = Math.max(0, player.mantleCooldown - dt)

      // If seated on a bench, moving or jumping stands you right back up!
      if (seatedBenchRef.current) {
        if (isMoving || holdJump || player.jumpBufferTimer > 0) {
          const triggeredJump = holdJump || player.jumpBufferTimer > 0
          standUpFromBench()
          if (triggeredJump) {
            player.vy = 10.8
            player.grounded = false
            player.coyoteTimer = 0
            player.jumpBufferTimer = 0
            sfx.playJump()
          }
        }
      }

      const isSprinting =
        keys.has('ShiftLeft') ||
        keys.has('ShiftRight') ||
        sprintLockedRef.current ||
        touchMoveRef.current.autoSprint
      const speed = isSprinting ? 12.6 : 7.8

      if (!seatedBenchRef.current) {
        if (player.mantle) {
          // === ACTIVE LEDGE GRAB & CLIMB-UP MANTLE ===
          const m = player.mantle
          m.elapsed += dt
          const p = Math.min(1, m.elapsed / m.duration)
          let diff = m.faceYaw - player.rotY
          while (diff > Math.PI) diff -= Math.PI * 2
          while (diff < -Math.PI) diff += Math.PI * 2
          player.rotY += diff * Math.min(1, dt * 22)

          if (p < 0.3) {
            const k = 1 - Math.pow(1 - p / 0.3, 2)
            player.x = m.startX + (m.grabX - m.startX) * k
            player.y = m.startY + (m.grabY - m.startY) * k
            player.z = m.startZ + (m.grabZ - m.startZ) * k
          } else {
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
          player.visualStepOffset = 0

          if (p >= 1) {
            player.x = m.endX
            player.y = m.endY
            player.z = m.endZ
            player.vy = 0
            player.grounded = true
            player.coyoteTimer = 0.15
            player.mantle = null
            player.mantleCooldown = 0.14
            if (player.jumpBufferTimer > 0) {
              player.vy = 11.4
              player.grounded = false
              player.coyoteTimer = 0
              player.jumpBufferTimer = 0
              sfx.playJump()
            }
          }
        } else {
          if (isMoving && activeEmoteRef.current) {
            activeEmoteRef.current = null
            setActiveEmote(null)
          }

          camForward.set(-Math.sin(camYaw), 0, -Math.cos(camYaw))
          camRight.set(Math.cos(camYaw), 0, -Math.sin(camYaw))
          moveVec.set(0, 0, 0).addScaledVector(camForward, inputZ).addScaledVector(camRight, inputX)
          const mag = moveVec.length()
          if (mag > 1) moveVec.divideScalar(mag)

          player.vx = moveVec.x * speed
          player.vz = moveVec.z * speed

          if (shiftLockRef.current && shiftLockAlignRef.current) {
            const targetAngle = camYaw + Math.PI
            let diff = targetAngle - player.rotY
            while (diff > Math.PI) diff -= Math.PI * 2
            while (diff < -Math.PI) diff += Math.PI * 2
            player.rotY += diff * Math.min(1, dt * 18)
          } else if (isMoving) {
            const targetAngle = Math.atan2(player.vx, player.vz)
            let diff = targetAngle - player.rotY
            while (diff > Math.PI) diff -= Math.PI * 2
            while (diff < -Math.PI) diff += Math.PI * 2
            player.rotY += diff * Math.min(1, dt * 14)
          }

          // Coyote Time (150ms) + Jump Buffer (180ms) + Instant Hold-to-Jump (ZERO felt cooldown!)
          if (player.grounded) {
            player.coyoteTimer = 0.15
          } else {
            player.coyoteTimer = Math.max(0, player.coyoteTimer - dt)
          }

          const tryLobbyJump = () => {
            if (inputBlocked) return false
            const canJump = player.grounded || player.coyoteTimer > 0
            const wantsJump = player.jumpBufferTimer > 0 || (holdJump && player.grounded)
            if (canJump && wantsJump) {
              player.vy = 11.4
              player.grounded = false
              player.coyoteTimer = 0
              player.jumpBufferTimer = 0
              if (activeEmoteRef.current) {
                activeEmoteRef.current = null
                setActiveEmote(null)
              }
              sfx.playJump()
              return true
            }
            return false
          }

          tryLobbyJump()

          // === SUB-STEPPED SOLID 3D COLLISION + AUTO-STEP + LEDGE GRAB & MANTLE ===
          const PLAYER_H = 3.15
          const subSteps = Math.max(1, Math.min(4, Math.ceil(dt / 0.011)))
          const sdt = dt / subSteps

          for (let step = 0; step < subSteps; step++) {
            player.vy -= 28 * sdt

            const prevX = player.x
            const prevY = player.y
            const prevZ = player.z
            let autoSteppedToY = prevY
            let startedMantle = false

            const tryTriggerLobbyMantle = (b: AABB, nx: number, nz: number, curX: number, curZ: number) => {
              if (player.grounded || player.mantleCooldown > 0 || player.vy > 5.8) return false
              const ledgeDelta = b.maxY - prevY
              if (ledgeDelta < 0.28 || ledgeDelta > 2.35) return false
              // Ignore narrow tree trunks so players don't climb straight up tree bark
              if (b.maxX - b.minX < 1.45 && b.maxZ - b.minZ < 1.45) return false

              const towardDot =
                (isMoving ? moveVec.x * -nx + moveVec.z * -nz : 0) +
                (Math.sin(player.rotY) * -nx + Math.cos(player.rotY) * -nz) * 0.4
              if (towardDot <= -0.15 && !holdJump && player.jumpBufferTimer <= 0) return false

              const halfW = (b.maxX - b.minX) * 0.5
              const halfD = (b.maxZ - b.minZ) * 0.5
              const cx = (b.minX + b.maxX) * 0.5
              const cz = (b.minZ + b.maxZ) * 0.5
              const grabX = nx !== 0 ? cx + nx * (halfW + playerR + 0.02) : Math.max(b.minX + 0.25, Math.min(b.maxX - 0.25, curX))
              const grabZ = nz !== 0 ? cz + nz * (halfD + playerR + 0.02) : Math.max(b.minZ + 0.25, Math.min(b.maxZ - 0.25, curZ))
              const insetX = Math.min(0.55, halfW * 0.72)
              const insetZ = Math.min(0.55, halfD * 0.72)
              const endX = nx !== 0 ? cx + nx * Math.max(0, halfW - insetX) : Math.max(b.minX + 0.28, Math.min(b.maxX - 0.28, curX))
              const endZ = nz !== 0 ? cz + nz * Math.max(0, halfD - insetZ) : Math.max(b.minZ + 0.28, Math.min(b.maxZ - 0.28, curZ))

              if (!hasHeadroomAt(endX, endZ, b.maxY)) return false

              player.mantle = {
                elapsed: 0,
                duration: 0.34,
                startX: prevX,
                startY: prevY,
                startZ: prevZ,
                grabX,
                grabY: Math.min(b.maxY - 1.35, Math.max(prevY, b.maxY - 1.75)),
                grabZ,
                endX,
                endY: b.maxY,
                endZ,
                faceYaw: Math.atan2(-nx, -nz),
              }
              if (activeEmoteRef.current) {
                activeEmoteRef.current = null
                setActiveEmote(null)
              }
              sfx.playLedgeGrab()
              return true
            }

            // Move X with solid side wall & auto-step / mantle check
            player.x += player.vx * sdt
            for (const b of colliders) {
              if (prevY + PLAYER_H > b.minY + 0.08 && prevY < b.maxY - 0.06) {
                if (
                  player.x + playerR > b.minX &&
                  player.x - playerR < b.maxX &&
                  player.z + playerR > b.minZ &&
                  player.z - playerR < b.maxZ
                ) {
                  const ledgeHeight = b.maxY - prevY
                  if (player.grounded && ledgeHeight > 0 && ledgeHeight <= STEP_HEIGHT && hasHeadroomAt(player.x, player.z, b.maxY)) {
                    autoSteppedToY = Math.max(autoSteppedToY, b.maxY)
                  } else {
                    const nx = prevX >= (b.minX + b.maxX) * 0.5 ? 1 : -1
                    if (tryTriggerLobbyMantle(b, nx, 0, player.x, player.z)) {
                      startedMantle = true
                      break
                    }
                    if (nx < 0) player.x = b.minX - playerR - 0.002
                    else player.x = b.maxX + playerR + 0.002
                  }
                }
              }
            }
            if (startedMantle) break

            // Move Z with solid side wall & auto-step / mantle check
            player.z += player.vz * sdt
            for (const b of colliders) {
              if (prevY + PLAYER_H > b.minY + 0.08 && prevY < b.maxY - 0.06) {
                if (
                  player.x + playerR > b.minX &&
                  player.x - playerR < b.maxX &&
                  player.z + playerR > b.minZ &&
                  player.z - playerR < b.maxZ
                ) {
                  const ledgeHeight = b.maxY - prevY
                  if (player.grounded && ledgeHeight > 0 && ledgeHeight <= STEP_HEIGHT && hasHeadroomAt(player.x, player.z, b.maxY)) {
                    autoSteppedToY = Math.max(autoSteppedToY, b.maxY)
                  } else {
                    const nz = prevZ >= (b.minZ + b.maxZ) * 0.5 ? 1 : -1
                    if (tryTriggerLobbyMantle(b, 0, nz, player.x, player.z)) {
                      startedMantle = true
                      break
                    }
                    if (nz < 0) player.z = b.minZ - playerR - 0.002
                    else player.z = b.maxZ + playerR + 0.002
                  }
                }
              }
            }
            if (startedMantle) break

            if (autoSteppedToY > prevY) {
              const delta = autoSteppedToY - prevY
              player.y = autoSteppedToY
              player.visualStepOffset -= delta
              player.vy = Math.max(0, player.vy)
            }

            // Move Y: Land on tops + Ceiling bump (no head clipping under arches/ledges!)
            player.y += player.vy * sdt
            player.grounded = false
            for (const b of colliders) {
              if (
                player.x + playerR > b.minX &&
                player.x - playerR < b.maxX &&
                player.z + playerR > b.minZ &&
                player.z - playerR < b.maxZ
              ) {
                if (player.vy <= 0 && prevY >= b.maxY - STEP_HEIGHT && player.y <= b.maxY + 0.05) {
                  player.y = b.maxY
                  player.vy = 0
                  player.grounded = true
                } else if (player.vy > 0 && prevY + PLAYER_H <= b.minY + 0.24 && player.y + PLAYER_H >= b.minY) {
                  player.y = b.minY - PLAYER_H
                  player.vy = 0
                }
              }
            }

            if (player.grounded) {
              player.coyoteTimer = 0.15
              // Instant re-jump on exact landing frame if Space/Jump was buffered or held!
              tryLobbyJump()
            }
          }

          // Decay visual step smoothing quickly
          player.visualStepOffset *= Math.max(0, 1 - dt * 18)

          // Plaza boundary & safety respawn
          player.x = Math.max(-35, Math.min(35, player.x))
          player.z = Math.max(-35, Math.min(35, player.z))
          if (player.y < -12) {
            player.x = 0
            player.y = 1.5
            player.z = 9
            player.vy = 0
          }

          // Jump-Pads
          for (const jp of jumpPads) {
            jp.ring.scale.setScalar(1 + Math.sin(elapsed * 5) * 0.06)
            const dSq = (player.x - jp.x) ** 2 + (player.z - jp.z) ** 2
            if (dSq < jp.radius * jp.radius && Math.abs(player.y - jp.y) < 0.7 && player.vy <= 1) {
              player.vy = jp.boost
              player.grounded = false
              player.coyoteTimer = 0
              sfx.playJumpPad()
              callbacksRef.current.onJumpPadUsed()
            }
          }
        }
      }

      // Interactive proximity checks (every ~120ms so React never re-renders unnecessarily!)
      if (now - lastProximityCheck > 120) {
        lastProximityCheck = now
        let closestBench: BenchSpot | null = null
        let bestDistSq = 2.65 * 2.65
        for (const b of benches) {
          const dSq = (player.x - b.x) ** 2 + (player.z - b.z) ** 2
          if (dSq < bestDistSq) {
            bestDistSq = dSq
            closestBench = b
          }
        }
        if (closestBench?.id !== nearBenchRef.current?.id) {
          nearBenchRef.current = closestBench
          setNearBench(closestBench)
        }

        let foundPortal: { name: string; action?: 'obby' } | null = null
        for (const pz of portalZones) {
          const dSq = (player.x - pz.x) ** 2 + (player.z - pz.z) ** 2
          if (dSq < 4.4 * 4.4) {
            foundPortal = { name: pz.name, action: pz.action }
            break
          }
        }
        if (foundPortal?.name !== nearPortalRef.current?.name) {
          nearPortalRef.current = foundPortal
          setNearPortalInfo(foundPortal)
        }
      }

      // Reactive South Dance Stage glow when player steps on it!
      const onStage = Math.abs(player.x) < 6.2 && player.z > 19.6 && player.z < 28.4 && player.y >= 0.75
      danceFloorMat.emissiveIntensity = onStage ? 0.55 + Math.sin(elapsed * 8) * 0.25 : 0.35

      // Sky Observation Terrace milestone
      if (!player.reachedTerrace && player.y >= 7.0 && player.x > 21 && player.z > 9) {
        player.reachedTerrace = true
        sfx.playQuestClaim()
        callbacksRef.current.onReachTerrace()
        showToast(t.terraceUnlocked)
      }

      // Animate monument crystals, fountain water ripples & clouds
      waterPair.map.offset.x = (elapsed * 0.06) % 1
      waterPair.map.offset.y = (elapsed * 0.045) % 1
      waterPair.bumpMap.offset.x = waterPair.map.offset.x
      waterPair.bumpMap.offset.y = waterPair.map.offset.y
      centerCrystal.rotation.y = elapsed * 0.9
      centerCrystal.position.y = 3.85 + Math.sin(elapsed * 2.1) * 0.28
      terraceBeacon.rotation.y = -elapsed * 1.4
      if (cloudsGroup.visible) {
        cloudsGroup.children.forEach((c, idx) => {
          c.position.x += dt * (0.42 + (idx % 3) * 0.14)
          if (c.position.x > 65) c.position.x = -65
        })
      }

      // Emote timer & local R6 pose
      if (activeEmoteRef.current) {
        emoteTimerRef.current -= dt
        if (emoteTimerRef.current <= 0) {
          activeEmoteRef.current = null
          setActiveEmote(null)
        }
      }

      let currentPose: PlayerPose = 'idle'
      if (player.mantle) currentPose = 'mantle'
      else if (seatedBenchRef.current) currentPose = 'sit'
      else if (!player.grounded) currentPose = player.vy > 0 ? 'jump' : 'fall'
      else if (activeEmoteRef.current) currentPose = activeEmoteRef.current
      else if (isMoving) currentPose = isSprinting ? 'run' : 'walk'

      if (localRigRef.current) {
        localRigRef.current.root.position.set(player.x, player.y + player.visualStepOffset, player.z)
        localRigRef.current.root.rotation.y = player.rotY
        localRigRef.current.update(dt, elapsed, currentPose)
      }

      // Update Hangout Companion Bots
      botsGroup.visible = botsEnabledRef.current
      if (botsEnabledRef.current) {
        for (const bot of bots) {
          const wp = bot.waypoints[bot.wpIndex]
          const dx = wp.x - bot.x
          const dz = wp.z - bot.z
          const dist = Math.hypot(dx, dz)
          let botPose: PlayerPose = 'idle'

          if (dist > 0.35) {
            const step = Math.min(dist, dt * 4.2)
            bot.x += (dx / dist) * step
            bot.z += (dz / dist) * step
            const targetRot = Math.atan2(dx, dz)
            let diff = targetRot - bot.rotY
            while (diff > Math.PI) diff -= Math.PI * 2
            while (diff < -Math.PI) diff += Math.PI * 2
            bot.rotY += diff * Math.min(1, dt * 8)
            botPose = 'walk'
          } else {
            if (bot.pauseTimer === 0 && wp.chat) {
              bot.rig.setSpeech(wp.chat)
              bot.speechTimer = 4.2
            }
            bot.pauseTimer += dt
            botPose = wp.emote ?? 'idle'
            if (bot.pauseTimer >= wp.pause) {
              bot.pauseTimer = 0
              bot.wpIndex = (bot.wpIndex + 1) % bot.waypoints.length
            }
          }

          if (bot.speechTimer > 0) {
            bot.speechTimer -= dt
            if (bot.speechTimer <= 0) bot.rig.setSpeech(null)
          }

          bot.rig.root.position.set(bot.x, 0.14, bot.z)
          bot.rig.root.rotation.y = bot.rotY
          bot.rig.update(dt, elapsed, botPose)
        }
      }

      // Interpolate remote multiplayer peers
      for (const [id, entry] of remotePlayers.entries()) {
        if (now - entry.state.lastSeen > 12000) {
          scene.remove(entry.rig.root)
          entry.rig.dispose()
          remotePlayers.delete(id)
          continue
        }
        entry.rig.root.position.x += (entry.state.x - entry.rig.root.position.x) * Math.min(1, dt * 12)
        entry.rig.root.position.y += (entry.state.y - entry.rig.root.position.y) * Math.min(1, dt * 12)
        entry.rig.root.position.z += (entry.state.z - entry.rig.root.position.z) * Math.min(1, dt * 12)
        entry.rig.root.rotation.y = entry.state.rotY
        entry.rig.update(dt, elapsed, entry.state.pose)
        if (entry.speechUntil > 0 && now > entry.speechUntil) {
          entry.rig.setSpeech(null)
          entry.speechUntil = 0
        }
      }

      // Broadcast local state at ~15 Hz
      if (now - lastBroadcast > 66) {
        lastBroadcast = now
        mp.broadcastState({
          id: playerId,
          username: usernameRef.current,
          rank: rankRef.current,
          x: player.x,
          y: player.y,
          z: player.z,
          rotY: player.rotY,
          pose: currentPose,
          avatar: avatarRef.current,
          lastSeen: now,
        })
      }

      if (now - lastCountUpdate > 800) {
        lastCountUpdate = now
        const nextRoster: LobbyRosterEntry[] = [
          { id: playerId, username: usernameRef.current, rank: rankRef.current, isBot: false, isSelf: true },
        ]
        for (const entry of remotePlayers.values()) {
          nextRoster.push({
            id: entry.state.id,
            username: entry.state.username,
            rank: entry.state.rank,
            isBot: false,
          })
        }
        if (botsEnabledRef.current) {
          for (const b of bots) {
            nextRoster.push({
              id: b.id,
              username: b.username,
              rank: b.rank,
              isBot: true,
            })
          }
        }
        setRoster(nextRoster)
        setOnlineCount(nextRoster.length)
      }

      // Smooth 3rd-person orbit camera (frames avatar neatly on the left when Live Wardrobe is open!)
      const targetVisualY = player.y + player.visualStepOffset
      const inWardrobe = wardrobeOpenRef.current
      const effectiveDist = inWardrobe ? 5.85 : camDist
      const rightX = Math.cos(camYaw)
      const rightZ = -Math.sin(camYaw)
      const sideOffset = inWardrobe ? 1.15 : 0

      const camX = player.x + rightX * sideOffset + Math.sin(camYaw) * Math.cos(camPitch) * effectiveDist
      const camY = targetVisualY + (inWardrobe ? 2.15 : 2.45) + Math.sin(camPitch) * effectiveDist
      const camZ = player.z + rightZ * sideOffset + Math.cos(camYaw) * Math.cos(camPitch) * effectiveDist
      desiredCamPos.set(camX, Math.max(1.2, camY), camZ)
      camera.position.lerp(desiredCamPos, Math.min(1, dt * 10))
      lookTarget.set(
        player.x + rightX * sideOffset,
        targetVisualY + (inWardrobe ? 1.95 : 2.2),
        player.z + rightZ * sideOffset,
      )
      camera.lookAt(lookTarget)

      renderer.render(scene, camera)
    }

    rafId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      mp.disconnect()
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock?.()
      }
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      document.removeEventListener('mousemove', onLockedMouseMove)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onWindowBlur)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerEnd)
      renderer.domElement.removeEventListener('pointercancel', onPointerEnd)
      renderer.domElement.removeEventListener('wheel', onWheel)
      renderer.domElement.removeEventListener('contextmenu', onContext)

      localRigRef.current?.dispose()
      localRigRef.current = null
      for (const bot of bots) bot.rig.dispose()
      for (const entry of remotePlayers.values()) entry.rig.dispose()
      for (const d of disposables) d.dispose()
      renderer.dispose()
      rendererRef.current = null
      hemiLightRef.current = null
      sunLightRef.current = null
      sceneRef.current = null
      cloudsGroupRef.current = null
      nightSkyGroupRef.current = null
    }
  }, [roomCode, playerId, lang, showToast, t.terraceUnlocked, triggerEmote])

  const emotesList: Array<{ key: string; pose: PlayerPose; label: string }> = [
    { key: '1', pose: 'wave', label: t.emotes.wave },
    { key: '2', pose: 'dance', label: t.emotes.dance },
    { key: '3', pose: 'cheer', label: t.emotes.cheer },
    { key: '4', pose: 'sit', label: t.emotes.sit },
    { key: '5', pose: 'spin', label: t.emotes.spin },
    { key: '6', pose: 'backflip', label: t.emotes.backflip },
  ]

  return (
    <div
      className="fixed inset-x-0 z-30 w-full overflow-hidden bg-sky-200 select-none"
      style={{
        top: vp.offsetTop,
        height: vp.height,
        overscrollBehavior: 'none',
      }}
    >
      {/* 3D Canvas Host */}
      <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" style={{ touchAction: 'none' }} />

      {/* === ULTRA-CLEAN SINGLE-ROW TOP HUD BAR (Adapts to every screen width & height!) === */}
      <div
        className="pointer-events-none absolute top-0 inset-x-0 z-20 flex flex-nowrap items-center justify-between gap-1.5 sm:gap-2"
        style={{
          paddingTop: 'max(0.5rem, calc(env(safe-area-inset-top) + 0.35rem))',
          paddingLeft: 'max(0.6rem, calc(env(safe-area-inset-left) + 0.4rem))',
          paddingRight: 'max(0.6rem, calc(env(safe-area-inset-right) + 0.4rem))',
        }}
      >
        {/* Left integrated cluster: Official FreshBlox Logo Button (opens Quick Hub) + Chat + Room Pill */}
        <div className="pointer-events-auto flex min-w-0 items-center gap-1 sm:gap-1.5">
          <div className="flex h-9 sm:h-10 items-center rounded-2xl border border-white/15 bg-slate-950/75 p-0.5 sm:p-1 shadow-lg backdrop-blur-xl">
            <button
              type="button"
              onClick={() => {
                setHubOpen((open) => {
                  const next = !open
                  if (next) {
                    setWardrobeOpen(false)
                    if (touchMode) setChatOpen(false)
                  }
                  return next
                })
                sfx.playClick()
              }}
              title="FreshBlox Hub (Esc)"
              aria-label="FreshBlox Quick Hub"
              className={`flex h-8 w-9 items-center justify-center rounded-xl transition active:scale-95 cursor-pointer ${
                hubOpen ? 'bg-sky-500/30 ring-1 ring-sky-300/60' : 'hover:bg-white/10'
              }`}
            >
              <FreshBloxLogo size={23} />
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
                    if (touchMode) setWardrobeOpen(false)
                  }
                  return next
                })
                sfx.playClick()
              }}
              title={t.chatTitle}
              className={`relative flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold transition active:scale-95 cursor-pointer ${
                chatOpen ? 'bg-sky-500/25 text-sky-100' : 'text-sky-100/90 hover:bg-white/10'
              }`}
            >
              <MessageSquare className="h-4 w-4 text-sky-400 shrink-0" />
              <span className="hidden lg:inline">{t.chatTitle}</span>
              {unreadCount > 0 && !chatOpen && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-400 px-1 text-[10px] font-black text-slate-950">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Room badge — tap to open Players & Invite in FreshHub */}
          <button
            type="button"
            onClick={() => {
              setHubOpen((o) => !o)
              sfx.playClick()
            }}
            className="flex h-10 min-w-0 items-center gap-1.5 rounded-2xl border border-white/15 bg-slate-950/75 px-3 text-xs font-bold text-sky-50 shadow-lg backdrop-blur-xl hover:bg-slate-900/90 active:scale-95 transition cursor-pointer"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
            <span className="truncate font-mono text-[11px] sm:text-xs text-sky-200">{roomCode}</span>
            <span className="flex shrink-0 items-center gap-1 border-l border-white/15 pl-1.5 text-[11px] text-sky-100/85">
              <Users className="h-3.5 w-3.5 text-sky-300" />
              {onlineCount}
            </span>
          </button>
        </div>

        {/* Right minimalist cluster: Obby 100 quick jump + Shift-Lock (PC) + Live Wardrobe */}
        <div className="pointer-events-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={() => {
              sfx.playClick()
              onEnterObby()
            }}
            className="flex h-9 sm:h-10 items-center gap-1 sm:gap-1.5 rounded-2xl border border-amber-300/45 bg-slate-950/75 px-2.5 sm:px-3 text-[11px] sm:text-xs font-extrabold text-amber-200 shadow-lg backdrop-blur-xl hover:bg-slate-900/90 active:scale-95 transition cursor-pointer"
          >
            <Flag className="h-3.5 w-3.5 text-amber-300 shrink-0" />
            <span className="sm:hidden">Obby</span>
            <span className="hidden sm:inline">Test Obby 100</span>
          </button>

          {onOpenFeedback && (
            <button
              type="button"
              onClick={() => {
                sfx.playClick()
                onOpenFeedback(`Lobby Główne (${roomCode})`)
              }}
              title={lang === 'pl' ? 'Zgłoś błąd lub pomysł' : 'Report bug or idea'}
              className="flex h-9 sm:h-10 items-center gap-1 rounded-2xl border border-white/15 bg-slate-950/75 px-2.5 text-xs font-bold text-sky-100 shadow-lg backdrop-blur-xl hover:bg-slate-900/90 active:scale-95 transition cursor-pointer"
            >
              <MessageSquarePlus className="h-4 w-4 text-sky-300 shrink-0" />
              <span className="hidden lg:inline">{lang === 'pl' ? 'Zgłoś' : 'Feedback'}</span>
            </button>
          )}

          {!touchMode && (
            <button
              type="button"
              onClick={() => toggleShiftLockRef.current()}
              title={
                lang === 'pl'
                  ? 'Lock myszy (Klik / Tab / M — obrót kamery bez przeciągania)'
                  : 'Mouse Lock (Click / Tab / M — look without dragging)'
              }
              className={`flex h-9 sm:h-10 items-center gap-1.5 rounded-2xl border px-2.5 text-xs font-extrabold shadow-lg backdrop-blur-xl transition cursor-pointer ${
                shiftLockActive
                  ? 'border-sky-300/80 bg-sky-500/40 text-white ring-1 ring-sky-300/40'
                  : 'border-white/15 bg-slate-950/75 text-sky-100 hover:bg-slate-900/90'
              }`}
            >
              <Crosshair className={`h-3.5 w-3.5 ${shiftLockActive ? 'text-white' : 'text-sky-300'}`} />
              <span className="hidden sm:inline">
                {shiftLockActive
                  ? lang === 'pl'
                    ? 'Mysz zablok. · ESC'
                    : 'Locked · ESC'
                  : lang === 'pl'
                    ? 'Lock myszy'
                    : 'Mouse Lock'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => (wardrobeOpen ? closeLiveWardrobe() : openLiveWardrobe())}
            className={`flex h-9 sm:h-10 items-center gap-1.5 rounded-2xl border px-2.5 sm:px-3 text-[11px] sm:text-xs font-extrabold shadow-lg backdrop-blur-xl active:scale-95 transition cursor-pointer ${
              wardrobeOpen
                ? 'border-sky-300/70 bg-sky-500/30 text-white'
                : 'border-white/15 bg-slate-950/75 text-sky-50 hover:bg-slate-900/90'
            }`}
          >
            <Shirt className="h-4 w-4 text-sky-300 shrink-0" />
            <span className="hidden xs:inline sm:inline text-sky-100 font-bold">{t.quickAvatar}</span>
          </button>
        </div>
      </div>

      {/* === LIVE IN-GAME WARDROBE DRAWER (Change outfits, hats, faces & skin without leaving 3D!) === */}
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

      {/* === UPGRADED FRESHBLOX IN-GAME MENU (Logo F / Esc) === */}
      <InGameMenuDrawer
        open={hubOpen}
        worldKind="lobby"
        lang={lang}
        roomCode={roomCode}
        username={username}
        rankName={getRankForXp(xp).name}
        onlineCount={onlineCount}
        roster={roster}
        fpsDisplay={fpsDisplay}
        touchMode={touchMode}
        pointerLocked={shiftLockActive}
        clickToLock={mousePrefs.clickToLock}
        shiftLockAlign={mousePrefs.shiftLockAlign}
        mouseSensitivity={mousePrefs.sensitivity}
        onTogglePointerLock={() => toggleShiftLockRef.current()}
        onChangeClickToLock={(enabled) => updateMousePrefs({ clickToLock: enabled })}
        onChangeShiftLockAlign={(enabled) => updateMousePrefs({ shiftLockAlign: enabled })}
        onChangeMouseSensitivity={(sensitivity) => updateMousePrefs({ sensitivity })}
        worldTime={worldTime}
        soundEnabled={soundEnabled}
        quality={quality}
        isFullscreen={isFullscreen}
        botsEnabled={botsEnabled}
        supabaseConnected={isSupabaseConfigured}
        copiedInvite={copiedInvite}
        onChangeWorldTime={setWorldTime}
        onToggleSound={toggleSound}
        onChangeQuality={setQuality}
        onToggleTouchMode={() => setTouchMode((v) => !v)}
        onToggleFullscreen={handleToggleFullscreen}
        onToggleBots={() => setBotsEnabled((b) => !b)}
        onClose={() => setHubOpen(false)}
        onResumeAndLock={() => {
          setHubOpen(false)
          lockMouseRef.current()
        }}
        onOpenWardrobe={openLiveWardrobe}
        onCopyInvite={handleCopyInvite}
        onResetPosition={() => resetSpawnActionRef.current()}
        onSwitchWorld={onEnterObby}
        onLeaveToHome={onBackHome}
        onOpenFeedback={() => onOpenFeedback?.(`Lobby Główne (${roomCode})`)}
        onTeleportToMember={(memberId) => teleportToMemberRef.current(memberId)}
      />

      {/* MOBILE PORTRAIT ROTATE + FULLSCREEN HELPER BANNER */}
      {isPortraitMobile && !rotateBannerDismissed && (
        <div className="pointer-events-auto absolute top-14 left-1/2 -translate-x-1/2 z-30 w-[min(330px,calc(100vw-24px))]">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/15 bg-slate-950/90 px-3 py-2 text-xs text-sky-50 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2 min-w-0">
              <RotateCw className="h-4 w-4 shrink-0 text-sky-400" />
              <span className="text-[11px] font-semibold leading-tight">{t.rotateBannerText}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => enterGameFullscreenLandscape()}
                className="rounded-xl bg-sky-400 px-2.5 py-1.5 text-[10px] font-black text-slate-950 active:scale-95 cursor-pointer"
              >
                {t.rotateBannerBtn}
              </button>
              <button
                type="button"
                onClick={() => setRotateBannerDismissed(true)}
                className="rounded-lg p-1 text-sky-200/70 hover:text-white cursor-pointer"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REWARD / EVENT TOAST */}
      {toast && (
        <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-30 animate-[rewardPop_0.35s_ease-out]">
          <div className="flex items-center gap-2 rounded-full bg-slate-950/88 border border-sky-400/40 px-4 py-1.5 text-xs sm:text-sm font-extrabold text-sky-100 shadow-xl backdrop-blur-md">
            <Sparkles className="h-4 w-4 text-sky-300" />
            {toast}
          </div>
        </div>
      )}

      {/* INTERACTIVE BENCH SIT / STAND PROMPT OR PORTAL ACTION */}
      {(seatedBench || nearBench || nearPortalInfo) && (
        <div
          className="pointer-events-auto absolute left-1/2 -translate-x-1/2 z-20"
          style={{
            bottom: touchMode
              ? 'max(6.2rem, calc(env(safe-area-inset-bottom) + 5.6rem))'
              : 'max(1.4rem, env(safe-area-inset-bottom))',
          }}
        >
          {seatedBench || nearBench ? (
            <button
              type="button"
              onClick={() => toggleSitActionRef.current()}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex items-center gap-2 rounded-full border border-sky-300/60 bg-slate-950/85 px-4 py-2 text-xs font-extrabold text-sky-50 shadow-xl backdrop-blur-xl transition hover:bg-slate-900 active:scale-95 cursor-pointer"
            >
              <Armchair className="h-4 w-4 text-sky-400" />
              <span>{seatedBench ? t.standPrompt : t.sitPrompt}</span>
              <span className="hidden sm:inline rounded-md bg-white/10 border border-white/20 px-1.5 py-0.5 font-mono text-[10px] text-sky-200">
                E
              </span>
            </button>
          ) : nearPortalInfo?.action === 'obby' ? (
            <button
              type="button"
              onClick={() => {
                sfx.playJump()
                onEnterObby()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex items-center gap-2 rounded-full border border-amber-300/70 bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-xl backdrop-blur-xl transition hover:brightness-110 active:scale-95 cursor-pointer"
            >
              <Flag className="h-4 w-4 text-amber-200" />
              <span>{t.portalObbyPrompt}</span>
              <span className="hidden sm:inline rounded-md bg-white/15 border border-white/25 px-1.5 py-0.5 font-mono text-[10px] text-white">
                E
              </span>
            </button>
          ) : nearPortalInfo ? (
            <div className="flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/80 px-4 py-2 text-xs font-bold text-sky-100 backdrop-blur-xl shadow-lg">
              <Sparkles className="h-3.5 w-3.5 text-sky-400" />
              <span>
                {nearPortalInfo.name} — {t.portalSoonHint}
              </span>
            </div>
          ) : null}
        </div>
      )}

      {/* === CLEAN CHAT DRAWER (Only visible when opened via top bar button — never blocks controls!) === */}
      {chatOpen && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className={`pointer-events-auto absolute z-25 w-[min(300px,calc(100vw-28px))] rounded-2xl bg-slate-950/82 border border-white/15 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col ${
            touchMode ? 'top-14 max-h-[calc(100dvh-195px)]' : 'bottom-4 max-h-60'
          }`}
          style={{ left: 'max(0.75rem, env(safe-area-inset-left))' }}
        >
          <div className="flex shrink-0 items-center justify-between px-3 py-1.5 border-b border-white/10">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-sky-100">
              <MessageSquare className="h-3.5 w-3.5 text-sky-400" />
              {t.chatTitle}
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-[10px] font-semibold text-sky-300/75">
                {isSupabaseConfigured ? t.multiplayerHintSupabase : t.multiplayerHintLocal}
              </span>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="rounded-lg p-1 text-sky-200/75 hover:bg-white/10 hover:text-white cursor-pointer"
                aria-label="Minimize chat"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1 text-xs">
            {messages.map((m) => (
              <div key={m.id} className="leading-snug">
                <span className={m.system ? 'font-bold text-sky-400' : 'font-extrabold text-sky-200'}>
                  {m.username}:{' '}
                </span>
                <span className={m.system ? 'text-sky-100/80' : 'text-white/95'}>{m.text}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendChat} className="flex shrink-0 items-center gap-1.5 p-1.5 border-t border-white/10 bg-slate-950/55">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onFocus={() => {
                chatInputFocusedRef.current = true
              }}
              onBlur={() => {
                chatInputFocusedRef.current = false
              }}
              placeholder={t.chatPlaceholder}
              className="min-w-0 flex-1 rounded-xl bg-slate-900/90 px-2.5 py-1.5 text-xs text-white placeholder-sky-200/45 border border-white/15 focus:outline-none focus:border-sky-400"
            />
            <button
              type="submit"
              className="flex shrink-0 items-center justify-center rounded-xl bg-sky-500 p-2 text-slate-950 hover:bg-sky-400 transition cursor-pointer"
              aria-label={t.chatSend}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* DESKTOP EMOTE BAR & MOUSE LOCK HINT (hidden while Live Wardrobe is open) */}
      {!touchMode && !wardrobeOpen && (
        <div className="pointer-events-none absolute bottom-4 right-4 hidden sm:flex flex-col items-end gap-1.5 z-10">
          <div className="pointer-events-auto flex flex-wrap justify-end gap-1.5 rounded-2xl bg-slate-950/75 p-2 border border-white/15 backdrop-blur-xl shadow-2xl">
            {emotesList.map((em) => (
              <button
                key={em.key}
                onClick={() => triggerEmote(em.pose)}
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                  activeEmote === em.pose
                    ? 'bg-sky-400 text-slate-950 shadow-md'
                    : 'bg-white/8 text-sky-100 hover:bg-white/15'
                }`}
              >
                <span className="rounded bg-black/25 px-1.5 py-0.5 font-mono text-[10px]">{em.key}</span>
                <span>{em.label}</span>
              </button>
            ))}
          </div>
          <div className="rounded-full bg-slate-950/60 px-3 py-0.5 text-[10px] font-semibold text-sky-100/80 backdrop-blur">
            {shiftLockActive
              ? lang === 'pl'
                ? 'Mysz zablokowana · ESC lub Tab aby zwolnić kursor'
                : 'Mouse locked · Press ESC or Tab to release cursor'
              : mousePrefs.clickToLock
                ? lang === 'pl'
                  ? 'Kliknij ekran 3D lub Tab/M = Lock myszy (bez przeciągania)'
                  : 'Click 3D view or Tab/M = Mouse Lock (no dragging)'
                : t.controlsList}
          </div>
        </div>
      )}

      {/* MOUSE LOCK / SHIFT-LOCK RETICLE (Desktop) */}
      {shiftLockActive && !touchMode && (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
          {mousePrefs.shiftLockAlign ? (
            <Crosshair className="h-5 w-5 text-sky-200 drop-shadow-[0_1px_4px_rgba(2,132,199,0.95)]" />
          ) : (
            <div className="h-2.5 w-2.5 rounded-full border-2 border-white/95 bg-sky-400/90 shadow-[0_0_8px_rgba(56,189,248,0.95)]" />
          )}
        </div>
      )}

      {/* MOBILE / TABLET VIRTUAL THUMBSTICK & ACTION BUTTONS (hidden cleanly while Live Wardrobe is open!) */}
      {touchMode && !wardrobeOpen && (
        <MobileTouchControls
          onMoveVector={handleTouchMoveVector}
          onJump={handleTouchJump}
          onJumpHoldChange={handleTouchJumpHold}
          sprintActive={sprintLocked}
          onToggleSprint={() => {
            setSprintLocked((s) => !s)
            sfx.playClick()
          }}
          activeEmote={activeEmote}
          onEmote={triggerEmote}
          onRecenterCamera={() => recenterCamRef.current()}
          compactHeight={vp.isCompactHeight}
          labels={{
            jumpBtn: t.jumpBtn,
            sprintBtn: t.sprintBtn,
            emotesLabel: t.emotesLabel,
            recenterBtn: lang === 'pl' ? 'Centruj kamerę' : 'Center camera',
            emotes: t.emotes,
          }}
        />
      )}
    </div>
  )
}
