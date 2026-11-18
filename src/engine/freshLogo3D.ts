import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { cloneFreshTexturesWithRepeat } from './freshTextures'

export interface FreshLogoMonumentHandle {
  group: THREE.Group
  logoPivot: THREE.Group
  accentRing: THREE.Mesh
  update: (elapsed: number) => void
  dispose: () => void
}

/**
 * Builds the official FreshBlox F-03 beveled 3D architectural logo as a monumental centerpiece statue
 * (sculpted 3-layer extruded "F" on a tiered marble & titanium plinth — ZERO water, ZERO fountain noise!).
 * Exact silhouette proportions match FreshBloxBrand.tsx (`M34 21 H85 L81 38 H52 V51 H77 L73 66 H52 V95 H34 Z`).
 */
export function createFreshLogoShape(scale = 0.048): THREE.Shape {
  // Original SVG coords in [34..85] x [21..95] -> centered around (59.5, 58) with Y flipped upward
  const cx = 59.5
  const cy = 58
  const p = (x: number, y: number): [number, number] => [(x - cx) * scale, (cy - y) * scale]

  const pts: Array<[number, number]> = [
    p(34, 21),
    p(85, 21),
    p(81, 38),
    p(52, 38),
    p(52, 51),
    p(77, 51),
    p(73, 66),
    p(52, 66),
    p(52, 95),
    p(34, 95),
  ]

  const shape = new THREE.Shape()
  shape.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) {
    shape.lineTo(pts[i][0], pts[i][1])
  }
  shape.closePath()
  return shape
}

