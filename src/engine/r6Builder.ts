import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { FaceId, HatId, OutfitId, R6AvatarConfig } from '../data/catalog'
import { PlayerPose } from '../lib/multiplayer'

// Cached shared geometries & lightweight textures to slash GPU memory & draw-call setup
let sharedStudTex: THREE.CanvasTexture | null = null
let sharedBlobShadowTex: THREE.CanvasTexture | null = null
let sharedR6Geos: {
  torso: THREE.BufferGeometry
  head: THREE.BufferGeometry
  limb: THREE.BufferGeometry
  chestEmblem: THREE.BufferGeometry
  facePlane: THREE.BufferGeometry
  shadowDisc: THREE.BufferGeometry
} | null = null

export function getSharedR6Geometries() {
  if (!sharedR6Geos) {
    sharedR6Geos = {
      torso: new RoundedBoxGeometry(1.18, 1.32, 0.62, 2, 0.08),
      head: new RoundedBoxGeometry(0.76, 0.76, 0.76, 2, 0.14),
      limb: new RoundedBoxGeometry(0.54, 1.28, 0.54, 2, 0.08),
      chestEmblem: new THREE.PlaneGeometry(0.46, 0.46),
      facePlane: new THREE.PlaneGeometry(0.58, 0.54),
      shadowDisc: new THREE.PlaneGeometry(1.75, 1.75),
    }
  }
  return sharedR6Geos
}

