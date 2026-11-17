import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { cloneFreshTexturesWithRepeat, FreshSurfaceKind } from './freshTextures'
import { createFreshBloxMonument } from './freshLogo3D'
import { generateTestObbyCourse, OBBY_ZONES } from './obbyCourse'

export type WorldPreviewKey = 'lobby' | 'obby' | 'arena' | 'frisbee'

export type WorldThumbnailMap = Partial<Record<WorldPreviewKey, string>>

let cachedThumbnails: WorldThumbnailMap | null = null
let pendingPromise: Promise<WorldThumbnailMap> | null = null

interface DisposableTracker {
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T
  trackMat: <T extends THREE.Material>(m: T) => T
  trackTex: <T extends THREE.Texture>(t: T) => T
  getSurfaceMat: (
    kind: FreshSurfaceKind,
    colorHex: string,
    rx?: number,
    ry?: number,
    roughness?: number,
    metalness?: number,
  ) => THREE.MeshStandardMaterial
  disposeAll: () => void
}

function createTracker(): DisposableTracker {
  const geos: THREE.BufferGeometry[] = []
  const mats: THREE.Material[] = []
  const texs: THREE.Texture[] = []
  const matCache = new Map<string, THREE.MeshStandardMaterial>()

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geos.push(g)
    return g
  }
  const trackMat = <T extends THREE.Material>(m: T): T => {
    mats.push(m)
    return m
  }
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    texs.push(t)
    return t
  }

  const getSurfaceMat = (
    kind: FreshSurfaceKind,
    colorHex: string,
    rx = 1,
    ry = 1,
    roughness = 0.54,
    metalness = 0.06,
  ): THREE.MeshStandardMaterial => {
    const key = `${kind}|${colorHex}|${rx.toFixed(1)}|${ry.toFixed(1)}|${roughness}|${metalness}`
    const cached = matCache.get(key)
    if (cached) return cached
    const tex = cloneFreshTexturesWithRepeat(kind, rx, ry, trackTex)
    const mat = trackMat(
      new THREE.MeshStandardMaterial({
        color: colorHex,
        map: tex.map,
        bumpMap: tex.bumpMap,
        bumpScale: tex.bumpScale,
        roughness,
        metalness,
      }),
    )
    matCache.set(key, mat)
    return mat
  }

  const disposeAll = () => {
    for (const g of geos) g.dispose()
    for (const m of mats) m.dispose()
    for (const t of texs) t.dispose()
    geos.length = 0
    mats.length = 0
    texs.length = 0
    matCache.clear()
  }

  return { trackGeo, trackMat, trackTex, getSurfaceMat, disposeAll }
}

function setupArcticLighting(
  scene: THREE.Scene,
  sunPos: [number, number, number],
  shadowExtent = 46,
  fogNear = 85,
  fogFar = 220,
) {
  scene.background = new THREE.Color('#B8E3FF')
  scene.fog = new THREE.Fog('#CBEAFF', fogNear, fogFar)

  const hemi = new THREE.HemisphereLight('#F4FAFF', '#6088B8', 1.1)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight('#FFF7E8', 1.9)
  sun.position.set(sunPos[0], sunPos[1], sunPos[2])
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.near = 4
  sun.shadow.camera.far = 180
  sun.shadow.camera.left = -shadowExtent
  sun.shadow.camera.right = shadowExtent
  sun.shadow.camera.top = shadowExtent
  sun.shadow.camera.bottom = -shadowExtent
  sun.shadow.bias = -0.0005
  scene.add(sun)

  const fill = new THREE.DirectionalLight('#93C5FD', 0.45)
  fill.position.set(-sunPos[0] * 0.7, 24, -sunPos[2] * 0.7)
  scene.add(fill)
}

/**
 * 1. MAIN LOBBY — Authentic bird's-eye 3/4 shot of the real MainLobbyWorld geometry
 */
