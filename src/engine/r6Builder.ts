import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { FaceId, HatId, OutfitId, R6AvatarConfig } from '../data/catalog'
import { PlayerPose } from '../lib/multiplayer'
import { createEmptyPoseTarget, evaluateR6Pose } from './r6Animations'

// Cached shared geometries & lightweight textures to slash GPU memory & draw-call setup
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

/** Lightweight radial foot shadow texture (keeps avatars grounded even when shadow maps are off) */
function getBlobShadowTexture(): THREE.CanvasTexture {
  if (sharedBlobShadowTex) return sharedBlobShadowTex
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30)
  grad.addColorStop(0, 'rgba(12, 24, 48, 0.42)')
  grad.addColorStop(0.65, 'rgba(12, 24, 48, 0.15)')
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
    case 'midnight-slate':
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
    const cupMat = trackMat(new THREE.MeshStandardMaterial({ color: '#1E293B', roughness: 0.25, metalness: 0.28 }))
    const trimGeo = trackGeo(new THREE.TorusGeometry(0.14, 0.028, 6, 16))
    const trimMat = trackMat(new THREE.MeshStandardMaterial({ color: '#38BDF8', roughness: 0.22, metalness: 0.2 }))

    for (const side of [-1, 1]) {
      const cup = new THREE.Mesh(cupGeo, cupMat)
      cup.rotation.z = Math.PI / 2
      cup.position.set(side * 0.44, 0.04, 0)
      group.add(cup)

      const trim = new THREE.Mesh(trimGeo, trimMat)
      trim.rotation.y = Math.PI / 2
      trim.position.set(side * 0.51, 0.04, 0)
      group.add(trim)
    }
  } else if (hatId === 'crystal-halo') {
    const halo = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.48, 0.052, 8, 22)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: '#BAE6FD',
          roughness: 0.14,
          metalness: 0.25,
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
        color: '#7DD3FC',
        roughness: 0.18,
        metalness: 0.16,
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
  comPivot: THREE.Group
  shadowBlob: THREE.Mesh
  update: (dt: number, elapsed: number, pose: PlayerPose) => void
  setSpeech: (text: string | null) => void
  setNameplate: (username: string, rank: string) => void
  dispose: () => void
}

