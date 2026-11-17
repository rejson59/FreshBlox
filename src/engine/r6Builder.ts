import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { BackId, FaceId, HatId, OutfitId, PetId, R6AvatarConfig, TrailId } from '../data/catalog'
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

function createNameplateTexture(username: string, rank: string, clanTag?: string | null): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 440
  canvas.height = 104
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 440, 104)

  ctx.fillStyle = 'rgba(7, 17, 36, 0.8)'
  ctx.beginPath()
  ctx.roundRect(14, 12, 412, 80, 22)
  ctx.fill()

  ctx.strokeStyle = clanTag ? 'rgba(56, 189, 248, 0.78)' : 'rgba(56, 189, 248, 0.55)'
  ctx.lineWidth = 3
  ctx.stroke()

  const displayTitle = clanTag ? `[${clanTag.toUpperCase()}] ${username.slice(0, 16)}` : username.slice(0, 18)
  ctx.fillStyle = '#F0F9FF'
  ctx.font = '800 26px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (clanTag) {
    const tagStr = `[${clanTag.toUpperCase()}] `
    const nameStr = username.slice(0, 16)
    const tagW = ctx.measureText(tagStr).width
    const nameW = ctx.measureText(nameStr).width
    const startX = 220 - (tagW + nameW) / 2
    ctx.textAlign = 'left'
    ctx.fillStyle = '#38BDF8'
    ctx.fillText(tagStr, startX, 42)
    ctx.fillStyle = '#F0F9FF'
    ctx.fillText(nameStr, startX + tagW, 42)
    ctx.textAlign = 'center'
  } else {
    ctx.fillText(displayTitle, 220, 42)
  }

  ctx.fillStyle = '#7DD3FC'
  ctx.font = '700 17px Inter, system-ui, sans-serif'
  ctx.fillText(rank, 220, 72)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function createSpeechTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 560
  canvas.height = 148
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 560, 148)

  ctx.font = '700 24px Inter, system-ui, sans-serif'
  const trimmed = text.trim().slice(0, 68)
  const words = trimmed.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w
    if (ctx.measureText(candidate).width <= 460 || !current) {
      current = candidate
    } else {
      lines.push(current)
      current = w
      if (lines.length >= 1) break
    }
  }
  if (current) lines.push(current)
  if (lines.length > 2) lines.length = 2
  if (lines.length === 2 && ctx.measureText(lines[1]).width > 460) {
    lines[1] = `${lines[1].slice(0, 28)}…`
  }

  const maxLineW = Math.max(150, ...lines.map((l) => ctx.measureText(l).width))
  const boxW = Math.min(524, Math.max(210, maxLineW + 64))
  const boxH = lines.length === 2 ? 98 : 74
  const boxX = (560 - boxW) / 2
  const boxY = lines.length === 2 ? 16 : 36

  // Soft shadow
  ctx.save()
  ctx.shadowColor = 'rgba(2, 8, 23, 0.42)'
  ctx.shadowBlur = 16
  ctx.shadowOffsetY = 6
  const grad = ctx.createLinearGradient(0, boxY, 0, boxY + boxH)
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.98)')
  grad.addColorStop(1, 'rgba(240, 249, 255, 0.96)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.roundRect(boxX, boxY, boxW, boxH, 26)
  ctx.fill()
  ctx.restore()

  // Speech pointer tail
  const tailTop = boxY + boxH - 2
  ctx.fillStyle = 'rgba(240, 249, 255, 0.97)'
  ctx.beginPath()
  ctx.moveTo(266, tailTop)
  ctx.lineTo(280, tailTop + 18)
  ctx.lineTo(294, tailTop)
  ctx.closePath()
  ctx.fill()

  // Crisp Arctic Sky outline
  ctx.strokeStyle = 'rgba(14, 165, 233, 0.72)'
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.roundRect(boxX, boxY, boxW, boxH, 26)
  ctx.stroke()

  // Text lines
  ctx.fillStyle = '#0B162C'
  ctx.font = '700 24px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (lines.length === 1) {
    ctx.fillText(lines[0], 280, boxY + boxH / 2 + 1)
  } else {
    ctx.fillText(lines[0], 280, boxY + 34)
    ctx.fillText(lines[1], 280, boxY + 67)
  }

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
  } else if (hatId === 'obby-crown') {
    // Exclusive Stage 100 Champion Crown: royal 6-point gold crown with velvet cap, pearl tips & crystal gems
    const goldMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#F59E0B',
        roughness: 0.18,
        metalness: 0.78,
      }),
    )
    const brightGoldMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#FDE047',
        roughness: 0.16,
        metalness: 0.74,
      }),
    )
    const trimBandMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#0284C7',
        roughness: 0.22,
        metalness: 0.45,
      }),
    )
    const velvetMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#1E3A8A',
        roughness: 0.78,
        metalness: 0.05,
      }),
    )
    const skyGemMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#38BDF8',
        roughness: 0.1,
        metalness: 0.25,
      }),
    )
    const emeraldGemMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#34D399',
        roughness: 0.12,
        metalness: 0.22,
      }),
    )

    // Lower sapphire-arctic rim seated cleanly atop R6 head
    const rim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.41, 0.036, 8, 24)), trimBandMat)
    rim.rotation.x = Math.PI / 2
    rim.position.y = 0.38
    rim.castShadow = castShadow
    group.add(rim)

    // Flared royal gold band
    const band = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.45, 0.4, 0.17, 12)), goldMat)
    band.position.y = 0.46
    band.castShadow = castShadow
    group.add(band)

    // Royal navy inner velvet cushion
    const velvet = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.32, 0.36, 0.16, 12)), velvetMat)
    velvet.position.y = 0.51
    group.add(velvet)

    // 6 sculpted crown spikes + pearl tips (front spike taller for regal silhouette!)
    const spikeGeo = trackGeo(new THREE.ConeGeometry(0.105, 0.25, 4))
    const frontSpikeGeo = trackGeo(new THREE.ConeGeometry(0.125, 0.35, 4))
    const pearlGeo = trackGeo(new THREE.SphereGeometry(0.042, 8, 8))

    for (let i = 0; i < 6; i++) {
      // Angle 0 points along +Z (front of face)
      const angle = (i / 6) * Math.PI * 2
      const isFront = i === 0
      const sx = Math.sin(angle) * 0.39
      const sz = Math.cos(angle) * 0.39
      const spikeH = isFront ? 0.35 : 0.25

      const spike = new THREE.Mesh(isFront ? frontSpikeGeo : spikeGeo, isFront ? brightGoldMat : goldMat)
      spike.position.set(sx, 0.53 + spikeH * 0.46, sz)
      spike.rotation.y = angle
      spike.castShadow = castShadow
      group.add(spike)

      const pearl = new THREE.Mesh(pearlGeo, brightGoldMat)
      pearl.position.set(sx, 0.53 + spikeH * 0.96, sz)
      group.add(pearl)
    }

    // Center crystal FreshGem mounted on the front of the crown + 2 emerald flank gems
    const centerGem = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.115, 0)), skyGemMat)
    centerGem.scale.set(0.9, 1.35, 0.72)
    centerGem.position.set(0, 0.56, 0.44)
    group.add(centerGem)

    const sideGemGeo = trackGeo(new THREE.OctahedronGeometry(0.072, 0))
    for (const side of [-1, 1]) {
      const sideGem = new THREE.Mesh(sideGemGeo, emeraldGemMat)
      sideGem.position.set(side * 0.38, 0.48, 0.22)
      group.add(sideGem)
    }
  }

  return { group, disposables }
}

