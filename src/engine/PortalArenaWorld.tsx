import {cathedral} from './art/cathedral'
import {vortex} from './art/voxel'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import {
  Bot,
  ChevronDown,
  Crosshair,
  Disc,
  Eye,
  Flame,
  Gauge,
  Menu,
  MessageSquare,
  RefreshCw,
  Shirt,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import {
  BackId,
  FaceId,
  HatId,
  OutfitId,
  PetId,
  R6AvatarConfig,
  TrailId,
} from '../data/catalog'
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
import {
  InGameMenuDrawer,
  InGameRosterMember,
  MenuDrawerTab,
  MenuQuality,
  MenuWorldTime,
} from '../components/hud/InGameMenuDrawer'
import { InGameWardrobeDrawer } from '../components/hud/InGameWardrobeDrawer'
import { EmoteRadialWheel } from '../components/hud/EmoteRadialWheel'
import { ShortcutsOverlayModal } from '../components/hud/ShortcutsOverlayModal'
import { MobileTouchControls } from '../components/hud/MobileTouchControls'
import { isSupabaseConfigured } from '../lib/supabase'

export type ArenaModeId = 'solo_train' | 'arena_clash' | 'core' | 'speed_king'

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
  onSwitchToFrisbee?: () => void
  onOpenFeedback: () => void
}

interface BoxCollider {
  id: string
  cx: number
  cy: number
  cz: number
  hx: number
  hy: number
  hz: number
  portalable: boolean
  mesh: THREE.Mesh
}

interface RampDef {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  axis: 'x' | 'z'
  yStart: number
  yEnd: number
}

interface PortalSlot {
  slot: 'cyan' | 'orange'
  active: boolean
  pos: THREE.Vector3
  normal: THREE.Vector3
  up: THREE.Vector3
  right: THREE.Vector3
  quat: THREE.Quaternion
  ownerName: string
  group: THREE.Group
  windowMesh: THREE.Mesh
  windowMat: THREE.ShaderMaterial
  frameMesh: THREE.Mesh
  light: THREE.PointLight
  rt: THREE.WebGLRenderTarget
}

interface EnergyDiscState {
  id: string
  ownerId: string
  ownerName: string
  pos: THREE.Vector3
  vel: THREE.Vector3
  passes: number
  ttl: number
  mesh: THREE.Group
  ringMat: THREE.MeshStandardMaterial
  trailPoints: THREE.Vector3[]
  trailLine: THREE.Line
}

interface ArenaBot {
  id: string
  username: string
  pos: THREE.Vector3
  vel: THREE.Vector3
  rotY: number
  grounded: boolean
  rig: R6RigHandle
  hpAlive: boolean
  respawnTimer: number
  portalCooldown: number
  aiThinkTimer: number
  moveDir: THREE.Vector3
  score: number
  lastAttackerId: string | null
  lastAttackerName: string | null
  lastAttackerAt: number
}

interface RemoteArenaPeer {
  state: RemotePlayerState
  rig: R6RigHandle
  targetPos: THREE.Vector3
  currentPos: THREE.Vector3
  targetRotY: number
  speechUntil: number
}

interface HoloTarget {
  id: number
  basePos: THREE.Vector3
  pos: THREE.Vector3
  phase: number
  active: boolean
  respawnTimer: number
  mesh: THREE.Group
}

interface KillFeedItem {
  id: string
  text: string
  accent: string
  at: number
}

// Sealed Chamber dimensions (ZERO abyss, 100% enclosed playable 3D box!)
const ROOM_HALF = 24
const ROOM_HEIGHT = 24
const GRAVITY = 27.5
const PLAYER_RADIUS = 0.64
const PLAYER_HEIGHT = 2.65
const WALK_SPEED = 11.8
const SPRINT_SPEED = 16.4
const JUMP_VEL = 13.0
const METEOR_SPEED_MS = 24.5 // ~88 km/h -> triggers blazing Meteor KO!
const ROUND_DURATION_SEC = 150
const PORTAL_RX = 3.45
const PORTAL_RY = 3.65

const BOT_CONFIGS: Array<{ name: string; avatar: R6AvatarConfig }> = [
  {
    name: '[BOT] Nova',
    avatar: {
      outfitId: 'arctic-frost',
      faceId: 'arctic-visor',
      hatId: 'crystal-halo',
      skinColor: '#FDE0B6',
      trailId: 'portal-duality',
      backId: 'crystal-wings',
      petId: 'portal-drone',
    },
  },
  {
    name: '[BOT] Volt',
    avatar: {
      outfitId: 'midnight-slate',
      faceId: 'cool-shades',
      hatId: 'headphones',
      skinColor: '#E5B58B',
      trailId: 'neon-comet',
      backId: 'portal-jetpack',
      petId: 'plasma-orb',
    },
  },
  {
    name: '[BOT] Flux',
    avatar: {
      outfitId: 'glacier-captain',
      faceId: 'wink-pro',
      hatId: 'frost-horns',
      skinColor: '#F9D1A0',
      trailId: 'emerald-pulse',
      backId: 'cyber-cape',
      petId: 'frost-cube',
    },
  },
]

const PORTAL_WINDOW_VERT = /* glsl */ `
  varying vec4 vClipPos;
  varying vec2 vLocalUv;
  void main() {
    vLocalUv = uv;
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vClipPos = clip;
    gl_Position = clip;
  }
`

