export type ObbyBlockKind =
  | 'checkpoint'
  | 'solid'
  | 'hazard'
  | 'moving'
  | 'fade'
  | 'jumppad'
  | 'spinner'

export interface ObbyZoneMeta {
  index: number // 0..9
  startStage: number
  endStage: number
  namePl: string
  nameEn: string
  primary: string
  secondary: string
  accent: string
}

export interface ObbyBlockDef {
  id: string
  stage: number // 1..100 (stage it belongs to — obstacles between checkpoint stage and stage+1)
  zone: number // 0..9
  kind: ObbyBlockKind
  // Base center position
  x: number
  y: number
  z: number
  // Full dimensions
  w: number
  h: number
  d: number
  color: string
  // Optional moving platform params
  moveAxis?: 'x' | 'y' | 'z'
  moveAmp?: number
  moveSpeed?: number
  movePhase?: number
  // Optional jumppad power
  jumpVel?: number
  // Optional spinner params (horizontal rotating hazard bar centered at x,y,z)
  spinnerRadius?: number
  spinnerSpeed?: number
  spinnerPhase?: number
  // Optional checkpoint stage number (1..100)
  checkpointStage?: number
}

export interface ObbyCheckpointDef {
  stage: number // 1..100
  zone: number // 0..9
  x: number
  y: number // top surface y
  z: number
  spawnY: number
  facingAngle: number // radians (0 = facing -Z)
}

export interface ObbyCourseData {
  zones: ObbyZoneMeta[]
  blocks: ObbyBlockDef[]
  checkpoints: ObbyCheckpointDef[]
}

export const OBBY_ZONES: ObbyZoneMeta[] = [
  {
    index: 0,
    startStage: 1,
    endStage: 10,
    namePl: 'Błękitny Start',
    nameEn: 'Arctic Warmup',
    primary: '#38BDF8',
    secondary: '#F1F9FF',
    accent: '#0284C7',
  },
  {
    index: 1,
    startStage: 11,
    endStage: 20,
    namePl: 'Słoneczne Klocki',
    nameEn: 'Sunny Studs',
    primary: '#FACC15',
    secondary: '#FEF9C3',
    accent: '#0EA5E9',
  },
  {
    index: 2,
    startStage: 21,
    endStage: 30,
    namePl: 'Znikające Kafelki',
    nameEn: 'Fading Tiles',
    primary: '#2DD4BF',
    secondary: '#CCFBF1',
    accent: '#0F766E',
  },
  {
    index: 3,
    startStage: 31,
    endStage: 40,
    namePl: 'Czerwone Belki',
    nameEn: 'Crimson Hurdles',
    primary: '#E2E8F0',
    secondary: '#94A3B8',
    accent: '#EF4444',
  },
  {
    index: 4,
    startStage: 41,
    endStage: 50,
    namePl: 'Ruchome Kładki',
    nameEn: 'Sky Shuttles',
    primary: '#60A5FA',
    secondary: '#DBEAFE',
    accent: '#1D4ED8',
  },
  {
    index: 5,
    startStage: 51,
    endStage: 60,
    namePl: 'Błękitne Skocznie',
    nameEn: 'Sky Jump-Pads',
    primary: '#38BDF8',
    secondary: '#E0F2FE',
    accent: '#F59E0B',
  },
  {
    index: 6,
    startStage: 61,
    endStage: 70,
    namePl: 'Kładki Równowagi',
    nameEn: 'Tightrope Walk',
    primary: '#34D399',
    secondary: '#D1FAE5',
    accent: '#059669',
  },
  {
    index: 7,
    startStage: 71,
    endStage: 80,
    namePl: 'Obrotowe Śmigła',
    nameEn: 'Spinner Bridges',
    primary: '#F59E0B',
    secondary: '#FEF3C7',
    accent: '#1E3A8A',
  },
  {
    index: 8,
    startStage: 81,
    endStage: 90,
    namePl: 'Lodowa Wspinaczka',
    nameEn: 'Glacier Ascent',
    primary: '#7DD3FC',
    secondary: '#F0F9FF',
    accent: '#0369A1',
  },
  {
    index: 9,
    startStage: 91,
    endStage: 100,
    namePl: 'Wielki Finał 100',
    nameEn: 'Grand Summit 100',
    primary: '#2563EB',
    secondary: '#F8FAFC',
    accent: '#FBBF24',
  },
]