export function createFreshBloxMonument(opts?: {
  castShadow?: boolean
  includePlinth?: boolean
  logoScale?: number
}): FreshLogoMonumentHandle {
  const castShadow = opts?.castShadow ?? true
  const includePlinth = opts?.includePlinth ?? true
  const logoScale = opts?.logoScale ?? 0.056

  const geos: THREE.BufferGeometry[] = []
  const mats: THREE.Material[] = []
  const texs: THREE.Texture[] = []
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

  const group = new THREE.Group()

  if (includePlinth) {
    const marbleTex = cloneFreshTexturesWithRepeat('marble', 3, 3, trackTex)
    const flutedTex = cloneFreshTexturesWithRepeat('fluted', 2, 2, trackTex)

    const marbleMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#F8FAFC',
        map: marbleTex.map,
        bumpMap: marbleTex.bumpMap,
        bumpScale: marbleTex.bumpScale,
        roughness: 0.24,
        metalness: 0.08,
      }),
    )
    const darkStoneMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#0F172A',
        map: flutedTex.map,
        bumpMap: flutedTex.bumpMap,
        bumpScale: flutedTex.bumpScale,
        roughness: 0.34,
        metalness: 0.32,
      }),
    )
    const chromeTrimMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#7DD3FC',
        emissive: '#0284C7',
        emissiveIntensity: 0.35,
        roughness: 0.16,
        metalness: 0.78,
      }),
    )

    // Tier 1: Wide octagonal architectural base step
    const step1 = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(4.1, 4.45, 0.42, 8)), marbleMat)
    step1.position.y = 0.21
    step1.rotation.y = Math.PI / 8
    step1.receiveShadow = true
    step1.castShadow = castShadow
    group.add(step1)

    // Tier 2: Sleek dark slate octagonal plinth
    const step2 = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(2.95, 3.25, 0.56, 8)), darkStoneMat)
    step2.position.y = 0.7
    step2.rotation.y = Math.PI / 8
    step2.receiveShadow = true
    step2.castShadow = castShadow
    group.add(step2)

    // Tier 3: Sculpted white marble pedestal column
    const pedestal = new THREE.Mesh(trackGeo(new RoundedBoxGeometry(2.4, 1.05, 2.4, 3, 0.16)), marbleMat)
    pedestal.position.y = 1.48
    pedestal.receiveShadow = true
    pedestal.castShadow = castShadow
    group.add(pedestal)

    // Satin sky-blue titanium collar framing the top of the plinth
    const collar = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.85, 0.085, 12, 40)), chromeTrimMat)
    collar.rotation.x = Math.PI / 2
    collar.position.y = 2.04
    group.add(collar)

    // 4 Corner subtle architectural fins around the plinth
    const finGeo = trackGeo(new RoundedBoxGeometry(0.32, 0.78, 0.9, 2, 0.06))
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4
      const fin = new THREE.Mesh(finGeo, chromeTrimMat)
      fin.position.set(Math.cos(a) * 1.9, 1.35, Math.sin(a) * 1.9)
      fin.rotation.y = -a + Math.PI / 2
      fin.castShadow = castShadow
      group.add(fin)
    }
  }

  // === SCULPTED 3D FRESHBLOX "F" MONUMENTAL STATUE (3 layered bevel extrusions) ===
  const logoPivot = new THREE.Group()
  logoPivot.position.y = includePlinth ? 4.45 : 2.3
  group.add(logoPivot)

  const fShape = createFreshLogoShape(logoScale)

  // Layer 1 (Deep Core / Back Extrude — Deep Arctic Sapphire)
  const coreGeo = trackGeo(
    new THREE.ExtrudeGeometry(fShape, {
      depth: 0.78,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.1,
      bevelSegments: 3,
    }),
  )
  coreGeo.center()
  const coreMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#0369A1',
      emissive: '#0284C7',
      emissiveIntensity: 0.18,
      roughness: 0.22,
      metalness: 0.62,
    }),
  )
  const coreMesh = new THREE.Mesh(coreGeo, coreMat)
  coreMesh.castShadow = castShadow
  coreMesh.receiveShadow = true
  logoPivot.add(coreMesh)

  // Layer 2 (Front & Back Illuminated Sky Facet Plates — Crisp Arctic Sky)
  const faceGeo = trackGeo(
    new THREE.ExtrudeGeometry(fShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.055,
      bevelSegments: 2,
    }),
  )
  faceGeo.center()
  const faceMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#38BDF8',
      emissive: '#0EA5E9',
      emissiveIntensity: 0.26,
      roughness: 0.14,
      metalness: 0.35,
    }),
  )
  const frontFace = new THREE.Mesh(faceGeo, faceMat)
  frontFace.position.z = 0.42
  frontFace.castShadow = castShadow
  logoPivot.add(frontFace)

  const backFace = new THREE.Mesh(faceGeo, faceMat)
  backFace.position.z = -0.42
  backFace.castShadow = castShadow
  logoPivot.add(backFace)

  // Layer 3 (Front & Back Ice-White Highlight Trim — Signature F-03 Crisp Rim)
  const rimGeo = trackGeo(
    new THREE.ExtrudeGeometry(fShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.02,
      bevelSegments: 1,
    }),
  )
  rimGeo.center()
  const rimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#F0F9FF',
      emissive: '#BAE6FD',
      emissiveIntensity: 0.32,
      roughness: 0.12,
      metalness: 0.22,
    }),
  )
  const frontRim = new THREE.Mesh(rimGeo, rimMat)
  frontRim.scale.set(0.86, 0.88, 1)
  frontRim.position.z = 0.54
  logoPivot.add(frontRim)

  const backRim = new THREE.Mesh(rimGeo, rimMat)
  backRim.scale.set(0.86, 0.88, 1)
  backRim.position.z = -0.54
  logoPivot.add(backRim)

  // Subtle architectural gyroscopic halo frame encircling the 3D logo statue
  const accentRing = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(2.55, 0.065, 12, 48)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: '#E0F2FE',
        emissive: '#38BDF8',
        emissiveIntensity: 0.4,
        roughness: 0.15,
        metalness: 0.82,
      }),
    ),
  )
  accentRing.position.y = includePlinth ? 4.45 : 2.3
  accentRing.rotation.x = Math.PI * 0.16
  group.add(accentRing)

  const baseY = includePlinth ? 4.45 : 2.3
  const update = (elapsed: number) => {
    logoPivot.rotation.y = elapsed * 0.45
    logoPivot.position.y = baseY + Math.sin(elapsed * 1.45) * 0.18
    accentRing.rotation.y = -elapsed * 0.32
    accentRing.rotation.z = Math.sin(elapsed * 0.8) * 0.14
  }

  const dispose = () => {
    for (const g of geos) g.dispose()
    for (const m of mats) m.dispose()
    for (const t of texs) t.dispose()
  }

  return { group, logoPivot, accentRing, update, dispose }
}