/** Shared subtle Fresh Glossy stud texture — reused across the entire 3D world */
export function getSharedFreshStudTexture(): THREE.CanvasTexture {
  if (sharedStudTex) return sharedStudTex
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 128, 128)

  const positions = [32, 96]
  for (const x of positions) {
    for (const y of positions) {
      ctx.beginPath()
      ctx.arc(x, y + 2, 16, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(15, 23, 42, 0.075)'
      ctx.fill()

      const grad = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, 16)
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.96)')
      grad.addColorStop(0.75, 'rgba(226, 238, 248, 0.9)')
      grad.addColorStop(1, 'rgba(148, 163, 184, 0.22)')
      ctx.beginPath()
      ctx.arc(x, y, 15, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 2
  sharedStudTex = tex
  return tex
}

/** Lightweight radial foot shadow texture (keeps avatars grounded even when shadow maps are off) */
function getBlobShadowTexture(): THREE.CanvasTexture {
  if (sharedBlobShadowTex) return sharedBlobShadowTex
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30)
  grad.addColorStop(0, 'rgba(12, 24, 48, 0.38)')
  grad.addColorStop(0.65, 'rgba(12, 24, 48, 0.14)')
  grad.addColorStop(1, 'rgba(12, 24, 48, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(canvas)
  sharedBlobShadowTex = tex
  return tex
}

const faceTexCache = new Map<FaceId, THREE.CanvasTexture>()
let chestLogoTexCache: THREE.CanvasTexture | null = null

function getFaceTexture(faceId: FaceId): THREE.CanvasTexture {
  const existing = faceTexCache.get(faceId)
  if (existing) return existing

  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 256, 256)

  if (faceId === 'fresh-smile') {
    ctx.fillStyle = '#0F172A'
    ctx.beginPath()
    ctx.ellipse(88, 106, 13, 19, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(168, 106, 13, 19, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(83, 98, 5.5, 0, Math.PI * 2)
    ctx.arc(163, 98, 5.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(56,189,248,0.28)'
    ctx.beginPath()
    ctx.ellipse(62, 132, 14, 7, 0, 0, Math.PI * 2)
    ctx.ellipse(194, 132, 14, 7, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#0F172A'
    ctx.lineWidth = 10
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(128, 136, 40, 0.2 * Math.PI, 0.8 * Math.PI)
    ctx.stroke()
  } else if (faceId === 'wink-pro') {
    ctx.fillStyle = '#0F172A'
    ctx.beginPath()
    ctx.ellipse(88, 106, 13, 19, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(83, 98, 5.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#0F172A'
    ctx.lineWidth = 10
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(168, 112, 16, 1.1 * Math.PI, 1.9 * Math.PI)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(132, 138, 36, 0.12 * Math.PI, 0.72 * Math.PI)
    ctx.stroke()
  } else if (faceId === 'arctic-visor') {
    const grad = ctx.createLinearGradient(32, 74, 224, 142)
    grad.addColorStop(0, '#0284C7')
    grad.addColorStop(0.5, '#38BDF8')
    grad.addColorStop(1, '#E0F2FE')
    ctx.fillStyle = '#0C192F'
    ctx.beginPath()
    ctx.roundRect(28, 70, 200, 74, 24)
    ctx.fill()
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.roundRect(38, 80, 180, 54, 18)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.beginPath()
    ctx.roundRect(52, 88, 88, 12, 6)
    ctx.fill()
    ctx.strokeStyle = '#0F172A'
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(128, 152, 24, 0.18 * Math.PI, 0.82 * Math.PI)
    ctx.stroke()
  } else if (faceId === 'cool-shades') {
    ctx.fillStyle = '#0F172A'
    ctx.beginPath()
    ctx.roundRect(32, 82, 86, 52, 14)
    ctx.roundRect(138, 82, 86, 52, 14)
    ctx.fill()
    ctx.fillRect(114, 96, 28, 12)
    ctx.strokeStyle = '#38BDF8'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(46, 120)
    ctx.lineTo(74, 92)
    ctx.moveTo(152, 120)
    ctx.lineTo(180, 92)
    ctx.stroke()
    ctx.strokeStyle = '#0F172A'
    ctx.lineWidth = 9
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(130, 148, 30, 0.15 * Math.PI, 0.72 * Math.PI)
    ctx.stroke()
  } else if (faceId === 'star-eyes') {
    const drawStar = (cx: number, cy: number, r: number) => {
      ctx.fillStyle = '#0284C7'
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const rad = i % 2 === 0 ? r : r * 0.42
        const a = (i * Math.PI) / 4 - Math.PI / 2
        const x = cx + Math.cos(a) * rad
        const y = cy + Math.sin(a) * rad
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.arc(cx, cy, 5, 0, Math.PI * 2)
      ctx.fill()
    }
    drawStar(86, 106, 24)
    drawStar(170, 106, 24)
    ctx.strokeStyle = '#0F172A'
    ctx.lineWidth = 9
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(128, 140, 38, 0.18 * Math.PI, 0.82 * Math.PI)
    ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  faceTexCache.set(faceId, tex)
  return tex
}

function getChestLogoTexture(): THREE.CanvasTexture {
  if (chestLogoTexCache) return chestLogoTexCache
  const canvas = document.createElement('canvas')
  canvas.width = 192
  canvas.height = 192
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 192, 192)
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.beginPath()
  ctx.roundRect(42, 34, 108, 28, 9)
  ctx.roundRect(42, 34, 30, 126, 9)
  ctx.roundRect(42, 86, 82, 24, 8)
  ctx.fill()
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  chestLogoTexCache = tex
  return tex
}

function createNameplateTexture(username: string, rank: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 384
  canvas.height = 96
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 384, 96)

  ctx.fillStyle = 'rgba(7, 17, 36, 0.78)'
  ctx.beginPath()
  ctx.roundRect(14, 12, 356, 72, 20)
  ctx.fill()

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)'
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.fillStyle = '#F0F9FF'
  ctx.font = '800 28px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(username.slice(0, 18), 192, 40)

  ctx.fillStyle = '#7DD3FC'
  ctx.font = '700 17px Inter, system-ui, sans-serif'
  ctx.fillText(rank, 192, 68)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function createSpeechTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 440
  canvas.height = 112
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 440, 112)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)'
  ctx.beginPath()
  ctx.roundRect(12, 10, 416, 78, 22)
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(206, 88)
  ctx.lineTo(220, 106)
  ctx.lineTo(234, 88)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = '#38BDF8'
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.roundRect(12, 10, 416, 78, 22)
  ctx.stroke()

  ctx.fillStyle = '#0F172A'
  ctx.font = '700 22px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const clean = text.length > 34 ? `${text.slice(0, 32)}…` : text
  ctx.fillText(clean, 220, 49)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

interface OutfitColors {
  torso: string
  arms: string
  legs: string
  hasChestEmblem: boolean
}

function getOutfitColors(outfitId: OutfitId, skinColor: string): OutfitColors {
  switch (outfitId) {
    case 'classic-remaster':
      return { torso: '#2563EB', arms: skinColor, legs: '#22C55E', hasChestEmblem: false }
    case 'arctic-frost':
      return { torso: '#E0F2FE', arms: '#7DD3FC', legs: '#0369A1', hasChestEmblem: true }
    case 'midnight-neon':
      return { torso: '#0F172A', arms: '#0284C7', legs: '#1E293B', hasChestEmblem: true }
    case 'glacier-captain':
      return { torso: '#0891B2', arms: '#E0F2FE', legs: '#0C4A6E', hasChestEmblem: true }
    case 'crystal-royal':
      return { torso: '#38BDF8', arms: '#F8FAFC', legs: '#1D4ED8', hasChestEmblem: true }
    case 'fresh-creator':
    default:
      return { torso: '#0EA5E9', arms: '#38BDF8', legs: '#1E3A8A', hasChestEmblem: true }
  }
}

function buildHatGroup(hatId: HatId, castShadow: boolean): { group: THREE.Group; disposables: Array<{ dispose: () => void }> } {
  const group = new THREE.Group()
  const disposables: Array<{ dispose: () => void }> = []
  if (hatId === 'none') return { group, disposables }

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g)
    return g
  }
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m)
    return m
  }

  if (hatId === 'fresh-cap') {
    const crown = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(0.84, 0.32, 0.84, 2, 0.08)),
      trackMat(new THREE.MeshStandardMaterial({ color: '#0284C7', roughness: 0.24, metalness: 0.06 })),
    )
    crown.position.y = 0.44
    crown.castShadow = castShadow
    group.add(crown)

    const brim = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(0.76, 0.09, 0.46, 2, 0.03)),
      trackMat(new THREE.MeshStandardMaterial({ color: '#F0F9FF', roughness: 0.2, metalness: 0.05 })),
    )
    brim.position.set(0, 0.31, 0.5)
    brim.castShadow = castShadow
    group.add(brim)
  } else if (hatId === 'headphones') {
    const band = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.46, 0.065, 8, 18, Math.PI)),
      trackMat(new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.28, metalness: 0.35 })),
    )
    band.position.y = 0.1
    group.add(band)

    const cupGeo = trackGeo(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 14))
    const cupMat = trackMat(new THREE.MeshStandardMaterial({ color: '#1E293B', roughness: 0.25, metalness: 0.3 }))
    const ledGeo = trackGeo(new THREE.TorusGeometry(0.14, 0.028, 6, 16))
    const ledMat = trackMat(new THREE.MeshBasicMaterial({ color: '#38BDF8' }))

    for (const side of [-1, 1]) {
      const cup = new THREE.Mesh(cupGeo, cupMat)
      cup.rotation.z = Math.PI / 2
      cup.position.set(side * 0.44, 0.04, 0)
      group.add(cup)

      const led = new THREE.Mesh(ledGeo, ledMat)
      led.rotation.y = Math.PI / 2
      led.position.set(side * 0.51, 0.04, 0)
      group.add(led)
    }
  } else if (hatId === 'crystal-halo') {
    const halo = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.48, 0.052, 8, 22)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: '#7DD3FC',
          emissive: '#38BDF8',
          emissiveIntensity: 0.85,
          roughness: 0.15,
          metalness: 0.2,
        }),
      ),
    )
    halo.rotation.x = Math.PI / 2
    halo.position.y = 0.66
    group.add(halo)
  } else if (hatId === 'frost-horns') {
    const hornGeo = trackGeo(new THREE.ConeGeometry(0.13, 0.5, 6))
    const hornMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#38BDF8',
        emissive: '#0284C7',
        emissiveIntensity: 0.35,
        roughness: 0.16,
        metalness: 0.15,
      }),
    )
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(hornGeo, hornMat)
      horn.position.set(side * 0.32, 0.52, 0.04)
      horn.rotation.z = -side * 0.35
      horn.rotation.x = 0.12
      horn.castShadow = castShadow
      group.add(horn)
    }
  } else if (hatId === 'arctic-crown') {
    const base = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.42, 0.38, 0.22, 6)),
      trackMat(new THREE.MeshStandardMaterial({ color: '#FBBF24', roughness: 0.22, metalness: 0.68 })),
    )
    base.position.y = 0.48
    base.castShadow = castShadow
    group.add(base)

    const gem = new THREE.Mesh(
      trackGeo(new THREE.OctahedronGeometry(0.15, 0)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: '#38BDF8',
          emissive: '#0EA5E9',
          emissiveIntensity: 0.7,
          roughness: 0.12,
          metalness: 0.2,
        }),
      ),
    )
    gem.position.set(0, 0.64, 0.28)
    group.add(gem)
  }

  return { group, disposables }
}

