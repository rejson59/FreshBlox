import { kart as buildKartMesh,countryside } from './art/kart'
import {Bricks} from './art/voxel'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { settleKartLap, startKartRun } from '../lib/coinWallet'
import { Flag, Gauge, RotateCcw, Trophy, Zap } from 'lucide-react'
import type { Lang } from '../data/locales'
import type { R6AvatarConfig, WorldKind } from '../data/catalog'
import type { PlayerProfile } from '../store/usePlayerStore'
import {
  InGameMenuDrawer,
  type MenuQuality,
  type MenuDrawerTab,
  type InGameRosterMember,
} from '../components/hud/InGameMenuDrawer'

export interface RacingWorldProps {
  profile: PlayerProfile
  lang: Lang
  roomId?: string
  onlineCount?: number
  roster?: InGameRosterMember[]
  onExit: () => void
  onSwitchWorld: (world: WorldKind) => void
  onWalletUpdate?: (balance: number, xp: number) => void
  onBuyAndEquip?: (
    category: 'outfit' | 'hat' | 'face' | 'trail' | 'back' | 'pet',
    itemId: string,
    price: number,
    currency?: 'gems' | 'coins',
  ) => boolean
  onSkinChange?: (hex: string) => void
  onOpenReport?: () => void
  onOpenInvite?: () => void
}

interface TrackPoint {
  x: number
  z: number
}

// Closed-loop Neon Circuit control points
const TRACK_CONTROL_POINTS: TrackPoint[] = [
  { x: 0, z: 0 },
  { x: 55, z: -8 },
  { x: 95, z: -45 },
  { x: 85, z: -105 },
  { x: 30, z: -135 },
  { x: -35, z: -120 },
  { x: -85, z: -80 },
  { x: -75, z: -20 },
]

const TOTAL_LAPS = 3
const TRACK_WIDTH = 14