const PORTAL_WINDOW_FRAG = /* glsl */ `
  uniform sampler2D tPortal;
  uniform float uLinked;
  uniform float uTime;
  uniform vec3 uRimColor;
  varying vec4 vClipPos;
  varying vec2 vLocalUv;

  void main() {
    vec2 centered = (vLocalUv - 0.5) * 2.0;
    float r = length(centered);
    if (r > 1.0) discard;

    float rim = smoothstep(0.76, 1.0, r);
    float innerEdge = smoothstep(0.68, 0.92, r);

    if (uLinked < 0.5) {
      // Unlinked swirling vortex until both portals are open
      float ang = atan(centered.y, centered.x);
      float swirl = 0.5 + 0.5 * sin(ang * 5.0 - uTime * 5.5 + r * 10.0);
      float rings = 0.5 + 0.5 * sin(r * 16.0 - uTime * 6.5);
      vec3 core = mix(vec3(0.03, 0.08, 0.16), uRimColor, 0.28 + 0.45 * swirl * rings);
      vec3 finalCol = mix(core, uRimColor * 1.45, rim);
      gl_FragColor = vec4(finalCol, 0.96);
      return;
    }

    // True Portal 1 / Portal 2 projective screen-space window view!
    vec2 screenUv = (vClipPos.xy / max(0.0001, vClipPos.w)) * 0.5 + 0.5;
    vec4 texel = texture2D(tPortal, clamp(screenUv, 0.002, 0.998));

    // Apply subtle portal rim glow so window frame reads crisply against chamber walls
    vec3 windowRgb = texel.rgb + uRimColor * (innerEdge * 0.14);
    vec3 outCol = mix(windowRgb, uRimColor * 1.5, rim * 0.92);
    gl_FragColor = vec4(outCol, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function avatarKeyOf(a: R6AvatarConfig): string {
  return `${a.outfitId}|${a.hatId}|${a.faceId}|${a.skinColor}|${a.trailId ?? 'none'}|${a.backId ?? 'none'}|${a.petId ?? 'none'}`
}

function createPortalWindowMaterial(hexColor: number, rt: THREE.WebGLRenderTarget): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      tPortal: { value: rt.texture },
      uLinked: { value: 0 },
      uTime: { value: 0 },
      uRimColor: { value: new THREE.Color(hexColor) },
    },
    vertexShader: PORTAL_WINDOW_VERT,
    fragmentShader: PORTAL_WINDOW_FRAG,
    side: THREE.DoubleSide,
    transparent: false,
  })
}

export const PortalArenaWorld: React.FC<PortalArenaWorldProps> = ({
  roomCode,
  playerId,
  username,
  clanTag = null,
  rankName,
  freshGems,
  avatar,
  unlockedOutfits,
  unlockedHats,
  unlockedFaces,
  unlockedBacks = ['none'],
  unlockedPets = ['none'],
  unlockedTrails = ['none'],
  lang,
  onBuyAndEquip,
  onBuyBundle,
  onSkinChange,
  onArenaProgress,
  onLeave,
  onSwitchToLobby,
  onSwitchToObby,
  onSwitchToFrisbee,
  onOpenFeedback,
}) => {
  const vp = useVisualViewport()
  const viewportWidth = vp.width
  const viewportHeight = vp.height
  const mountRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chatInputRef = useRef<HTMLInputElement | null>(null)

  const [isTouchDevice, setIsTouchDevice] = useState(
    () => typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window),
  )
  const [cameraView, setCameraView] = useState<'fpp' | 'tpp'>('tpp')
  const cameraViewRef = useRef<'fpp' | 'tpp'>('fpp')
  cameraViewRef.current = cameraView

  const [arenaMode, setArenaMode] = useState<ArenaModeId>('arena_clash')
  const arenaModeRef = useRef<ArenaModeId>('arena_clash')
  arenaModeRef.current = arenaMode

  const [botsEnabled, setBotsEnabled] = useState(true)
  const botsEnabledRef = useRef(true)
  botsEnabledRef.current = botsEnabled

  const [roundSecondsLeft, setRoundSecondsLeft] = useState(ROUND_DURATION_SEC)
  const [speedKmh, setSpeedKmh] = useState(0)
  const [peakSpeedHud, setPeakSpeedHud] = useState(0)
  const [isMeteorState, setIsMeteorState] = useState(false)
  const [myScore, setMyScore] = useState(0)
  const [myElims, setMyElims] = useState(0)
  const [soloTargetsHit, setSoloTargetsHit] = useState(0)
  const [portalWarpsCount, setPortalWarpsCount] = useState(0)
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
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
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
  const [worldTime, setWorldTime] = useState<MenuWorldTime>('day')
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
  const qualityRef = useRef(quality)
  qualityRef.current = quality
  const clickToLockRef = useRef(clickToLock)
  clickToLockRef.current = clickToLock
  const worldTimeRef = useRef(worldTime)
  worldTimeRef.current = worldTime
  const avatarRef = useRef(avatar)
  avatarRef.current = avatar
  const usernameRef = useRef(username)
  usernameRef.current = username
  const clanTagRef = useRef(clanTag)
  clanTagRef.current = clanTag
  const rankNameRef = useRef(rankName)
  rankNameRef.current = rankName
  const onArenaProgressRef = useRef(onArenaProgress)
  onArenaProgressRef.current = onArenaProgress
  const langRef = useRef(lang)
  langRef.current = lang
  const programmaticUnlockRef = useRef(false)

  // Imperative actions bridge into Three.js loop
  const actionsRef = useRef<{
    shootPortal: (slot: 'cyan' | 'orange') => void
    clearPortals: () => void
    throwDisc: () => void
    gravityPulse: () => void
    respawn: () => void
    triggerEmote: (pose: PlayerPose) => void
    sendChat: (text: string) => void
    setTouchMove: (x: number, y: number) => void
    setTouchJump: (pressed: boolean) => void
    setTouchSprint: (s: boolean) => void
    addLookDelta: (dx: number, dy: number) => void
    switchMode: (mode: ArenaModeId) => void
  } | null>(null)

  const pushKillFeed = useCallback((text: string, accent = '#38BDF8') => {
    setKillFeed((prev) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text, accent, at: Date.now() },
      ...prev.slice(0, 4),
    ])
  }, [])

  const requestLock = useCallback(() => {
    const el = canvasRef.current
    if (!el || isTouchDevice) return
    try {
      audioEngine.unlock()
      void el.requestPointerLock?.()
    } catch {
      // ignore
    }
  }, [isTouchDevice])

  const exitLock = useCallback(() => {
    if (document.pointerLockElement) {
      programmaticUnlockRef.current = true
      document.exitPointerLock?.()
    }
  }, [])

  useEffect(() => {
    setPreviewAvatar({ ...avatar })
  }, [avatar])

  useEffect(() => {
    const id = window.setInterval(() => {
      setKillFeed((prev) => prev.filter((k) => Date.now() - k.at < 6500))
      setChatMessages((prev) => pruneExpiredChatMessages(prev))
    }, 1500)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    audioEngine.setWorldMusic('arena')
    return () => {
      audioEngine.setSpatialLoopLevel('laser', 0)
      audioEngine.setSpatialLoopLevel('portal', 0)
      audioEngine.setWorldMusic('none')
    }
  }, [])

  // ==================== MAIN THREE.JS SEALED CHAMBER + LIVE PORTAL WINDOWS ====================
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#342749')
    scene.fog = new THREE.FogExp2('#4a3262',.015)

    const camera = new THREE.PerspectiveCamera(fovRef.current, container.clientWidth / Math.max(1, container.clientHeight), 0.12, 160)
    const portalCam = new THREE.PerspectiveCamera(fovRef.current, container.clientWidth / Math.max(1, container.clientHeight), 0.12, 160)

    const renderer = new THREE.WebGLRenderer({
      antialias: qualityRef.current !== 'low',
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualityRef.current === 'high' ? 1.5 : 1.25))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.shadowMap.enabled = qualityRef.current !== 'low'
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    renderer.localClippingEnabled = true
    renderer.domElement.style.touchAction = 'none'
    container.innerHTML = ''
    container.appendChild(renderer.domElement)
    canvasRef.current = renderer.domElement

    // === PROCEDURAL STUDIO IBL ENVIRONMENT (Gives metallic & glass surfaces crisp reflections — ZERO pitch-black meshes!) ===


    // === BRIGHT, CRISP APERTURE-STYLE CHAMBER LIGHTING (High readability for portals!) ===
    const hemi = new THREE.HemisphereLight('#cbd2ff', '#57376c', 1.28)
    scene.add(hemi)
    const dirLight = new THREE.DirectionalLight('#e3c7ff', 1.35)
    dirLight.position.set(14, 22, 12)
    dirLight.castShadow = qualityRef.current !== 'low'
    dirLight.shadow.mapSize.set(1024, 1024)
    dirLight.shadow.camera.left = -28
    dirLight.shadow.camera.right = 28
    dirLight.shadow.camera.top = 28
    dirLight.shadow.camera.bottom = -28
    scene.add(dirLight)

    const fillLight = new THREE.DirectionalLight('#BAE6FD', 0.65)
    fillLight.position.set(-16, 16, -14)
    scene.add(fillLight)

    const cyanCornerLight = new THREE.PointLight('#22D3EE', 1.6, 36)
    cyanCornerLight.position.set(-17, 15, -17)
    scene.add(cyanCornerLight)

    const orangeCornerLight = new THREE.PointLight('#e369f4', 1.6, 36)
    orangeCornerLight.position.set(17, 15, 17)
    scene.add(orangeCornerLight)

    // === MATERIALS ===
    const tileTexWall = cloneFreshTexturesWithRepeat('facetTile', 8, 4)
    const tileTexFloor = cloneFreshTexturesWithRepeat('facetTile', 8, 8)
    const tileTexBlock = cloneFreshTexturesWithRepeat('facetTile', 2, 2)
    const metalTex = cloneFreshTexturesWithRepeat('fluted', 4, 2)

    const portalWallMat = new THREE.MeshStandardMaterial({
      color: '#40334f',
      map: tileTexWall.map,
      bumpMap: tileTexWall.bumpMap,
      bumpScale: 0.04,
      roughness: 0.3,
      metalness: 0.08,
    })
    const portalFloorMat = new THREE.MeshStandardMaterial({
      color: '#7d63a3',transparent:true,opacity:.14,depthWrite:false,
      map: tileTexFloor.map,
      bumpMap: tileTexFloor.bumpMap,
      bumpScale: 0.045,
      roughness: 0.32,
      metalness: 0.1,
    })
    const portalBlockMat = new THREE.MeshStandardMaterial({
      color: '#5e4b71',
      map: tileTexBlock.map,
      bumpMap: tileTexBlock.bumpMap,
      bumpScale: 0.04,
      roughness: 0.28,
      metalness: 0.08,
    })
    const darkFrameMat = new THREE.MeshStandardMaterial({
      color: '#514062',
      map: metalTex.map,
      roughness: 0.26,
      metalness: 0.48,
    })
    const rampMat = new THREE.MeshStandardMaterial({
      color: '#625478',
      roughness: 0.3,
      metalness: 0.18,
    })

    // === SEALED BOX CHAMBER GEOMETRY (ZERO ABYSS!) ===
    const raycastSurfaces: THREE.Object3D[] = []
    const colliders: BoxCollider[] = []
    const ramps: RampDef[] = []

    const addPortalSurfacePlane = (
      w: number,
      h: number,
      pos: [number, number, number],
      rot: [number, number, number],
      mat: THREE.Material,
    ) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
      mesh.position.set(pos[0], pos[1], pos[2])
      mesh.rotation.set(rot[0], rot[1], rot[2])
      mesh.receiveShadow = true
      mesh.userData.portalable = true
      scene.add(mesh)
      raycastSurfaces.push(mesh)
      return mesh
    }

    // Floor (y=0, normal +Y)
    addPortalSurfacePlane(ROOM_HALF * 2, ROOM_HALF * 2, [0, 0, 0], [-Math.PI / 2, 0, 0], portalFloorMat)
    // Ceiling (y=24, normal -Y)
    addPortalSurfacePlane(ROOM_HALF * 2, ROOM_HALF * 2, [0, ROOM_HEIGHT, 0], [Math.PI / 2, 0, 0], portalWallMat)
    // North wall (z=-24, normal +Z)
    addPortalSurfacePlane(ROOM_HALF * 2, ROOM_HEIGHT, [0, ROOM_HEIGHT / 2, -ROOM_HALF], [0, 0, 0], portalWallMat)
    // South wall (z=+24, normal -Z)
    addPortalSurfacePlane(ROOM_HALF * 2, ROOM_HEIGHT, [0, ROOM_HEIGHT / 2, ROOM_HALF], [0, Math.PI, 0], portalWallMat)
    // West wall (x=-24, normal +X)
    addPortalSurfacePlane(ROOM_HALF * 2, ROOM_HEIGHT, [-ROOM_HALF, ROOM_HEIGHT / 2, 0], [0, Math.PI / 2, 0], portalWallMat)
    // East wall (x=+24, normal -X)
    addPortalSurfacePlane(ROOM_HALF * 2, ROOM_HEIGHT, [ROOM_HALF, ROOM_HEIGHT / 2, 0], [0, -Math.PI / 2, 0], portalWallMat)

    // Color-coded architectural corner neon strips so you IMMEDIATELY recognize orientation through portal windows!
    const addWallStripe = (pos: [number, number, number], size: [number, number, number], color: string) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(size[0], size[1], size[2]),
        new THREE.MeshBasicMaterial({ color }),
      )
      m.position.set(pos[0], pos[1], pos[2])
      scene.add(m)
    }
    // North = Cyan accent, South = Orange accent, West = Emerald accent, East = Violet accent
    addWallStripe([0, 0.25, -ROOM_HALF + 0.08], [ROOM_HALF * 2 - 2, 0.35, 0.16], '#22D3EE')
    addWallStripe([0, ROOM_HEIGHT - 0.35, -ROOM_HALF + 0.08], [ROOM_HALF * 2 - 2, 0.35, 0.16], '#22D3EE')
    addWallStripe([0, 0.25, ROOM_HALF - 0.08], [ROOM_HALF * 2 - 2, 0.35, 0.16], '#e369f4')
    addWallStripe([0, ROOM_HEIGHT - 0.35, ROOM_HALF - 0.08], [ROOM_HALF * 2 - 2, 0.35, 0.16], '#e369f4')
    addWallStripe([-ROOM_HALF + 0.08, 0.25, 0], [0.16, 0.35, ROOM_HALF * 2 - 2], '#10B981')
    addWallStripe([-ROOM_HALF + 0.08, ROOM_HEIGHT - 0.35, 0], [0.16, 0.35, ROOM_HALF * 2 - 2], '#10B981')
    addWallStripe([ROOM_HALF - 0.08, 0.25, 0], [0.16, 0.35, ROOM_HALF * 2 - 2], '#A855F7')
    addWallStripe([ROOM_HALF - 0.08, ROOM_HEIGHT - 0.35, 0], [0.16, 0.35, ROOM_HALF * 2 - 2], '#A855F7')

    const clearCathedral=cathedral(scene,ROOM_HALF)

    // Helper to add solid internal portalable blocks & platforms
    const addBox = (
      id: string,
      cx: number,
      cy: number,
      cz: number,
      sx: number,
      sy: number,
      sz: number,
      portalable = true,
    ) => {
      const mat = portalable ? portalBlockMat : darkFrameMat
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(sx, sy, sz, 2, 0.12), mat)
      mesh.position.set(cx, cy, cz)
      mesh.castShadow = qualityRef.current !== 'low'
      mesh.receiveShadow = true
      mesh.userData.portalable = portalable
      scene.add(mesh)
      raycastSurfaces.push(mesh)
      colliders.push({
        id,
        cx,
        cy,
        cz,
        hx: sx / 2,
        hy: sy / 2,
        hz: sz / 2,
        portalable,
        mesh,
      })
      return mesh
    }

    // Helper to add smooth walkable ramps up to upper balconies (with glowing chevron rails!)
    const addRamp = (minX: number, maxX: number, minZ: number, maxZ: number, axis: 'x' | 'z', yStart: number, yEnd: number) => {
      ramps.push({ minX, maxX, minZ, maxZ, axis, yStart, yEnd })
      const w = maxX - minX
      const d = maxZ - minZ
      const dy = yEnd - yStart
      const run = axis === 'x' ? w : d
      const len = Math.hypot(run, dy)
      const angle = Math.atan2(dy, run)
      const rampGroup = new THREE.Group()
      rampGroup.position.set((minX + maxX) / 2, (yStart + yEnd) / 2 - 0.25, (minZ + maxZ) / 2)
      if (axis === 'z') rampGroup.rotation.x = -angle
      else rampGroup.rotation.z = angle

      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(axis === 'x' ? len : w, 0.55, axis === 'z' ? len : d),
        rampMat,
      )
      mesh.receiveShadow = true
      mesh.castShadow = qualityRef.current !== 'low'
      rampGroup.add(mesh)

      // Glowing side edge guide strips for crisp visual readability
      const railMat = new THREE.MeshBasicMaterial({ color: '#38BDF8' })
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(axis === 'x' ? len : 0.14, 0.14, axis === 'z' ? len : 0.14),
          railMat,
        )
        rail.position.set(axis === 'z' ? side * (w / 2 - 0.08) : 0, 0.3, axis === 'x' ? side * (d / 2 - 0.08) : 0)
        rampGroup.add(rail)
      }
      scene.add(rampGroup)
      raycastSurfaces.push(mesh)
    }

    // 4 tall portalable corner pillars (great for mid-air wall-to-wall portal bounces!)
    addBox('pillar-nw', -13, 7, -13, 4.4, 14, 4.4, true)
    addBox('pillar-ne', 13, 7, -13, 4.4, 14, 4.4, true)
    addBox('pillar-sw', -13, 7, 13, 4.4, 14, 4.4, true)
    addBox('pillar-se', 13, 7, 13, 4.4, 14, 4.4, true)

    // 2 Elevated Balcony Platforms (West & East) with walkable ramps!
    addBox('balcony-west', -19.5, 6.2, 0, 8.6, 1.2, 16, true)
    addBox('balcony-east', 19.5, 6.2, 0, 8.6, 1.2, 16, true)
    addRamp(-23.2, -16.2, 8, 18, 'z', 6.8, 0)
    addRamp(16.2, 23.2, -18, -8, 'z', 0, 6.8)

    // 2 High Ceiling-Drop Platforms (North & South at y=12.2) — shoot a portal on floor + here for huge velocity!
    addBox('high-north', 0, 12.2, -18.5, 13, 1.2, 7.5, true)
    addBox('high-south', 0, 12.2, 18.5, 13, 1.2, 7.5, true)

    // Central raised titanium pedestal & illuminated plasma laser tower (crisp sci-fi centerpiece!)
    addBox('center-base', 0, 0.45, 0, 6.4, 0.9, 6.4, false)
    const pedestalTrim = new THREE.Mesh(
      new THREE.BoxGeometry(6.55, 0.12, 6.55),
      new THREE.MeshBasicMaterial({ color: '#38BDF8' }),
    )
    pedestalTrim.position.set(0, 0.92, 0)
    scene.add(pedestalTrim)

    const emitterGroup = new THREE.Group()
    emitterGroup.position.set(0, 0.92, 0)
    const emitterBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.25, 0.45, 16),
      new THREE.MeshStandardMaterial({ color: '#94A3B8', metalness: 0.55, roughness: 0.22 }),
    )
    emitterBase.position.y = 0.22
    const emitterColumn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.62, 1.85, 16),
      new THREE.MeshStandardMaterial({ color: '#E2E8F0', metalness: 0.35, roughness: 0.22 }),
    )
    emitterColumn.position.y = 1.25
    const emitterCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.52, 16),
      new THREE.MeshStandardMaterial({
        color: '#F43F5E',
        emissive: '#FF2A5F',
        emissiveIntensity: 1.8,
        roughness: 0.15,
      }),
    )
    emitterCore.position.y = 1.9
    const emitterHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.86, 0.08, 12, 28),
      new THREE.MeshBasicMaterial({ color: '#38BDF8' }),
    )
    emitterHalo.rotation.x = Math.PI / 2
    emitterHalo.position.y = 1.88
    emitterGroup.add(emitterBase, emitterColumn, emitterCore, emitterHalo)
    scene.add(emitterGroup)

    // 4 Corner Speed Boost Pads on the floor (jump-launches toward high balconies!)
    const boostPads: Array<{ x: number; z: number; ring: THREE.Mesh }> = [
      { x: -19, z: -19, ring: new THREE.Mesh() },
      { x: 19, z: -19, ring: new THREE.Mesh() },
      { x: -19, z: 19, ring: new THREE.Mesh() },
      { x: 19, z: 19, ring: new THREE.Mesh() },
    ]
    boostPads.forEach((bp) => {
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(2.1, 2.4, 0.24, 24),
        new THREE.MeshStandardMaterial({
          color: '#0EA5E9',
          emissive: '#38BDF8',
          emissiveIntensity: 0.85,
          roughness: 0.2,
        }),
      )
      pad.position.set(bp.x, 0.12, bp.z)
      scene.add(pad)
      bp.ring = pad
    })

    // === SOLO TRAINING HOLO-TARGETS (visible in Solo Train mode!) ===
    const targetPositions = [
      new THREE.Vector3(0, 9.5, -10),
      new THREE.Vector3(0, 9.5, 10),
      new THREE.Vector3(-12, 11.5, 0),
      new THREE.Vector3(12, 11.5, 0),
      new THREE.Vector3(-18, 13, -18),
      new THREE.Vector3(18, 13, 18),
    ]
    const holoTargets: HoloTarget[] = targetPositions.map((p, idx) => {
      const grp = new THREE.Group()
      const outer = new THREE.Mesh(
        new THREE.TorusGeometry(1.45, 0.16, 12, 28),
        new THREE.MeshStandardMaterial({ color: '#38BDF8', emissive: '#22D3EE', emissiveIntensity: 1.2 }),
      )
      const inner = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.62, 0),
        new THREE.MeshStandardMaterial({ color: '#FACC15', emissive: '#F59E0B', emissiveIntensity: 1.1 }),
      )
      grp.add(outer, inner)
      grp.position.copy(p)
      grp.visible = arenaModeRef.current === 'solo_train'
      scene.add(grp)
      return {
        id: idx,
        basePos: p.clone(),
        pos: p.clone(),
        phase: idx * 1.15,
        active: true,
        respawnTimer: 0,
        mesh: grp,
      }
    })

    // === CENTRAL PLASMA LASER (Redirectable through portals!) ===
    const laserMat = new THREE.MeshBasicMaterial({ color: '#F43F5E' })
    const laserCoreMat = new THREE.MeshBasicMaterial({ color: '#FFE4E6' })
    const makeLaserBeam = () => {
      const grp = new THREE.Group()
      const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1, 10), laserMat)
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 8), laserCoreMat)
      grp.add(outer, inner)
      scene.add(grp)
      return grp
    }
    const laserBeamPrimary = makeLaserBeam()
    const laserBeamRedirect = makeLaserBeam()
    laserBeamRedirect.visible = false
    const laserSegA = new THREE.Vector3(0, 2.8, 0)
    const laserSegB = new THREE.Vector3(0, 2.8, -ROOM_HALF)
    const laserRedirA = new THREE.Vector3()
    const laserRedirB = new THREE.Vector3()
    let laserHasRedirect = false

    const orientBeam = (beam: THREE.Group, a: THREE.Vector3, b: THREE.Vector3) => {
      const diff = new THREE.Vector3().subVectors(b, a)
      const len = diff.length()
      if (len < 0.05) {
        beam.visible = false
        return
      }
      beam.visible = true
      beam.position.copy(a).addScaledVector(diff, 0.5)
      beam.scale.set(1, len, 1)
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), diff.normalize())
    }

    // === PORTAL PLACEMENT PREVIEW RING (shows exactly where portal will land before you click!) ===
    const previewRing = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.06, 10, 32),
      new THREE.MeshBasicMaterial({ color: '#38BDF8', transparent: true, opacity: 0.72 }),
    )
    previewRing.scale.set(PORTAL_RX, PORTAL_RY, 1)
    previewRing.visible = false
    scene.add(previewRing)

    // === SHARED PORTALS WITH LIVE RENDER-TO-TEXTURE WINDOWS (OPTIMIZED FOR 60+ FPS) ===
    const rtSize = qualityRef.current === 'high' ? 420 : qualityRef.current === 'medium' ? 320 : 224
    const buildPortalSlot = (slot: 'cyan' | 'orange'): PortalSlot => {
      const hex = slot === 'cyan' ? 0x49ddff : 0xf05df7
      const rt = new THREE.WebGLRenderTarget(rtSize, rtSize, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        depthBuffer: true,
      })

      const group = new THREE.Group()
      group.visible = false

      const windowMat = createPortalWindowMaterial(hex, rt)
      const windowMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 44), windowMat)
      windowMesh.scale.set(PORTAL_RX, PORTAL_RY, 1)
      group.add(windowMesh)

      const frameMesh = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.11, 14, 44),
        new THREE.MeshStandardMaterial({
          color: hex,
          emissive: hex,
          emissiveIntensity: 1.85,
          roughness: 0.15,
        }),
      )
      frameMesh.scale.set(PORTAL_RX * 1.03, PORTAL_RY * 1.03, 0.85)
      group.add(frameMesh)

      // Outer halo plasma rim for dramatic sci-fi clarity
      const outerHalo = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.04, 10, 44),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }),
      )
      outerHalo.scale.set(PORTAL_RX * 1.09, PORTAL_RY * 1.09, 0.5)
      outerHalo.position.z = 0.06
      group.add(outerHalo)

      const light = new THREE.PointLight(hex, 2.2, 14)
      light.position.set(0, 0, 0.8)
      group.add(light)

      scene.add(group)
      return {
        slot,
        active: false,
        pos: new THREE.Vector3(),
        normal: new THREE.Vector3(0, 0, 1),
        up: new THREE.Vector3(0, 1, 0),
        right: new THREE.Vector3(1, 0, 0),
        quat: new THREE.Quaternion(),
        ownerName: '',
        group,
        windowMesh,
        windowMat,
        frameMesh,
        light,
        rt,
      }
    }

    const portals: Record<'cyan' | 'orange', PortalSlot> = {
      cyan: buildPortalSlot('cyan'),
      orange: buildPortalSlot('orange'),
    }

    const placePortal = (
      slot: 'cyan' | 'orange',
      pos: THREE.Vector3,
      normal: THREE.Vector3,
      ownerName: string,
      broadcast = false,
      preferredUp?: THREE.Vector3,
    ) => {
      const p = portals[slot]
      const other = portals[slot === 'cyan' ? 'orange' : 'cyan']
      if (other.active && other.pos.distanceTo(pos) < 3.2) {
        return false
      }

      const n = normal.clone().normalize()
      // Build stable orthonormal basis (right, up, n)
      const refUp =
        Math.abs(n.y) > 0.92
          ? preferredUp && Math.abs(preferredUp.dot(n)) < 0.9
            ? preferredUp.clone().projectOnPlane(n).normalize()
            : new THREE.Vector3(0, 0, -1)
          : new THREE.Vector3(0, 1, 0)
      const right = new THREE.Vector3().crossVectors(refUp, n).normalize()
      const up = new THREE.Vector3().crossVectors(n, right).normalize()
      const rotMat = new THREE.Matrix4().makeBasis(right, up, n)
      const quat = new THREE.Quaternion().setFromRotationMatrix(rotMat)

      p.active = true
      p.pos.copy(pos).addScaledVector(n, 0.08)
      p.normal.copy(n)
      p.up.copy(up)
      p.right.copy(right)
      p.quat.copy(quat)
      p.ownerName = ownerName
      p.group.position.copy(p.pos)
      p.group.quaternion.copy(quat)
      p.group.visible = true
      p.group.updateMatrixWorld(true)

      setCyanPortalOpen(portals.cyan.active)
      setOrangePortalOpen(portals.orange.active)
      if(ownerName) audioEngine.playPortalOpen(slot)

      if (broadcast) {
        mp.broadcastArenaEvent({
          kind: 'portal_place',
          payload: {
            slot,
            pos: [pos.x, pos.y, pos.z],
            normal: [n.x, n.y, n.z],
            up: [up.x, up.y, up.z],
            ownerName,
          },
        })
      }
      return true
    }

    // Both cathedral doors are usable at spawn. Moving/clearing a slot moves/removes its swirl as well.
    const swirls = [portals.cyan,portals.orange].map((p,i)=>vortex(p.group,0,0,.105,PORTAL_RX*1.05,PORTAL_RY*1.05,i?'#ec6bff':'#4bddff'))
    placePortal('cyan',new THREE.Vector3(-10,3.5,-ROOM_HALF+.18),new THREE.Vector3(0,0,1),'')
    placePortal('orange',new THREE.Vector3(10,3.5,-ROOM_HALF+.18),new THREE.Vector3(0,0,1),'')
    const clearAllPortals = () => {
      portals.cyan.active = false
      portals.cyan.group.visible = false
      portals.orange.active = false
      portals.orange.group.visible = false
      setCyanPortalOpen(false)
      setOrangePortalOpen(false)
    }

    // === VIRTUAL PORTAL CAMERA RENDERER (TRUE LIVE WINDOW THROUGH PORTAL!) ===
    const rotY180 = new THREE.Matrix4().makeRotationY(Math.PI)
    const invSrcMat = new THREE.Matrix4()
    const virtCamMat = new THREE.Matrix4()
    const exitClipPlane = new THREE.Plane()
    const tmpClipPt = new THREE.Vector3()
    const tmpLookDir = new THREE.Vector3()
    const tmpToPortal = new THREE.Vector3()

    const renderPortalWindow = (src: PortalSlot, dest: PortalSlot) => {
      if (!src.active || !dest.active) return

      // Skip if src portal is behind player camera OR facing away from camera!
      camera.getWorldDirection(tmpLookDir)
      tmpToPortal.subVectors(src.pos, camera.position)
      if (tmpToPortal.dot(src.normal) >= 0.08) return // Viewing back of portal
      tmpToPortal.normalize()
      if (tmpLookDir.dot(tmpToPortal) < -0.22) return

      src.group.updateMatrixWorld(true)
      dest.group.updateMatrixWorld(true)

      // M_virtual = M_dest * RotY(PI) * M_src^-1 * M_mainCam
      invSrcMat.copy(src.group.matrixWorld).invert()
      virtCamMat
        .copy(dest.group.matrixWorld)
        .multiply(rotY180)
        .multiply(invSrcMat)
        .multiply(camera.matrixWorld)

      portalCam.matrixAutoUpdate = false
      portalCam.matrixWorld.copy(virtCamMat)
      portalCam.matrixWorldInverse.copy(virtCamMat).invert()
      portalCam.fov = camera.fov
      portalCam.aspect = camera.aspect
      portalCam.near = 0.12
      portalCam.far = 140
      portalCam.updateProjectionMatrix()

      // Clip everything BEHIND the destination portal plane so the destination wall NEVER occludes the view!
      tmpClipPt.copy(dest.pos).addScaledVector(dest.normal, 0.05)
      exitClipPlane.setFromNormalAndCoplanarPoint(dest.normal, tmpClipPt)

      // Hide portal surfaces & FPP glove during RT pass; SHOW local player rig so you can see yourself through portals!
      const prevLocalVis = localRig.root.visible
      const prevGloveVis = fppGloveGroup.visible
      const prevPreviewVis = previewRing.visible
      const prevShadowAuto = renderer.shadowMap.autoUpdate
      src.windowMesh.visible = false
      dest.windowMesh.visible = false
      fppGloveGroup.visible = false
      previewRing.visible = false
      localRig.root.visible = true

      // CRITICAL PERFORMANCE BOOST: Don't re-render shadow maps during portal RTT passes!
      renderer.shadowMap.autoUpdate = false
      renderer.clippingPlanes = [exitClipPlane]
      renderer.setRenderTarget(src.rt)
      renderer.clear()
      renderer.render(scene, portalCam)
      renderer.setRenderTarget(null)
      renderer.clippingPlanes = []
      renderer.shadowMap.autoUpdate = prevShadowAuto

      src.windowMesh.visible = true
      dest.windowMesh.visible = true
      fppGloveGroup.visible = prevGloveVis
      previewRing.visible = prevPreviewVis
      localRig.root.visible = prevLocalVis
    }

    // === HOT CORE OBJECT ===
    const coreMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.82, 1),
      new THREE.MeshStandardMaterial({
        color: '#FACC15',
        emissive: '#e369f4',
        emissiveIntensity: 1.5,
        roughness: 0.15,
      }),
    )
    coreMesh.visible = false
    scene.add(coreMesh)
    const coreState = {
      holderId: null as string | null,
      holderName: '' as string,
      timer: 14,
      pos: new THREE.Vector3(0, 3.6, 0),
    }

    // === RICOCHET ENERGY DISCS ===
    const discs: EnergyDiscState[] = []
    const spawnDisc = (
      ownerId: string,
      ownerName: string,
      origin: THREE.Vector3,
      dir: THREE.Vector3,
      broadcast = false,
    ) => {
      if (discs.length >= 4) {
        const old = discs.shift()!
        scene.remove(old.mesh)
        scene.remove(old.trailLine)
      }
      const grp = new THREE.Group()
      const ringMat = new THREE.MeshStandardMaterial({
        color: '#38BDF8',
        emissive: '#22D3EE',
        emissiveIntensity: 1.6,
        roughness: 0.15,
      })
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.13, 10, 24), ringMat)
      ring.rotation.x = Math.PI / 2
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.16, 16),
        new THREE.MeshBasicMaterial({ color: '#FFFFFF' }),
      )
      grp.add(ring, core)
      grp.position.copy(origin)
      scene.add(grp)

      const trailGeo = new THREE.BufferGeometry().setFromPoints([origin.clone(), origin.clone()])
      const trailLine = new THREE.Line(
        trailGeo,
        new THREE.LineBasicMaterial({ color: '#38BDF8', transparent: true, opacity: 0.85 }),
      )
      scene.add(trailLine)

      const vel = dir.clone().normalize().multiplyScalar(25)
      discs.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ownerId,
        ownerName,
        pos: origin.clone(),
        vel,
        passes: 0,
        ttl: 9.5,
        mesh: grp,
        ringMat,
        trailPoints: [origin.clone()],
        trailLine,
      })
      audioEngine.playDiscThrow()
      if (broadcast) {
        mp.broadcastArenaEvent({
          kind: 'disc_throw',
          payload: {
            ownerId,
            ownerName,
            pos: [origin.x, origin.y, origin.z],
            dir: [dir.x, dir.y, dir.z],
          },
        })
      }
    }

    // === SHOCKWAVE FX ===
    const shockwaves: Array<{ mesh: THREE.Mesh; age: number; maxScale: number }> = []
    const spawnShockwave = (pos: THREE.Vector3, color: number, maxScale = 7) => {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.4, 0.78, 28),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
      )
      m.position.copy(pos)
      m.rotation.x = -Math.PI / 2
      scene.add(m)
      shockwaves.push({ mesh: m, age: 0, maxScale })
    }

    // === LOCAL PLAYER RIG + FPP PORTAL GAUNTLET ===
    let localRig = createR6Rig({ kit:'rift',
      avatar: avatarRef.current,
      username: usernameRef.current,
      clanTag: clanTagRef.current,
      rank: rankNameRef.current,
      showNameplate: false,
      castShadow: qualityRef.current !== 'low',
    })
    let localRigKey = avatarKeyOf(avatarRef.current)
    scene.add(localRig.root)

    // Meteor aura around player
    const meteorAura = new THREE.Mesh(
      new THREE.ConeGeometry(1.15, 2.8, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: '#FACC15', transparent: true, opacity: 0.42, side: THREE.DoubleSide }),
    )
    meteorAura.visible = false
    scene.add(meteorAura)

    // First-Person Sleek Titanium-White Portal Blaster attached to main camera
    const fppGloveGroup = new THREE.Group()
    const gloveBody = new THREE.Mesh(
      new RoundedBoxGeometry(0.16, 0.13, 0.44, 3, 0.035),
      new THREE.MeshStandardMaterial({ color: '#F1F5F9', metalness: 0.28, roughness: 0.2 }),
    )
    const gloveGrip = new THREE.Mesh(
      new RoundedBoxGeometry(0.11, 0.09, 0.26, 2, 0.025),
      new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.45, roughness: 0.3 }),
    )
    gloveGrip.position.set(0, -0.045, 0.08)
    const gloveBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.068, 0.16, 16),
      new THREE.MeshStandardMaterial({ color: '#94A3B8', metalness: 0.65, roughness: 0.2 }),
    )
    gloveBarrel.rotation.x = Math.PI / 2
    gloveBarrel.position.set(0, 0.01, -0.24)
    const gloveCyan = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.036, 0.34),
      new THREE.MeshBasicMaterial({ color: '#22D3EE' }),
    )
    gloveCyan.position.set(-0.072, 0.038, -0.02)
    const gloveOrange = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.036, 0.34),
      new THREE.MeshBasicMaterial({ color: '#e369f4' }),
    )
    gloveOrange.position.set(0.072, 0.038, -0.02)
    const gloveCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.052, 0),
      new THREE.MeshBasicMaterial({ color: '#38BDF8' }),
    )
    gloveCore.position.set(0, 0.048, -0.25)
    fppGloveGroup.add(gloveBody, gloveGrip, gloveBarrel, gloveCyan, gloveOrange, gloveCore)
    fppGloveGroup.position.set(0.36, -0.32, -0.58)
    camera.add(fppGloveGroup)
    scene.add(camera)

    // === LOCAL PLAYER PHYSICS STATE ===
    const SPAWN_POINTS = [
      new THREE.Vector3(-18, 1.1, -10),
      new THREE.Vector3(18, 1.1, 10),
      new THREE.Vector3(0, 1.1, 19),
      new THREE.Vector3(0, 1.1, -19),
      new THREE.Vector3(-19, 7.6, 0),
      new THREE.Vector3(19, 7.6, 0),
    ]
    const pickSpawn = () => SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)].clone()

    const player = {
      pos: new THREE.Vector3(-2, 1.1, -5.5),
      vel: new THREE.Vector3(0, 0, 0),
      yaw: 0,
      pitch: 0,
      grounded: false,
      coyoteTimer: 0,
      jumpBuffer: 0,
      prevGrounded: false,
      camRoll: 0,
      camShake: 0,
      landDip: 0,
      portalCooldown: 0,
      pulseCooldown: 0,
      discCooldown: 0,
      emote: null as PlayerPose | null,
      emoteTimer: 0,
      recoil: 0,
      footstepTimer: 0,
      score: 0,
      elims: 0,
      peakSpeedKmh: 0,
      invulnTimer: 1.5,
      lastAttackerId: null as string | null,
      lastAttackerName: null as string | null,
      lastAttackerAt: 0,
      targetHits: 0,
      warps: 0,
    }

    const respawnLocal = () => {
      const sp = pickSpawn()
      player.pos.copy(sp)
      player.vel.set(0, 0, 0)
      player.grounded = false
      player.invulnTimer = 1.6
      player.lastAttackerId = null
      player.lastAttackerName = null
      spawnShockwave(sp, 0x38bdf8, 4.5)
    }

    // === PRACTICE BOTS (disabled automatically in Solo Train mode or when toggled off) ===
    const bots: ArenaBot[] = BOT_CONFIGS.map((cfg, idx) => {
      const rig = createR6Rig({ kit:'rift',
        avatar: cfg.avatar,
        username: cfg.name,
        rank: 'AI',
        showNameplate: true,
        castShadow: qualityRef.current !== 'low',
      })
      const sp = SPAWN_POINTS[(idx + 1) % SPAWN_POINTS.length].clone()
      rig.root.position.copy(sp)
      scene.add(rig.root)
      return {
        id: `bot-${idx}`,
        username: cfg.name,
        pos: sp,
        vel: new THREE.Vector3(),
        rotY: 0,
        grounded: false,
        rig,
        hpAlive: true,
        respawnTimer: 0,
        portalCooldown: 0,
        aiThinkTimer: 0.4 + idx * 0.3,
        moveDir: new THREE.Vector3(1, 0, 0),
        score: 0,
        lastAttackerId: null,
        lastAttackerName: null,
        lastAttackerAt: 0,
      }
    })

    // === MULTIPLAYER CLIENT ===
    const remotePeers = new Map<string, RemoteArenaPeer>()
    const mp = new LobbyMultiplayerClient({
      roomId: roomCode,
      world: 'arena',
      selfId: playerId,
      onState: (st) => {
        const existing = remotePeers.get(st.id)
        if (!existing) {
          const rig = createR6Rig({ kit:'rift',
            avatar: st.avatar,
            username: st.username,
            clanTag: st.clanTag ?? null,
            rank: st.rank,
            showNameplate: true,
            castShadow: qualityRef.current !== 'low',
          })
          rig.root.position.set(st.x, st.y, st.z)
          scene.add(rig.root)
          remotePeers.set(st.id, {
            state: st,
            rig,
            targetPos: new THREE.Vector3(st.x, st.y, st.z),
            currentPos: new THREE.Vector3(st.x, st.y, st.z),
            targetRotY: st.rotY,
            speechUntil: 0,
          })
        } else {
          if (avatarKeyOf(existing.state.avatar) !== avatarKeyOf(st.avatar)) {
            scene.remove(existing.rig.root)
            existing.rig.dispose()
            const swapped = createR6Rig({ kit:'rift',
              avatar: st.avatar,
              username: st.username,
              clanTag: st.clanTag ?? null,
              rank: st.rank,
              showNameplate: true,
              castShadow: qualityRef.current !== 'low',
            })
            swapped.root.position.copy(existing.currentPos)
            scene.add(swapped.root)
            existing.rig = swapped
          }
          existing.state = st
          existing.targetPos.set(st.x, st.y, st.z)
          existing.targetRotY = st.rotY
        }
      },
      onLeave: (id) => {
        const p = remotePeers.get(id)
        if (p) {
          scene.remove(p.rig.root)
          p.rig.dispose()
          remotePeers.delete(id)
        }
      },
      onChat: (msg) => {
        setChatMessages((prev) => [...pruneExpiredChatMessages(prev).slice(-49), msg])
        sfx.playChatPop()
        const peer = remotePeers.get(msg.senderId)
        if (peer) {
          peer.rig.setSpeech(msg.text)
          peer.speechUntil = performance.now() + 5500
        }
      },
      onArenaEvent: (senderId, ev: ArenaCustomPacket) => {
        if (ev.kind === 'portal_place') {
          const slot = ev.payload.slot === 'orange' ? 'orange' : 'cyan'
          const pArr = ev.payload.pos as [number, number, number]
          const nArr = ev.payload.normal as [number, number, number]
          const uArr = ev.payload.up as [number, number, number] | undefined
          if (Array.isArray(pArr) && Array.isArray(nArr)) {
            placePortal(
              slot,
              new THREE.Vector3(...pArr),
              new THREE.Vector3(...nArr),
              String(ev.payload.ownerName ?? ''),
              false,
              uArr ? new THREE.Vector3(...uArr) : undefined,
            )
          }
        } else if (ev.kind === 'disc_throw') {
          const pArr = ev.payload.pos as [number, number, number]
          const dArr = ev.payload.dir as [number, number, number]
          if (Array.isArray(pArr) && Array.isArray(dArr)) {
            spawnDisc(
              String(ev.payload.ownerId ?? senderId),
              String(ev.payload.ownerName ?? 'Player'),
              new THREE.Vector3(...pArr),
              new THREE.Vector3(...dArr),
              false,
            )
          }
        } else if (ev.kind === 'gravity_push') {
          const origin = ev.payload.origin as [number, number, number]
          const force = Number(ev.payload.force ?? 26)
          if (Array.isArray(origin)) {
            const origV = new THREE.Vector3(...origin)
            spawnShockwave(origV, 0x38bdf8, 8)
            const delta = player.pos.clone().sub(origV)
            const dist = delta.length()
            if (dist < 10.5 && dist > 0.1 && player.invulnTimer <= 0) {
              delta.normalize()
              const scale = (1 - dist / 10.5) * force
              player.vel.addScaledVector(delta, scale)
              player.vel.y = Math.max(player.vel.y, 8.5)
              player.grounded = false
              player.lastAttackerId = senderId
              player.lastAttackerName = String(ev.payload.ownerName ?? 'Rival')
              player.lastAttackerAt = performance.now()
              audioEngine.playGravityPulse()
            }
          }
        } else if (ev.kind === 'meteor_hit' && ev.payload.targetId === playerId) {
          if (player.invulnTimer <= 0) {
            const kName = String(ev.payload.killerName ?? 'Rival')
            pushKillFeed(
              langRef.current === 'pl' ? `☄️ ${kName} rozbił Cię Meteorytem!` : `☄️ ${kName} Meteor-KO'd you!`,
              '#FACC15',
            )
            audioEngine.playMeteorBoom()
            respawnLocal()
          }
        } else if (ev.kind === 'elim_notice') {
          pushKillFeed(String(ev.payload.text ?? ''), String(ev.payload.accent ?? '#38BDF8'))
        }
      },
    })
    mp.connect()

    // === PORTAL TELEPORTATION HELPER (Smooth exit + Velocity Vector Conservation) ===
    const isInsidePortalAperture = (worldPos: THREE.Vector3, p: PortalSlot): boolean => {
      if (!p.active) return false
      const rel = worldPos.clone().sub(p.pos)
      const distN = rel.dot(p.normal)
      if (distN > 1.35 || distN < -1.1) return false
      const rx = Math.abs(rel.dot(p.right))
      const ry = Math.abs(rel.dot(p.up))
      const nx = rx / (PORTAL_RX * 1.1)
      const ny = ry / (PORTAL_RY * 1.05)
      return nx * nx + ny * ny <= 1.0
    }

    const teleportEntity = (
      entityPos: THREE.Vector3,
      entityVel: THREE.Vector3,
      src: PortalSlot,
      dest: PortalSlot,
      isLocal: boolean,
    ) => {
      const speed = Math.max(13.5, Math.min(48, entityVel.length() * 1.12))
      // Map velocity vector accurately across portal coordinate frames: v_out = R_dest * RotY(PI) * R_src^-1 * v_in
      const localVel = new THREE.Vector3(
        entityVel.dot(src.right),
        entityVel.dot(src.up),
        entityVel.dot(src.normal),
      )
      // Entering means localVel.z < 0; exiting means +dest.normal
      const outVel = new THREE.Vector3()
        .addScaledVector(dest.right, -localVel.x)
        .addScaledVector(dest.up, localVel.y)
        .addScaledVector(dest.normal, Math.max(Math.abs(localVel.z), 10))
      if (outVel.lengthSq() < 0.01) outVel.copy(dest.normal)
      outVel.normalize().multiplyScalar(speed)

      entityPos.copy(dest.pos).addScaledVector(dest.normal, 1.55)
      if (dest.normal.y < -0.5) entityPos.y -= 1.65
      else if (dest.normal.y > 0.5) entityPos.y = Math.max(entityPos.y, 1.2)
      entityVel.copy(outVel)

      if (isLocal) {
        // Reorient yaw smoothly when exiting a horizontal wall portal
        if (Math.abs(dest.normal.y) < 0.65) {
          player.yaw = Math.atan2(-dest.normal.x, -dest.normal.z)
        }
        player.warps += 1
        setPortalWarpsCount(player.warps)
      }
      audioEngine.playPortalWarp()
      spawnShockwave(dest.pos, dest.slot === 'cyan' ? 0x22d3ee : 0xf05df7, 4.2)
    }

    // === BULLETPROOF SUB-STEPPED SEALED CHAMBER COLLISION (AXIAL X -> Z -> Y + AUTO-STEP — ZERO WALL GLITCH!) ===
    const tmpChestPt = new THREE.Vector3()
    const resolveEntityPhysics = (
      pos: THREE.Vector3,
      vel: THREE.Vector3,
      dt: number,
      allowPortals: boolean,
    ): { grounded: boolean; wallSlamSpeed: number; landedImpact: number } => {
      const subSteps = Math.max(1, Math.min(5, Math.ceil(dt / 0.0085)))
      const sdt = dt / subSteps
      let grounded = false
      let wallSlamSpeed = 0
      let landedImpact = 0
      const STEP_HEIGHT = 0.54
      const bound = ROOM_HALF - PLAYER_RADIUS

      for (let step = 0; step < subSteps; step++) {
        vel.y -= GRAVITY * sdt
        const bothOpen = allowPortals && portals.cyan.active && portals.orange.active
        tmpChestPt.set(pos.x, pos.y + 1.2, pos.z)
        const nearPortalAperture =
          bothOpen &&
          (isInsidePortalAperture(tmpChestPt, portals.cyan) ||
            isInsidePortalAperture(tmpChestPt, portals.orange) ||
            isInsidePortalAperture(pos, portals.cyan) ||
            isInsidePortalAperture(pos, portals.orange))

        // --- AXIS 1: X (smooth wall-sliding + auto-step up low ledges!) ---
        const prevX = pos.x
        pos.x += vel.x * sdt
        if (!nearPortalAperture) {
          for (const b of colliders) {
            const minX = b.cx - b.hx - PLAYER_RADIUS
            const maxX = b.cx + b.hx + PLAYER_RADIUS
            const minZ = b.cz - b.hz - PLAYER_RADIUS + 0.02
            const maxZ = b.cz + b.hz + PLAYER_RADIUS - 0.02
            const minY = b.cy - b.hy
            const maxY = b.cy + b.hy
            if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ && pos.y < maxY - 0.02 && pos.y + PLAYER_HEIGHT > minY + 0.02) {
              if (maxY - pos.y <= STEP_HEIGHT && vel.y <= 1.0) {
                pos.y = maxY
                vel.y = Math.max(0, vel.y)
                grounded = true
              } else {
                wallSlamSpeed = Math.max(wallSlamSpeed, Math.abs(vel.x))
                pos.x = prevX <= b.cx ? minX : maxX
                vel.x = 0
              }
            }
          }
          if (pos.x < -bound) {
            wallSlamSpeed = Math.max(wallSlamSpeed, Math.abs(vel.x))
            pos.x = -bound
            vel.x = 0
          } else if (pos.x > bound) {
            wallSlamSpeed = Math.max(wallSlamSpeed, Math.abs(vel.x))
            pos.x = bound
            vel.x = 0
          }
        }

        // --- AXIS 2: Z (smooth wall-sliding + auto-step up low ledges!) ---
        const prevZ = pos.z
        pos.z += vel.z * sdt
        if (!nearPortalAperture) {
          for (const b of colliders) {
            const minX = b.cx - b.hx - PLAYER_RADIUS + 0.02
            const maxX = b.cx + b.hx + PLAYER_RADIUS - 0.02
            const minZ = b.cz - b.hz - PLAYER_RADIUS
            const maxZ = b.cz + b.hz + PLAYER_RADIUS
            const minY = b.cy - b.hy
            const maxY = b.cy + b.hy
            if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ && pos.y < maxY - 0.02 && pos.y + PLAYER_HEIGHT > minY + 0.02) {
              if (maxY - pos.y <= STEP_HEIGHT && vel.y <= 1.0) {
                pos.y = maxY
                vel.y = Math.max(0, vel.y)
                grounded = true
              } else {
                wallSlamSpeed = Math.max(wallSlamSpeed, Math.abs(vel.z))
                pos.z = prevZ <= b.cz ? minZ : maxZ
                vel.z = 0
              }
            }
          }
          if (pos.z < -bound) {
            wallSlamSpeed = Math.max(wallSlamSpeed, Math.abs(vel.z))
            pos.z = -bound
            vel.z = 0
          } else if (pos.z > bound) {
            wallSlamSpeed = Math.max(wallSlamSpeed, Math.abs(vel.z))
            pos.z = bound
            vel.z = 0
          }
        }

        // --- AXIS 3: Y (floor, ceiling, platforms & smooth walkable ramps!) ---
        const prevY = pos.y
        pos.y += vel.y * sdt
        let stepGrounded = false

        // Walkable Ramps
        for (const r of ramps) {
          if (pos.x >= r.minX - 0.32 && pos.x <= r.maxX + 0.32 && pos.z >= r.minZ - 0.32 && pos.z <= r.maxZ + 0.32) {
            const t =
              r.axis === 'z'
                ? THREE.MathUtils.clamp((pos.z - r.minZ) / Math.max(0.01, r.maxZ - r.minZ), 0, 1)
                : THREE.MathUtils.clamp((pos.x - r.minX) / Math.max(0.01, r.maxX - r.minX), 0, 1)
            const rampY = THREE.MathUtils.lerp(r.yStart, r.yEnd, t)
            if (pos.y <= rampY + 0.52 && prevY >= rampY - 0.85 && vel.y <= 3.5) {
              if (vel.y < -4) landedImpact = Math.max(landedImpact, Math.min(1, -vel.y / 22))
              pos.y = rampY
              vel.y = 0
              stepGrounded = true
            }
          }
        }

        // Solid Box Tops & Bottoms
        if (!nearPortalAperture) {
          for (const b of colliders) {
            const minX = b.cx - b.hx - PLAYER_RADIUS + 0.03
            const maxX = b.cx + b.hx + PLAYER_RADIUS - 0.03
            const minZ = b.cz - b.hz - PLAYER_RADIUS + 0.03
            const maxZ = b.cz + b.hz + PLAYER_RADIUS - 0.03
            const minY = b.cy - b.hy
            const maxY = b.cy + b.hy
            if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ && pos.y < maxY && pos.y + PLAYER_HEIGHT > minY) {
              if (vel.y <= 0 && prevY >= maxY - 0.45) {
                if (vel.y < -4) landedImpact = Math.max(landedImpact, Math.min(1, -vel.y / 22))
                pos.y = maxY
                vel.y = 0
                stepGrounded = true
              } else if (vel.y > 0 && prevY + PLAYER_HEIGHT <= minY + 0.45) {
                pos.y = minY - PLAYER_HEIGHT
                vel.y = 0
              }
            }
          }

          if (pos.y <= 0) {
            if (vel.y < -4) landedImpact = Math.max(landedImpact, Math.min(1, -vel.y / 22))
            pos.y = 0
            if (vel.y < 0) vel.y = 0
            stepGrounded = true
          }
          if (pos.y + PLAYER_HEIGHT >= ROOM_HEIGHT) {
            pos.y = ROOM_HEIGHT - PLAYER_HEIGHT
            if (vel.y > 0) vel.y = 0
          }
        } else {
          pos.x = THREE.MathUtils.clamp(pos.x, -ROOM_HALF - 0.45, ROOM_HALF + 0.45)
          pos.z = THREE.MathUtils.clamp(pos.z, -ROOM_HALF - 0.45, ROOM_HALF + 0.45)
          pos.y = THREE.MathUtils.clamp(pos.y, -0.35, ROOM_HEIGHT + 0.35)
        }

        if (stepGrounded) grounded = true

        // Boost Pads on floor
        for (const bp of boostPads) {
          if (pos.y < 1.25 && Math.hypot(pos.x - bp.x, pos.z - bp.z) < 2.2) {
            vel.y = 22.0
            grounded = false
            audioEngine.playJumpPad()
          }
        }
      }

      return { grounded, wallSlamSpeed, landedImpact }
    }

    // === RAYCAST FOR SHOOTING PORTALS ===
    const raycaster = new THREE.Raycaster()
    const centerNdc = new THREE.Vector2(0, 0)

    const raycastPortalSurface = (): { pos: THREE.Vector3; normal: THREE.Vector3 } | null => {
      raycaster.setFromCamera(centerNdc, camera)
      const hits = raycaster.intersectObjects(raycastSurfaces, false)
      for (const h of hits) {
        if (h.distance < 1.1 || h.distance > 90) continue
        if (!h.object.userData.portalable) return null
        if (!h.face) continue
        const worldNormal = h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize()
        return { pos: h.point.clone(), normal: worldNormal }
      }
      return null
    }

    const shootPortal = (slot: 'cyan' | 'orange') => {
      audioEngine.unlock()
      player.recoil = 1
      const hit = raycastPortalSurface()
      if (!hit) {
        audioEngine.playPortalFail()
        return
      }
      // Pass player's forward vector as preferredUp when shooting floor/ceiling portals
      const camForward = new THREE.Vector3()
      camera.getWorldDirection(camForward)
      const ok = placePortal(slot, hit.pos, hit.normal, usernameRef.current, true, camForward)
      if (!ok) audioEngine.playPortalFail()
    }

    const throwEnergyDisc = () => {
      if (player.discCooldown > 0) return
      player.discCooldown = 2.0
      player.recoil = 0.8
      const dir = new THREE.Vector3()
      camera.getWorldDirection(dir)
      const origin = player.pos.clone().add(new THREE.Vector3(0, 2.0, 0)).addScaledVector(dir, 1.35)
      spawnDisc(playerId, usernameRef.current, origin, dir, true)
    }

    const triggerGravityPulse = () => {
      if (player.pulseCooldown > 0) return
      player.pulseCooldown = 3.2
      player.recoil = 1
      const origin = player.pos.clone().add(new THREE.Vector3(0, 1.4, 0))
      spawnShockwave(origin, 0x38bdf8, 8.5)
      audioEngine.playGravityPulse()

      // Push nearby bots hard (Wall Slam KO if slammed fast into a wall!)
      if (arenaModeRef.current !== 'solo_train' && botsEnabledRef.current) {
        for (const bot of bots) {
          if (!bot.hpAlive) continue
          const delta = bot.pos.clone().sub(origin)
          const dist = delta.length()
          if (dist < 10.5 && dist > 0.1) {
            delta.normalize()
            const force = (1 - dist / 10.5) * 34
            bot.vel.addScaledVector(delta, force)
            bot.vel.y = Math.max(bot.vel.y, 8.5)
            bot.grounded = false
            bot.lastAttackerId = playerId
            bot.lastAttackerName = usernameRef.current
            bot.lastAttackerAt = performance.now()
          }
        }
      }

      // Boost nearby discs!
      for (const d of discs) {
        if (d.pos.distanceTo(origin) < 10) {
          const dir = new THREE.Vector3()
          camera.getWorldDirection(dir)
          d.vel.copy(dir).multiplyScalar(Math.min(54, d.vel.length() * 1.25))
          d.ownerId = playerId
          d.ownerName = usernameRef.current
        }
      }

      mp.broadcastArenaEvent({
        kind: 'gravity_push',
        payload: { origin: [origin.x, origin.y, origin.z], force: 32, ownerName: usernameRef.current },
      })
    }

    // === ELIMINATION / SCORE HELPER ===
    const registerBotKO = (bot: ArenaBot, killerId: string | null, killerName: string | null, reason: string, isMeteor = false) => {
      if (!bot.hpAlive) return
      bot.hpAlive = false
      bot.respawnTimer = 3.0
      bot.rig.root.visible = false
      spawnShockwave(bot.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), isMeteor ? 0xfacc15 : 0xf43f5e, 6.5)

      if (killerId === playerId) {
        player.elims += 1
        player.score += isMeteor ? 150 : 100
        setMyElims(player.elims)
        setMyScore(player.score)
        onArenaProgressRef.current({
          eliminationsDelta: 1,
          peakSpeedKmh: player.peakSpeedKmh,
          meteorKill: isMeteor,
        })
        audioEngine.playMeteorBoom()
      }
      const txt =
        langRef.current === 'pl'
          ? `${isMeteor ? '☄️' : '⚡'} ${killerName ?? 'Arena'} → ${bot.username} (${reason})`
          : `${isMeteor ? '☄️' : '⚡'} ${killerName ?? 'Arena'} → ${bot.username} (${reason})`
      pushKillFeed(txt, isMeteor ? '#FACC15' : '#FB7185')
    }

    // === INPUT HANDLING ===
    const keys = new Set<string>()
    const touchMove = { x: 0, y: 0 }
    let touchJump = false
    let touchSprint = false

    const onKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        if (e.code === 'Escape') {
          ;(document.activeElement as HTMLElement).blur()
          setChatOpen(false)
        }
        return
      }
      keys.add(e.code)
      if (e.code === 'Escape') {
        e.preventDefault()
        if (wardrobeOpenRef.current) setWardrobeOpen(false)
        else if (chatOpenRef.current) setChatOpen(false)
        else if (emoteWheelOpenRef.current) setEmoteWheelOpen(false)
        else {
          const next = !menuOpenRef.current
          setMenuOpen(next)
          if (next) exitLock()
        }
        return
      }
      if (menuOpenRef.current || wardrobeOpenRef.current) return

      if (e.code === 'KeyV') setCameraView((v) => (v === 'fpp' ? 'tpp' : 'fpp'))
      else if (e.code === 'KeyQ') throwEnergyDisc()
      else if (e.code === 'KeyE') triggerGravityPulse()
      else if (e.code === 'KeyR') clearAllPortals()
      else if (e.code === 'KeyI') {
        setWardrobeOpen(true)
        exitLock()
      } else if (e.code === 'KeyG') {
        setEmoteWheelOpen((o) => !o)
        exitLock()
      } else if (e.code === 'Enter' || e.code === 'Slash') {
        e.preventDefault()
        setChatOpen(true)
        exitLock()
      } else if (e.code === 'KeyK') {
        setShortcutsOpen((s) => !s)
        exitLock()
      }
    }

    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code)

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return
      const sens = 0.0021 * mouseSensRef.current
      player.yaw -= e.movementX * sens
      player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * sens, -1.42, 1.42)
    }

    // === MULTI-TOUCH & DRAG CAMERA LOOK (Enables silky-smooth 360° touch aiming on mobile & tablets!) ===
    let lookPointerId: number | null = null
    let lastLookX = 0
    let lastLookY = 0

    const onPointerDown = (e: PointerEvent) => {
      if (menuOpenRef.current || wardrobeOpenRef.current || chatOpenRef.current || emoteWheelOpenRef.current) return
      audioEngine.unlock()
      // Ignore secondary mouse clicks if already pointer-locked
      if (document.pointerLockElement === renderer.domElement) return
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return
      if (e.pointerType === 'touch') e.preventDefault()
      if (lookPointerId === null) {
        lookPointerId = e.pointerId
        lastLookX = e.clientX
        lastLookY = e.clientY
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (lookPointerId === null || e.pointerId !== lookPointerId) return
      if (document.pointerLockElement === renderer.domElement) return
      if (menuOpenRef.current || wardrobeOpenRef.current || chatOpenRef.current || emoteWheelOpenRef.current) {
        lookPointerId = null
        return
      }
      const dx = e.clientX - lastLookX
      const dy = e.clientY - lastLookY
      lastLookX = e.clientX
      lastLookY = e.clientY
      const touchSens = (e.pointerType === 'touch' ? 0.0056 : 0.0036) * mouseSensRef.current
      player.yaw -= dx * touchSens
      player.pitch = THREE.MathUtils.clamp(player.pitch - dy * touchSens, -1.42, 1.42)
    }

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId === lookPointerId) {
        lookPointerId = null
      }
    }

    const onMouseDown = (e: MouseEvent) => {
      if (menuOpenRef.current || wardrobeOpenRef.current || chatOpenRef.current || emoteWheelOpenRef.current) return
      audioEngine.unlock()
      if (document.pointerLockElement !== renderer.domElement) {
        if (clickToLockRef.current && !isTouchDevice) requestLock()
        return
      }
      if (e.button === 0) shootPortal('cyan')
      else if (e.button === 2) shootPortal('orange')
      else if (e.button === 1) {
        e.preventDefault()
        triggerGravityPulse()
      }
    }

    const onContextMenu = (e: MouseEvent) => e.preventDefault()

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === renderer.domElement
      setPointerLocked(locked)
      if (!locked && !programmaticUnlockRef.current && !menuOpenRef.current && !wardrobeOpenRef.current && !chatOpenRef.current && !emoteWheelOpenRef.current) {
        setMenuOpen(true)
      }
      programmaticUnlockRef.current = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousemove', onMouseMove)
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    renderer.domElement.addEventListener('mousedown', onMouseDown)
    renderer.domElement.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('pointerlockchange', onPointerLockChange)

    const onResize = () => {
      if (!container) return
      const w = container.clientWidth
      const h = Math.max(1, container.clientHeight)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    // Switch mode helper
    const switchMode = (nextMode: ArenaModeId) => {
      setArenaMode(nextMode)
      arenaModeRef.current = nextMode
      if (nextMode === 'solo_train') {
        setBotsEnabled(false)
        botsEnabledRef.current = false
        clearAllPortals()
        holoTargets.forEach((ht) => {
          ht.active = true
          ht.mesh.visible = true
        })
        setRoundBanner(
          langRef.current === 'pl'
            ? '🎯 TRENING SOLO — Zero botów, bez limitu czasu! Ćwicz portale i tarcze!'
            : '🎯 SOLO TRAINING — No bots, no timer! Practice portals & holo-targets!',
        )
        window.setTimeout(() => setRoundBanner(null), 3200)
      } else {
        holoTargets.forEach((ht) => {
          ht.mesh.visible = false
        })
        roundTimer = ROUND_DURATION_SEC
      }
    }

    actionsRef.current = {
      shootPortal,
      clearPortals: clearAllPortals,
      throwDisc: throwEnergyDisc,
      gravityPulse: triggerGravityPulse,
      respawn: respawnLocal,
      triggerEmote: (pose) => {
        player.emote = pose
        player.emoteTimer = 2.4
      },
      sendChat: (text) => {
        const clean = text.trim().slice(0, 180)
        if (!clean) return
        const msg: LobbyChatMessage = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          senderId: playerId,
          username: clanTagRef.current ? `[${clanTagRef.current}] ${usernameRef.current}` : usernameRef.current,
          text: clean,
          timestamp: Date.now(),
        }
        setChatMessages((prev) => [...prev.slice(-49), msg])
        mp.broadcastChat(msg)
        sfx.playChatPop()
      },
      setTouchMove: (x, y) => {
        touchMove.x = x
        touchMove.y = y
      },
      setTouchJump: (p) => {
        touchJump = p
      },
      setTouchSprint: (s) => {
        touchSprint = s
      },
      addLookDelta: (dx, dy) => {
        player.yaw -= dx * 0.005 * mouseSensRef.current
        player.pitch = THREE.MathUtils.clamp(player.pitch - dy * 0.005 * mouseSensRef.current, -1.42, 1.42)
      },
      switchMode,
    }

    // === MAIN ANIMATION LOOP ===
    let rafId = 0
    let lastTime = performance.now()
    let elapsed = 0
    let roundTimer = ROUND_DURATION_SEC
    let lastBroadcast = 0
    let lastHudSync = 0
    let fpsFrames = 0
    let fpsTimer = performance.now()
    let laserAngle = 0
    let speedKingId: string | null = null
    let lastAimPortalableState = false
    let lastSpeedKingState: string | null = null
    const camRaycaster = new THREE.Raycaster()
    const tmpCamOrigin = new THREE.Vector3()
    const tmpCamDir = new THREE.Vector3()
    const tmpDesiredCam = new THREE.Vector3()
    const tmpEyePos = new THREE.Vector3()
    const tmpCamEuler = new THREE.Euler(0, 0, 0, 'YXZ')
    let smoothCamDist = 6.2

    const animate = () => {
      rafId = window.requestAnimationFrame(animate)
      const now = performance.now()
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      elapsed += dt

      fpsFrames++
      if (now - fpsTimer >= 700) {
        setFpsDisplay(Math.round((fpsFrames * 1000) / (now - fpsTimer)))
        fpsFrames = 0
        fpsTimer = now
      }

      // Dynamic FOV handled smoothly in camera block below; apply day/night lighting adjustments
      const isNight = worldTimeRef.current === 'night'
      hemi.intensity = isNight ? 0.65 : 1.15
      dirLight.intensity = isNight ? 0.72 : 1.25

      // Live avatar hot-swap
      const curAvKey = avatarKeyOf(avatarRef.current)
      if (curAvKey !== localRigKey) {
        scene.remove(localRig.root)
        localRig.dispose()
        localRig = createR6Rig({ kit:'rift',
          avatar: avatarRef.current,
          username: usernameRef.current,
          clanTag: clanTagRef.current,
          rank: rankNameRef.current,
          showNameplate: false,
          castShadow: qualityRef.current !== 'low',
        })
        localRigKey = curAvKey
        scene.add(localRig.root)
      }

      // Cooldowns
      player.portalCooldown = Math.max(0, player.portalCooldown - dt)
      player.pulseCooldown = Math.max(0, player.pulseCooldown - dt)
      player.discCooldown = Math.max(0, player.discCooldown - dt)
      player.invulnTimer = Math.max(0, player.invulnTimer - dt)
      player.recoil = Math.max(0, player.recoil - dt * 5)
      if (player.emoteTimer > 0) {
        player.emoteTimer -= dt
        if (player.emoteTimer <= 0) player.emote = null
      }

      // === 1. LOCAL PLAYER MOVEMENT (Coyote Time + Jump Buffer + Crisp Air Strafe) ===
      const uiBlocked = menuOpenRef.current || wardrobeOpenRef.current || chatOpenRef.current
      let moveFwd = 0
      let moveRight = 0
      if (!uiBlocked) {
        if (keys.has('KeyW') || keys.has('ArrowUp')) moveFwd += 1
        if (keys.has('KeyS') || keys.has('ArrowDown')) moveFwd -= 1
        if (keys.has('KeyD') || keys.has('ArrowRight')) moveRight += 1
        if (keys.has('KeyA') || keys.has('ArrowLeft')) moveRight -= 1
        moveFwd -= touchMove.y
        moveRight += touchMove.x
      }
      const sprint = !uiBlocked && (keys.has('ShiftLeft') || keys.has('ShiftRight') || touchSprint)
      const maxSpd = sprint ? SPRINT_SPEED : WALK_SPEED
      const fwdX = -Math.sin(player.yaw)
      const fwdZ = -Math.cos(player.yaw)
      const rgtX = Math.cos(player.yaw)
      const rgtZ = -Math.sin(player.yaw)

      let wishX = fwdX * moveFwd + rgtX * moveRight
      let wishZ = fwdZ * moveFwd + rgtZ * moveRight
      const wishLen = Math.hypot(wishX, wishZ)
      if (wishLen > 1) {
        wishX /= wishLen
        wishZ /= wishLen
      }

      if (!uiBlocked && (keys.has('Space') || touchJump)) {
        player.jumpBuffer = 0.15
      } else {
        player.jumpBuffer = Math.max(0, player.jumpBuffer - dt)
      }
      if (player.grounded) {
        player.coyoteTimer = 0.14
      } else {
        player.coyoteTimer = Math.max(0, player.coyoteTimer - dt)
      }

      const horizSpd = Math.hypot(player.vel.x, player.vel.z)
      if (player.grounded) {
        const drag = horizSpd > maxSpd + 3 ? 3.2 : 12.5
        player.vel.x += (wishX * maxSpd - player.vel.x) * Math.min(1, dt * drag)
        player.vel.z += (wishZ * maxSpd - player.vel.z) * Math.min(1, dt * drag)
      } else {
        // Responsive air strafe while preserving portal momentum!
        const airAccel = horizSpd < maxSpd ? 28 : 18
        player.vel.x += wishX * airAccel * dt
        player.vel.z += wishZ * airAccel * dt
      }

      if (player.jumpBuffer > 0 && player.coyoteTimer > 0) {
        player.vel.y = JUMP_VEL
        player.grounded = false
        player.coyoteTimer = 0
        player.jumpBuffer = 0
        audioEngine.playJump()
      }

      player.prevGrounded = player.grounded
      const phys = resolveEntityPhysics(player.pos, player.vel, dt, player.portalCooldown <= 0)
      player.grounded = phys.grounded
      if (!player.prevGrounded && player.grounded && phys.landedImpact > 0.08) {
        audioEngine.playLand(phys.landedImpact)
        player.landDip = Math.max(player.landDip, phys.landedImpact * 0.24)
      }
      if (phys.wallSlamSpeed > 14) {
        player.camShake = Math.max(player.camShake, Math.min(0.28, (phys.wallSlamSpeed - 12) * 0.012))
      }
      player.landDip = THREE.MathUtils.lerp(player.landDip, 0, Math.min(1, dt * 13))
      player.camShake = Math.max(0, player.camShake - dt * 1.4)
      player.camRoll = THREE.MathUtils.lerp(player.camRoll, -moveRight * 0.022, Math.min(1, dt * 10))

      // Footsteps audio
      if (player.grounded && horizSpd > 2.2) {
        player.footstepTimer -= dt
        if (player.footstepTimer <= 0) {
          player.footstepTimer = sprint ? 0.25 : 0.36
          audioEngine.playFootstep('neon', sprint)
        }
      }

      // Check portal teleportation for local player
      if (portals.cyan.active && portals.orange.active && player.portalCooldown <= 0) {
        const chest = player.pos.clone().add(new THREE.Vector3(0, 1.25, 0))
        if (isInsidePortalAperture(chest, portals.cyan) || isInsidePortalAperture(player.pos, portals.cyan)) {
          teleportEntity(player.pos, player.vel, portals.cyan, portals.orange, true)
          player.portalCooldown = 0.22
        } else if (isInsidePortalAperture(chest, portals.orange) || isInsidePortalAperture(player.pos, portals.orange)) {
          teleportEntity(player.pos, player.vel, portals.orange, portals.cyan, true)
          player.portalCooldown = 0.22
        }
      }

      const curSpeedMs = player.vel.length()
      const curSpeedKmh = Math.round(curSpeedMs * 3.6)
      const localMeteor = curSpeedMs >= METEOR_SPEED_MS
      if (curSpeedKmh > player.peakSpeedKmh) {
        player.peakSpeedKmh = curSpeedKmh
        setPeakSpeedHud(curSpeedKmh)
        if (curSpeedKmh >= 98) {
          onArenaProgressRef.current({ peakSpeedKmh: curSpeedKmh })
        }
      }

      // === 2. CENTRAL PLASMA LASER (Sweeps chamber & redirects through portals!) ===
      const modeNow = arenaModeRef.current
      laserAngle += dt * (modeNow === 'solo_train' ? 0.22 : 0.42)
      const laserDir = new THREE.Vector3(Math.cos(laserAngle), 0, Math.sin(laserAngle)).normalize()
      laserSegA.set(0, 2.8, 0)
      raycaster.set(laserSegA, laserDir)
      const lHits = raycaster.intersectObjects(raycastSurfaces, false)
      let hitDist = ROOM_HALF * 1.4
      if (lHits.length > 0) hitDist = lHits[0].distance
      laserSegB.copy(laserSegA).addScaledVector(laserDir, hitDist)
      orientBeam(laserBeamPrimary, laserSegA, laserSegB)

      laserHasRedirect = false
      if (portals.cyan.active && portals.orange.active) {
        const checkLaserPortal = (src: PortalSlot, dest: PortalSlot) => {
          const toP = src.pos.clone().sub(laserSegA)
          const proj = toP.dot(laserDir)
          if (proj > 0 && proj < hitDist + 1.5) {
            const closest = laserSegA.clone().addScaledVector(laserDir, proj)
            if (closest.distanceTo(src.pos) < PORTAL_RX * 1.15) {
              laserSegB.copy(src.pos)
              orientBeam(laserBeamPrimary, laserSegA, laserSegB)
              laserRedirA.copy(dest.pos).addScaledVector(dest.normal, 0.2)
              raycaster.set(laserRedirA, dest.normal)
              const rHits = raycaster.intersectObjects(raycastSurfaces, false)
              const rDist = rHits.length > 0 ? rHits[0].distance : 42
              laserRedirB.copy(laserRedirA).addScaledVector(dest.normal, rDist)
              orientBeam(laserBeamRedirect, laserRedirA, laserRedirB)
              laserHasRedirect = true
              return true
            }
          }
          return false
        }
        if (!checkLaserPortal(portals.cyan, portals.orange)) {
          checkLaserPortal(portals.orange, portals.cyan)
        }
      }
      laserBeamRedirect.visible = laserHasRedirect

      // Laser hit check on bots (and local player in combat modes)
      const pointToSegDist = (pt: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => {
        const ab = b.clone().sub(a)
        const lenSq = ab.lengthSq()
        if (lenSq < 0.001) return pt.distanceTo(a)
        const t = THREE.MathUtils.clamp(pt.clone().sub(a).dot(ab) / lenSq, 0, 1)
        return pt.distanceTo(a.clone().addScaledVector(ab, t))
      }

      if (modeNow !== 'solo_train' && player.invulnTimer <= 0) {
        const chest = player.pos.clone().add(new THREE.Vector3(0, 1.3, 0))
        const hitMain = pointToSegDist(chest, laserSegA, laserSegB) < 0.72
        const hitRedir = laserHasRedirect && pointToSegDist(chest, laserRedirA, laserRedirB) < 0.85
        if (hitMain || hitRedir) {
          audioEngine.playMeteorBoom()
          pushKillFeed(
            langRef.current === 'pl' ? '🔴 Przecięty Laserem Plazmowym!' : '🔴 Sliced by the Plasma Laser!',
            '#F43F5E',
          )
          respawnLocal()
        }
      }

      // === 3. SOLO TRAINING HOLO-TARGETS ===
      if (modeNow === 'solo_train') {
        const chest = player.pos.clone().add(new THREE.Vector3(0, 1.3, 0))
        for (const ht of holoTargets) {
          if (!ht.active) {
            ht.respawnTimer -= dt
            if (ht.respawnTimer <= 0) {
              ht.active = true
              ht.mesh.visible = true
            }
            continue
          }
          ht.mesh.visible = true
          ht.pos.copy(ht.basePos)
          ht.pos.y += Math.sin(elapsed * 2.1 + ht.phase) * 1.15
          ht.mesh.position.copy(ht.pos)
          ht.mesh.rotation.y = elapsed * 1.8 + ht.phase
          ht.mesh.rotation.x = Math.sin(elapsed + ht.phase) * 0.35

          // Break target by flying through it at high speed OR hitting it with energy disc!
          let hit = false
          if (chest.distanceTo(ht.pos) < 2.2) hit = true
          for (const d of discs) {
            if (d.pos.distanceTo(ht.pos) < 2.0) hit = true
          }
          if (hit) {
            ht.active = false
            ht.mesh.visible = false
            ht.respawnTimer = 4.0
            player.targetHits += 1
            setSoloTargetsHit(player.targetHits)
            spawnShockwave(ht.pos, 0x22d3ee, 5.5)
            audioEngine.playQuestClaim()
            pushKillFeed(
              langRef.current === 'pl'
                ? `🎯 Cel Treningowy #${ht.id + 1} rozbity! (${curSpeedKmh} km/h)`
                : `🎯 Holo-Target #${ht.id + 1} shattered! (${curSpeedKmh} km/h)`,
              '#22D3EE',
            )
          }
        }
      }

      // === 4. RICOCHET ENERGY DISCS ===
      for (let i = discs.length - 1; i >= 0; i--) {
        const d = discs[i]
        d.ttl -= dt
        if (d.ttl <= 0) {
          scene.remove(d.mesh)
          scene.remove(d.trailLine)
          discs.splice(i, 1)
          continue
        }
        d.pos.addScaledVector(d.vel, dt)
        d.mesh.position.copy(d.pos)
        d.mesh.rotation.y += dt * (12 + d.passes * 5)

        // Bounce cleanly off enclosed chamber walls/floor/ceiling!
        const bLim = ROOM_HALF - 0.7
        if (d.pos.x < -bLim || d.pos.x > bLim) {
          d.pos.x = THREE.MathUtils.clamp(d.pos.x, -bLim, bLim)
          d.vel.x *= -1.04
          audioEngine.playDiscPortalBoost(d.passes)
        }
        if (d.pos.z < -bLim || d.pos.z > bLim) {
          d.pos.z = THREE.MathUtils.clamp(d.pos.z, -bLim, bLim)
          d.vel.z *= -1.04
          audioEngine.playDiscPortalBoost(d.passes)
        }
        if (d.pos.y < 0.7 || d.pos.y > ROOM_HEIGHT - 0.7) {
          d.pos.y = THREE.MathUtils.clamp(d.pos.y, 0.7, ROOM_HEIGHT - 0.7)
          d.vel.y *= -1.04
          audioEngine.playDiscPortalBoost(d.passes)
        }

        // Portal acceleration for discs!
        if (portals.cyan.active && portals.orange.active) {
          const checkDiscPortal = (src: PortalSlot, dest: PortalSlot) => {
            if (d.pos.distanceTo(src.pos) < 1.85 && d.vel.dot(src.normal) < 0) {
              const spd = Math.min(62, d.vel.length() * 1.28)
              d.pos.copy(dest.pos).addScaledVector(dest.normal, 1.35)
              d.vel.copy(dest.normal).multiplyScalar(spd)
              d.passes += 1
              d.ttl = Math.min(11, d.ttl + 2.2)
              const col = d.passes >= 3 ? '#F43F5E' : d.passes >= 2 ? '#e369f4' : '#FACC15'
              d.ringMat.color.set(col)
              d.ringMat.emissive.set(col)
              ;(d.trailLine.material as THREE.LineBasicMaterial).color.set(col)
              audioEngine.playDiscPortalBoost(d.passes)
              spawnShockwave(dest.pos, 0xfacc15, 3.8)
              return true
            }
            return false
          }
          if (!checkDiscPortal(portals.cyan, portals.orange)) {
            checkDiscPortal(portals.orange, portals.cyan)
          }
        }

        // Update disc trail
        d.trailPoints.push(d.pos.clone())
        if (d.trailPoints.length > 16) d.trailPoints.shift()
        d.trailLine.geometry.setFromPoints(d.trailPoints)

        // Disc hits bots -> Instant KO!
        if (modeNow !== 'solo_train' && botsEnabledRef.current) {
          for (const bot of bots) {
            if (!bot.hpAlive) continue
            if (bot.pos.clone().add(new THREE.Vector3(0, 1.3, 0)).distanceTo(d.pos) < 1.75) {
              registerBotKO(
                bot,
                d.ownerId,
                d.ownerName,
                d.passes > 0 ? `Dysk ×${d.passes} Portal` : 'Dysk Energii',
                d.passes >= 2,
              )
              d.ttl = 0
              break
            }
          }
        }
      }

      // === 5. PRACTICE BOTS AI (Only when NOT in Solo Train & bots enabled & low human count) ===
      const activeBotsAllowed = modeNow !== 'solo_train' && botsEnabledRef.current && remotePeers.size < 2
      for (const bot of bots) {
        if (!activeBotsAllowed) {
          bot.rig.root.visible = false
          continue
        }
        if (!bot.hpAlive) {
          bot.respawnTimer -= dt
          if (bot.respawnTimer <= 0) {
            bot.hpAlive = true
            bot.pos.copy(pickSpawn())
            bot.vel.set(0, 0, 0)
            bot.rig.root.visible = true
          }
          continue
        }
        bot.rig.root.visible = true
        bot.portalCooldown = Math.max(0, bot.portalCooldown - dt)
        bot.aiThinkTimer -= dt
        if (bot.aiThinkTimer <= 0) {
          bot.aiThinkTimer = 0.65 + Math.random() * 0.9
          const toPlayer = player.pos.clone().sub(bot.pos)
          toPlayer.y = 0
          if (toPlayer.length() > 1) toPlayer.normalize()
          const strafe = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).multiplyScalar((Math.random() - 0.5) * 1.4)
          bot.moveDir.copy(toPlayer).add(strafe).normalize()
          if (bot.grounded && Math.random() < 0.35) {
            bot.vel.y = JUMP_VEL * 0.92
            bot.grounded = false
          }
        }

        if (bot.grounded) {
          bot.vel.x += (bot.moveDir.x * 10.2 - bot.vel.x) * Math.min(1, dt * 6)
          bot.vel.z += (bot.moveDir.z * 10.2 - bot.vel.z) * Math.min(1, dt * 6)
        }
        const bPhys = resolveEntityPhysics(bot.pos, bot.vel, dt, bot.portalCooldown <= 0)
        bot.grounded = bPhys.grounded

        // Wall Slam KO! (If slammed into a wall at >24 m/s right after Gravity Impulse)
        if (bPhys.wallSlamSpeed > 23 && now - bot.lastAttackerAt < 2800) {
          registerBotKO(bot, bot.lastAttackerId, bot.lastAttackerName, 'Wall Slam!', false)
          continue
        }

        // Laser hit on bot
        const bChest = bot.pos.clone().add(new THREE.Vector3(0, 1.3, 0))
        if (
          pointToSegDist(bChest, laserSegA, laserSegB) < 0.85 ||
          (laserHasRedirect && pointToSegDist(bChest, laserRedirA, laserRedirB) < 0.95)
        ) {
          registerBotKO(
            bot,
            laserHasRedirect ? playerId : null,
            laserHasRedirect ? usernameRef.current : 'Laser',
            laserHasRedirect ? 'Przekierowany Laser!' : 'Laser',
            false,
          )
          continue
        }

        // Portal travel for bots
        if (portals.cyan.active && portals.orange.active && bot.portalCooldown <= 0) {
          if (isInsidePortalAperture(bChest, portals.cyan)) {
            teleportEntity(bot.pos, bot.vel, portals.cyan, portals.orange, false)
            bot.portalCooldown = 0.35
          } else if (isInsidePortalAperture(bChest, portals.orange)) {
            teleportEntity(bot.pos, bot.vel, portals.orange, portals.cyan, false)
            bot.portalCooldown = 0.35
          }
        }

        // METEOR COLLISION KO (Local player flying >= 88 km/h rams a bot!)
        if (localMeteor && player.pos.distanceTo(bot.pos) < 2.65) {
          registerBotKO(bot, playerId, usernameRef.current, `Meteoryt ${curSpeedKmh} km/h`, true)
          continue
        }

        bot.rotY = Math.atan2(bot.vel.x, bot.vel.z)
        bot.rig.root.position.copy(bot.pos)
        bot.rig.root.rotation.y = bot.rotY
        const bSpd = Math.hypot(bot.vel.x, bot.vel.z)
        bot.rig.update(dt, elapsed, !bot.grounded ? 'jump' : bSpd > 1.5 ? 'run' : 'idle')
      }

      // === 6. REMOTE PEERS INTERPOLATION & METEOR HIT ===
      for (const [id, peer] of remotePeers.entries()) {
        if (now - peer.state.lastSeen > 12000) {
          scene.remove(peer.rig.root)
          peer.rig.dispose()
          remotePeers.delete(id)
          continue
        }
        peer.currentPos.lerp(peer.targetPos, Math.min(1, dt * 14))
        peer.rig.root.position.copy(peer.currentPos)
        peer.rig.root.rotation.y = peer.targetRotY
        peer.rig.update(dt, elapsed, peer.state.pose)
        if (peer.speechUntil > 0 && now > peer.speechUntil) {
          peer.rig.setSpeech(null)
          peer.speechUntil = 0
        }
        if (modeNow !== 'solo_train' && localMeteor && player.pos.distanceTo(peer.currentPos) < 2.6) {
          mp.broadcastArenaEvent({
            kind: 'meteor_hit',
            payload: { targetId: id, killerName: usernameRef.current, speedKmh: curSpeedKmh },
          })
          player.elims += 1
          player.score += 150
          setMyElims(player.elims)
          setMyScore(player.score)
          onArenaProgressRef.current({ eliminationsDelta: 1, peakSpeedKmh: curSpeedKmh, meteorKill: true })
          audioEngine.playMeteorBoom()
        }
      }

      // === 7. HOT CORE & SPEED KING MODES ===
      if (modeNow === 'core') {
        coreMesh.visible = true
        if (!coreState.holderId) {
          coreState.pos.set(0, 3.6 + Math.sin(elapsed * 3) * 0.45, 0)
          if (player.pos.distanceTo(coreState.pos) < 2.6) {
            coreState.holderId = playerId
            coreState.holderName = usernameRef.current
            coreState.timer = 14
            audioEngine.playQuestClaim()
          }
        } else if (coreState.holderId === playerId) {
          coreState.pos.copy(player.pos).add(new THREE.Vector3(0, 3.2, 0))
          coreState.timer -= dt
          player.score += Math.round(dt * 24)
          if (coreState.timer <= 0) {
            coreState.holderId = null
            coreState.timer = 14
            player.score += 150
            spawnShockwave(player.pos, 0xfacc15, 7)
            audioEngine.playQuestClaim()
          }
        }
        coreMesh.position.copy(coreState.pos)
        coreMesh.rotation.y = elapsed * 3
      } else {
        coreMesh.visible = false
      }

      if (modeNow === 'speed_king') {
        let topSpd = curSpeedKmh
        let kingId: string | null = curSpeedKmh >= 45 ? playerId : null
        let kingName: string | null = curSpeedKmh >= 45 ? usernameRef.current : null
        for (const [id, p] of remotePeers.entries()) {
          if ((p.state.speedKmh ?? 0) > topSpd) {
            topSpd = p.state.speedKmh ?? 0
            kingId = id
            kingName = p.state.username
          }
        }
        speedKingId = kingId
        if (kingId === playerId) player.score += Math.round(dt * 18)
        if (kingName !== lastSpeedKingState) {
          lastSpeedKingState = kingName
          setSpeedKingName(kingName)
        }
      } else {
        speedKingId = null
        if (lastSpeedKingState !== null) {
          lastSpeedKingState = null
          setSpeedKingName(null)
        }
      }

      // === 8. ROUND TIMER (Paused in Solo Training!) ===
      if (modeNow !== 'solo_train') {
        roundTimer -= dt
        if (roundTimer <= 0) {
          const won = player.score >= 100
          if (won) {
            onArenaProgressRef.current({ win: true, peakSpeedKmh: player.peakSpeedKmh })
          }
          setRoundBanner(
            langRef.current === 'pl'
              ? `🏆 Koniec rundy! Twój wynik: ${player.score} pkt · Start nowej rundy!`
              : `🏆 Round Over! Your score: ${player.score} pts · Next round starting!`,
          )
          window.setTimeout(() => setRoundBanner(null), 3500)
          player.score = 0
          setMyScore(0)
          roundTimer = ROUND_DURATION_SEC
          respawnLocal()
        }
      }

      // === 9. UPDATE CAMERA (FPP / TPP + Wall Raycast + Dynamic Speed FOV & Juice) ===
      const shakeX = player.camShake > 0.005 ? (Math.random() - 0.5) * player.camShake : 0
      const shakeY = player.camShake > 0.005 ? (Math.random() - 0.5) * player.camShake : 0
      tmpEyePos.set(player.pos.x + shakeX, player.pos.y + 2.28 - player.landDip + shakeY, player.pos.z)
      const isFpp = cameraViewRef.current === 'fpp'
      tmpCamEuler.set(player.pitch, player.yaw, isFpp ? player.camRoll : 0, 'YXZ')

      // Smooth dynamic FOV — widens exhilaratingly during sprint & portal meteor launches!
      const baseArenaFov = fovRef.current
      const targetFov = THREE.MathUtils.clamp(baseArenaFov + Math.max(0, curSpeedMs - 9) * 0.58 + (sprint && horizSpd > 9 ? 3.5 : 0), 62, 102)
      if (Math.abs(camera.fov - targetFov) > 0.08) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, Math.min(1, dt * 8))
        camera.updateProjectionMatrix()
      }

      if (isFpp) {
        camera.position.copy(tmpEyePos)
        camera.quaternion.setFromEuler(tmpCamEuler)
        localRig.root.visible = false
        fppGloveGroup.visible = true
        fppGloveGroup.position.set(
          0.36 + player.camRoll * 0.4,
          -0.32 - player.landDip * 0.25 + Math.sin(elapsed * (horizSpd > 2 ? 10 : 2.5)) * (horizSpd > 2 ? 0.018 : 0.004),
          -0.58 + player.recoil * 0.14,
        )
        gloveCore.rotation.y = elapsed * 3.5
      } else {
        tmpCamDir.set(0, 0, 1).applyEuler(tmpCamEuler)
        tmpCamOrigin.set(tmpEyePos.x, tmpEyePos.y + 0.35, tmpEyePos.z)
        // Wall-collision raycast so TPP camera NEVER clips inside pillars, balconies or outer walls!
        const desiredDist = 6.2
        tmpDesiredCam.copy(tmpCamOrigin).addScaledVector(tmpCamDir, desiredDist)
        tmpDesiredCam.y += 0.5
        const rayVec = tmpDesiredCam.clone().sub(tmpCamOrigin)
        const rayLen = rayVec.length()
        let allowedDist = rayLen
        if (rayLen > 0.1) {
          camRaycaster.set(tmpCamOrigin, rayVec.divideScalar(rayLen))
          camRaycaster.far = rayLen + 0.35
          const camHits = camRaycaster.intersectObjects(raycastSurfaces, false)
          if (camHits.length > 0) {
            allowedDist = Math.max(1.35, camHits[0].distance - 0.55)
          }
        }
        smoothCamDist = THREE.MathUtils.lerp(
          smoothCamDist,
          allowedDist,
          Math.min(1, dt * (allowedDist < smoothCamDist ? 26 : 10)),
        )
        camera.position.copy(tmpCamOrigin).addScaledVector(rayVec, smoothCamDist)
        camera.position.x = THREE.MathUtils.clamp(camera.position.x, -ROOM_HALF + 0.55, ROOM_HALF - 0.55)
        camera.position.z = THREE.MathUtils.clamp(camera.position.z, -ROOM_HALF + 0.55, ROOM_HALF - 0.55)
        camera.position.y = THREE.MathUtils.clamp(camera.position.y, 0.55, ROOM_HEIGHT - 0.55)
        camera.lookAt(tmpEyePos)
        localRig.root.visible = true
        fppGloveGroup.visible = false
      }

      const localPose: PlayerPose = player.emote
        ? player.emote
        : !player.grounded
          ? player.vel.y > 0
            ? 'jump'
            : 'fall'
          : horizSpd > 11
            ? 'run'
            : horizSpd > 1.5
              ? 'walk'
              : 'idle'

      localRig.root.position.copy(player.pos)
      localRig.root.rotation.y = player.yaw + Math.PI
      localRig.update(dt, elapsed, localPose)

      // Meteor aura visual
      meteorAura.visible = localMeteor && !isFpp
      if (meteorAura.visible) {
        meteorAura.position.copy(player.pos).add(new THREE.Vector3(0, 1.3, 0))
        meteorAura.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), player.vel.clone().normalize())
      }

      // Live Aim Preview Ring on portalable walls (only trigger React state on change!)
      const aimHit = raycastPortalSurface()
      const nextAimPortalable = Boolean(aimHit)
      if (nextAimPortalable !== lastAimPortalableState) {
        lastAimPortalableState = nextAimPortalable
        setAimPortalable(nextAimPortalable)
      }
      if (aimHit && !uiBlocked) {
        previewRing.visible = true
        previewRing.position.copy(aimHit.pos).addScaledVector(aimHit.normal, 0.09)
        const n = aimHit.normal
        const refU = Math.abs(n.y) > 0.92 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0)
        const rgt = new THREE.Vector3().crossVectors(refU, n).normalize()
        const upV = new THREE.Vector3().crossVectors(n, rgt).normalize()
        previewRing.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(rgt, upV, n))
      } else {
        previewRing.visible = false
      }

      // Update portal shaders & LIVE RENDER-TO-TEXTURE PORTAL WINDOWS!
      swirls.forEach(swirl=>swirl.update(elapsed))
      const linked = portals.cyan.active && portals.orange.active
      portals.cyan.windowMat.uniforms.uTime.value = elapsed
      portals.cyan.windowMat.uniforms.uLinked.value = linked ? 1 : 0
      portals.orange.windowMat.uniforms.uTime.value = elapsed
      portals.orange.windowMat.uniforms.uLinked.value = linked ? 1 : 0

      camera.updateMatrixWorld(true)
      if (linked) {
        renderPortalWindow(portals.cyan, portals.orange)
        renderPortalWindow(portals.orange, portals.cyan)
      }

      // Animate shockwaves
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i]
        sw.age += dt
        const p = sw.age / 0.42
        if (p >= 1) {
          scene.remove(sw.mesh)
          shockwaves.splice(i, 1)
          continue
        }
        sw.mesh.scale.setScalar(1 + p * sw.maxScale)
        ;(sw.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - p)
      }

      // Spatial Audio 2.0 (Laser + Portals hum)
      const distLaser = pointToSegDist(player.pos, laserSegA, laserSegB)
      audioEngine.setSpatialLoopLevel('laser', Math.max(0, 1 - distLaser / 18))
      const distPortal = Math.min(
        portals.cyan.active ? player.pos.distanceTo(portals.cyan.pos) : 99,
        portals.orange.active ? player.pos.distanceTo(portals.orange.pos) : 99,
      )
      audioEngine.setSpatialLoopLevel('portal', Math.max(0, 1 - distPortal / 14))

      // Broadcast player state (~15 Hz)
      if (now - lastBroadcast > 66) {
        lastBroadcast = now
        mp.broadcastState({
          id: playerId,
          username: usernameRef.current,
          clanTag: clanTagRef.current,
          rank: rankNameRef.current,
          x: player.pos.x,
          y: player.pos.y,
          z: player.pos.z,
          rotY: player.yaw + Math.PI,
          pose: localPose,
          avatar: avatarRef.current,
          speedKmh: curSpeedKmh,
          isMeteor: localMeteor,
          isKing: speedKingId === playerId,
          lastSeen: now,
        })
      }

      // Sync React HUD (~10 Hz)
      if (now - lastHudSync > 100) {
        lastHudSync = now
        setSpeedKmh(curSpeedKmh)
        setIsMeteorState(localMeteor)
        setMyScore(player.score)
        setRoundSecondsLeft(Math.max(0, Math.ceil(roundTimer)))
        setPulseCooldownPct(Math.round((1 - player.pulseCooldown / 3.2) * 100))
        setDiscActive(discs.length > 0)
        setDiscPassesHud(discs.reduce((m, d) => Math.max(m, d.passes), 0))
        setLaserRedirected(laserHasRedirect)
        setCoreTimerHud(modeNow === 'core' && coreState.holderId ? Math.ceil(coreState.timer) : null)
        setHumanCount(1 + remotePeers.size)
        setRoster([
          {
            id: playerId,
            username: clanTagRef.current ? `[${clanTagRef.current}] ${usernameRef.current}` : usernameRef.current,
            rank: rankNameRef.current,
            isSelf: true,
          },
          ...Array.from(remotePeers.values()).map((r) => ({
            id: r.state.id,
            username: r.state.clanTag ? `[${r.state.clanTag}] ${r.state.username}` : r.state.username,
            rank: r.state.rank,
          })),
        ])
      }

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('mousedown', onMouseDown)
      renderer.domElement.removeEventListener('contextmenu', onContextMenu)
      mp.disconnect()
      clearCathedral();swirls.forEach(swirl=>swirl.dispose())
      portals.cyan.rt.dispose()
      portals.orange.rt.dispose()
      localRig.dispose()
      bots.forEach((b) => b.rig.dispose())
      remotePeers.forEach((p) => p.rig.dispose())
      renderer.dispose()
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock?.()
      }
    }
  }, [roomCode, playerId, exitLock, requestLock, pushKillFeed, isTouchDevice])

  const handleCopyInvite = () => {
    const url = `${window.location.origin}/?world=arena&room=${encodeURIComponent(roomCode)}`
    void navigator.clipboard?.writeText(url)
    setCopiedInvite(true)
    sfx.playClick()
    window.setTimeout(() => setCopiedInvite(false), 1800)
  }

  const modeMeta: Record<ArenaModeId, { pl: string; en: string; color: string }> = {
    solo_train: { pl: 'Trening Solo', en: 'Solo Training', color: '#22D3EE' },
    arena_clash: { pl: 'Arena Walki', en: 'Kinetic Clash', color: '#38BDF8' },
    core: { pl: 'Gorący Rdzeń', en: 'Hot Core', color: '#e369f4' },
    speed_king: { pl: 'Król Prędkości', en: 'Speed King', color: '#FACC15' },
  }

  const formatTimer = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

  return (
    <div
      className="relative w-full overflow-hidden bg-slate-950 select-none"
      style={{ height: viewportHeight ? `${viewportHeight}px` : '100dvh', overscrollBehavior: 'none' }}
    >
      {/* 3D WebGL Canvas Mount (touch-action: none for full 360° finger camera look!) */}
      <div ref={mountRef} className="absolute inset-0 h-full w-full" style={{ touchAction: 'none' }} />

      {/* Top HUD Bar — Clean, single-row, zero overlap on 360px mobile landscape! */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-1.5 sm:gap-2"
        style={{
          paddingTop: 'max(0.45rem, calc(env(safe-area-inset-top) + 0.3rem))',
          paddingLeft: 'max(0.55rem, calc(env(safe-area-inset-left) + 0.35rem))',
          paddingRight: 'max(0.55rem, calc(env(safe-area-inset-right) + 0.35rem))',
        }}
      >
        {/* Left: Menu + Collapsible Mode Pill on Mobile / Full Bar on Desktop */}
        <div
          className="pointer-events-auto relative flex items-center gap-1.5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              sfx.playClick()
              exitLock()
              setModeMenuOpen(false)
              setMenuOpen(true)
            }}
            className="flex h-8 sm:h-9 items-center gap-1.5 rounded-xl border border-sky-400/35 bg-slate-950/82 px-2 sm:px-2.5 text-xs font-extrabold text-white backdrop-blur-md hover:bg-slate-900 cursor-pointer"
          >
            <Menu className="h-4 w-4 text-sky-400" />
            <span className="hidden lg:inline">Menu</span>
            <span className="hidden lg:inline rounded bg-white/10 px-1 py-0.5 font-mono text-[9px] text-sky-200">ESC</span>
          </button>

          {/* Compact Dropdown Mode Switcher for Mobile & Small Screens (< lg) — leaves 85% of screen unobstructed! */}
          <div className="relative lg:hidden">
            <button
              type="button"
              onClick={() => {
                sfx.playClick()
                setModeMenuOpen((o) => !o)
              }}
              className="flex h-8 items-center gap-1 rounded-xl border border-white/18 bg-slate-950/84 px-2.5 text-[11px] font-extrabold text-white backdrop-blur-md cursor-pointer"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: modeMeta[arenaMode].color }} />
              <span className="max-w-[96px] truncate">
                {lang === 'pl' ? modeMeta[arenaMode].pl : modeMeta[arenaMode].en}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-300 transition-transform ${modeMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {modeMenuOpen && (
              <div className="absolute left-0 top-10 z-40 w-44 rounded-2xl border border-white/15 bg-slate-950/95 p-1.5 shadow-2xl backdrop-blur-xl space-y-1">
                {(Object.keys(modeMeta) as ArenaModeId[]).map((mId) => {
                  const active = arenaMode === mId
                  return (
                    <button
                      key={mId}
                      type="button"
                      onClick={() => {
                        sfx.playClick()
                        actionsRef.current?.switchMode(mId)
                        setModeMenuOpen(false)
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[11px] font-extrabold transition cursor-pointer"
                      style={{
                        background: active ? modeMeta[mId].color : 'transparent',
                        color: active ? '#09111F' : '#E2E8F0',
                      }}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: active ? '#09111F' : modeMeta[mId].color }}
                      />
                      <span>{lang === 'pl' ? modeMeta[mId].pl : modeMeta[mId].en}</span>
                    </button>
                  )
                })}
                {arenaMode !== 'solo_train' && (
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick()
                      setBotsEnabled((b) => !b)
                    }}
                    className={`mt-1 flex w-full items-center justify-between rounded-xl border px-2.5 py-1.5 text-[11px] font-extrabold cursor-pointer ${
                      botsEnabled
                        ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                        : 'border-white/10 bg-white/5 text-slate-300'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Bot className="h-3.5 w-3.5" />
                      {lang === 'pl' ? 'Boty AI' : 'AI Bots'}
                    </span>
                    <span>{botsEnabled ? 'ON' : 'OFF'}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Full 4-Mode Bar on Desktop (lg+) */}
          <div className="hidden lg:flex items-center gap-1 rounded-xl border border-white/15 bg-slate-950/80 p-1 backdrop-blur-md">
            {(Object.keys(modeMeta) as ArenaModeId[]).map((mId) => {
              const active = arenaMode === mId
              return (
                <button
                  key={mId}
                  type="button"
                  onClick={() => {
                    sfx.playClick()
                    actionsRef.current?.switchMode(mId)
                  }}
                  className="rounded-lg px-2 py-1 text-[11px] font-extrabold transition cursor-pointer"
                  style={{
                    background: active ? modeMeta[mId].color : 'transparent',
                    color: active ? '#09111F' : '#CBD5E1',
                  }}
                >
                  {lang === 'pl' ? modeMeta[mId].pl : modeMeta[mId].en}
                </button>
              )
            })}
          </div>

          {arenaMode !== 'solo_train' && (
            <button
              type="button"
              onClick={() => {
                sfx.playClick()
                setBotsEnabled((b) => !b)
              }}
              className={`hidden lg:flex h-8 items-center gap-1 rounded-xl border px-2.5 text-[11px] font-extrabold backdrop-blur-md cursor-pointer ${
                botsEnabled
                  ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                  : 'border-white/15 bg-slate-950/75 text-slate-400'
              }`}
              title={lang === 'pl' ? 'Włącz lub wyłącz boty treningowe' : 'Toggle AI practice bots'}
            >
              <Bot className="h-3.5 w-3.5" />
              <span>{botsEnabled ? 'Boty ON' : 'Boty OFF'}</span>
            </button>
          )}
        </div>

        {/* Center: Compact Timer / Score Pill (also visible on mobile landscape!) */}
        <div className="flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-sky-400/30 bg-slate-950/82 px-2.5 sm:px-4 py-1 sm:py-1.5 backdrop-blur-md shadow-xl">
          {arenaMode === 'solo_train' ? (
            <>
              <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-extrabold text-cyan-300">
                <Target className="h-3.5 w-3.5" />
                {soloTargetsHit}
              </span>
              <span className="h-3 w-px bg-white/15" />
              <span className="font-mono text-[11px] sm:text-xs font-black text-amber-300">{speedKmh} km/h</span>
              <span className="hidden sm:inline h-3.5 w-px bg-white/15" />
              <span className="hidden sm:inline font-mono text-xs font-bold text-sky-300">🌀 {portalWarpsCount}</span>
            </>
          ) : (
            <>
              <span className="font-mono text-xs sm:text-sm font-black text-white">{formatTimer(roundSecondsLeft)}</span>
              <span className="h-3 w-px bg-white/15" />
              <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-extrabold text-amber-300">
                <Trophy className="h-3.5 w-3.5" />
                {myScore}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-xs font-extrabold text-orange-300">
                <Flame className="h-3.5 w-3.5" />
                {myElims}
              </span>
              {coreTimerHud !== null && (
                <span className="rounded-md bg-orange-500/25 px-1.5 py-0.5 font-mono text-[10px] sm:text-xs font-black text-orange-200">
                  {coreTimerHud}s
                </span>
              )}
              {speedKingName && arenaMode === 'speed_king' && (
                <span className="hidden md:inline rounded-md bg-amber-400/25 px-2 py-0.5 text-[11px] font-black text-amber-200">
                  👑 {speedKingName}
                </span>
              )}
            </>
          )}
        </div>

        {/* Right: Compact Action Pills (h-8 on mobile so ZERO collision with bottom buttons!) */}
        <div
          className="pointer-events-auto flex items-center gap-1 sm:gap-1.5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setCameraView((v) => (v === 'fpp' ? 'tpp' : 'fpp'))}
            className="flex h-8 sm:h-9 items-center gap-1 rounded-xl border border-white/15 bg-slate-950/82 px-2 sm:px-2.5 text-[10px] sm:text-[11px] font-extrabold text-sky-200 backdrop-blur-md hover:bg-slate-900 cursor-pointer"
            title={lang === 'pl' ? 'Przełącz kamerę FPP / TPP [V]' : 'Toggle FPP / TPP camera [V]'}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>{cameraView.toUpperCase()}</span>
          </button>

          <button
            type="button"
            onClick={() => actionsRef.current?.clearPortals()}
            className="flex h-8 w-8 sm:h-9 sm:w-auto sm:px-2.5 items-center justify-center gap-1 rounded-xl border border-white/15 bg-slate-950/82 text-[11px] font-extrabold text-slate-200 backdrop-blur-md hover:bg-slate-900 cursor-pointer"
            title={lang === 'pl' ? 'Wyczyść portale [R]' : 'Clear portals [R]'}
          >
            <RefreshCw className="h-3.5 w-3.5 text-cyan-300" />
            <span className="hidden lg:inline">[R]</span>
          </button>

          <button
            type="button"
            onClick={() => {
              exitLock()
              setWardrobeOpen(true)
            }}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-white/15 bg-slate-950/82 text-sky-300 backdrop-blur-md hover:bg-slate-900 cursor-pointer"
            title={lang === 'pl' ? 'Szatnia 3D [I]' : '3D Wardrobe [I]'}
          >
            <Shirt className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              exitLock()
              setChatOpen((c) => !c)
            }}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-white/15 bg-slate-950/82 text-sky-300 backdrop-blur-md hover:bg-slate-900 cursor-pointer"
            title="Chat [Enter]"
          >
            <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>

          <div className="hidden md:flex h-9 items-center gap-1.5 rounded-xl border border-emerald-400/25 bg-slate-950/80 px-2.5 font-mono text-xs font-bold text-emerald-300 backdrop-blur-md">
            <Users className="h-3.5 w-3.5" />
            <span>{humanCount}</span>
          </div>
        </div>
      </div>

      {/* Round / Mode Banner */}
      {roundBanner && (
        <div className="pointer-events-none absolute top-16 left-1/2 z-30 -translate-x-1/2 rounded-2xl border border-cyan-300/50 bg-slate-950/90 px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-2xl backdrop-blur-md">
          {roundBanner}
        </div>
      )}

      {/* Kill / Training Feed */}
      {killFeed.length > 0 && (
        <div className="pointer-events-none absolute right-3 top-16 z-20 flex flex-col items-end gap-1.5">
          {killFeed.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-white/15 bg-slate-950/80 px-3 py-1 text-xs font-extrabold backdrop-blur-md shadow"
              style={{ color: item.accent }}
            >
              {item.text}
            </div>
          ))}
        </div>
      )}

      {/* Dynamic Portal Crosshair (shows Cyan / Orange status + whether wall is portalable!) */}
      {!menuOpen && !wardrobeOpen && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="relative flex h-11 w-11 items-center justify-center">
            {/* Left Cyan Arc */}
            <div
              className="absolute left-0 h-8 w-4 rounded-l-full border-l-[3px] border-y-[2px] transition-all"
              style={{
                borderColor: cyanPortalOpen ? '#22D3EE' : aimPortalable ? 'rgba(34,211,238,0.65)' : 'rgba(148,163,184,0.35)',
                transform: aimPortalable ? 'scale(1.06)' : 'scale(0.95)',
              }}
            />
            {/* Right Orange Arc */}
            <div
              className="absolute right-0 h-8 w-4 rounded-r-full border-r-[3px] border-y-[2px] transition-all"
              style={{
                borderColor: orangePortalOpen ? '#e369f4' : aimPortalable ? 'rgba(221,108,247,0.65)' : 'rgba(148,163,184,0.35)',
                transform: aimPortalable ? 'scale(1.06)' : 'scale(0.95)',
              }}
            />
            <Crosshair
              className={`h-3.5 w-3.5 transition ${aimPortalable ? 'text-white scale-110' : 'text-slate-400/70'}`}
            />
          </div>
        </div>
      )}

      {/* Bottom Speedometer & Abilities Dock */}
      {!isTouchDevice && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl border border-white/15 bg-slate-950/85 px-4 py-2 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-2">
            <Gauge className={`h-5 w-5 ${isMeteorState ? 'text-amber-300 animate-pulse' : 'text-sky-400'}`} />
            <div>
              <div className={`font-mono text-lg font-black leading-none ${isMeteorState ? 'text-amber-300' : 'text-white'}`}>
                {speedKmh} <span className="text-[10px] font-bold opacity-70">km/h</span>
              </div>
              <div className="text-[9px] font-extrabold uppercase tracking-wider text-sky-300/80">
                {isMeteorState
                  ? lang === 'pl'
                    ? '☄️ METEORYT AKTYWNY!'
                    : '☄️ METEOR ACTIVE!'
                  : laserRedirected
                    ? '🔴 LASER PRZEKIEROWANY'
                    : lang === 'pl'
                      ? 'Zamknięta Komnata'
                      : 'Sealed Chamber'}
              </div>
            </div>
          </div>

          <div className="h-7 w-px bg-white/15" />

          <div className="flex items-center gap-1.5 text-[11px] font-extrabold">
            <span className={`rounded-lg border px-2 py-1 ${cyanPortalOpen ? 'border-cyan-300 bg-cyan-500/25 text-cyan-200' : 'border-white/15 bg-white/5 text-slate-300'}`}>
              LPM 🔵
            </span>
            <span className={`rounded-lg border px-2 py-1 ${orangePortalOpen ? 'border-fuchsia-300 bg-fuchsia-500/25 text-fuchsia-200' : 'border-white/15 bg-white/5 text-slate-300'}`}>
              PPM 🟣
            </span>
            <span className={`rounded-lg border px-2 py-1 ${discActive ? 'border-amber-300 bg-amber-500/25 text-amber-200' : 'border-white/15 bg-white/5 text-slate-200'}`}>
              [Q] Dysk {discPassesHud > 0 ? `×${discPassesHud}` : ''}
            </span>
            <span className={`rounded-lg border px-2 py-1 ${pulseCooldownPct >= 100 ? 'border-sky-300 bg-sky-500/20 text-sky-200' : 'border-white/10 bg-white/5 text-slate-500'}`}>
              [E] Impuls {pulseCooldownPct < 100 ? `${pulseCooldownPct}%` : '✓'}
            </span>
          </div>
        </div>
      )}

      {/* Click-to-Lock Hint */}
      {!isTouchDevice && !pointerLocked && !menuOpen && !wardrobeOpen && !chatOpen && !emoteWheelOpen && (
        <div
          onClick={requestLock}
          className="pointer-events-auto absolute bottom-20 left-1/2 z-20 -translate-x-1/2 cursor-pointer rounded-full border border-cyan-400/45 bg-slate-950/90 px-4 py-1.5 text-xs font-extrabold text-cyan-200 shadow-xl backdrop-blur hover:bg-slate-900"
        >
          {lang === 'pl'
            ? 'Kliknij ekran, aby grać · LPM/PPM Portale z widokiem 3D · Q Dysk · E Impuls · R Wyczyść · V FPP/TPP'
            : 'Click screen to lock · LMB/RMB Live 3D Portals · Q Disc · E Pulse · R Clear · V FPP/TPP'}
        </div>
      )}

      {/* Mobile Touch Controls + Portal Action Buttons */}
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
          {/* Ergonomic 2x2 Portal Action Cluster — side-by-side beside Jump on landscape, or neatly above Jump on narrow portrait! */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            style={{
              touchAction: 'none',
              bottom:
                viewportWidth < 560
                  ? 'max(10.2rem, calc(env(safe-area-inset-bottom) + 9.6rem))'
                  : 'max(0.95rem, calc(env(safe-area-inset-bottom) + 0.55rem))',
              right:
                viewportWidth < 560
                  ? 'max(0.85rem, calc(env(safe-area-inset-right) + 0.5rem))'
                  : viewportHeight < 460
                    ? '156px'
                    : '176px',
            }}
            className="pointer-events-auto absolute z-30 grid grid-cols-2 gap-1.5"
          >
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation()
                actionsRef.current?.shootPortal('cyan')
              }}
              className={`flex ${viewportHeight < 460 ? 'h-10 w-10 text-[10px]' : 'h-11 w-11 text-[11px]'} items-center justify-center rounded-2xl border-2 border-cyan-300 bg-cyan-500/40 font-black text-white shadow-lg backdrop-blur-md active:scale-90`}
            >
              P1
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation()
                actionsRef.current?.shootPortal('orange')
              }}
              className={`flex ${viewportHeight < 460 ? 'h-10 w-10 text-[10px]' : 'h-11 w-11 text-[11px]'} items-center justify-center rounded-2xl border-2 border-fuchsia-300 bg-fuchsia-500/40 font-black text-white shadow-lg backdrop-blur-md active:scale-90`}
            >
              P2
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation()
                actionsRef.current?.throwDisc()
              }}
              className={`flex ${viewportHeight < 460 ? 'h-10 w-10' : 'h-11 w-11'} items-center justify-center rounded-2xl border border-amber-300 bg-amber-500/35 text-amber-100 shadow-lg backdrop-blur-md active:scale-90`}
              aria-label="Portal Disc"
            >
              <Disc className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation()
                actionsRef.current?.gravityPulse()
              }}
              className={`flex ${viewportHeight < 460 ? 'h-10 w-10' : 'h-11 w-11'} items-center justify-center rounded-2xl border border-sky-300 bg-sky-500/35 text-sky-100 shadow-lg backdrop-blur-md active:scale-90`}
              aria-label="Gravity Pulse"
            >
              <Zap className="h-4 w-4 sm:h-5 sm:w-5" />
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

      {/* Emote Wheel [G] */}
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

      {/* Live 3D Wardrobe [I] */}
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

      {/* In-Game Menu Drawer */}
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
        onSwitchToFrisbee={onSwitchToFrisbee}
        onLeaveToHome={onLeave}
        onOpenFeedback={onOpenFeedback}
      />

      <ShortcutsOverlayModal
        open={shortcutsOpen}
        lang={lang}
        worldKind="lobby"
        onClose={() => setShortcutsOpen(false)}
      />

      {/* Keep reference to onSwitchToObby for clean TS */}
      <button type="button" className="hidden" onClick={onSwitchToObby} aria-hidden />
    </div>
  )
}
