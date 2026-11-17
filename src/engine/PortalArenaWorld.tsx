import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import {
  Bot,
  Crown,
  Disc,
  Eye,
  Flame,
  Gauge,
  Menu,
  MessageSquare,
  RotateCcw,
  Shirt,
  Sparkles,
  Timer,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { BackId, FaceId, HatId, OutfitId, PetId, R6AvatarConfig, TrailId } from '../data/catalog'
import { Lang } from '../data/locales'
import {
  ArenaCustomPacket,
  LobbyChatMessage,
  LobbyMultiplayerClient,
  PlayerPose,
  pruneExpiredChatMessages,
  RemotePlayerState,
} from '../lib/multiplayer'
import { createR6Rig, R6RigHandle } from './r6Builder'
import { cloneFreshTexturesWithRepeat } from './freshTextures'
import { audioEngine } from '../lib/audioEngine'
import { sfx } from '../lib/sfx'
import { loadMousePrefs, saveMousePrefs } from '../lib/mousePrefs'
import {
  enterGameFullscreenLandscape,
  exitGameFullscreen,
  isDocumentFullscreen,
} from '../lib/mobileFullscreen'
import { useVisualViewport } from '../lib/useVisualViewport'
import { GameChatBox } from '../components/hud/GameChatBox'
import { InGameMenuDrawer, InGameRosterMember, MenuDrawerTab, MenuQuality, MenuWorldTime } from '../components/hud/InGameMenuDrawer'
import { InGameWardrobeDrawer } from '../components/hud/InGameWardrobeDrawer'
import { EmoteRadialWheel } from '../components/hud/EmoteRadialWheel'
import { ShortcutsOverlayModal } from '../components/hud/ShortcutsOverlayModal'
import { MobileTouchControls } from '../components/hud/MobileTouchControls'
import { isSupabaseConfigured } from '../lib/supabase'

export type ArenaModeId = 'vanishing' | 'core' | 'speed_king'

export interface PortalArenaWorldProps {
  roomCode: string
  playerId: string
  authUserId?: string | null
  username: string
  clanTag?: string | null
  rankName: string
  freshGems: number
  avatar: R6AvatarConfig
  unlockedOutfits: OutfitId[]
  unlockedHats: HatId[]
  unlockedFaces: FaceId[]
  unlockedBacks?: BackId[]
  unlockedPets?: PetId[]
  unlockedTrails?: TrailId[]
  lang: Lang
  onBuyAndEquip: (
    category: 'outfit' | 'hat' | 'face' | 'trail' | 'back' | 'pet',
    itemId: string,
    price: number,
  ) => boolean
  onBuyBundle: (items: Array<{ category: 'outfit' | 'hat' | 'face'; id: string; price: number }>) => boolean
  onSkinChange: (hex: string) => void
  onArenaProgress: (opts: {
    eliminationsDelta?: number
    win?: boolean
    peakSpeedKmh?: number
    meteorKill?: boolean
  }) => void
  onLeave: () => void
  onSwitchToLobby: () => void
  onSwitchToObby: () => void
  onOpenFeedback: () => void
}

interface ArenaBlock {
  id: string
  mesh: THREE.Mesh
  cx: number
  cy: number
  cz: number
  hx: number
  hy: number
  hz: number
  portalable: boolean
  collapsible: boolean
  collapsed: boolean
  warningTimer: number
  baseY: number
  isRescueRock?: boolean
}

interface ActivePortal {
  color: 'cyan' | 'orange'
  ownerId: string
  pos: THREE.Vector3
  normal: THREE.Vector3
  group: THREE.Group
  ringMat: THREE.MeshStandardMaterial
  coreMat: THREE.MeshBasicMaterial
  active: boolean
}

interface EnergyDisc {
  id: string
  ownerId: string
  ownerName: string
  pos: THREE.Vector3
  vel: THREE.Vector3
  portalPasses: number
  age: number
  maxAge: number
  portalCooldown: number
  mesh: THREE.Group
  ringMat: THREE.MeshStandardMaterial
  coreMat: THREE.MeshBasicMaterial
}

interface ArenaBot {
  id: string
  name: string
  pos: THREE.Vector3
  vel: THREE.Vector3
  rotY: number
  grounded: boolean
  portalCooldown: number
  respawnTimer: number
  targetAngle: number
  strafeTimer: number
  discTimer: number
  score: number
  lastAttackerId: string | null
  lastAttackerName: string | null
  lastAttackTime: number
  rig: R6RigHandle
}

interface KillFeedItem {
  id: string
  text: string
  accent: string
  ts: number
}

const ARENA_MODES: Array<{ id: ArenaModeId; titlePl: string; titleEn: string; descPl: string; descEn: string; accent: string }> = [
  {
    id: 'vanishing',
    titlePl: 'Znikające Ściany',
    titleEn: 'Vanishing Walls',
    descPl: 'Co 20s losowy blok zapada się w Otchłań aż zostanie ostatnia ściana!',
    descEn: 'Every 20s a random arena wall drops into the Abyss until 1 remains!',
    accent: '#F97316',
  },
  {
    id: 'core',
    titlePl: 'Przegrzany Rdzeń',
    titleEn: 'Overheated Core',
    descPl: 'Odbijaj niestabilną kulę przez portale lub Impulsem [E] zanim wybuchnie (15s)!',
    descEn: 'Redirect the unstable orb through portals or [E] Pulse before its 15s blast!',
    accent: '#EF4444',
  },
  {
    id: 'speed_king',
    titlePl: 'Król Prędkości',
    titleEn: 'Speed King',
    descPl: 'Najszybszy gracz świeci na złoto i zbiera punkty — poluj na koronę!',
    descEn: 'Fastest player glows gold & earns bounty points — hunt the Speed King!',
    accent: '#FACC15',
  },
]

const ROUND_DURATION_SEC = 90
const METEOR_KMH_THRESHOLD = 95
const GRAVITY_ACCEL = 32
const ABYSS_Y = -28

const BOT_SPECS: Array<{ id: string; name: string; avatar: R6AvatarConfig }> = [
  {
    id: 'bot_nova',
    name: '[BOT] Nova',
    avatar: { outfitId: 'crystal-royal', faceId: 'arctic-visor', hatId: 'crystal-halo', skinColor: '#E0F2FE', backId: 'portal-jetpack', trailId: 'portal-duality', petId: 'none' },
  },
  {
    id: 'bot_kinetic',
    name: '[BOT] Kinetic',
    avatar: { outfitId: 'midnight-slate', faceId: 'cool-shades', hatId: 'headphones', skinColor: '#FDE0B6', backId: 'crystal-wings', trailId: 'neon-comet', petId: 'none' },
  },
  {
    id: 'bot_apex',
    name: '[BOT] Apex',
    avatar: { outfitId: 'glacier-captain', faceId: 'star-eyes', hatId: 'frost-horns', skinColor: '#F3C998', backId: 'cyber-cape', trailId: 'arctic-sparks', petId: 'none' },
  },
]

const SPAWN_POINTS: Array<[number, number, number]> = [
  [-18, 2.2, 18],
  [18, 2.2, 18],
  [18, 2.2, -18],
  [-18, 2.2, -18],
  [0, 12.2, 22],
  [0, 12.2, -22],
]

export const PortalArenaWorld: React.FC<PortalArenaWorldProps> = ({
  roomCode,
  playerId,
  username,
  clanTag,
  rankName,
  freshGems,
  avatar,
  unlockedOutfits,
  unlockedHats,
  unlockedFaces,
  unlockedBacks,
  unlockedPets,
  unlockedTrails,
  lang,
  onBuyAndEquip,
  onBuyBundle,
  onSkinChange,
  onArenaProgress,
  onLeave,
  onSwitchToLobby,
  onOpenFeedback,
}) => {
  const vp = useVisualViewport()
  const viewportHeight = vp.height
  const mountRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chatInputRef = useRef<HTMLInputElement | null>(null)

  const [isTouchDevice, setIsTouchDevice] = useState(() =>
    typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window),
  )
  const [cameraView, setCameraView] = useState<'fpp' | 'tpp'>('fpp')
  const cameraViewRef = useRef<'fpp' | 'tpp'>('fpp')
  cameraViewRef.current = cameraView

  const [arenaMode, setArenaMode] = useState<ArenaModeId>('vanishing')
  const arenaModeRef = useRef<ArenaModeId>('vanishing')
  arenaModeRef.current = arenaMode

  const [botsEnabled, setBotsEnabled] = useState(true)
  const botsEnabledRef = useRef(true)
  botsEnabledRef.current = botsEnabled

  const [roundSecondsLeft, setRoundSecondsLeft] = useState(ROUND_DURATION_SEC)
  const [speedKmh, setSpeedKmh] = useState(0)
  const [isMeteorState, setIsMeteorState] = useState(false)
  const [myScore, setMyScore] = useState(0)
  const [myElims, setMyElims] = useState(0)
  const [pulseCooldownPct, setPulseCooldownPct] = useState(100)
  const [discActive, setDiscActive] = useState(false)
  const [discPassesHud, setDiscPassesHud] = useState(0)
  const [cyanPortalOpen, setCyanPortalOpen] = useState(false)
  const [orangePortalOpen, setOrangePortalOpen] = useState(false)
  const [aimPortalable, setAimPortalable] = useState(false)
  const [laserRedirected, setLaserRedirected] = useState(false)
  const [coreTimerHud, setCoreTimerHud] = useState<number | null>(null)
  const [speedKingName, setSpeedKingName] = useState<string | null>(null)
  const [killFeed, setKillFeed] = useState<KillFeedItem[]>([])
  const [roundBanner, setRoundBanner] = useState<string | null>(null)
  const [humanCount, setHumanCount] = useState(1)
  const [roster, setRoster] = useState<InGameRosterMember[]>([])
  const [fpsDisplay, setFpsDisplay] = useState(60)

  // HUD / Menus / Chat
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuTab, setMenuTab] = useState<MenuDrawerTab>('overview')
  const [wardrobeOpen, setWardrobeOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [emoteWheelOpen, setEmoteWheelOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<LobbyChatMessage[]>([])
  const [touchSprintUi, setTouchSprintUi] = useState(false)
  const [activeEmoteUi, setActiveEmoteUi] = useState<PlayerPose | null>(null)
  const [copiedInvite, setCopiedInvite] = useState(false)
  const [pointerLocked, setPointerLocked] = useState(false)
  const initialMousePrefs = loadMousePrefs()
  const [clickToLock, setClickToLock] = useState(() => initialMousePrefs.clickToLock)
  const [shiftLockAlign, setShiftLockAlign] = useState(() => initialMousePrefs.shiftLockAlign)
  const [mouseSensitivity, setMouseSensitivity] = useState(() => initialMousePrefs.sensitivity)
  const [fov, setFov] = useState(() => initialMousePrefs.fov)
  const [worldTime, setWorldTime] = useState<MenuWorldTime>('night')
  const [quality, setQuality] = useState<MenuQuality>('medium')
  const [isFullscreen, setIsFullscreen] = useState(() => isDocumentFullscreen())
  const [previewAvatar, setPreviewAvatar] = useState<R6AvatarConfig>(() => ({ ...avatar }))

  const menuOpenRef = useRef(false)
  menuOpenRef.current = menuOpen
  const wardrobeOpenRef = useRef(false)
  wardrobeOpenRef.current = wardrobeOpen
  const chatOpenRef = useRef(false)
  chatOpenRef.current = chatOpen
  const emoteWheelOpenRef = useRef(false)
  emoteWheelOpenRef.current = emoteWheelOpen
  const mouseSensRef = useRef(mouseSensitivity)
  mouseSensRef.current = mouseSensitivity
  const fovRef = useRef(fov)
  fovRef.current = fov
  const clickToLockRef = useRef(clickToLock)
  clickToLockRef.current = clickToLock
  const worldTimeRef = useRef<MenuWorldTime>(worldTime)
  worldTimeRef.current = worldTime
  const qualityRef = useRef<MenuQuality>(quality)
  qualityRef.current = quality
  const avatarRef = useRef<R6AvatarConfig>(previewAvatar)
  avatarRef.current = previewAvatar
  const onArenaProgressRef = useRef(onArenaProgress)
  onArenaProgressRef.current = onArenaProgress

  useEffect(() => {
    setPreviewAvatar({ ...avatar })
  }, [avatar])

  // Start Portal Arena procedural kinetic music (A-02)
  useEffect(() => {
    audioEngine.setWorldMusic('arena')
    return () => {
      audioEngine.stopAllSpatialLoops()
      audioEngine.setWorldMusic('launcher')
    }
  }, [])

  // Prune 20-minute ephemeral room chat TTL
  useEffect(() => {
    const id = window.setInterval(() => {
      setChatMessages((prev) => pruneExpiredChatMessages(prev))
    }, 30_000)
    return () => window.clearInterval(id)
  }, [])

  // Action hooks bridged to 3D engine loop
  const actionsRef = useRef<{
    shootPortal: (color: 'cyan' | 'orange') => void
    throwDisc: () => void
    gravityPulse: () => void
    respawn: () => void
    triggerEmote: (pose: PlayerPose) => void
    sendChat: (text: string) => void
    rebuildSelfRig: (cfg: R6AvatarConfig) => void
    setTouchMove: (x: number, y: number) => void
    setTouchJump: (down: boolean) => void
    setTouchSprint: (down: boolean) => void
    addLookDelta: (dx: number, dy: number) => void
    switchModeNow: (mode: ArenaModeId) => void
  } | null>(null)

  const pushFeed = useCallback((text: string, accent = '#38BDF8') => {
    const item: KillFeedItem = { id: `${Date.now()}_${Math.random()}`, text, accent, ts: Date.now() }
    setKillFeed((prev) => [item, ...prev].slice(0, 5))
  }, [])

  const requestLock = useCallback(() => {
    if (isTouchDevice) return
    const el = canvasRef.current
    if (el && document.pointerLockElement !== el) {
      el.requestPointerLock?.()
    }
  }, [isTouchDevice])

  const exitLock = useCallback(() => {
    if (document.pointerLockElement) {
      document.exitPointerLock?.()
    }
  }, [])

  useEffect(() => {
    const onLockChange = () => {
      const locked = Boolean(document.pointerLockElement && document.pointerLockElement === canvasRef.current)
      setPointerLocked(locked)
      if (!locked && !wardrobeOpenRef.current && !chatOpenRef.current && !emoteWheelOpenRef.current && !isTouchDevice) {
        // Single-ESC instant mini-menu invariant
        setMenuOpen(true)
      }
    }
    document.addEventListener('pointerlockchange', onLockChange)
    return () => document.removeEventListener('pointerlockchange', onLockChange)
  }, [isTouchDevice])

  useEffect(() => {
    actionsRef.current?.rebuildSelfRig(previewAvatar)
  }, [previewAvatar])

  // ==================== MAIN THREE.JS PORTAL ARENA ENGINE ====================
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const disposables: Array<{ dispose: () => void }> = []
    const track = <T extends { dispose: () => void }>(res: T): T => {
      disposables.push(res)
      return res
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualityRef.current === 'high' ? 2 : 1.5))
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight)
    renderer.shadowMap.enabled = qualityRef.current !== 'low'
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    renderer.domElement.style.touchAction = 'none'
    container.innerHTML = ''
    container.appendChild(renderer.domElement)
    canvasRef.current = renderer.domElement

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#060D1E')
    scene.fog = new THREE.FogExp2('#060D1E', 0.0082)

    const camera = new THREE.PerspectiveCamera(
      fovRef.current,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.15,
      260,
    )

    // Lighting
    const hemi = new THREE.HemisphereLight('#7DD3FC', '#0F172A', 1.15)
    scene.add(hemi)
    const dirLight = new THREE.DirectionalLight('#E0F2FE', 1.55)
    dirLight.position.set(28, 46, 24)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.set(1024, 1024)
    dirLight.shadow.camera.left = -45
    dirLight.shadow.camera.right = 45
    dirLight.shadow.camera.top = 45
    dirLight.shadow.camera.bottom = -45
    scene.add(dirLight)

    const cyanAmbientLight = new THREE.PointLight('#22D3EE', 1.8, 60)
    cyanAmbientLight.position.set(-22, 14, 0)
    scene.add(cyanAmbientLight)
    const orangeAmbientLight = new THREE.PointLight('#F97316', 1.8, 60)
    orangeAmbientLight.position.set(22, 14, 0)
    scene.add(orangeAmbientLight)

    // PBR Textures (Portalable clean Aperture-white ceramic vs Dark dark-slate non-portal trim)
    const whitePortalTex = cloneFreshTexturesWithRepeat('marble', 2, 2, track)
    const darkMetalTex = cloneFreshTexturesWithRepeat('terrazzo', 3, 3, track)

    const portalableMatBase = track(
      new THREE.MeshStandardMaterial({
        color: '#F1F8FF',
        map: whitePortalTex.map,
        bumpMap: whitePortalTex.bumpMap,
        bumpScale: 0.03,
        roughness: 0.24,
        metalness: 0.08,
      }),
    )

    const nonPortalMat = track(
      new THREE.MeshStandardMaterial({
        color: '#162238',
        map: darkMetalTex.map,
        bumpMap: darkMetalTex.bumpMap,
        bumpScale: 0.04,
        roughness: 0.52,
        metalness: 0.32,
      }),
    )

    const rescueRockMat = track(
      new THREE.MeshStandardMaterial({
        color: '#E0F2FE',
        emissive: '#0284C7',
        emissiveIntensity: 0.16,
        roughness: 0.22,
        metalness: 0.12,
      }),
    )

    // ==================== BUILD PORTAL ARENA GEOMETRY ====================
    const blocks: ArenaBlock[] = []
    const portalableMeshes: THREE.Mesh[] = []

    const addBlock = (opts: {
      id: string
      x: number
      y: number
      z: number
      w: number
      h: number
      d: number
      portalable: boolean
      collapsible?: boolean
      isRescueRock?: boolean
    }) => {
      const geo = track(new RoundedBoxGeometry(opts.w, opts.h, opts.d, 2, 0.09))
      // Collapsible blocks get their own material instance so they can flash warning orange!
      const mat = opts.collapsible
        ? track(portalableMatBase.clone())
        : opts.isRescueRock
          ? rescueRockMat
          : opts.portalable
            ? portalableMatBase
            : nonPortalMat
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(opts.x, opts.y, opts.z)
      mesh.receiveShadow = true
      mesh.castShadow = opts.h > 2
      mesh.userData.blockId = opts.id
      mesh.userData.portalable = opts.portalable
      scene.add(mesh)

      const blk: ArenaBlock = {
        id: opts.id,
        mesh,
        cx: opts.x,
        cy: opts.y,
        cz: opts.z,
        hx: opts.w / 2,
        hy: opts.h / 2,
        hz: opts.d / 2,
        portalable: opts.portalable,
        collapsible: Boolean(opts.collapsible),
        collapsed: false,
        warningTimer: 0,
        baseY: opts.y,
        isRescueRock: opts.isRescueRock,
      }
      blocks.push(blk)
      if (opts.portalable) portalableMeshes.push(mesh)
      return blk
    }

    // 1. Main central island ring (4 quadrants around the central laser pit + outer bridges!)
    // Center pit is a 7x7 opening right under the central Laser Emitter & Receiver!
    addBlock({ id: 'floor_n', x: 0, y: -1, z: -15, w: 36, h: 2, d: 18, portalable: true })
    addBlock({ id: 'floor_s', x: 0, y: -1, z: 15, w: 36, h: 2, d: 18, portalable: true })
    addBlock({ id: 'floor_w', x: -15, y: -1, z: 0, w: 18, h: 2, d: 12, portalable: true })
    addBlock({ id: 'floor_e', x: 15, y: -1, z: 0, w: 18, h: 2, d: 12, portalable: true })

    // Center Laser Pedestal (portalable top so you can redirect the vertical laser beam!)
    addBlock({ id: 'laser_pad', x: 0, y: -0.6, z: 0, w: 5.2, h: 1.2, d: 5.2, portalable: true })

    // 2. Perimeter tall Portalable Walls (collapsible in "Znikające Ściany" mode — except wall_core_n which always remains as the final wall!)
    addBlock({ id: 'wall_core_n', x: 0, y: 11, z: -24.5, w: 22, h: 22, d: 1.8, portalable: true, collapsible: false })
    addBlock({ id: 'wall_s', x: 0, y: 11, z: 24.5, w: 22, h: 22, d: 1.8, portalable: true, collapsible: true })
    addBlock({ id: 'wall_w', x: -24.5, y: 11, z: 0, w: 1.8, h: 22, d: 22, portalable: true, collapsible: true })
    addBlock({ id: 'wall_e', x: 24.5, y: 11, z: 0, w: 1.8, h: 22, d: 22, portalable: true, collapsible: true })

    // 3. Elevated Catwalks & Loop-Cannon Towers (for vertical momentum drops >100 km/h!)
    addBlock({ id: 'tower_nw', x: -16, y: 8.5, z: -16, w: 7, h: 17, d: 7, portalable: true, collapsible: true })
    addBlock({ id: 'tower_ne', x: 16, y: 8.5, z: -16, w: 7, h: 17, d: 7, portalable: true, collapsible: true })
    addBlock({ id: 'tower_sw', x: -16, y: 8.5, z: 16, w: 7, h: 17, d: 7, portalable: true, collapsible: true })
    addBlock({ id: 'tower_se', x: 16, y: 8.5, z: 16, w: 7, h: 17, d: 7, portalable: true, collapsible: true })

    // Mid-height Sky Bridges & Portalable Overhangs (ceiling drops!)
    addBlock({ id: 'bridge_n', x: 0, y: 10, z: -18.5, w: 24, h: 1.5, d: 5.5, portalable: true, collapsible: true })
    addBlock({ id: 'bridge_s', x: 0, y: 10, z: 18.5, w: 24, h: 1.5, d: 5.5, portalable: true, collapsible: true })
    addBlock({ id: 'ceiling_halo_1', x: -10, y: 24, z: 0, w: 8, h: 1.5, d: 14, portalable: true, collapsible: true })
    addBlock({ id: 'ceiling_halo_2', x: 10, y: 24, z: 0, w: 8, h: 1.5, d: 14, portalable: true, collapsible: true })

    // 4. Floating Abyss Rescue Rocks ("Kontra z Otchłani" — shoot a portal on these while falling to slingshot back!)
    const rescueCoords: Array<[number, number, number]> = [
      [-31, -8, -14],
      [31, -8, -14],
      [-31, -8, 14],
      [31, -8, 14],
      [0, -10, -33],
      [0, -10, 33],
    ]
    rescueCoords.forEach(([rx, ry, rz], idx) => {
      addBlock({
        id: `rescue_${idx}`,
        x: rx,
        y: ry,
        z: rz,
        w: 6.4,
        h: 7.5,
        d: 6.4,
        portalable: true,
        collapsible: false,
        isRescueRock: true,
      })
    })

    // 5. Abyss / Black Hole visual below the Arena
    const abyssGroup = new THREE.Group()
    abyssGroup.position.set(0, -30, 0)
    const blackCore = new THREE.Mesh(
      track(new THREE.CircleGeometry(18, 40)),
      track(new THREE.MeshBasicMaterial({ color: '#02040A' })),
    )
    blackCore.rotation.x = -Math.PI / 2
    abyssGroup.add(blackCore)

    const accretion1 = new THREE.Mesh(
      track(new THREE.RingGeometry(18.5, 29, 48)),
      track(new THREE.MeshBasicMaterial({ color: '#0EA5E9', transparent: true, opacity: 0.34, side: THREE.DoubleSide })),
    )
    accretion1.rotation.x = -Math.PI / 2
    accretion1.position.y = 0.2
    abyssGroup.add(accretion1)

    const accretion2 = new THREE.Mesh(
      track(new THREE.RingGeometry(29.5, 42, 48)),
      track(new THREE.MeshBasicMaterial({ color: '#F97316', transparent: true, opacity: 0.2, side: THREE.DoubleSide })),
    )
    accretion2.rotation.x = -Math.PI / 2
    accretion2.position.y = 0.4
    abyssGroup.add(accretion2)
    scene.add(abyssGroup)

    // Starry sci-fi skybox particles
    const starPositions = new Float32Array(260 * 3)
    for (let i = 0; i < 260; i++) {
      const r = 80 + Math.random() * 80
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      starPositions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) - 10
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    const starGeo = track(new THREE.BufferGeometry())
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    const stars = new THREE.Points(
      starGeo,
      track(new THREE.PointsMaterial({ color: '#BAE6FD', size: 0.75, transparent: true, opacity: 0.85 })),
    )
    scene.add(stars)

    // 6. Central Vertical Plasma Laser Emitter & Redirectable Beam ("Arena jako Broń")
    const emitterMesh = new THREE.Mesh(
      track(new THREE.CylinderGeometry(1.4, 2.1, 2.2, 16)),
      track(new THREE.MeshStandardMaterial({ color: '#0F172A', metalness: 0.75, roughness: 0.2 })),
    )
    emitterMesh.position.set(0, 31, 0)
    scene.add(emitterMesh)

    const laserCoreMat = track(
      new THREE.MeshBasicMaterial({ color: '#FF2A5F', transparent: true, opacity: 0.92 }),
    )
    const laserGlowMat = track(
      new THREE.MeshBasicMaterial({ color: '#FF6B9D', transparent: true, opacity: 0.32 }),
    )
    const mainLaserMesh = new THREE.Mesh(track(new THREE.CylinderGeometry(0.28, 0.28, 31, 12)), laserCoreMat)
    mainLaserMesh.position.set(0, 15.5, 0)
    scene.add(mainLaserMesh)
    const mainLaserGlow = new THREE.Mesh(track(new THREE.CylinderGeometry(0.68, 0.68, 31, 12)), laserGlowMat)
    mainLaserGlow.position.set(0, 15.5, 0)
    scene.add(mainLaserGlow)

    // Redirected Laser Beam (activates automatically whenever a portal is placed under the vertical laser!)
    const redirectBeamGroup = new THREE.Group()
    redirectBeamGroup.visible = false
    const redirCore = new THREE.Mesh(track(new THREE.CylinderGeometry(0.32, 0.32, 1, 12)), laserCoreMat)
    redirCore.rotation.x = Math.PI / 2
    redirCore.position.z = 0.5
    const redirGlow = new THREE.Mesh(track(new THREE.CylinderGeometry(0.78, 0.78, 1, 12)), laserGlowMat)
    redirGlow.rotation.x = Math.PI / 2
    redirGlow.position.z = 0.5
    redirectBeamGroup.add(redirCore, redirGlow)
    scene.add(redirectBeamGroup)

    const redirectedLaserState = {
      active: false,
      origin: new THREE.Vector3(),
      dir: new THREE.Vector3(0, 0, 1),
      length: 45,
      ownerId: '',
    }

    // 7. Shared Stealable Portals (Cyan + Orange Pair — anyone can enter & anyone can re-place/steal!)
    const createPortalVisual = (color: 'cyan' | 'orange'): ActivePortal => {
      const g = new THREE.Group()
      g.visible = false
      const hex = color === 'cyan' ? '#22D3EE' : '#F97316'
      const innerHex = color === 'cyan' ? '#083344' : '#431407'
      const ringMat = track(
        new THREE.MeshStandardMaterial({
          color: hex,
          emissive: hex,
          emissiveIntensity: 1.5,
          roughness: 0.12,
        }),
      )
      const coreMat = track(
        new THREE.MeshBasicMaterial({
          color: innerHex,
          transparent: true,
          opacity: 0.88,
          side: THREE.DoubleSide,
        }),
      )
      const ring = new THREE.Mesh(track(new THREE.TorusGeometry(1.75, 0.16, 12, 32)), ringMat)
      ring.scale.set(0.86, 1.32, 1)
      const core = new THREE.Mesh(track(new THREE.CircleGeometry(1.66, 28)), coreMat)
      core.scale.set(0.86, 1.32, 1)
      const swirl = new THREE.Mesh(
        track(new THREE.RingGeometry(0.7, 1.55, 24)),
        track(new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.45, side: THREE.DoubleSide })),
      )
      swirl.scale.set(0.86, 1.32, 1)
      swirl.position.z = 0.03
      g.add(ring, core, swirl)
      scene.add(g)
      return {
        color,
        ownerId: '',
        pos: new THREE.Vector3(),
        normal: new THREE.Vector3(0, 0, 1),
        group: g,
        ringMat,
        coreMat,
        active: false,
      }
    }

    const portals: { cyan: ActivePortal; orange: ActivePortal } = {
      cyan: createPortalVisual('cyan'),
      orange: createPortalVisual('orange'),
    }

    const placePortalAt = (
      color: 'cyan' | 'orange',
      pos: THREE.Vector3,
      normal: THREE.Vector3,
      ownerId: string,
      fromNetwork = false,
    ) => {
      const p = portals[color]
      p.active = true
      p.ownerId = ownerId
      p.pos.copy(pos)
      p.normal.copy(normal).normalize()
      p.group.visible = true
      p.group.position.copy(pos).addScaledVector(p.normal, 0.09)
      const lookTarget = pos.clone().add(p.normal)
      if (Math.abs(p.normal.y) > 0.96) {
        p.group.up.set(0, 0, 1)
      } else {
        p.group.up.set(0, 1, 0)
      }
      p.group.lookAt(lookTarget)

      if (color === 'cyan') setCyanPortalOpen(true)
      else setOrangePortalOpen(true)

      audioEngine.playPortalOpen(color, pos)

      if (!fromNetwork) {
        mpClient.broadcastArenaEvent({
          kind: 'portal_place',
          payload: {
            color,
            x: pos.x,
            y: pos.y,
            z: pos.z,
            nx: p.normal.x,
            ny: p.normal.y,
            nz: p.normal.z,
          },
        })
      }
    }

    // 8. Visual Burst Pool (Meteor impacts, Disc Overdrive explosions, Gravity Pulse rings)
    const burstRings: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; age: number; maxAge: number; maxScale: number }> = []
    const spawnBurstRing = (pos: THREE.Vector3, colorHex: string, maxScale = 7.5, maxAge = 0.45) => {
      const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.14, 10, 28), mat)
      mesh.position.copy(pos)
      mesh.rotation.x = Math.PI / 2
      scene.add(mesh)
      burstRings.push({ mesh, mat, age: 0, maxAge, maxScale })
    }

    // 9. Mode 2: Overheated Core ("Przegrzany Rdzeń") 15-second Portal Ball
    const coreState = {
      active: false,
      pos: new THREE.Vector3(0, 6, 8),
      vel: new THREE.Vector3(9, 4, -8),
      timer: 15,
      portalCooldown: 0,
      lastOwnerId: '',
      lastOwnerName: '',
    }
    const coreOrbGroup = new THREE.Group()
    coreOrbGroup.visible = false
    const coreOrbMat = track(
      new THREE.MeshStandardMaterial({
        color: '#EF4444',
        emissive: '#DC2626',
        emissiveIntensity: 1.6,
        roughness: 0.15,
      }),
    )
    const coreOrbMesh = new THREE.Mesh(track(new THREE.IcosahedronGeometry(1.15, 1)), coreOrbMat)
    const coreOrbRing = new THREE.Mesh(
      track(new THREE.TorusGeometry(1.65, 0.08, 8, 24)),
      track(new THREE.MeshBasicMaterial({ color: '#FACC15' })),
    )
    coreOrbGroup.add(coreOrbMesh, coreOrbRing)
    scene.add(coreOrbGroup)

    // 10. Ricochet Energy Discs ("Portalowy Rykoszet" [Q])
    const discs: EnergyDisc[] = []
    const spawnDisc = (
      id: string,
      ownerId: string,
      ownerName: string,
      origin: THREE.Vector3,
      dir: THREE.Vector3,
      fromNetwork = false,
    ) => {
      // Max 1 active disc per player! Remove older disc by same owner
      for (let i = discs.length - 1; i >= 0; i--) {
        if (discs[i].ownerId === ownerId) {
          scene.remove(discs[i].mesh)
          discs.splice(i, 1)
        }
      }
      const g = new THREE.Group()
      const ringMat = new THREE.MeshStandardMaterial({
        color: '#38BDF8',
        emissive: '#0EA5E9',
        emissiveIntensity: 1.4,
        roughness: 0.15,
      })
      const coreMat = new THREE.MeshBasicMaterial({ color: '#E0F2FE' })
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.12, 8, 22), ringMat)
      ring.rotation.x = Math.PI / 2
      const discPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.1, 18), coreMat)
      g.add(ring, discPlate)
      g.position.copy(origin)
      scene.add(g)

      discs.push({
        id,
        ownerId,
        ownerName,
        pos: origin.clone(),
        vel: dir.clone().normalize().multiplyScalar(27),
        portalPasses: 0,
        age: 0,
        maxAge: 10,
        portalCooldown: 0.1,
        mesh: g,
        ringMat,
        coreMat,
      })

      if (ownerId === playerId) {
        setDiscActive(true)
        setDiscPassesHud(0)
        audioEngine.playDiscThrow()
      }

      if (!fromNetwork) {
        mpClient.broadcastArenaEvent({
          kind: 'disc_throw',
          payload: {
            id,
            ownerName,
            x: origin.x,
            y: origin.y,
            z: origin.z,
            dx: dir.x,
            dy: dir.y,
            dz: dir.z,
          },
        })
      }
    }

    // 11. Local Player Rig + Meteor Flame Aura + First-Person Portal Emitter Arm
    let selfRig = createR6Rig({
      avatar: avatarRef.current,
      username,
      rank: rankName,
      clanTag,
      showNameplate: false,
      castShadow: true,
    })
    scene.add(selfRig.root)

    // Meteor Flame Aura around player when >= 95 km/h!
    const meteorAura = new THREE.Mesh(
      track(new THREE.SphereGeometry(1.75, 16, 12)),
      track(
        new THREE.MeshBasicMaterial({
          color: '#FB923C',
          transparent: true,
          opacity: 0.34,
          wireframe: true,
        }),
      ),
    )
    meteorAura.visible = false
    scene.add(meteorAura)

    // Sleek futuristic Portal Gauntlet visible in FPP corner (NOT a gun — pure aperture kinetic ring!)
    const fppGauntlet = new THREE.Group()
    const gBase = new THREE.Mesh(
      track(new RoundedBoxGeometry(0.18, 0.16, 0.44, 2, 0.04)),
      track(new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.25, metalness: 0.65 })),
    )
    const gRingCyan = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.12, 0.018, 8, 20)),
      track(new THREE.MeshBasicMaterial({ color: '#22D3EE' })),
    )
    gRingCyan.position.z = -0.22
    const gRingOrange = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.085, 0.014, 8, 20)),
      track(new THREE.MeshBasicMaterial({ color: '#F97316' })),
    )
    gRingOrange.position.z = -0.25
    fppGauntlet.add(gBase, gRingCyan, gRingOrange)
    fppGauntlet.position.set(0.42, -0.34, -0.68)
    camera.add(fppGauntlet)
    scene.add(camera)

    // Player physics state
    const pState = {
      pos: new THREE.Vector3(-16, 2.2, 16),
      vel: new THREE.Vector3(0, 0, 0),
      yaw: Math.PI * 0.25,
      pitch: -0.05,
      grounded: false,
      portalCooldown: 0,
      pulseCooldown: 0,
      emotePose: null as PlayerPose | null,
      emoteTimer: 0,
      stepDist: 0,
      score: 0,
      elims: 0,
      peakKmhSession: 0,
      lastAttackerId: null as string | null,
      lastAttackerName: null as string | null,
      lastAttackTime: 0,
    }

    const respawnSelf = (causeLabel?: string) => {
      const sp = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)]
      pState.pos.set(sp[0], sp[1], sp[2])
      pState.vel.set(0, 0, 0)
      pState.portalCooldown = 0.4
      if (causeLabel) {
        pushFeed(causeLabel, '#F43F5E')
      }
      audioEngine.playPortalWarp(50)
    }

    // 12. Remote Human Players & Optional Solo Practice `[BOT]` Rivals
    const remotePlayers = new Map<
      string,
      {
        state: RemotePlayerState
        rig: R6RigHandle
        pos: THREE.Vector3
        rotY: number
        avatarKey: string
        speechTimer: number
      }
    >()

    const bots: ArenaBot[] = BOT_SPECS.map((spec, idx) => {
      const rig = createR6Rig({
        avatar: spec.avatar,
        username: spec.name,
        rank: 'ARENA AI',
        showNameplate: true,
        castShadow: true,
      })
      const sp = SPAWN_POINTS[(idx + 1) % SPAWN_POINTS.length]
      rig.root.position.set(sp[0], sp[1], sp[2])
      scene.add(rig.root)
      return {
        id: spec.id,
        name: spec.name,
        pos: new THREE.Vector3(sp[0], sp[1], sp[2]),
        vel: new THREE.Vector3(),
        rotY: 0,
        grounded: false,
        portalCooldown: 0,
        respawnTimer: 0,
        targetAngle: idx * 2.1,
        strafeTimer: 1.5 + idx * 0.7,
        discTimer: 5 + idx * 2.4,
        score: 0,
        lastAttackerId: null,
        lastAttackerName: null,
        lastAttackTime: 0,
        rig,
      }
    })

    const updateRosterHud = () => {
      const humans = 1 + remotePlayers.size
      setHumanCount(humans)
      const list: InGameRosterMember[] = [
        {
          id: playerId,
          username: clanTag ? `[${clanTag}] ${username}` : username,
          rank: `${pState.score} pkt`,
          isSelf: true,
        },
      ]
      for (const [id, rp] of remotePlayers) {
        list.push({
          id,
          username: rp.state.clanTag ? `[${rp.state.clanTag}] ${rp.state.username}` : rp.state.username,
          rank: rp.state.rank,
        })
      }
      setRoster(list)
    }
    updateRosterHud()

    // 13. Realtime Ephemeral Multiplayer Client (world: 'arena')
    const mpClient = new LobbyMultiplayerClient({
      roomId: roomCode,
      world: 'arena',
      selfId: playerId,
      onState: (st) => {
        const key = JSON.stringify(st.avatar) + (st.clanTag ?? '')
        let entry = remotePlayers.get(st.id)
        if (!entry) {
          const rig = createR6Rig({
            avatar: st.avatar,
            username: st.username,
            rank: st.rank,
            clanTag: st.clanTag,
            showNameplate: true,
            castShadow: true,
          })
          rig.root.position.set(st.x, st.y, st.z)
          scene.add(rig.root)
          entry = {
            state: st,
            rig,
            pos: new THREE.Vector3(st.x, st.y, st.z),
            rotY: st.rotY,
            avatarKey: key,
            speechTimer: 0,
          }
          remotePlayers.set(st.id, entry)
          updateRosterHud()
        } else {
          if (entry.avatarKey !== key) {
            scene.remove(entry.rig.root)
            entry.rig.dispose()
            entry.rig = createR6Rig({
              avatar: st.avatar,
              username: st.username,
              rank: st.rank,
              clanTag: st.clanTag,
              showNameplate: true,
              castShadow: true,
            })
            entry.rig.root.position.copy(entry.pos)
            scene.add(entry.rig.root)
            entry.avatarKey = key
          }
          entry.state = st
        }
      },
      onLeave: (id) => {
        const rp = remotePlayers.get(id)
        if (rp) {
          scene.remove(rp.rig.root)
          rp.rig.dispose()
          remotePlayers.delete(id)
          updateRosterHud()
        }
      },
      onChat: (msg) => {
        setChatMessages((prev) => pruneExpiredChatMessages([...prev, msg]).slice(-45))
        audioEngine.playChatPop()
        const rp = remotePlayers.get(msg.senderId)
        if (rp) {
          rp.rig.setSpeech(msg.text)
          rp.speechTimer = 6
        }
      },
      onArenaEvent: (senderId, ev: ArenaCustomPacket) => {
        const p = ev.payload
        if (ev.kind === 'portal_place') {
          const color = p.color === 'orange' ? 'orange' : 'cyan'
          placePortalAt(
            color,
            new THREE.Vector3(Number(p.x) || 0, Number(p.y) || 0, Number(p.z) || 0),
            new THREE.Vector3(Number(p.nx) || 0, Number(p.ny) || 1, Number(p.nz) || 0),
            senderId,
            true,
          )
        } else if (ev.kind === 'disc_throw') {
          spawnDisc(
            String(p.id ?? `d_${Date.now()}`),
            senderId,
            String(p.ownerName ?? 'Player'),
            new THREE.Vector3(Number(p.x) || 0, Number(p.y) || 2, Number(p.z) || 0),
            new THREE.Vector3(Number(p.dx) || 0, Number(p.dy) || 0, Number(p.dz) || 1),
            true,
          )
        } else if (ev.kind === 'gravity_push') {
          const ox = Number(p.x) || 0
          const oy = Number(p.y) || 0
          const oz = Number(p.z) || 0
          const origin = new THREE.Vector3(ox, oy, oz)
          spawnBurstRing(origin, '#38BDF8', 8.5, 0.42)
          audioEngine.playGravityPulse(origin)
          const dist = pState.pos.distanceTo(origin)
          if (dist < 10.5) {
            const pushDir = pState.pos.clone().sub(origin).normalize()
            pushDir.y = Math.max(0.35, pushDir.y + 0.35)
            pState.vel.addScaledVector(pushDir.normalize(), 26)
            pState.grounded = false
            pState.lastAttackerId = senderId
            pState.lastAttackerName = String(p.senderName ?? 'Rywal')
            pState.lastAttackTime = performance.now()
          }
        } else if (ev.kind === 'meteor_hit' && String(p.targetId) === playerId) {
          const kb = new THREE.Vector3(Number(p.kx) || 0, Number(p.ky) || 18, Number(p.kz) || 0)
          pState.vel.copy(kb)
          pState.grounded = false
          spawnBurstRing(pState.pos, '#FB923C', 9, 0.5)
          audioEngine.playMeteorBoom(pState.pos)
          respawnSelf(
            lang === 'pl'
              ? `☄️ ${String(p.attackerName ?? 'Rywal')} rozbił Cię jako Meteoryt!`
              : `☄️ ${String(p.attackerName ?? 'Rival')} shattered you as a Meteor!`,
          )
        } else if (ev.kind === 'elim_notice') {
          pushFeed(String(p.text ?? 'Eliminacja!'), String(p.accent ?? '#38BDF8'))
        }
      },
    })
    mpClient.connect()

    // ==================== HELPER: AWARD KILL & ROUND MANAGEMENT ====================
    const awardMyElimination = (victimName: string, methodLabel: string, meteorKill = false, bonusPts = 1) => {
      pState.elims += 1
      pState.score += bonusPts
      setMyElims(pState.elims)
      setMyScore(pState.score)
      const txt = `${username} ${methodLabel} ${victimName}!`
      pushFeed(txt, meteorKill ? '#FB923C' : '#38BDF8')
      audioEngine.playElimination()
      onArenaProgressRef.current({
        eliminationsDelta: 1,
        meteorKill,
        peakSpeedKmh: pState.peakKmhSession,
      })
      mpClient.broadcastArenaEvent({
        kind: 'elim_notice',
        payload: { text: txt, accent: meteorKill ? '#FB923C' : '#38BDF8' },
      })
    }

    // Round state (90s rounds cycling all 3 modes!)
    let roundTimer = ROUND_DURATION_SEC
    let vanishTimer = 20
    let speedKingTick = 0

    const resetRoundBlocks = () => {
      for (const b of blocks) {
        if (b.collapsible) {
          b.collapsed = false
          b.warningTimer = 0
          b.cy = b.baseY
          b.mesh.position.y = b.baseY
          b.mesh.visible = true
          const mat = b.mesh.material as THREE.MeshStandardMaterial
          mat.emissive.set('#000000')
          mat.emissiveIntensity = 0
        }
      }
      vanishTimer = 20
    }

    const startMode = (nextMode: ArenaModeId) => {
      arenaModeRef.current = nextMode
      setArenaMode(nextMode)
      resetRoundBlocks()
      roundTimer = ROUND_DURATION_SEC
      setRoundSecondsLeft(ROUND_DURATION_SEC)

      if (nextMode === 'core') {
        coreState.active = true
        coreState.pos.set(0, 7, 10)
        coreState.vel.set(10, 4, -9)
        coreState.timer = 15
        coreState.lastOwnerId = ''
        coreState.lastOwnerName = ''
        coreOrbGroup.visible = true
        setCoreTimerHud(15)
      } else {
        coreState.active = false
        coreOrbGroup.visible = false
        setCoreTimerHud(null)
      }

      const modeMeta = ARENA_MODES.find((m) => m.id === nextMode)
      setRoundBanner(
        lang === 'pl'
          ? `NOWY TRYB: ${modeMeta?.titlePl ?? nextMode}`
          : `NEW MODE: ${modeMeta?.titleEn ?? nextMode}`,
      )
      window.setTimeout(() => setRoundBanner(null), 3200)
    }

    // ==================== PORTAL PHYSICS & COLLISION HELPERS ====================
    const raycaster = new THREE.Raycaster()

    const shootPortal = (color: 'cyan' | 'orange') => {
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
      const activeMeshes = portalableMeshes.filter((m) => m.visible)
      const hits = raycaster.intersectObjects(activeMeshes, false)
      if (hits.length === 0) return
      const hit = hits[0]
      if (!hit.face || hit.distance > 115) return
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
      placePortalAt(color, hit.point.clone(), normal, playerId, false)
    }

    const throwDiscAction = () => {
      const fwd = new THREE.Vector3()
      camera.getWorldDirection(fwd)
      const origin = pState.pos.clone().add(new THREE.Vector3(0, 2.2, 0)).addScaledVector(fwd, 1.3)
      spawnDisc(`disc_${playerId}_${Date.now()}`, playerId, username, origin, fwd, false)
    }

    const gravityPulseAction = () => {
      if (pState.pulseCooldown > 0) return
      pState.pulseCooldown = 3.5
      const fwd = new THREE.Vector3()
      camera.getWorldDirection(fwd)
      const center = pState.pos.clone().add(new THREE.Vector3(0, 1.8, 0)).addScaledVector(fwd, 3.2)
      spawnBurstRing(center, '#38BDF8', 8.5, 0.42)
      audioEngine.playGravityPulse(center)

      // Push bots!
      for (const b of bots) {
        if (!b.rig.root.visible || b.respawnTimer > 0) continue
        if (b.pos.distanceTo(center) < 9.5) {
          const push = b.pos.clone().sub(pState.pos).normalize()
          push.y = Math.max(0.45, push.y + 0.4)
          b.vel.addScaledVector(push.normalize(), 29)
          b.grounded = false
          b.lastAttackerId = playerId
          b.lastAttackerName = username
          b.lastAttackTime = performance.now()
        }
      }

      // Push discs forward & boost them!
      for (const d of discs) {
        if (d.pos.distanceTo(center) < 10.5) {
          d.vel.copy(fwd).multiplyScalar(Math.max(32, d.vel.length() * 1.25))
          d.ownerId = playerId
          d.ownerName = username
        }
      }

      // Push Overheated Core!
      if (coreState.active && coreState.pos.distanceTo(center) < 11) {
        coreState.vel.copy(fwd).multiplyScalar(28)
        coreState.vel.y += 7
        coreState.lastOwnerId = playerId
        coreState.lastOwnerName = username
      }

      // Small self recoil jump-boost when aiming downward (Rocket-Jump style without guns!)
      if (fwd.y < -0.55) {
        pState.vel.y = Math.max(pState.vel.y, 17.5)
        pState.grounded = false
      }

      mpClient.broadcastArenaEvent({
        kind: 'gravity_push',
        payload: { x: center.x, y: center.y, z: center.z, senderName: username },
      })
    }

    const tryWarpBodyThroughPortals = (
      pos: THREE.Vector3,
      vel: THREE.Vector3,
      bodyCenterOffsetY: number,
      cooldown: number,
      isPlayer: boolean,
    ): { warped: boolean; newCooldown: number } => {
      if (cooldown > 0 || !portals.cyan.active || !portals.orange.active) {
        return { warped: false, newCooldown: cooldown }
      }
      const center = new THREE.Vector3(pos.x, pos.y + bodyCenterOffsetY, pos.z)
      for (const [entry, exit] of [
        [portals.cyan, portals.orange],
        [portals.orange, portals.cyan],
      ] as const) {
        const dist = center.distanceTo(entry.pos)
        if (dist < 2.2) {
          // Must be approaching or inside the portal face
          const inDot = vel.dot(entry.normal)
          if (inDot < 2.5) {
            const incomingSpeed = vel.length()
            const exitSpeed = Math.min(58, Math.max(15.5, incomingSpeed * 1.09))
            // True Vector Momentum Conservation along Exit Normal!
            vel.copy(exit.normal).multiplyScalar(exitSpeed)
            // Small upward lift if exiting horizontally so feet never clip the floor
            if (Math.abs(exit.normal.y) < 0.3) {
              vel.y += 3.2
            }
            pos.copy(exit.pos).addScaledVector(exit.normal, 2.05)
            pos.y -= bodyCenterOffsetY * 0.45
            if (isPlayer) {
              if (Math.abs(exit.normal.y) < 0.7) {
                pState.yaw = Math.atan2(-exit.normal.x, -exit.normal.z)
              }
              audioEngine.playPortalWarp(exitSpeed * 3.6)
              spawnBurstRing(exit.pos, exit.color === 'cyan' ? '#22D3EE' : '#F97316', 4.5, 0.32)
            }
            return { warped: true, newCooldown: 0.28 }
          }
        }
      }
      return { warped: false, newCooldown: cooldown }
    }

    const resolveBlockCollisions = (pos: THREE.Vector3, vel: THREE.Vector3, radius: number, height: number): boolean => {
      let grounded = false
      for (const b of blocks) {
        if (b.collapsed) continue
        const minX = b.cx - b.hx - radius
        const maxX = b.cx + b.hx + radius
        const minZ = b.cz - b.hz - radius
        const maxZ = b.cz + b.hz + radius
        const topY = b.cy + b.hy
        const botY = b.cy - b.hy

        if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
          if (pos.y < topY && pos.y + height > botY) {
            const penTop = topY - pos.y
            const penBot = pos.y + height - botY
            const penLeft = pos.x - minX
            const penRight = maxX - pos.x
            const penFront = pos.z - minZ
            const penBack = maxZ - pos.z
            const minPen = Math.min(penTop, penBot, penLeft, penRight, penFront, penBack)

            if (minPen === penTop && vel.y <= 0.5) {
              pos.y = topY
              vel.y = 0
              grounded = true
            } else if (minPen === penBot && vel.y > 0) {
              pos.y = botY - height
              vel.y = Math.min(0, vel.y)
            } else if (minPen === penLeft) {
              pos.x = minX
              if (vel.x > 0) vel.x = 0
            } else if (minPen === penRight) {
              pos.x = maxX
              if (vel.x < 0) vel.x = 0
            } else if (minPen === penFront) {
              pos.z = minZ
              if (vel.z > 0) vel.z = 0
            } else if (minPen === penBack) {
              pos.z = maxZ
              if (vel.z < 0) vel.z = 0
            }
          }
        }
      }
      return grounded
    }

    // ==================== INPUT LISTENERS ====================
    const keys = new Set<string>()
    let touchMoveX = 0
    let touchMoveY = 0
    let touchJumpDown = false
    let touchSprintDown = false

    const onKeyDown = (e: KeyboardEvent) => {
      if (chatOpenRef.current) return
      const code = e.code
      if (code === 'Tab') {
        e.preventDefault()
        if (document.pointerLockElement === renderer.domElement) exitLock()
        else requestLock()
        return
      }
      if (code === 'KeyV' && !e.repeat) {
        setCameraView((v) => (v === 'fpp' ? 'tpp' : 'fpp'))
        audioEngine.playClick()
        return
      }
      if (code === 'KeyQ' && !e.repeat) {
        throwDiscAction()
        return
      }
      if (code === 'KeyE' && !e.repeat) {
        gravityPulseAction()
        return
      }
      if (code === 'KeyG' && !e.repeat) {
        setEmoteWheelOpen((v) => {
          const next = !v
          if (next) exitLock()
          return next
        })
        return
      }
      if (code === 'KeyR' && !e.repeat) {
        respawnSelf()
        return
      }
      if (code === 'KeyI' && !e.repeat) {
        setWardrobeOpen((v) => {
          const next = !v
          if (next) exitLock()
          return next
        })
        return
      }
      if (code === 'KeyT' && !e.repeat) {
        e.preventDefault()
        exitLock()
        setChatOpen(true)
        return
      }
      if (code === 'KeyK' && !e.repeat) {
        setShortcutsOpen((v) => !v)
        return
      }
      if (code === 'Digit1') { pState.emotePose = 'wave'; pState.emoteTimer = 2.6 }
      if (code === 'Digit2') { pState.emotePose = 'dance'; pState.emoteTimer = 3.2 }
      if (code === 'Digit3') { pState.emotePose = 'cheer'; pState.emoteTimer = 2.6 }
      if (code === 'Digit4') { pState.emotePose = 'sit'; pState.emoteTimer = 4.0 }
      if (code === 'Digit5') { pState.emotePose = 'spin'; pState.emoteTimer = 2.2 }
      if (code === 'Digit6') { pState.emotePose = 'backflip'; pState.emoteTimer = 1.6 }

      keys.add(code)
    }

    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code)
    }

    let draggingLook = false
    let lastMouseX = 0
    let lastMouseY = 0

    const onMouseDown = (e: MouseEvent) => {
      if (menuOpenRef.current || wardrobeOpenRef.current || chatOpenRef.current || emoteWheelOpenRef.current) return
      audioEngine.unlock()
      if (document.pointerLockElement === renderer.domElement) {
        if (e.button === 0) shootPortal('cyan')
        else if (e.button === 2) shootPortal('orange')
        else if (e.button === 1) {
          e.preventDefault()
          gravityPulseAction()
        }
      } else {
        if (clickToLockRef.current && !isTouchDevice) {
          requestLock()
        } else {
          draggingLook = true
          lastMouseX = e.clientX
          lastMouseY = e.clientY
          if (e.button === 0) shootPortal('cyan')
          else if (e.button === 2) shootPortal('orange')
        }
      }
    }

    const onMouseUp = () => {
      draggingLook = false
    }

    const onMouseMove = (e: MouseEvent) => {
      if (menuOpenRef.current || wardrobeOpenRef.current || chatOpenRef.current || emoteWheelOpenRef.current) return
      const sens = 0.0022 * mouseSensRef.current
      if (document.pointerLockElement === renderer.domElement) {
        pState.yaw -= e.movementX * sens
        pState.pitch = Math.max(-1.42, Math.min(1.42, pState.pitch - e.movementY * sens))
      } else if (draggingLook) {
        const dx = e.clientX - lastMouseX
        const dy = e.clientY - lastMouseY
        lastMouseX = e.clientX
        lastMouseY = e.clientY
        pState.yaw -= dx * sens * 1.4
        pState.pitch = Math.max(-1.42, Math.min(1.42, pState.pitch - dy * sens * 1.4))
      }
    }

    const onContextMenu = (e: MouseEvent) => e.preventDefault()

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    renderer.domElement.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mousemove', onMouseMove)
    renderer.domElement.addEventListener('contextmenu', onContextMenu)

    // Bind React actions
    actionsRef.current = {
      shootPortal,
      throwDisc: throwDiscAction,
      gravityPulse: gravityPulseAction,
      respawn: () => respawnSelf(),
      triggerEmote: (pose) => {
        pState.emotePose = pose
        pState.emoteTimer = 2.8
      },
      sendChat: (text) => {
        const clean = text.trim().slice(0, 180)
        if (!clean) return
        const msg: LobbyChatMessage = {
          id: `${playerId}_${Date.now()}`,
          senderId: playerId,
          username,
          text: clean,
          timestamp: Date.now(),
        }
        setChatMessages((prev) => pruneExpiredChatMessages([...prev, msg]).slice(-45))
        mpClient.broadcastChat(msg)
        audioEngine.playChatPop()
      },
      rebuildSelfRig: (cfg) => {
        scene.remove(selfRig.root)
        selfRig.dispose()
        selfRig = createR6Rig({
          avatar: cfg,
          username,
          rank: rankName,
          clanTag,
          showNameplate: false,
          castShadow: true,
        })
        scene.add(selfRig.root)
      },
      setTouchMove: (x, y) => {
        touchMoveX = x
        touchMoveY = y
      },
      setTouchJump: (down) => {
        touchJumpDown = down
      },
      setTouchSprint: (down) => {
        touchSprintDown = down
      },
      addLookDelta: (dx, dy) => {
        pState.yaw -= dx * 0.0045 * mouseSensRef.current
        pState.pitch = Math.max(-1.42, Math.min(1.42, pState.pitch - dy * 0.0045 * mouseSensRef.current))
      },
      switchModeNow: (mode) => startMode(mode),
    }

    // ==================== MAIN GAME LOOP ====================
    let rafId = 0
    let lastTime = performance.now()
    let elapsed = 0
    let hudTick = 0
    let netTick = 0
    let fpsFrames = 0
    let fpsAcc = 0

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate)
      const dt = Math.min(0.045, (now - lastTime) / 1000)
      lastTime = now
      elapsed += dt
      fpsFrames++
      fpsAcc += dt
      if (fpsAcc >= 0.7) {
        setFpsDisplay(Math.round(fpsFrames / fpsAcc))
        fpsFrames = 0
        fpsAcc = 0
      }

      // Sync day/night background subtly
      const wantDay = worldTimeRef.current === 'day'
      const targetBg = wantDay ? 0x9ed8ff : 0x060d1e
      if ((scene.background as THREE.Color).getHex() !== targetBg) {
        scene.background = new THREE.Color(targetBg)
        scene.fog = new THREE.FogExp2(targetBg, wantDay ? 0.0055 : 0.0082)
        hemi.intensity = wantDay ? 1.45 : 1.15
        stars.visible = !wantDay
      }

      // Rotate Abyss accretion rings
      accretion1.rotation.z = elapsed * 0.45
      accretion2.rotation.z = -elapsed * 0.28

      // --- 1. PLAYER MOVEMENT WITH TRUE MOMENTUM CONSERVATION ---
      if (pState.portalCooldown > 0) pState.portalCooldown = Math.max(0, pState.portalCooldown - dt)
      if (pState.pulseCooldown > 0) pState.pulseCooldown = Math.max(0, pState.pulseCooldown - dt)
      if (pState.emoteTimer > 0) {
        pState.emoteTimer -= dt
        if (pState.emoteTimer <= 0) pState.emotePose = null
      }

      let moveF = 0
      let moveR = 0
      if (!chatOpenRef.current && !menuOpenRef.current) {
        if (keys.has('KeyW') || keys.has('ArrowUp')) moveF += 1
        if (keys.has('KeyS') || keys.has('ArrowDown')) moveF -= 1
        if (keys.has('KeyD') || keys.has('ArrowRight')) moveR += 1
        if (keys.has('KeyA') || keys.has('ArrowLeft')) moveR -= 1
        moveF += touchMoveY
        moveR += touchMoveX
      }

      const fwdX = -Math.sin(pState.yaw)
      const fwdZ = -Math.cos(pState.yaw)
      const rightX = Math.cos(pState.yaw)
      const rightZ = -Math.sin(pState.yaw)

      let wishX = fwdX * moveF + rightX * moveR
      let wishZ = fwdZ * moveF + rightZ * moveR
      const wishLen = Math.hypot(wishX, wishZ)
      if (wishLen > 1) {
        wishX /= wishLen
        wishZ /= wishLen
      }

      const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight') || touchSprintDown
      const maxWalkSpeed = sprinting ? 17.5 : 12.2

      if (pState.grounded) {
        // High ground control, but preserves high portal momentum gently for bunny-sliding!
        const horizSpeed = Math.hypot(pState.vel.x, pState.vel.z)
        if (wishLen > 0.05) {
          const targetSpeed = Math.max(maxWalkSpeed, horizSpeed * (1 - dt * 1.15))
          pState.vel.x += (wishX * targetSpeed - pState.vel.x) * Math.min(1, dt * 10.5)
          pState.vel.z += (wishZ * targetSpeed - pState.vel.z) * Math.min(1, dt * 10.5)
        } else {
          const damp = Math.exp(-dt * 8.2)
          pState.vel.x *= damp
          pState.vel.z *= damp
        }
        if ((keys.has('Space') || touchJumpDown) && !chatOpenRef.current) {
          pState.vel.y = 13.8
          pState.grounded = false
          audioEngine.playJump()
        }
      } else {
        // Air strafing — preserves portal slingshot momentum!
        if (wishLen > 0.05) {
          pState.vel.x += wishX * 20 * dt
          pState.vel.z += wishZ * 20 * dt
        }
      }

      pState.vel.y -= GRAVITY_ACCEL * dt
      pState.vel.y = Math.max(-56, pState.vel.y)

      // Sub-step integration so 140 km/h players never tunnel through portals or floors!
      const speedMag = pState.vel.length()
      const subSteps = speedMag > 24 ? 3 : 1
      const subDt = dt / subSteps
      for (let s = 0; s < subSteps; s++) {
        pState.pos.addScaledVector(pState.vel, subDt)
        const warpRes = tryWarpBodyThroughPortals(pState.pos, pState.vel, 1.5, pState.portalCooldown, true)
        pState.portalCooldown = warpRes.newCooldown
        if (warpRes.warped) {
          pState.grounded = false
        }
        pState.grounded = resolveBlockCollisions(pState.pos, pState.vel, 0.65, 3.2)
      }

      // Footstep surface audio (A-03)
      const horizMove = Math.hypot(pState.vel.x, pState.vel.z)
      if (pState.grounded && horizMove > 2.2) {
        pState.stepDist += horizMove * dt
        if (pState.stepDist >= (sprinting ? 3.2 : 2.6)) {
          pState.stepDist = 0
          audioEngine.playFootstep('neon', sprinting)
        }
      }

      // Abyss Fall Check!
      if (pState.pos.y < ABYSS_Y) {
        const recentAttacker =
          pState.lastAttackerName && now - pState.lastAttackTime < 6500 ? pState.lastAttackerName : null
        respawnSelf(
          recentAttacker
            ? lang === 'pl'
              ? `🌀 ${recentAttacker} wrzucił Cię w Otchłań!`
              : `🌀 ${recentAttacker} dropped you into the Abyss!`
            : lang === 'pl'
              ? '🕳️ Otchłań Cię pochłonęła — użyj skał ratunkowych!'
              : '🕳️ Consumed by the Abyss — use floating rescue rocks!',
        )
      }

      const curKmh = Math.round(pState.vel.length() * 3.6)
      if (curKmh > pState.peakKmhSession) pState.peakKmhSession = curKmh
      const playerIsMeteor = curKmh >= METEOR_KMH_THRESHOLD

      // Meteor aura visual & dynamic speed FOV boost
      meteorAura.visible = playerIsMeteor && cameraViewRef.current === 'tpp'
      meteorAura.position.set(pState.pos.x, pState.pos.y + 1.8, pState.pos.z)
      meteorAura.rotation.y = elapsed * 5
      meteorAura.rotation.x = elapsed * 3
      const targetFov = fovRef.current + Math.min(20, Math.max(0, (curKmh - 55) * 0.26))
      if (Math.abs(camera.fov - targetFov) > 0.15) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8)
        camera.updateProjectionMatrix()
      }

      // --- 2. CENTRAL LASER REDIRECTION THROUGH PORTALS ("Arena jako Broń") ---
      let laserOutPortal: ActivePortal | null = null
      if (portals.cyan.active && portals.orange.active) {
        if (Math.hypot(portals.cyan.pos.x, portals.cyan.pos.z) < 2.9 && portals.cyan.pos.y < 30) {
          laserOutPortal = portals.orange
        } else if (Math.hypot(portals.orange.pos.x, portals.orange.pos.z) < 2.9 && portals.orange.pos.y < 30) {
          laserOutPortal = portals.cyan
        }
      }

      if (laserOutPortal) {
        redirectedLaserState.active = true
        redirectedLaserState.origin.copy(laserOutPortal.pos).addScaledVector(laserOutPortal.normal, 0.25)
        redirectedLaserState.dir.copy(laserOutPortal.normal).normalize()
        redirectedLaserState.length = 52
        redirectedLaserState.ownerId = laserOutPortal.ownerId
        redirectBeamGroup.visible = true
        redirectBeamGroup.position.copy(redirectedLaserState.origin)
        redirectBeamGroup.lookAt(redirectedLaserState.origin.clone().add(redirectedLaserState.dir))
        redirectBeamGroup.scale.set(1, 1, redirectedLaserState.length)
      } else {
        redirectedLaserState.active = false
        redirectBeamGroup.visible = false
      }

      // Check player vs Central Vertical Laser & Redirected Laser
      const distCenterLaser = Math.hypot(pState.pos.x, pState.pos.z)
      if (distCenterLaser < 0.85 && pState.pos.y > -1 && pState.pos.y < 30 && pState.portalCooldown <= 0) {
        spawnBurstRing(pState.pos, '#FF2A5F', 6, 0.35)
        respawnSelf(lang === 'pl' ? '⚡ Spalił Cię Centralny Laser!' : '⚡ Vaporized by the Central Laser!')
      }
      if (redirectedLaserState.active && redirectedLaserState.ownerId !== playerId) {
        const toP = pState.pos.clone().add(new THREE.Vector3(0, 1.6, 0)).sub(redirectedLaserState.origin)
        const proj = toP.dot(redirectedLaserState.dir)
        if (proj > 1.2 && proj < redirectedLaserState.length) {
          const perpSq = toP.lengthSq() - proj * proj
          if (perpSq < 1.15) {
            spawnBurstRing(pState.pos, '#FF2A5F', 7, 0.4)
            respawnSelf(lang === 'pl' ? '⚡ Trafił Cię przekierowany Laser!' : '⚡ Hit by a redirected Portal Laser!')
          }
        }
      }

      // --- 3. MODE LOGIC (Znikające Ściany / Przegrzany Rdzeń / Król Prędkości) ---
      roundTimer -= dt
      if (roundTimer <= 0) {
        // Determine round winner!
        let bestBotScore = 0
        for (const b of bots) if (b.rig.root.visible) bestBotScore = Math.max(bestBotScore, b.score)
        if (pState.score > 0 && pState.score >= bestBotScore) {
          audioEngine.playRoundWin()
          onArenaProgressRef.current({ win: true, peakSpeedKmh: pState.peakKmhSession })
          pushFeed(
            lang === 'pl'
              ? `🏆 WYGRAŁEŚ RUNDĘ (${pState.score} pkt)! +140 XP`
              : `🏆 YOU WON THE ROUND (${pState.score} pts)! +140 XP`,
            '#FACC15',
          )
        }
        pState.score = 0
        setMyScore(0)
        for (const b of bots) b.score = 0
        const idx = ARENA_MODES.findIndex((m) => m.id === arenaModeRef.current)
        const nextMode = ARENA_MODES[(idx + 1) % ARENA_MODES.length].id
        startMode(nextMode)
      }

      // Mode 1: Znikające Ściany (every 20s drop 1 random collapsible wall/block!)
      if (arenaModeRef.current === 'vanishing') {
        vanishTimer -= dt
        if (vanishTimer <= 0) {
          vanishTimer = 20
          const candidates = blocks.filter((b) => b.collapsible && !b.collapsed && b.warningTimer <= 0)
          if (candidates.length > 0) {
            const pick = candidates[Math.floor(Math.random() * candidates.length)]
            pick.warningTimer = 3.0
            pushFeed(
              lang === 'pl' ? '⚠️ Ściana areny zapada się za 3s!' : '⚠️ An arena wall drops in 3s!',
              '#F97316',
            )
          }
        }
        for (const b of blocks) {
          if (!b.collapsible || b.collapsed) continue
          if (b.warningTimer > 0) {
            b.warningTimer -= dt
            const mat = b.mesh.material as THREE.MeshStandardMaterial
            const pulse = 0.5 + 0.5 * Math.sin(elapsed * 22)
            mat.emissive.set('#F97316')
            mat.emissiveIntensity = 0.35 + pulse * 0.75
            if (b.warningTimer <= 0) {
              b.collapsed = true
              b.mesh.visible = false
              spawnBurstRing(new THREE.Vector3(b.cx, b.cy, b.cz), '#F97316', 10, 0.5)
            }
          }
        }
      }

      // Mode 2: Przegrzany Rdzeń (15-second unstable portal ball!)
      if (arenaModeRef.current === 'core' && coreState.active) {
        coreState.timer -= dt
        if (coreState.portalCooldown > 0) coreState.portalCooldown -= dt
        coreState.vel.y -= 14 * dt
        coreState.pos.addScaledVector(coreState.vel, dt)
        if (coreState.pos.y < 1.8) {
          coreState.pos.y = 1.8
          coreState.vel.y = Math.abs(coreState.vel.y) * 0.92 + 4
        }
        if (Math.abs(coreState.pos.x) > 22) coreState.vel.x *= -1
        if (Math.abs(coreState.pos.z) > 22) coreState.vel.z *= -1

        // Core warps through portals and accelerates!
        const cWarp = tryWarpBodyThroughPortals(coreState.pos, coreState.vel, 0, coreState.portalCooldown, false)
        coreState.portalCooldown = cWarp.newCooldown
        if (cWarp.warped) {
          coreState.vel.multiplyScalar(1.18)
          audioEngine.playDiscPortalBoost(2, coreState.pos)
        }

        // Player touching core deflects it away and claims ownership!
        if (coreState.pos.distanceTo(pState.pos.clone().add(new THREE.Vector3(0, 1.6, 0))) < 2.6) {
          const kickDir = coreState.pos.clone().sub(pState.pos).normalize()
          coreState.vel.copy(kickDir).multiplyScalar(24)
          coreState.vel.y = 8
          coreState.lastOwnerId = playerId
          coreState.lastOwnerName = username
          audioEngine.playGravityPulse(coreState.pos)
        }

        coreOrbGroup.position.copy(coreState.pos)
        coreOrbMesh.rotation.y += dt * (3 + (15 - coreState.timer) * 0.9)
        coreOrbRing.rotation.x += dt * 4
        const heatScale = 1 + Math.sin(elapsed * (6 + (15 - coreState.timer) * 1.5)) * 0.14
        coreOrbGroup.scale.setScalar(heatScale)

        if (coreState.timer <= 0) {
          // BOOM!
          spawnBurstRing(coreState.pos, '#EF4444', 13, 0.6)
          audioEngine.playMeteorBoom(coreState.pos)
          if (pState.pos.distanceTo(coreState.pos) < 11.5) {
            respawnSelf(lang === 'pl' ? '💥 Eksplozja Przegrzanego Rdzenia!' : '💥 Overheated Core detonation!')
          }
          for (const b of bots) {
            if (!b.rig.root.visible || b.respawnTimer > 0) continue
            if (b.pos.distanceTo(coreState.pos) < 12.5) {
              b.respawnTimer = 3.2
              b.rig.root.visible = false
              if (coreState.lastOwnerId === playerId) {
                awardMyElimination(b.name, '💥 [RDZEŃ]', false, 2)
              }
            }
          }
          // Respawn fresh Core
          coreState.timer = 15
          coreState.pos.set((Math.random() - 0.5) * 14, 9, (Math.random() - 0.5) * 14)
          coreState.vel.set((Math.random() - 0.5) * 18, 5, (Math.random() - 0.5) * 18)
        }
      }

      // Mode 3: Król Prędkości (Fastest player earns bounty points/sec!)
      if (arenaModeRef.current === 'speed_king') {
        speedKingTick += dt
        if (speedKingTick >= 1.0) {
          speedKingTick = 0
          let kingName = username
          let kingKmh = curKmh
          let kingIsMe = true
          for (const b of bots) {
            if (!b.rig.root.visible || b.respawnTimer > 0) continue
            const bKmh = Math.round(b.vel.length() * 3.6)
            if (bKmh > kingKmh) {
              kingKmh = bKmh
              kingName = b.name
              kingIsMe = false
            }
          }
          for (const [, rp] of remotePlayers) {
            const rKmh = rp.state.speedKmh ?? 0
            if (rKmh > kingKmh) {
              kingKmh = rKmh
              kingName = rp.state.username
              kingIsMe = false
            }
          }
          setSpeedKingName(`${kingName} (${kingKmh} km/h)`)
          if (kingIsMe && kingKmh >= 42) {
            pState.score += 1
            setMyScore(pState.score)
          }
        }
      }

      // --- 4. RICOCHET ENERGY DISCS UPDATE (+25% SPEED & COLOR SHIFT PER PORTAL!) ---
      for (let i = discs.length - 1; i >= 0; i--) {
        const d = discs[i]
        d.age += dt
        if (d.portalCooldown > 0) d.portalCooldown -= dt
        if (d.age >= d.maxAge) {
          scene.remove(d.mesh)
          if (d.ownerId === playerId) {
            setDiscActive(false)
            setDiscPassesHud(0)
          }
          discs.splice(i, 1)
          continue
        }

        const prevPos = d.pos.clone()
        d.pos.addScaledVector(d.vel, dt)

        // Portal pass check (+25% speed, Cyan -> Gold -> Red Overdrive, escalating WUB-WUB!)
        if (d.portalCooldown <= 0 && portals.cyan.active && portals.orange.active) {
          for (const [entry, exit] of [
            [portals.cyan, portals.orange],
            [portals.orange, portals.cyan],
          ] as const) {
            if (d.pos.distanceTo(entry.pos) < 2.25) {
              d.portalPasses += 1
              const newSpeed = Math.min(82, d.vel.length() * 1.25)
              d.vel.copy(exit.normal).multiplyScalar(newSpeed)
              d.pos.copy(exit.pos).addScaledVector(exit.normal, 1.8)
              d.portalCooldown = 0.16
              d.maxAge = Math.min(18, d.maxAge + 2.5)

              // Visual color shift: Blue -> Yellow/Gold -> Blinding Red Overdrive
              if (d.portalPasses === 1 || d.portalPasses === 2) {
                d.ringMat.color.set('#FACC15')
                d.ringMat.emissive.set('#F59E0B')
                d.coreMat.color.set('#FEF08A')
              } else {
                d.ringMat.color.set('#FF1E42')
                d.ringMat.emissive.set('#FF0033')
                d.ringMat.emissiveIntensity = 2.6
                d.coreMat.color.set('#FFFFFF')
              }
              if (d.ownerId === playerId) setDiscPassesHud(d.portalPasses)
              audioEngine.playDiscPortalBoost(d.portalPasses, d.pos)
              spawnBurstRing(exit.pos, d.portalPasses >= 3 ? '#FF1E42' : '#FACC15', 3.5 + d.portalPasses, 0.3)
              break
            }
          }
        }

        // Bounce off blocks & walls
        for (const b of blocks) {
          if (b.collapsed) continue
          if (
            Math.abs(d.pos.x - b.cx) < b.hx + 0.55 &&
            Math.abs(d.pos.y - b.cy) < b.hy + 0.55 &&
            Math.abs(d.pos.z - b.cz) < b.hz + 0.55
          ) {
            const dx = Math.abs(prevPos.x - b.cx) - b.hx
            const dy = Math.abs(prevPos.y - b.cy) - b.hy
            const dz = Math.abs(prevPos.z - b.cz) - b.hz
            if (dx >= dy && dx >= dz) d.vel.x *= -1
            else if (dy >= dx && dy >= dz) d.vel.y *= -1
            else d.vel.z *= -1
            d.pos.copy(prevPos).addScaledVector(d.vel, dt * 0.5)
            break
          }
        }

        // Soft arena dome bounce so discs stay thrillingly in play
        if (Math.abs(d.pos.x) > 36) d.vel.x *= -1
        if (Math.abs(d.pos.z) > 36) d.vel.z *= -1
        if (d.pos.y < -18 || d.pos.y > 34) d.vel.y *= -1

        d.mesh.position.copy(d.pos)
        d.mesh.rotation.y += dt * (10 + d.portalPasses * 6)
        const scale = 1 + Math.min(0.65, d.portalPasses * 0.18)
        d.mesh.scale.setScalar(scale)

        // Disc hits Bots!
        let consumed = false
        const hitRadius = d.portalPasses >= 3 ? 3.8 : 1.75
        for (const b of bots) {
          if (!b.rig.root.visible || b.respawnTimer > 0 || b.id === d.ownerId) continue
          const bCenter = new THREE.Vector3(b.pos.x, b.pos.y + 1.6, b.pos.z)
          if (d.pos.distanceTo(bCenter) < hitRadius) {
            spawnBurstRing(bCenter, d.portalPasses >= 3 ? '#FF1E42' : '#FACC15', d.portalPasses >= 3 ? 9.5 : 5.5, 0.45)
            audioEngine.playMeteorBoom(bCenter)
            b.respawnTimer = 3.2
            b.rig.root.visible = false
            if (d.ownerId === playerId) {
              awardMyElimination(
                b.name,
                d.portalPasses >= 3 ? '🔴 [OVERDRIVE DYSK]' : `💿 [DYSK ×${d.portalPasses}]`,
                false,
                d.portalPasses >= 3 ? 2 : 1,
              )
            }
            consumed = true
            break
          }
        }

        // Rival disc hits local player!
        if (!consumed && d.ownerId !== playerId) {
          const pCenter = new THREE.Vector3(pState.pos.x, pState.pos.y + 1.6, pState.pos.z)
          if (d.pos.distanceTo(pCenter) < hitRadius) {
            spawnBurstRing(pCenter, '#FF1E42', 8, 0.45)
            audioEngine.playMeteorBoom(pCenter)
            respawnSelf(
              lang === 'pl'
                ? `💿 ${d.ownerName} trafił Cię Dyskiem (×${d.portalPasses})!`
                : `💿 ${d.ownerName} hit you with a Portal Disc (×${d.portalPasses})!`,
            )
            consumed = true
          }
        }

        if (consumed) {
          scene.remove(d.mesh)
          if (d.ownerId === playerId) {
            setDiscActive(false)
            setDiscPassesHud(0)
          }
          discs.splice(i, 1)
        }
      }

      // --- 5. PRACTICE `[BOT]` AI (AUTOMATICALLY HIDDEN AS REAL HUMANS JOIN!) ---
      const activeBotCount = !botsEnabledRef.current
        ? 0
        : remotePlayers.size >= 3
          ? 0
          : Math.max(0, 3 - remotePlayers.size)

      for (let bi = 0; bi < bots.length; bi++) {
        const b = bots[bi]
        const allowed = bi < activeBotCount
        if (!allowed) {
          b.rig.root.visible = false
          continue
        }
        if (b.respawnTimer > 0) {
          b.respawnTimer -= dt
          b.rig.root.visible = false
          if (b.respawnTimer <= 0) {
            const sp = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)]
            b.pos.set(sp[0], sp[1], sp[2])
            b.vel.set(0, 0, 0)
            b.rig.root.visible = true
          }
          continue
        }
        b.rig.root.visible = true
        if (b.portalCooldown > 0) b.portalCooldown -= dt

        // Smart arena roaming + jumping + avoiding Abyss edge
        b.strafeTimer -= dt
        if (b.strafeTimer <= 0) {
          b.strafeTimer = 1.6 + Math.random() * 2.1
          b.targetAngle = Math.atan2(pState.pos.x - b.pos.x, pState.pos.z - b.pos.z) + (Math.random() - 0.5) * 1.6
          if (b.grounded && Math.random() < 0.48) {
            b.vel.y = 13.5
            b.grounded = false
          }
        }
        // Pull back toward center if near outer edge
        const rDist = Math.hypot(b.pos.x, b.pos.z)
        if (rDist > 19.5) {
          b.targetAngle = Math.atan2(-b.pos.x, -b.pos.z)
        }
        // Avoid central vertical laser
        if (rDist < 3.6) {
          b.targetAngle = Math.atan2(b.pos.x + 0.1, b.pos.z + 0.1)
        }

        if (b.grounded) {
          const bSpeed = 9.5
          b.vel.x += (Math.sin(b.targetAngle) * bSpeed - b.vel.x) * Math.min(1, dt * 6)
          b.vel.z += (Math.cos(b.targetAngle) * bSpeed - b.vel.z) * Math.min(1, dt * 6)
        }
        b.vel.y -= GRAVITY_ACCEL * dt
        b.pos.addScaledVector(b.vel, dt)

        // Bots also warp through player portals ("Samobójstwo na życzenie" & traps!)
        const bWarp = tryWarpBodyThroughPortals(b.pos, b.vel, 1.5, b.portalCooldown, false)
        b.portalCooldown = bWarp.newCooldown
        if (bWarp.warped) {
          b.lastAttackerId = playerId
          b.lastAttackerName = username
          b.lastAttackTime = now
        }
        b.grounded = resolveBlockCollisions(b.pos, b.vel, 0.65, 3.2)

        // Bot throws occasional Ricochet Disc
        b.discTimer -= dt
        if (b.discTimer <= 0 && b.pos.distanceTo(pState.pos) < 34) {
          b.discTimer = 8.5 + Math.random() * 5
          const aim = pState.pos.clone().sub(b.pos).normalize()
          spawnDisc(`disc_${b.id}_${Date.now()}`, b.id, b.name, b.pos.clone().add(new THREE.Vector3(0, 2, 0)), aim, true)
        }

        // METEOR COLLISION! Local player >= 78 km/h (full meteor at 95 km/h) shatters the bot!
        const distToMe = b.pos.distanceTo(pState.pos)
        if (distToMe < 2.65 && curKmh >= 75) {
          spawnBurstRing(b.pos.clone().add(new THREE.Vector3(0, 1.6, 0)), '#FB923C', 9.5, 0.48)
          audioEngine.playMeteorBoom(b.pos)
          b.respawnTimer = 3.2
          b.rig.root.visible = false
          awardMyElimination(b.name, `☄️ [METEORYT ${curKmh} km/h]`, curKmh >= METEOR_KMH_THRESHOLD, curKmh >= METEOR_KMH_THRESHOLD ? 2 : 1)
          continue
        }

        // Redirected Laser kills Bot!
        if (redirectedLaserState.active) {
          const toB = b.pos.clone().add(new THREE.Vector3(0, 1.6, 0)).sub(redirectedLaserState.origin)
          const proj = toB.dot(redirectedLaserState.dir)
          if (proj > 0.8 && proj < redirectedLaserState.length) {
            if (toB.lengthSq() - proj * proj < 1.75) {
              spawnBurstRing(b.pos, '#FF2A5F', 7.5, 0.4)
              audioEngine.playMeteorBoom(b.pos)
              b.respawnTimer = 3.2
              b.rig.root.visible = false
              if (redirectedLaserState.ownerId === playerId) {
                awardMyElimination(b.name, '⚡ [LASER PORTALOWY]', false, 2)
              }
              continue
            }
          }
        }

        // Bot falls into Abyss!
        if (b.pos.y < ABYSS_Y) {
          b.respawnTimer = 3.0
          b.rig.root.visible = false
          if (b.lastAttackerId === playerId && now - b.lastAttackTime < 7500) {
            awardMyElimination(b.name, '🕳️ [OTCHŁAŃ]', false, 1)
          }
          continue
        }

        b.rotY = Math.atan2(b.vel.x, b.vel.z)
        b.rig.root.position.copy(b.pos)
        b.rig.root.rotation.y = b.rotY
        const bPose: PlayerPose = !b.grounded ? (b.vel.y > 0 ? 'jump' : 'fall') : Math.hypot(b.vel.x, b.vel.z) > 1.5 ? 'run' : 'idle'
        b.rig.update(dt, elapsed, bPose)
      }

      // --- 6. REMOTE HUMAN PLAYERS INTERPOLATION + METEOR PVP CHECK ---
      for (const [rid, rp] of remotePlayers) {
        if (now - rp.state.lastSeen > 12_000) {
          scene.remove(rp.rig.root)
          rp.rig.dispose()
          remotePlayers.delete(rid)
          updateRosterHud()
          continue
        }
        rp.pos.lerp(new THREE.Vector3(rp.state.x, rp.state.y, rp.state.z), Math.min(1, dt * 14))
        rp.rig.root.position.copy(rp.pos)
        rp.rig.root.rotation.y = rp.state.rotY
        rp.rig.update(dt, elapsed, rp.state.pose)
        if (rp.speechTimer > 0) {
          rp.speechTimer -= dt
          if (rp.speechTimer <= 0) rp.rig.setSpeech(null)
        }
        // Meteor PvP collision against real player!
        if (playerIsMeteor && rp.pos.distanceTo(pState.pos) < 2.6) {
          const kb = pState.vel.clone().normalize().multiplyScalar(38)
          kb.y = Math.max(16, kb.y + 14)
          mpClient.broadcastArenaEvent({
            kind: 'meteor_hit',
            payload: { targetId: rid, attackerName: username, kx: kb.x, ky: kb.y, kz: kb.z },
          })
          awardMyElimination(rp.state.username, `☄️ [METEORYT ${curKmh} km/h]`, true, 2)
          pState.vel.multiplyScalar(0.45)
        }
      }

      // --- 7. SELF RIG & CAMERA (FPP DEFAULT + [V] TPP TOGGLE!) ---
      const selfPose: PlayerPose = pState.emotePose
        ? pState.emotePose
        : !pState.grounded
          ? pState.vel.y > 0
            ? 'jump'
            : 'fall'
          : horizMove > 11
            ? 'run'
            : horizMove > 1.2
              ? 'walk'
              : 'idle'

      selfRig.root.position.copy(pState.pos)
      selfRig.root.rotation.y = pState.yaw + Math.PI
      selfRig.update(dt, elapsed, selfPose)

      const eyePos = new THREE.Vector3(pState.pos.x, pState.pos.y + 2.85, pState.pos.z)
      if (cameraViewRef.current === 'fpp') {
        selfRig.root.visible = false
        fppGauntlet.visible = true
        camera.position.copy(eyePos)
        camera.rotation.order = 'YXZ'
        camera.rotation.y = pState.yaw
        camera.rotation.x = pState.pitch
        camera.rotation.z = 0
        // Subtle bob on FPP portal gauntlet
        const bob = pState.grounded && horizMove > 1.5 ? Math.sin(elapsed * 11) * 0.014 : Math.sin(elapsed * 2) * 0.004
        fppGauntlet.position.y = -0.34 + bob
        gRingCyan.rotation.z = elapsed * 2.2
        gRingOrange.rotation.z = -elapsed * 2.8
      } else {
        selfRig.root.visible = true
        fppGauntlet.visible = false
        const camDist = 7.8
        const cx = eyePos.x + Math.sin(pState.yaw) * Math.cos(pState.pitch) * camDist
        const cy = eyePos.y - Math.sin(pState.pitch) * camDist + 1.15
        const cz = eyePos.z + Math.cos(pState.yaw) * Math.cos(pState.pitch) * camDist
        camera.position.set(cx, Math.max(pState.pos.y + 0.9, cy), cz)
        camera.lookAt(eyePos.x - Math.sin(pState.yaw) * 4, eyePos.y + Math.sin(pState.pitch) * 4, eyePos.z - Math.cos(pState.yaw) * 4)
      }

      // Spatial Audio Listener & Central Laser / Portal proximity hum (A-03)
      const camFwd = new THREE.Vector3()
      camera.getWorldDirection(camFwd)
      audioEngine.updateListener(camera.position.x, camera.position.y, camera.position.z, camFwd.x, camFwd.y, camFwd.z)
      const laserDist = Math.hypot(pState.pos.x, pState.pos.z)
      audioEngine.setSpatialLoopLevel('laser', Math.max(0, 1 - laserDist / 24))
      let nearPortal = 999
      if (portals.cyan.active) nearPortal = Math.min(nearPortal, pState.pos.distanceTo(portals.cyan.pos))
      if (portals.orange.active) nearPortal = Math.min(nearPortal, pState.pos.distanceTo(portals.orange.pos))
      audioEngine.setSpatialLoopLevel('portal', nearPortal < 18 ? 1 - nearPortal / 18 : 0)

      // Update expanding burst rings
      for (let i = burstRings.length - 1; i >= 0; i--) {
        const br = burstRings[i]
        br.age += dt
        if (br.age >= br.maxAge) {
          scene.remove(br.mesh)
          br.mesh.geometry.dispose()
          br.mat.dispose()
          burstRings.splice(i, 1)
          continue
        }
        const t = br.age / br.maxAge
        br.mesh.scale.setScalar(0.5 + t * br.maxScale)
        br.mat.opacity = 1 - t
      }

      // --- 8. THROTTLED HUD & MULTIPLAYER SYNC ---
      hudTick += dt
      if (hudTick >= 0.08) {
        hudTick = 0
        setSpeedKmh(curKmh)
        setIsMeteorState(playerIsMeteor)
        setRoundSecondsLeft(Math.max(0, Math.ceil(roundTimer)))
        setPulseCooldownPct(Math.round((1 - pState.pulseCooldown / 3.5) * 100))
        setLaserRedirected(redirectedLaserState.active)
        if (arenaModeRef.current === 'core') setCoreTimerHud(Math.max(0, Math.ceil(coreState.timer)))

        // Aim raycast indicator for Portal-2 crosshair
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
        const aimHits = raycaster.intersectObjects(
          portalableMeshes.filter((m) => m.visible),
          false,
        )
        setAimPortalable(aimHits.length > 0 && aimHits[0].distance <= 115)
      }

      netTick += dt
      if (netTick >= 0.055) {
        netTick = 0
        mpClient.broadcastState({
          id: playerId,
          username,
          rank: `${pState.score} pkt`,
          clanTag,
          x: pState.pos.x,
          y: pState.pos.y,
          z: pState.pos.z,
          rotY: selfRig.root.rotation.y,
          pose: selfPose,
          avatar: avatarRef.current,
          speedKmh: curKmh,
          isMeteor: playerIsMeteor,
          lastSeen: Date.now(),
        })
      }

      renderer.render(scene, camera)
    }
    rafId = requestAnimationFrame(animate)

    const onResize = () => {
      const w = container.clientWidth || window.innerWidth
      const h = container.clientHeight || window.innerHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      renderer.domElement.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouseMove)
      renderer.domElement.removeEventListener('contextmenu', onContextMenu)
      mpClient.disconnect()
      selfRig.dispose()
      for (const b of bots) b.rig.dispose()
      for (const [, rp] of remotePlayers) rp.rig.dispose()
      for (const d of disposables) d.dispose()
      renderer.dispose()
      exitLock()
    }
  }, [roomCode, playerId, username, clanTag, rankName, lang, isTouchDevice, requestLock, exitLock, pushFeed])

  const activeModeMeta = useMemo(() => ARENA_MODES.find((m) => m.id === arenaMode) ?? ARENA_MODES[0], [arenaMode])

  const handleCopyInvite = () => {
    const url = `${window.location.origin}/?world=arena&room=${encodeURIComponent(roomCode)}`
    void navigator.clipboard?.writeText(url)
    setCopiedInvite(true)
    audioEngine.playClick()
    window.setTimeout(() => setCopiedInvite(false), 1800)
  }

  return (
    <div
      className="relative w-full overflow-hidden bg-slate-950 select-none"
      style={{ height: viewportHeight ? `${viewportHeight}px` : '100dvh' }}
    >
      {/* 3D Canvas */}
      <div ref={mountRef} className="absolute inset-0 h-full w-full" />

      {/* Meteor High-Speed Edge Glow (>95 km/h) */}
      {isMeteorState && (
        <div
          className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-150"
          style={{
            boxShadow: 'inset 0 0 95px rgba(249, 115, 22, 0.58), inset 0 0 36px rgba(34, 211, 238, 0.45)',
          }}
        />
      )}

      {/* === PORTAL-2 STYLE DYNAMIC CROSSHAIR === */}
      {!menuOpen && !wardrobeOpen && !emoteWheelOpen && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="relative flex h-12 w-12 items-center justify-center">
            {/* Left Cyan Arc */}
            <svg viewBox="0 0 48 48" className="h-12 w-12">
              <path
                d="M 21 8 A 16 16 0 0 0 21 40"
                fill="none"
                stroke={cyanPortalOpen ? '#22D3EE' : aimPortalable ? 'rgba(34,211,238,0.65)' : 'rgba(148,163,184,0.35)'}
                strokeWidth={cyanPortalOpen ? '3.4' : '2.2'}
                strokeLinecap="round"
              />
              {/* Right Orange Arc */}
              <path
                d="M 27 8 A 16 16 0 0 1 27 40"
                fill="none"
                stroke={orangePortalOpen ? '#F97316' : aimPortalable ? 'rgba(249,115,22,0.65)' : 'rgba(148,163,184,0.35)'}
                strokeWidth={orangePortalOpen ? '3.4' : '2.2'}
                strokeLinecap="round"
              />
              <circle
                cx="24"
                cy="24"
                r={aimPortalable ? '2.6' : '1.8'}
                fill={isMeteorState ? '#FACC15' : aimPortalable ? '#FFFFFF' : 'rgba(255,255,255,0.55)'}
              />
            </svg>
          </div>
        </div>
      )}

      {/* === TOP HUD BAR === */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-2.5 sm:p-3.5"
        style={{ paddingTop: 'max(0.65rem, env(safe-area-inset-top))' }}
      >
        {/* Left: Menu + Wardrobe + Camera Toggle [V] + Bots Toggle */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              audioEngine.playClick()
              exitLock()
              setMenuTab('overview')
              setMenuOpen(true)
            }}
            className="flex h-10 items-center gap-2 rounded-2xl border border-white/15 bg-slate-950/75 px-3 text-xs font-extrabold text-white backdrop-blur-xl hover:bg-slate-900 cursor-pointer"
          >
            <Menu className="h-4 w-4 text-sky-400" />
            <span className="hidden sm:inline">ESC</span>
          </button>

          <button
            type="button"
            onClick={() => {
              audioEngine.playClick()
              exitLock()
              setWardrobeOpen((v) => !v)
            }}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-slate-950/75 text-sky-300 backdrop-blur-xl hover:bg-slate-900 cursor-pointer"
            title={lang === 'pl' ? 'Szatnia (I)' : 'Wardrobe (I)'}
          >
            <Shirt className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              audioEngine.playClick()
              setCameraView((v) => (v === 'fpp' ? 'tpp' : 'fpp'))
            }}
            className="flex h-10 items-center gap-1.5 rounded-2xl border border-cyan-400/35 bg-slate-950/75 px-3 text-xs font-extrabold text-cyan-200 backdrop-blur-xl hover:bg-slate-900 cursor-pointer"
            title={lang === 'pl' ? 'Przełącz widok FPP / TPP (klawisz V)' : 'Toggle FPP / TPP camera (V)'}
          >
            <Eye className="h-3.5 w-3.5 text-cyan-400" />
            <span>{cameraView.toUpperCase()}</span>
            <span className="hidden sm:inline font-mono text-[10px] opacity-60">[V]</span>
          </button>

          <button
            type="button"
            onClick={() => {
              audioEngine.playClick()
              setBotsEnabled((v) => !v)
            }}
            className={`flex h-10 items-center gap-1.5 rounded-2xl border px-3 text-xs font-extrabold backdrop-blur-xl cursor-pointer transition ${
              botsEnabled
                ? 'border-amber-400/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                : 'border-white/15 bg-slate-950/75 text-slate-400 hover:text-white'
            }`}
            title={
              lang === 'pl'
                ? 'Boty treningowe [BOT] (ustępują prawdziwym graczom i nie wliczają się do Online)'
                : 'Practice [BOT] rivals (yield to humans and excluded from real online count)'
            }
          >
            <Bot className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{lang === 'pl' ? 'Boty' : 'Bots'}:</span>
            <span>{botsEnabled ? (lang === 'pl' ? 'WŁ' : 'ON') : (lang === 'pl' ? 'WYŁ' : 'OFF')}</span>
          </button>
        </div>

        {/* Center: Mode Pill + Round Countdown + Mode Switcher */}
        <div className="pointer-events-auto flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-slate-950/80 px-3.5 py-2 backdrop-blur-xl shadow-xl">
            <span className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ background: activeModeMeta.accent }} />
            <span className="font-display text-xs sm:text-sm font-black text-white">
              {lang === 'pl' ? activeModeMeta.titlePl : activeModeMeta.titleEn}
            </span>
            <span className="h-4 w-px bg-white/15" />
            <span className="inline-flex items-center gap-1 font-mono text-xs font-extrabold text-sky-300">
              <Timer className="h-3.5 w-3.5" />
              {Math.floor(roundSecondsLeft / 60)}:{String(roundSecondsLeft % 60).padStart(2, '0')}
            </span>
            {coreTimerHud !== null && (
              <span className="ml-1 rounded-lg bg-rose-500/25 border border-rose-400/50 px-2 py-0.5 font-mono text-[11px] font-black text-rose-200 animate-pulse">
                💥 {coreTimerHud}s
              </span>
            )}
            {laserRedirected && (
              <span className="ml-1 rounded-lg bg-pink-500/25 border border-pink-400/50 px-2 py-0.5 text-[10px] font-black text-pink-200">
                ⚡ LASER
              </span>
            )}
          </div>

          {/* Quick mode switcher pills */}
          <div className="hidden md:flex items-center gap-1 rounded-xl border border-white/10 bg-slate-950/65 p-0.5 backdrop-blur-md">
            {ARENA_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  audioEngine.playClick()
                  actionsRef.current?.switchModeNow(m.id)
                }}
                className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                  arenaMode === m.id ? 'bg-sky-400 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                {lang === 'pl' ? m.titlePl : m.titleEn}
              </button>
            ))}
          </div>

          {arenaMode === 'speed_king' && speedKingName && (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-400/45 bg-amber-500/20 px-3 py-0.5 text-[11px] font-extrabold text-amber-200 backdrop-blur">
              <Crown className="h-3.5 w-3.5 text-amber-300" />
              <span>{speedKingName}</span>
            </div>
          )}
        </div>

        {/* Right: Score, Eliminations & Real Humans Online */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-slate-950/80 px-3 py-2 text-xs font-extrabold text-white backdrop-blur-xl">
            <span className="inline-flex items-center gap-1 text-amber-300">
              <Trophy className="h-3.5 w-3.5" />
              {myScore}
            </span>
            <span className="opacity-30">|</span>
            <span className="inline-flex items-center gap-1 text-orange-300">
              <Flame className="h-3.5 w-3.5" />
              {myElims}
            </span>
            <span className="opacity-30">|</span>
            <span
              className="inline-flex items-center gap-1 text-emerald-300"
              title={lang === 'pl' ? 'Prawdziwi gracze online w tym pokoju' : 'Real human players in this room'}
            >
              <Users className="h-3.5 w-3.5" />
              {humanCount}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              audioEngine.playClick()
              exitLock()
              setChatOpen((v) => !v)
            }}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-slate-950/75 text-sky-300 backdrop-blur-xl hover:bg-slate-900 cursor-pointer"
            title={lang === 'pl' ? 'Czat pokoju (T)' : 'Room Chat (T)'}
          >
            <MessageSquare className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Round Change Banner */}
      {roundBanner && (
        <div className="pointer-events-none absolute top-24 left-1/2 z-30 -translate-x-1/2 rounded-2xl border border-sky-400/50 bg-slate-950/90 px-5 py-2.5 text-center shadow-2xl backdrop-blur-xl">
          <p className="font-display text-sm font-black tracking-wide text-sky-200">{roundBanner}</p>
          <p className="text-[11px] text-slate-300 mt-0.5">
            {lang === 'pl' ? activeModeMeta.descPl : activeModeMeta.descEn}
          </p>
        </div>
      )}

      {/* Kill / Physics Event Feed (Top-Right under stats) */}
      {killFeed.length > 0 && (
        <div className="pointer-events-none absolute top-16 right-3 z-20 flex flex-col items-end gap-1.5 max-w-xs">
          {killFeed.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-1.5 text-[11px] font-extrabold text-white backdrop-blur-md shadow"
              style={{ borderLeftWidth: 3, borderLeftColor: item.accent }}
            >
              {item.text}
            </div>
          ))}
        </div>
      )}

      {/* === BOTTOM SPEEDOMETER & PORTAL / PHYSICS ABILITIES BAR === */}
      {!isTouchDevice && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 flex items-end gap-3">
          {/* LPM Cyan Portal */}
          <div
            className={`flex flex-col items-center rounded-2xl border px-3 py-2 backdrop-blur-xl transition ${
              cyanPortalOpen ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100' : 'border-white/15 bg-slate-950/75 text-slate-300'
            }`}
          >
            <span className="font-mono text-[10px] font-black">LPM</span>
            <span className="text-[11px] font-extrabold">Cyan</span>
          </div>

          {/* PPM Orange Portal */}
          <div
            className={`flex flex-col items-center rounded-2xl border px-3 py-2 backdrop-blur-xl transition ${
              orangePortalOpen ? 'border-orange-400 bg-orange-500/20 text-orange-100' : 'border-white/15 bg-slate-950/75 text-slate-300'
            }`}
          >
            <span className="font-mono text-[10px] font-black">PPM</span>
            <span className="text-[11px] font-extrabold">Orange</span>
          </div>

          {/* Speedometer & Meteor Status */}
          <div
            className={`flex flex-col items-center rounded-2xl border px-5 py-2 backdrop-blur-xl min-w-[138px] transition ${
              isMeteorState
                ? 'border-orange-400 bg-gradient-to-t from-orange-600/45 to-amber-500/25 shadow-[0_0_24px_rgba(249,115,22,0.55)]'
                : 'border-sky-400/30 bg-slate-950/80'
            }`}
          >
            <div className="flex items-baseline gap-1">
              <Gauge className={`h-4 w-4 ${isMeteorState ? 'text-amber-300 animate-spin' : 'text-sky-400'}`} />
              <span className={`font-mono text-2xl font-black ${isMeteorState ? 'text-amber-200' : 'text-white'}`}>
                {speedKmh}
              </span>
              <span className="text-[10px] font-bold text-slate-300">km/h</span>
            </div>
            <span className={`text-[10px] font-black uppercase tracking-wider ${isMeteorState ? 'text-orange-200' : 'text-sky-300/75'}`}>
              {isMeteorState
                ? lang === 'pl'
                  ? '☄️ METEORYT AKTYWNY!'
                  : '☄️ METEOR ACTIVE!'
                : lang === 'pl'
                  ? '95+ km/h = Meteoryt'
                  : '95+ km/h = Meteor'}
            </span>
          </div>

          {/* [Q] Ricochet Disc */}
          <div
            className={`flex flex-col items-center rounded-2xl border px-3 py-2 backdrop-blur-xl transition ${
              discActive
                ? discPassesHud >= 3
                  ? 'border-rose-400 bg-rose-500/25 text-rose-100 animate-pulse'
                  : 'border-amber-400 bg-amber-500/20 text-amber-100'
                : 'border-white/15 bg-slate-950/75 text-slate-200'
            }`}
          >
            <span className="flex items-center gap-1 font-mono text-[10px] font-black">
              <Disc className="h-3 w-3" /> Q
            </span>
            <span className="text-[11px] font-extrabold">
              {discActive ? `×${discPassesHud} ${discPassesHud >= 3 ? 'MAX!' : ''}` : lang === 'pl' ? 'Dysk' : 'Disc'}
            </span>
          </div>

          {/* [E] Gravity Impulse */}
          <div
            className={`flex flex-col items-center rounded-2xl border px-3 py-2 backdrop-blur-xl transition ${
              pulseCooldownPct >= 100
                ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                : 'border-white/15 bg-slate-950/75 text-slate-400'
            }`}
          >
            <span className="flex items-center gap-1 font-mono text-[10px] font-black">
              <Zap className="h-3 w-3" /> E
            </span>
            <span className="text-[11px] font-extrabold">
              {pulseCooldownPct >= 100 ? (lang === 'pl' ? 'Impuls' : 'Pulse') : `${pulseCooldownPct}%`}
            </span>
          </div>
        </div>
      )}

      {/* Click-to-Lock Hint Banner when unlocked and menu closed */}
      {!isTouchDevice && !pointerLocked && !menuOpen && !wardrobeOpen && !chatOpen && !emoteWheelOpen && (
        <div
          onClick={requestLock}
          className="pointer-events-auto absolute bottom-24 left-1/2 z-20 -translate-x-1/2 cursor-pointer rounded-full border border-sky-400/40 bg-slate-950/85 px-4 py-1.5 text-xs font-extrabold text-sky-200 shadow-lg backdrop-blur hover:bg-slate-900"
        >
          {lang === 'pl'
            ? 'Kliknij ekran, aby zablokować celownik · LPM/PPM Portale · Q Dysk · E Impuls · V FPP/TPP'
            : 'Click screen to lock crosshair · LMB/RMB Portals · Q Disc · E Pulse · V FPP/TPP'}
        </div>
      )}

      {/* Mobile Touch Controls + Dedicated Portal Action Buttons */}
      {isTouchDevice && !menuOpen && !wardrobeOpen && (
        <>
          <MobileTouchControls
            onMoveVector={(x, y, autoSprint) => {
              actionsRef.current?.setTouchMove(x, y)
              if (autoSprint !== undefined) actionsRef.current?.setTouchSprint(Boolean(autoSprint || touchSprintUi))
            }}
            onJump={() => {
              actionsRef.current?.setTouchJump(true)
              window.setTimeout(() => actionsRef.current?.setTouchJump(false), 120)
            }}
            onJumpHoldChange={(held) => actionsRef.current?.setTouchJump(held)}
            sprintActive={touchSprintUi}
            onToggleSprint={() => {
              setTouchSprintUi((prev) => {
                const next = !prev
                actionsRef.current?.setTouchSprint(next)
                return next
              })
            }}
            activeEmote={activeEmoteUi}
            onEmote={(pose) => {
              setActiveEmoteUi(pose)
              actionsRef.current?.triggerEmote(pose)
              window.setTimeout(() => setActiveEmoteUi(null), 1600)
            }}
            onQuickRespawn={() => actionsRef.current?.respawn()}
            compactHeight={viewportHeight < 460}
            labels={{
              jumpBtn: lang === 'pl' ? 'SKOK' : 'JUMP',
              sprintBtn: 'SPRINT',
              emotesLabel: lang === 'pl' ? 'Emotki' : 'Emotes',
              respawnBtn: 'Respawn',
              emotes: {
                wave: lang === 'pl' ? 'Pomachaj' : 'Wave',
                dance: lang === 'pl' ? 'Taniec' : 'Dance',
                cheer: lang === 'pl' ? 'Radość' : 'Cheer',
                sit: lang === 'pl' ? 'Usiądź' : 'Sit',
                spin: lang === 'pl' ? 'Obrót' : 'Spin',
                backflip: 'Backflip',
              },
            }}
          />
          <div className="pointer-events-auto absolute right-3 bottom-36 z-30 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => actionsRef.current?.shootPortal('cyan')}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-cyan-300 bg-cyan-500/35 text-[11px] font-black text-white shadow-lg backdrop-blur active:scale-90"
            >
              P1
            </button>
            <button
              type="button"
              onClick={() => actionsRef.current?.shootPortal('orange')}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-orange-300 bg-orange-500/35 text-[11px] font-black text-white shadow-lg backdrop-blur active:scale-90"
            >
              P2
            </button>
            <button
              type="button"
              onClick={() => actionsRef.current?.throwDisc()}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300 bg-amber-500/30 text-amber-100 shadow backdrop-blur active:scale-90"
            >
              <Disc className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => actionsRef.current?.gravityPulse()}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-300 bg-sky-500/30 text-sky-100 shadow backdrop-blur active:scale-90"
            >
              <Zap className="h-5 w-5" />
            </button>
          </div>
        </>
      )}

      {/* Ephemeral Room Chat */}
      <GameChatBox
        lang={lang}
        open={chatOpen}
        roomCode={roomCode}
        onlineCount={humanCount}
        touchMode={isTouchDevice}
        messages={chatMessages}
        selfId={playerId}
        chatInput={chatInput}
        chatInputRef={chatInputRef}
        onChatInputChange={setChatInput}
        onFocusChange={() => {}}
        onSend={(e) => {
          e.preventDefault()
          const trimmed = chatInput.trim()
          if (!trimmed) return
          actionsRef.current?.sendChat(trimmed)
          setChatInput('')
        }}
        onSendQuickText={(txt) => actionsRef.current?.sendChat(txt)}
        onClose={() => setChatOpen(false)}
        onOpen={() => setChatOpen(true)}
        worldKind="arena"
      />

      {/* Emote Radial Wheel [G] */}
      <EmoteRadialWheel
        open={emoteWheelOpen}
        lang={lang}
        activeEmote={activeEmoteUi}
        onSelect={(pose) => {
          setActiveEmoteUi(pose)
          actionsRef.current?.triggerEmote(pose)
          setEmoteWheelOpen(false)
          window.setTimeout(() => setActiveEmoteUi(null), 1600)
        }}
        onClose={() => setEmoteWheelOpen(false)}
      />

      {/* In-Game Wardrobe Drawer [I] */}
      {wardrobeOpen && (
        <InGameWardrobeDrawer
          lang={lang}
          freshGems={freshGems}
          ownedAvatar={avatar}
          previewAvatar={previewAvatar}
          unlockedOutfits={unlockedOutfits}
          unlockedHats={unlockedHats}
          unlockedFaces={unlockedFaces}
          unlockedBacks={unlockedBacks}
          unlockedPets={unlockedPets}
          unlockedTrails={unlockedTrails}
          onPreviewChange={setPreviewAvatar}
          onBuyAndEquip={onBuyAndEquip}
          onBuyBundle={onBuyBundle}
          onSkinChange={onSkinChange}
          onTestEmote={(pose) => actionsRef.current?.triggerEmote(pose)}
          onClose={() => setWardrobeOpen(false)}
        />
      )}

      {/* Single-ESC In-Game Menu Drawer */}
      <InGameMenuDrawer
        open={menuOpen}
        activeTab={menuTab}
        onTabChange={setMenuTab}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        worldKind="arena"
        lang={lang}
        roomCode={roomCode}
        username={clanTag ? `[${clanTag}] ${username}` : username}
        rankName={rankName}
        onlineCount={humanCount}
        roster={roster}
        fpsDisplay={fpsDisplay}
        touchMode={isTouchDevice}
        pointerLocked={pointerLocked}
        clickToLock={clickToLock}
        shiftLockAlign={shiftLockAlign}
        mouseSensitivity={mouseSensitivity}
        fov={fov}
        onTogglePointerLock={() => (pointerLocked ? exitLock() : requestLock())}
        onChangeClickToLock={(en) => {
          setClickToLock(en)
          saveMousePrefs({ ...loadMousePrefs(), clickToLock: en })
        }}
        onChangeShiftLockAlign={(en) => {
          setShiftLockAlign(en)
          saveMousePrefs({ ...loadMousePrefs(), shiftLockAlign: en })
        }}
        onChangeMouseSensitivity={(s) => {
          setMouseSensitivity(s)
          saveMousePrefs({ ...loadMousePrefs(), sensitivity: s })
        }}
        onChangeFov={(f) => {
          setFov(f)
          saveMousePrefs({ ...loadMousePrefs(), fov: f })
        }}
        worldTime={worldTime}
        quality={quality}
        isFullscreen={isFullscreen}
        supabaseConnected={isSupabaseConfigured}
        copiedInvite={copiedInvite}
        onChangeWorldTime={setWorldTime}
        onChangeQuality={setQuality}
        onToggleTouchMode={() => setIsTouchDevice((v) => !v)}
        onToggleFullscreen={() => {
          if (isDocumentFullscreen()) {
            exitGameFullscreen()
            setIsFullscreen(false)
          } else {
            enterGameFullscreenLandscape()
            setIsFullscreen(true)
          }
        }}
        onClose={() => setMenuOpen(false)}
        onResumeAndLock={() => {
          setMenuOpen(false)
          requestLock()
        }}
        onOpenWardrobe={() => {
          setMenuOpen(false)
          setWardrobeOpen(true)
        }}
        onCopyInvite={handleCopyInvite}
        onResetPosition={() => actionsRef.current?.respawn()}
        onSwitchWorld={onSwitchToLobby}
        onLeaveToHome={onLeave}
        onOpenFeedback={onOpenFeedback}
      />

      {/* Shortcuts Modal */}
      <ShortcutsOverlayModal
        open={shortcutsOpen}
        lang={lang}
        worldKind="lobby"
        onClose={() => setShortcutsOpen(false)}
      />

      {/* Suppress unused icon warnings neatly */}
      <span className="hidden">
        <RotateCcw />
        <Sparkles />
      </span>
    </div>
  )
}