function buildBackAccessory(
  backId: BackId,
  castShadow: boolean,
): {
  group: THREE.Group
  animate: (elapsed: number, pose: PlayerPose) => void
  disposables: Array<{ dispose: () => void }>
} {
  const group = new THREE.Group()
  const disposables: Array<{ dispose: () => void }> = []
  let animate: (elapsed: number, pose: PlayerPose) => void = () => {}

  if (backId === 'none') return { group, animate, disposables }

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g)
    return g
  }
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m)
    return m
  }

  group.position.set(0, 0.08, -0.34)

  if (backId === 'crystal-wings' || backId === 'solar-halo-wings') {
    const isSolar = backId === 'solar-halo-wings'
    const wingMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: isSolar ? '#FDE047' : '#38BDF8',
        emissive: isSolar ? '#F59E0B' : '#0EA5E9',
        emissiveIntensity: isSolar ? 0.55 : 0.42,
        roughness: 0.16,
        metalness: isSolar ? 0.55 : 0.25,
        transparent: true,
        opacity: 0.9,
      }),
    )
    const coreMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: isSolar ? '#FFFBEB' : '#E0F2FE',
        roughness: 0.18,
        metalness: 0.4,
      }),
    )

    const hub = new THREE.Mesh(trackGeo(new RoundedBoxGeometry(0.32, 0.4, 0.14, 2, 0.04)), coreMat)
    group.add(hub)

    const leftWing = new THREE.Group()
    leftWing.position.set(-0.14, 0.06, -0.02)
    const rightWing = new THREE.Group()
    rightWing.position.set(0.14, 0.06, -0.02)

    const featherSpecs: Array<[number, number, number, number, number]> = [
      [0.62, 0.28, 0.05, 0.54, 0.26],
      [0.86, 0.22, 0.045, 0.72, 0.06],
      [0.68, 0.18, 0.045, 0.54, -0.18],
      [0.44, 0.14, 0.04, 0.34, -0.38],
    ]
    for (const [w, h, d, ox, oy] of featherSpecs) {
      const geo = trackGeo(new RoundedBoxGeometry(w, h, d, 2, 0.02))
      const lf = new THREE.Mesh(geo, wingMat)
      lf.position.set(-ox, oy, -0.04)
      lf.rotation.z = -0.18
      lf.castShadow = castShadow
      leftWing.add(lf)

      const rf = new THREE.Mesh(geo, wingMat)
      rf.position.set(ox, oy, -0.04)
      rf.rotation.z = 0.18
      rf.castShadow = castShadow
      rightWing.add(rf)
    }

    if (isSolar) {
      const halo = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.55, 0.032, 8, 24)), wingMat)
      halo.position.set(0, 0.22, -0.12)
      group.add(halo)
    }

    group.add(leftWing, rightWing)
    animate = (elapsed, pose) => {
      const airBoost = pose === 'jump' || pose === 'fall' || pose === 'run' ? 2.6 : 1.15
      const amp = pose === 'jump' || pose === 'fall' ? 0.38 : 0.16
      const flap = Math.sin(elapsed * 3.4 * airBoost) * amp
      leftWing.rotation.y = 0.28 + flap
      rightWing.rotation.y = -0.28 - flap
    }
  } else if (backId === 'portal-jetpack') {
    const bodyMat = trackMat(new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.28, metalness: 0.55 }))
    const trimMat = trackMat(new THREE.MeshStandardMaterial({ color: '#E2E8F0', roughness: 0.22, metalness: 0.35 }))
    const cyanMat = trackMat(
      new THREE.MeshStandardMaterial({ color: '#22D3EE', emissive: '#06B6D4', emissiveIntensity: 0.9, roughness: 0.15 }),
    )
    const orangeMat = trackMat(
      new THREE.MeshStandardMaterial({ color: '#FB923C', emissive: '#F97316', emissiveIntensity: 0.9, roughness: 0.15 }),
    )

    const bridge = new THREE.Mesh(trackGeo(new RoundedBoxGeometry(0.76, 0.44, 0.22, 2, 0.05)), trimMat)
    bridge.castShadow = castShadow
    group.add(bridge)

    const tankGeo = trackGeo(new THREE.CylinderGeometry(0.15, 0.17, 0.78, 12))
    const flameGeo = trackGeo(new THREE.ConeGeometry(0.11, 0.42, 8))
    const flames: THREE.Mesh[] = []

    for (const [side, mat] of [
      [-1, cyanMat],
      [1, orangeMat],
    ] as const) {
      const tank = new THREE.Mesh(tankGeo, bodyMat)
      tank.position.set(side * 0.28, -0.02, -0.08)
      tank.castShadow = castShadow
      group.add(tank)

      const ring = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.16, 0.03, 6, 16)), mat)
      ring.rotation.x = Math.PI / 2
      ring.position.set(side * 0.28, 0.1, -0.08)
      group.add(ring)

      const flame = new THREE.Mesh(flameGeo, mat)
      flame.rotation.x = Math.PI
      flame.position.set(side * 0.28, -0.58, -0.08)
      group.add(flame)
      flames.push(flame)
    }

    animate = (elapsed, pose) => {
      const thrust = pose === 'jump' || pose === 'fall' ? 1.45 : pose === 'run' ? 1.05 : 0.45
      for (let i = 0; i < flames.length; i++) {
        const flicker = 0.82 + Math.sin(elapsed * 26 + i * 2) * 0.22
        flames[i].scale.set(0.85, thrust * flicker, 0.85)
      }
    }
  } else if (backId === 'arctic-backpack') {
    const packMat = trackMat(new THREE.MeshStandardMaterial({ color: '#0284C7', roughness: 0.34, metalness: 0.08 }))
    const pocketMat = trackMat(new THREE.MeshStandardMaterial({ color: '#E0F2FE', roughness: 0.26, metalness: 0.05 }))
    const buckleMat = trackMat(new THREE.MeshStandardMaterial({ color: '#38BDF8', emissive: '#0EA5E9', emissiveIntensity: 0.35 }))

    const mainBag = new THREE.Mesh(trackGeo(new RoundedBoxGeometry(0.82, 0.94, 0.38, 2, 0.09)), packMat)
    mainBag.position.set(0, -0.02, -0.14)
    mainBag.castShadow = castShadow
    group.add(mainBag)

    const pocket = new THREE.Mesh(trackGeo(new RoundedBoxGeometry(0.64, 0.4, 0.14, 2, 0.05)), pocketMat)
    pocket.position.set(0, -0.2, -0.34)
    group.add(pocket)

    const clasp = new THREE.Mesh(trackGeo(new RoundedBoxGeometry(0.24, 0.14, 0.08, 2, 0.03)), buckleMat)
    clasp.position.set(0, 0.16, -0.34)
    group.add(clasp)
  } else if (backId === 'cyber-cape') {
    const capeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#312E81',
        emissive: '#4F46E5',
        emissiveIntensity: 0.28,
        roughness: 0.32,
        metalness: 0.25,
      }),
    )
    const trimMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#38BDF8',
        emissive: '#0EA5E9',
        emissiveIntensity: 0.6,
        roughness: 0.18,
      }),
    )

    const capePivot = new THREE.Group()
    capePivot.position.set(0, 0.48, 0.02)
    group.add(capePivot)

    const panel = new THREE.Mesh(trackGeo(new RoundedBoxGeometry(0.98, 1.38, 0.05, 2, 0.02)), capeMat)
    panel.position.set(0, -0.7, -0.06)
    panel.castShadow = castShadow
    capePivot.add(panel)

    const bottomTrim = new THREE.Mesh(trackGeo(new RoundedBoxGeometry(0.96, 0.09, 0.065, 2, 0.02)), trimMat)
    bottomTrim.position.set(0, -1.35, -0.06)
    capePivot.add(bottomTrim)

    animate = (elapsed, pose) => {
      const targetAngle =
        pose === 'run' ? 0.56 : pose === 'walk' ? 0.3 : pose === 'jump' || pose === 'fall' ? 0.68 : 0.12
      const flutter = Math.sin(elapsed * 7.5) * (pose === 'run' ? 0.12 : 0.04)
      capePivot.rotation.x += (targetAngle + flutter - capePivot.rotation.x) * 0.18
    }
  }

  return { group, animate, disposables }
}

