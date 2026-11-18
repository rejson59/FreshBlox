import * as THREE from 'three'

/**
 * FreshBlox Original Stylized Material Library (Zero Roblox studs, Zero flat plastic, Zero neon!)
 * Each surface generates a paired color albedo detail map + tactile height bumpMap (256x256, cached once)
 * so sunlight & moonlight naturally catch bevels, grooves, stone grain, wood fibers, and crystal facets.
 */

export type FreshSurfaceKind =
  | 'facetTile' // Signature FreshBlox beveled chamfer tile (replaces Roblox studs!)
  | 'terrazzo' // Bright arctic architectural stone pavers with subtle mineral flecks
  | 'marble' // Polished honed ceramic/marble slabs with delicate veining (checkpoints, podiums, walkways)
  | 'fluted' // Sculpted architectural fluted grooves (pillars, zone arches, portal columns)
  | 'wood' // Warm stylized timber planks with organic wood grain (benches, trunks, accents)
  | 'foliage' // Stylized painterly layered leaf clusters (trees)
  | 'ice' // Frosted glacier ice with angular crystal fractures & crisp specular relief
  | 'hazard' // Textured embossed diagonal caution ribs (red hazards, spinners)
  | 'grip' // Tactile diamond-tread athletic grip surface (bounce pads, jump pads, pushers)
  | 'water' // Soft stylized daylight caustics & gentle ripples (fountain pool)

export interface FreshTexturePair {
  map: THREE.CanvasTexture
  bumpMap: THREE.CanvasTexture
  defaultBumpScale: number
}

const pairCache = new Map<FreshSurfaceKind, FreshTexturePair>()

// Deterministic PRNG for clean repeatable grain
function makeRng(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function makeCanvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  return [c, c.getContext('2d')!]
}

function finalizeTexture(canvas: HTMLCanvasElement, isColor: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace
  }
  tex.anisotropy = 4
  return tex
}

