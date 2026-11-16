import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import {
  ArrowLeft,
  Bot,
  Check,
  Gauge,
  MessageSquare,
  Send,
  Share2,
  Smartphone,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { getRankForXp, R6AvatarConfig } from '../data/catalog'
import { Lang, LOCALES } from '../data/locales'
import { LobbyChatMessage, LobbyMultiplayerClient, PlayerPose, RemotePlayerState } from '../lib/multiplayer'
import { sfx } from '../lib/sfx'
import { isSupabaseConfigured } from '../lib/supabase'
import { FreshGemShard } from '../components/brand/FreshBloxBrand'
import { MobileTouchControls } from '../components/hud/MobileTouchControls'
import { createR6Rig, getSharedFreshStudTexture, R6RigHandle } from './r6Builder'

export type GraphicsQuality = 'low' | 'medium' | 'high'

interface AABB {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

interface GemPickup {
  id: number
  mesh: THREE.Mesh
  baseY: number
  x: number
  z: number
  collectedUntil: number
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
  username: string
  freshGems: number
  xp: number
  avatar: R6AvatarConfig
  onCollectGem: () => void
  onChatSent: () => void
  onEmoteUsed: () => void
  onJumpPadUsed: () => void
  onReachTerrace: () => void
  onBackHome: () => void
  onOpenAvatar: () => void
}

function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches
  )
}

function detectDefaultQuality(): GraphicsQuality {
  if (typeof window === 'undefined') return 'medium'
  const cores = navigator.hardwareConcurrency || 4
  const isTouch = detectTouchDevice()
  const narrow = window.innerWidth < 820
  if (cores <= 2) return 'low'
  if (isTouch || narrow || cores <= 4) return 'medium'
  return 'high'
}

const QUALITY_ORDER: GraphicsQuality[] = ['low', 'medium', 'high']