function buildCompanionPet(
  petId: PetId,
  castShadow: boolean,
): {
  group: THREE.Group
  animate: (elapsed: number, airHeight: number) => void
  disposables: Array<{ dispose: () => void }>
} {
  const group = new THREE.Group()
  const disposables: Array<{ dispose: () => void }> = []
  let animate: (elapsed: number, airHeight: number) => void = () => {}

  if (petId === 'none') return { group, animate, disposables }

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g)
    return g
  }
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m)
    return m
  }

  const petBody = new THREE.Group()
  group.add(petBody)

  if (petId === 'frost-cube') {
    const iceMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#7DD3FC',
        emissive: '#0284C7',
        emissiveIntensity: 0.25,
        roughness: 0.14,
        metalness: 0.1,
        transparent: true,
        opacity: 0.92,
      }),
    )
    const eyeMat = trackMat(new THREE.MeshBasicMaterial({ color: '#0F172A' }))
    const shineMat = trackMat(new THREE.MeshBasicMaterial({ color: '#FFFFFF' }))

    const cube = new THREE.Mesh(trackGeo(new RoundedBoxGeometry(0.46, 0.46, 0.46, 2, 0.08)), iceMat)
    cube.castShadow = castShadow
    petBody.add(cube)

    const eyeGeo = trackGeo(new THREE.SphereGeometry(0.055, 8, 8))
    const shineGeo = trackGeo(new THREE.SphereGeometry(0.022, 6, 6))
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat)
      eye.position.set(side * 0.11, 0.04, 0.22)
      petBody.add(eye)
      const shine = new THREE.Mesh(shineGeo, shineMat)
      shine.position.set(side * 0.11 - 0.015, 0.06, 0.265)
      petBody.add(shine)
    }

    const crown = new THREE.Mesh(
      trackGeo(new THREE.OctahedronGeometry(0.11, 0)),
      trackMat(new THREE.MeshStandardMaterial({ color: '#E0F2FE', emissive: '#38BDF8', emissiveIntensity: 0.6 })),
    )
    crown.position.y = 0.34
    petBody.add(crown)

    animate = (elapsed, airHeight) => {
      petBody.position.set(1.28, 2.75 + airHeight * 0.65 + Math.sin(elapsed * 3.1) * 0.18, -0.15)
      petBody.rotation.y = Math.sin(elapsed * 1.4) * 0.35
      petBody.rotation.z = Math.sin(elapsed * 2.2) * 0.08
      crown.rotation.y = elapsed * 2.2
    }
  } else if (petId === 'portal-drone') {
    const core = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.24, 14, 12)),
      trackMat(new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.2, metalness: 0.7 })),
    )
    petBody.add(core)

    const lens = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.1, 10, 10)),
      trackMat(new THREE.MeshStandardMaterial({ color: '#E0F2FE', emissive: '#38BDF8', emissiveIntensity: 1.0 })),
    )
    lens.position.z = 0.2
    petBody.add(lens)

    const ringCyan = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.36, 0.028, 8, 24)),
      trackMat(new THREE.MeshStandardMaterial({ color: '#22D3EE', emissive: '#06B6D4', emissiveIntensity: 0.9 })),
    )
    const ringOrange = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.42, 0.024, 8, 24)),
      trackMat(new THREE.MeshStandardMaterial({ color: '#FB923C', emissive: '#F97316', emissiveIntensity: 0.9 })),
    )
    petBody.add(ringCyan, ringOrange)

    animate = (elapsed, airHeight) => {
      petBody.position.set(1.32, 2.85 + airHeight * 0.65 + Math.sin(elapsed * 3.6) * 0.16, -0.1)
      ringCyan.rotation.x = elapsed * 2.1
      ringCyan.rotation.y = elapsed * 1.4
      ringOrange.rotation.y = -elapsed * 2.3
      ringOrange.rotation.z = elapsed * 1.1
    }
  } else if (petId === 'star-owl') {
    const bodyMat = trackMat(new THREE.MeshStandardMaterial({ color: '#E0F2FE', roughness: 0.35 }))
    const wingMat = trackMat(new THREE.MeshStandardMaterial({ color: '#38BDF8', roughness: 0.28 }))
    const goldMat = trackMat(new THREE.MeshStandardMaterial({ color: '#FACC15', emissive: '#F59E0B', emissiveIntensity: 0.45 }))

    const torsoOwl = new THREE.Mesh(trackGeo(new RoundedBoxGeometry(0.42, 0.48, 0.38, 2, 0.09)), bodyMat)
    torsoOwl.castShadow = castShadow
    petBody.add(torsoOwl)

    const beak = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.06, 0.12, 4)), goldMat)
    beak.rotation.x = Math.PI / 2
    beak.position.set(0, 0.02, 0.22)
    petBody.add(beak)

    const eyeGeo = trackGeo(new THREE.SphereGeometry(0.06, 8, 8))
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, goldMat)
      eye.position.set(side * 0.11, 0.1, 0.18)
      petBody.add(eye)
    }

    const wingGeo = trackGeo(new RoundedBoxGeometry(0.28, 0.1, 0.24, 2, 0.03))
    const lWing = new THREE.Mesh(wingGeo, wingMat)
    lWing.position.set(-0.3, 0.04, 0)
    const rWing = new THREE.Mesh(wingGeo, wingMat)
    rWing.position.set(0.3, 0.04, 0)
    petBody.add(lWing, rWing)

    animate = (elapsed, airHeight) => {
      petBody.position.set(1.25, 2.95 + airHeight * 0.65 + Math.sin(elapsed * 4.5) * 0.16, -0.05)
      const f = Math.sin(elapsed * 11) * 0.52
      lWing.rotation.z = f
      rWing.rotation.z = -f
    }
  } else if (petId === 'plasma-orb') {
    const crystal = new THREE.Mesh(
      trackGeo(new THREE.OctahedronGeometry(0.25, 0)),
      trackMat(new THREE.MeshStandardMaterial({ color: '#E879F9', emissive: '#A855F7', emissiveIntensity: 0.85, roughness: 0.12 })),
    )
    petBody.add(crystal)

    const orbit1 = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.38, 0.022, 6, 22)),
      trackMat(new THREE.MeshStandardMaterial({ color: '#C084FC', emissive: '#9333EA', emissiveIntensity: 0.8 })),
    )
    const orbit2 = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.46, 0.018, 6, 22)),
      trackMat(new THREE.MeshStandardMaterial({ color: '#38BDF8', emissive: '#0284C7', emissiveIntensity: 0.7 })),
    )
    petBody.add(orbit1, orbit2)

    animate = (elapsed, airHeight) => {
      petBody.position.set(1.3, 2.8 + airHeight * 0.65 + Math.sin(elapsed * 2.8) * 0.2, -0.15)
      crystal.rotation.y = elapsed * 2.5
      crystal.rotation.x = Math.sin(elapsed * 1.8) * 0.4
      orbit1.rotation.x = elapsed * 1.9
      orbit1.rotation.z = elapsed * 1.2
      orbit2.rotation.y = -elapsed * 2.1
      orbit2.rotation.x = Math.PI / 3
    }
  }

  return { group, animate, disposables }
}