// Simple deterministic PRNG so every player gets the exact same 100-stage course!
function seeded(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export function generateTestObbyCourse(): ObbyCourseData {
  const rand = seeded(20260100)
  const blocks: ObbyBlockDef[] = []
  const checkpoints: ObbyCheckpointDef[] = []

  let curX = 0
  let curY = 0 // top surface height of current checkpoint
  let curZ = 0
  let bid = 0

  const nextId = (prefix: string) => `${prefix}_${++bid}`

  const addBlock = (b: Omit<ObbyBlockDef, 'id'>) => {
    blocks.push({ ...b, id: nextId(b.kind) })
  }

  for (let stage = 1; stage <= 100; stage++) {
    const zoneIdx = Math.min(9, Math.floor((stage - 1) / 10))
    const zone = OBBY_ZONES[zoneIdx]
    const sub = (stage - 1) % 10 // 0..9 within zone

    const isStart = stage === 1
    const isFinish = stage === 100
    const cpW = isFinish ? 18 : isStart ? 10 : 7.4
    const cpD = isFinish ? 18 : isStart ? 10 : 7.4
    const cpH = 1.1

    // Add checkpoint platform for `stage`
    addBlock({
      stage,
      zone: zoneIdx,
      kind: 'checkpoint',
      x: curX,
      y: curY - cpH / 2,
      z: curZ,
      w: cpW,
      h: cpH,
      d: cpD,
      color: isFinish ? '#FBBF24' : '#F8FAFC',
      checkpointStage: stage,
    })

    checkpoints.push({
      stage,
      zone: zoneIdx,
      x: curX,
      y: curY,
      z: curZ,
      spawnY: curY + 0.15,
      facingAngle: 0,
    })

    if (isFinish) {
      // Celebratory 3-tier winner podium on Stage 100 island!
      addBlock({
        stage: 100,
        zone: 9,
        kind: 'solid',
        x: curX,
        y: curY + 0.6,
        z: curZ - 3.6,
        w: 3.4,
        h: 1.2,
        d: 3.2,
        color: '#FBBF24',
      })
      addBlock({
        stage: 100,
        zone: 9,
        kind: 'solid',
        x: curX - 3.4,
        y: curY + 0.4,
        z: curZ - 3.6,
        w: 3.2,
        h: 0.8,
        d: 3.0,
        color: '#CBD5E1',
      })
      addBlock({
        stage: 100,
        zone: 9,
        kind: 'solid',
        x: curX + 3.4,
        y: curY + 0.25,
        z: curZ - 3.6,
        w: 3.2,
        h: 0.5,
        d: 3.0,
        color: '#D97706',
      })
      break
    }

    // Build obstacle sequence between `stage` and `stage + 1`
    // Start edge of current checkpoint is at z = curZ - cpD / 2
    let edgeZ = curZ - cpD / 2
    let x = curX
    let y = curY

    // Gentle drift back toward center so course stays compact & scenic
    const driftTowardCenter = (stepX: number) => {
      const next = x + stepX
      if (next > 12) return x - Math.abs(stepX)
      if (next < -12) return x + Math.abs(stepX)
      return next
    }

    // Helper: place a solid block after a guaranteed jumpable gap (edge-to-edge)
    const placeSolid = (gap: number, w: number, d: number, dy: number, dx: number, color: string) => {
      x = driftTowardCenter(dx)
      y += dy
      const centerZ = edgeZ - gap - d / 2
      addBlock({
        stage,
        zone: zoneIdx,
        kind: 'solid',
        x,
        y: y - 0.45,
        z: centerZ,
        w,
        h: 0.9,
        d,
        color,
      })
      edgeZ = centerZ - d / 2
      return { x, y, centerZ }
    }

    // Select obstacle pattern per zone (and mix in zones 8-9!)
    const patternZone =
      zoneIdx < 8
        ? zoneIdx
        : zoneIdx === 8
          ? [2, 3, 4, 5, 6, 7, 3, 4, 5, 7][sub]
          : [4, 3, 5, 7, 2, 6, 4, 7, 5, 3][sub]

    if (patternZone === 0) {
      // Zone 1 (1..10): Arctic Warmup — friendly wide blocks & gentle stairs
      const count = 3 + (sub % 3)
      for (let i = 0; i < count; i++) {
        const gap = 2.0 + (sub * 0.14) + (i % 2) * 0.3
        const w = Math.max(3.0, 4.4 - sub * 0.1)
        const d = 3.2
        const dy = sub >= 4 ? 0.35 : 0.15
        const dx = sub >= 3 ? (i % 2 === 0 ? 1.4 : -1.4) : 0
        placeSolid(gap, w, d, dy, dx, i % 2 === 0 ? zone.primary : zone.secondary)
      }
    } else if (patternZone === 1) {
      // Zone 2 (11..20): Sunny Studs — zig-zags, stair hops & twin islands
      const count = 4 + (sub % 2)
      for (let i = 0; i < count; i++) {
        const gap = 2.4 + (sub * 0.1)
        const w = 2.9
        const d = 2.9
        const dx = (i % 2 === 0 ? 1 : -1) * (2.2 + (sub % 3) * 0.5)
        const dy = i % 2 === 0 ? 0.45 : 0.15
        placeSolid(gap, w, d, dy, dx, i % 2 === 0 ? zone.primary : zone.accent)
      }
    } else if (patternZone === 2) {
      // Zone 3 (21..30): Fading Tiles — rows of fading tiles (run fast or pick safe side!)
      const rows = 4 + (sub % 3)
      for (let i = 0; i < rows; i++) {
        const gap = 1.9 + (sub % 3) * 0.25
        const tileW = 2.8
        const tileD = 2.8
        const centerZ = edgeZ - gap - tileD / 2
        y += 0.18
        const safeCol = Math.floor(rand() * 2) // 0 = left, 1 = right
        const offsets = [-2.1, 2.1]
        for (let col = 0; col < 2; col++) {
          const isSafe = sub < 5 ? col === safeCol : false // stages 26-30 both fade so keep running!
          addBlock({
            stage,
            zone: zoneIdx,
            kind: isSafe ? 'solid' : 'fade',
            x: x + offsets[col],
            y: y - 0.35,
            z: centerZ,
            w: tileW,
            h: 0.7,
            d: tileD,
            color: isSafe ? zone.primary : zone.secondary,
          })
        }
        edgeZ = centerZ - tileD / 2
      }
    } else if (patternZone === 3) {
      // Zone 4 (31..40): Crimson Hurdles — bridges with bright red hazard bars to hop over
      const bridgeLen = 15 + (sub % 4) * 3.5
      const bridgeW = Math.max(3.8, 5.0 - sub * 0.08)
      const gap = 2.2
      y += 0.3
      const centerZ = edgeZ - gap - bridgeLen / 2
      addBlock({
        stage,
        zone: zoneIdx,
        kind: 'solid',
        x,
        y: y - 0.45,
        z: centerZ,
        w: bridgeW,
        h: 0.9,
        d: bridgeLen,
        color: zone.primary,
      })
      const hurdles = 3 + (sub % 3)
      const step = bridgeLen / (hurdles + 1)
      for (let h = 1; h <= hurdles; h++) {
        const hz = centerZ + bridgeLen / 2 - step * h
        const doubleBar = sub >= 6 && h % 2 === 0
        addBlock({
          stage,
          zone: zoneIdx,
          kind: 'hazard',
          x,
          y: y + 0.32,
          z: hz,
          w: bridgeW + 0.1,
          h: 0.64,
          d: doubleBar ? 1.15 : 0.78,
          color: '#EF4444',
        })
      }
      edgeZ = centerZ - bridgeLen / 2
    } else if (patternZone === 4) {
      // Zone 5 (41..50): Sky Shuttles — horizontal & vertical moving platforms
      const count = 2 + (sub % 3)
      for (let i = 0; i < count; i++) {
        const isVert = sub >= 5 && i === count - 1
        const gap = 2.3
        const w = 3.8
        const d = 3.8
        const centerZ = edgeZ - gap - d / 2
        if (isVert) {
          y += 1.2
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'moving',
            x,
            y: y - 0.45,
            z: centerZ,
            w,
            h: 0.9,
            d,
            color: zone.primary,
            moveAxis: 'y',
            moveAmp: 1.35,
            moveSpeed: 1.55,
            movePhase: i * 1.4 + sub * 0.5,
          })
          y += 1.0
        } else {
          const isZ = i % 2 === 1 && sub >= 3
          if (isZ) {
            const travelGap = 2.8
            const mCenterZ = edgeZ - travelGap - d / 2 - 2.0
            y += 0.25
            addBlock({
              stage,
              zone: zoneIdx,
              kind: 'moving',
              x,
              y: y - 0.45,
              z: mCenterZ,
              w,
              h: 0.9,
              d,
              color: zone.accent,
              moveAxis: 'z',
              moveAmp: 2.3,
              moveSpeed: 1.45 + (sub % 3) * 0.18,
              movePhase: i * 1.2 + sub * 0.7,
            })
            edgeZ = mCenterZ - d / 2 - 2.0
            continue
          } else {
            y += 0.25
            addBlock({
              stage,
              zone: zoneIdx,
              kind: 'moving',
              x,
              y: y - 0.45,
              z: centerZ,
              w,
              h: 0.9,
              d,
              color: zone.primary,
              moveAxis: 'x',
              moveAmp: 2.8 + (sub % 3) * 0.6,
              moveSpeed: 1.4 + (sub % 4) * 0.16,
              movePhase: i * 1.7 + sub * 0.4,
            })
          }
        }
        edgeZ = centerZ - d / 2
      }
    } else if (patternZone === 5) {
      // Zone 6 (51..60): Sky Jump-Pads — springy launches to high sky islands!
      const hops = 2 + (sub % 2)
      for (let i = 0; i < hops; i++) {
        // Launch island with jump-pad on top
        const padW = 4.6
        const padD = 4.6
        const launchGap = 2.1
        const launchZ = edgeZ - launchGap - padD / 2
        addBlock({
          stage,
          zone: zoneIdx,
          kind: 'solid',
          x,
          y: y - 0.45,
          z: launchZ,
          w: padW,
          h: 0.9,
          d: padD,
          color: zone.secondary,
        })
        addBlock({
          stage,
          zone: zoneIdx,
          kind: 'jumppad',
          x,
          y: y + 0.16,
          z: launchZ - 0.4,
          w: 2.6,
          h: 0.32,
          d: 2.6,
          color: '#0EA5E9',
          jumpVel: 21.8,
        })
        // Landing island higher & further ahead (always comfortably reachable at vy=21.8)
        y += 2.6
        x = driftTowardCenter((i % 2 === 0 ? 1 : -1) * (sub >= 4 ? 2.4 : 0))
        const landD = 5.0
        const landZ = launchZ - padD / 2 - 6.8 - landD / 2
        addBlock({
          stage,
          zone: zoneIdx,
          kind: 'solid',
          x,
          y: y - 0.45,
          z: landZ,
          w: 5.2,
          h: 0.9,
          d: landD,
          color: zone.primary,
        })
        edgeZ = landZ - landD / 2
      }
    } else if (patternZone === 6) {
      // Zone 7 (61..70): Tightrope Walk — sleek narrow beams & small stepping pillars
      const segs = 3 + (sub % 2)
      for (let i = 0; i < segs; i++) {
        const isBeam = i % 2 === 0
        if (isBeam) {
          const beamW = Math.max(1.25, 1.65 - sub * 0.03)
          const beamD = 7.4
          placeSolid(1.8, beamW, beamD, 0.2, (i % 2 === 0 ? 1 : -1) * 1.1, zone.primary)
        } else {
          placeSolid(2.4, 2.2, 2.2, 0.35, (i % 2 === 0 ? -1 : 1) * 1.6, zone.secondary)
        }
      }
    } else {
      // Zone 8 (71..80): Spinner Bridges — platforms with rotating crimson sweeper bars!
      const arenas = 1 + (sub >= 4 ? 1 : 0)
      for (let i = 0; i < arenas; i++) {
        const size = 8.4
        const gap = 2.4
        y += 0.3
        const centerZ = edgeZ - gap - size / 2
        addBlock({
          stage,
          zone: zoneIdx,
          kind: 'solid',
          x,
          y: y - 0.45,
          z: centerZ,
          w: size,
          h: 0.9,
          d: size,
          color: zone.secondary,
        })
        addBlock({
          stage,
          zone: zoneIdx,
          kind: 'spinner',
          x,
          y: y + 0.48,
          z: centerZ,
          w: size - 0.6, // bar length
          h: 0.56,
          d: 0.68, // bar thickness
          color: '#EF4444',
          spinnerRadius: (size - 0.6) / 2,
          spinnerSpeed: (i % 2 === 0 ? 1 : -1) * (1.25 + (sub % 4) * 0.22),
          spinnerPhase: sub * 0.8 + i * 1.5,
        })
        edgeZ = centerZ - size / 2
      }
    }

    // Advance cursor for next checkpoint (`stage + 1`) with a clean, comfortable landing gap
    const nextCpD = stage + 1 === 100 ? 18 : 7.4
    const finalGap = 2.3
    curX = x
    curY = y + 0.25
    curZ = edgeZ - finalGap - nextCpD / 2
  }

  return {
    zones: OBBY_ZONES,
    blocks,
    checkpoints,
  }
}