function renderLobbyThumbnail(renderer: THREE.WebGLRenderer, width: number, height: number): string {
  const scene = new THREE.Scene()
  const tr = createTracker()
  setupArcticLighting(scene, [34, 48, 28], 46)

  const camera = new THREE.PerspectiveCamera(38, width / height, 0.5, 280)
  camera.position.set(39, 31, 39)
  camera.lookAt(0, 1.8, -6.5)

  // Outer plaza base (74x74 terrazzo)
  const plaza = new THREE.Mesh(
    tr.trackGeo(new RoundedBoxGeometry(74, 2, 74, 2, 0.25)),
    tr.getSurfaceMat('terrazzo', '#DDEAF8', 16, 16, 0.66, 0.04),
  )
  plaza.position.set(0, -1, 0)
  plaza.receiveShadow = true
  scene.add(plaza)

  // Soft grass apron around the plaza for depth in bird's-eye framing
  const skirt = new THREE.Mesh(
    tr.trackGeo(new THREE.BoxGeometry(118, 1.4, 118)),
    tr.getSurfaceMat('terrazzo', '#C7DEF5', 22, 22, 0.78, 0.02),
  )
  skirt.position.set(0, -2.5, 0)
  skirt.receiveShadow = true
  scene.add(skirt)

  // Center marble rings
  const innerPlaza = new THREE.Mesh(
    tr.trackGeo(new THREE.BoxGeometry(26, 0.14, 26)),
    tr.getSurfaceMat('marble', '#EEF6FF', 7, 7, 0.34, 0.06),
  )
  innerPlaza.position.set(0, 0.05, 0)
  innerPlaza.receiveShadow = true
  scene.add(innerPlaza)

  const centerTile = new THREE.Mesh(
    tr.trackGeo(new THREE.BoxGeometry(14, 0.18, 14)),
    tr.getSurfaceMat('facetTile', '#DBEAFE', 5, 5, 0.32, 0.08),
  )
  centerTile.position.set(0, 0.07, 0)
  centerTile.receiveShadow = true
  scene.add(centerTile)

  // 4 marble walkways
  const walkMat = tr.getSurfaceMat('marble', '#FFFFFF', 4, 2, 0.28, 0.06)
  const walkX = new THREE.Mesh(tr.trackGeo(new THREE.BoxGeometry(58, 0.12, 4.4)), walkMat)
  walkX.position.set(0, 0.04, 0)
  walkX.receiveShadow = true
  scene.add(walkX)

  const walkZ = new THREE.Mesh(tr.trackGeo(new THREE.BoxGeometry(4.4, 0.12, 58)), walkMat)
  walkZ.position.set(0, 0.04, 0)
  walkZ.receiveShadow = true
  scene.add(walkZ)

  // Perimeter curb walls
  const borderMat = tr.getSurfaceMat('fluted', '#7C93B0', 14, 1, 0.45, 0.12)
  const wallCoords: [number, number, number, number][] = [
    [0, -37.2, 75, 1.4],
    [0, 37.2, 75, 1.4],
    [-37.2, 0, 1.4, 75],
    [37.2, 0, 1.4, 75],
  ]
  for (const [wx, wz, ww, wd] of wallCoords) {
    const w = new THREE.Mesh(tr.trackGeo(new THREE.BoxGeometry(ww, 1.35, wd)), borderMat)
    w.position.set(wx, 0.65, wz)
    w.castShadow = true
    w.receiveShadow = true
    scene.add(w)
  }

  // Central FreshBlox Sculpted 3D Logo Monument Statue (replaces old fountain!)
  const lobbyMonument = createFreshBloxMonument({ castShadow: true, includePlinth: true, logoScale: 0.06 })
  lobbyMonument.logoPivot.rotation.y = 0.48
  scene.add(lobbyMonument.group)

  // South Social Dance Stage
  const stageDeck = new THREE.Mesh(
    tr.trackGeo(new RoundedBoxGeometry(10.5, 0.65, 6.2, 2, 0.12)),
    tr.getSurfaceMat('facetTile', '#1E293B', 6, 4, 0.36, 0.16),
  )
  stageDeck.position.set(0, 0.32, 16)
  stageDeck.castShadow = true
  stageDeck.receiveShadow = true
  scene.add(stageDeck)

  const stageTrim = new THREE.Mesh(
    tr.trackGeo(new THREE.BoxGeometry(10.7, 0.14, 6.4)),
    tr.trackMat(new THREE.MeshStandardMaterial({ color: '#38BDF8', roughness: 0.22, metalness: 0.25 })),
  )
  stageTrim.position.set(0, 0.68, 16)
  scene.add(stageTrim)

  const stageBack = new THREE.Mesh(
    tr.trackGeo(new RoundedBoxGeometry(9.2, 4.4, 0.55, 2, 0.12)),
    tr.getSurfaceMat('fluted', '#1E3A5F', 6, 2, 0.34, 0.18),
  )
  stageBack.position.set(0, 2.75, 19.1)
  stageBack.castShadow = true
  scene.add(stageBack)

  // North 3 World Portals (Obby Gold, Lobby Sky, Arena Cyan)
  const portalSpecs: { x: number; z: number; accent: string; frame: string }[] = [
    { x: -12, z: -21, accent: '#F59E0B', frame: '#292524' },
    { x: 0, z: -24, accent: '#38BDF8', frame: '#1E293B' },
    { x: 12, z: -21, accent: '#06B6D4', frame: '#164E63' },
  ]
  for (const p of portalSpecs) {
    const g = new THREE.Group()
    g.position.set(p.x, 0, p.z)
    const frameMat = tr.getSurfaceMat('fluted', p.frame, 2, 4, 0.32, 0.22)
    const accentMat = tr.trackMat(
      new THREE.MeshStandardMaterial({ color: p.accent, roughness: 0.2, metalness: 0.24 }),
    )
    const lp = new THREE.Mesh(tr.trackGeo(new RoundedBoxGeometry(1.15, 6.4, 1.15, 2, 0.14)), frameMat)
    lp.position.set(-2.55, 3.2, 0)
    lp.castShadow = true
    g.add(lp)

    const rp = new THREE.Mesh(tr.trackGeo(new RoundedBoxGeometry(1.15, 6.4, 1.15, 2, 0.14)), frameMat)
    rp.position.set(2.55, 3.2, 0)
    rp.castShadow = true
    g.add(rp)

    const top = new THREE.Mesh(tr.trackGeo(new RoundedBoxGeometry(6.6, 1.15, 1.35, 2, 0.15)), accentMat)
    top.position.set(0, 6.5, 0)
    top.castShadow = true
    g.add(top)

    const veil = new THREE.Mesh(
      tr.trackGeo(new THREE.PlaneGeometry(4.0, 5.5)),
      tr.trackMat(
        new THREE.MeshStandardMaterial({
          color: p.accent,
          transparent: true,
          opacity: 0.42,
          roughness: 0.15,
          metalness: 0.1,
          side: THREE.DoubleSide,
        }),
      ),
    )
    veil.position.set(0, 3.1, 0)
    g.add(veil)

    const plinth = new THREE.Mesh(
      tr.trackGeo(new RoundedBoxGeometry(6.4, 0.42, 3.2, 2, 0.08)),
      tr.getSurfaceMat('marble', '#E2E8F0', 3, 2, 0.34, 0.06),
    )
    plinth.position.set(0, 0.21, 0)
    plinth.receiveShadow = true
    g.add(plinth)

    scene.add(g)
  }

  // East Sky Observation Parkour Terrace + 5 steps + floating gold crystal
  const terraceColors = ['#38BDF8', '#0EA5E9', '#22D3EE', '#60A5FA', '#0284C7']
  const steps: [number, number, number, number, number][] = [
    [15, 1.2, -5.5, 3.4, 3.4],
    [19.2, 2.5, -3.5, 3.4, 3.4],
    [22.4, 3.8, 0.4, 3.4, 3.4],
    [20.2, 5.1, 4.4, 3.4, 3.4],
    [16.8, 6.4, 7.6, 3.6, 3.6],
  ]
  steps.forEach(([sx, sy, sz, sw, sd], idx) => {
    const m = new THREE.Mesh(
      tr.trackGeo(new RoundedBoxGeometry(sw, 0.72, sd, 2, 0.1)),
      tr.getSurfaceMat('facetTile', terraceColors[idx % terraceColors.length], 2, 2, 0.32, 0.08),
    )
    m.position.set(sx, sy, sz)
    m.castShadow = true
    m.receiveShadow = true
    scene.add(m)
  })

  const obsDeck = new THREE.Mesh(
    tr.trackGeo(new RoundedBoxGeometry(8.5, 0.9, 8.5, 2, 0.15)),
    tr.getSurfaceMat('marble', '#F8FAFC', 4, 4, 0.3, 0.08),
  )
  obsDeck.position.set(22.5, 7.6, 12.2)
  obsDeck.castShadow = true
  obsDeck.receiveShadow = true
  scene.add(obsDeck)

  const obsCrystal = new THREE.Mesh(
    tr.trackGeo(new THREE.OctahedronGeometry(0.95, 0)),
    tr.trackMat(new THREE.MeshStandardMaterial({ color: '#F59E0B', roughness: 0.14, metalness: 0.3, flatShading: true })),
  )
  obsCrystal.position.set(22.5, 9.6, 12.2)
  obsCrystal.castShadow = true
  scene.add(obsCrystal)

  // Stylized FreshBlox Trees
  const trunkGeo = tr.trackGeo(new THREE.CylinderGeometry(0.38, 0.56, 3.4, 8))
  const trunkMat = tr.getSurfaceMat('wood', '#8B5E3C', 1, 2, 0.72, 0.03)
  const foliageGeo1 = tr.trackGeo(new THREE.DodecahedronGeometry(2.1, 0))
  const foliageGeo2 = tr.trackGeo(new THREE.DodecahedronGeometry(1.45, 0))
  const foliageMat1 = tr.getSurfaceMat('foliage', '#34D399', 2, 2, 0.65, 0.02)
  const foliageMat2 = tr.getSurfaceMat('foliage', '#10B981', 2, 2, 0.62, 0.02)

  const treeCoords: [number, number][] = [
    [-26, -22],
    [-28, -8],
    [-28, 12],
    [-20, 26],
    [20, -24],
    [29, -12],
    [15, 28],
    [-14, 28],
  ]
  for (const [tx, tz] of treeCoords) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat)
    trunk.position.set(tx, 1.7, tz)
    trunk.castShadow = true
    scene.add(trunk)
    const f1 = new THREE.Mesh(foliageGeo1, foliageMat1)
    f1.position.set(tx, 4.1, tz)
    f1.castShadow = true
    scene.add(f1)
    const f2 = new THREE.Mesh(foliageGeo2, foliageMat2)
    f2.position.set(tx, 5.5, tz)
    f2.castShadow = true
    scene.add(f2)
  }

  // Benches
  const woodMat = tr.getSurfaceMat('wood', '#A97142', 2, 1, 0.62, 0.04)
  const benchCoords: [number, number, number][] = [
    [-7.5, -7.5, Math.PI / 4],
    [7.5, -7.5, -Math.PI / 4],
    [-7.5, 7.5, (3 * Math.PI) / 4],
    [7.5, 7.5, (-3 * Math.PI) / 4],
  ]
  const benchGeo = tr.trackGeo(new RoundedBoxGeometry(2.8, 0.45, 0.9, 2, 0.08))
  for (const [bx, bz, rot] of benchCoords) {
    const b = new THREE.Mesh(benchGeo, woodMat)
    b.position.set(bx, 0.55, bz)
    b.rotation.y = rot
    b.castShadow = true
    scene.add(b)
  }

  // Jump-pads
  const padBaseGeo = tr.trackGeo(new THREE.CylinderGeometry(1.55, 1.8, 0.28, 18))
  const padRingGeo = tr.trackGeo(new THREE.TorusGeometry(1.22, 0.14, 10, 22))
  const padBaseMat = tr.getSurfaceMat('grip', '#1E293B', 2, 2, 0.38, 0.12)
  const padRingMat = tr.trackMat(new THREE.MeshStandardMaterial({ color: '#38BDF8', roughness: 0.2, metalness: 0.25 }))
  for (const [jx, jz] of [
    [11.5, -10.5],
    [-11.5, 12.5],
    [12.5, 14.5],
  ]) {
    const base = new THREE.Mesh(padBaseGeo, padBaseMat)
    base.position.set(jx, 0.14, jz)
    scene.add(base)
    const ring = new THREE.Mesh(padRingGeo, padRingMat)
    ring.rotation.x = Math.PI / 2
    ring.position.set(jx, 0.34, jz)
    scene.add(ring)
  }

  // Soft Arctic Sky clouds in the background
  const cloudMat = tr.trackMat(new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.85 }))
  const cloudGeo = tr.trackGeo(new RoundedBoxGeometry(11, 2.2, 5.5, 2, 0.7))
  const clouds: [number, number, number][] = [
    [-38, 18, -46],
    [-10, 21, -54],
    [22, 19, -48],
    [-46, 16, -10],
  ]
  for (const [cx, cy, cz] of clouds) {
    const c = new THREE.Mesh(cloudGeo, cloudMat)
    c.position.set(cx, cy, cz)
    scene.add(c)
  }

  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/webp', 0.9)
  lobbyMonument.dispose()
  tr.disposeAll()
  return url
}

