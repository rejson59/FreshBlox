export type ObbyBlockKind =
  | 'checkpoint'
  | 'solid'
  | 'pillar'
  | 'hazard'
  | 'moving'
  | 'fade'
  | 'fake'
  | 'jumppad'
  | 'bounce'
  | 'spinner'
  | 'conveyor'
  | 'ice'
  | 'pusher'
  | 'decor'

export interface ObbyZoneMeta {
  index: number // 0..9
  startStage: number
  endStage: number
  namePl: string
  nameEn: string
  primary: string
  secondary: string
  accent: string
  trim: string
}

export interface ObbyBlockDef {
  id: string
  stage: number // 1..100
  zone: number // 0..9
  kind: ObbyBlockKind
  // Base center position
  x: number
  y: number
  z: number
  // Full dimensions (for cylinder `pillar`/`bounce`: w = diameter, h = height, d = diameter)
  w: number
  h: number
  d: number
  color: string
  // Optional moving / pusher params
  moveAxis?: 'x' | 'y' | 'z' | 'xy'
  moveAmp?: number
  moveAmpY?: number
  moveSpeed?: number
  movePhase?: number
  // Optional jumppad / bounce vertical velocity
  jumpVel?: number
  // Optional spinner params (horizontal rotating hazard bar; spinnerCross = X-shaped double blade)
  spinnerRadius?: number
  spinnerSpeed?: number
  spinnerPhase?: number
  spinnerCross?: boolean
  // Optional conveyor belt velocity push (m/s)
  conveyorVx?: number
  conveyorVz?: number
  // Optional checkpoint stage number (1..100)
  checkpointStage?: number
}

export interface ObbyCheckpointDef {
  stage: number // 1..100
  zone: number // 0..9
  titlePl: string
  titleEn: string
  x: number
  y: number // top surface y
  z: number
  spawnY: number
  facingAngle: number
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
    trim: '#BAE6FD',
  },
  {
    index: 1,
    startStage: 11,
    endStage: 20,
    namePl: 'Słoneczne Tarasy',
    nameEn: 'Sunny Terraces',
    primary: '#FACC15',
    secondary: '#FEFCE8',
    accent: '#0EA5E9',
    trim: '#F59E0B',
  },
  {
    index: 2,
    startStage: 21,
    endStage: 30,
    namePl: 'Miętowa Laguna',
    nameEn: 'Mint Lagoon',
    primary: '#2DD4BF',
    secondary: '#F0FDFA',
    accent: '#0F766E',
    trim: '#99F6E4',
  },
  {
    index: 3,
    startStage: 31,
    endStage: 40,
    namePl: 'Koralowy Kanion',
    nameEn: 'Coral Canyon',
    primary: '#FB923C',
    secondary: '#FFF7ED',
    accent: '#EA580C',
    trim: '#FDBA74',
  },
  {
    index: 4,
    startStage: 41,
    endStage: 50,
    namePl: 'Podniebne Windy',
    nameEn: 'Sky Shuttles',
    primary: '#60A5FA',
    secondary: '#EFF6FF',
    accent: '#1D4ED8',
    trim: '#93C5FD',
  },
  {
    index: 5,
    startStage: 51,
    endStage: 60,
    namePl: 'Bursztynowe Skocznie',
    nameEn: 'Amber Springs',
    primary: '#F59E0B',
    secondary: '#FFFBEB',
    accent: '#0284C7',
    trim: '#FCD34D',
  },
  {
    index: 6,
    startStage: 61,
    endStage: 70,
    namePl: 'Szmaragdowe Ogrody',
    nameEn: 'Emerald Gardens',
    primary: '#34D399',
    secondary: '#ECFDF5',
    accent: '#059669',
    trim: '#A7F3D0',
  },
  {
    index: 7,
    startStage: 71,
    endStage: 80,
    namePl: 'Lodowy Szczyt',
    nameEn: 'Glacier Peak',
    primary: '#7DD3FC',
    secondary: '#F0F9FF',
    accent: '#0369A1',
    trim: '#E0F2FE',
  },
  {
    index: 8,
    startStage: 81,
    endStage: 90,
    namePl: 'Królewska Twierdza',
    nameEn: 'Royal Citadel',
    primary: '#6366F1',
    secondary: '#EEF2FF',
    accent: '#3730A3',
    trim: '#C7D2FE',
  },
  {
    index: 9,
    startStage: 91,
    endStage: 100,
    namePl: 'Wielki Finał 100',
    nameEn: 'Grand Summit 100',
    primary: '#2563EB',
    secondary: '#F8FAFC',
    accent: '#F59E0B',
    trim: '#FDE68A',
  },
]

// 20 distinct gameplay archetypes — scheduled so NO two consecutive stages share an archetype,
// and every stage 1..100 receives unique layout parameters, turns, elevations, colors & landmarks!
type StageArchetype =
  | 'stepping_blocks'
  | 'stair_ascent'
  | 'cylinder_pillars'
  | 'split_paths'
  | 'bounce_chain'
  | 'hurdle_bridge'
  | 'turbo_conveyor'
  | 'fade_corridor'
  | 'jumppad_towers'
  | 'checker_lava'
  | 'side_conveyor'
  | 'pusher_gauntlet'
  | 'glass_choice'
  | 'wall_slalom'
  | 'shuttle_cross'
  | 'spinner_arena'
  | 'ice_slalom'
  | 'tightrope_mix'
  | 'elevator_climb'
  | 'headwind_bridge'

interface StageRecipe {
  archetype: StageArchetype
  titlePl: string
  titleEn: string
  variant: number // unique geometry/style modifier per stage
}