export function RacingWorld({
  profile,
  lang,
  roomId = 'KART-1',
  onlineCount = 1,
  roster = [],
  onExit,
  onSwitchWorld,
  onWalletUpdate,
  onOpenReport,
  onOpenInvite,
}: RacingWorldProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [track, setTrack] = useState<'countryside'|'coast'|'valley'>('countryside')
  const [vehicle, setVehicle] = useState<'kart'|'rally'|'formula'|'gt'>('kart')
  const [timeAttack, setTimeAttack] = useState(false)
  const [menuTab, setMenuTab] = useState<MenuDrawerTab>('overview')
  const [quality, setQuality] = useState<MenuQuality>(() =>
    !onWalletUpdate || window.matchMedia('(pointer: coarse)').matches ? 'low' : 'high',
  )
  const [fov, setFov] = useState(68)
  const [sensitivity, setSensitivity] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Race HUD state
  const [countdown, setCountdown] = useState(3)
  const [lap, setLap] = useState(1)
  const [position, setPosition] = useState(1)
  const [speedKmh, setSpeedKmh] = useState(0)
  const [boostCharge, setBoostCharge] = useState(100)
  const [raceTimeMs, setRaceTimeMs] = useState(0)
  const [finished, setFinished] = useState(false)
  const [rewardCoins, setRewardCoins] = useState(0)
  const [resetSignal, setResetSignal] = useState(0)
  const [minimapDots, setMinimapDots] = useState<
    Array<{ x: number; y: number; color: string; isPlayer?: boolean }>
  >([])

  // Input refs
  const keysRef = useRef<Record<string, boolean>>({})
  const touchSteerRef = useRef(0) // -1 left, 0 neutral, 1 right
  const touchGasRef = useRef(0) // 1 gas, -1 brake, 0 coast
  const touchBoostRef = useRef(false)
  const menuOpenRef = useRef(false)
  menuOpenRef.current = menuOpen || setupOpen

  const walletRef = useRef(onWalletUpdate)
  walletRef.current = onWalletUpdate
  const [rewardStatus, setRewardStatus] = useState<'practice' | 'saving' | 'saved' | 'unavailable'>(
    'practice',
  )
  const [unavailable, setUnavailable] = useState(false)

  const trackCurve = useMemo(() => {
    const layouts = {
      countryside: TRACK_CONTROL_POINTS,
      coast: [{x:0,z:0},{x:70,z:-12},{x:96,z:-58},{x:56,z:-78},{x:79,z:-130},{x:0,z:-139},{x:-75,z:-104},{x:-90,z:-46}],
      valley: [{x:0,z:0},{x:45,z:-22},{x:92,z:-12},{x:92,z:-88},{x:35,z:-142},{x:-22,z:-95},{x:-80,z:-125},{x:-84,z:-46}],
    }
    const pts = layouts[track].map((p) => new THREE.Vector3(p.x, 0, p.z))
    return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.45)
  }, [track])

  const mapTrack = useMemo(
    () =>
      trackCurve
        .getSpacedPoints(80)
        .map((p) => `${((p.x + 110) / 230) * 100},${((p.z + 155) / 180) * 100}`)
        .join(' '),
    [trackCurve],
  )

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.().catch(() => {})
      setIsFullscreen(false)
    }
  }, [])

  // Keyboard listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.repeat) return
        setMenuOpen((prev) => !prev)
        return
      }
      if (e.key.toLowerCase() === 'r' && !menuOpenRef.current) {
        setResetSignal((n) => n + 1)
      }
      if (!menuOpenRef.current && (e.key.startsWith('Arrow') || e.key === ' ')) e.preventDefault()
      keysRef.current[e.key.toLowerCase()] = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false
    }
    const clearInput = () => {
      keysRef.current = {}
      touchSteerRef.current = 0
      touchGasRef.current = 0
      touchBoostRef.current = false
    }
    window.addEventListener('blur', clearInput)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('blur', clearInput)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // Three.js Race Engine
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#7DD3FC')
    scene.fog = new THREE.Fog('#BAE6FD', 110, 320)

    const camera = new THREE.PerspectiveCamera(fov, container.clientWidth / container.clientHeight, 0.2, 420)
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: quality !== 'low',
        powerPreference: 'high-performance',
      })
    } catch {
      setUnavailable(true)
      return
    }
    setFinished(false)
    setLap(1)
    setRaceTimeMs(0)
    setRewardCoins(0)
    setRewardStatus('practice')
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 1.5 : 1.25))
    renderer.shadowMap.enabled = quality !== 'low'
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // IBL Environment


    // Lights
    const hemi = new THREE.HemisphereLight('#ffedd1', '#9baa86', 1.3)
    scene.add(hemi)
    const dirLight = new THREE.DirectionalLight('#ffedbd', 2.0)
    dirLight.position.set(45, 80, 35)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.set(1024, 1024)
    dirLight.shadow.camera.near = 10
    dirLight.shadow.camera.far = 240
    const d = 110
    dirLight.shadow.camera.left = -d
    dirLight.shadow.camera.right = d
    dirLight.shadow.camera.top = d
    dirLight.shadow.camera.bottom = -d
    scene.add(dirLight)

    // Ground plane
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshStandardMaterial({ color: '#94aa48', roughness: 0.94, metalness: 0.02 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.05
    ground.receiveShadow = true
    scene.add(ground)

    const createAsphaltTexture = () => {
      const c = document.createElement('canvas')
      c.width = 256
      c.height = 256
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#353740'
      ctx.fillRect(0, 0, 256, 256)
      for (let i = 0; i < 1800; i++) {
        const v = 32 + Math.floor(Math.random() * 28)
        ctx.fillStyle = `rgb(${v},${v + 4},${v + 10})`
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2)
      }
      ctx.fillStyle = '#F8FAFC'
      ctx.fillRect(6, 0, 8, 256)
      ctx.fillRect(242, 0, 8, 256)
      ctx.fillStyle = 'rgba(248, 250, 252, 0.55)'
      ctx.fillRect(125, 16, 6, 96)
      ctx.fillRect(125, 144, 6, 96)
      const tex = new THREE.CanvasTexture(c)
      tex.wrapS = THREE.RepeatWrapping
      tex.wrapT = THREE.RepeatWrapping
      tex.colorSpace=THREE.SRGBColorSpace
      tex.repeat.set(1, 36)
      return tex
    }

    // Track ribbon & neon borders
    const SAMPLES = 220
    const trackGeo = new THREE.BufferGeometry()
    const vertices: number[] = []
    const indices: number[] = []
    const leftBorderPts: THREE.Vector3[] = []
    const rightBorderPts: THREE.Vector3[] = []

    const uvs: number[] = []
    for (let i = 0; i <= SAMPLES; i++) {
      const t = (i % SAMPLES) / SAMPLES
      const pt = trackCurve.getPointAt(t)
      const tangent = trackCurve.getTangentAt(t).normalize()
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x)
      const left = pt.clone().addScaledVector(normal, TRACK_WIDTH / 2)
      const right = pt.clone().addScaledVector(normal, -TRACK_WIDTH / 2)
      vertices.push(left.x, 0.02, left.z, right.x, 0.02, right.z)
      uvs.push(0, i / SAMPLES, 1, i / SAMPLES)
      leftBorderPts.push(left.clone().setY(0.35))
      rightBorderPts.push(right.clone().setY(0.35))
      if (i < SAMPLES) {
        const base = i * 2
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
      }
    }
    trackGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    trackGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    trackGeo.setIndex(indices)
    trackGeo.computeVertexNormals()
    const trackMesh = new THREE.Mesh(
      trackGeo,
      new THREE.MeshStandardMaterial({
        map: createAsphaltTexture(),
        roughness: 0.65,
        metalness: 0.15,
        side: THREE.DoubleSide,
      }),
    )
    trackMesh.receiveShadow = true
    scene.add(trackMesh)

    const clearLandscape = countryside(scene,trackCurve,TRACK_WIDTH)

    // Grandstand near Start/Finish
    const standGroup = new THREE.Group()
    const standBase = new THREE.Mesh(
      new THREE.BoxGeometry(24, 4.5, 7),
      new THREE.MeshStandardMaterial({ color: '#E2E8F0', roughness: 0.6 }),
    )
    standBase.position.y = 2.25
    standBase.castShadow = true
    standBase.receiveShadow = true
    const standRoof = new THREE.Mesh(
      new THREE.BoxGeometry(25, 0.5, 8.5),
      new THREE.MeshStandardMaterial({ color: '#0284C7', roughness: 0.4 }),
    )
    standRoof.position.set(0, 7.2, 0.4)
    standRoof.castShadow = true
    standGroup.add(standBase, standRoof)
    standGroup.position.set(0, 0, 14)
    scene.add(standGroup)

    // Start/Finish Arch
    const startPt = trackCurve.getPointAt(0)
    const startTan = trackCurve.getTangentAt(0).normalize()
    const archGroup = new THREE.Group()
    archGroup.position.copy(startPt)
    archGroup.lookAt(startPt.clone().add(startTan))
    const pillarGeo = new THREE.BoxGeometry(0.8, 6, 0.8)
    const pillarMat = new THREE.MeshStandardMaterial({ color: '#F8FAFC', metalness: 0.4, roughness: 0.3 })
    const pL = new THREE.Mesh(pillarGeo, pillarMat)
    pL.position.set(-TRACK_WIDTH / 2, 3, 0)
    const pR = new THREE.Mesh(pillarGeo, pillarMat)
    pR.position.set(TRACK_WIDTH / 2, 3, 0)
    const checks=new Bricks();for(let i=0;i<20;i++)for(let j=0;j<3;j++)checks.box((i-9.5)*.74,5.7+j*.48,0,.74,.48,.17,(i+j)%2?'#292634':'#fff5d9')
    const clearBanner=checks.finish(archGroup)
    archGroup.add(pL, pR)
    scene.add(archGroup)

    // Boost pads along track
    const boostTs = [0.16, 0.42, 0.68, 0.88]
    const boostPads: THREE.Vector3[] = []
    for (const bt of boostTs) {
      const bp = trackCurve.getPointAt(bt)
      const bTan = trackCurve.getTangentAt(bt).normalize()
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 0.12, 5.2),
        new THREE.MeshStandardMaterial({ color: '#FACC15', emissive: '#F59E0B', emissiveIntensity: 1.5 }),
      )
      pad.position.set(bp.x, 0.08, bp.z)
      pad.lookAt(bp.clone().add(bTan))
      scene.add(pad)
      boostPads.push(bp)
    }

    // Player Kart
    const playerKart = buildKartMesh('#e24222', true, profile.avatar, vehicle)
    const gridT=.974,gridPt=trackCurve.getPointAt(gridT),gridTangent=trackCurve.getTangentAt(gridT)
    playerKart.position.copy(gridPt)
    let playerHeading = Math.atan2(-gridTangent.x, -gridTangent.z)
    playerKart.rotation.y = playerHeading
    scene.add(playerKart)
    camera.position.copy(playerKart.position).add(new THREE.Vector3(0,3.0,6.6).applyAxisAngle(new THREE.Vector3(0,1,0),playerHeading))

    // 3 AI Rival Karts
    const aiConfigs = [
      { color: '#2685cf', offset: 0.015, speed: 34.5, lane: -3.2 },
      { color: '#10B981', offset: 0.025, speed: 32.8, lane: 3.2 },
      { color: '#A855F7', offset: 0.035, speed: 31.2, lane: 0 },
    ]
    const aiKarts = (timeAttack ? [] : aiConfigs).map((cfg) => {
      const mesh = buildKartMesh(cfg.color, false)
      const p=trackCurve.getPointAt(cfg.offset),t=trackCurve.getTangentAt(cfg.offset)
      mesh.position.set(p.x-t.z*cfg.lane,0,p.z+t.x*cfg.lane);mesh.rotation.y=Math.atan2(-t.x,-t.z)
      scene.add(mesh)
      return { ...cfg, mesh, t: cfg.offset, lap: 1, totalProgress: cfg.offset }
    })

    // Countdown timer (3 -> 2 -> 1 -> GO!)
    let countdownSec = 3
    setCountdown(3)
    let speed = 0
    let currentT = gridT
    let leftGrid=false
    let currentLap = 1
    let passedHalfway = false
    let boost = 100
    let boostTimer = 0
    let elapsedMs = 0
    let raceDone = false
    let animId = 0
    let lastTime = performance.now()
    let hudTick = 0
    let alive = true,
      run: Promise<string | null> | null = null
    let pendingLap: Promise<void> = Promise.resolve()
    const notify = timeAttack ? undefined : walletRef.current
    const settle = (lapNo: number) => {
      if (!run || !notify) return
      const thisRun = run
      if (lapNo === TOTAL_LAPS) setRewardStatus('saving')
      pendingLap = pendingLap
        .then(async () => {
          const token = await thisRun
          const receipt = token ? await settleKartLap(token, lapNo) : null
          if (receipt) notify(receipt.balance, receipt.new_credit ? (lapNo === TOTAL_LAPS ? 80 : 25) : 0)
          if (!alive) return
          if (!receipt) setRewardStatus('unavailable')
          else if (lapNo === TOTAL_LAPS) {
            setRewardCoins(receipt.reward)
            setRewardStatus('saved')
          }
        })
        .catch(() => {
          if (alive) setRewardStatus('unavailable')
        })
    }

    const findClosestT = (pos: THREE.Vector3): number => {
      let bestT = currentT
      let bestDist = Infinity
      for (let i = 0; i < 60; i++) {
        const testT = (currentT - 0.06 + (i / 60) * 0.12 + 1) % 1
        const p = trackCurve.getPointAt(testT)
        const dSq = p.distanceToSquared(pos)
        if (dSq < bestDist) {
          bestDist = dSq
          bestT = testT
        }
      }
      return bestT
    }

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate)
      if (notify && !run && !menuOpenRef.current) {
        // Start on the first real frame, not during a discarded StrictMode effect.
        run = startKartRun().catch(() => null)
        void run.then((token) => {
          if (!token && alive) setRewardStatus('unavailable')
        })
      }
      const realDt = Math.max(0, (now - lastTime) / 1000)
      const dt = Math.min(realDt, 0.05)
      lastTime = now

      if (!menuOpenRef.current && countdownSec > 0) {
        countdownSec = Math.max(0, countdownSec - realDt)
        setCountdown(Math.ceil(countdownSec))
      } else if (!menuOpenRef.current && !raceDone) {
        elapsedMs += dt * 1000

        // Inputs
        const k = keysRef.current
        const gasInput =
          (k['w'] || k['arrowup'] ? 1 : 0) - (k['s'] || k['arrowdown'] ? 1 : 0) || touchGasRef.current
        const steerInput =
          (k['a'] || k['arrowleft'] ? 1 : 0) - (k['d'] || k['arrowright'] ? 1 : 0) || -touchSteerRef.current
        const wantBoost = Boolean(k[' '] || touchBoostRef.current)

        if (wantBoost && boost > 12) {
          boostTimer = 0.25
          boost = Math.max(0, boost - 38 * dt)
        } else {
          boost = Math.min(100, boost + 10 * dt)
        }
        if (boostTimer > 0) boostTimer = Math.max(0, boostTimer - dt)

        const maxSpeed = boostTimer > 0 ? 54 : 38
        const accel = boostTimer > 0 ? 48 : 26
        if (gasInput > 0) {
          speed = Math.min(maxSpeed, speed + accel * dt)
        } else if (gasInput < 0) {
          speed = Math.max(-14, speed - 34 * dt)
        } else {
          speed *= Math.pow(0.25, dt)
        }

        const turnFactor = Math.min(1, Math.abs(speed) / 8) * (speed >= 0 ? 1 : -1)
        playerHeading += steerInput * 2.35 * turnFactor * dt
        playerKart.rotation.y = playerHeading

        const forward = new THREE.Vector3(-Math.sin(playerHeading), 0, -Math.cos(playerHeading))
        playerKart.position.addScaledVector(forward, speed * dt)

        // Track boundary soft clamp
        const closestT = findClosestT(playerKart.position)
        const trackCenter = trackCurve.getPointAt(closestT)
        const distFromCenter = playerKart.position.distanceTo(trackCenter)
        if (distFromCenter > TRACK_WIDTH / 2 - 0.8) {
          const pushDir = trackCenter.clone().sub(playerKart.position).normalize()
          playerKart.position.addScaledVector(pushDir, distFromCenter - (TRACK_WIDTH / 2 - 0.8))
          speed *= 0.94
        }

        // Boost pads check
        for (const bp of boostPads) {
          if (playerKart.position.distanceTo(bp) < 3.4) {
            boostTimer = 0.9
            boost = Math.min(100, boost + 25)
          }
        }

        // Lap & checkpoint tracking
        if (closestT > 0.42 && closestT < 0.62) passedHalfway = true
        if (passedHalfway && currentT > 0.85 && closestT < 0.15) {
          passedHalfway = false
          if (currentLap < TOTAL_LAPS) {
            currentLap += 1
            setLap(currentLap)
            settle(currentLap - 1)
          } else {
            raceDone = true
            setFinished(true)
            const finalPos = aiKarts.filter((ai) => ai.totalProgress > currentLap + closestT).length + 1
            setPosition(finalPos)
            setRaceTimeMs(Math.round(elapsedMs))
            settle(TOTAL_LAPS)
          }
        }
        if(currentT>.85 && closestT<.15) leftGrid=true
        currentT = closestT

        // Update AI karts
        const trackLen = trackCurve.getLength()
        for (const ai of aiKarts) {
          ai.t += (ai.speed * dt) / trackLen
          if (ai.t >= 1) {
            ai.t -= 1
            ai.lap += 1
          }
          ai.totalProgress = ai.lap - 1 + ai.t
          const pt = trackCurve.getPointAt(ai.t)
          const tan = trackCurve.getTangentAt(ai.t).normalize()
          const norm = new THREE.Vector3(-tan.z, 0, tan.x)
          ai.mesh.position.copy(pt).addScaledVector(norm, ai.lane)
          ai.mesh.rotation.y=Math.atan2(-tan.x,-tan.z)
        }

        hudTick++
        if (!raceDone && hudTick % 4 === 0) {
          const playerProgress = currentLap - 1 + currentT - (leftGrid?0:1)
          const rank = aiKarts.filter((ai) => ai.totalProgress > playerProgress).length + 1
          setPosition(rank)
          setSpeedKmh(Math.round(Math.abs(speed) * 3.6))
          setBoostCharge(Math.round(boost))
          setRaceTimeMs(Math.round(elapsedMs))
          const toMap = (p: THREE.Vector3) => ({
            x: ((p.x + 110) / 230) * 100,
            y: ((p.z + 155) / 180) * 100,
          })
          setMinimapDots([
            ...aiKarts.map((ai) => ({ ...toMap(ai.mesh.position), color: ai.color })),
            { ...toMap(playerKart.position), color: '#38BDF8', isPlayer: true },
          ])
        }
      }

      // Smooth chase camera + dynamic FOV boost kick
      const targetFov = boostTimer > 0 ? Math.min(88, fov + 11) : fov
      if (Math.abs(camera.fov - targetFov) > 0.15) {
        camera.fov += (targetFov - camera.fov) * 0.14
        camera.updateProjectionMatrix()
      }
      const camOffset = new THREE.Vector3(0, 2.95, 6.55).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        playerHeading,
      )
      const desiredCamPos = playerKart.position.clone().add(camOffset)
      camera.position.lerp(desiredCamPos, 0.14)
      camera.lookAt(playerKart.position.clone().add(new THREE.Vector3(0, 1.3, 0)))

      renderer.render(scene, camera)
    }

    animId = requestAnimationFrame(animate)

    const onResize = () => {
      if (!container) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      alive = false
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      clearLandscape();clearBanner();[playerKart,...aiKarts.map(k=>k.mesh)].forEach(k=>k.userData.disposeBricks?.())
      const materials = new Set<THREE.Material>(),
        geometries = new Set<THREE.BufferGeometry>(),
        textures = new Set<THREE.Texture>()
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          geometries.add(obj.geometry)
          for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) materials.add(mat)
        }
      })
      for (const m of materials) {
        for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value)
        m.dispose()
      }
      for (const g of geometries) g.dispose()
      for (const t of textures) t.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [trackCurve, quality, fov, profile.avatar, resetSignal, vehicle, timeAttack])

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const remS = s % 60
    const tenths = Math.floor((ms % 1000) / 100)
    return `${m}:${String(remS).padStart(2, '0')}.${tenths}`
  }

  if (unavailable)
    return (
      <main className="grid min-h-dvh place-items-center bg-[#16171b] p-5 text-center text-white">
        <div>
          <h1 className="text-3xl font-bold">Turbo Kart</h1>
          <p className="my-4">
            {lang === 'pl'
              ? 'Ten tor wymaga WebGL 2. Skyline Rush działa także bez akceleracji 3D.'
              : 'This circuit requires WebGL 2. Skyline Rush also runs without 3D acceleration.'}
          </p>
          <button onClick={onExit} className="rounded-lg bg-orange-400 px-4 py-2 font-bold text-black">
            ← {lang === 'pl' ? 'Wróć do gier' : 'Back to games'}
          </button>
        </div>
      </main>
    )
  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-[#060B19] select-none">
      <div ref={mountRef} className="h-full w-full" />

      {/* 3-2-1-GO! Start Countdown */}
      {countdown > 0 && (
        <div className="pointer-events-none fixed inset-x-0 top-14 z-20 flex justify-center">
          <div className="rounded-3xl border border-white/25 bg-slate-950/75 px-5 py-2 text-center shadow-2xl backdrop-blur-md">
            <div className="font-display text-3xl font-black tracking-tight text-amber-300 drop-shadow">
              {countdown}
            </div>
            <div className="mt-1 text-xs font-extrabold uppercase tracking-widest text-slate-300">
              {lang === 'pl' ? 'Przygotuj się...' : 'Get Ready...'}
            </div>
          </div>
        </div>
      )}

      {/* Live Track Minimap */}
      {minimapDots.length > 0 && (
        <div className="pointer-events-none fixed left-3 top-16 z-20 hidden h-28 w-28 rounded-2xl border border-white/15 bg-slate-950/70 p-2 backdrop-blur-md sm:block">
          <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
            <polyline points={mapTrack} fill="none" stroke="#94a3b8" strokeWidth="5" strokeLinejoin="round" />
            <polyline
              points={mapTrack}
              fill="none"
              stroke="#334155"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {minimapDots.map((dot, idx) => (
              <circle
                key={idx}
                cx={dot.x}
                cy={dot.y}
                r={dot.isPlayer ? 5.5 : 4}
                fill={dot.color}
                stroke="#FFFFFF"
                strokeWidth={dot.isPlayer ? 1.8 : 1}
              />
            ))}
          </svg>
        </div>
      )}

      {/* Top HUD */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2.5 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Menu"
            className="flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-slate-950/75 px-3 text-xs font-extrabold text-white backdrop-blur-md hover:bg-slate-900 cursor-pointer"
          >
            <span>☰</span>
            <span className="hidden sm:inline">Menu</span>
          </button>
          <button type="button" onClick={()=>setSetupOpen(true)} className="rounded-xl bg-slate-950/75 px-3 py-2 text-xs font-bold text-white" aria-label={lang==='pl'?'Ustawienia wyścigu':'Race setup'}>⚙</button>
          <div className="flex items-center gap-2.5 rounded-xl border border-cyan-400/30 bg-slate-950/75 px-3 py-1.5 backdrop-blur-md">
            <Flag className="h-4 w-4 text-cyan-400" />
            <span className="font-mono text-xs font-black text-white">
              {lang === 'pl' ? 'OKRĄŻENIE' : 'LAP'} {lap}/{TOTAL_LAPS}
            </span>
            <span className="text-slate-500">·</span>
            <span className="font-mono text-xs font-black text-amber-300">{timeAttack ? (lang === 'pl' ? 'NA CZAS' : 'TIME ATTACK') : `${position}/4`}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-slate-950/75 px-3 py-1.5 backdrop-blur-md">
          <Gauge className="h-4 w-4 text-orange-400" />
          <span className="font-mono text-sm font-black text-white">{speedKmh} km/h</span>
          <span className="text-slate-500">·</span>
          <span className="font-mono text-xs font-bold text-slate-300">{formatTime(raceTimeMs)}</span>
        </div>
      </div>

      {/* Bottom Boost Bar + Mobile Controls */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex items-end justify-between p-3 sm:p-5">
        {/* Left: Mobile Steer */}
        <div className="pointer-events-auto flex items-center gap-2 sm:hidden [@media(pointer:coarse)]:flex">
          <button
            type="button"
            onPointerDown={() => {
              touchSteerRef.current = -1
            }}
            onPointerUp={() => {
              touchSteerRef.current = 0
            }}
            onPointerLeave={() => {
              touchSteerRef.current = 0
            }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-slate-950/75 text-xl font-black text-white backdrop-blur-md active:bg-cyan-500/40"
          >
            ◀
          </button>
          <button
            type="button"
            onPointerDown={() => {
              touchSteerRef.current = 1
            }}
            onPointerUp={() => {
              touchSteerRef.current = 0
            }}
            onPointerLeave={() => {
              touchSteerRef.current = 0
            }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-slate-950/75 text-xl font-black text-white backdrop-blur-md active:bg-cyan-500/40"
          >
            ▶
          </button>
        </div>

        {/* Center: Boost Meter */}
        <div className="mx-auto flex flex-col items-center gap-1 rounded-xl border border-white/15 bg-slate-950/75 px-4 py-2 backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-[10px] font-black tracking-wider text-amber-300">
            <Zap className="h-3.5 w-3.5" />
            TURBO ({boostCharge}%)
          </div>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-amber-400 transition-all"
              style={{ width: `${boostCharge}%` }}
            />
          </div>
        </div>

        {/* Right: Mobile Gas / Boost */}
        <div className="pointer-events-auto flex items-center gap-2 sm:hidden [@media(pointer:coarse)]:flex">
          <button
            type="button"
            onPointerDown={() => {
              touchBoostRef.current = true
            }}
            onPointerUp={() => {
              touchBoostRef.current = false
            }}
            onPointerLeave={() => {
              touchBoostRef.current = false
            }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/25 text-xs font-black text-amber-200 backdrop-blur-md active:bg-amber-500/50"
          >
            NITRO
          </button>
          <button
            type="button"
            onPointerDown={() => {
              touchGasRef.current = 1
            }}
            onPointerUp={() => {
              touchGasRef.current = 0
            }}
            onPointerLeave={() => {
              touchGasRef.current = 0
            }}
            className="flex h-14 w-16 items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/25 text-xs font-black text-emerald-200 backdrop-blur-md active:bg-emerald-500/50"
          >
            GAS
          </button>
        </div>
      </div>

      {/* Finish Modal */}
      {finished && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-cyan-400/35 bg-slate-900/95 p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-300">
              <Trophy className="h-8 w-8" />
            </div>
            <h2 className="font-display text-2xl font-black text-white">
              {timeAttack ? (lang === 'pl' ? 'Próba czasu ukończona!' : 'Time attack complete!') : (lang === 'pl' ? `Miejsce #${position}!` : `Finished #${position}!`)}
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              {lang === 'pl' ? 'Czas wyścigu:' : 'Race time:'}{' '}
              <span className="font-mono font-bold text-white">{formatTime(raceTimeMs)}</span>
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm font-black text-amber-300">
              <span>
                {rewardStatus === 'saved'
                  ? `+${rewardCoins} FreshCoins`
                  : rewardStatus === 'saving'
                    ? lang === 'pl'
                      ? 'Zapisywanie nagrody…'
                      : 'Saving reward…'
                    : rewardStatus === 'unavailable'
                      ? lang === 'pl'
                        ? 'Nagroda niepotwierdzona przez serwer'
                        : 'Reward not confirmed by server'
                      : lang === 'pl'
                        ? 'Trening / próba czasu · bez nagród'
                        : 'Practice / time attack · no rewards'}
              </span>
            </div>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setFinished(false)
                  setLap(1)
                  setRaceTimeMs(0)
                  setResetSignal((n) => n + 1)
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-black text-white cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                {lang === 'pl' ? 'Jedź ponownie' : 'Race Again'}
              </button>
              <button
                type="button"
                onClick={onExit}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold text-white cursor-pointer"
              >
                {lang === 'pl' ? 'Wyjdź' : 'Exit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {setupOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4"><section role="dialog" aria-label={lang==='pl'?'Ustawienia wyścigu':'Race setup'} className="w-full max-w-md rounded-2xl border border-white/20 bg-slate-900 p-5 text-white">
        <h2 className="mb-3 text-xl font-bold">{lang==='pl'?'Ustawienia wyścigu':'Race setup'}</h2>
        <p className="mb-3 text-xs text-slate-300">{lang==='pl'?'Zmiana ustawień rozpoczyna nowy wyścig. Próba czasu nie przyznaje nagród.':'Changes restart the race. Time attack does not award rewards.'}</p>
        <label className="mb-2 block text-sm">{lang==='pl'?'Tor':'Track'} <select className="ml-2 rounded bg-slate-700 p-2" value={track} onChange={e=>setTrack(e.target.value as typeof track)}><option value="countryside">{lang==='pl'?'Zielony tor':'Green Circuit'}</option><option value="coast">{lang==='pl'?'Zakola':'Bends'}</option><option value="valley">{lang==='pl'?'Dolina':'Valley'}</option></select></label>
        <label className="mb-2 block text-sm">{lang==='pl'?'Pojazd':'Vehicle'} <select className="ml-2 rounded bg-slate-700 p-2" value={vehicle} onChange={e=>setVehicle(e.target.value as typeof vehicle)}><option value="kart">Kart</option><option value="rally">{lang==='pl'?'Rajdowe':'Rally'}</option><option value="formula">Formula</option><option value="gt">GT</option></select></label>
        <label className="mb-4 block text-sm"><input type="checkbox" checked={timeAttack} onChange={e=>setTimeAttack(e.target.checked)} /> {lang==='pl'?'Próba czasu (bez botów)':'Time attack (no bots)'}</label>
        <button onClick={()=>setSetupOpen(false)} className="rounded-lg bg-amber-300 px-4 py-2 font-bold text-slate-950">{lang==='pl'?'Jedź':'Drive'}</button>
      </section></div>}
      {/* Shared In-Game Pause Menu */}
      {!onWalletUpdate && menuOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/75 p-4">
          <div
            role="dialog"
            aria-label="Turbo Kart"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl border border-white/20 bg-[#1d1e22] p-6 text-white"
          >
            <p className="text-xs text-orange-300">TURBO KART / SOLO</p>
            <h2 className="my-2 text-2xl font-bold">{lang === 'pl' ? 'Trening z botami' : 'AI practice'}</h2>
            <p className="mb-4 text-sm text-gray-300">
              {lang === 'pl'
                ? 'Strzałki lub WASD: jazda. Spacja: doładowanie. W treningu gościa nie zdobywasz waluty.'
                : 'Arrows or WASD to drive. Space for boost. Guest practice does not award currency.'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setMenuOpen(false)}
                className="rounded-lg bg-orange-400 px-4 py-2 text-black"
              >
                {lang === 'pl' ? 'Wznów' : 'Resume'}
              </button>
              <button onClick={onExit} className="rounded-lg border border-white/30 px-4 py-2">
                {lang === 'pl' ? 'Wróć do gier' : 'Back to games'}
              </button>
            </div>
          </div>
        </div>
      )}
      {onWalletUpdate && (
        <InGameMenuDrawer
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          worldKind="racing"
          lang={lang}
          username={profile.username}
          rankName="Turbo Racer"
          roomCode={roomId}
          onlineCount={onlineCount}
          roster={roster}
          touchMode={false}
          pointerLocked={false}
          clickToLock={false}
          shiftLockAlign={false}
          onTogglePointerLock={() => {}}
          onChangeClickToLock={() => {}}
          onChangeShiftLockAlign={() => {}}
          onResetPosition={() => {
            setResetSignal((n) => n + 1)
            setMenuOpen(false)
          }}
          quality={quality}
          onChangeQuality={setQuality}
          fov={fov}
          onChangeFov={setFov}
          mouseSensitivity={sensitivity}
          onChangeMouseSensitivity={setSensitivity}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onOpenWardrobe={() => {}}
          onCopyInvite={onOpenInvite ?? (() => {})}
          onOpenFeedback={onOpenReport ?? (() => {})}
          onSwitchWorld={() => onSwitchWorld('lobby')}
          worldTime="night"
          supabaseConnected={true}
          copiedInvite={false}
          onChangeWorldTime={() => {}}
          onToggleTouchMode={() => {}}
          onLeaveToHome={onExit}
        />
      )}
    </div>
  )
}