/**
 * 2. TEST OBBY 100 — Real bird's-eye view straight from generateTestObbyCourse()!
 */
function renderObbyThumbnail(renderer: THREE.WebGLRenderer, width: number, height: number): string {
  const scene = new THREE.Scene()
  const tr = createTracker()
  const course = generateTestObbyCourse()

  // Filter first 18 stages for an ultra-crisp ascending aerial vista across Zones 1-2
  const maxStage = 18
  const visibleBlocks = course.blocks.filter((b) => b.stage <= maxStage)
  const cpStart = course.checkpoints[0]
  const cpFar = course.checkpoints[Math.min(10, course.checkpoints.length - 1)]

  setupArcticLighting(scene, [cpStart.x + 36, cpStart.y + 56, cpStart.z + 24], 88, 155, 360)

  // Compute a bold hero bird's-eye angle starting right beside the Zone 1 entry archway
  const dx = cpFar.x - cpStart.x
  const dz = cpFar.z - cpStart.z
  const len = Math.hypot(dx, dz) || 1
  const dirX = dx / len
  const dirZ = dz / len
  const sideX = -dirZ
  const sideZ = dirX

  const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 420)
  camera.position.set(
    cpStart.x - dirX * 9 + sideX * 15.5,
    cpStart.y + 13.5,
    cpStart.z - dirZ * 9 + sideZ * 15.5,
  )
  camera.lookAt(cpStart.x + dirX * 26, cpStart.y + 2.0, cpStart.z + dirZ * 26)

  const boxGeoCache = new Map<string, THREE.BufferGeometry>()
  const getBoxGeo = (w: number, h: number, d: number) => {
    const key = `${w.toFixed(2)}_${h.toFixed(2)}_${d.toFixed(2)}`
    let g = boxGeoCache.get(key)
    if (!g) {
      g = tr.trackGeo(new RoundedBoxGeometry(w, h, d, 2, Math.min(0.14, Math.min(w, h, d) * 0.22)))
      boxGeoCache.set(key, g)
    }
    return g
  }

  for (const b of visibleBlocks) {
    const kind = b.kind
    if (kind === 'pillar' || kind === 'bounce') {
      const geo = tr.trackGeo(new THREE.CylinderGeometry(b.w * 0.5, b.w * 0.52, b.h, 16))
      const mat =
        kind === 'bounce'
          ? tr.getSurfaceMat('grip', b.color, 2, 2, 0.34, 0.1)
          : tr.getSurfaceMat('fluted', b.color, 2, 2, 0.42, 0.08)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(b.x, b.y, b.z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)
      continue
    }

    if (kind === 'spinner') {
      const hub = new THREE.Mesh(
        tr.trackGeo(new THREE.CylinderGeometry(0.45, 0.52, 0.8, 12)),
        tr.getSurfaceMat('fluted', '#1E293B', 1, 1, 0.35, 0.2),
      )
      hub.position.set(b.x, b.y, b.z)
      hub.castShadow = true
      scene.add(hub)

      const radius = b.spinnerRadius ?? 3.6
      const barMat = tr.getSurfaceMat('hazard', b.color || '#EF4444', 4, 1, 0.38, 0.08)
      const bar = new THREE.Mesh(tr.trackGeo(new RoundedBoxGeometry(radius * 2, 0.42, 0.42, 2, 0.08)), barMat)
      bar.position.set(b.x, b.y + 0.18, b.z)
      bar.rotation.y = (b.spinnerPhase ?? 0) + 0.5
      bar.castShadow = true
      scene.add(bar)
      if (b.spinnerCross) {
        const bar2 = bar.clone()
        bar2.rotation.y += Math.PI / 2
        scene.add(bar2)
      }
      continue
    }

    let surface: FreshSurfaceKind = 'facetTile'
    let rough = 0.42
    if (kind === 'checkpoint') {
      surface = 'marble'
      rough = 0.28
    } else if (kind === 'hazard') {
      surface = 'hazard'
      rough = 0.36
    } else if (kind === 'ice') {
      surface = 'ice'
      rough = 0.16
    } else if (kind === 'jumppad' || kind === 'conveyor' || kind === 'pusher') {
      surface = 'grip'
      rough = 0.34
    }

    const rx = Math.max(1, Math.round(b.w / 2.2))
    const ry = Math.max(1, Math.round(b.d / 2.2))
    const mesh = new THREE.Mesh(getBoxGeo(b.w, b.h, b.d), tr.getSurfaceMat(surface, b.color, rx, ry, rough, 0.08))
    mesh.position.set(b.x, b.y, b.z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)

    // Add iconic FreshBlox checkpoint beacon post + pennant flag
    if (kind === 'checkpoint') {
      const zone = OBBY_ZONES[b.zone] ?? OBBY_ZONES[0]
      const pole = new THREE.Mesh(
        tr.trackGeo(new THREE.CylinderGeometry(0.11, 0.14, 3.2, 8)),
        tr.trackMat(new THREE.MeshStandardMaterial({ color: '#E2E8F0', roughness: 0.25, metalness: 0.4 })),
      )
      pole.position.set(b.x + b.w * 0.36, b.y + b.h * 0.5 + 1.6, b.z + b.d * 0.36)
      pole.castShadow = true
      scene.add(pole)

      const flag = new THREE.Mesh(
        tr.trackGeo(new RoundedBoxGeometry(1.35, 0.72, 0.12, 2, 0.04)),
        tr.trackMat(new THREE.MeshStandardMaterial({ color: zone.accent, roughness: 0.25, metalness: 0.15 })),
      )
      flag.position.set(b.x + b.w * 0.36 + 0.65, b.y + b.h * 0.5 + 2.75, b.z + b.d * 0.36)
      flag.castShadow = true
      scene.add(flag)
    }
  }

  // Floating clouds beneath & around the sky obby course
  const cloudMat = tr.trackMat(new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.86 }))
  const cloudGeo = tr.trackGeo(new RoundedBoxGeometry(14, 2.8, 7.5, 2, 0.9))
  for (let i = 0; i < 12; i++) {
    const t = i / 11
    const cx = cpStart.x + dirX * (t * 95 - 10) + sideX * ((i % 2 === 0 ? 1 : -1) * (16 + (i % 3) * 9))
    const cy = cpStart.y - 7 + (i % 4) * 3.5 + t * 10
    const cz = cpStart.z + dirZ * (t * 95 - 10) + sideZ * ((i % 2 === 0 ? 1 : -1) * (16 + (i % 3) * 9))
    const c = new THREE.Mesh(cloudGeo, cloudMat)
    c.position.set(cx, cy, cz)
    c.scale.set(0.85 + (i % 3) * 0.3, 1, 0.85 + ((i + 1) % 3) * 0.25)
    scene.add(c)
  }

  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/webp', 0.9)
  tr.disposeAll()
  return url
}