// Hand-crafted 99-stage progression (+ Stage 100 Grand Podium) — every single stage has its own name & feel!
const STAGE_RECIPES: StageRecipe[] = [
  // ZONE 1 (1–10): Błękitny Start
  { archetype: 'stepping_blocks', titlePl: 'Pierwsze Klocki', titleEn: 'First Blocks', variant: 0 },
  { archetype: 'stair_ascent', titlePl: 'Błękitne Schodki', titleEn: 'Arctic Stairs', variant: 0 },
  { archetype: 'cylinder_pillars', titlePl: 'Okrągłe Kamienie', titleEn: 'Stepping Stones', variant: 0 },
  { archetype: 'split_paths', titlePl: 'Dwie Ścieżki', titleEn: 'Twin Paths', variant: 0 },
  { archetype: 'bounce_chain', titlePl: 'Pierwsze Sprężyny', titleEn: 'Spring Pads', variant: 0 },
  { archetype: 'hurdle_bridge', titlePl: 'Czerwone Płotki', titleEn: 'Crimson Hurdles', variant: 0 },
  { archetype: 'turbo_conveyor', titlePl: 'Taśma Turbo', titleEn: 'Turbo Belt', variant: 0 },
  { archetype: 'fade_corridor', titlePl: 'Znikające Płytki', titleEn: 'Fading Tiles', variant: 0 },
  { archetype: 'jumppad_towers', titlePl: 'Błękitna Skocznia', titleEn: 'Sky Launch', variant: 0 },
  { archetype: 'shuttle_cross', titlePl: 'Pierwsza Przeprawa', titleEn: 'First Shuttle', variant: 0 },

  // ZONE 2 (11–20): Słoneczne Tarasy
  { archetype: 'checker_lava', titlePl: 'Słoneczna Szachownica', titleEn: 'Sun Checkerboard', variant: 1 },
  { archetype: 'side_conveyor', titlePl: 'Boczny Prąd', titleEn: 'Crosswind Belts', variant: 1 },
  { archetype: 'cylinder_pillars', titlePl: 'Słoneczne Filary', titleEn: 'Sun Pillars', variant: 1 },
  { archetype: 'pusher_gauntlet', titlePl: 'Pierwsze Tłoki', titleEn: 'Wall Pushers', variant: 1 },
  { archetype: 'glass_choice', titlePl: 'Szklany Most', titleEn: 'Glass Choice', variant: 1 },
  { archetype: 'jumppad_towers', titlePl: 'Podwójny Wzlot', titleEn: 'Twin Launch', variant: 1 },
  { archetype: 'wall_slalom', titlePl: 'Slalom Ścianek', titleEn: 'Wall Slalom', variant: 1 },
  { archetype: 'shuttle_cross', titlePl: 'Słoneczne Wahadła', titleEn: 'Sun Shuttles', variant: 1 },
  { archetype: 'bounce_chain', titlePl: 'Sprężyste Krążki', titleEn: 'Bouncy Discs', variant: 1 },
  { archetype: 'spinner_arena', titlePl: 'Pierwsze Śmigło', titleEn: 'First Spinner', variant: 1 },

  // ZONE 3 (21–30): Miętowa Laguna
  { archetype: 'ice_slalom', titlePl: 'Miętowy Ślizg', titleEn: 'Lagoon Slide', variant: 2 },
  { archetype: 'fade_corridor', titlePl: 'Kruchą Kładką', titleEn: 'Fragile Walk', variant: 2 },
  { archetype: 'tightrope_mix', titlePl: 'Wąskie Pomosty', titleEn: 'Lagoon Beams', variant: 2 },
  { archetype: 'headwind_bridge', titlePl: 'Most Pod Prąd', titleEn: 'Upstream Belt', variant: 2 },
  { archetype: 'elevator_climb', titlePl: 'Winda Laguny', titleEn: 'Lagoon Lift', variant: 2 },
  { archetype: 'split_paths', titlePl: 'Rozwidlenie Wysp', titleEn: 'Island Fork', variant: 2 },
  { archetype: 'glass_choice', titlePl: 'Lagunowy Wybór', titleEn: 'Lagoon Glass', variant: 2 },
  { archetype: 'cylinder_pillars', titlePl: 'Kaskada Bębnów', titleEn: 'Drum Cascade', variant: 2 },
  { archetype: 'spinner_arena', titlePl: 'Wiatrak Laguny', titleEn: 'Lagoon Mill', variant: 2 },
  { archetype: 'turbo_conveyor', titlePl: 'Ekspres do Kanionu', titleEn: 'Canyon Express', variant: 2 },

  // ZONE 4 (31–40): Koralowy Kanion
  { archetype: 'hurdle_bridge', titlePl: 'Bramki Kanionu', titleEn: 'Canyon Hurdles', variant: 3 },
  { archetype: 'pusher_gauntlet', titlePl: 'Tłoki Kanionu', titleEn: 'Canyon Pistons', variant: 3 },
  { archetype: 'stair_ascent', titlePl: 'Koralowa Wspinaczka', titleEn: 'Coral Ascent', variant: 3 },
  { archetype: 'checker_lava', titlePl: 'Lawowy Korytarz', titleEn: 'Lava Grid', variant: 3 },
  { archetype: 'bounce_chain', titlePl: 'Trampoliny Kanionu', titleEn: 'Canyon Springs', variant: 3 },
  { archetype: 'wall_slalom', titlePl: 'Czerwony Labirynt', titleEn: 'Crimson Slalom', variant: 3 },
  { archetype: 'side_conveyor', titlePl: 'Ruchomy Piasek', titleEn: 'Shifting Belts', variant: 3 },
  { archetype: 'jumppad_towers', titlePl: 'Skok Nad Przepaścią', titleEn: 'Chasm Leap', variant: 3 },
  { archetype: 'fade_corridor', titlePl: 'Gorące Kafelki', titleEn: 'Hot Tiles', variant: 3 },
  { archetype: 'spinner_arena', titlePl: 'Podwójne Ostrza', titleEn: 'Twin Spinners', variant: 3 },

  // ZONE 5 (41–50): Podniebne Windy
  { archetype: 'shuttle_cross', titlePl: 'Stacja Chmur', titleEn: 'Cloud Station', variant: 4 },
  { archetype: 'elevator_climb', titlePl: 'Podniebna Winda', titleEn: 'Sky Elevator', variant: 4 },
  { archetype: 'tightrope_mix', titlePl: 'Stalowe Belki', titleEn: 'Sky Beams', variant: 4 },
  { archetype: 'turbo_conveyor', titlePl: 'Pas Startowy', titleEn: 'Sky Runway', variant: 4 },
  { archetype: 'ice_slalom', titlePl: 'Chmurne Lodowisko', titleEn: 'Cloud Rink', variant: 4 },
  { archetype: 'pusher_gauntlet', titlePl: 'Bramy Powietrzne', titleEn: 'Airlock Pushers', variant: 4 },
  { archetype: 'split_paths', titlePl: 'Mosty w Chmurach', titleEn: 'Cloud Bridges', variant: 4 },
  { archetype: 'headwind_bridge', titlePl: 'Przeciw Wiatrowi', titleEn: 'Headwind Sprint', variant: 4 },
  { archetype: 'cylinder_pillars', titlePl: 'Wieże Obłoków', titleEn: 'Cloud Columns', variant: 4 },
  { archetype: 'spinner_arena', titlePl: 'Turbina 50', titleEn: 'Turbine 50', variant: 4 },

  // ZONE 6 (51–60): Bursztynowe Skocznie
  { archetype: 'jumppad_towers', titlePl: 'Bursztynowy Start', titleEn: 'Amber Launch', variant: 5 },
  { archetype: 'bounce_chain', titlePl: 'Kaskada Odbić', titleEn: 'Bounce Cascade', variant: 5 },
  { archetype: 'stepping_blocks', titlePl: 'Zygzak Złota', titleEn: 'Golden Zigzag', variant: 5 },
  { archetype: 'glass_choice', titlePl: 'Bursztynowe Szyby', titleEn: 'Amber Glass', variant: 5 },
  { archetype: 'side_conveyor', titlePl: 'Taśmy Złotników', titleEn: 'Goldsmith Belts', variant: 5 },
  { archetype: 'hurdle_bridge', titlePl: 'Podwójne Płotki', titleEn: 'Double Hurdles', variant: 5 },
  { archetype: 'elevator_climb', titlePl: 'Złote Platformy', titleEn: 'Golden Lifts', variant: 5 },
  { archetype: 'checker_lava', titlePl: 'Siatka Ryzyka', titleEn: 'Risk Matrix', variant: 5 },
  { archetype: 'wall_slalom', titlePl: 'Bursztynowy Slalom', titleEn: 'Amber Slalom', variant: 5 },
  { archetype: 'jumppad_towers', titlePl: 'Lot Do Ogrodów', titleEn: 'Garden Flight', variant: 5 },

  // ZONE 7 (61–70): Szmaragdowe Ogrody
  { archetype: 'cylinder_pillars', titlePl: 'Kamienie Ogrodu', titleEn: 'Garden Stones', variant: 6 },
  { archetype: 'tightrope_mix', titlePl: 'Gałęzie Równowagi', titleEn: 'Balance Walk', variant: 6 },
  { archetype: 'fade_corridor', titlePl: 'Opadające Liście', titleEn: 'Falling Leaves', variant: 6 },
  { archetype: 'split_paths', titlePl: 'Alejki Parku', titleEn: 'Park Lanes', variant: 6 },
  { archetype: 'pusher_gauntlet', titlePl: 'Żywopłot Tłoków', titleEn: 'Hedge Pistons', variant: 6 },
  { archetype: 'turbo_conveyor', titlePl: 'Zielony Ekspres', titleEn: 'Emerald Sprint', variant: 6 },
  { archetype: 'spinner_arena', titlePl: 'Ogród Wiatraków', titleEn: 'Windmill Patio', variant: 6 },
  { archetype: 'stair_ascent', titlePl: 'Taras Szmaragdu', titleEn: 'Emerald Steps', variant: 6 },
  { archetype: 'bounce_chain', titlePl: 'Grzybki Skokowe', titleEn: 'Bouncy Caps', variant: 6 },
  { archetype: 'shuttle_cross', titlePl: 'Przeprawa na Szczyt', titleEn: 'Peak Crossing', variant: 6 },

  // ZONE 8 (71–80): Lodowy Szczyt
  { archetype: 'ice_slalom', titlePl: 'Lodowa Ścieżka', titleEn: 'Glacier Path', variant: 7 },
  { archetype: 'glass_choice', titlePl: 'Kruchy Lód', titleEn: 'Thin Ice', variant: 7 },
  { archetype: 'side_conveyor', titlePl: 'Lodowy Wicher', titleEn: 'Blizzard Drift', variant: 7 },
  { archetype: 'ice_slalom', titlePl: 'Slalom Sopelków', titleEn: 'Icicle Slalom', variant: 8 },
  { archetype: 'headwind_bridge', titlePl: 'Zamieć Pod Prąd', titleEn: 'Blizzard Push', variant: 7 },
  { archetype: 'jumppad_towers', titlePl: 'Lodowe Gejzery', titleEn: 'Ice Geysers', variant: 7 },
  { archetype: 'checker_lava', titlePl: 'Lód i Ogień', titleEn: 'Ice & Fire', variant: 7 },
  { archetype: 'fade_corridor', titlePl: 'Topniejące Kry', titleEn: 'Melting Floes', variant: 7 },
  { archetype: 'elevator_climb', titlePl: 'Wyciąg Lodowca', titleEn: 'Glacier Lift', variant: 7 },
  { archetype: 'spinner_arena', titlePl: 'Wir Mrozu', titleEn: 'Frost Vortex', variant: 7 },

  // ZONE 9 (81–90): Królewska Twierdza
  { archetype: 'hurdle_bridge', titlePl: 'Most Zwodzony', titleEn: 'Drawbridge', variant: 8 },
  { archetype: 'pusher_gauntlet', titlePl: 'Korytarz Straży', titleEn: 'Guard Corridor', variant: 8 },
  { archetype: 'wall_slalom', titlePl: 'Mury Cytadeli', titleEn: 'Citadel Walls', variant: 8 },
  { archetype: 'tightrope_mix', titlePl: 'Krawędź Bastionu', titleEn: 'Bastion Ledge', variant: 8 },
  { archetype: 'shuttle_cross', titlePl: 'Ruchome Kładki', titleEn: 'Citadel Shuttles', variant: 8 },
  { archetype: 'glass_choice', titlePl: 'Komnata Próby', titleEn: 'Trial Chamber', variant: 8 },
  { archetype: 'bounce_chain', titlePl: 'Wieża Skoków', titleEn: 'Vault Tower', variant: 8 },
  { archetype: 'headwind_bridge', titlePl: 'Brama Oporu', titleEn: 'Gate of Trials', variant: 8 },
  { archetype: 'spinner_arena', titlePl: 'Krzyżowe Śmigła', titleEn: 'Cross Spinners', variant: 8 },
  { archetype: 'stair_ascent', titlePl: 'Schody do Chmur', titleEn: 'Stairway to 91', variant: 8 },

  // ZONE 10 (91–99): Wielki Finał 100
  { archetype: 'turbo_conveyor', titlePl: 'Finałowy Rozbieg', titleEn: 'Final Runway', variant: 9 },
  { archetype: 'ice_slalom', titlePl: 'Mistrzowski Ślizg', titleEn: 'Master Ice', variant: 9 },
  { archetype: 'fade_corridor', titlePl: 'Bieg po Chmurach', titleEn: 'Cloud Sprint', variant: 9 },
  { archetype: 'pusher_gauntlet', titlePl: 'Próba Rytmu', titleEn: 'Rhythm Trial', variant: 9 },
  { archetype: 'side_conveyor', titlePl: 'Podniebne Prądy', titleEn: 'Jet Streams', variant: 9 },
  { archetype: 'checker_lava', titlePl: 'Ognista Siatka', titleEn: 'Champion Grid', variant: 9 },
  { archetype: 'elevator_climb', titlePl: 'Winda Mistrzów', titleEn: 'Summit Lift', variant: 9 },
  { archetype: 'spinner_arena', titlePl: 'Ostatnia Turbina', titleEn: 'Final Vortex', variant: 9 },
  { archetype: 'jumppad_towers', titlePl: 'Skok po Puchar!', titleEn: 'Leap to 100!', variant: 9 },
]