interface TrailColors {
  primary: string
  secondary: string
}

function getTrailColors(trailId: TrailId): TrailColors | null {
  switch (trailId) {
    case 'arctic-sparks':
      return { primary: '#38BDF8', secondary: '#E0F2FE' }
    case 'portal-duality':
      return { primary: '#22D3EE', secondary: '#F97316' }
    case 'neon-comet':
      return { primary: '#C084FC', secondary: '#F472B6' }
    case 'emerald-pulse':
      return { primary: '#10B981', secondary: '#6EE7B7' }
    case 'golden-meteor':
      return { primary: '#FACC15', secondary: '#FB923C' }
    default:
      return null
  }
}

export interface R6RigHandle {
  root: THREE.Group
  comPivot: THREE.Group
  shadowBlob: THREE.Mesh
  update: (dt: number, elapsed: number, pose: PlayerPose) => void
  setSpeech: (text: string | null) => void
  setNameplate: (username: string, rank: string, clanTag?: string | null) => void
  dispose: () => void
}

const REST_COM_Y = 1.72

export function createR6Rig(opts: {
  avatar: R6AvatarConfig
  username?: string
  rank?: string
  clanTag?: string | null
  showNameplate?: boolean
  castShadow?: boolean
}): R6RigHandle {
  const { avatar, username = 'FreshPlayer', rank = 'Crystal I', clanTag = null, showNameplate = true, castShadow = true } = opts

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

  // P-01: 3D Back Accessory (Wings, Jetpack, Backpack, Cape)
  const backRes = buildBackAccessory(avatar.backId ?? 'none', castShadow)
  torso.add(backRes.group)
  disposables.push(...backRes.disposables)

  // P-02: 3D Floating Companion Pet
  const petRes = buildCompanionPet(avatar.petId ?? 'none', castShadow)
  root.add(petRes.group)
  disposables.push(...petRes.disposables)

  // P-01: 3D Footstep Particle Trail Pool (zero-allocation local ring buffer)
  const trailColors = getTrailColors(avatar.trailId ?? 'none')
  const trailParticles: Array<{ mesh: THREE.Mesh; age: number; maxAge: number; vx: number; vy: number; vz: number }> = []
  let trailSpawnAcc = 0
  let trailCursor = 0
  if (trailColors) {
    const pGeo = new THREE.OctahedronGeometry(0.11, 0)
    disposables.push(pGeo)
    const matA = trackMat(
      new THREE.MeshBasicMaterial({ color: trailColors.primary, transparent: true, opacity: 0.9 }),
    )
    const matB = trackMat(
      new THREE.MeshBasicMaterial({ color: trailColors.secondary, transparent: true, opacity: 0.9 }),
    )
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(pGeo, i % 2 === 0 ? matA : matB)
      m.visible = false
      root.add(m)
      trailParticles.push({ mesh: m, age: 99, maxAge: 0.55, vx: 0, vy: 0, vz: 0 })
    }
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
    nameplateTex = createNameplateTexture(username, rank, clanTag)
    const npMat = trackMat(new THREE.SpriteMaterial({ map: nameplateTex, transparent: true, depthTest: false }))
    nameplateSprite = new THREE.Sprite(npMat)
    nameplateSprite.position.set(0, 4.18, 0)
    nameplateSprite.scale.set(2.55, 0.62, 1)
    root.add(nameplateSprite)
  }

  // Speech bubble sprite (U-04 upgraded 3D bubble with smooth pop-in)
  const speechMat = trackMat(new THREE.SpriteMaterial({ transparent: true, depthTest: false }))
  const speechSprite = new THREE.Sprite(speechMat)
  speechSprite.position.set(0, 5.05, 0)
  speechSprite.scale.set(3.8, 1.0, 1)
  speechSprite.visible = false
  root.add(speechSprite)
  let speechTex: THREE.CanvasTexture | null = null
  let speechPop = 0

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

    // P-01 & P-02: Animate 3D back accessory, companion pet & footstep trail particles
    backRes.animate(elapsed, pose)
    petRes.animate(elapsed, airHeight)

    if (trailParticles.length > 0) {
      const isMovingPose =
        pose === 'walk' || pose === 'run' || pose === 'jump' || pose === 'fall' || pose === 'spin' || pose === 'backflip'
      const rate = pose === 'run' || pose === 'jump' ? 0.045 : isMovingPose ? 0.075 : 0.22
      trailSpawnAcc += dt
      if (trailSpawnAcc >= rate) {
        trailSpawnAcc = 0
        const slot = trailParticles[trailCursor % trailParticles.length]
        trailCursor++
        slot.age = 0
        slot.maxAge = isMovingPose ? 0.55 : 0.72
        const side = (trailCursor % 2 === 0 ? 1 : -1) * 0.32
        slot.mesh.position.set(side + (Math.random() - 0.5) * 0.16, 0.14 + Math.random() * 0.14, -0.25)
        slot.vx = (Math.random() - 0.5) * 0.45
        slot.vy = isMovingPose ? 0.9 + Math.random() * 0.55 : 0.65 + Math.random() * 0.35
        slot.vz = isMovingPose ? -2.2 - Math.random() * 0.8 : -0.35
        slot.mesh.visible = true
      }

      for (const p of trailParticles) {
        if (!p.mesh.visible) continue
        p.age += dt
        if (p.age >= p.maxAge) {
          p.mesh.visible = false
          continue
        }
        const k = 1 - p.age / p.maxAge
        p.mesh.position.x += p.vx * dt
        p.mesh.position.y += p.vy * dt
        p.mesh.position.z += p.vz * dt
        p.mesh.rotation.y += dt * 4.5
        p.mesh.rotation.x += dt * 3.1
        const s = 0.25 + k * 0.95
        p.mesh.scale.setScalar(s)
      }
    }

    // Keep overhead nameplate cleanly above the head during high jumps/flips
    if (nameplateSprite) {
      nameplateSprite.position.y = 4.18 + airHeight * 0.75
    }
    if (speechSprite.visible) {
      speechPop = Math.min(1, speechPop + dt * 7.5)
      const easeOutBack = 1 + 2.1 * Math.pow(speechPop - 1, 3) + 1.1 * Math.pow(speechPop - 1, 2)
      const bob = Math.sin(elapsed * 2.6) * 0.04
      speechSprite.scale.set(3.8 * easeOutBack, 1.0 * easeOutBack, 1)
      speechSprite.position.y = 5.05 + airHeight * 0.75 + bob
    }
  }

  const setSpeech = (text: string | null) => {
    if (!text) {
      speechSprite.visible = false
      speechPop = 0
      return
    }
    if (speechTex) speechTex.dispose()
    speechTex = createSpeechTexture(text)
    speechMat.map = speechTex
    speechMat.needsUpdate = true
    speechPop = 0.08
    speechSprite.visible = true
  }

  const setNameplate = (newUsername: string, newRank: string, newClanTag?: string | null) => {
    if (!nameplateSprite) return
    if (nameplateTex) nameplateTex.dispose()
    nameplateTex = createNameplateTexture(newUsername, newRank, newClanTag)
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