/**
 * 3. PORTAL ARENA 2.0 — Sealed Multi-Level Box Chamber (ZERO pits!) with glowing Cyan/Orange see-through Portals & Central Plasma Laser!
 */
function renderArenaThumbnail(renderer: THREE.WebGLRenderer, width: number, height: number): string {
  const scene = new THREE.Scene()
  const tr = createTracker()
  scene.background = new THREE.Color('#0B1426')

  const hemi = new THREE.HemisphereLight('#E0F2FE', '#1E293B', 1.2)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight('#FFFFFF', 1.45)
  sun.position.set(14, 21, 14)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  scene.add(sun)

  const cyanLight = new THREE.PointLight('#22D3EE', 3.4, 38)
  cyanLight.position.set(-12, 10, -14)
  scene.add(cyanLight)
  const orangeLight = new THREE.PointLight('#F97316', 3.4, 38)
  orangeLight.position.set(14, 10, -4)
  scene.add(orangeLight)

  const camera = new THREE.PerspectiveCamera(48, width / height, 0.4, 150)
  camera.position.set(17, 13.5, 20.5)
  camera.lookAt(-2, 5.5, -8)

  const floorMat = tr.getSurfaceMat('facetTile', '#E2E8F0', 8, 8, 0.34, 0.08)
  const wallMat = tr.getSurfaceMat('marble', '#EBF4FF', 6, 3, 0.28, 0.06)
  const darkMat = tr.getSurfaceMat('fluted', '#1E293B', 4, 2, 0.35, 0.25)

  // Enclosed Box Floor, Ceiling & Back/Side Walls
  const addPlane = (w: number, h: number, pos: [number, number, number], rot: [number, number, number], mat: THREE.Material) => {
    const m = new THREE.Mesh(tr.trackGeo(new THREE.PlaneGeometry(w, h)), mat)
    m.position.set(pos[0], pos[1], pos[2])
    m.rotation.set(rot[0], rot[1], rot[2])
    m.receiveShadow = true
    scene.add(m)
  }
  addPlane(48, 48, [0, 0, 0], [-Math.PI / 2, 0, 0], floorMat)
  addPlane(48, 48, [0, 24, 0], [Math.PI / 2, 0, 0], darkMat)
  addPlane(48, 24, [0, 12, -24], [0, 0, 0], wallMat)
  addPlane(48, 24, [-24, 12, 0], [0, Math.PI / 2, 0], wallMat)
  addPlane(48, 24, [24, 12, 0], [0, -Math.PI / 2, 0], wallMat)

  const addBox = (x: number, y: number, z: number, w: number, h: number, d: number, mat = wallMat) => {
    const m = new THREE.Mesh(tr.trackGeo(new RoundedBoxGeometry(w, h, d, 2, 0.12)), mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    scene.add(m)
  }

  // Color-coded Sector Neon Stripes
  const addStrip = (x: number, y: number, z: number, w: number, h: number, d: number, col: string) => {
    const m = new THREE.Mesh(tr.trackGeo(new THREE.BoxGeometry(w, h, d)), tr.trackMat(new THREE.MeshBasicMaterial({ color: col })))
    m.position.set(x, y, z)
    scene.add(m)
  }
  addStrip(0, 15.5, -23.8, 44, 0.4, 0.16, '#22D3EE')
  addStrip(-23.8, 15.5, 0, 0.16, 0.4, 44, '#A855F7')
  addStrip(23.8, 15.5, 0, 0.16, 0.4, 44, '#10B981')

  // Multi-level Balconies, Pillars & Central Pedestal
  addBox(0, 0.5, 0, 5.2, 1.0, 5.2, darkMat)
  addBox(-19.5, 6.2, 0, 8.5, 1.1, 24, wallMat)
  addBox(19.5, 6.2, 0, 8.5, 1.1, 24, wallMat)
  addBox(-10, 7, -10, 3.6, 14, 3.6, wallMat)
  addBox(10, 7, -10, 3.6, 14, 3.6, wallMat)
  addBox(-10, 7, 10, 3.6, 14, 3.6, wallMat)

  // Live See-Through Styled Cyan & Orange Portals!
  const addPortalPane = (x: number, y: number, z: number, rotY: number, hex: string, viewCol: string) => {
    const g = new THREE.Group()
    g.position.set(x, y, z)
    g.rotation.y = rotY
    const ring = new THREE.Mesh(
      tr.trackGeo(new THREE.TorusGeometry(2.5, 0.28, 12, 32)),
      tr.trackMat(new THREE.MeshBasicMaterial({ color: hex })),
    )
    ring.scale.set(0.84, 1.32, 1)
    const pane = new THREE.Mesh(
      tr.trackGeo(new THREE.CircleGeometry(2.38, 28)),
      tr.trackMat(new THREE.MeshBasicMaterial({ color: viewCol, side: THREE.DoubleSide })),
    )
    pane.scale.set(0.84, 1.32, 1)
    g.add(ring, pane)
    scene.add(g)
  }
  addPortalPane(-5.2, 6.8, -23.5, 0, '#22D3EE', '#F97316')
  addPortalPane(8.1, 6.4, -10, -Math.PI / 2, '#F97316', '#22D3EE')

  // Central Vertical Plasma Laser Beam + Energy Disc
  const vLaser = new THREE.Mesh(
    tr.trackGeo(new THREE.CylinderGeometry(0.32, 0.32, 24, 12)),
    tr.trackMat(new THREE.MeshBasicMaterial({ color: '#FF2A5F' })),
  )
  vLaser.position.set(0, 12, 0)
  scene.add(vLaser)

  const disc = new THREE.Mesh(
    tr.trackGeo(new THREE.TorusGeometry(1.15, 0.2, 8, 22)),
    tr.trackMat(new THREE.MeshBasicMaterial({ color: '#FACC15' })),
  )
  disc.rotation.x = Math.PI / 2.2
  disc.position.set(1.8, 7.2, 3.5)
  scene.add(disc)

  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/webp', 0.9)
  tr.disposeAll()
  return url
}

/**
 * 4. FRISBEE KING — Enclosed Winding Labyrinth Box with 45° Bank Walls, Ramps & Blazing Fiery Frisbee!
 */
function renderFrisbeeThumbnail(renderer: THREE.WebGLRenderer, width: number, height: number): string {
  const scene = new THREE.Scene()
  const tr = createTracker()
  scene.background = new THREE.Color('#0B1221')

  const hemi = new THREE.HemisphereLight('#FFF7ED', '#1E1B4B', 1.15)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight('#FFFFFF', 1.35)
  sun.position.set(14, 19, 12)
  sun.castShadow = true
  scene.add(sun)

  const fireGlow = new THREE.PointLight('#F97316', 4.5, 36)
  fireGlow.position.set(0, 6.2, 2)
  scene.add(fireGlow)
  const coolGlow = new THREE.PointLight('#22D3EE', 2.8, 36)
  coolGlow.position.set(-14, 10, -14)
  scene.add(coolGlow)

  const camera = new THREE.PerspectiveCamera(48, width / height, 0.4, 160)
  camera.position.set(19, 14.5, 22)
  camera.lookAt(-1, 4.2, -3)

  const floorMat = tr.getSurfaceMat('facetTile', '#1E293B', 8, 8, 0.36, 0.16)
  const outerMat = tr.getSurfaceMat('fluted', '#17253B', 6, 3, 0.35, 0.25)
  const innerMat = tr.getSurfaceMat('fluted', '#334155', 4, 2, 0.3, 0.38)
  const bankMat = tr.trackMat(
    new THREE.MeshStandardMaterial({ color: '#0F766E', emissive: '#14B8A6', emissiveIntensity: 0.32, roughness: 0.24, metalness: 0.45 }),
  )

  const addPlane = (w: number, h: number, pos: [number, number, number], rot: [number, number, number], mat: THREE.Material) => {
    const m = new THREE.Mesh(tr.trackGeo(new THREE.PlaneGeometry(w, h)), mat)
    m.position.set(pos[0], pos[1], pos[2])
    m.rotation.set(rot[0], rot[1], rot[2])
    m.receiveShadow = true
    scene.add(m)
  }
  addPlane(52, 52, [0, 0, 0], [-Math.PI / 2, 0, 0], floorMat)
  addPlane(52, 20, [0, 10, -26], [0, 0, 0], outerMat)
  addPlane(52, 20, [-26, 10, 0], [0, Math.PI / 2, 0], outerMat)

  const addBox = (x: number, y: number, z: number, w: number, h: number, d: number, accent?: string) => {
    const m = new THREE.Mesh(tr.trackGeo(new RoundedBoxGeometry(w, h, d, 2, 0.14)), innerMat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    scene.add(m)
    if (accent) {
      const t = new THREE.Mesh(
        tr.trackGeo(new THREE.BoxGeometry(w + 0.08, 0.2, d + 0.08)),
        tr.trackMat(new THREE.MeshBasicMaterial({ color: accent })),
      )
      t.position.set(x, y + h / 2 - 0.12, z)
      scene.add(t)
    }
  }

  // 45° Corner Bank-Shot Wall
  const cornerWall = new THREE.Mesh(tr.trackGeo(new RoundedBoxGeometry(13, 18, 1.1, 2, 0.14)), bankMat)
  cornerWall.position.set(-20.5, 9, -20.5)
  cornerWall.rotation.y = Math.PI / 4
  scene.add(cornerWall)

  // Winding Labyrinth Walls + Central Skybridge Deck + Ramps
  addBox(-11.5, 3.6, -12, 1.4, 7.2, 11, '#F97316')
  addBox(12, 3.6, -11.5, 11, 7.2, 1.4, '#FACC15')
  addBox(-12, 3.6, 11.5, 11, 7.2, 1.4, '#F43F5E')
  addBox(0, 5.5, 0, 11.2, 0.9, 11.2, '#FACC15')
  addBox(-4.5, 2.8, -4.5, 2.2, 5.6, 2.2, '#38BDF8')
  addBox(4.5, 2.8, -4.5, 2.2, 5.6, 2.2, '#F97316')
  addBox(-4.5, 2.8, 4.5, 2.2, 5.6, 2.2, '#F97316')

  // Sloped Ramp leading to center skybridge
  const ramp = new THREE.Mesh(tr.trackGeo(new THREE.BoxGeometry(5.2, 0.5, 11.5)), innerMat)
  ramp.position.set(0, 2.8, 10.6)
  ramp.rotation.x = 0.52
  scene.add(ramp)

  // HERO BLAZING FIERY FRISBEE slicing across the frame with orange-gold trail!
  const discGroup = new THREE.Group()
  discGroup.position.set(2.5, 7.8, 5.5)
  discGroup.rotation.z = 0.25
  const discBody = new THREE.Mesh(
    tr.trackGeo(new THREE.CylinderGeometry(1.75, 1.9, 0.32, 32)),
    tr.trackMat(new THREE.MeshStandardMaterial({ color: '#EF4444', emissive: '#F97316', emissiveIntensity: 2.2 })),
  )
  const discRim = new THREE.Mesh(
    tr.trackGeo(new THREE.TorusGeometry(1.85, 0.22, 10, 32)),
    tr.trackMat(new THREE.MeshBasicMaterial({ color: '#FEF08A' })),
  )
  discRim.rotation.x = Math.PI / 2
  const flameRing = new THREE.Mesh(
    tr.trackGeo(new THREE.RingGeometry(1.85, 3.4, 32)),
    tr.trackMat(new THREE.MeshBasicMaterial({ color: '#F97316', transparent: true, opacity: 0.72, side: THREE.DoubleSide })),
  )
  flameRing.rotation.x = Math.PI / 2
  discGroup.add(discBody, discRim, flameRing)
  scene.add(discGroup)

  // Glowing Ricochet Trail Line
  const trailPts = [
    new THREE.Vector3(-19, 8.2, -19),
    new THREE.Vector3(-10, 7.6, -2),
    new THREE.Vector3(2.5, 7.8, 5.5),
  ]
  const trail = new THREE.Line(
    tr.trackGeo(new THREE.BufferGeometry().setFromPoints(trailPts)),
    tr.trackMat(new THREE.LineBasicMaterial({ color: '#FACC15' })),
  )
  scene.add(trail)

  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/webp', 0.9)
  tr.disposeAll()
  return url
}

export function generateWorldThumbnails(): Promise<WorldThumbnailMap> {
  if (cachedThumbnails) return Promise.resolve(cachedThumbnails)
  if (pendingPromise) return pendingPromise

  pendingPromise = new Promise((resolve) => {
    const run = () => {
      try {
        const width = 960
        const height = 540
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance',
        })
        renderer.setSize(width, height, false)
        renderer.setPixelRatio(1)
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.06
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap

        const result: WorldThumbnailMap = {
          lobby: renderLobbyThumbnail(renderer, width, height),
          obby: renderObbyThumbnail(renderer, width, height),
          arena: renderArenaThumbnail(renderer, width, height),
          frisbee: renderFrisbeeThumbnail(renderer, width, height),
        }

        renderer.dispose()
        try {
          renderer.forceContextLoss()
        } catch {
          // ignore on browsers that do not expose WEBGL_lose_context
        }

        cachedThumbnails = result
        resolve(result)
      } catch {
        cachedThumbnails = {}
        resolve({})
      }
    }

    // Yield one frame so initial React mount is completely instantaneous
    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      window.requestAnimationFrame(run)
    } else {
      run()
    }
  })

  return pendingPromise
}

export function regenerateWorldThumbnails(): Promise<WorldThumbnailMap> {
  cachedThumbnails = null
  pendingPromise = null
  return generateWorldThumbnails()
}

export function useWorldThumbnails(): WorldThumbnailMap {
  const [thumbs, setThumbs] = useState<WorldThumbnailMap>(() => cachedThumbnails ?? {})

  useEffect(() => {
    if (cachedThumbnails) {
      setThumbs(cachedThumbnails)
      return
    }
    let alive = true
    generateWorldThumbnails().then((res) => {
      if (alive) setThumbs(res)
    })
    return () => {
      alive = false
    }
  }, [])

  return thumbs
}