const REST_COM_Y = 1.72

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

  // === TRUE HIERARCHICAL CENTER-OF-MASS R6 RIG ===
  // Center of Mass sits at world y = 1.72 — backflips, tornado spins, leans & squash-stretch pivot cleanly around the body core!
  const comPivot = new THREE.Group()
  comPivot.position.y = REST_COM_Y
  root.add(comPivot)

  const colors = getOutfitColors(avatar.outfitId, avatar.skinColor)
  const makeGlossyMat = (hex: string) =>
    trackMat(
      new THREE.MeshStandardMaterial({
        color: hex,
        roughness: 0.24,
        metalness: 0.08,
      }),
    )

  const torsoMat = makeGlossyMat(colors.torso)
  const armMat = makeGlossyMat(colors.arms)
  const legMat = makeGlossyMat(colors.legs)
  const headMat = makeGlossyMat(avatar.skinColor)

  // Pelvis / Hip line sits at local y = -0.44 (world y = 1.28 — exact leg height!)
  const pelvisY = -0.44

  // Upper body spine pivot (independent chest twist, lean, & dance isolation!)
  const torsoPivot = new THREE.Group()
  torsoPivot.position.set(0, pelvisY, 0)
  comPivot.add(torsoPivot)

  const torso = new THREE.Mesh(geos.torso, torsoMat)
  torso.position.y = 0.66 // torso spans world y=1.28..2.60
  torso.castShadow = castShadow
  torso.receiveShadow = castShadow
  torsoPivot.add(torso)

  if (colors.hasChestEmblem) {
    const emblem = new THREE.Mesh(
      geos.chestEmblem,
      trackMat(new THREE.MeshBasicMaterial({ map: getChestLogoTexture(), transparent: true })),
    )
    emblem.position.set(0, 0.06, 0.325)
    torso.add(emblem)
  }

  // Neck-based head pivot (natural nods, tilts & glances without head detaching!)
  const headPivot = new THREE.Group()
  headPivot.position.set(0, 1.34, 0) // neck base at world y=2.62
  torsoPivot.add(headPivot)

  const head = new THREE.Mesh(geos.head, headMat)
  head.position.y = 0.38 // head center at world y=3.00, top at 3.38
  head.castShadow = castShadow
  headPivot.add(head)

  const facePlane = new THREE.Mesh(
    geos.facePlane,
    trackMat(new THREE.MeshBasicMaterial({ map: getFaceTexture(avatar.faceId), transparent: true })),
  )
  facePlane.position.set(0, 0.01, 0.39)
  head.add(facePlane)

  const hatRes = buildHatGroup(avatar.hatId, castShadow)
  head.add(hatRes.group)
  disposables.push(...hatRes.disposables)

  // Shoulders attached to torsoPivot with natural realistic R6 seam (0.59 torso + 0.27 arm = 0.86 → 0.875!)
  const leftArmPivot = new THREE.Group()
  leftArmPivot.position.set(-0.875, 1.22, 0) // shoulder at world y=2.50
  const leftArm = new THREE.Mesh(geos.limb, armMat)
  leftArm.position.y = -0.58
  leftArm.castShadow = castShadow
  leftArmPivot.add(leftArm)
  torsoPivot.add(leftArmPivot)

  const rightArmPivot = new THREE.Group()
  rightArmPivot.position.set(0.875, 1.22, 0)
  const rightArm = new THREE.Mesh(geos.limb, armMat)
  rightArm.position.y = -0.58
  rightArm.castShadow = castShadow
  rightArmPivot.add(rightArm)
  torsoPivot.add(rightArmPivot)

  // Legs attached at pelvis line under comPivot with realistic classic R6 spacing (half-width 0.27 → ±0.305!)
  const leftLegPivot = new THREE.Group()
  leftLegPivot.position.set(-0.305, pelvisY, 0)
  const leftLeg = new THREE.Mesh(geos.limb, legMat)
  leftLeg.position.y = -0.64
  leftLeg.castShadow = castShadow
  leftLegPivot.add(leftLeg)
  comPivot.add(leftLegPivot)

  const rightLegPivot = new THREE.Group()
  rightLegPivot.position.set(0.305, pelvisY, 0)
  const rightLeg = new THREE.Mesh(geos.limb, legMat)
  rightLeg.position.y = -0.64
  rightLeg.castShadow = castShadow
  rightLegPivot.add(rightLeg)
  comPivot.add(rightLegPivot)

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

  // Per-rig animation state (zero allocation!)
  const target = createEmptyPoseTarget()
  let prevPose: PlayerPose = 'idle'
  let poseTime = 0
  let landingImpact = 0
  const lerp = (cur: number, tgt: number, a: number) => cur + (tgt - cur) * a

  const update = (dt: number, elapsed: number, pose: PlayerPose) => {
    if (pose !== prevPose) {
      // Trigger juicy automatic landing squash when touching down from air!
      if ((prevPose === 'jump' || prevPose === 'fall') && pose !== 'jump' && pose !== 'fall') {
        landingImpact = 1
      }
      prevPose = pose
      poseTime = 0
    } else {
      poseTime += dt
    }

    if (landingImpact > 0) {
      landingImpact = Math.max(0, landingImpact - dt * 4.8)
    }

    evaluateR6Pose(pose, elapsed, poseTime, landingImpact, target)
    const a = Math.min(1, dt * target.snappiness)

    comPivot.position.x = lerp(comPivot.position.x, target.comPos.x, a)
    comPivot.position.y = lerp(comPivot.position.y, REST_COM_Y + target.comPos.y, a)
    comPivot.position.z = lerp(comPivot.position.z, target.comPos.z, a)

    const wrapPi = (rad: number) => {
      let r = ((rad + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
      return r
    }

    // Direct spin channels avoid lerp-rewinding on 360°/720° flips & spins; normalize modulo 2π when exiting!
    if (target.directSpinX) {
      comPivot.rotation.x = target.comRot.x
    } else {
      comPivot.rotation.x = lerp(wrapPi(comPivot.rotation.x), target.comRot.x, a)
    }
    if (target.directSpinY) {
      comPivot.rotation.y = target.comRot.y
    } else {
      comPivot.rotation.y = lerp(wrapPi(comPivot.rotation.y), target.comRot.y, a)
    }
    comPivot.rotation.z = lerp(comPivot.rotation.z, target.comRot.z, a)

    // Subtle squash & stretch
    comPivot.scale.set(
      lerp(comPivot.scale.x, target.scaleXZ, a),
      lerp(comPivot.scale.y, target.scaleY, a),
      lerp(comPivot.scale.z, target.scaleXZ, a),
    )

    torsoPivot.rotation.x = lerp(torsoPivot.rotation.x, target.torsoRot.x, a)
    torsoPivot.rotation.y = lerp(torsoPivot.rotation.y, target.torsoRot.y, a)
    torsoPivot.rotation.z = lerp(torsoPivot.rotation.z, target.torsoRot.z, a)

    headPivot.rotation.x = lerp(headPivot.rotation.x, target.headRot.x, a)
    headPivot.rotation.y = lerp(headPivot.rotation.y, target.headRot.y, a)
    headPivot.rotation.z = lerp(headPivot.rotation.z, target.headRot.z, a)

    leftArmPivot.rotation.x = lerp(leftArmPivot.rotation.x, target.lArmRot.x, a)
    leftArmPivot.rotation.y = lerp(leftArmPivot.rotation.y, target.lArmRot.y, a)
    leftArmPivot.rotation.z = lerp(leftArmPivot.rotation.z, target.lArmRot.z, a)

    rightArmPivot.rotation.x = lerp(rightArmPivot.rotation.x, target.rArmRot.x, a)
    rightArmPivot.rotation.y = lerp(rightArmPivot.rotation.y, target.rArmRot.y, a)
    rightArmPivot.rotation.z = lerp(rightArmPivot.rotation.z, target.rArmRot.z, a)

    leftLegPivot.rotation.x = lerp(leftLegPivot.rotation.x, target.lLegRot.x, a)
    leftLegPivot.rotation.y = lerp(leftLegPivot.rotation.y, target.lLegRot.y, a)
    leftLegPivot.rotation.z = lerp(leftLegPivot.rotation.z, target.lLegRot.z, a)

    rightLegPivot.rotation.x = lerp(rightLegPivot.rotation.x, target.rLegRot.x, a)
    rightLegPivot.rotation.y = lerp(rightLegPivot.rotation.y, target.rLegRot.y, a)
    rightLegPivot.rotation.z = lerp(rightLegPivot.rotation.z, target.rLegRot.z, a)

    // Dynamic ground blob shadow responds smoothly to jump / backflip height!
    const airHeight = Math.max(0, comPivot.position.y - REST_COM_Y)
    const shadowScale = Math.max(0.45, 1 - airHeight * 0.24)
    shadowBlob.scale.set(shadowScale, shadowScale, 1)
    shadowBlobMat.opacity = Math.max(0.28, 0.85 - airHeight * 0.25)

    // Keep overhead nameplate cleanly above the head during high jumps/flips
    if (nameplateSprite) {
      nameplateSprite.position.y = 4.18 + airHeight * 0.75
    }
    if (speechSprite.visible) {
      speechSprite.position.y = 4.92 + airHeight * 0.75
    }
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
    comPivot,
    shadowBlob,
    update,
    setSpeech,
    setNameplate,
    dispose,
  }
}