/** Add subtle tactile micro-grain so surfaces never look like sterile flat plastic */
function applyMicroGrain(
  ctx: CanvasRenderingContext2D,
  size: number,
  seed: number,
  count: number,
  alphaLight: number,
  alphaDark: number,
  maxRadius = 1.6,
) {
  const rand = makeRng(seed)
  for (let i = 0; i < count; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = 0.6 + rand() * maxRadius
    const bright = rand() > 0.5
    ctx.fillStyle = bright
      ? `rgba(255,255,255,${(rand() * alphaLight).toFixed(3)})`
      : `rgba(15,23,42,${(rand() * alphaDark).toFixed(3)})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function buildFacetTile(): FreshTexturePair {
  const S = 256
  const [cCol, col] = makeCanvas(S)
  const [cBmp, bmp] = makeCanvas(S)

  // Neutral white base (tinted cleanly by material.color)
  col.fillStyle = '#E8EFF6'
  col.fillRect(0, 0, S, S)
  bmp.fillStyle = '#404040'
  bmp.fillRect(0, 0, S, S)

  // 2x2 architectural chamfered FreshBlox tiles with subtle diagonal facet sheen
  const half = S / 2
  const pad = 6
  const cut = 14

  const drawChamferPath = (ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, c: number) => {
    ctx.beginPath()
    ctx.moveTo(ox + c, oy)
    ctx.lineTo(ox + w - c, oy)
    ctx.lineTo(ox + w, oy + c)
    ctx.lineTo(ox + w, oy + h - c)
    ctx.lineTo(ox + w - c, oy + h)
    ctx.lineTo(ox + c, oy + h)
    ctx.lineTo(ox, oy + h - c)
    ctx.lineTo(ox, oy + c)
    ctx.closePath()
  }

  for (let gx = 0; gx < 2; gx++) {
    for (let gy = 0; gy < 2; gy++) {
      const ox = gx * half + pad
      const oy = gy * half + pad
      const tw = half - pad * 2
      const th = half - pad * 2

      // Albedo: crisp soft bevel shading + signature FreshBlox subtle diagonal facet plane
      const grad = col.createLinearGradient(ox, oy, ox + tw, oy + th)
      grad.addColorStop(0, '#FFFFFF')
      grad.addColorStop(0.52, '#F4F8FC')
      grad.addColorStop(1, '#E6EEF7')
      drawChamferPath(col, ox, oy, tw, th, cut)
      col.fillStyle = grad
      col.fill()

      // Signature subtle diagonal facet split (nod to FreshBlox F-03 crystal facet, super tasteful)
      col.save()
      drawChamferPath(col, ox, oy, tw, th, cut)
      col.clip()
      col.beginPath()
      col.moveTo(ox, oy)
      col.lineTo(ox + tw, oy)
      col.lineTo(ox, oy + th)
      col.closePath()
      col.fillStyle = 'rgba(255, 255, 255, 0.24)'
      col.fill()

      // Inner recessed precision frame line
      drawChamferPath(col, ox + 10, oy + 10, tw - 20, th - 20, 8)
      col.strokeStyle = 'rgba(15, 23, 42, 0.065)'
      col.lineWidth = 2
      col.stroke()
      col.restore()

      // Top-left crisp highlight edge, bottom-right subtle shadow edge
      drawChamferPath(col, ox + 1, oy + 1, tw - 2, th - 2, cut - 1)
      col.strokeStyle = 'rgba(255, 255, 255, 0.72)'
      col.lineWidth = 2
      col.stroke()

      // Bump map: raised chamfered tile plateau with recessed inner groove
      drawChamferPath(bmp, ox, oy, tw, th, cut)
      bmp.fillStyle = '#D8D8D8'
      bmp.fill()
      drawChamferPath(bmp, ox + 5, oy + 5, tw - 10, th - 10, cut - 3)
      bmp.fillStyle = '#F2F2F2'
      bmp.fill()
      drawChamferPath(bmp, ox + 10, oy + 10, tw - 20, th - 20, 8)
      bmp.strokeStyle = '#A0A0A0'
      bmp.lineWidth = 2.5
      bmp.stroke()
    }
  }

  // Subtle corner diamond pins at tile intersections (unique FreshBlox architectural detail!)
  const joints = [
    [0, 0],
    [half, 0],
    [S, 0],
    [0, half],
    [half, half],
    [S, half],
    [0, S],
    [half, S],
    [S, S],
  ]
  for (const [jx, jy] of joints) {
    col.fillStyle = 'rgba(15, 23, 42, 0.11)'
    col.beginPath()
    col.moveTo(jx, jy - 7)
    col.lineTo(jx + 7, jy)
    col.lineTo(jx, jy + 7)
    col.lineTo(jx - 7, jy)
    col.closePath()
    col.fill()

    bmp.fillStyle = '#909090'
    bmp.beginPath()
    bmp.moveTo(jx, jy - 6)
    bmp.lineTo(jx + 6, jy)
    bmp.lineTo(jx, jy + 6)
    bmp.lineTo(jx - 6, jy)
    bmp.closePath()
    bmp.fill()
  }

  applyMicroGrain(col, S, 101, 420, 0.12, 0.055, 1.3)
  applyMicroGrain(bmp, S, 102, 420, 0.08, 0.08, 1.2)

  return {
    map: finalizeTexture(cCol, true),
    bumpMap: finalizeTexture(cBmp, false),
    defaultBumpScale: 0.06,
  }
}

function buildTerrazzo(): FreshTexturePair {
  const S = 256
  const [cCol, col] = makeCanvas(S)
  const [cBmp, bmp] = makeCanvas(S)
  const rand = makeRng(202)

  col.fillStyle = '#F3F7FB'
  col.fillRect(0, 0, S, S)
  bmp.fillStyle = '#C8C8C8'
  bmp.fillRect(0, 0, S, S)

  // Large staggered ashlar stone paver slabs
  const slabs = [
    [0, 0, 152, 126],
    [154, 0, 102, 126],
    [0, 128, 92, 128],
    [94, 128, 162, 128],
  ]
  for (const [x, y, w, h] of slabs) {
    const tone = 242 + Math.floor(rand() * 12)
    col.fillStyle = `rgb(${tone},${tone + 2},${Math.min(255, tone + 5)})`
    col.fillRect(x + 2, y + 2, w - 4, h - 4)

    bmp.fillStyle = '#E8E8E8'
    bmp.fillRect(x + 2, y + 2, w - 4, h - 4)
  }

  // Grout lines
  col.strokeStyle = 'rgba(30, 58, 95, 0.14)'
  col.lineWidth = 3
  col.beginPath()
  col.moveTo(0, 127)
  col.lineTo(S, 127)
  col.moveTo(153, 0)
  col.lineTo(153, 127)
  col.moveTo(93, 127)
  col.lineTo(93, S)
  col.stroke()

  bmp.strokeStyle = '#555555'
  bmp.lineWidth = 4
  bmp.beginPath()
  bmp.moveTo(0, 127)
  bmp.lineTo(S, 127)
  bmp.moveTo(153, 0)
  bmp.lineTo(153, 127)
  bmp.moveTo(93, 127)
  bmp.lineTo(93, S)
  bmp.stroke()

  // Terrazzo mineral chips (subtle warm grey, ice blue, crisp white)
  const chipColors = [
    'rgba(100,116,139,0.16)',
    'rgba(56,189,248,0.14)',
    'rgba(255,255,255,0.55)',
    'rgba(71,85,105,0.11)',
  ]
  for (let i = 0; i < 210; i++) {
    const cx = rand() * S
    const cy = rand() * S
    const r = 1.4 + rand() * 3.8
    col.fillStyle = chipColors[Math.floor(rand() * chipColors.length)]
    col.beginPath()
    col.moveTo(cx, cy - r)
    col.lineTo(cx + r * 0.9, cy + r * 0.2)
    col.lineTo(cx - r * 0.6, cy + r * 0.85)
    col.closePath()
    col.fill()
  }

  applyMicroGrain(col, S, 205, 500, 0.1, 0.06, 1.3)
  applyMicroGrain(bmp, S, 206, 550, 0.12, 0.12, 1.4)

  return {
    map: finalizeTexture(cCol, true),
    bumpMap: finalizeTexture(cBmp, false),
    defaultBumpScale: 0.055,
  }
}

function buildMarble(): FreshTexturePair {
  const S = 256
  const [cCol, col] = makeCanvas(S)
  const [cBmp, bmp] = makeCanvas(S)
  const rand = makeRng(303)

  const baseGrad = col.createLinearGradient(0, 0, S, S)
  baseGrad.addColorStop(0, '#FFFFFF')
  baseGrad.addColorStop(0.5, '#F5F9FD')
  baseGrad.addColorStop(1, '#EDF4FB')
  col.fillStyle = baseGrad
  col.fillRect(0, 0, S, S)

  bmp.fillStyle = '#EAEAEA'
  bmp.fillRect(0, 0, S, S)

  // Soft natural diagonal stone veins
  for (let v = 0; v < 9; v++) {
    let x = rand() * S
    let y = 0
    col.beginPath()
    col.moveTo(x, y)
    bmp.beginPath()
    bmp.moveTo(x, y)
    for (let step = 0; step < 12; step++) {
      x += (rand() - 0.35) * 32
      y += S / 11
      col.lineTo(x, y)
      bmp.lineTo(x, y)
    }
    col.strokeStyle = `rgba(100, 116, 139, ${(0.04 + rand() * 0.065).toFixed(3)})`
    col.lineWidth = 1.2 + rand() * 3.2
    col.stroke()

    bmp.strokeStyle = 'rgba(180,180,180,0.35)'
    bmp.lineWidth = 1.5
    bmp.stroke()
  }

  // Crisp subtle honed architectural border seams (1 large tile per repeat)
  col.strokeStyle = 'rgba(15, 23, 42, 0.1)'
  col.lineWidth = 3
  col.strokeRect(1.5, 1.5, S - 3, S - 3)
  col.strokeStyle = 'rgba(255, 255, 255, 0.75)'
  col.lineWidth = 2
  col.strokeRect(4, 4, S - 8, S - 8)

  bmp.strokeStyle = '#6A6A6A'
  bmp.lineWidth = 4
  bmp.strokeRect(2, 2, S - 4, S - 4)

  applyMicroGrain(col, S, 309, 260, 0.09, 0.04, 1.1)

  return {
    map: finalizeTexture(cCol, true),
    bumpMap: finalizeTexture(cBmp, false),
    defaultBumpScale: 0.04,
  }
}

function buildFluted(): FreshTexturePair {
  const S = 256
  const [cCol, col] = makeCanvas(S)
  const [cBmp, bmp] = makeCanvas(S)

  const ribs = 8
  const ribW = S / ribs
  for (let i = 0; i < ribs; i++) {
    const x = i * ribW
    // Concave architectural flute shading
    const gCol = col.createLinearGradient(x, 0, x + ribW, 0)
    gCol.addColorStop(0, '#D7E2EE')
    gCol.addColorStop(0.18, '#FFFFFF')
    gCol.addColorStop(0.55, '#F2F7FC')
    gCol.addColorStop(0.88, '#E3ECF5')
    gCol.addColorStop(1, '#CFDCE9')
    col.fillStyle = gCol
    col.fillRect(x, 0, ribW, S)

    const gBmp = bmp.createLinearGradient(x, 0, x + ribW, 0)
    gBmp.addColorStop(0, '#505050')
    gBmp.addColorStop(0.22, '#F2F2F2')
    gBmp.addColorStop(0.5, '#C0C0C0')
    gBmp.addColorStop(0.78, '#F2F2F2')
    gBmp.addColorStop(1, '#505050')
    bmp.fillStyle = gBmp
    bmp.fillRect(x, 0, ribW, S)
  }

  // Horizontal architectural collar bands
  for (const bandY of [4, S - 10]) {
    col.fillStyle = 'rgba(255,255,255,0.45)'
    col.fillRect(0, bandY, S, 6)
    bmp.fillStyle = '#FFFFFF'
    bmp.fillRect(0, bandY, S, 6)
  }

  applyMicroGrain(col, S, 404, 300, 0.08, 0.05, 1.1)

  return {
    map: finalizeTexture(cCol, true),
    bumpMap: finalizeTexture(cBmp, false),
    defaultBumpScale: 0.085,
  }
}

function buildWood(): FreshTexturePair {
  const S = 256
  const [cCol, col] = makeCanvas(S)
  const [cBmp, bmp] = makeCanvas(S)
  const rand = makeRng(505)

  col.fillStyle = '#F2ECE4'
  col.fillRect(0, 0, S, S)
  bmp.fillStyle = '#CFCFCF'
  bmp.fillRect(0, 0, S, S)

  const planks = 4
  const pH = S / planks

  for (let p = 0; p < planks; p++) {
    const py = p * pH
    const shade = 232 + Math.floor(rand() * 20)
    col.fillStyle = `rgb(${shade},${shade - 4},${shade - 10})`
    col.fillRect(0, py + 2, S, pH - 4)

    // Flowing wood grain fibers
    for (let g = 0; g < 16; g++) {
      const gy = py + 4 + rand() * (pH - 8)
      const amp = 1.2 + rand() * 2.5
      const freq = 0.02 + rand() * 0.025
      const ph = rand() * Math.PI * 2
      col.beginPath()
      bmp.beginPath()
      for (let x = 0; x <= S; x += 12) {
        const y = gy + Math.sin(x * freq + ph) * amp
        if (x === 0) {
          col.moveTo(x, y)
          bmp.moveTo(x, y)
        } else {
          col.lineTo(x, y)
          bmp.lineTo(x, y)
        }
      }
      col.strokeStyle =
        g % 3 === 0 ? 'rgba(255,255,255,0.22)' : `rgba(68, 46, 28, ${(0.07 + rand() * 0.09).toFixed(3)})`
      col.lineWidth = 1 + rand() * 1.4
      col.stroke()

      bmp.strokeStyle = g % 2 === 0 ? 'rgba(170,170,170,0.45)' : 'rgba(235,235,235,0.35)'
      bmp.lineWidth = 1.4
      bmp.stroke()
    }

    // Plank seam
    col.fillStyle = 'rgba(30, 20, 12, 0.22)'
    col.fillRect(0, py, S, 3)
    bmp.fillStyle = '#404040'
    bmp.fillRect(0, py, S, 4)
  }

  return {
    map: finalizeTexture(cCol, true),
    bumpMap: finalizeTexture(cBmp, false),
    defaultBumpScale: 0.07,
  }
}

function buildFoliage(): FreshTexturePair {
  const S = 256
  const [cCol, col] = makeCanvas(S)
  const [cBmp, bmp] = makeCanvas(S)
  const rand = makeRng(606)

  col.fillStyle = '#EDF6FB'
  col.fillRect(0, 0, S, S)
  bmp.fillStyle = '#909090'
  bmp.fillRect(0, 0, S, S)

  // Stylized painterly leaf clusters (tiling smoothly across edges)
  for (let i = 0; i < 140; i++) {
    const cx = rand() * S
    const cy = rand() * S
    const rx = 10 + rand() * 18
    const ry = 6 + rand() * 12
    const ang = rand() * Math.PI
    const light = 225 + Math.floor(rand() * 30)
    const bVal = 155 + Math.floor(rand() * 95)

    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        const px = cx + ox
        const py = cy + oy
        if (px < -30 || px > S + 30 || py < -30 || py > S + 30) continue
        col.save()
        col.translate(px, py)
        col.rotate(ang)
        col.fillStyle = `rgba(${light},${light},${Math.min(255, light + 4)},0.65)`
        col.beginPath()
        col.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
        col.fill()
        col.restore()

        bmp.save()
        bmp.translate(px, py)
        bmp.rotate(ang)
        bmp.fillStyle = `rgb(${bVal},${bVal},${bVal})`
        bmp.beginPath()
        bmp.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
        bmp.fill()
        bmp.restore()
      }
    }
  }

  return {
    map: finalizeTexture(cCol, true),
    bumpMap: finalizeTexture(cBmp, false),
    defaultBumpScale: 0.08,
  }
}

function buildIce(): FreshTexturePair {
  const S = 256
  const [cCol, col] = makeCanvas(S)
  const [cBmp, bmp] = makeCanvas(S)
  const rand = makeRng(707)

  const g = col.createLinearGradient(0, 0, S, S)
  g.addColorStop(0, '#FFFFFF')
  g.addColorStop(0.5, '#EBF7FF')
  g.addColorStop(1, '#D8F0FF')
  col.fillStyle = g
  col.fillRect(0, 0, S, S)

  bmp.fillStyle = '#DFDFDF'
  bmp.fillRect(0, 0, S, S)

  // Angular crystal sheen polygons
  for (let i = 0; i < 14; i++) {
    const x = rand() * S
    const y = rand() * S
    const r = 24 + rand() * 44
    col.beginPath()
    col.moveTo(x, y - r * 0.6)
    col.lineTo(x + r * 0.8, y + r * 0.1)
    col.lineTo(x - r * 0.2, y + r * 0.7)
    col.closePath()
    col.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.34)' : 'rgba(56,189,248,0.12)'
    col.fill()
  }

  // Crisp glacial fracture lines
  for (let c = 0; c < 12; c++) {
    let x = rand() * S
    let y = rand() * S
    col.beginPath()
    col.moveTo(x, y)
    bmp.beginPath()
    bmp.moveTo(x, y)
    for (let s = 0; s < 5; s++) {
      x += (rand() - 0.5) * 65
      y += (rand() - 0.5) * 65
      col.lineTo(x, y)
      bmp.lineTo(x, y)
    }
    col.strokeStyle = 'rgba(255, 255, 255, 0.72)'
    col.lineWidth = 1.4
    col.stroke()

    bmp.strokeStyle = '#606060'
    bmp.lineWidth = 2.0
    bmp.stroke()
  }

  // Frosted edge rim
  col.strokeStyle = 'rgba(255,255,255,0.65)'
  col.lineWidth = 6
  col.strokeRect(3, 3, S - 6, S - 6)

  return {
    map: finalizeTexture(cCol, true),
    bumpMap: finalizeTexture(cBmp, false),
    defaultBumpScale: 0.065,
  }
}

function buildHazard(): FreshTexturePair {
  const S = 256
  const [cCol, col] = makeCanvas(S)
  const [cBmp, bmp] = makeCanvas(S)

  // Subtle embossed diagonal caution chevrons (red-on-crimson, tasteful & unmistakably hazardous, zero neon!)
  col.fillStyle = '#F4F4F5'
  col.fillRect(0, 0, S, S)
  bmp.fillStyle = '#9A9A9A'
  bmp.fillRect(0, 0, S, S)

  col.save()
  bmp.save()
  const stripeW = 32
  for (let i = -S; i < S * 2; i += stripeW * 2) {
    col.fillStyle = '#C9CDD4'
    col.beginPath()
    col.moveTo(i, 0)
    col.lineTo(i + stripeW, 0)
    col.lineTo(i + stripeW - S, S)
    col.lineTo(i - S, S)
    col.closePath()
    col.fill()

    bmp.fillStyle = '#EFEFEF'
    bmp.beginPath()
    bmp.moveTo(i, 0)
    bmp.lineTo(i + stripeW, 0)
    bmp.lineTo(i + stripeW - S, S)
    bmp.lineTo(i - S, S)
    bmp.closePath()
    bmp.fill()
  }
  col.restore()
  bmp.restore()

  applyMicroGrain(col, S, 808, 320, 0.09, 0.06, 1.2)

  return {
    map: finalizeTexture(cCol, true),
    bumpMap: finalizeTexture(cBmp, false),
    defaultBumpScale: 0.075,
  }
}

function buildGrip(): FreshTexturePair {
  const S = 256
  const [cCol, col] = makeCanvas(S)
  const [cBmp, bmp] = makeCanvas(S)

  col.fillStyle = '#EEF3F8'
  col.fillRect(0, 0, S, S)
  bmp.fillStyle = '#888888'
  bmp.fillRect(0, 0, S, S)

  // Tactile athletic diamond-tread pattern (for bounce pads, jump pads, pushers, balance rails)
  const step = 32
  for (let y = 0; y < S; y += step) {
    for (let x = 0; x < S; x += step) {
      const cx = x + step / 2
      const cy = y + step / 2
      const diag = ((x + y) / step) % 2 === 0

      col.save()
      col.translate(cx, cy)
      col.rotate(diag ? Math.PI / 4 : -Math.PI / 4)
      col.fillStyle = 'rgba(255,255,255,0.55)'
      col.beginPath()
      col.roundRect(-8, -3, 16, 6, 3)
      col.fill()
      col.strokeStyle = 'rgba(15,23,42,0.12)'
      col.lineWidth = 1.2
      col.stroke()
      col.restore()

      bmp.save()
      bmp.translate(cx, cy)
      bmp.rotate(diag ? Math.PI / 4 : -Math.PI / 4)
      bmp.fillStyle = '#F5F5F5'
      bmp.beginPath()
      bmp.roundRect(-8, -3, 16, 6, 3)
      bmp.fill()
      bmp.restore()
    }
  }

  return {
    map: finalizeTexture(cCol, true),
    bumpMap: finalizeTexture(cBmp, false),
    defaultBumpScale: 0.07,
  }
}

function buildWater(): FreshTexturePair {
  const S = 256
  const [cCol, col] = makeCanvas(S)
  const [cBmp, bmp] = makeCanvas(S)
  const rand = makeRng(909)

  col.fillStyle = '#DDF3FF'
  col.fillRect(0, 0, S, S)
  bmp.fillStyle = '#808080'
  bmp.fillRect(0, 0, S, S)

  // Soft stylized sunlit caustic rings
  for (let i = 0; i < 34; i++) {
    const cx = rand() * S
    const cy = rand() * S
    const r = 14 + rand() * 28
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        const px = cx + ox
        const py = cy + oy
        if (px < -40 || px > S + 40 || py < -40 || py > S + 40) continue
        col.strokeStyle = 'rgba(255,255,255,0.42)'
        col.lineWidth = 2.4
        col.beginPath()
        col.arc(px, py, r, 0, Math.PI * 2)
        col.stroke()

        bmp.strokeStyle = 'rgba(230,230,230,0.45)'
        bmp.lineWidth = 3
        bmp.beginPath()
        bmp.arc(px, py, r, 0, Math.PI * 2)
        bmp.stroke()
      }
    }
  }

  return {
    map: finalizeTexture(cCol, true),
    bumpMap: finalizeTexture(cBmp, false),
    defaultBumpScale: 0.045,
  }
}

export function getFreshTexturePair(kind: FreshSurfaceKind): FreshTexturePair {
  const cached = pairCache.get(kind)
  if (cached) return cached

  let built: FreshTexturePair
  switch (kind) {
    case 'facetTile':
      built = buildFacetTile()
      break
    case 'terrazzo':
      built = buildTerrazzo()
      break
    case 'marble':
      built = buildMarble()
      break
    case 'fluted':
      built = buildFluted()
      break
    case 'wood':
      built = buildWood()
      break
    case 'foliage':
      built = buildFoliage()
      break
    case 'ice':
      built = buildIce()
      break
    case 'hazard':
      built = buildHazard()
      break
    case 'grip':
      built = buildGrip()
      break
    case 'water':
      built = buildWater()
      break
  }

  pairCache.set(kind, built)
  return built
}

/**
 * Helper: clone a cached texture pair with custom UV repeat so blocks of any size
 * keep crisp, unstretched texel density!
 */
export function cloneFreshTexturesWithRepeat(
  kind: FreshSurfaceKind,
  rx: number,
  ry: number,
  trackTex?: <T extends THREE.Texture>(t: T) => T,
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture; bumpScale: number } {
  const base = getFreshTexturePair(kind)
  if (rx === 1 && ry === 1) {
    return { map: base.map, bumpMap: base.bumpMap, bumpScale: base.defaultBumpScale }
  }
  const map = base.map.clone()
  map.needsUpdate = true
  map.repeat.set(rx, ry)

  const bumpMap = base.bumpMap.clone()
  bumpMap.needsUpdate = true
  bumpMap.repeat.set(rx, ry)

  if (trackTex) {
    trackTex(map)
    trackTex(bumpMap)
  }
  return { map, bumpMap, bumpScale: base.defaultBumpScale }
}