export interface R6RigHandle {
  root: THREE.Group
  body: THREE.Group
  shadowBlob: THREE.Mesh
  update: (dt: number, elapsed: number, pose: PlayerPose) => void
  setSpeech: (text: string | null) => void
  setNameplate: (username: string, rank: string) => void
  dispose: () => void
}

export function createR6Rig(opts: {
  avatar: R6AvatarConfig
  username?: string
  rank?: string
  showNameplate?: boolean
  castShadow?: boolean
}): R6RigHandle {
  const { avatar, username = 'FreshPlayer', rank = 'Crystal I', showNameplate = true, castShadow = true } = opts

  const geos = getSharedR6Geometries()
  const disposables: Array<{ dispose: () => void }> = []
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m)
    return m
  }

  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)

  // Soft blob shadow beneath feet (always keeps R6 grounded even when shadow maps are disabled in Eco mode)
  const shadowBlobMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: getBlobShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    }),
  )
  const shadowBlob = new THREE.Mesh(geos.shadowDisc, shadowBlobMat)
  shadowBlob.rotation.x = -Math.PI / 2
  shadowBlob.position.y = 0.03
  root.add(shadowBlob)

  const colors = getOutfitColors(avatar.outfitId, avatar.skinColor)

  // Lightweight Fresh Glossy standard materials (much faster on integrated GPUs & mobile than MeshPhysicalMaterial)
  const makeGlossyMat = (hex: string) =>
    trackMat(
      new THREE.MeshStandardMaterial({
        color: hex,
        roughness: 0.25,
        metalness: 0.08,
      }),
    )

  const torsoMat = makeGlossyMat(colors.torso)
  const armMat = makeGlossyMat(colors.arms)
  const legMat = makeGlossyMat(colors.legs)
  const headMat = makeGlossyMat(avatar.skinColor)

  // Classic 1:1 R6 proportions — grounded feet at y = 0
  const torso = new THREE.Mesh(geos.torso, torsoMat)
  torso.position.y = 1.94
  torso.castShadow = castShadow
  torso.receiveShadow = castShadow
  body.add(torso)

  if (colors.hasChestEmblem) {
    const emblem = new THREE.Mesh(
      geos.chestEmblem,
      trackMat(new THREE.MeshBasicMaterial({ map: getChestLogoTexture(), transparent: true })),
    )
    emblem.position.set(0, 0.06, 0.325)
    torso.add(emblem)
  }

  const headPivot = new THREE.Group()
  headPivot.position.set(0, 2.98, 0)
  body.add(headPivot)

  const head = new THREE.Mesh(geos.head, headMat)
  head.castShadow = castShadow
  headPivot.add(head)

  const facePlane = new THREE.Mesh(
    geos.facePlane,
    trackMat(new THREE.MeshBasicMaterial({ map: getFaceTexture(avatar.faceId), transparent: true })),
  )
  facePlane.position.set(0, 0.01, 0.39)
  head.add(facePlane)

  const hatRes = buildHatGroup(avatar.hatId, castShadow)
  headPivot.add(hatRes.group)
  disposables.push(...hatRes.disposables)

  const leftArmPivot = new THREE.Group()
  leftArmPivot.position.set(-0.88, 2.52, 0)
  const leftArm = new THREE.Mesh(geos.limb, armMat)
  leftArm.position.y = -0.58
  leftArm.castShadow = castShadow
  leftArmPivot.add(leftArm)
  body.add(leftArmPivot)

  const rightArmPivot = new THREE.Group()
  rightArmPivot.position.set(0.88, 2.52, 0)
  const rightArm = new THREE.Mesh(geos.limb, armMat)
  rightArm.position.y = -0.58
  rightArm.castShadow = castShadow
  rightArmPivot.add(rightArm)
  body.add(rightArmPivot)

  const leftLegPivot = new THREE.Group()
  leftLegPivot.position.set(-0.31, 1.28, 0)
  const leftLeg = new THREE.Mesh(geos.limb, legMat)
  leftLeg.position.y = -0.64
  leftLeg.castShadow = castShadow
  leftLegPivot.add(leftLeg)
  body.add(leftLegPivot)

  const rightLegPivot = new THREE.Group()
  rightLegPivot.position.set(0.31, 1.28, 0)
  const rightLeg = new THREE.Mesh(geos.limb, legMat)
  rightLeg.position.y = -0.64
  rightLeg.castShadow = castShadow
  rightLegPivot.add(rightLeg)
  body.add(rightLegPivot)

  // Nameplate sprite
  let nameplateSprite: THREE.Sprite | null = null
  let nameplateTex: THREE.CanvasTexture | null = null
  if (showNameplate) {
    nameplateTex = createNameplateTexture(username, rank)
    const npMat = trackMat(new THREE.SpriteMaterial({ map: nameplateTex, transparent: true, depthTest: false }))
    nameplateSprite = new THREE.Sprite(npMat)
    nameplateSprite.position.set(0, 4.18, 0)
    nameplateSprite.scale.set(2.4, 0.6, 1)
    root.add(nameplateSprite)
  }

  // Speech bubble sprite
  const speechMat = trackMat(new THREE.SpriteMaterial({ transparent: true, depthTest: false }))
  const speechSprite = new THREE.Sprite(speechMat)
  speechSprite.position.set(0, 4.92, 0)
  speechSprite.scale.set(3.2, 0.82, 1)
  speechSprite.visible = false
  root.add(speechSprite)
  let speechTex: THREE.CanvasTexture | null = null

  let spinAngle = 0
  let flipAngle = 0
  const lerp = (cur: number, target: number, alpha: number) => cur + (target - cur) * alpha

  const update = (dt: number, elapsed: number, pose: PlayerPose) => {
    const a = Math.min(1, dt * 14)

    let targetBodyY = 0
    let targetBodyRotZ = 0
    let targetBodyRotX = 0
    let targetLArmX = 0
    let targetLArmZ = 0.04
    let targetRArmX = 0
    let targetRArmZ = -0.04
    let targetLLegX = 0
    let targetRLegX = 0
    let targetHeadY = 0
    let targetHeadZ = 0

    if (pose === 'idle') {
      targetBodyY = Math.sin(elapsed * 2.5) * 0.04
      targetLArmX = Math.sin(elapsed * 2.2) * 0.06
      targetRArmX = -Math.sin(elapsed * 2.2) * 0.06
      targetHeadY = Math.sin(elapsed * 1.1) * 0.09
    } else if (pose === 'walk') {
      const w = elapsed * 8.5
      targetLArmX = Math.sin(w) * 0.68
      targetRArmX = -Math.sin(w) * 0.68
      targetLLegX = -Math.sin(w) * 0.68
      targetRLegX = Math.sin(w) * 0.68
      targetBodyY = Math.abs(Math.sin(w)) * 0.1
    } else if (pose === 'run') {
      const r = elapsed * 12.8
      targetLArmX = Math.sin(r) * 1.08
      targetRArmX = -Math.sin(r) * 1.08
      targetLLegX = -Math.sin(r) * 1.02
      targetRLegX = Math.sin(r) * 1.02
      targetBodyY = Math.abs(Math.sin(r)) * 0.16
      targetBodyRotX = 0.12
    } else if (pose === 'jump' || pose === 'fall') {
      targetLArmX = -2.3
      targetRArmX = -2.3
      targetLArmZ = 0.25
      targetRArmZ = -0.25
      targetLLegX = 0.32
      targetRLegX = -0.22
    } else if (pose === 'wave') {
      targetRArmX = -2.65
      targetRArmZ = -0.35 + Math.sin(elapsed * 13) * 0.35
      targetLArmX = 0.1
      targetHeadZ = 0.12
      targetBodyY = Math.sin(elapsed * 4) * 0.05
    } else if (pose === 'dance') {
      const d = elapsed * 7.8
      targetBodyY = Math.abs(Math.sin(d)) * 0.24
      targetBodyRotZ = Math.sin(d) * 0.14
      targetLArmX = -1.6 + Math.sin(d) * 0.75
      targetRArmX = -1.6 - Math.sin(d) * 0.75
      targetLArmZ = 0.55 + Math.cos(d) * 0.25
      targetRArmZ = -0.55 - Math.cos(d) * 0.25
      targetLLegX = Math.sin(d) * 0.45
      targetRLegX = -Math.sin(d) * 0.45
      targetHeadY = Math.sin(d * 0.5) * 0.22
    } else if (pose === 'cheer') {
      const c = elapsed * 10
      targetBodyY = Math.max(0, Math.sin(c)) * 0.42
      targetLArmX = -2.8
      targetRArmX = -2.8
      targetLArmZ = 0.4
      targetRArmZ = -0.4
      targetLLegX = Math.sin(c) * 0.25
      targetRLegX = -Math.sin(c) * 0.25
    } else if (pose === 'sit') {
      targetBodyY = -0.56
      targetLLegX = -1.42
      targetRLegX = -1.42
      targetLArmX = -0.4
      targetRArmX = -0.4
      targetHeadY = Math.sin(elapsed * 1.4) * 0.15
    } else if (pose === 'spin') {
      spinAngle += dt * 9.5
      targetLArmZ = 1.2
      targetRArmZ = -1.2
      targetBodyY = 0.18 + Math.sin(elapsed * 8) * 0.08
    } else if (pose === 'backflip') {
      flipAngle -= dt * 8.6
      targetBodyY = 0.55 + Math.abs(Math.sin(flipAngle * 0.5)) * 0.55
      targetLArmX = -2.1
      targetRArmX = -2.1
      targetLLegX = -0.85
      targetRLegX = -0.85
    }

    if (pose !== 'spin') {
      spinAngle = lerp(spinAngle, 0, a)
    }
    if (pose !== 'backflip') {
      flipAngle = lerp(flipAngle, 0, a)
    }

    body.position.y = lerp(body.position.y, targetBodyY, a)
    body.rotation.y = spinAngle
    body.rotation.x = pose === 'backflip' ? flipAngle : lerp(body.rotation.x, targetBodyRotX, a)
    body.rotation.z = lerp(body.rotation.z, targetBodyRotZ, a)

    leftArmPivot.rotation.x = lerp(leftArmPivot.rotation.x, targetLArmX, a)
    leftArmPivot.rotation.z = lerp(leftArmPivot.rotation.z, targetLArmZ, a)
    rightArmPivot.rotation.x = lerp(rightArmPivot.rotation.x, targetRArmX, a)
    rightArmPivot.rotation.z = lerp(rightArmPivot.rotation.z, targetRArmZ, a)
    leftLegPivot.rotation.x = lerp(leftLegPivot.rotation.x, targetLLegX, a)
    rightLegPivot.rotation.x = lerp(rightLegPivot.rotation.x, targetRLegX, a)
    headPivot.rotation.y = lerp(headPivot.rotation.y, targetHeadY, a)
    headPivot.rotation.z = lerp(headPivot.rotation.z, targetHeadZ, a)

    // Subtle shadow disc scale response when jumping/flipping
    const shadowScale = Math.max(0.55, 1 - Math.max(0, body.position.y) * 0.32)
    shadowBlob.scale.set(shadowScale, shadowScale, 1)
  }

  const setSpeech = (text: string | null) => {
    if (!text) {
      speechSprite.visible = false
      return
    }
    if (speechTex) speechTex.dispose()
    speechTex = createSpeechTexture(text)
    speechMat.map = speechTex
    speechMat.needsUpdate = true
    speechSprite.visible = true
  }

  const setNameplate = (newUsername: string, newRank: string) => {
    if (!nameplateSprite) return
    if (nameplateTex) nameplateTex.dispose()
    nameplateTex = createNameplateTexture(newUsername, newRank)
    const mat = nameplateSprite.material as THREE.SpriteMaterial
    mat.map = nameplateTex
    mat.needsUpdate = true
  }

  const dispose = () => {
    if (nameplateTex) nameplateTex.dispose()
    if (speechTex) speechTex.dispose()
    for (const d of disposables) {
      d.dispose()
    }
  }

  return {
    root,
    body,
    shadowBlob,
    update,
    setSpeech,
    setNameplate,
    dispose,
  }
}