// Deterministic PRNG so every player shares the exact same 100-stage world
function seeded(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export function generateTestObbyCourse(): ObbyCourseData {
  const rand = seeded(20261117)
  const blocks: ObbyBlockDef[] = []
  const checkpoints: ObbyCheckpointDef[] = []

  let curX = 0
  let curY = 0 // top surface y of current checkpoint
  let curZ = 0
  let bid = 0

  const nextId = (prefix: string) => `${prefix}_${++bid}`
  const addBlock = (b: Omit<ObbyBlockDef, 'id'>) => {
    blocks.push({ ...b, id: nextId(b.kind) })
  }

  // Helper: add scenic archway on zone entry (Stage 1, 11, 21, ..., 91, 100)
  const addZoneArch = (
    stage: number,
    zoneIdx: number,
    cx: number,
    cy: number,
    cz: number,
    spanW: number,
    colorPillar: string,
    colorTop: string,
  ) => {
    const pillarH = 6.2
    const halfSpan = spanW / 2 - 0.5
    addBlock({
      stage,
      zone: zoneIdx,
      kind: 'decor',
      x: cx - halfSpan,
      y: cy + pillarH / 2,
      z: cz,
      w: 0.9,
      h: pillarH,
      d: 0.9,
      color: colorPillar,
    })
    addBlock({
      stage,
      zone: zoneIdx,
      kind: 'decor',
      x: cx + halfSpan,
      y: cy + pillarH / 2,
      z: cz,
      w: 0.9,
      h: pillarH,
      d: 0.9,
      color: colorPillar,
    })
    addBlock({
      stage,
      zone: zoneIdx,
      kind: 'decor',
      x: cx,
      y: cy + pillarH + 0.45,
      z: cz,
      w: spanW + 0.6,
      h: 0.95,
      d: 1.25,
      color: colorTop,
    })
  }

  // Accent palette variations within each zone so even neighboring blocks feel fresh
  const accentColors = (zone: ObbyZoneMeta, stage: number): [string, string, string] => {
    const shift = stage % 3
    if (shift === 0) return [zone.primary, zone.secondary, zone.accent]
    if (shift === 1) return [zone.trim, zone.primary, zone.secondary]
    return [zone.accent, zone.trim, zone.primary]
  }

  for (let stage = 1; stage <= 100; stage++) {
    const zoneIdx = Math.min(9, Math.floor((stage - 1) / 10))
    const zone = OBBY_ZONES[zoneIdx]
    const sub = (stage - 1) % 10
    const recipe = STAGE_RECIPES[stage - 1]
    const [cA, cB, cC] = accentColors(zone, stage)

    const isStart = stage === 1
    const isFinish = stage === 100
    const cpW = isFinish ? 20 : isStart ? 11 : 7.6
    const cpD = isFinish ? 20 : isStart ? 11 : 7.6
    const cpH = 1.15

    // Checkpoint island
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

    // Scenic gate archway at the start of every 10-stage zone (1, 11, 21, ..., 91) and Stage 100!
    if (sub === 0 || isFinish) {
      addZoneArch(
        stage,
        zoneIdx,
        curX,
        curY,
        curZ - (isFinish ? -7.5 : cpD / 2 - 0.8),
        isFinish ? 11 : cpW,
        isFinish ? '#F59E0B' : zone.primary,
        isFinish ? '#FDE68A' : zone.accent,
      )
    }

    checkpoints.push({
      stage,
      zone: zoneIdx,
      titlePl: isFinish ? 'Wielkie Podium 100!' : recipe.titlePl,
      titleEn: isFinish ? 'Grand Podium 100!' : recipe.titleEn,
      x: curX,
      y: curY,
      z: curZ,
      spawnY: curY + 0.16,
      facingAngle: 0,
    })

    if (isFinish) {
      // Celebratory 3-tier golden winner podium + side obelisks on Stage 100 island!
      addBlock({
        stage: 100,
        zone: 9,
        kind: 'solid',
        x: curX,
        y: curY + 0.65,
        z: curZ - 4.0,
        w: 3.8,
        h: 1.3,
        d: 3.4,
        color: '#FBBF24',
      })
      addBlock({
        stage: 100,
        zone: 9,
        kind: 'solid',
        x: curX - 3.8,
        y: curY + 0.45,
        z: curZ - 4.0,
        w: 3.4,
        h: 0.9,
        d: 3.2,
        color: '#E2E8F0',
      })
      addBlock({
        stage: 100,
        zone: 9,
        kind: 'solid',
        x: curX + 3.8,
        y: curY + 0.3,
        z: curZ - 4.0,
        w: 3.4,
        h: 0.6,
        d: 3.2,
        color: '#D97706',
      })
      // Flanking celebratory pillars
      for (const sx of [-7.5, 7.5]) {
        addBlock({
          stage: 100,
          zone: 9,
          kind: 'decor',
          x: curX + sx,
          y: curY + 2.6,
          z: curZ - 5.5,
          w: 1.4,
          h: 5.2,
          d: 1.4,
          color: '#38BDF8',
        })
      }
      break
    }

    // === BUILD UNIQUE STAGE OBSTACLE SEQUENCE ===
    let edgeZ = curZ - cpD / 2
    let x = curX
    let y = curY

    // Gentle serpentine X bounds so the world weaves left & right without ever wandering off
    const stepXBounded = (dx: number) => {
      const candidate = x + dx
      if (candidate > 18) return x - Math.abs(dx)
      if (candidate < -18) return x + Math.abs(dx)
      return candidate
    }

    const difficulty = Math.min(1, (stage - 1) / 98) // 0.0 -> 1.0 smooth ramp
    const v = recipe.variant
    const turnSign = stage % 2 === 0 ? 1 : -1

    // Optional scenic floating side marker column on alternating stages for visual variety
    const addStageLandmark = (lx: number, ly: number, lz: number, h = 4.2) => {
      addBlock({
        stage,
        zone: zoneIdx,
        kind: 'decor',
        x: lx,
        y: ly + h / 2 - 0.8,
        z: lz,
        w: 1.1,
        h,
        d: 1.1,
        color: cC,
      })
    }

    const placeSolid = (gap: number, w: number, d: number, dy: number, dx: number, color: string) => {
      x = stepXBounded(dx)
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
      return centerZ
    }

    switch (recipe.archetype) {
      case 'stepping_blocks': {
        const count = 4 + (v % 3)
        for (let i = 0; i < count; i++) {
          const gap = 2.0 + difficulty * 1.1 + (i % 2) * 0.3
          const w = Math.max(2.6, 4.3 - difficulty * 1.2)
          const d = 3.0 + ((i + v) % 2) * 0.7
          const dx = i === 0 ? 0 : turnSign * (i % 2 === 0 ? -1 : 1) * (1.8 + (v % 3) * 0.7)
          const dy = i % 2 === 0 ? 0.35 : -0.1
          const cz = placeSolid(gap, w, d, dy, dx, i % 2 === 0 ? cA : cB)
          if (i === 1) addStageLandmark(x + (w / 2 + 2.4) * turnSign, y, cz, 3.6)
        }
        break
      }

      case 'stair_ascent': {
        // Ascending wide or spiraling staircase!
        const steps = 5 + (v % 3)
        const spiral = v >= 3
        for (let i = 0; i < steps; i++) {
          const gap = spiral ? 1.85 : 1.5
          const w = spiral ? 3.2 : 4.6 - (i % 2) * 0.5
          const d = spiral ? 3.0 : 2.5
          const dx = spiral ? turnSign * Math.sin(i * 0.9) * 2.4 : turnSign * (i % 2 === 0 ? 0.8 : -0.8)
          const dy = 0.72 + (v % 2) * 0.14
          placeSolid(gap, w, d, dy, dx, i % 3 === 0 ? cA : i % 3 === 1 ? cB : cC)
        }
        break
      }

      case 'cylinder_pillars': {
        // Round cylindrical drums/stones of varying radius and elevation!
        const count = 5 + (v % 3)
        for (let i = 0; i < count; i++) {
          const gap = 2.1 + difficulty * 0.85
          const diam = Math.max(2.4, 3.9 - (i % 2) * 0.55 - difficulty * 0.6)
          const pillarH = 1.6 + (i % 3) * 0.9
          x = stepXBounded(turnSign * (i % 2 === 0 ? 1 : -1) * (1.7 + (v % 3) * 0.55))
          y += i % 2 === 0 ? 0.45 : -0.15
          const centerZ = edgeZ - gap - diam / 2
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'pillar',
            x,
            y: y - pillarH / 2,
            z: centerZ,
            w: diam,
            h: pillarH,
            d: diam,
            color: i % 2 === 0 ? cA : cC,
          })
          edgeZ = centerZ - diam / 2
        }
        break
      }

      case 'split_paths': {
        // Fork into 2 distinct simultaneous routes: Left (wide/safer) vs Right (faster/bouncy or pillars)!
        const segs = 4 + (v % 2)
        const baseX = x
        const laneSpread = 3.9
        for (let i = 0; i < segs; i++) {
          const gap = 2.0 + difficulty * 0.6
          const d = 3.1
          y += 0.22
          const cz = edgeZ - gap - d / 2
          // Left route: solid zigzag blocks
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'solid',
            x: baseX - laneSpread + (i % 2 === 0 ? -0.6 : 0.6),
            y: y - 0.45,
            z: cz,
            w: 2.7,
            h: 0.9,
            d,
            color: cA,
          })
          // Right route: round pillars or fading speed tiles
          addBlock({
            stage,
            zone: zoneIdx,
            kind: i % 2 === 1 && v >= 2 ? 'fade' : 'pillar',
            x: baseX + laneSpread + (i % 2 === 0 ? 0.5 : -0.5),
            y: y - 0.6,
            z: cz,
            w: 2.8,
            h: 1.2,
            d: 2.8,
            color: cC,
          })
          edgeZ = cz - d / 2
        }
        x = baseX
        break
      }

      case 'bounce_chain': {
        // Springy rhythmic hop-hop-hop cushions!
        const pads = 3 + (v % 3)
        for (let i = 0; i < pads; i++) {
          const gap = i === 0 ? 2.1 : 4.2 + (v % 2) * 0.7
          const diam = 3.5 - difficulty * 0.4
          x = stepXBounded(i === 0 ? 0 : turnSign * (i % 2 === 0 ? -1 : 1) * (1.8 + (v % 2) * 0.8))
          y += 0.7
          const cz = edgeZ - gap - diam / 2
          // Base island under bounce pad
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'pillar',
            x,
            y: y - 0.65,
            z: cz,
            w: diam + 0.5,
            h: 1.1,
            d: diam + 0.5,
            color: cB,
          })
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'bounce',
            x,
            y: y + 0.12,
            z: cz,
            w: diam - 0.2,
            h: 0.36,
            d: diam - 0.2,
            color: i % 2 === 0 ? '#F59E0B' : '#10B981',
            jumpVel: 16.4,
          })
          edgeZ = cz - diam / 2
        }
        // Extra landing platform after last bounce
        placeSolid(4.0, 4.6, 4.2, 0.3, 0, cA)
        break
      }

      case 'hurdle_bridge': {
        const len = 16 + (v % 3) * 3.5
        const w = Math.max(3.6, 5.2 - difficulty * 1.1)
        const cz = placeSolid(2.1, w, len, 0.25, turnSign * 1.2, cB)
        const hurdles = 3 + (v % 3)
        const step = len / (hurdles + 1)
        for (let h = 1; h <= hurdles; h++) {
          const hz = cz + len / 2 - step * h
          const raisedGate = v >= 5 && h % 2 === 0
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'hazard',
            x,
            y: y + (raisedGate ? 0.52 : 0.32),
            z: hz,
            w: w + 0.14,
            h: raisedGate ? 0.82 : 0.62,
            d: 0.78,
            color: '#EF4444',
          })
        }
        break
      }

      case 'turbo_conveyor': {
        // High-speed forward conveyor runway + thrilling long jump at the end!
        const beltLen = 14 + (v % 3) * 3
        const beltW = 4.4
        const gap = 2.0
        y += 0.15
        const cz = edgeZ - gap - beltLen / 2
        addBlock({
          stage,
          zone: zoneIdx,
          kind: 'conveyor',
          x,
          y: y - 0.45,
          z: cz,
          w: beltW,
          h: 0.9,
          d: beltLen,
          color: '#0EA5E9',
          conveyorVx: 0,
          conveyorVz: -(7.2 + (v % 3) * 1.4), // pushes forward (-Z)
        })
        // Optional hurdle mid-runway on higher zones
        if (v >= 2) {
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'hazard',
            x,
            y: y + 0.3,
            z: cz,
            w: beltW + 0.1,
            h: 0.58,
            d: 0.72,
            color: '#EF4444',
          })
        }
        edgeZ = cz - beltLen / 2
        // Thrilling gap onto wide catch island!
        placeSolid(4.3, 5.2, 4.6, -0.4, 0, cA)
        break
      }

      case 'fade_corridor': {
        const rows = 4 + (v % 3)
        const cols = v >= 4 ? 3 : 2
        const colSpacing = cols === 3 ? 3.1 : 3.6
        for (let r = 0; r < rows; r++) {
          const gap = 1.9 + (r % 2) * 0.25
          const tileD = 2.8
          const tileW = 2.65
          y += 0.18
          const cz = edgeZ - gap - tileD / 2
          const safeCol = Math.floor(rand() * cols)
          for (let c = 0; c < cols; c++) {
            const ox = (c - (cols - 1) / 2) * colSpacing
            const keepSolid = v < 3 && c === safeCol
            addBlock({
              stage,
              zone: zoneIdx,
              kind: keepSolid ? 'solid' : 'fade',
              x: x + ox,
              y: y - 0.35,
              z: cz,
              w: tileW,
              h: 0.7,
              d: tileD,
              color: keepSolid ? cA : cB,
            })
          }
          edgeZ = cz - tileD / 2
        }
        break
      }

      case 'jumppad_towers': {
        const hops = 2 + (v >= 5 ? 1 : 0)
        for (let i = 0; i < hops; i++) {
          const launchCz = placeSolid(2.0, 4.8, 4.8, 0.15, 0, cB)
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'jumppad',
            x,
            y: y + 0.16,
            z: launchCz - 0.3,
            w: 2.8,
            h: 0.32,
            d: 2.8,
            color: '#0EA5E9',
            jumpVel: 22.0,
          })
          // High scenic landing platform
          const landDx = turnSign * (i % 2 === 0 ? 1 : -1) * (v >= 2 ? 2.8 : 0)
          placeSolid(6.6, 5.4, 5.2, 2.7, landDx, i % 2 === 0 ? cA : cC)
        }
        break
      }

      case 'checker_lava': {
        // 3x4 or 3x5 grid of safe & red hazard tiles!
        const rows = 4 + (v % 2)
        const cell = 2.7
        const gap = 2.0
        y += 0.2
        const totalD = rows * cell
        const startZ = edgeZ - gap - cell / 2
        // Guaranteed winding safe path column per row
        let safeCol = 1
        for (let r = 0; r < rows; r++) {
          const cz = startZ - r * cell
          const nextSafe = r === 0 ? 1 : Math.max(0, Math.min(2, safeCol + (rand() > 0.5 ? 1 : -1)))
          for (let c = 0; c < 3; c++) {
            const cx = x + (c - 1) * cell
            const isPath = c === safeCol || c === nextSafe || (r + c + v) % 2 === 0
            addBlock({
              stage,
              zone: zoneIdx,
              kind: isPath ? 'solid' : 'hazard',
              x: cx,
              y: y - 0.45,
              z: cz,
              w: cell - 0.14,
              h: 0.9,
              d: cell - 0.14,
              color: isPath ? (c === 1 ? cA : cB) : '#EF4444',
            })
          }
          safeCol = nextSafe
        }
        edgeZ = edgeZ - gap - totalD
        break
      }

      case 'side_conveyor': {
        // Crosswind sideways conveyor segments alternating left & right!
        const segs = 3 + (v % 3)
        for (let i = 0; i < segs; i++) {
          const gap = 2.0 + (i % 2) * 0.25
          const segD = 4.8 + ((v + i) % 3) * 0.8
          const segW = 6.2 - (v % 2) * 0.6
          x = stepXBounded(i === 0 ? 0 : turnSign * (i % 2 === 0 ? -1 : 1) * (0.9 + (v % 3) * 0.4))
          y += 0.2
          const cz = edgeZ - gap - segD / 2
          const dir = (i + stage) % 2 === 0 ? 1 : -1
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'conveyor',
            x,
            y: y - 0.45,
            z: cz,
            w: segW,
            h: 0.9,
            d: segD,
            color: dir > 0 ? '#0284C7' : '#0EA5E9',
            conveyorVx: dir * (4.2 + difficulty * 2.4),
            conveyorVz: 0,
          })
          edgeZ = cz - segD / 2
          // On glacier & summit zones, mix an icy rest stepping stone between crosswind belts!
          if (v >= 7 && i === 1) {
            const iceCz = edgeZ - 1.8 - 2.1
            addBlock({
              stage,
              zone: zoneIdx,
              kind: 'ice',
              x,
              y: y - 0.45,
              z: iceCz,
              w: 4.4,
              h: 0.9,
              d: 4.2,
              color: '#BAE6FD',
            })
            edgeZ = iceCz - 2.1
          }
        }
        break
      }

      case 'pusher_gauntlet': {
        // Classic Obby wall-pusher walkway! Watch the sliding blocks & dash past!
        const count = 3 + (v % 3)
        const walkLen = count * 5.2 + 3.0
        const walkW = 3.8
        const cz = placeSolid(2.0, walkW, walkLen, 0.25, 0, cB)
        // Side backing wall on left or right so pushers look anchored like real machinery
        const wallSide = turnSign
        addBlock({
          stage,
          zone: zoneIdx,
          kind: 'decor',
          x: x + wallSide * (walkW / 2 + 1.15),
          y: y + 1.5,
          z: cz,
          w: 1.2,
          h: 3.4,
          d: walkLen,
          color: cC,
        })
        for (let i = 0; i < count; i++) {
          const pz = cz + walkLen / 2 - 3.6 - i * 5.0
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'pusher',
            x: x + wallSide * (walkW / 2 - 0.35),
            y: y + 0.95,
            z: pz,
            w: walkW * 0.78,
            h: 1.7,
            d: 1.7,
            color: i % 2 === 0 ? cA : '#F97316',
            moveAxis: 'x',
            moveAmp: 1.65,
            moveSpeed: 1.85 + difficulty * 0.95,
            movePhase: i * 1.45 + v * 0.6,
          })
        }
        break
      }

      case 'glass_choice': {
        // Glass bridge! 4–5 rows of 2 tiles: 1 solid (subtle studs), 1 fake (breaks on touch!)
        const rows = 4 + (v % 2)
        for (let r = 0; r < rows; r++) {
          const gap = 1.65
          const tileW = 2.9
          const tileD = 3.1
          y += 0.12
          const cz = edgeZ - gap - tileD / 2
          const realSide = rand() > 0.5 ? 1 : 0
          for (let col = 0; col < 2; col++) {
            const isReal = col === realSide
            const ox = col === 0 ? -2.05 : 2.05
            addBlock({
              stage,
              zone: zoneIdx,
              kind: isReal ? 'solid' : 'fake',
              x: x + ox,
              y: y - 0.25,
              z: cz,
              w: tileW,
              h: 0.5,
              d: tileD,
              color: isReal ? '#BAE6FD' : '#93C5FD',
            })
          }
          edgeZ = cz - tileD / 2
        }
        break
      }

      case 'wall_slalom': {
        // Wide deck with alternating tall crimson half-walls you weave around!
        const gates = 4 + (v % 2)
        const len = gates * 4.5 + 3.5
        const w = 6.2
        const cz = placeSolid(2.0, w, len, 0.2, 0, cB)
        for (let g = 0; g < gates; g++) {
          const gz = cz + len / 2 - 3.6 - g * 4.4
          const leftWall = (g + stage) % 2 === 0
          const wallW = w * 0.62
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'hazard',
            x: x + (leftWall ? -(w - wallW) / 2 : (w - wallW) / 2),
            y: y + 1.25,
            z: gz,
            w: wallW,
            h: 2.4,
            d: 0.72,
            color: '#EF4444',
          })
        }
        break
      }

      case 'shuttle_cross': {
        // Moving horizontal (X) and longitudinal (Z) shuttles — unique per zone variant!
        const count = 3 + (v % 3)
        for (let i = 0; i < count; i++) {
          const isZ = (i + v) % 2 === 1
          const w = 3.6 + ((v + i) % 3) * 0.4
          const d = 3.6 + ((v + 1) % 2) * 0.6
          y += 0.25
          if (isZ) {
            const cz = edgeZ - 2.3 - d / 2 - 2.1
            addBlock({
              stage,
              zone: zoneIdx,
              kind: 'moving',
              x,
              y: y - 0.45,
              z: cz,
              w,
              h: 0.9,
              d,
              color: cC,
              moveAxis: 'z',
              moveAmp: 2.2,
              moveSpeed: 1.45 + difficulty * 0.55,
              movePhase: i * 1.4 + v * 0.5,
            })
            edgeZ = cz - d / 2 - 2.1
          } else {
            const cz = edgeZ - 2.1 - d / 2
            addBlock({
              stage,
              zone: zoneIdx,
              kind: 'moving',
              x,
              y: y - 0.45,
              z: cz,
              w,
              h: 0.9,
              d,
              color: cA,
              moveAxis: 'x',
              moveAmp: 2.9 + (v % 3) * 0.6,
              moveSpeed: 1.45 + difficulty * 0.55,
              movePhase: i * 1.9 + v * 0.4,
            })
            edgeZ = cz - d / 2
          }
          // Add a cylindrical rest island mid-crossing on variant >= 5
          if (v >= 5 && i === 1) {
            x = stepXBounded(turnSign * 1.5)
            const pcZ = edgeZ - 2.0 - 1.6
            addBlock({
              stage,
              zone: zoneIdx,
              kind: 'pillar',
              x,
              y: y - 0.7,
              z: pcZ,
              w: 3.2,
              h: 1.4,
              d: 3.2,
              color: cB,
            })
            edgeZ = pcZ - 1.6
          }
        }
        break
      }

      case 'spinner_arena': {
        // Rotating crimson sweeper bars (single or cross X-blades on higher zones!) + distinct lead-in/size per variant
        const arenas = v >= 3 ? 2 : 1
        const isCross = v >= 6
        if (v % 2 === 0) {
          // Scenic round stepping pillar entry into the spinner arena
          const pCz = edgeZ - 2.0 - 1.65
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'pillar',
            x,
            y: y - 0.65,
            z: pCz,
            w: 3.3,
            h: 1.3,
            d: 3.3,
            color: cA,
          })
          edgeZ = pCz - 1.65
        }
        for (let i = 0; i < arenas; i++) {
          const size = (isCross ? 9.0 : 8.0) + ((v + i) % 3) * 0.65
          const cz = placeSolid(2.2, size, size, 0.3, i === 1 ? turnSign * (1.8 + (v % 3) * 0.7) : turnSign * (v % 2), cB)
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'spinner',
            x,
            y: y + 0.48,
            z: cz,
            w: size - 0.5,
            h: 0.54,
            d: 0.66,
            color: '#EF4444',
            spinnerRadius: (size - 0.5) / 2,
            spinnerSpeed: (i % 2 === 0 ? 1 : -1) * (1.2 + difficulty * 0.95),
            spinnerPhase: stage * 0.7 + i * 1.6,
            spinnerCross: isCross,
          })
        }
        break
      }

      case 'ice_slalom': {
        // Slippery crystal ice platforms with gentle turns & optional hazard posts!
        const segs = 3 + (v % 2)
        for (let i = 0; i < segs; i++) {
          const gap = 2.0
          const segW = 5.0
          const segD = 7.2
          x = stepXBounded(i === 0 ? 0 : turnSign * (i % 2 === 0 ? -1 : 1) * 2.6)
          y += i % 2 === 0 ? -0.15 : 0.2
          const cz = edgeZ - gap - segD / 2
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'ice',
            x,
            y: y - 0.45,
            z: cz,
            w: segW,
            h: 0.9,
            d: segD,
            color: '#BAE6FD',
          })
          // Add center red hazard cone/post to weave around on ice!
          if (i === 1 || v >= 7) {
            addBlock({
              stage,
              zone: zoneIdx,
              kind: 'hazard',
              x: x + (i % 2 === 0 ? 0.9 : -0.9),
              y: y + 0.6,
              z: cz,
              w: 1.2,
              h: 1.2,
              d: 1.2,
              color: '#EF4444',
            })
          }
          edgeZ = cz - segD / 2
        }
        break
      }

      case 'tightrope_mix': {
        // Sleek narrow balance beams alternating with small round rest pillars
        const segs = 4
        for (let i = 0; i < segs; i++) {
          if (i % 2 === 0) {
            const beamW = Math.max(1.25, 1.7 - difficulty * 0.35)
            placeSolid(1.85, beamW, 7.6, 0.22, turnSign * (i === 0 ? 0.8 : -1.2), cA)
          } else {
            x = stepXBounded(turnSign * 1.4)
            y += 0.3
            const cz = edgeZ - 2.1 - 1.3
            addBlock({
              stage,
              zone: zoneIdx,
              kind: 'pillar',
              x,
              y: y - 0.7,
              z: cz,
              w: 2.6,
              h: 1.4,
              d: 2.6,
              color: cC,
            })
            edgeZ = cz - 1.3
          }
        }
        break
      }

      case 'elevator_climb': {
        // Vertical & diagonal sky lifts climbing smoothly upward!
        const lifts = 2 + (v >= 5 ? 1 : 0)
        for (let i = 0; i < lifts; i++) {
          const w = 4.2
          const d = 4.2
          const cz = edgeZ - 2.1 - d / 2
          y += 1.4
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'moving',
            x,
            y: y - 0.45,
            z: cz,
            w,
            h: 0.9,
            d,
            color: i % 2 === 0 ? cA : cC,
            moveAxis: v >= 4 && i === 1 ? 'xy' : 'y',
            moveAmp: v >= 4 && i === 1 ? 2.0 : 1.5,
            moveAmpY: 1.45,
            moveSpeed: 1.45 + difficulty * 0.45,
            movePhase: i * 1.6 + v * 0.4,
          })
          y += 1.3
          edgeZ = cz - d / 2
          // Rest ledge between lifts
          placeSolid(2.0, 4.4, 3.6, 0.1, 0, cB)
        }
        break
      }

      case 'headwind_bridge': {
        // Conveyor pushing BACKWARD (+Z) — hold sprint and hop over crimson hurdles!
        const len = 15 + (v % 3) * 2.5
        const w = 4.6
        const gap = 2.0
        y += 0.25
        const cz = edgeZ - gap - len / 2
        addBlock({
          stage,
          zone: zoneIdx,
          kind: 'conveyor',
          x,
          y: y - 0.45,
          z: cz,
          w,
          h: 0.9,
          d: len,
          color: '#3B82F6',
          conveyorVx: 0,
          conveyorVz: 4.4 + difficulty * 2.1, // pushes backward (+Z)
        })
        const hurdles = 2 + (v >= 6 ? 1 : 0)
        const step = len / (hurdles + 1)
        for (let h = 1; h <= hurdles; h++) {
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'hazard',
            x,
            y: y + 0.3,
            z: cz + len / 2 - step * h,
            w: w + 0.1,
            h: 0.56,
            d: 0.72,
            color: '#EF4444',
          })
        }
        edgeZ = cz - len / 2
        break
      }
    }

    // Advance cleanly to next checkpoint (`stage + 1`)
    const nextCpD = stage + 1 === 100 ? 20 : 7.6
    const finalGap = 2.2
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
