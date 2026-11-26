import {sunsetStadium} from './art/stadium'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import {
  Bot,
  ChevronDown,
  Crosshair,
  Crown,
  Disc,
  Eye,
  Flame,
  Hand,
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

export type FrisbeeModeId = 'match_3r' | 'solo_trick'

export interface FrisbeeKingWorldProps {
  roomCode: string
  playerId: string
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
  onFrisbeeProgress: (opts: {
    slicesDelta?: number
    catchesDelta?: number
    matchWin?: boolean
    trickSlice?: boolean
  }) => void
  onLeave: () => void
  onSwitchToLobby: () => void
  onSwitchToArena?: () => void
  onOpenFeedback: () => void
}

interface BoxWall {
  cx: number
  cy: number
  cz: number
  hx: number
  hy: number
  hz: number
}

interface AngledPlaneWall {
  point: THREE.Vector3
  normal: THREE.Vector3
  /** Horizontal half-width along tangent */
  halfWidth: number
  minY: number
  maxY: number
}

interface AngledObbWall {
  cx: number
  cz: number
  halfW: number
  halfD: number
  minY: number
  maxY: number
  cosR: number
  sinR: number
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

interface FrisbeeBot {
  id: string
  username: string
  pos: THREE.Vector3
  vel: THREE.Vector3
  rotY: number
  grounded: boolean
  alive: boolean
  rig: R6RigHandle
  roundWins: number
  slices: number
  aiThinkTimer: number
  moveDir: THREE.Vector3
  catchCooldown: number
}

interface RemotePeer {
  state: RemotePlayerState
  rig: R6RigHandle
  targetPos: THREE.Vector3
  currentPos: THREE.Vector3
  targetRotY: number
  alive: boolean
  speechUntil: number
}

interface SliceFx {
  topHalf: THREE.Mesh
  botHalf: THREE.Mesh
  ring: THREE.Mesh
  velTop: THREE.Vector3
  velBot: THREE.Vector3
  age: number
}

interface BounceRingFx {
  mesh: THREE.Mesh
  age: number
}

interface TrickTarget {
  id: number
  basePos: THREE.Vector3
  pos: THREE.Vector3
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

// Sealed Winding Box Dimensions (ZERO ABYSS!)
const ARENA_HALF = 26
const ARENA_HEIGHT = 20
const GRAVITY = 27.0
const PLAYER_RADIUS = 0.64
const PLAYER_HEIGHT = 2.65
const WALK_SPEED = 11.6
const SPRINT_SPEED = 16.0
const JUMP_VEL = 13.0
const FRISBEE_BASE_SPEED = 25.5
const FRISBEE_FIRE_THRESHOLD = 38.5 // Speed (m/s) where frisbee ignites into BLAZING FIRE!
const FRISBEE_MAX_SPEED = 66.0
const ROUND_TIME_SEC = 65
const TOTAL_ROUNDS = 3

const FRISBEE_BOTS: Array<{name:string;avatar:R6AvatarConfig}> = ['Blaze','Aero','Spin'].map((name,i)=>({
  name:`[BOT] ${name}`,avatar:{outfitId:'fresh-creator',faceId:'fresh-smile',hatId:'none',skinColor:['#edb782','#b98054','#d49e79'][i]}
}))

function avatarKeyOf(a: R6AvatarConfig): string {
  return `${a.outfitId}|${a.hatId}|${a.faceId}|${a.skinColor}|${a.trailId ?? 'none'}|${a.backId ?? 'none'}|${a.petId ?? 'none'}`
}

export const FrisbeeKingWorld: React.FC<FrisbeeKingWorldProps> = ({
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
  onFrisbeeProgress,
  onLeave,
  onSwitchToLobby,
  onSwitchToArena,
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

  const [gameMode, setGameMode] = useState<FrisbeeModeId>('match_3r')
  const gameModeRef = useRef<FrisbeeModeId>('match_3r')
  gameModeRef.current = gameMode

  const [botsEnabled, setBotsEnabled] = useState(true)
  const botsEnabledRef = useRef(true)
  botsEnabledRef.current = botsEnabled

  // Match & Frisbee HUD State
  const [roundNum, setRoundNum] = useState(1)
  const [roundTimeLeft, setRoundTimeLeft] = useState(ROUND_TIME_SEC)
  const [myRoundWins, setMyRoundWins] = useState(0)
  const [mySlices, setMySlices] = useState(0)
  const [myCatches, setMyCatches] = useState(0)
  const [aliveCount, setAliveCount] = useState(4)
  const [amAlive, setAmAlive] = useState(true)
  const [holdingFrisbee, setHoldingFrisbee] = useState(false)
  const [holderLabel, setHolderLabel] = useState<string | null>(null)
  const [discSpeedKmh, setDiscSpeedKmh] = useState(0)
  const [discBlazing, setDiscBlazing] = useState(false)
  const [discBounces, setDiscBounces] = useState(0)
  const [canCatchNow, setCanCatchNow] = useState(false)
  const [blazingDanger, setBlazingDanger] = useState(false)
  const [catchWindowActive, setCatchWindowActive] = useState(false)
  const [chargePct, setChargePct] = useState(0)
  const [holdTimeoutSec, setHoldTimeoutSec] = useState<number | null>(null)
  const [soloTargetsHit, setSoloTargetsHit] = useState(0)
  const [bannerText, setBannerText] = useState<string | null>(null)
  const [killFeed, setKillFeed] = useState<KillFeedItem[]>([])
  const [humanCount, setHumanCount] = useState(1)
  const [roster, setRoster] = useState<InGameRosterMember[]>([])
  const [fpsDisplay, setFpsDisplay] = useState(60)

  // Menus & Prefs
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
  const onFrisbeeProgressRef = useRef(onFrisbeeProgress)
  onFrisbeeProgressRef.current = onFrisbeeProgress
  const langRef = useRef(lang)
  langRef.current = lang
  const programmaticUnlockRef = useRef(false)

  const actionsRef = useRef<{
    throwFrisbee: (curveDir: -1 | 0 | 1, charge01?: number) => void
    attemptCatch: () => void
    recallSoloFrisbee: () => void
    switchMode: (mode: FrisbeeModeId) => void
    triggerEmote: (pose: PlayerPose) => void
    sendChat: (text: string) => void
    setTouchMove: (x: number, y: number) => void
    setTouchJump: (pressed: boolean) => void
    setTouchSprint: (s: boolean) => void
    respawn: () => void
  } | null>(null)

  const pushFeed = useCallback((text: string, accent = '#FB923C') => {
    setKillFeed((prev) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text, accent, at: Date.now() },
      ...prev.slice(0, 4),
    ])
  }, [])

  const showBanner = useCallback((text: string, ms = 2800) => {
    setBannerText(text)
    window.setTimeout(() => {
      setBannerText((cur) => (cur === text ? null : cur))
    }, ms)
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
    audioEngine.setWorldMusic('frisbee')
    return () => {
      audioEngine.setWorldMusic('none')
    }
  }, [])

  // ==================== THREE.JS FRISBEE KING ENGINE ====================
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#DCEBFF')

    const camera = new THREE.PerspectiveCamera(
      fovRef.current,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.12,
      160,
    )

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
    renderer.domElement.style.touchAction = 'none'
    container.innerHTML = ''
    container.appendChild(renderer.domElement)
    canvasRef.current = renderer.domElement

    // === PROCEDURAL STUDIO IBL ENVIRONMENT (Crisp reflections on brushed metal, neon glass & disc!) ===


    // === BRIGHT CYBER-STADIUM LIGHTING (Energetic, readable & crisp — ZERO dark dungeon!) ===
    const hemi = new THREE.HemisphereLight('#ffe5c4', '#b98d71', 1.32)
    scene.add(hemi)
    const dirLight = new THREE.DirectionalLight('#ffdab1', 1.5)
    dirLight.position.set(14, 19, 12)
    dirLight.castShadow = qualityRef.current !== 'low'
    dirLight.shadow.mapSize.set(1024, 1024)
    dirLight.shadow.camera.left = -30
    dirLight.shadow.camera.right = 30
    dirLight.shadow.camera.top = 30
    dirLight.shadow.camera.bottom = -30
    scene.add(dirLight)

    const warmLight = new THREE.PointLight('#F97316', 1.8, 46)
    warmLight.position.set(-16, 15, -16)
    scene.add(warmLight)
    const coolLight = new THREE.PointLight('#22D3EE', 1.8, 46)
    coolLight.position.set(16, 15, 16)
    scene.add(coolLight)

    // === MATERIALS (Bright Daylight Neon Sports Arena Palette) ===
    const floorTex = cloneFreshTexturesWithRepeat('facetTile', 10, 10)
    const wallTex = cloneFreshTexturesWithRepeat('facetTile', 8, 3)
    const metalTex = cloneFreshTexturesWithRepeat('fluted', 3, 2)

    const floorMat = new THREE.MeshStandardMaterial({
      color: '#629549',
      map: floorTex.map,
      bumpMap: floorTex.bumpMap,
      bumpScale: 0.04,
      roughness: 0.3,
      metalness: 0.1,
    })
    const outerWallMat = new THREE.MeshStandardMaterial({
      color: '#c47b56',
      map: wallTex.map,
      bumpMap: wallTex.bumpMap,
      bumpScale: 0.04,
      roughness: 0.32,
      metalness: 0.15,
    })
    const innerWallMat = new THREE.MeshStandardMaterial({
      color: '#b96645',
      map: metalTex.map,
      roughness: 0.26,
      metalness: 0.35,
    })
    const bankWallMat = new THREE.MeshStandardMaterial({
      color: '#0D9488',
      emissive: '#14B8A6',
      emissiveIntensity: 0.35,
      roughness: 0.22,
      metalness: 0.38,
    })
    const rampMat = new THREE.MeshStandardMaterial({
      color: '#c68d61',
      roughness: 0.28,
      metalness: 0.2,
    })
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: '#E2EDF8',
      roughness: 0.4,
      metalness: 0.15,
    })

    // === SEALED WINDING TRICK-SHOT ARENA (100% ENCLOSED BOX — ZERO ABYSS!) ===
    const boxes: BoxWall[] = []
    const angledWalls: AngledPlaneWall[] = []
    const angledObbs: AngledObbWall[] = []
    const ramps: RampDef[] = []
    const camSurfaces: THREE.Object3D[] = []

    const addOuterPlane = (
      w: number,
      h: number,
      pos: [number, number, number],
      rot: [number, number, number],
      mat: THREE.Material,
    ) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
      m.position.set(pos[0], pos[1], pos[2])
      m.rotation.set(rot[0], rot[1], rot[2])
      m.receiveShadow = true
      scene.add(m)
      camSurfaces.push(m)
    }

    // Floor, Ceiling, 4 Outer Box Walls
    addOuterPlane(ARENA_HALF * 2, ARENA_HALF * 2, [0, 0, 0], [-Math.PI / 2, 0, 0], floorMat)
    // Low kickboards backed by fine safety mesh: ricochets keep the same boundary,
    // but the terraces and sunset are visible through it.
    const netCanvas=document.createElement('canvas');netCanvas.width=netCanvas.height=64
    const nc=netCanvas.getContext('2d')!;nc.strokeStyle='#ffe2b9';nc.lineWidth=1.5;nc.strokeRect(0,0,64,64)
    const netTex=new THREE.CanvasTexture(netCanvas);netTex.wrapS=netTex.wrapT=THREE.RepeatWrapping
    netTex.repeat.set(40,16);const netMat=new THREE.MeshBasicMaterial({map:netTex,transparent:true,opacity:.32,depthWrite:false,side:THREE.DoubleSide})
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2,x=-Math.sin(a)*ARENA_HALF,z=-Math.cos(a)*ARENA_HALF
      addOuterPlane(ARENA_HALF*2,1.5,[x,.75,z],[0,a,0],outerWallMat)
      addOuterPlane(ARENA_HALF*2,ARENA_HEIGHT-1.5,[x,(ARENA_HEIGHT+1.5)/2,z],[0,a,0],netMat)
    }
    addOuterPlane(ARENA_HALF*2,ARENA_HALF*2,[0,ARENA_HEIGHT,0],[Math.PI/2,0,0],netMat)
    const stadium=sunsetStadium(scene,ARENA_HALF)
    let stadiumNight=false

    // Helper: Solid Box Wall / Corridor Divider / Deck
    const addSolidBox = (
      cx: number,
      cy: number,
      cz: number,
      sx: number,
      sy: number,
      sz: number,
      accent?: string,
    ) => {
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(sx, sy, sz, 2, 0.14), innerWallMat)
      mesh.position.set(cx, cy, cz)
      mesh.castShadow = qualityRef.current !== 'low'
      mesh.receiveShadow = true
      scene.add(mesh)
      camSurfaces.push(mesh)
      if (accent) {
        const trim = new THREE.Mesh(
          new THREE.BoxGeometry(sx + 0.08, 0.18, sz + 0.08),
          new THREE.MeshBasicMaterial({ color: accent }),
        )
        trim.position.set(cx, cy + sy / 2 - 0.14, cz)
        scene.add(trim)
      }
      boxes.push({ cx, cy, cz, hx: sx / 2, hy: sy / 2, hz: sz / 2 })
    }

    // Helper: 45-Degree Bank-Shot Corner & Deflector Walls (solid OBB for players + exact planes for frisbee!)
    const addAngledBankWall = (cx: number, cz: number, rotY: number, width: number, height: number) => {
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, 1.0, 2, 0.12), bankWallMat)
      mesh.position.set(cx, height / 2, cz)
      mesh.rotation.y = rotY
      mesh.castShadow = qualityRef.current !== 'low'
      mesh.receiveShadow = true
      scene.add(mesh)
      camSurfaces.push(mesh)

      const neon = new THREE.Mesh(
        new THREE.BoxGeometry(width - 0.6, 0.24, 1.08),
        new THREE.MeshBasicMaterial({ color: '#2DD4BF' }),
      )
      neon.position.set(cx, 2.2, cz)
      neon.rotation.y = rotY
      scene.add(neon)

      // Solid OBB collider for smooth, glitch-free player & bot sliding on BOTH sides & edges!
      angledObbs.push({
        cx,
        cz,
        halfW: width / 2,
        halfD: 0.54,
        minY: 0,
        maxY: height,
        cosR: Math.cos(rotY),
        sinR: Math.sin(rotY),
      })

      const normal = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY)).normalize()
      // Add both front and back plane colliders for frisbee reflection
      angledWalls.push({
        point: new THREE.Vector3(cx, height / 2, cz).addScaledVector(normal, 0.52),
        normal: normal.clone(),
        halfWidth: width / 2,
        minY: 0,
        maxY: height,
      })
      angledWalls.push({
        point: new THREE.Vector3(cx, height / 2, cz).addScaledVector(normal, -0.52),
        normal: normal.clone().negate(),
        halfWidth: width / 2,
        minY: 0,
        maxY: height,
      })
    }

    // Helper: Walkable Ramp (with glowing side guide rails!)
    const addRamp = (minX: number, maxX: number, minZ: number, maxZ: number, axis: 'x' | 'z', yStart: number, yEnd: number) => {
      ramps.push({ minX, maxX, minZ, maxZ, axis, yStart, yEnd })
      const w = maxX - minX
      const d = maxZ - minZ
      const dy = yEnd - yStart
      const run = axis === 'x' ? w : d
      const len = Math.hypot(run, dy)
      const ang = Math.atan2(dy, run)
      const rampGroup = new THREE.Group()
      rampGroup.position.set((minX + maxX) / 2, (yStart + yEnd) / 2 - 0.22, (minZ + maxZ) / 2)
      if (axis === 'z') rampGroup.rotation.x = -ang
      else rampGroup.rotation.z = ang

      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(axis === 'x' ? len : w, 0.5, axis === 'z' ? len : d),
        rampMat,
      )
      mesh.receiveShadow = true
      mesh.castShadow = qualityRef.current !== 'low'
      rampGroup.add(mesh)

      const railMat = new THREE.MeshBasicMaterial({ color: '#F97316' })
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(axis === 'x' ? len : 0.14, 0.14, axis === 'z' ? len : 0.14),
          railMat,
        )
        rail.position.set(axis === 'z' ? side * (w / 2 - 0.08) : 0, 0.28, axis === 'x' ? side * (d / 2 - 0.08) : 0)
        rampGroup.add(rail)
      }
      scene.add(rampGroup)
      camSurfaces.push(mesh)
    }

    // --- WINDING LABYRINTH & TRICK-SHOT LAYOUT ---
    // 4 Corner 45° Bank-Shot Walls!
    addAngledBankWall(-21.2, -21.2, Math.PI / 4, 12.5, 2.65)
    addAngledBankWall(21.2, -21.2, -Math.PI / 4, 12.5, 2.65)
    addAngledBankWall(-21.2, 21.2, (3 * Math.PI) / 4, 12.5, 2.65)
    addAngledBankWall(21.2, 21.2, -(3 * Math.PI) / 4, 12.5, 2.65)

    // Two rim decks for bank shots; leave the centre of the painted court open.
    addSolidBox(-20,1.05,0,6.4,2.1,11,'#e4c27e')
    addSolidBox(20,1.05,0,6.4,2.1,11,'#77d2c8')
    addRamp(-23.2,-16.8,5.5,13.5,'z',2.1,0)
    addRamp(16.8,23.2,-13.5,-5.5,'z',0,2.1)

    // Low Vault Covers around outer circuit (jump over or bank frisbee off them!)
    addSolidBox(0, 1.0, -19.5, 8.5, 2.0, 1.3, '#F97316')
    addSolidBox(0, 1.0, 19.5, 8.5, 2.0, 1.3, '#22D3EE')

    // 4 Corner Jump Boost Pads
    const jumpPads = [
      { x: -19, z: -13 },
      { x: 19, z: 13 },
      { x: -13, z: 19 },
      { x: 13, z: -19 },
    ]
    jumpPads.forEach((jp) => {
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(1.75, 2.0, 0.22, 20),
        new THREE.MeshStandardMaterial({ color: '#F59E0B', emissive: '#F97316', emissiveIntensity: 0.9 }),
      )
      pad.position.set(jp.x, 0.11, jp.z)
      scene.add(pad)
    })

    // === SOLO TRICK-SHOT TARGETS (Visible in Solo Trick mode!) ===
    const soloTargets: TrickTarget[] = [
      new THREE.Vector3(-18, 2.6, -18),
      new THREE.Vector3(18, 2.6, 18),
      new THREE.Vector3(18, 2.6, -18),
      new THREE.Vector3(-18, 2.6, 18),
      new THREE.Vector3(0, 8.2, 0),
      new THREE.Vector3(-19, 8.2, 0),
    ].map((p, idx) => {
      const grp = new THREE.Group()
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.25, 0.14, 10, 26),
        new THREE.MeshStandardMaterial({ color: '#F97316', emissive: '#EF4444', emissiveIntensity: 1.3 }),
      )
      const bull = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.55, 0),
        new THREE.MeshStandardMaterial({ color: '#FACC15', emissive: '#FDE047', emissiveIntensity: 1.2 }),
      )
      grp.add(ring, bull)
      grp.position.copy(p)
      grp.visible = gameModeRef.current === 'solo_trick'
      scene.add(grp)
      return { id: idx, basePos: p.clone(), pos: p.clone(), active: true, respawnTimer: 0, mesh: grp }
    })

    // === THE 3D FRISBEE MESH + FIRE FLAMES + RIBBON TRAIL + AIM LINE ===
    const frisbeeGroup = new THREE.Group()
    const discBodyMat = new THREE.MeshStandardMaterial({
      color: '#38BDF8',
      emissive: '#0EA5E9',
      emissiveIntensity: 1.1,
      roughness: 0.18,
      metalness: 0.45,
    })
    const discRimMat = new THREE.MeshStandardMaterial({
      color: '#E0F2FE',
      emissive: '#38BDF8',
      emissiveIntensity: 1.6,
      roughness: 0.1,
    })
    const discBody = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.82, 0.14, 28), discBodyMat)
    const discRim = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.095, 10, 28), discRimMat)
    discRim.rotation.x = Math.PI / 2

    // Fire Aura Ring (activates when frisbee reaches blazing speed!)
    const fireHaloMat = new THREE.MeshBasicMaterial({
      color: '#F97316',
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
    })
    const fireHalo = new THREE.Mesh(new THREE.RingGeometry(0.78, 1.55, 24), fireHaloMat)
    fireHalo.rotation.x = Math.PI / 2
    fireHalo.visible = false

    const fireLight = new THREE.PointLight('#38BDF8', 2.4, 15)
    frisbeeGroup.add(discBody, discRim, fireHalo, fireLight)
    scene.add(frisbeeGroup)

    // Catch-Zone pulsing cyan ring around flying catchable frisbee
    const catchRing = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.4, 28),
      new THREE.MeshBasicMaterial({ color: '#34D399', side: THREE.DoubleSide, transparent: true, opacity: 0.65 }),
    )
    catchRing.rotation.x = Math.PI / 2
    catchRing.visible = false
    frisbeeGroup.add(catchRing)

    // Frisbee Flight Ribbon Trail
    const trailPts: THREE.Vector3[] = []
    const trailMat = new THREE.MeshBasicMaterial({color:'#ffd367',side:THREE.DoubleSide,transparent:true,opacity:.84,depthWrite:false})
    const trailGeo=new THREE.BufferGeometry(), trailBuf=new Float32Array(26*2*3)
    const trailAttr=new THREE.BufferAttribute(trailBuf,3);trailGeo.setAttribute('position',trailAttr)
    const trailIndices:number[]=[];for(let i=0;i<25;i++){const a=i*2;trailIndices.push(a,a+1,a+2,a+1,a+3,a+2)}
    trailGeo.setIndex(trailIndices);trailGeo.setDrawRange(0,0)
    const trailLine=new THREE.Mesh(trailGeo,trailMat);trailLine.frustumCulled=false
    scene.add(trailLine)

    // FPP Hand Frisbee + Aiming Line when YOU hold the frisbee!
    const fppFrisbee = new THREE.Group()
    const fppDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.26, 0.045, 24),
      new THREE.MeshStandardMaterial({ color: '#38BDF8', emissive: '#0EA5E9', emissiveIntensity: 1.2, roughness: 0.2 }),
    )
    const fppRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.032, 8, 24),
      new THREE.MeshBasicMaterial({ color: '#F0F9FF' }),
    )
    fppRim.rotation.x = Math.PI / 2
    fppFrisbee.add(fppDisc, fppRim)
    fppFrisbee.position.set(0.38, -0.28, -0.62)
    fppFrisbee.visible = false
    camera.add(fppFrisbee)
    scene.add(camera)

    // Slice FX & Wall Bounce Spark Rings
    const sliceFxs: SliceFx[] = []
    const bounceFxs: BounceRingFx[] = []

    const spawnSliceEffect = (pos: THREE.Vector3, colorHex = 0xf97316) => {
      const topHalf = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 1.05, 0.65),
        new THREE.MeshStandardMaterial({ color: colorHex, emissive: '#EF4444', emissiveIntensity: 0.9 }),
      )
      const botHalf = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 1.05, 0.65),
        new THREE.MeshStandardMaterial({ color: '#1E293B', emissive: '#F97316', emissiveIntensity: 0.6 }),
      )
      topHalf.position.copy(pos).add(new THREE.Vector3(0, 1.65, 0))
      botHalf.position.copy(pos).add(new THREE.Vector3(0, 0.6, 0))
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.5, 1.4, 28),
        new THREE.MeshBasicMaterial({ color: '#FACC15', side: THREE.DoubleSide, transparent: true, opacity: 0.95 }),
      )
      ring.position.copy(pos).add(new THREE.Vector3(0, 1.2, 0))
      ring.rotation.x = Math.PI / 2
      scene.add(topHalf, botHalf, ring)
      sliceFxs.push({
        topHalf,
        botHalf,
        ring,
        velTop: new THREE.Vector3((Math.random() - 0.5) * 6, 7.5, (Math.random() - 0.5) * 6),
        velBot: new THREE.Vector3((Math.random() - 0.5) * 4, 2.2, (Math.random() - 0.5) * 4),
        age: 0,
      })
    }

    const spawnBounceRing = (pos: THREE.Vector3, normal: THREE.Vector3, blazing: boolean) => {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.25, 0.58, 22),
        new THREE.MeshBasicMaterial({
          color: blazing ? '#F97316' : '#38BDF8',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
        }),
      )
      m.position.copy(pos).addScaledVector(normal, 0.08)
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
      scene.add(m)
      bounceFxs.push({ mesh: m, age: 0 })
    }

    // === FRISBEE RUNTIME STATE ===
    const frisbee = {
      holderId: null as string | null,
      holderName: '' as string,
      throwerId: null as string | null,
      throwerName: '' as string,
      pos: new THREE.Vector3(0, 2.0, 0),
      vel: new THREE.Vector3(0, 0, 0),
      curveAccel: 0, // lateral trick curve!
      bounces: 0,
      blazing: false,
      chainBonusSpeed: 0,
      safeSelfTimer: 0,
      holdTimer: 0,
      flightTime: 0,
      botThrowDelay: 0,
    }

    // === LOCAL PLAYER + BOTS ===
    let localRig = createR6Rig({ kit:'court',
      avatar: avatarRef.current,
      username: usernameRef.current,
      clanTag: clanTagRef.current,
      rank: rankNameRef.current,
      showNameplate: false,
      castShadow: qualityRef.current !== 'low',
    })
    let localRigKey = avatarKeyOf(avatarRef.current)
    scene.add(localRig.root)

    const SPAWNS = [
      new THREE.Vector3(0, .45, 13.5),
      new THREE.Vector3(19, 1.1, 6),
      new THREE.Vector3(-6, 1.1, 19),
      new THREE.Vector3(6, 1.1, -19),
      new THREE.Vector3(0, .45, -12),
    ]

    const player = {
      pos: SPAWNS[0].clone(),
      vel: new THREE.Vector3(),
      yaw: 0,
      pitch: 0,
      grounded: false,
      prevGrounded: false,
      coyoteTimer: 0,
      jumpBuffer: 0,
      landDip: 0,
      camShake: 0,
      camRoll: 0,
      alive: true,
      roundWins: 0,
      slices: 0,
      catches: 0,
      catchWindow: 0,
      catchCooldown: 0,
      chargingThrow: false,
      chargeTime: 0,
      emote: null as PlayerPose | null,
      emoteTimer: 0,
      footstepTimer: 0,
      targetHits: 0,
    }

    // === LIVE 3D AIM RICOCHET TRAJECTORY PREVIEW (shows 1st wall bounce when holding Frisbee!) ===
    const aimPreviewGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ])
    const aimPreviewMat = new THREE.LineBasicMaterial({
      color: '#38BDF8',
      transparent: true,
      opacity: 0.72,
    })
    const aimPreviewLine = new THREE.Line(aimPreviewGeo, aimPreviewMat)
    aimPreviewLine.visible = false
    scene.add(aimPreviewLine)

    const aimBounceMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.24, 0.42, 24),
      new THREE.MeshBasicMaterial({ color: '#FACC15', side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
    )
    aimBounceMarker.visible = false
    scene.add(aimBounceMarker)

    const bots: FrisbeeBot[] = FRISBEE_BOTS.map((cfg, idx) => {
      const rig = createR6Rig({ kit:'away',
        avatar: cfg.avatar,
        username: cfg.name,
        rank: 'AI',
        showNameplate: true,
        castShadow: qualityRef.current !== 'low',
      })
      const sp = SPAWNS[(idx + 1) % SPAWNS.length].clone()
      rig.root.position.copy(sp)
      scene.add(rig.root)
      return {
        id: `fbot-${idx}`,
        username: cfg.name,
        pos: sp,
        vel: new THREE.Vector3(),
        rotY: 0,
        grounded: false,
        alive: true,
        rig,
        roundWins: 0,
        slices: 0,
        aiThinkTimer: 0.4 + idx * 0.25,
        moveDir: new THREE.Vector3(1, 0, 0),
        catchCooldown: 0,
      }
    })

    // === MULTIPLAYER CLIENT ===
    const remotePeers = new Map<string, RemotePeer>()
    const mp = new LobbyMultiplayerClient({
      roomId: roomCode,
      world: 'frisbee',
      selfId: playerId,
      onState: (st) => {
        const existing = remotePeers.get(st.id)
        if (!existing) {
          const rig = createR6Rig({ kit:'court',
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
            alive: true,
            speechUntil: 0,
          })
        } else {
          if (avatarKeyOf(existing.state.avatar) !== avatarKeyOf(st.avatar)) {
            scene.remove(existing.rig.root)
            existing.rig.dispose()
            const swapped = createR6Rig({ kit:'court',
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
        if (ev.kind === 'frisbee_throw') {
          const pArr = ev.payload.pos as [number, number, number]
          const vArr = ev.payload.vel as [number, number, number]
          if (Array.isArray(pArr) && Array.isArray(vArr)) {
            frisbee.holderId = null
            frisbee.throwerId = String(ev.payload.throwerId ?? senderId)
            frisbee.throwerName = String(ev.payload.throwerName ?? 'Player')
            frisbee.pos.set(...pArr)
            frisbee.vel.set(...vArr)
            frisbee.curveAccel = Number(ev.payload.curve ?? 0)
            frisbee.bounces = Number(ev.payload.bounces ?? 0)
            frisbee.blazing = Boolean(ev.payload.blazing)
            frisbee.safeSelfTimer = 0.45
            frisbee.flightTime = 0
            trailPts.length = 0
            audioEngine.playFrisbeeThrow(0.4)
          }
        } else if (ev.kind === 'frisbee_catch') {
          frisbee.holderId = String(ev.payload.catcherId ?? senderId)
          frisbee.holderName = String(ev.payload.catcherName ?? 'Player')
          frisbee.blazing = false
          frisbee.vel.set(0, 0, 0)
          frisbee.chainBonusSpeed = Number(ev.payload.bonusSpeed ?? 6)
          frisbee.holdTimer = 0
          audioEngine.playFrisbeeCatch()
          pushFeed(
            langRef.current === 'pl'
              ? `🧤 ${frisbee.holderName} ZŁAPAŁ Frisbee w locie!`
              : `🧤 ${frisbee.holderName} CAUGHT the Frisbee mid-air!`,
            '#34D399',
          )
        } else if (ev.kind === 'frisbee_slice' && ev.payload.targetId === playerId) {
          if (player.alive) {
            player.alive = false
            setAmAlive(false)
            spawnSliceEffect(player.pos)
            audioEngine.playFrisbeeSlice()
            pushFeed(
              langRef.current === 'pl'
                ? `🔥 ${String(ev.payload.killerName ?? 'Rywal')} PRZECIĄŁ Cię Ognistym Frisbee!`
                : `🔥 ${String(ev.payload.killerName ?? 'Rival')} SLICED you with a Blazing Frisbee!`,
              '#EF4444',
            )
          }
        }
      },
    })
    mp.connect()

    // === ROUND & MATCH LIFECYCLE (3 ROUNDS -> FRISBEE KING!) ===
    let currentRound = 1
    let roundTimer = ROUND_TIME_SEC
    let roundPauseTimer = 0

    const giveFrisbeeTo = (id: string, name: string, bonusSpd = 0) => {
      frisbee.holderId = id
      frisbee.holderName = name
      frisbee.vel.set(0, 0, 0)
      frisbee.blazing = false
      frisbee.bounces = 0
      frisbee.curveAccel = 0
      frisbee.chainBonusSpeed = bonusSpd
      frisbee.holdTimer = 0
      frisbee.flightTime = 0
      frisbee.botThrowDelay = 0.85 + Math.random() * 0.9
      trailPts.length = 0
    }

    const startRound = (rNum: number, resetMatchScores = false) => {
      currentRound = rNum
      setRoundNum(rNum)
      roundTimer = ROUND_TIME_SEC
      roundPauseTimer = 0

      if (resetMatchScores) {
        player.roundWins = 0
        setMyRoundWins(0)
        bots.forEach((b) => {
          b.roundWins = 0
        })
      }

      // Reset spawns
      player.pos.copy(SPAWNS[0])
      player.vel.set(0, 0, 0)
      player.alive = true
      setAmAlive(true)

      const useBots = gameModeRef.current === 'match_3r' && botsEnabledRef.current && remotePeers.size < 2
      const candidates: Array<{ id: string; name: string }> = [{ id: playerId, name: usernameRef.current }]
      bots.forEach((b, idx) => {
        b.pos.copy(SPAWNS[(idx + 1) % SPAWNS.length])
        b.vel.set(0, 0, 0)
        b.alive = useBots
        b.rig.root.visible = useBots
        if (useBots) candidates.push({ id: b.id, name: b.username })
      })

      if (gameModeRef.current === 'solo_trick') {
        giveFrisbeeTo(playerId, usernameRef.current, 0)
        soloTargets.forEach((t) => {
          t.active = true
          t.mesh.visible = true
        })
        showBanner(
          langRef.current === 'pl'
            ? '🎯 TRENING TRIKÓW FRISBEE — Odbijaj od ukośnych ścian i podpal dysk!'
            : '🎯 SOLO FRISBEE DRILL — Bank shots off angled walls to ignite the disc!',
          3200,
        )
      } else {
        soloTargets.forEach((t) => {
          t.mesh.visible = false
        })
        // Randomly select ONE player to start with the Frisbee!
        const picked = candidates[Math.floor(Math.random() * candidates.length)]
        giveFrisbeeTo(picked.id, picked.name, 0)
        showBanner(
          langRef.current === 'pl'
            ? `🥏 RUNDA ${rNum}/${TOTAL_ROUNDS} · ${picked.name} wylosował Frisbee!`
            : `🥏 ROUND ${rNum}/${TOTAL_ROUNDS} · ${picked.name} got the Frisbee!`,
          2800,
        )
      }
    }

    // Start Round 1 immediately!
    startRound(1, true)

    // === THROW & CATCH ACTIONS ===
    const performThrow = (
      throwerId: string,
      throwerName: string,
      origin: THREE.Vector3,
      dir: THREE.Vector3,
      curveDir: -1 | 0 | 1,
      charge01 = 0,
      broadcast = false,
    ) => {
      const startSpd = Math.min(
        FRISBEE_MAX_SPEED,
        FRISBEE_BASE_SPEED + charge01 * 11.5 + frisbee.chainBonusSpeed,
      )
      frisbee.holderId = null
      frisbee.holderName = ''
      frisbee.throwerId = throwerId
      frisbee.throwerName = throwerName
      frisbee.pos.copy(origin)
      frisbee.vel.copy(dir).normalize().multiplyScalar(startSpd)
      frisbee.curveAccel = curveDir * 19.5
      frisbee.bounces = 0
      frisbee.blazing = startSpd >= FRISBEE_FIRE_THRESHOLD
      frisbee.chainBonusSpeed = 0
      frisbee.safeSelfTimer = 0.45
      frisbee.flightTime = 0
      trailPts.length = 0

      audioEngine.playFrisbeeThrow(charge01)
      if (frisbee.blazing) audioEngine.playFrisbeeIgnite()

      if (broadcast) {
        mp.broadcastArenaEvent({
          kind: 'frisbee_throw',
          payload: {
            throwerId,
            throwerName,
            pos: [origin.x, origin.y, origin.z],
            vel: [frisbee.vel.x, frisbee.vel.y, frisbee.vel.z],
            curve: frisbee.curveAccel,
            bounces: 0,
            blazing: frisbee.blazing,
          },
        })
      }
    }

    const throwLocalFrisbee = (curveDir: -1 | 0 | 1, charge01 = 0) => {
      if (frisbee.holderId !== playerId || !player.alive) return
      const dir = new THREE.Vector3()
      camera.getWorldDirection(dir)
      const origin = player.pos.clone().add(new THREE.Vector3(0, 2.05, 0)).addScaledVector(dir, 1.3)
      player.camShake = Math.max(player.camShake, 0.1 + charge01 * 0.14)
      performThrow(playerId, usernameRef.current, origin, dir, curveDir, charge01, true)
    }

    const triggerLocalCatch = () => {
      if (!player.alive || frisbee.holderId === playerId) return
      if (player.catchCooldown > 0) return
      player.catchWindow = 0.52
      player.catchCooldown = 0.68
      setCatchWindowActive(true)
      window.setTimeout(() => setCatchWindowActive(false), 520)
    }

    // === BULLETPROOF SUB-STEPPED SEALED ARENA COLLISION (AXIAL X -> Z -> SOLID OBB -> Y + AUTO-STEP!) ===
    const resolvePlayerPhysics = (
      pos: THREE.Vector3,
      vel: THREE.Vector3,
      dt: number,
    ): { grounded: boolean; landedImpact: number } => {
      const subSteps = Math.max(1, Math.min(5, Math.ceil(dt / 0.0085)))
      const sdt = dt / subSteps
      let grounded = false
      let landedImpact = 0
      const STEP_HEIGHT = 0.54
      const lim = ARENA_HALF - PLAYER_RADIUS

      for (let step = 0; step < subSteps; step++) {
        vel.y -= GRAVITY * sdt

        // --- AXIS 1: X (smooth wall-slide + auto step-up) ---
        const prevX = pos.x
        pos.x += vel.x * sdt
        for (const b of boxes) {
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
              pos.x = prevX <= b.cx ? minX : maxX
              vel.x = 0
            }
          }
        }
        if (pos.x < -lim) {
          pos.x = -lim
          vel.x = 0
        } else if (pos.x > lim) {
          pos.x = lim
          vel.x = 0
        }

        // --- AXIS 2: Z (smooth wall-slide + auto step-up) ---
        const prevZ = pos.z
        pos.z += vel.z * sdt
        for (const b of boxes) {
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
              pos.z = prevZ <= b.cz ? minZ : maxZ
              vel.z = 0
            }
          }
        }
        if (pos.z < -lim) {
          pos.z = -lim
          vel.z = 0
        } else if (pos.z > lim) {
          pos.z = lim
          vel.z = 0
        }

        // --- AXIS 2.5: TRUE SOLID CIRCLE-VS-OBB FOR 45° CORNER & BANK WALLS (ZERO GLITCHING!) ---
        for (const obb of angledObbs) {
          if (pos.y >= obb.maxY || pos.y + PLAYER_HEIGHT <= obb.minY) continue
          const dx = pos.x - obb.cx
          const dz = pos.z - obb.cz
          // Transform player center into OBB local frame (inverse of Three.js Y-rotation)
          const lx = dx * obb.cosR - dz * obb.sinR
          const lz = dx * obb.sinR + dz * obb.cosR
          const clx = THREE.MathUtils.clamp(lx, -obb.halfW, obb.halfW)
          const clz = THREE.MathUtils.clamp(lz, -obb.halfD, obb.halfD)
          let ox = lx - clx
          let oz = lz - clz
          const distSq = ox * ox + oz * oz
          if (distSq < PLAYER_RADIUS * PLAYER_RADIUS) {
            let pushLocalX = 0
            let pushLocalZ = 0
            if (distSq > 1e-6) {
              const dist = Math.sqrt(distSq)
              const pen = PLAYER_RADIUS - dist
              pushLocalX = (ox / dist) * pen
              pushLocalZ = (oz / dist) * pen
            } else {
              // Deep inside fallback: eject out nearest face
              const penX = obb.halfW - Math.abs(lx)
              const penZ = obb.halfD - Math.abs(lz)
              if (penZ <= penX) {
                pushLocalZ = (lz >= 0 ? 1 : -1) * (penZ + PLAYER_RADIUS)
              } else {
                pushLocalX = (lx >= 0 ? 1 : -1) * (penX + PLAYER_RADIUS)
              }
            }
            // Rotate push normal back into world space
            const pushWx = pushLocalX * obb.cosR + pushLocalZ * obb.sinR
            const pushWz = -pushLocalX * obb.sinR + pushLocalZ * obb.cosR
            pos.x += pushWx
            pos.z += pushWz
            // Cancel inward velocity component so player slides smoothly along the 45° wall!
            const pLen = Math.hypot(pushWx, pushWz)
            if (pLen > 1e-5) {
              const nx = pushWx / pLen
              const nz = pushWz / pLen
              const vn = vel.x * nx + vel.z * nz
              if (vn < 0) {
                vel.x -= vn * nx
                vel.z -= vn * nz
              }
            }
          }
        }

        // --- AXIS 3: Y (floor, ceiling, box decks & smooth walkable ramps!) ---
        const prevY = pos.y
        pos.y += vel.y * sdt
        let stepGrounded = false

        for (const r of ramps) {
          if (pos.x >= r.minX - 0.32 && pos.x <= r.maxX + 0.32 && pos.z >= r.minZ - 0.32 && pos.z <= r.maxZ + 0.32) {
            const t =
              r.axis === 'z'
                ? THREE.MathUtils.clamp((pos.z - r.minZ) / Math.max(0.01, r.maxZ - r.minZ), 0, 1)
                : THREE.MathUtils.clamp((pos.x - r.minX) / Math.max(0.01, r.maxX - r.minX), 0, 1)
            const rampY = THREE.MathUtils.lerp(r.yStart, r.yEnd, t)
            if (pos.y <= rampY + 0.54 && prevY >= rampY - 0.85 && vel.y <= 3.5) {
              if (vel.y < -4) landedImpact = Math.max(landedImpact, Math.min(1, -vel.y / 22))
              pos.y = rampY
              vel.y = 0
              stepGrounded = true
            }
          }
        }

        for (const b of boxes) {
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
        if (pos.y + PLAYER_HEIGHT >= ARENA_HEIGHT) {
          pos.y = ARENA_HEIGHT - PLAYER_HEIGHT
          if (vel.y > 0) vel.y = 0
        }

        if (stepGrounded) grounded = true

        // Corner Jump Pads
        for (const jp of jumpPads) {
          if (pos.y < 1.15 && Math.hypot(pos.x - jp.x, pos.z - jp.z) < 1.9) {
            vel.y = 20.8
            grounded = false
            audioEngine.playJumpPad()
          }
        }
      }

      return { grounded, landedImpact }
    }

    // === INPUT LISTENERS ===
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
      else if (e.code === 'KeyE') {
        if (frisbee.holderId === playerId) throwLocalFrisbee(1, 0.35) // Curve Right!
        else triggerLocalCatch()
      } else if (e.code === 'KeyQ') {
        if (frisbee.holderId === playerId) throwLocalFrisbee(-1, 0.35) // Curve Left!
      } else if (e.code === 'KeyR' && gameModeRef.current === 'solo_trick') {
        giveFrisbeeTo(playerId, usernameRef.current, 0)
        audioEngine.playFrisbeeCatch()
      } else if (e.code === 'KeyI') {
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
      player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * sens, -1.38, 1.38)
    }

    const onMouseDown = (e: MouseEvent) => {
      if (menuOpenRef.current || wardrobeOpenRef.current || chatOpenRef.current || emoteWheelOpenRef.current) return
      audioEngine.unlock()
      if (document.pointerLockElement !== renderer.domElement) {
        if (clickToLockRef.current && !isTouchDevice) requestLock()
        return
      }
      if (e.button === 0) {
        if (frisbee.holderId === playerId) {
          player.chargingThrow = true
          player.chargeTime = 0
        }
      } else if (e.button === 2) {
        if (frisbee.holderId === playerId) {
          // Right click while holding = Trick Curve Throw!
          throwLocalFrisbee(1, 0.4)
        } else {
          // Right click when frisbee is flying = CATCH!
          triggerLocalCatch()
        }
      }
    }

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0 && player.chargingThrow) {
        const ch = Math.min(1, player.chargeTime / 0.65)
        player.chargingThrow = false
        player.chargeTime = 0
        setChargePct(0)
        throwLocalFrisbee(0, ch)
      }
    }

    // === MULTI-TOUCH & DRAG CAMERA LOOK (Full 360° touch aiming on phones & tablets!) ===
    let lookPointerId: number | null = null
    let lastLookX = 0
    let lastLookY = 0

    const onPointerDown = (e: PointerEvent) => {
      if (menuOpenRef.current || wardrobeOpenRef.current || chatOpenRef.current || emoteWheelOpenRef.current) return
      audioEngine.unlock()
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
      player.pitch = THREE.MathUtils.clamp(player.pitch - dy * touchSens, -1.38, 1.38)
    }

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId === lookPointerId) {
        lookPointerId = null
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
    window.addEventListener('mouseup', onMouseUp)
    renderer.domElement.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('pointerlockchange', onPointerLockChange)

    const onResize = () => {
      if (!container) return
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight)
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', onResize)

    actionsRef.current = {
      throwFrisbee: throwLocalFrisbee,
      attemptCatch: triggerLocalCatch,
      recallSoloFrisbee: () => {
        giveFrisbeeTo(playerId, usernameRef.current, 0)
        audioEngine.playFrisbeeCatch()
      },
      switchMode: (mode) => {
        setGameMode(mode)
        gameModeRef.current = mode
        startRound(1, true)
      },
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
      respawn: () => startRound(currentRound, false),
    }

    // === MAIN GAMEPLAY LOOP ===
    let rafId = 0
    let lastTime = performance.now()
    let elapsed = 0
    let lastBroadcast = 0
    let lastHudSync = 0
    let fpsFrames = 0
    let fpsTimer = performance.now()
    const camRaycaster = new THREE.Raycaster()
    const aimRaycaster = new THREE.Raycaster()
    const tmpAimOrigin = new THREE.Vector3()
    const tmpAimDir = new THREE.Vector3()
    const tmpAimHit = new THREE.Vector3()
    const tmpAimNormal = new THREE.Vector3()
    const tmpAimRefl = new THREE.Vector3()
    const tmpAimEnd = new THREE.Vector3()
    const tmpCamOrigin = new THREE.Vector3()
    const tmpCamDir = new THREE.Vector3()
    const tmpDesiredCam = new THREE.Vector3()
    const tmpEyePos = new THREE.Vector3()
    const tmpCamEuler = new THREE.Euler(0, 0, 0, 'YXZ')
    let smoothCamDist = 6.2

    const applyFrisbeeBounce = (normal: THREE.Vector3, contactPt: THREE.Vector3) => {
      const dot = frisbee.vel.dot(normal)
      if (dot >= 0) return
      frisbee.vel.addScaledVector(normal, -2 * dot)
      // Every ricochet accelerates the frisbee toward BLAZING FIRE!
      const curSpd = frisbee.vel.length()
      const nextSpd = Math.min(FRISBEE_MAX_SPEED, Math.max(FRISBEE_BASE_SPEED, curSpd * 1.24))
      frisbee.vel.normalize().multiplyScalar(nextSpd)
      frisbee.bounces += 1
      frisbee.curveAccel *= 0.65

      const wasBlazing = frisbee.blazing
      if (nextSpd >= FRISBEE_FIRE_THRESHOLD) {
        frisbee.blazing = true
        if (!wasBlazing) {
          audioEngine.playFrisbeeIgnite()
          pushFeed(
            langRef.current === 'pl'
              ? `🔥 FRISBEE ZAPŁONĘŁO OGNIEM! (${Math.round(nextSpd * 3.6)} km/h — PRZECINA RYWALI!)`
              : `🔥 FRISBEE IGNITED IN FLAMES! (${Math.round(nextSpd * 3.6)} km/h — LETHAL SLICE!)`,
            '#F97316',
          )
        }
      }
      audioEngine.playFrisbeeBounce(frisbee.bounces, frisbee.blazing)
      spawnBounceRing(contactPt, normal, frisbee.blazing)
    }

    const finishRound = (winnerId: string | null, winnerName: string) => {
      if (roundPauseTimer > 0) return
      roundPauseTimer = 3.2
      if (winnerId === playerId) {
        player.roundWins += 1
        setMyRoundWins(player.roundWins)
      } else {
        const b = bots.find((x) => x.id === winnerId)
        if (b) b.roundWins += 1
      }

      if (currentRound >= TOTAL_ROUNDS) {
        // Crown FRISBEE KING after 3 rounds!
        const topBot = bots.reduce((best, b) => (b.roundWins > best.roundWins ? b : best), bots[0])
        const playerWonMatch = player.roundWins >= (topBot?.roundWins ?? 0) && player.roundWins > 0
        if (playerWonMatch) {
          onFrisbeeProgressRef.current({ matchWin: true })
          audioEngine.playQuestClaim()
        }
        const kingName = playerWonMatch ? usernameRef.current : topBot?.username ?? winnerName
        showBanner(
          langRef.current === 'pl'
            ? `👑 FRISBEE KING: ${kingName}! (${player.roundWins} wygr. rund) · Nowy mecz za 3s!`
            : `👑 FRISBEE KING: ${kingName}! (${player.roundWins} rounds won) · New match in 3s!`,
          3400,
        )
      } else {
        showBanner(
          langRef.current === 'pl'
            ? `🏆 Runda ${currentRound}/${TOTAL_ROUNDS} dla: ${winnerName}! Następna runda…`
            : `🏆 Round ${currentRound}/${TOTAL_ROUNDS} won by ${winnerName}! Next round…`,
          2800,
        )
      }
    }

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

      // Dynamic FOV handled smoothly in camera section below
      const isNight = worldTimeRef.current === 'night'
      if(stadiumNight!==isNight){stadiumNight=isNight;stadium.setNight(isNight)}
      hemi.intensity = isNight ? 0.6 : 1.05
      dirLight.intensity = isNight ? 0.68 : 1.2

      // Avatar live hot-swap
      const avKey = avatarKeyOf(avatarRef.current)
      if (avKey !== localRigKey) {
        scene.remove(localRig.root)
        localRig.dispose()
        localRig = createR6Rig({ kit:'court',
          avatar: avatarRef.current,
          username: usernameRef.current,
          clanTag: clanTagRef.current,
          rank: rankNameRef.current,
          showNameplate: false,
          castShadow: qualityRef.current !== 'low',
        })
        localRigKey = avKey
        scene.add(localRig.root)
      }

      // Cooldowns & Throw Charging
      player.catchWindow = Math.max(0, player.catchWindow - dt)
      player.catchCooldown = Math.max(0, player.catchCooldown - dt)
      if (player.chargingThrow && frisbee.holderId === playerId) {
        player.chargeTime = Math.min(0.65, player.chargeTime + dt)
        setChargePct(Math.round((player.chargeTime / 0.65) * 100))
      }
      if (player.emoteTimer > 0) {
        player.emoteTimer -= dt
        if (player.emoteTimer <= 0) player.emote = null
      }

      // === 1. LOCAL PLAYER MOVEMENT (Even as spectator if sliced, you can move/watch!) ===
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
      let wx = fwdX * moveFwd + rgtX * moveRight
      let wz = fwdZ * moveFwd + rgtZ * moveRight
      const wLen = Math.hypot(wx, wz)
      if (wLen > 1) {
        wx /= wLen
        wz /= wLen
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

      if (player.grounded) {
        player.vel.x += (wx * maxSpd - player.vel.x) * Math.min(1, dt * 12.5)
        player.vel.z += (wz * maxSpd - player.vel.z) * Math.min(1, dt * 12.5)
      } else {
        player.vel.x += wx * 24 * dt
        player.vel.z += wz * 24 * dt
      }
      if (player.jumpBuffer > 0 && player.coyoteTimer > 0) {
        player.vel.y = JUMP_VEL
        player.grounded = false
        player.coyoteTimer = 0
        player.jumpBuffer = 0
        audioEngine.playJump()
      }

      player.prevGrounded = player.grounded
      const pPhys = resolvePlayerPhysics(player.pos, player.vel, dt)
      player.grounded = pPhys.grounded
      if (!player.prevGrounded && player.grounded && pPhys.landedImpact > 0.08) {
        audioEngine.playLand(pPhys.landedImpact)
        player.landDip = Math.max(player.landDip, pPhys.landedImpact * 0.24)
      }
      player.landDip = THREE.MathUtils.lerp(player.landDip, 0, Math.min(1, dt * 13))
      player.camShake = Math.max(0, player.camShake - dt * 1.6)
      player.camRoll = THREE.MathUtils.lerp(player.camRoll, -moveRight * 0.022, Math.min(1, dt * 10))

      const horizSpd = Math.hypot(player.vel.x, player.vel.z)
      if (player.grounded && horizSpd > 2.2) {
        player.footstepTimer -= dt
        if (player.footstepTimer <= 0) {
          player.footstepTimer = sprint ? 0.25 : 0.36
          audioEngine.playFootstep('metal', sprint)
        }
      }

      // === 2. FRISBEE PHYSICS, CURVE, RICOCHET, IGNITE, CATCH & SLICE! ===
      const modeNow = gameModeRef.current
      if (frisbee.holderId) {
        // Attached to holder
        frisbee.holdTimer += dt
        if (frisbee.holderId === playerId) {
          const dir = new THREE.Vector3()
          camera.getWorldDirection(dir)
          frisbee.pos.copy(player.pos).add(new THREE.Vector3(0, 1.9, 0)).addScaledVector(dir, 1.0)
          // Auto-throw after 8s in competitive match so rounds stay snappy!
          if (modeNow === 'match_3r' && frisbee.holdTimer >= 8.0) {
            throwLocalFrisbee(0, 0.25)
          }
        } else {
          const holderBot = bots.find((b) => b.id === frisbee.holderId)
          if (holderBot && holderBot.alive) {
            frisbee.pos.copy(holderBot.pos).add(new THREE.Vector3(0, 1.9, 0))
            frisbee.botThrowDelay -= dt
            if (frisbee.botThrowDelay <= 0) {
              // Bot aims at nearest alive target OR banks off a wall for a trick shot!
              const targets: THREE.Vector3[] = []
              if (player.alive) targets.push(player.pos.clone().add(new THREE.Vector3(0, 1.4, 0)))
              bots.forEach((ob) => {
                if (ob.id !== holderBot.id && ob.alive) targets.push(ob.pos.clone().add(new THREE.Vector3(0, 1.4, 0)))
              })
              let aimDir = new THREE.Vector3(Math.random() - 0.5, 0.08, Math.random() - 0.5).normalize()
              if (targets.length > 0) {
                const tPos = targets[Math.floor(Math.random() * targets.length)]
                aimDir = tPos.clone().sub(frisbee.pos).normalize()
                // 35% chance bot banks it off a side wall for a fiery ricochet!
                if (Math.random() < 0.35) {
                  aimDir.x += (Math.random() - 0.5) * 0.9
                  aimDir.y = (Math.random() - 0.3) * 0.25
                  aimDir.normalize()
                }
              }
              const curveChoice: -1 | 0 | 1 = Math.random() < 0.33 ? -1 : Math.random() < 0.5 ? 1 : 0
              performThrow(holderBot.id, holderBot.username, frisbee.pos.clone().addScaledVector(aimDir, 1.25), aimDir, curveChoice, 0.3, false)
            }
          } else {
            const rp = remotePeers.get(frisbee.holderId)
            if (rp) frisbee.pos.copy(rp.currentPos).add(new THREE.Vector3(0, 1.9, 0))
          }
        }
      } else {
        // FREE-FLYING FRISBEE!
        frisbee.safeSelfTimer = Math.max(0, frisbee.safeSelfTimer - dt)
        frisbee.flightTime += dt

        // Apply lateral Curve Trick force (perpendicular to horizontal flight!)
        if (Math.abs(frisbee.curveAccel) > 0.1) {
          const hLen = Math.hypot(frisbee.vel.x, frisbee.vel.z)
          if (hLen > 1) {
            const perpX = -frisbee.vel.z / hLen
            const perpZ = frisbee.vel.x / hLen
            frisbee.vel.x += perpX * frisbee.curveAccel * dt
            frisbee.vel.z += perpZ * frisbee.curveAccel * dt
          }
        }

        // Gradual in-flight acceleration if already spinning fast
        const spdNow = frisbee.vel.length()
        if (spdNow > 5 && spdNow < FRISBEE_MAX_SPEED) {
          frisbee.vel.multiplyScalar(1 + dt * 0.085)
          if (!frisbee.blazing && frisbee.vel.length() >= FRISBEE_FIRE_THRESHOLD) {
            frisbee.blazing = true
            audioEngine.playFrisbeeIgnite()
          }
        }

        // Sub-step movement (2 substeps) so fast blazing frisbee NEVER tunnels through walls!
        const subDt = dt / 2
        for (let s = 0; s < 2; s++) {
          frisbee.pos.addScaledVector(frisbee.vel, subDt)

          // Outer sealed box walls
          const lim = ARENA_HALF - 0.82
          if (frisbee.pos.x < -lim) {
            frisbee.pos.x = -lim
            applyFrisbeeBounce(new THREE.Vector3(1, 0, 0), frisbee.pos)
          } else if (frisbee.pos.x > lim) {
            frisbee.pos.x = lim
            applyFrisbeeBounce(new THREE.Vector3(-1, 0, 0), frisbee.pos)
          }
          if (frisbee.pos.z < -lim) {
            frisbee.pos.z = -lim
            applyFrisbeeBounce(new THREE.Vector3(0, 0, 1), frisbee.pos)
          } else if (frisbee.pos.z > lim) {
            frisbee.pos.z = lim
            applyFrisbeeBounce(new THREE.Vector3(0, 0, -1), frisbee.pos)
          }
          if (frisbee.pos.y < 0.72) {
            frisbee.pos.y = 0.72
            applyFrisbeeBounce(new THREE.Vector3(0, 1, 0), frisbee.pos)
          } else if (frisbee.pos.y > ARENA_HEIGHT - 0.72) {
            frisbee.pos.y = ARENA_HEIGHT - 0.72
            applyFrisbeeBounce(new THREE.Vector3(0, -1, 0), frisbee.pos)
          }

          // 45° Corner Bank Walls!
          for (const aw of angledWalls) {
            const rel = frisbee.pos.clone().sub(aw.point)
            const d = rel.dot(aw.normal)
            if (d < 0.85 && d > -0.75 && frisbee.pos.y >= aw.minY && frisbee.pos.y <= aw.maxY) {
              const tang = new THREE.Vector3(-aw.normal.z, 0, aw.normal.x)
              if (Math.abs(rel.dot(tang)) <= aw.halfWidth + 0.5) {
                frisbee.pos.addScaledVector(aw.normal, 0.86 - d)
                applyFrisbeeBounce(aw.normal, frisbee.pos)
              }
            }
          }

          // Internal Winding Walls & Decks
          for (const b of boxes) {
            const r = 0.76
            const minX = b.cx - b.hx - r
            const maxX = b.cx + b.hx + r
            const minY = b.cy - b.hy - 0.25
            const maxY = b.cy + b.hy + 0.25
            const minZ = b.cz - b.hz - r
            const maxZ = b.cz + b.hz + r
            if (
              frisbee.pos.x > minX &&
              frisbee.pos.x < maxX &&
              frisbee.pos.y > minY &&
              frisbee.pos.y < maxY &&
              frisbee.pos.z > minZ &&
              frisbee.pos.z < maxZ
            ) {
              const pL = frisbee.pos.x - minX
              const pR = maxX - frisbee.pos.x
              const pD = frisbee.pos.y - minY
              const pU = maxY - frisbee.pos.y
              const pF = frisbee.pos.z - minZ
              const pB = maxZ - frisbee.pos.z
              const m = Math.min(pL, pR, pD, pU, pF, pB)
              if (m === pL) {
                frisbee.pos.x = minX
                applyFrisbeeBounce(new THREE.Vector3(-1, 0, 0), frisbee.pos)
              } else if (m === pR) {
                frisbee.pos.x = maxX
                applyFrisbeeBounce(new THREE.Vector3(1, 0, 0), frisbee.pos)
              } else if (m === pD) {
                frisbee.pos.y = minY
                applyFrisbeeBounce(new THREE.Vector3(0, -1, 0), frisbee.pos)
              } else if (m === pU) {
                frisbee.pos.y = maxY
                applyFrisbeeBounce(new THREE.Vector3(0, 1, 0), frisbee.pos)
              } else if (m === pF) {
                frisbee.pos.z = minZ
                applyFrisbeeBounce(new THREE.Vector3(0, 0, -1), frisbee.pos)
              } else {
                frisbee.pos.z = maxZ
                applyFrisbeeBounce(new THREE.Vector3(0, 0, 1), frisbee.pos)
              }
            }
          }
        }

        // Trail points update
        trailPts.push(frisbee.pos.clone())
        if (trailPts.length > (frisbee.blazing ? 26 : 16)) trailPts.shift()
        for(let i=0;i<trailPts.length;i++){const p=trailPts[i],w=.02+.22*i/trailPts.length;trailAttr.setXYZ(2*i,p.x,p.y-w,p.z);trailAttr.setXYZ(2*i+1,p.x,p.y+w,p.z)}
        trailAttr.needsUpdate=true;trailGeo.setDrawRange(0,Math.max(0,trailPts.length-1)*6)

        // === CATCH & SLICE COLLISIONS WITH LOCAL PLAYER ===
        if (player.alive) {
          const pChest = player.pos.clone().add(new THREE.Vector3(0, 1.4, 0))
          const distToMe = pChest.distanceTo(frisbee.pos)
          const selfSafe = frisbee.throwerId === playerId && frisbee.safeSelfTimer > 0

          // 1) CATCH BEFORE IT IGNITES! (PPM or E when blue/cool & within 5.4m!)
          if (!frisbee.blazing && !selfSafe && player.catchWindow > 0 && distToMe < 5.4) {
            const bonus = Math.min(13, Math.max(4, (frisbee.vel.length() - FRISBEE_BASE_SPEED) * 0.65 + 5))
            giveFrisbeeTo(playerId, usernameRef.current, bonus)
            player.catches += 1
            player.camShake = Math.max(player.camShake, 0.14)
            setMyCatches(player.catches)
            onFrisbeeProgressRef.current({ catchesDelta: 1 })
            audioEngine.playFrisbeeCatch()
            pushFeed(
              langRef.current === 'pl'
                ? `🧤 ZŁAPAŁEŚ Frisbee w locie! (+${Math.round(bonus * 3.6)} km/h mocy do kontrataku!)`
                : `🧤 MID-AIR CATCH! (+${Math.round(bonus * 3.6)} km/h counter-throw boost!)`,
              '#34D399',
            )
            mp.broadcastArenaEvent({
              kind: 'frisbee_catch',
              payload: { catcherId: playerId, catcherName: usernameRef.current, bonusSpeed: bonus },
            })
          } else if (!selfSafe && distToMe < 1.55) {
            if (frisbee.blazing && modeNow !== 'solo_trick') {
              // SLICED IN HALF BY BLAZING FRISBEE!
              player.alive = false
              setAmAlive(false)
              spawnSliceEffect(player.pos)
              audioEngine.playFrisbeeSlice()
              pushFeed(
                langRef.current === 'pl'
                  ? `🔥 ${frisbee.throwerName} PRZECIĄŁ Cię Ognistym Frisbee!`
                  : `🔥 ${frisbee.throwerName} SLICED you with a Blazing Frisbee!`,
                '#EF4444',
              )
              // Cool down & hand frisbee to thrower or random survivor
              frisbee.flightTime = 99
            } else if (!frisbee.blazing) {
              // Cool frisbee bumps you & ricochets away faster!
              const push = pChest.clone().sub(frisbee.pos).normalize()
              player.vel.addScaledVector(push, 10)
              applyFrisbeeBounce(push.negate(), frisbee.pos)
            }
          }
        }

        // === CATCH & SLICE COLLISIONS WITH BOTS ===
        if (!frisbee.holderId && modeNow === 'match_3r' && botsEnabledRef.current) {
          for (const bot of bots) {
            if (!bot.alive) continue
            const bChest = bot.pos.clone().add(new THREE.Vector3(0, 1.4, 0))
            const dBot = bChest.distanceTo(frisbee.pos)
            const botSelfSafe = frisbee.throwerId === bot.id && frisbee.safeSelfTimer > 0
            if (botSelfSafe) continue

            // Bot tries to catch non-blazing frisbee!
            if (!frisbee.blazing && dBot < 3.6 && bot.catchCooldown <= 0 && Math.random() < 0.34) {
              bot.catchCooldown = 2.0
              giveFrisbeeTo(bot.id, bot.username, 6)
              audioEngine.playFrisbeeCatch()
              pushFeed(
                langRef.current === 'pl'
                  ? `🧤 ${bot.username} złapał Frisbee przed rozpaleniem!`
                  : `🧤 ${bot.username} caught the Frisbee before ignition!`,
                '#34D399',
              )
              break
            } else if (dBot < 1.65) {
              if (frisbee.blazing) {
                // BOT SLICED IN HALF!!
                bot.alive = false
                bot.rig.root.visible = false
                spawnSliceEffect(bot.pos)
                audioEngine.playFrisbeeSlice()
                if (frisbee.throwerId === playerId) {
                  player.slices += 1
                  setMySlices(player.slices)
                  onFrisbeeProgressRef.current({
                    slicesDelta: 1,
                    trickSlice: frisbee.bounces >= 2,
                  })
                }
                pushFeed(
                  langRef.current === 'pl'
                    ? `🔥 ${frisbee.throwerName} PRZECIĄŁ ${bot.username}${frisbee.bounces >= 2 ? ` (×${frisbee.bounces} TRIK!)` : '!'}`
                    : `🔥 ${frisbee.throwerName} SLICED ${bot.username}${frisbee.bounces >= 2 ? ` (×${frisbee.bounces} TRICK!)` : '!'}`,
                  '#F97316',
                )
                // Reassign frisbee to random alive player after brief slice
                frisbee.flightTime = 99
                break
              } else {
                const push = bChest.clone().sub(frisbee.pos).normalize()
                bot.vel.addScaledVector(push, 9)
                applyFrisbeeBounce(push.negate(), frisbee.pos)
              }
            }
          }
        }

        // === SOLO TRICK TARGETS ===
        if (!frisbee.holderId && modeNow === 'solo_trick') {
          for (const st of soloTargets) {
            if (!st.active) continue
            if (frisbee.pos.distanceTo(st.pos) < 1.85) {
              st.active = false
              st.mesh.visible = false
              st.respawnTimer = 4.0
              player.targetHits += 1
              setSoloTargetsHit(player.targetHits)
              spawnSliceEffect(st.pos, frisbee.blazing ? 0xef4444 : 0x38bdf8)
              audioEngine.playFrisbeeSlice()
              pushFeed(
                langRef.current === 'pl'
                  ? `🎯 Cel #${st.id + 1} ${frisbee.blazing ? 'PRZECIĘTY OGNIEM!' : 'trafiony!'} (×${frisbee.bounces} odbić)`
                  : `🎯 Target #${st.id + 1} ${frisbee.blazing ? 'BLAZE-SLICED!' : 'hit!'} (×${frisbee.bounces} bounces)`,
                frisbee.blazing ? '#F97316' : '#38BDF8',
              )
            }
          }
        }

        // After 10.5s flight (or post-slice reset), return Frisbee to an alive player so action never stalls!
        if (!frisbee.holderId && frisbee.flightTime > 10.5) {
          if (modeNow === 'solo_trick') {
            giveFrisbeeTo(playerId, usernameRef.current, 0)
            audioEngine.playFrisbeeCatch()
          } else {
            const aliveList: Array<{ id: string; name: string }> = []
            if (player.alive) aliveList.push({ id: playerId, name: usernameRef.current })
            bots.forEach((b) => {
              if (b.alive) aliveList.push({ id: b.id, name: b.username })
            })
            if (aliveList.length > 0) {
              const pick = aliveList[Math.floor(Math.random() * aliveList.length)]
              giveFrisbeeTo(pick.id, pick.name, 0)
            }
          }
        }
      }

      // === 3. BOTS AI MOVEMENT ===
      const useBots = modeNow === 'match_3r' && botsEnabledRef.current && remotePeers.size < 2
      for (const bot of bots) {
        if (!useBots || !bot.alive) {
          bot.rig.root.visible = false
          continue
        }
        bot.rig.root.visible = true
        bot.catchCooldown = Math.max(0, bot.catchCooldown - dt)
        bot.aiThinkTimer -= dt
        if (bot.aiThinkTimer <= 0) {
          bot.aiThinkTimer = 0.55 + Math.random() * 0.75
          if (!frisbee.holderId && frisbee.blazing && bot.pos.distanceTo(frisbee.pos) < 15) {
            // Evade blazing frisbee perpendicular to its velocity!
            bot.moveDir.set(-frisbee.vel.z, 0, frisbee.vel.x).normalize().multiplyScalar(Math.random() < 0.5 ? 1 : -1)
            if (bot.grounded) {
              bot.vel.y = JUMP_VEL
              bot.grounded = false
            }
          } else {
            const angle = Math.random() * Math.PI * 2
            bot.moveDir.set(Math.cos(angle), 0, Math.sin(angle))
            if (bot.grounded && Math.random() < 0.28) {
              bot.vel.y = JUMP_VEL * 0.92
              bot.grounded = false
            }
          }
        }
        if (bot.grounded) {
          bot.vel.x += (bot.moveDir.x * 10.6 - bot.vel.x) * Math.min(1, dt * 6)
          bot.vel.z += (bot.moveDir.z * 10.6 - bot.vel.z) * Math.min(1, dt * 6)
        }
        bot.grounded = resolvePlayerPhysics(bot.pos, bot.vel, dt).grounded
        bot.rotY = Math.atan2(bot.vel.x, bot.vel.z)
        bot.rig.root.position.copy(bot.pos)
        bot.rig.root.rotation.y = bot.rotY
        bot.rig.update(dt, elapsed, !bot.grounded ? 'jump' : Math.hypot(bot.vel.x, bot.vel.z) > 1.5 ? 'run' : 'idle')
      }

      // === 4. SOLO TARGETS ANIMATION ===
      if (modeNow === 'solo_trick') {
        for (const st of soloTargets) {
          if (!st.active) {
            st.respawnTimer -= dt
            if (st.respawnTimer <= 0) {
              st.active = true
              st.mesh.visible = true
            }
            continue
          }
          st.pos.copy(st.basePos)
          st.pos.y += Math.sin(elapsed * 2.2 + st.id) * 0.9
          st.mesh.position.copy(st.pos)
          st.mesh.rotation.y = elapsed * 2.0
        }
      }

      // === 5. 3-ROUND MATCH CHECK ===
      if (modeNow === 'match_3r') {
        if (roundPauseTimer > 0) {
          roundPauseTimer -= dt
          if (roundPauseTimer <= 0) {
            if (currentRound >= TOTAL_ROUNDS) startRound(1, true)
            else startRound(currentRound + 1, false)
          }
        } else {
          roundTimer -= dt
          const aliveActors: Array<{ id: string; name: string }> = []
          if (player.alive) aliveActors.push({ id: playerId, name: usernameRef.current })
          if (useBots) {
            bots.forEach((b) => {
              if (b.alive) aliveActors.push({ id: b.id, name: b.username })
            })
          }
          setAliveCount(aliveActors.length)

          if (useBots && aliveActors.length <= 1) {
            const w = aliveActors[0]
            finishRound(w?.id ?? null, w?.name ?? 'Remis')
          } else if (roundTimer <= 0) {
            const w = aliveActors[0]
            finishRound(w?.id ?? null, w?.name ?? usernameRef.current)
          }
        }
      }

      // === 6. REMOTE PEERS INTERPOLATION ===
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
        if (!frisbee.holderId && frisbee.blazing && frisbee.throwerId === playerId) {
          if (peer.currentPos.clone().add(new THREE.Vector3(0, 1.4, 0)).distanceTo(frisbee.pos) < 1.75) {
            mp.broadcastArenaEvent({
              kind: 'frisbee_slice',
              payload: { targetId: id, killerName: usernameRef.current },
            })
            spawnSliceEffect(peer.currentPos)
            audioEngine.playFrisbeeSlice()
            player.slices += 1
            setMySlices(player.slices)
            onFrisbeeProgressRef.current({ slicesDelta: 1, trickSlice: frisbee.bounces >= 2 })
            frisbee.flightTime = 99
          }
        }
      }

      // === 7. FRISBEE VISUALS (COOL CYAN vs BLAZING FIRE!) ===
      trailLine.visible=!frisbee.holderId
      frisbeeGroup.position.copy(frisbee.pos)
      frisbeeGroup.rotation.y += dt * (frisbee.blazing ? 26 : 13)
      frisbeeGroup.visible = !(frisbee.holderId === playerId && cameraViewRef.current === 'fpp')
      if (frisbee.blazing) {
        discBodyMat.color.set('#EF4444')
        discBodyMat.emissive.set('#F97316')
        discBodyMat.emissiveIntensity = 2.2
        discRimMat.color.set('#FEF08A')
        discRimMat.emissive.set('#FACC15')
        fireHalo.visible = true
        fireHalo.scale.setScalar(1.0 + Math.sin(elapsed * 26) * 0.14)
        fireLight.color.set('#F97316')
        fireLight.intensity = 3.5
        trailMat.color.set('#F97316')
        catchRing.visible = false
      } else {
        discBodyMat.color.set('#ff9b2c')
        discBodyMat.emissive.set('#ff8121')
        discBodyMat.emissiveIntensity = 1.15
        discRimMat.color.set('#fff4aa')
        discRimMat.emissive.set('#ffdb66')
        fireHalo.visible = false
        fireLight.color.set('#ffad32')
        fireLight.intensity = 2.0
        trailMat.color.set('#ffd367')
        catchRing.visible = !frisbee.holderId
        catchRing.scale.setScalar(1 + Math.sin(elapsed * 10) * 0.12)
      }

      // Update Slice FX (two sliced halves splitting apart!) & Bounce Rings
      for (let i = sliceFxs.length - 1; i >= 0; i--) {
        const fx = sliceFxs[i]
        fx.age += dt
        if (fx.age > 1.1) {
          scene.remove(fx.topHalf, fx.botHalf, fx.ring)
          sliceFxs.splice(i, 1)
          continue
        }
        fx.velTop.y -= 18 * dt
        fx.velBot.y -= 18 * dt
        fx.topHalf.position.addScaledVector(fx.velTop, dt)
        fx.topHalf.rotation.x += dt * 7
        fx.topHalf.rotation.z += dt * 5
        fx.botHalf.position.addScaledVector(fx.velBot, dt)
        fx.botHalf.rotation.y += dt * 4
        fx.ring.scale.setScalar(1 + fx.age * 7)
        ;(fx.ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - fx.age * 1.1)
      }
      for (let i = bounceFxs.length - 1; i >= 0; i--) {
        const bfx = bounceFxs[i]
        bfx.age += dt
        if (bfx.age > 0.38) {
          scene.remove(bfx.mesh)
          bounceFxs.splice(i, 1)
          continue
        }
        bfx.mesh.scale.setScalar(1 + bfx.age * 8)
        ;(bfx.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - bfx.age / 0.38)
      }

      // === 8. CAMERA (FPP / TPP + Wall Raycast + Dynamic FOV) & LOCAL RIG ===
      const shakeX = player.camShake > 0.005 ? (Math.random() - 0.5) * player.camShake : 0
      const shakeY = player.camShake > 0.005 ? (Math.random() - 0.5) * player.camShake : 0
      tmpEyePos.set(player.pos.x + shakeX, player.pos.y + 2.28 - player.landDip + shakeY, player.pos.z)
      const isFpp = cameraViewRef.current === 'fpp'
      tmpCamEuler.set(player.pitch, player.yaw, isFpp ? player.camRoll : 0, 'YXZ')

      const baseFov = fovRef.current
      const chargeBoost = player.chargingThrow ? (player.chargeTime / 0.65) * 6 : 0
      const sprintBoost = sprint && horizSpd > 8 ? 5.5 : 0
      const targetFov = THREE.MathUtils.clamp(baseFov + sprintBoost + chargeBoost, 62, 102)
      if (Math.abs(camera.fov - targetFov) > 0.08) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, Math.min(1, dt * 9))
        camera.updateProjectionMatrix()
      }

      if (isFpp) {
        camera.position.copy(tmpEyePos)
        camera.quaternion.setFromEuler(tmpCamEuler)
        localRig.root.visible = false
        fppFrisbee.visible = frisbee.holderId === playerId && player.alive
        if (fppFrisbee.visible) {
          fppFrisbee.rotation.y += dt * (8 + player.chargeTime * 22)
          fppFrisbee.position.set(
            0.38 - player.chargeTime * 0.16 + player.camRoll * 0.35,
            -0.28 - player.landDip * 0.25,
            -0.62 + player.chargeTime * 0.14,
          )
        }
      } else {
        tmpCamDir.set(0, 0, 1).applyEuler(tmpCamEuler)
        tmpCamOrigin.set(tmpEyePos.x, tmpEyePos.y + 0.35, tmpEyePos.z)
        tmpDesiredCam.copy(tmpCamOrigin).addScaledVector(tmpCamDir, 6.2)
        tmpDesiredCam.y += 0.5
        const rayVec = tmpDesiredCam.clone().sub(tmpCamOrigin)
        const rayLen = rayVec.length()
        let allowedDist = rayLen
        if (rayLen > 0.1) {
          camRaycaster.set(tmpCamOrigin, rayVec.divideScalar(rayLen))
          camRaycaster.far = rayLen + 0.35
          const camHits = camRaycaster.intersectObjects(camSurfaces, false)
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
        camera.position.x = THREE.MathUtils.clamp(camera.position.x, -ARENA_HALF + 0.55, ARENA_HALF - 0.55)
        camera.position.z = THREE.MathUtils.clamp(camera.position.z, -ARENA_HALF + 0.55, ARENA_HALF - 0.55)
        camera.position.y = THREE.MathUtils.clamp(camera.position.y, 0.55, ARENA_HEIGHT - 0.55)
        camera.lookAt(tmpEyePos)
        localRig.root.visible = player.alive
        fppFrisbee.visible = false
      }

      // === 8.5 LIVE 3D AIM & 1ST-WALL RICOCHET TRAJECTORY PREVIEW (when holding Frisbee!) ===
      if (frisbee.holderId === playerId && player.alive && !uiBlocked) {
        camera.getWorldDirection(tmpAimDir)
        tmpAimOrigin.set(player.pos.x, player.pos.y + 2.02, player.pos.z).addScaledVector(tmpAimDir, 1.35)
        aimRaycaster.set(tmpAimOrigin, tmpAimDir)
        aimRaycaster.far = 42
        const aimHits = aimRaycaster.intersectObjects(camSurfaces, false)
        if (aimHits.length > 0) {
          const h = aimHits[0]
          tmpAimHit.copy(h.point)
          if (h.face) {
            tmpAimNormal.copy(h.face.normal).transformDirection(h.object.matrixWorld).normalize()
            if (tmpAimNormal.dot(tmpAimDir) > 0) tmpAimNormal.negate()
          } else {
            tmpAimNormal.copy(tmpAimDir).negate()
          }
          // Reflected bounce vector for killer trick-shot aiming!
          tmpAimRefl.copy(tmpAimDir).addScaledVector(tmpAimNormal, -2 * tmpAimDir.dot(tmpAimNormal)).normalize()
          tmpAimEnd.copy(tmpAimHit).addScaledVector(tmpAimRefl, 11.5)
          aimPreviewGeo.setFromPoints([tmpAimOrigin, tmpAimHit, tmpAimEnd])
          aimPreviewMat.color.set(player.chargeTime > 0.35 ? '#F97316' : '#38BDF8')
          aimPreviewLine.visible = true

          aimBounceMarker.visible = true
          aimBounceMarker.position.copy(tmpAimHit).addScaledVector(tmpAimNormal, 0.08)
          aimBounceMarker.lookAt(tmpAimHit.clone().add(tmpAimNormal))
          aimBounceMarker.scale.setScalar(0.9 + Math.sin(elapsed * 12) * 0.14)
        } else {
          tmpAimEnd.copy(tmpAimOrigin).addScaledVector(tmpAimDir, 24)
          aimPreviewGeo.setFromPoints([tmpAimOrigin, tmpAimEnd, tmpAimEnd])
          aimPreviewLine.visible = true
          aimBounceMarker.visible = false
        }
      } else {
        aimPreviewLine.visible = false
        aimBounceMarker.visible = false
      }

      const pose: PlayerPose = player.emote
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
      localRig.update(dt, elapsed, pose)

      // Broadcast multiplayer state (~15 Hz)
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
          pose,
          avatar: avatarRef.current,
          lastSeen: now,
        })
      }

      // Sync React HUD (~12 Hz)
      if (now - lastHudSync > 85) {
        lastHudSync = now
        const curSpd = Math.round(frisbee.vel.length() * 3.6)
        const distF = player.pos.clone().add(new THREE.Vector3(0, 1.4, 0)).distanceTo(frisbee.pos)
        setHoldingFrisbee(frisbee.holderId === playerId)
        setHolderLabel(frisbee.holderId ? frisbee.holderName : null)
        setDiscSpeedKmh(frisbee.holderId ? 0 : curSpd)
        setDiscBlazing(frisbee.blazing)
        setDiscBounces(frisbee.bounces)
        setCanCatchNow(
          !frisbee.holderId &&
            !frisbee.blazing &&
            player.alive &&
            distF < 8.5 &&
            !(frisbee.throwerId === playerId && frisbee.safeSelfTimer > 0),
        )
        setBlazingDanger(
          !frisbee.holderId &&
            frisbee.blazing &&
            player.alive &&
            modeNow !== 'solo_trick' &&
            distF < 12.5 &&
            !(frisbee.throwerId === playerId && frisbee.safeSelfTimer > 0),
        )
        setHoldTimeoutSec(
          frisbee.holderId === playerId && modeNow === 'match_3r' ? Math.max(0, Math.ceil(8 - frisbee.holdTimer)) : null,
        )
        setRoundTimeLeft(Math.max(0, Math.ceil(roundTimer)))
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
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('mousedown', onMouseDown)
      renderer.domElement.removeEventListener('contextmenu', onContextMenu)
      mp.disconnect()
      localRig.dispose()
      aimPreviewGeo.dispose()
      aimPreviewMat.dispose()
      aimBounceMarker.geometry.dispose()
      ;(aimBounceMarker.material as THREE.Material).dispose()
      bots.forEach((b) => b.rig.dispose())
      remotePeers.forEach((p) => p.rig.dispose())
      stadium.dispose();netTex.dispose();netMat.dispose();trailMat.dispose();trailGeo.dispose()
      renderer.dispose()
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock?.()
      }
    }
  }, [roomCode, playerId, exitLock, requestLock, pushFeed, showBanner, isTouchDevice])

  const handleCopyInvite = () => {
    const url = `${window.location.origin}/?world=frisbee&room=${encodeURIComponent(roomCode)}`
    void navigator.clipboard?.writeText(url)
    setCopiedInvite(true)
    sfx.playClick()
    window.setTimeout(() => setCopiedInvite(false), 1800)
  }

  return (
    <div
      className="relative w-full overflow-hidden bg-slate-950 select-none"
      style={{ height: viewportHeight ? `${viewportHeight}px` : '100dvh', overscrollBehavior: 'none' }}
    >
      {/* 3D WebGL Canvas Mount (touch-action: none for smooth 360° touch aiming!) */}
      <div ref={mountRef} className="absolute inset-0 h-full w-full" style={{ touchAction: 'none' }} />

      {/* Top HUD Bar — Clean, single-row, zero overlap on mobile landscape & portrait! */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-1.5 sm:gap-2"
        style={{
          paddingTop: 'max(0.45rem, calc(env(safe-area-inset-top) + 0.3rem))',
          paddingLeft: 'max(0.55rem, calc(env(safe-area-inset-left) + 0.35rem))',
          paddingRight: 'max(0.55rem, calc(env(safe-area-inset-right) + 0.35rem))',
        }}
      >
        {/* Left: Menu + Compact Mode Dropdown on Mobile / Full Bar on Desktop */}
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
            className="flex h-8 sm:h-9 items-center gap-1.5 rounded-xl border border-orange-400/35 bg-slate-950/85 px-2 sm:px-2.5 text-xs font-extrabold text-white backdrop-blur-md hover:bg-slate-900 cursor-pointer"
          >
            <Menu className="h-4 w-4 text-orange-400" />
            <span className="hidden lg:inline">Menu</span>
            <span className="hidden lg:inline rounded bg-white/10 px-1 py-0.5 font-mono text-[9px] text-orange-200">ESC</span>
          </button>

          {/* Compact Dropdown Mode Switcher for Mobile & Small Screens (< lg) */}
          <div className="relative lg:hidden">
            <button
              type="button"
              onClick={() => {
                sfx.playClick()
                setModeMenuOpen((o) => !o)
              }}
              className="flex h-8 items-center gap-1 rounded-xl border border-white/18 bg-slate-950/84 px-2.5 text-[11px] font-extrabold text-white backdrop-blur-md cursor-pointer"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: gameMode === 'match_3r' ? '#F97316' : '#22D3EE' }}
              />
              <span className="max-w-[92px] truncate">
                {gameMode === 'match_3r'
                  ? lang === 'pl'
                    ? 'Mecz 3R'
                    : '3-Round'
                  : lang === 'pl'
                    ? 'Trening'
                    : 'Drill'}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-300 transition-transform ${modeMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {modeMenuOpen && (
              <div className="absolute left-0 top-10 z-40 w-44 rounded-2xl border border-white/15 bg-slate-950/95 p-1.5 shadow-2xl backdrop-blur-xl space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    sfx.playClick()
                    actionsRef.current?.switchMode('match_3r')
                    setModeMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[11px] font-extrabold cursor-pointer"
                  style={{
                    background: gameMode === 'match_3r' ? 'linear-gradient(135deg, #F97316, #FACC15)' : 'transparent',
                    color: gameMode === 'match_3r' ? '#09111F' : '#E2E8F0',
                  }}
                >
                  {lang === 'pl' ? 'Mecz 3 Rundy' : '3-Round Match'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sfx.playClick()
                    actionsRef.current?.switchMode('solo_trick')
                    setModeMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[11px] font-extrabold cursor-pointer"
                  style={{
                    background: gameMode === 'solo_trick' ? '#22D3EE' : 'transparent',
                    color: gameMode === 'solo_trick' ? '#09111F' : '#E2E8F0',
                  }}
                >
                  {lang === 'pl' ? 'Trening Trików' : 'Solo Trick Drill'}
                </button>
                {gameMode === 'match_3r' && (
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

          {/* Full Mode Bar on Desktop (lg+) */}
          <div className="hidden lg:flex items-center gap-1 rounded-xl border border-white/15 bg-slate-950/82 p-1 backdrop-blur-md">
            <button
              type="button"
              onClick={() => {
                sfx.playClick()
                actionsRef.current?.switchMode('match_3r')
              }}
              className="rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer"
              style={{
                background: gameMode === 'match_3r' ? 'linear-gradient(135deg, #F97316, #FACC15)' : 'transparent',
                color: gameMode === 'match_3r' ? '#09111F' : '#CBD5E1',
              }}
            >
              {lang === 'pl' ? 'Mecz 3 Rundy' : '3-Round Match'}
            </button>
            <button
              type="button"
              onClick={() => {
                sfx.playClick()
                actionsRef.current?.switchMode('solo_trick')
              }}
              className="rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer"
              style={{
                background: gameMode === 'solo_trick' ? '#22D3EE' : 'transparent',
                color: gameMode === 'solo_trick' ? '#09111F' : '#CBD5E1',
              }}
            >
              {lang === 'pl' ? 'Trening Trików' : 'Solo Trick Drill'}
            </button>
          </div>

          {gameMode === 'match_3r' && (
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
            >
              <Bot className="h-3.5 w-3.5" />
              <span>{botsEnabled ? 'Boty ON' : 'Boty OFF'}</span>
            </button>
          )}
        </div>

        {/* Center: Compact Scoreboard (also visible cleanly on mobile!) */}
        <div className="flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-orange-400/35 bg-slate-950/85 px-2.5 sm:px-4 py-1 sm:py-1.5 backdrop-blur-md shadow-xl">
          {gameMode === 'solo_trick' ? (
            <>
              <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-extrabold text-cyan-300">
                <Target className="h-3.5 w-3.5" />
                {soloTargetsHit}
              </span>
              <span className="hidden sm:inline h-3.5 w-px bg-white/15" />
              <span className="hidden sm:inline font-mono text-xs font-extrabold text-orange-300">
                {lang === 'pl' ? '[R] Przywołaj Frisbee' : '[R] Recall Frisbee'}
              </span>
            </>
          ) : (
            <>
              <span className="rounded-md bg-orange-500/25 px-1.5 py-0.5 font-mono text-[10px] sm:text-xs font-black text-orange-200">
                R{roundNum}/{TOTAL_ROUNDS}
              </span>
              <span className="font-mono text-xs sm:text-sm font-black text-white">{roundTimeLeft}s</span>
              <span className="hidden sm:inline h-3.5 w-px bg-white/15" />
              <span className="inline-flex items-center gap-0.5 text-[11px] sm:text-xs font-extrabold text-amber-300" title="Wygrane rundy">
                <Crown className="h-3.5 w-3.5" />
                {myRoundWins}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-xs font-extrabold text-rose-400" title="Przecięcia">
                <Flame className="h-3.5 w-3.5" />
                {mySlices}
              </span>
              <span className="hidden md:inline-flex items-center gap-1 text-xs font-extrabold text-emerald-300" title="Złapania">
                <Hand className="h-3.5 w-3.5" />
                {myCatches}
              </span>
              <span className="hidden md:inline text-[11px] font-bold text-slate-300">
                {lang === 'pl' ? `Żywi: ${aliveCount}` : `Alive: ${aliveCount}`}
              </span>
            </>
          )}
        </div>

        {/* Right: Compact Controls */}
        <div
          className="pointer-events-auto flex items-center gap-1 sm:gap-1.5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setCameraView((v) => (v === 'fpp' ? 'tpp' : 'fpp'))}
            className="flex h-8 sm:h-9 items-center gap-1 rounded-xl border border-white/15 bg-slate-950/82 px-2 sm:px-2.5 text-[10px] sm:text-[11px] font-extrabold text-sky-200 backdrop-blur-md cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>{cameraView.toUpperCase()}</span>
          </button>

          {gameMode === 'solo_trick' && (
            <button
              type="button"
              onClick={() => actionsRef.current?.recallSoloFrisbee()}
              className="flex h-8 w-8 sm:h-9 sm:w-auto sm:px-2.5 items-center justify-center gap-1 rounded-xl border border-cyan-400/35 bg-cyan-500/20 text-[11px] font-extrabold text-cyan-200 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">[R]</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              exitLock()
              setWardrobeOpen(true)
            }}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-white/15 bg-slate-950/82 text-sky-300 cursor-pointer"
          >
            <Shirt className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              exitLock()
              setChatOpen((c) => !c)
            }}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-white/15 bg-slate-950/82 text-sky-300 cursor-pointer"
          >
            <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>

          <div className="hidden md:flex h-9 items-center gap-1.5 rounded-xl border border-emerald-400/25 bg-slate-950/80 px-2.5 font-mono text-xs font-bold text-emerald-300">
            <Users className="h-3.5 w-3.5" />
            <span>{humanCount}</span>
          </div>
        </div>
      </div>

      {/* Round Banner */}
      {bannerText && (
        <div className="pointer-events-none absolute top-16 left-1/2 z-30 -translate-x-1/2 rounded-2xl border border-amber-300/60 bg-slate-950/92 px-5 py-2.5 text-xs sm:text-sm font-black text-amber-100 shadow-2xl backdrop-blur-md">
          {bannerText}
        </div>
      )}

      {/* Spectator Notice when sliced during a round */}
      {!amAlive && gameMode === 'match_3r' && (
        <div className="pointer-events-none absolute top-28 left-1/2 z-20 -translate-x-1/2 rounded-xl border border-rose-500/50 bg-rose-950/85 px-4 py-1.5 text-xs font-black text-rose-200 backdrop-blur">
          {lang === 'pl' ? '🔥 Zostałeś przecięty! Obserwujesz końcówkę rundy…' : '🔥 You were sliced! Spectating rest of round…'}
        </div>
      )}

      {/* Kill / Catch Feed */}
      {killFeed.length > 0 && (
        <div className="pointer-events-none absolute right-3 top-16 z-20 flex flex-col items-end gap-1.5">
          {killFeed.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-white/15 bg-slate-950/82 px-3 py-1 text-xs font-extrabold backdrop-blur-md shadow"
              style={{ color: item.accent }}
            >
              {item.text}
            </div>
          ))}
        </div>
      )}

      {/* Center Crosshair + Catch Prompt / Throw Charge Bar */}
      {!menuOpen && !wardrobeOpen && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
          <div className="relative flex h-10 w-10 items-center justify-center">
            <Crosshair
              className={`h-5 w-5 transition ${
                holdingFrisbee
                  ? 'text-amber-300 scale-110'
                  : canCatchNow
                    ? 'text-emerald-300 scale-125'
                    : discBlazing
                      ? 'text-rose-400'
                      : 'text-white/75'
              }`}
            />
          </div>

          {holdingFrisbee && chargePct > 0 && (
            <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-950/80 border border-white/20">
              <div
                className="h-full transition-all"
                style={{
                  width: `${chargePct}%`,
                  background: 'linear-gradient(90deg, #38BDF8, #F97316, #EF4444)',
                }}
              />
            </div>
          )}

          {canCatchNow && (
            <div className="animate-pulse rounded-full border border-emerald-300 bg-emerald-500/25 px-3 py-1 text-xs font-black text-emerald-200 shadow-lg backdrop-blur">
              {lang === 'pl' ? '🧤 ZŁAP TERAZ! [PPM / E]' : '🧤 CATCH NOW! [RMB / E]'}
            </div>
          )}

          {blazingDanger && (
            <div className="animate-bounce rounded-full border border-rose-400 bg-rose-600/35 px-3.5 py-1 text-xs font-black text-rose-100 shadow-lg backdrop-blur">
              {lang === 'pl' ? '🔥 UNIK! PŁONĄCE FRISBEE NADLATUJE!' : '🔥 DODGE! BLAZING FRISBEE INCOMING!'}
            </div>
          )}

          {catchWindowActive && (
            <div className="rounded-full border border-cyan-300 bg-cyan-500/30 px-3 py-0.5 text-[11px] font-black text-white">
              {lang === 'pl' ? 'CHWYT AKTYWNY!' : 'CATCH ACTIVE!'}
            </div>
          )}
        </div>
      )}

      {/* Bottom Frisbee Status & Controls Dock */}
      {!isTouchDevice && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/15 bg-slate-950/88 px-4 py-2 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-2">
            <Disc className={`h-5 w-5 ${discBlazing ? 'text-orange-400 animate-spin' : 'text-sky-400'}`} />
            <div>
              <div className={`font-mono text-sm font-black leading-none ${discBlazing ? 'text-orange-300' : 'text-white'}`}>
                {holdingFrisbee
                  ? lang === 'pl'
                    ? `MASZ FRISBEE!${holdTimeoutSec !== null ? ` (${holdTimeoutSec}s)` : ''}`
                    : `YOU HOLD FRISBEE!${holdTimeoutSec !== null ? ` (${holdTimeoutSec}s)` : ''}`
                  : holderLabel
                    ? `${holderLabel}`
                    : `${discSpeedKmh} km/h · ×${discBounces}`}
              </div>
              <div className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wider">
                {discBlazing ? (
                  <span className="text-rose-400">🔥 {lang === 'pl' ? 'OGNISTE — PRZECINA!' : 'BLAZING — LETHAL SLICE!'}</span>
                ) : holdingFrisbee ? (
                  <span className="text-amber-300">{lang === 'pl' ? 'Rzuć w ścianę by rozpalić!' : 'Bank off walls to ignite!'}</span>
                ) : (
                  <span className="text-emerald-300">{lang === 'pl' ? 'Chłodne — MOŻNA ZŁAPAĆ' : 'Cool — CATCHABLE'}</span>
                )}
              </div>
            </div>
          </div>

          <div className="h-7 w-px bg-white/15" />

          <div className="flex items-center gap-1.5 text-[11px] font-extrabold">
            {holdingFrisbee ? (
              <>
                <span className="rounded-lg border border-amber-300/40 bg-amber-500/20 px-2 py-1 text-amber-200">
                  LPM {lang === 'pl' ? 'Rzut (przytrzymaj = moc)' : 'Throw (hold = charge)'}
                </span>
                <span className="rounded-lg border border-cyan-300/40 bg-cyan-500/20 px-2 py-1 text-cyan-200">
                  [Q]/[E]/PPM {lang === 'pl' ? 'Podkręcony' : 'Curve'}
                </span>
              </>
            ) : (
              <span className="rounded-lg border border-emerald-300/40 bg-emerald-500/20 px-2 py-1 text-emerald-200">
                PPM / [E] {lang === 'pl' ? 'Złap zanim zapłonie!' : 'Catch before fire!'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Click-to-Lock Hint */}
      {!isTouchDevice && !pointerLocked && !menuOpen && !wardrobeOpen && !chatOpen && !emoteWheelOpen && (
        <div
          onClick={requestLock}
          className="pointer-events-auto absolute bottom-20 left-1/2 z-20 -translate-x-1/2 cursor-pointer rounded-full border border-orange-400/50 bg-slate-950/90 px-4 py-1.5 text-xs font-extrabold text-orange-200 shadow-xl backdrop-blur hover:bg-slate-900"
        >
          {lang === 'pl'
            ? 'Kliknij ekran, aby grać · LPM Rzut · Q/E Podkręcenie · PPM/E Złap zanim zapłonie! · V FPP/TPP'
            : 'Click screen to lock · LMB Throw · Q/E Curve · RMB/E Catch before fire! · V FPP/TPP'}
        </div>
      )}

      {/* Mobile Touch Controls + Frisbee Buttons */}
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
            compactHeight={viewportHeight < 460}
            labels={{
              jumpBtn: lang === 'pl' ? 'SKOK' : 'JUMP',
              sprintBtn: 'SPRINT',
              emotesLabel: lang === 'pl' ? 'Emotki' : 'Emotes',
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
          {/* Ergonomic Frisbee Action Buttons — cleanly beside Jump on landscape, or neatly above Jump on portrait! */}
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
            className="pointer-events-auto absolute z-30 flex items-center gap-2"
          >
            {holdingFrisbee ? (
              <>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    actionsRef.current?.throwFrisbee(1, 0.45)
                  }}
                  className={`flex ${viewportHeight < 460 ? 'h-11 w-11 text-[10px]' : 'h-12 w-12 text-[11px]'} items-center justify-center rounded-2xl border border-cyan-300 bg-cyan-500/40 font-black text-white shadow-lg backdrop-blur-md active:scale-90`}
                >
                  TRIK
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    actionsRef.current?.throwFrisbee(0, 0.55)
                  }}
                  className={`flex ${viewportHeight < 460 ? 'h-13 w-13 text-[11px]' : 'h-14 w-14 text-xs'} items-center justify-center rounded-2xl border-2 border-orange-300 bg-orange-500/50 font-black text-white shadow-xl backdrop-blur-md active:scale-90`}
                >
                  RZUĆ
                </button>
              </>
            ) : (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  actionsRef.current?.attemptCatch()
                }}
                className={`flex ${viewportHeight < 460 ? 'h-13 w-13 text-[11px]' : 'h-14 w-14 text-xs'} items-center justify-center rounded-2xl border-2 ${
                  canCatchNow ? 'border-emerald-200 bg-emerald-500/70 animate-pulse' : 'border-emerald-300 bg-emerald-500/45'
                } font-black text-white shadow-xl backdrop-blur-md active:scale-90`}
              >
                ZŁAP
              </button>
            )}
          </div>
        </>
      )}

      {/* Room Chat */}
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
        worldKind="frisbee"
      />

      {/* Emote Wheel */}
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

      {/* Live 3D Wardrobe */}
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
        worldKind="frisbee"
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
        onSwitchToArena={onSwitchToArena}
        onLeaveToHome={onLeave}
        onOpenFeedback={onOpenFeedback}
      />

      <ShortcutsOverlayModal
        open={shortcutsOpen}
        lang={lang}
        worldKind="lobby"
        onClose={() => setShortcutsOpen(false)}
      />

      {/* Keep Zap/Trophy referenced cleanly */}
      <span className="hidden">
        <Zap />
        <Trophy />
      </span>
    </div>
  )
}