export const MainLobbyWorld: React.FC<MainLobbyWorldProps> = ({
  roomCode,
  lang,
  playerId,
  username,
  freshGems,
  xp,
  avatar,
  onCollectGem,
  onChatSent,
  onEmoteUsed,
  onJumpPadUsed,
  onReachTerrace,
  onBackHome,
  onOpenAvatar,
}) => {
  const t = LOCALES[lang].world
  const mountRef = useRef<HTMLDivElement>(null)

  const [quality, setQuality] = useState<GraphicsQuality>(() => detectDefaultQuality())
  const [touchMode, setTouchMode] = useState<boolean>(() => detectTouchDevice())
  const [sprintLocked, setSprintLocked] = useState<boolean>(false)
  const [fpsDisplay, setFpsDisplay] = useState<number>(60)
  const [chatOpen, setChatOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 700 : true,
  )
  const [unreadCount, setUnreadCount] = useState(0)

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

  const touchMoveRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const jumpQueuedRef = useRef<boolean>(false)

  const avatarRef = useRef(avatar)
  avatarRef.current = avatar

  const usernameRef = useRef(username)
  usernameRef.current = username

  const rankRef = useRef(getRankForXp(xp).name)
  rankRef.current = getRankForXp(xp).name

  const activeEmoteRef = useRef<PlayerPose | null>(null)
  const emoteTimerRef = useRef<number>(0)
  const chatInputFocusedRef = useRef(false)
  const mpRef = useRef<LobbyMultiplayerClient | null>(null)
  const localRigRef = useRef<R6RigHandle | null>(null)
  const speechTimeoutRef = useRef<number | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cloudsGroupRef = useRef<THREE.Group | null>(null)

  const callbacksRef = useRef({
    onCollectGem,
    onChatSent,
    onEmoteUsed,
    onJumpPadUsed,
    onReachTerrace,
  })
  callbacksRef.current = {
    onCollectGem,
    onChatSent,
    onEmoteUsed,
    onJumpPadUsed,
    onReachTerrace,
  }

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => {
      setToast((cur) => (cur === msg ? null : cur))
    }, 2400)
  }, [])

  // Live graphics quality application (zero reload needed!)
  useEffect(() => {
    const renderer = rendererRef.current
    const sun = sunLightRef.current
    const scene = sceneRef.current
    const clouds = cloudsGroupRef.current
    if (!renderer || !scene) return

    const dpr = window.devicePixelRatio || 1
    if (quality === 'low') {
      renderer.setPixelRatio(Math.min(dpr, 1.0))
      renderer.shadowMap.enabled = false
      if (sun) sun.castShadow = false
      scene.fog = new THREE.Fog('#BAE6FD', 40, 115)
      if (clouds) clouds.visible = false
    } else if (quality === 'medium') {
      renderer.setPixelRatio(Math.min(dpr, 1.35))
      renderer.shadowMap.enabled = true
      if (sun) sun.castShadow = true
      scene.fog = new THREE.Fog('#BAE6FD', 54, 150)
      if (clouds) clouds.visible = true
    } else {
      renderer.setPixelRatio(Math.min(dpr, 1.85))
      renderer.shadowMap.enabled = true
      if (sun) sun.castShadow = true
      scene.fog = new THREE.Fog('#BAE6FD', 68, 178)
      if (clouds) clouds.visible = true
    }
    renderer.shadowMap.needsUpdate = true
  }, [quality])

  const triggerEmote = useCallback(
    (pose: PlayerPose) => {
      activeEmoteRef.current = pose
      emoteTimerRef.current = pose === 'sit' ? 14 : 3.4
      setActiveEmote(pose)
      sfx.playClick()
      callbacksRef.current.onEmoteUsed()
    },
    [],
  )

  const handleTouchMoveVector = useCallback((x: number, y: number) => {
    touchMoveRef.current.x = x
    touchMoveRef.current.y = y
  }, [])

  const handleTouchJump = useCallback(() => {
    jumpQueuedRef.current = true
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
      mpRef.current?.broadcastChat(msg)
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

  const cycleQuality = useCallback(() => {
    setQuality((cur) => {
      const idx = QUALITY_ORDER.indexOf(cur)
      return QUALITY_ORDER[(idx + 1) % QUALITY_ORDER.length]
    })
    sfx.playClick()
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

    // Fresh-Day bright sky lighting (single fast shadow caster)
    const hemi = new THREE.HemisphereLight('#F0F9FF', '#7DD3FC', 1.15)
    scene.add(hemi)

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

    // Shared Stud Texture & Pooled Materials (dramatically reduces GPU state switches & texture RAM)
    const baseStudTex = getSharedFreshStudTexture()
    const studMatCache = new Map<string, THREE.MeshStandardMaterial>()

    const getStudMat = (color: string, rx: number, rz: number, roughness = 0.26) => {
      const key = `${color}_${rx}_${rz}_${roughness}`
      const hit = studMatCache.get(key)
      if (hit) return hit
      let mapTex: THREE.Texture = baseStudTex
      if (rx !== 1 || rz !== 1) {
        const cloned = trackTex(baseStudTex.clone())
        cloned.needsUpdate = true
        cloned.repeat.set(rx, rz)
        mapTex = cloned
      }
      const mat = trackMat(
        new THREE.MeshStandardMaterial({
          color,
          map: mapTex,
          roughness,
          metalness: 0.05,
        }),
      )
      studMatCache.set(key, mat)
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
      opts?: { solid?: boolean; studs?: boolean; radius?: number; roughness?: number; castShadow?: boolean },
    ) => {
      const { solid = true, studs = true, radius = 0.14, roughness = 0.26, castShadow = true } = opts ?? {}
      const rx = Math.max(1, Math.round(w / 2))
      const rz = Math.max(1, Math.round(d / 2))
      const geo = trackGeo(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, h * 0.35)))
      const mat = studs
        ? getStudMat(color, rx, rz, roughness)
        : trackMat(new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.06 }))
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
    addBlock(0, -1.5, 0, 74, 3, 74, '#E0F2FE', { radius: 0.28, roughness: 0.34, castShadow: false })
    addBlock(0, -0.02, 0, 26, 0.3, 26, '#BAE6FD', { radius: 0.12, roughness: 0.28, castShadow: false })
    addBlock(0, 0.06, 0, 14, 0.26, 14, '#7DD3FC', { radius: 0.1, roughness: 0.24, castShadow: false })

    // Four cardinal walkway carpets
    addBlock(0, 0.03, 18, 6.2, 0.2, 22, '#F0F9FF', { radius: 0.08, castShadow: false })
    addBlock(0, 0.03, -18, 6.2, 0.2, 22, '#F0F9FF', { radius: 0.08, castShadow: false })
    addBlock(18, 0.03, 0, 22, 0.2, 6.2, '#F0F9FF', { radius: 0.08, castShadow: false })
    addBlock(-18, 0.03, 0, 22, 0.2, 6.2, '#F0F9FF', { radius: 0.08, castShadow: false })

    // Central FreshBlox Crystal Fountain Monument
    addBlock(0, 0.45, 0, 6.4, 0.9, 6.4, '#F8FAFC', { radius: 0.16 })
    const waterPool = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(5.2, 0.28, 5.2, 2, 0.08)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: '#38BDF8',
          emissive: '#0284C7',
          emissiveIntensity: 0.28,
          roughness: 0.1,
          metalness: 0.18,
        }),
      ),
    )
    waterPool.position.set(0, 0.88, 0)
    scene.add(waterPool)

    addBlock(0, 1.55, 0, 1.8, 1.4, 1.8, '#0284C7', { radius: 0.14 })
    const centerCrystal = new THREE.Mesh(
      trackGeo(new THREE.OctahedronGeometry(1.15, 0)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: '#7DD3FC',
          emissive: '#0EA5E9',
          emissiveIntensity: 0.55,
          roughness: 0.12,
          metalness: 0.2,
        }),
      ),
    )
    centerCrystal.position.set(0, 3.85, 0)
    centerCrystal.castShadow = true
    scene.add(centerCrystal)

    // Hangout Chill Seating Zone (West side)
    const benchMat = trackMat(new THREE.MeshStandardMaterial({ color: '#0369A1', roughness: 0.28 }))
    const benchLegMat = trackMat(new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.26 }))
    const benchSeatGeo = trackGeo(new RoundedBoxGeometry(3.4, 0.34, 1.15, 2, 0.08))
    const benchLegGeo = trackGeo(new RoundedBoxGeometry(0.42, 0.46, 0.95, 2, 0.06))
    const benchPositions = [
      { x: -16, z: -8, rotY: 0.4 },
      { x: -16, z: 8, rotY: -0.4 },
      { x: -22, z: 0, rotY: Math.PI / 2 },
    ]
    for (const bp of benchPositions) {
      const seat = new THREE.Mesh(benchSeatGeo, benchMat)
      seat.position.set(bp.x, 0.65, bp.z)
      seat.rotation.y = bp.rotY
      seat.castShadow = true
      seat.receiveShadow = true
      scene.add(seat)
      for (const side of [-1.2, 1.2]) {
        const leg = new THREE.Mesh(benchLegGeo, benchLegMat)
        leg.position.set(bp.x + Math.cos(bp.rotY) * side, 0.24, bp.z - Math.sin(bp.rotY) * side)
        leg.rotation.y = bp.rotY
        scene.add(leg)
      }
      colliders.push({
        minX: bp.x - 1.5,
        maxX: bp.x + 1.5,
        minY: 0,
        maxY: 0.85,
        minZ: bp.z - 1.1,
        maxZ: bp.z + 1.1,
      })
    }

    // Hangout Stage / Dance Platform (South side)
    addBlock(0, 0.45, 24, 13, 0.9, 8.5, '#0F172A', { radius: 0.16 })
    const danceFloor = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(11.6, 0.16, 7.2, 2, 0.05)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: '#0EA5E9',
          emissive: '#0284C7',
          emissiveIntensity: 0.42,
          roughness: 0.18,
          metalness: 0.15,
        }),
      ),
    )
    danceFloor.position.set(0, 0.92, 24)
    scene.add(danceFloor)

    // Future Game Mode Portals (North side)
    const createPortalArch = (x: number, z: number, label: string, sub: string, color: string) => {
      addBlock(x - 3.1, 3.1, z, 1.1, 6.2, 1.2, '#F8FAFC', { radius: 0.14 })
      addBlock(x + 3.1, 3.1, z, 1.1, 6.2, 1.2, '#F8FAFC', { radius: 0.14 })
      addBlock(x, 6.3, z, 7.4, 1.1, 1.3, color, { radius: 0.16 })

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

    createPortalArch(-11, -26, 'SkyTower Obby', lang === 'pl' ? 'WKRÓTCE' : 'COMING SOON', '#38BDF8')
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
    for (const s of terraceSteps) {
      addBlock(s.x, s.y, s.z, s.w, s.h, s.d, s.c, { radius: 0.14 })
    }

    const terraceBeacon = new THREE.Mesh(
      trackGeo(new THREE.OctahedronGeometry(0.9, 0)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: '#38BDF8',
          emissive: '#0EA5E9',
          emissiveIntensity: 0.7,
          roughness: 0.12,
        }),
      ),
    )
    terraceBeacon.position.set(25.5, 9.2, 13.5)
    scene.add(terraceBeacon)

    // Stylized Fresh Glossy Block Trees (shared geometry & materials!)
    const trunkGeo = trackGeo(new RoundedBoxGeometry(1.1, 3.6, 1.1, 2, 0.12))
    const trunkMat = trackMat(new THREE.MeshStandardMaterial({ color: '#92400E', roughness: 0.52 }))
    const foliageGeo1 = trackGeo(new RoundedBoxGeometry(3.8, 2.2, 3.8, 2, 0.26))
    const foliageGeo2 = trackGeo(new RoundedBoxGeometry(2.5, 1.6, 2.5, 2, 0.22))
    const foliageMat1 = trackMat(new THREE.MeshStandardMaterial({ color: '#38BDF8', roughness: 0.28 }))
    const foliageMat2 = trackMat(new THREE.MeshStandardMaterial({ color: '#BAE6FD', roughness: 0.24 }))

    const addTree = (x: number, z: number) => {
      const trunk = new THREE.Mesh(trunkGeo, trunkMat)
      trunk.position.set(x, 1.8, z)
      trunk.castShadow = true
      scene.add(trunk)
      const f1 = new THREE.Mesh(foliageGeo1, foliageMat1)
      f1.position.set(x, 4.1, z)
      f1.castShadow = true
      scene.add(f1)
      const f2 = new THREE.Mesh(foliageGeo2, foliageMat2)
      f2.position.set(x, 5.5, z)
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

    // Jump-Pads
    const jumpPads: JumpPad[] = []
    const padBaseGeo = trackGeo(new THREE.CylinderGeometry(1.55, 1.8, 0.28, 16))
    const padBaseMat = trackMat(new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.3 }))
    const padRingGeo = trackGeo(new THREE.TorusGeometry(1.22, 0.14, 8, 20))
    const padRingMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#38BDF8',
        emissive: '#0EA5E9',
        emissiveIntensity: 0.85,
        roughness: 0.16,
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

    // Collectible floating FreshGems shards
    const gemGeo = trackGeo(new THREE.OctahedronGeometry(0.54, 0))
    const gemMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#38BDF8',
        emissive: '#0284C7',
        emissiveIntensity: 0.65,
        roughness: 0.12,
        metalness: 0.22,
      }),
    )
    const gemSpots = [
      { x: 9, y: 1.5, z: 0 },
      { x: -9, y: 1.5, z: 0 },
      { x: 0, y: 1.5, z: 12 },
      { x: 0, y: 1.5, z: -14 },
      { x: -16, y: 1.5, z: 0 },
      { x: 16, y: 2.5, z: -7 },
      { x: 24, y: 5.4, z: 1.5 },
      { x: 25.5, y: 8.6, z: 13.5 },
      { x: 0, y: 2.1, z: 24 },
      { x: -10, y: 1.5, z: -20 },
    ]
    const gems: GemPickup[] = gemSpots.map((g, idx) => {
      const mesh = new THREE.Mesh(gemGeo, gemMat)
      mesh.position.set(g.x, g.y, g.z)
      scene.add(mesh)
      return { id: idx, mesh, baseY: g.y, x: g.x, z: g.z, collectedUntil: 0 }
    })

    // Soft floating Arctic Sky clouds (toggled off in Low/Eco quality!)
    const cloudsGroup = new THREE.Group()
    cloudsGroup.visible = initQ !== 'low'
    const cloudMat = trackMat(new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.85 }))
    const cloudGeo = trackGeo(new RoundedBoxGeometry(10, 2.2, 5.5, 2, 0.7))
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Mesh(cloudGeo, cloudMat)
      c.position.set(-48 + i * 19, 25 + (i % 3) * 3.5, -42 + ((i * 23) % 80))
      cloudsGroup.add(c)
    }
    scene.add(cloudsGroup)
    cloudsGroupRef.current = cloudsGroup

    // === LOCAL PLAYER CLEAN R6 RIG (NO ORBS/AURA!) ===
    const localRig = createR6Rig({
      avatar: avatarRef.current,
      username: usernameRef.current,
      rank: rankRef.current,
      showNameplate: true,
      castShadow: initQ !== 'low',
    })
    scene.add(localRig.root)
    localRigRef.current = localRig

    const player = {
      x: 0,
      y: 0.25,
      z: 9,
      vx: 0,
      vy: 0,
      vz: 0,
      rotY: Math.PI,
      grounded: false,
      reachedTerrace: false,
    }

    // === HANGOUT COMPANION BOTS (CLEAN R6, NO ORBS/AURA!) ===
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
          { x: 6, z: -5, pause: 5, emote: 'cheer', chat: lang === 'pl' ? 'Czyste R6 bez kulek wygląda mega!' : 'Clean R6 looks awesome!' },
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

    const mp = new LobbyMultiplayerClient({
      roomId: roomCode,
      selfId: playerId,
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

    const activePointers = new Map<number, { x: number; y: number }>()
    let lastPinchDist = 0

    const onKeyDown = (e: KeyboardEvent) => {
      if (chatInputFocusedRef.current) return
      const code = e.code
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        e.preventDefault()
      }
      keys.add(code)
      if (code === 'Digit1') triggerEmote('wave')
      if (code === 'Digit2') triggerEmote('dance')
      if (code === 'Digit3') triggerEmote('cheer')
      if (code === 'Digit4') triggerEmote('sit')
      if (code === 'Digit5') triggerEmote('spin')
      if (code === 'Digit6') triggerEmote('backflip')
    }
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code)

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return
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

    const onPointerMove = (e: PointerEvent) => {
      const prev = activePointers.get(e.pointerId)
      if (!prev) return

      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      prev.x = e.clientX
      prev.y = e.clientY

      if (activePointers.size === 1) {
        const sensitivity = e.pointerType === 'touch' ? 0.0085 : 0.0062
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

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerEnd)
    renderer.domElement.addEventListener('pointercancel', onPointerEnd)
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true })
    renderer.domElement.addEventListener('contextmenu', onContext)

    const onResize = () => {
      if (!container) return
      const w = container.clientWidth || window.innerWidth
      const h = container.clientHeight || window.innerHeight - 64
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    // Pre-allocated scratch vectors (ZERO per-frame GC allocations!)
    const camForward = new THREE.Vector3()
    const camRight = new THREE.Vector3()
    const moveVec = new THREE.Vector3()
    const desiredCamPos = new THREE.Vector3()
    const lookTarget = new THREE.Vector3()

    // === MAIN 60FPS PHYSICS & RENDER LOOP ===
    let rafId = 0
    let lastTime = performance.now()
    let elapsed = 0
    let lastBroadcast = 0
    let lastCountUpdate = 0
    let fpsFrames = 0
    let fpsLastTick = performance.now()

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate)
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      elapsed += dt

      // Lightweight FPS meter (updates UI every 0.5s only)
      fpsFrames++
      if (now - fpsLastTick >= 500) {
        const measured = Math.round((fpsFrames * 1000) / (now - fpsLastTick))
        setFpsDisplay(measured)
        fpsFrames = 0
        fpsLastTick = now
      }

      // Combine keyboard + analog virtual thumbstick inputs
      let inputX = 0
      let inputZ = 0
      if (keys.has('KeyW') || keys.has('ArrowUp')) inputZ += 1
      if (keys.has('KeyS') || keys.has('ArrowDown')) inputZ -= 1
      if (keys.has('KeyA') || keys.has('ArrowLeft')) inputX -= 1
      if (keys.has('KeyD') || keys.has('ArrowRight')) inputX += 1

      const stickX = touchMoveRef.current.x
      const stickY = touchMoveRef.current.y
      if (Math.abs(stickX) > 0.08 || Math.abs(stickY) > 0.08) {
        inputX += stickX
        inputZ -= stickY // pushing stick UP (negative screen Y) moves FORWARD (+inputZ)
      }

      const isMoving = Math.abs(inputX) > 0.06 || Math.abs(inputZ) > 0.06
      const stickMag = Math.hypot(stickX, stickY)
      const isSprinting =
        keys.has('ShiftLeft') || keys.has('ShiftRight') || sprintLockedRef.current || stickMag > 0.88
      const speed = isSprinting ? 12.6 : 7.8

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

      if (isMoving) {
        const targetAngle = Math.atan2(player.vx, player.vz)
        let diff = targetAngle - player.rotY
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        player.rotY += diff * Math.min(1, dt * 14)
      }

      const wantJump = keys.has('Space') || jumpQueuedRef.current
      jumpQueuedRef.current = false
      if (wantJump && player.grounded) {
        player.vy = 11.4
        player.grounded = false
        sfx.playJump()
      }

      player.vy -= 28 * dt

      // Move X & collide
      const playerR = 0.56
      const prevY = player.y
      player.x += player.vx * dt
      for (const b of colliders) {
        if (player.y + 3.2 > b.minY + 0.25 && player.y < b.maxY - 0.12) {
          if (
            player.x + playerR > b.minX &&
            player.x - playerR < b.maxX &&
            player.z + playerR > b.minZ &&
            player.z - playerR < b.maxZ
          ) {
            if (player.vx > 0) player.x = b.minX - playerR
            else if (player.vx < 0) player.x = b.maxX + playerR
          }
        }
      }

      // Move Z & collide
      player.z += player.vz * dt
      for (const b of colliders) {
        if (player.y + 3.2 > b.minY + 0.25 && player.y < b.maxY - 0.12) {
          if (
            player.x + playerR > b.minX &&
            player.x - playerR < b.maxX &&
            player.z + playerR > b.minZ &&
            player.z - playerR < b.maxZ
          ) {
            if (player.vz > 0) player.z = b.minZ - playerR
            else if (player.vz < 0) player.z = b.maxZ + playerR
          }
        }
      }

      // Move Y & land on tops
      player.y += player.vy * dt
      player.grounded = false
      for (const b of colliders) {
        if (
          player.x + playerR > b.minX &&
          player.x - playerR < b.maxX &&
          player.z + playerR > b.minZ &&
          player.z - playerR < b.maxZ
        ) {
          if (player.vy <= 0 && prevY >= b.maxY - 0.35 && player.y <= b.maxY) {
            player.y = b.maxY
            player.vy = 0
            player.grounded = true
          }
        }
      }

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
          sfx.playJumpPad()
          callbacksRef.current.onJumpPadUsed()
        }
      }

      // Sky Observation Terrace milestone
      if (!player.reachedTerrace && player.y >= 7.0 && player.x > 21 && player.z > 9) {
        player.reachedTerrace = true
        sfx.playQuestClaim()
        callbacksRef.current.onReachTerrace()
        showToast(t.terraceUnlocked)
      }

      // Collectible FreshGems
      for (const g of gems) {
        if (g.collectedUntil > now) {
          g.mesh.visible = false
          continue
        }
        g.mesh.visible = true
        g.mesh.rotation.y = elapsed * 2.1 + g.id
        g.mesh.position.y = g.baseY + Math.sin(elapsed * 2.8 + g.id) * 0.25
        const dx = player.x - g.x
        const dz = player.z - g.z
        const dy = player.y + 1.5 - g.mesh.position.y
        if (dx * dx + dz * dz < 2.25 && Math.abs(dy) < 2.2) {
          g.collectedUntil = now + 18000
          g.mesh.visible = false
          sfx.playGemCollect()
          callbacksRef.current.onCollectGem()
          showToast(t.gemCollected)
        }
      }

      // Animate monument crystals & clouds
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
      if (!player.grounded) currentPose = player.vy > 0 ? 'jump' : 'fall'
      else if (activeEmoteRef.current) currentPose = activeEmoteRef.current
      else if (isMoving) currentPose = isSprinting ? 'run' : 'walk'

      localRig.root.position.set(player.x, player.y, player.z)
      localRig.root.rotation.y = player.rotY
      localRig.update(dt, elapsed, currentPose)

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
        setOnlineCount(1 + remotePlayers.size + (botsEnabledRef.current ? bots.length : 0))
      }

      // Smooth 3rd-person orbit camera (zero allocation!)
      const camX = player.x + Math.sin(camYaw) * Math.cos(camPitch) * camDist
      const camY = player.y + 2.45 + Math.sin(camPitch) * camDist
      const camZ = player.z + Math.cos(camYaw) * Math.cos(camPitch) * camDist
      desiredCamPos.set(camX, Math.max(1.2, camY), camZ)
      camera.position.lerp(desiredCamPos, Math.min(1, dt * 11))
      lookTarget.set(player.x, player.y + 2.2, player.z)
      camera.lookAt(lookTarget)

      renderer.render(scene, camera)
    }

    rafId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafId)
      mp.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerEnd)
      renderer.domElement.removeEventListener('pointercancel', onPointerEnd)
      renderer.domElement.removeEventListener('wheel', onWheel)
      renderer.domElement.removeEventListener('contextmenu', onContext)

      localRig.dispose()
      for (const bot of bots) bot.rig.dispose()
      for (const entry of remotePlayers.values()) entry.rig.dispose()
      for (const d of disposables) d.dispose()
      renderer.dispose()
      rendererRef.current = null
      sunLightRef.current = null
      sceneRef.current = null
      cloudsGroupRef.current = null
    }
  }, [roomCode, playerId, lang, showToast, t.gemCollected, t.terraceUnlocked, triggerEmote])

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
      className="relative h-[calc(100dvh-56px)] sm:h-[calc(100dvh-64px)] w-full overflow-hidden bg-sky-200 select-none"
      style={{ overscrollBehavior: 'none' }}
    >
      {/* 3D Canvas Host */}
      <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" style={{ touchAction: 'none' }} />

      {/* TOP HUD BAR (Responsive for PC, Tablet & Mobile) */}
      <div className="pointer-events-none absolute top-2.5 sm:top-3.5 left-2.5 sm:left-3.5 right-2.5 sm:right-3.5 flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={onBackHome}
            className="flex items-center gap-1 rounded-xl bg-slate-950/75 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold text-sky-50 border border-sky-400/30 backdrop-blur-md hover:bg-slate-900 transition cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-sky-400" />
            <span className="hidden xs:inline">{t.backToLobby}</span>
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2 rounded-xl bg-slate-950/75 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold text-sky-50 border border-sky-400/30 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">{t.roomLabel}</span>
            <span className="font-mono text-sky-300">{roomCode}</span>
            <span className="flex items-center gap-1 text-sky-200/80 pl-1 border-l border-sky-400/20">
              <Users className="h-3.5 w-3.5" />
              {onlineCount}
            </span>
          </div>

          <button
            onClick={handleCopyInvite}
            className="flex items-center gap-1 rounded-xl bg-sky-500/90 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-extrabold text-slate-950 shadow-lg hover:bg-sky-400 transition cursor-pointer"
          >
            {copiedInvite ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copiedInvite ? t.inviteCopied : t.inviteBtn}</span>
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
          {/* FreshGems live counter */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-950/75 px-2.5 py-1.5 sm:py-2 text-xs font-extrabold text-sky-100 border border-sky-400/30 backdrop-blur-md">
            <FreshGemShard size={15} />
            <span>{freshGems}</span>
          </div>

          {/* Quality + FPS switcher (Eko / Średnia / Wysoka) */}
          <button
            onClick={cycleQuality}
            title="Graphics Quality"
            className="flex items-center gap-1 rounded-xl bg-slate-950/75 px-2.5 py-1.5 sm:py-2 text-xs font-bold text-sky-100 border border-sky-400/30 backdrop-blur-md hover:bg-slate-900 transition cursor-pointer"
          >
            <Gauge className="h-3.5 w-3.5 text-sky-400" />
            <span>{t.quality[quality]}</span>
            <span className="hidden md:inline font-mono text-[10px] text-emerald-300/90 pl-0.5">
              {fpsDisplay} FPS
            </span>
          </button>

          {/* Touch Controls Toggle (auto-on for phone/tablet, manual override on PC) */}
          <button
            onClick={() => {
              setTouchMode((v) => !v)
              sfx.playClick()
            }}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 sm:py-2 text-xs font-bold border backdrop-blur-md transition cursor-pointer ${
              touchMode
                ? 'bg-sky-500/30 text-sky-50 border-sky-300/60'
                : 'bg-slate-950/75 text-slate-300 border-slate-500/30'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5 text-sky-300" />
            <span className="hidden lg:inline">{touchMode ? t.touchOn : t.touchOff}</span>
          </button>

          <button
            onClick={() => setBotsEnabled((b) => !b)}
            className={`hidden md:flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 sm:py-2 text-xs font-bold border backdrop-blur-md transition cursor-pointer ${
              botsEnabled
                ? 'bg-slate-950/75 text-sky-100 border-sky-400/30'
                : 'bg-slate-950/55 text-slate-400 border-slate-500/30'
            }`}
          >
            <Bot className="h-3.5 w-3.5 text-sky-400" />
            {botsEnabled ? t.botsOn : t.botsOff}
          </button>

          <button
            onClick={toggleSound}
            className="flex items-center gap-1 rounded-xl bg-slate-950/75 px-2.5 py-1.5 sm:py-2 text-xs font-bold text-sky-100 border border-sky-400/30 backdrop-blur-md hover:bg-slate-900 transition cursor-pointer"
            aria-label={soundEnabled ? t.soundOn : t.soundOff}
          >
            {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-sky-400" /> : <VolumeX className="h-3.5 w-3.5 text-slate-400" />}
          </button>

          <button
            onClick={onOpenAvatar}
            className="flex items-center gap-1 rounded-xl bg-slate-950/75 px-2.5 py-1.5 sm:py-2 text-xs font-bold text-sky-200 border border-sky-400/40 backdrop-blur-md hover:bg-sky-950 transition cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-sky-400" />
            <span>{t.quickAvatar}</span>
          </button>
        </div>
      </div>

      {/* REWARD / EVENT TOAST */}
      {toast && (
        <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 z-30 animate-[rewardPop_0.35s_ease-out]">
          <div className="flex items-center gap-2 rounded-full bg-slate-950/90 border border-sky-400/60 px-4 py-2 text-xs sm:text-sm font-extrabold text-sky-100 shadow-[0_8px_30px_rgba(14,165,233,0.45)] backdrop-blur-md">
            <FreshGemShard size={17} />
            {toast}
          </div>
        </div>
      )}

      {/* CHAT PANEL (Collapsible on phones/tablets so the viewport stays spacious!) */}
      <div
        className={`pointer-events-auto absolute left-3 z-20 ${
          touchMode ? 'top-16 sm:top-16' : 'bottom-4'
        }`}
      >
        {!chatOpen ? (
          <button
            type="button"
            onClick={() => {
              setChatOpen(true)
              setUnreadCount(0)
            }}
            className="relative flex items-center gap-1.5 rounded-xl bg-slate-950/78 px-3 py-2 text-xs font-bold text-sky-100 border border-sky-400/35 backdrop-blur-md shadow-lg hover:bg-slate-900 transition cursor-pointer"
          >
            <MessageSquare className="h-4 w-4 text-sky-400" />
            <span>{t.chatTitle}</span>
            {unreadCount > 0 && (
              <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-400 px-1 text-[10px] font-black text-slate-950">
                {unreadCount}
              </span>
            )}
          </button>
        ) : (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="w-[min(320px,calc(100vw-24px))] rounded-2xl bg-slate-950/80 border border-sky-400/30 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-sky-400/20">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-sky-100">
                <MessageSquare className="h-3.5 w-3.5 text-sky-400" />
                {t.chatTitle}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-sky-300/80">
                  {isSupabaseConfigured ? t.multiplayerHintSupabase : 'Local + Multi-Tab'}
                </span>
                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  className="rounded-lg p-0.5 text-sky-200/70 hover:bg-sky-500/20 hover:text-white cursor-pointer"
                  aria-label="Minimize chat"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="max-h-32 sm:max-h-36 overflow-y-auto px-3 py-2 space-y-1.5 text-xs">
              {messages.map((m) => (
                <div key={m.id} className="leading-snug">
                  <span className={m.system ? 'font-bold text-sky-400' : 'font-extrabold text-sky-200'}>
                    {m.username}:{' '}
                  </span>
                  <span className={m.system ? 'text-sky-100/80' : 'text-white/95'}>{m.text}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendChat} className="flex items-center gap-1.5 p-2 border-t border-sky-400/20 bg-slate-950/60">
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
                className="flex-1 rounded-xl bg-slate-900/90 px-3 py-1.5 text-xs text-white placeholder-sky-200/45 border border-sky-400/25 focus:outline-none focus:border-sky-400"
              />
              <button
                type="submit"
                className="flex items-center justify-center rounded-xl bg-sky-500 p-2 text-slate-950 hover:bg-sky-400 transition cursor-pointer"
                aria-label={t.chatSend}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* DESKTOP EMOTE BAR & CONTROLS (hidden when Touch HUD is active so screen stays ultra-clean) */}
      {!touchMode && (
        <div className="pointer-events-none absolute bottom-4 right-4 hidden sm:flex flex-col items-end gap-2 z-10">
          <div className="pointer-events-auto flex flex-wrap justify-end gap-1.5 rounded-2xl bg-slate-950/75 p-2 border border-sky-400/30 backdrop-blur-xl shadow-2xl">
            {emotesList.map((em) => (
              <button
                key={em.key}
                onClick={() => triggerEmote(em.pose)}
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                  activeEmote === em.pose
                    ? 'bg-sky-400 text-slate-950 shadow-md'
                    : 'bg-sky-500/15 text-sky-100 hover:bg-sky-500/30'
                }`}
              >
                <span className="rounded bg-black/25 px-1.5 py-0.5 font-mono text-[10px]">{em.key}</span>
                <span>{em.label}</span>
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-slate-950/65 px-3 py-1.5 text-[11px] font-semibold text-sky-100/85 border border-sky-400/20 backdrop-blur-md">
            {t.controlsList}
          </div>
        </div>
      )}

      {/* MOBILE / TABLET VIRTUAL THUMBSTICK & ACTION BUTTONS */}
      {touchMode && (
        <>
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 z-10 hidden sm:block">
            <div className="rounded-full bg-slate-950/60 px-3 py-1 text-[11px] font-semibold text-sky-100/85 border border-sky-400/20 backdrop-blur-md">
              {t.touchControlsList}
            </div>
          </div>
          <MobileTouchControls
            onMoveVector={handleTouchMoveVector}
            onJump={handleTouchJump}
            sprintActive={sprintLocked}
            onToggleSprint={() => {
              setSprintLocked((s) => !s)
              sfx.playClick()
            }}
            activeEmote={activeEmote}
            onEmote={triggerEmote}
            labels={{
              jumpBtn: t.jumpBtn,
              sprintBtn: t.sprintBtn,
              emotesLabel: t.emotesLabel,
              emotes: t.emotes,
            }}
          />
        </>
      )}
    </div>
  )
}
