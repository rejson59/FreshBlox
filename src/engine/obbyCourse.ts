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

export type ObbyDifficultyTier = 1 | 2 | 3 | 4 | 5

export interface ObbyZoneMeta {
  index: number // 0..9
  startStage: number
  endStage: number
  namePl: string
  nameEn: string
  difficultyTier: ObbyDifficultyTier
  difficultyPl: string
  difficultyEn: string
  difficultyColor: string
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
    difficultyTier: 1,
    difficultyPl: 'Łatwy',
    difficultyEn: 'Easy',
    difficultyColor: '#34D399',
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
    difficultyTier: 1,
    difficultyPl: 'Łatwy+',
    difficultyEn: 'Easy+',
    difficultyColor: '#34D399',
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
    difficultyTier: 2,
    difficultyPl: 'Średni',
    difficultyEn: 'Medium',
    difficultyColor: '#38BDF8',
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
    difficultyTier: 2,
    difficultyPl: 'Średni+',
    difficultyEn: 'Medium+',
    difficultyColor: '#38BDF8',
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
    difficultyTier: 3,
    difficultyPl: 'Wymagający',
    difficultyEn: 'Challenging',
    difficultyColor: '#FBBF24',
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
    difficultyTier: 3,
    difficultyPl: 'Wymagający+',
    difficultyEn: 'Challenging+',
    difficultyColor: '#FBBF24',
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
    difficultyTier: 4,
    difficultyPl: 'Trudny',
    difficultyEn: 'Hard',
    difficultyColor: '#FB923C',
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
    difficultyTier: 4,
    difficultyPl: 'Trudny+',
    difficultyEn: 'Hard+',
    difficultyColor: '#FB923C',
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
    difficultyTier: 5,
    difficultyPl: 'Ekspert',
    difficultyEn: 'Expert',
    difficultyColor: '#F43F5E',
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
    difficultyTier: 5,
    difficultyPl: 'Mistrz',
    difficultyEn: 'Master',
    difficultyColor: '#F43F5E',
    primary: '#2563EB',
    secondary: '#F8FAFC',
    accent: '#F59E0B',
    trim: '#FDE68A',
  },
]

// 34 distinct gameplay archetypes (20 core + 14 multi-mechanic combos) —
// ZERO repeats inside any 10-stage zone, >= 20 stages gap before an archetype returns
// in a harder tier, and smooth, unmistakable difficulty escalation from Stage 1 to 100!
export type StageArchetype =
  // Core 20
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
  // 14 Combo & Advanced Archetypes
  | 'zigzag_lasers'
  | 'twin_towers'
  | 'ice_hurdles'
  | 'bouncing_pillars'
  | 'fade_bridge_lasers'
  | 'moving_hurdles'
  | 'conveyor_pushers'
  | 'ice_spinner_rink'
  | 'glass_bounce_leap'
  | 'pendulum_pillars'
  | 'lava_pillars_run'
  | 'sky_catapult_chain'
  | 'dual_spinner_catwalk'
  | 'champion_gauntlet'

interface StageRecipe {
  archetype: StageArchetype
  variant: number // 0..9 unique variation seed
  titlePl: string
  titleEn: string
}

// Hand-crafted 99-stage progression:
// - Zone 0–1 (1–20): Easy — gentle single-mechanic introductions, wide generous landings.
// - Zone 2–3 (21–40): Medium — new twists, turns, first combos, faster tempo.
// - Zone 4–5 (41–60): Challenging — verticality, narrow rails, combo chains, dual mechanics.
// - Zone 6–7 (61–80): Hard — ice + blades, pusher conveyors, glass bounces, fast lasers.
// - Zone 8–9 (81–99): Expert/Master — tight high-speed combos culminating in Stage 99 Champion Gauntlet!
const STAGE_RECIPES: StageRecipe[] = [
  // === ZONE 0 (1..10) — Błękitny Start [Tier 1: Łatwy] ===
  { archetype: 'stepping_blocks', variant: 0, titlePl: 'Pierwsze Skoki', titleEn: 'First Hops' },
  { archetype: 'stair_ascent', variant: 0, titlePl: 'Błękitne Schody', titleEn: 'Arctic Stairs' },
  { archetype: 'cylinder_pillars', variant: 0, titlePl: 'Kolumny Chmur', titleEn: 'Cloud Drums' },
  { archetype: 'hurdle_bridge', variant: 0, titlePl: 'Most z Laserami', titleEn: 'Laser Bridge' },
  { archetype: 'split_paths', variant: 0, titlePl: 'Rozwidlenie Dróg', titleEn: 'Twin Routes' },
  { archetype: 'bounce_chain', variant: 0, titlePl: 'Skoczne Poduchy', titleEn: 'Bouncy Cushions' },
  { archetype: 'turbo_conveyor', variant: 0, titlePl: 'Błękitny Taśmociąg', titleEn: 'Sky Runway' },
  { archetype: 'fade_corridor', variant: 0, titlePl: 'Znikające Płyty', titleEn: 'Vanishing Tiles' },
  { archetype: 'jumppad_towers', variant: 0, titlePl: 'Pierwsza Skocznia', titleEn: 'First Launchpad' },
  { archetype: 'checker_lava', variant: 0, titlePl: 'Szachownica Ciepła', titleEn: 'Warm Checkerboard' },

  // === ZONE 1 (11..20) — Słoneczne Tarasy [Tier 1: Łatwy+] ===
  { archetype: 'side_conveyor', variant: 1, titlePl: 'Słoneczny Wiatr', titleEn: 'Sunbeam Drift' },
  { archetype: 'wall_slalom', variant: 1, titlePl: 'Slalom Bramkowy', titleEn: 'Gate Slalom' },
  { archetype: 'glass_choice', variant: 1, titlePl: 'Szklana Zagadka', titleEn: 'Glass Riddle' },
  { archetype: 'shuttle_cross', variant: 1, titlePl: 'Złote Promy', titleEn: 'Golden Shuttles' },
  { archetype: 'pusher_gauntlet', variant: 1, titlePl: 'Tłoki Tarasowe', titleEn: 'Terrace Pushers' },
  { archetype: 'tightrope_mix', variant: 1, titlePl: 'Słoneczne Belki', titleEn: 'Sunbeams' },
  { archetype: 'ice_slalom', variant: 1, titlePl: 'Chłodny Ślizg', titleEn: 'Cool Glide' },
  { archetype: 'elevator_climb', variant: 1, titlePl: 'Tarasowe Windy', titleEn: 'Terrace Lifts' },
  { archetype: 'spinner_arena', variant: 1, titlePl: 'Wiatrak Słońca', titleEn: 'Solar Sweeper' },
  { archetype: 'headwind_bridge', variant: 1, titlePl: 'Pod Słoneczny Prąd', titleEn: 'Upwind Sprint' },

  // === ZONE 2 (21..30) — Miętowa Laguna [Tier 2: Średni] ===
  { archetype: 'lava_pillars_run', variant: 2, titlePl: 'Kamienie nad Lawą', titleEn: 'Lava Stepping Stones' },
  { archetype: 'zigzag_lasers', variant: 2, titlePl: 'Zygzak Laguny', titleEn: 'Lagoon Zigzag' },
  { archetype: 'bouncing_pillars', variant: 2, titlePl: 'Sprężyste Słupy', titleEn: 'Spring Pillars' },
  { archetype: 'twin_towers', variant: 2, titlePl: 'Miętowa Wieża', titleEn: 'Mint Spiral Tower' },
  { archetype: 'stepping_blocks', variant: 2, titlePl: 'Miętowe Wyspy', titleEn: 'Mint Archipelagos' },
  { archetype: 'fade_corridor', variant: 2, titlePl: 'Korytarz Mgły', titleEn: 'Mist Corridor' },
  { archetype: 'stair_ascent', variant: 2, titlePl: 'Kaskada Laguny', titleEn: 'Lagoon Cascade' },
  { archetype: 'jumppad_towers', variant: 2, titlePl: 'Gejzery Wodne', titleEn: 'Water Geysers' },
  { archetype: 'turbo_conveyor', variant: 2, titlePl: 'Prąd Morski', titleEn: 'Ocean Current' },
  { archetype: 'checker_lava', variant: 2, titlePl: 'Kratka Rafy', titleEn: 'Reef Grid' },

  // === ZONE 3 (31..40) — Koralowy Kanion [Tier 2: Średni+] ===
  { archetype: 'cylinder_pillars', variant: 3, titlePl: 'Koralowe Bębny', titleEn: 'Coral Drums' },
  { archetype: 'moving_hurdles', variant: 3, titlePl: 'Ruchome Płotki', titleEn: 'Moving Hurdles' },
  { archetype: 'split_paths', variant: 3, titlePl: 'Kanion Dwóch Dróg', titleEn: 'Forked Canyon' },
  { archetype: 'ice_hurdles', variant: 3, titlePl: 'Śliskie Przeszkody', titleEn: 'Slick Hurdles' },
  { archetype: 'fade_bridge_lasers', variant: 3, titlePl: 'Koralowy Pośpiech', titleEn: 'Coral Rush' },
  { archetype: 'bounce_chain', variant: 3, titlePl: 'Skoki przez Kanion', titleEn: 'Canyon Trampolines' },
  { archetype: 'pusher_gauntlet', variant: 3, titlePl: 'Tłoki Kanionu', titleEn: 'Canyon Pistons' },
  { archetype: 'glass_choice', variant: 3, titlePl: 'Koralowe Szyby', titleEn: 'Coral Glass' },
  { archetype: 'wall_slalom', variant: 3, titlePl: 'Czerwony Labirynt', titleEn: 'Crimson Maze' },
  { archetype: 'hurdle_bridge', variant: 3, titlePl: 'Most Koralowy', titleEn: 'Coral Hurdle Run' },

  // === ZONE 4 (41..50) — Podniebne Windy [Tier 3: Wymagający] ===
  { archetype: 'shuttle_cross', variant: 4, titlePl: 'Podniebne Promy', titleEn: 'Sky Shuttles' },
  { archetype: 'pendulum_pillars', variant: 4, titlePl: 'Wahadłowe Kolumny', titleEn: 'Pendulum Pillars' },
  { archetype: 'elevator_climb', variant: 4, titlePl: 'Winda do Nieba', titleEn: 'Heavenly Lifts' },
  { archetype: 'conveyor_pushers', variant: 4, titlePl: 'Taśma z Tłokami', titleEn: 'Piston Conveyor' },
  { archetype: 'side_conveyor', variant: 4, titlePl: 'Wichura w Chmurach', titleEn: 'Cloud Crosswind' },
  { archetype: 'spinner_arena', variant: 4, titlePl: 'Podwójny Wiatrak', titleEn: 'Twin Sweepers' },
  { archetype: 'sky_catapult_chain', variant: 4, titlePl: 'Podniebne Katapulty', titleEn: 'Sky Catapults' },
  { archetype: 'tightrope_mix', variant: 4, titlePl: 'Lina nad Przepaścią', titleEn: 'Abyss Tightrope' },
  { archetype: 'headwind_bridge', variant: 4, titlePl: 'Odrzutowy Wiatr', titleEn: 'Jet Headwind' },
  { archetype: 'glass_bounce_leap', variant: 4, titlePl: 'Szklane Sprężyny', titleEn: 'Glass Springs' },

  // === ZONE 5 (51..60) — Bursztynowe Skocznie [Tier 3: Wymagający+] ===
  { archetype: 'bouncing_pillars', variant: 5, titlePl: 'Bursztynowe Filary', titleEn: 'Amber Spring Pillars' },
  { archetype: 'twin_towers', variant: 5, titlePl: 'Bursztynowa Spirala', titleEn: 'Amber Spiral Tower' },
  { archetype: 'ice_spinner_rink', variant: 5, titlePl: 'Bursztynowe Lodowisko', titleEn: 'Amber Blade Rink' },
  { archetype: 'zigzag_lasers', variant: 5, titlePl: 'Złoty Zygzak', titleEn: 'Gilded Zigzag' },
  { archetype: 'lava_pillars_run', variant: 5, titlePl: 'Żarzące Kamienie', titleEn: 'Ember Stepping Stones' },
  { archetype: 'dual_spinner_catwalk', variant: 5, titlePl: 'Kładka Ostrzy', titleEn: 'Blade Catwalk' },
  { archetype: 'fade_corridor', variant: 5, titlePl: 'Znikające Trzy Pasy', titleEn: 'Triple Vanish Lanes' },
  { archetype: 'jumppad_towers', variant: 5, titlePl: 'Potrójne Skocznie', titleEn: 'Triple Launchpads' },
  { archetype: 'turbo_conveyor', variant: 5, titlePl: 'Bursztynowa Katapulta', titleEn: 'Amber Launch Belt' },
  { archetype: 'checker_lava', variant: 5, titlePl: 'Bursztynowa Szachownica', titleEn: 'Amber Checker' },

  // === ZONE 6 (61..70) — Szmaragdowe Ogrody [Tier 4: Trudny] ===
  { archetype: 'moving_hurdles', variant: 6, titlePl: 'Szmaragdowe Promy', titleEn: 'Emerald Hurdle Shuttles' },
  { archetype: 'fade_bridge_lasers', variant: 6, titlePl: 'Laserowy Sprint', titleEn: 'Emerald Laser Dash' },
  { archetype: 'stepping_blocks', variant: 6, titlePl: 'Wąskie Wyspy', titleEn: 'Narrow Isles' },
  { archetype: 'stair_ascent', variant: 6, titlePl: 'Szmaragdowa Spirala', titleEn: 'Emerald Helix' },
  { archetype: 'cylinder_pillars', variant: 6, titlePl: 'Smukłe Kolumny', titleEn: 'Slender Columns' },
  { archetype: 'split_paths', variant: 6, titlePl: 'Ogród Wyboru', titleEn: 'Garden Fork' },
  { archetype: 'pusher_gauntlet', variant: 6, titlePl: 'Szybkie Tłoki', titleEn: 'Rapid Pistons' },
  { archetype: 'ice_hurdles', variant: 6, titlePl: 'Oszronione Płotki', titleEn: 'Frosted Hurdles' },
  { archetype: 'glass_choice', variant: 6, titlePl: 'Szmaragdowy Most', titleEn: 'Emerald Glass Bridge' },
  { archetype: 'bounce_chain', variant: 6, titlePl: 'Akrobatyka Ogrodu', titleEn: 'Garden Acrobatics' },

  // === ZONE 7 (71..80) — Lodowy Szczyt [Tier 4: Trudny+] ===
  { archetype: 'ice_slalom', variant: 7, titlePl: 'Lodowy Slalom', titleEn: 'Glacier Slalom' },
  { archetype: 'ice_spinner_rink', variant: 7, titlePl: 'Krzyżak na Lodzie', titleEn: 'Glacier Cross-Blades' },
  { archetype: 'conveyor_pushers', variant: 7, titlePl: 'Zamieć Tłoków', titleEn: 'Blizzard Pistons' },
  { archetype: 'pendulum_pillars', variant: 7, titlePl: 'Lodowe Wahadła', titleEn: 'Frost Pendulums' },
  { archetype: 'sky_catapult_chain', variant: 7, titlePl: 'Katapulty Szczytu', titleEn: 'Glacier Catapults' },
  { archetype: 'side_conveyor', variant: 7, titlePl: 'Arktyczny Bocznik', titleEn: 'Arctic Cross-Belt' },
  { archetype: 'shuttle_cross', variant: 7, titlePl: 'Mroźne Promy', titleEn: 'Frost Shuttles' },
  { archetype: 'tightrope_mix', variant: 7, titlePl: 'Lodowa Krawędź', titleEn: 'Ice Edge Balance' },
  { archetype: 'elevator_climb', variant: 7, titlePl: 'Wspinaczka na Szczyt', titleEn: 'Peak Elevators' },
  { archetype: 'headwind_bridge', variant: 7, titlePl: 'Huragan Północy', titleEn: 'North Gale' },

  // === ZONE 8 (81..90) — Królewska Twierdza [Tier 5: Ekspert] ===
  { archetype: 'dual_spinner_catwalk', variant: 8, titlePl: 'Królewska Kładka Ostrzy', titleEn: 'Royal Blade Catwalk' },
  { archetype: 'glass_bounce_leap', variant: 8, titlePl: 'Kryształowe Skoki', titleEn: 'Crystal Glass Leaps' },
  { archetype: 'twin_towers', variant: 8, titlePl: 'Wieża Twierdzy', titleEn: 'Citadel Tower' },
  { archetype: 'zigzag_lasers', variant: 8, titlePl: 'Królewski Zygzak', titleEn: 'Royal Laser Zigzag' },
  { archetype: 'lava_pillars_run', variant: 8, titlePl: 'Fosa Lawy', titleEn: 'Citadel Lava Moat' },
  { archetype: 'wall_slalom', variant: 8, titlePl: 'Bastion Ścian', titleEn: 'Crimson Bastion' },
  { archetype: 'hurdle_bridge', variant: 8, titlePl: 'Most Królewskich Laserów', titleEn: 'Royal Laser Bridge' },
  { archetype: 'bouncing_pillars', variant: 8, titlePl: 'Wieże Akrobaty', titleEn: 'Acrobat Pillars' },
  { archetype: 'spinner_arena', variant: 8, titlePl: 'Arena Krzyżaków', titleEn: 'Cross-Blade Arena' },
  { archetype: 'fade_bridge_lasers', variant: 8, titlePl: 'Próba Szybkości', titleEn: 'Citadel Speed Trial' },

  // === ZONE 9 (91..99) — Wielki Finał 100 [Tier 5: Mistrz] ===
  { archetype: 'moving_hurdles', variant: 9, titlePl: 'Finałowe Promy', titleEn: 'Summit Hurdle Shuttles' },
  { archetype: 'ice_hurdles', variant: 9, titlePl: 'Mroźny Bieg Mistrza', titleEn: 'Master Frost Hurdles' },
  { archetype: 'conveyor_pushers', variant: 9, titlePl: 'Fabryka Mistrzów', titleEn: 'Master Piston Belt' },
  { archetype: 'pendulum_pillars', variant: 9, titlePl: 'Podniebne Wahadła', titleEn: 'Summit Pendulums' },
  { archetype: 'sky_catapult_chain', variant: 9, titlePl: 'Katapulty do Chmur', titleEn: 'Cloud Catapult Chain' },
  { archetype: 'ice_spinner_rink', variant: 9, titlePl: 'Lodowe Ostrza Finału', titleEn: 'Final Glacier Blades' },
  { archetype: 'glass_bounce_leap', variant: 9, titlePl: 'Szklany Lot Mistrza', titleEn: 'Master Glass Vault' },
  { archetype: 'dual_spinner_catwalk', variant: 9, titlePl: 'Przedostatnia Próba', titleEn: 'Penultimate Gauntlet' },
  { archetype: 'champion_gauntlet', variant: 9, titlePl: 'Wielka Próba Mistrza', titleEn: 'Grand Champion Trial' },
]

// Deterministic fast PRNG so every player gets the exact same rich 100-stage Obby world
function mulberry32(seed: number) {
  let a = seed >>> 0
  return function rand() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generateTestObbyCourse(): ObbyCourseData {
  const rand = mulberry32(20261009)
  const blocks: ObbyBlockDef[] = []
  const checkpoints: ObbyCheckpointDef[] = []
  let idSeq = 0

  const addBlock = (b: Omit<ObbyBlockDef, 'id'>) => {
    blocks.push({ id: `ob_${idSeq++}`, ...b })
  }

  let curX = 0
  let curY = 2.0
  let curZ = 0

  for (let stage = 1; stage <= 100; stage++) {
    const zoneIdx = Math.min(9, Math.floor((stage - 1) / 10))
    const zone = OBBY_ZONES[zoneIdx]
    const recipe = stage <= 99 ? STAGE_RECIPES[stage - 1] : null

    const titlePl = stage === 100 ? 'Wielkie Podium 100!' : recipe!.titlePl
    const titleEn = stage === 100 ? 'Grand Podium 100!' : recipe!.titleEn

    const isStart = stage === 1
    const isFinish = stage === 100
    const cpW = isStart ? 15 : isFinish ? 20 : 9.4
    const cpD = isStart ? 13 : isFinish ? 20 : 7.6
    const cpH = 1.6

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
      color: isFinish ? '#FACC15' : zone.secondary,
      checkpointStage: stage,
    })

    // Subtle colored trim strip along checkpoint front & back edges
    addBlock({
      stage,
      zone: zoneIdx,
      kind: 'decor',
      x: curX,
      y: curY - cpH / 2 - 0.12,
      z: curZ,
      w: cpW + 0.36,
      h: 0.45,
      d: cpD + 0.36,
      color: isFinish ? '#F59E0B' : zone.primary,
    })

    // Zone Entry Archway every 10 stages (1, 11, 21, ..., 91) + Grand Crown Arch at 100
    if (stage % 10 === 1 || isFinish) {
      const archHalf = cpW / 2 - 0.75
      const archH = isFinish ? 9.5 : 6.4
      addBlock({
        stage,
        zone: zoneIdx,
        kind: 'decor',
        x: curX - archHalf,
        y: curY + archH / 2,
        z: curZ - cpD / 2 + 0.9,
        w: 0.95,
        h: archH,
        d: 0.95,
        color: isFinish ? '#F59E0B' : zone.primary,
      })
      addBlock({
        stage,
        zone: zoneIdx,
        kind: 'decor',
        x: curX + archHalf,
        y: curY + archH / 2,
        z: curZ - cpD / 2 + 0.9,
        w: 0.95,
        h: archH,
        d: 0.95,
        color: isFinish ? '#F59E0B' : zone.primary,
      })
      addBlock({
        stage,
        zone: zoneIdx,
        kind: 'decor',
        x: curX,
        y: curY + archH + 0.45,
        z: curZ - cpD / 2 + 0.9,
        w: cpW - 0.5,
        h: 0.95,
        d: 1.05,
        color: isFinish ? '#FACC15' : zone.accent,
      })
    }

    // Finish Podium 100 Trophy Pedestal & Celebration Pillars
    if (isFinish) {
      addBlock({
        stage,
        zone: zoneIdx,
        kind: 'decor',
        x: curX,
        y: curY + 0.65,
        z: curZ - 3.6,
        w: 4.8,
        h: 1.3,
        d: 4.8,
        color: '#F59E0B',
      })
      addBlock({
        stage,
        zone: zoneIdx,
        kind: 'decor',
        x: curX,
        y: curY + 2.4,
        z: curZ - 3.6,
        w: 2.3,
        h: 2.2,
        d: 2.3,
        color: '#FDE047',
      })
      for (const sx of [-7.5, 7.5]) {
        for (const sz of [-6.5, 5.5]) {
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'decor',
            x: curX + sx,
            y: curY + 2.2,
            z: curZ + sz,
            w: 1.3,
            h: 4.4,
            d: 1.3,
            color: '#38BDF8',
          })
        }
      }
    }

    checkpoints.push({
      stage,
      zone: zoneIdx,
      titlePl,
      titleEn,
      x: curX,
      y: curY,
      z: curZ,
      spawnY: curY + 0.08,
      facingAngle: Math.PI,
    })

    if (isFinish || !recipe) break

    // Normalized global difficulty d ∈ [0.0 .. 1.0] (Stage 1 = 0.0, Stage 99 = 1.0)
    // Plus smooth tier boost so each zone feels tangibly more exciting than the last!
    const d = (stage - 1) / 98
    const tier = zone.difficultyTier // 1..5
    const v = recipe.variant
    const turnSign = stage % 2 === 0 ? 1 : -1

    let x = curX
    let y = curY
    let edgeZ = curZ - cpD / 2

    const cA = zone.primary
    const cB = zone.secondary
    const cC = zone.accent
    const cT = zone.trim

    const stepXBounded = (deltaX: number) => {
      let nx = x + deltaX
      if (nx > 20) nx = x - Math.abs(deltaX)
      if (nx < -20) nx = x + Math.abs(deltaX)
      return nx
    }

    const addStageLandmark = (lx: number, ly: number, lz: number, height: number) => {
      addBlock({
        stage,
        zone: zoneIdx,
        kind: 'decor',
        x: lx,
        y: ly + height / 2 - 1.2,
        z: lz,
        w: 1.15,
        h: height,
        d: 1.15,
        color: cT,
      })
    }

    const placeSolid = (
      gap: number,
      w: number,
      depth: number,
      dy: number,
      dx: number,
      color: string,
      h = 0.9
    ) => {
      x = stepXBounded(dx)
      y += dy
      const centerZ = edgeZ - gap - depth / 2
      addBlock({
        stage,
        zone: zoneIdx,
        kind: 'solid',
        x,
        y: y - h / 2,
        z: centerZ,
        w,
        h,
        d: depth,
        color,
      })
      edgeZ = centerZ - depth / 2
      return centerZ
    }

    const placePillar = (
      gap: number,
      diam: number,
      dy: number,
      dx: number,
      color: string,
      h = 1.6
    ) => {
      x = stepXBounded(dx)
      y += dy
      const centerZ = edgeZ - gap - diam / 2
      addBlock({
        stage,
        zone: zoneIdx,
        kind: 'pillar',
        x,
        y: y - h / 2,
        z: centerZ,
        w: diam,
        h,
        d: diam,
        color,
      })
      edgeZ = centerZ - diam / 2
      return centerZ
    }

    switch (recipe.archetype) {
      // ============================================================
      // 1..20 CORE ARCHETYPES (with clear Tier 1 -> Tier 5 scaling!)
      // ============================================================

      case 'stepping_blocks': {
        const count = 4 + tier // 5 on Tier 1 -> 9 on Tier 5
        for (let i = 0; i < count; i++) {
          const gap = 1.9 + d * 1.9 + (i % 2) * 0.25
          const w = Math.max(2.1, 4.4 - d * 1.9)
          const depth = Math.max(2.3, 3.6 - d * 0.95)
          const dx = i === 0 ? 0 : turnSign * (i % 2 === 0 ? -1 : 1) * (1.5 + d * 2.1)
          const dy = i % 2 === 0 ? 0.32 + d * 0.35 : -0.1
          const cz = placeSolid(gap, w, depth, dy, dx, i % 2 === 0 ? cA : cB)
          if (i === 1) addStageLandmark(x + (w / 2 + 2.5) * turnSign, y, cz, 3.8)
        }
        break
      }

      case 'stair_ascent': {
        const steps = 5 + tier
        const spiral = tier >= 3
        for (let i = 0; i < steps; i++) {
          const gap = (spiral ? 1.85 : 1.55) + d * 1.15
          const w = Math.max(2.2, (spiral ? 3.5 : 4.7) - d * 1.3)
          const depth = Math.max(2.2, (spiral ? 2.9 : 2.7) - d * 0.4)
          const dx = spiral ? turnSign * Math.sin(i * 0.85) * (2.2 + d * 0.9) : turnSign * (i % 2 === 0 ? 0.9 : -0.9)
          const dy = 0.65 + d * 0.45
          placeSolid(gap, w, depth, dy, dx, i % 3 === 0 ? cA : i % 3 === 1 ? cB : cC)
        }
        break
      }

      case 'cylinder_pillars': {
        const count = 5 + tier
        for (let i = 0; i < count; i++) {
          const gap = 1.95 + d * 1.75
          const diam = Math.max(1.95, 3.9 - d * 1.55 - (i % 2) * 0.28)
          const dx = turnSign * (i % 2 === 0 ? 1 : -1) * (1.4 + d * 1.9)
          const dy = i % 2 === 0 ? 0.42 + d * 0.35 : -0.12
          placePillar(gap, diam, dy, dx, i % 2 === 0 ? cA : cC, 1.6 + (i % 3) * 0.8)
        }
        break
      }

      case 'split_paths': {
        const segs = 4 + Math.min(3, tier)
        const baseX = x
        const laneSpread = 4.0
        for (let i = 0; i < segs; i++) {
          const gap = 1.9 + d * 1.45
          const depth = Math.max(2.4, 3.3 - d * 0.65)
          const wLeft = Math.max(2.0, 3.1 - d * 0.9)
          y += 0.24 + d * 0.2
          const cz = edgeZ - gap - depth / 2
          // Left route: solid blocks (plus hurdle on Tier 4+)
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'solid',
            x: baseX - laneSpread + (i % 2 === 0 ? -0.65 : 0.65),
            y: y - 0.45,
            z: cz,
            w: wLeft,
            h: 0.9,
            d: depth,
            color: cA,
          })
          // Right route: pillars / fade tiles
          addBlock({
            stage,
            zone: zoneIdx,
            kind: tier >= 2 && i % 2 === 1 ? 'fade' : 'pillar',
            x: baseX + laneSpread + (i % 2 === 0 ? 0.55 : -0.55),
            y: y - 0.55,
            z: cz,
            w: Math.max(2.1, 3.0 - d * 0.7),
            h: 1.1,
            d: Math.max(2.1, 3.0 - d * 0.7),
            color: cC,
          })
          edgeZ = cz - depth / 2
        }
        x = baseX
        break
      }

      case 'bounce_chain': {
        const pads = 3 + Math.min(3, tier)
        for (let i = 0; i < pads; i++) {
          const gap = i === 0 ? 2.1 : 4.0 + d * 1.4
          const diam = Math.max(2.6, 3.8 - d * 0.95)
          x = stepXBounded(i === 0 ? 0 : turnSign * (i % 2 === 0 ? -1 : 1) * (1.6 + d * 1.7))
          y += 0.65 + d * 0.25
          const cz = edgeZ - gap - diam / 2
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'pillar',
            x,
            y: y - 0.6,
            z: cz,
            w: diam + 0.45,
            h: 1.1,
            d: diam + 0.45,
            color: cB,
          })
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'bounce',
            x,
            y: y + 0.14,
            z: cz,
            w: diam - 0.15,
            h: 0.36,
            d: diam - 0.15,
            color: i % 2 === 0 ? '#F59E0B' : '#10B981',
            jumpVel: 16.4 + d * 1.2,
          })
          edgeZ = cz - diam / 2
        }
        placeSolid(4.1, 4.8, 4.2, 0.3, 0, cA)
        break
      }

      case 'hurdle_bridge': {
        const len = 15 + tier * 3.4
        const w = Math.max(2.8, 5.2 - d * 2.0)
        const cz = placeSolid(2.0 + d * 0.6, w, len, 0.25, turnSign * 1.1, cB)
        const hurdles = 3 + tier // 4 on Tier 1 -> 8 on Tier 5
        const step = len / (hurdles + 1)
        for (let h = 1; h <= hurdles; h++) {
          const hz = cz + len / 2 - step * h
          const raised = tier >= 4 && h % 2 === 0
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'hazard',
            x,
            y: y + (raised ? 0.56 : 0.32),
            z: hz,
            w: w + 0.12,
            h: raised ? 0.88 : 0.62,
            d: 0.74,
            color: '#EF4444',
          })
        }
        break
      }

      case 'turbo_conveyor': {
        const beltLen = 14 + tier * 2.6
        const beltW = Math.max(3.1, 4.8 - d * 1.2)
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
          conveyorVz: -(6.8 + d * 5.2),
        })
        const hurdles = tier >= 3 ? 2 : tier >= 2 ? 1 : 0
        for (let h = 1; h <= hurdles; h++) {
          const hz = cz + beltLen / 2 - (beltLen / (hurdles + 1)) * h
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'hazard',
            x,
            y: y + 0.32,
            z: hz,
            w: beltW + 0.08,
            h: 0.6,
            d: 0.72,
            color: '#EF4444',
          })
        }
        edgeZ = cz - beltLen / 2
        placeSolid(4.1 + d * 1.2, Math.max(3.8, 5.4 - d * 1.1), 4.5, -0.35, 0, cA)
        break
      }

      case 'fade_corridor': {
        const rows = 4 + tier
        const cols = tier >= 3 ? 3 : 2
        const colSpacing = cols === 3 ? 3.05 : 3.55
        for (let r = 0; r < rows; r++) {
          const gap = 1.85 + d * 1.1
          const tileD = Math.max(2.3, 3.0 - d * 0.55)
          const tileW = Math.max(2.15, 2.85 - d * 0.55)
          y += 0.2
          const cz = edgeZ - gap - tileD / 2
          const safeCol = Math.floor(rand() * cols)
          for (let c = 0; c < cols; c++) {
            const ox = (c - (cols - 1) / 2) * colSpacing
            const keepSolid = tier === 1 && c === safeCol
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
        const hops = 2 + (tier >= 3 ? 1 : 0)
        for (let i = 0; i < hops; i++) {
          const launchW = Math.max(3.6, 5.0 - d * 1.1)
          const launchCz = placeSolid(2.0 + d * 0.5, launchW, launchW, 0.15, 0, cB)
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'jumppad',
            x,
            y: y + 0.16,
            z: launchCz - 0.25,
            w: 2.7,
            h: 0.32,
            d: 2.7,
            color: '#0EA5E9',
            jumpVel: 21.8 + d * 1.6,
          })
          const landDx = turnSign * (i % 2 === 0 ? 1 : -1) * (tier >= 2 ? 2.4 + d * 1.5 : 0)
          const landW = Math.max(3.8, 5.6 - d * 1.3)
          placeSolid(6.4 + d * 0.9, landW, landW, 2.7 + d * 0.5, landDx, i % 2 === 0 ? cA : cC)
        }
        break
      }

      case 'checker_lava': {
        const rows = 4 + Math.min(3, tier)
        const cell = Math.max(2.35, 2.85 - d * 0.4)
        const gap = 2.0
        y += 0.2
        const totalD = rows * cell
        const startZ = edgeZ - gap - cell / 2
        let safeCol = 1
        for (let r = 0; r < rows; r++) {
          const cz = startZ - r * cell
          const nextSafe = r === 0 ? 1 : Math.max(0, Math.min(2, safeCol + (rand() > 0.5 ? 1 : -1)))
          for (let c = 0; c < 3; c++) {
            const cx = x + (c - 1) * cell
            // Higher tiers make fewer safe tiles (still guaranteeing a 100% connected path!)
            const isPath =
              c === safeCol || (tier <= 2 && c === nextSafe) || (tier === 1 && (r + c + v) % 2 === 0)
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
        const segs = 3 + Math.min(3, tier)
        for (let i = 0; i < segs; i++) {
          const gap = 2.0 + d * 1.0
          const segD = 4.6 + (i % 2) * 0.9
          const segW = Math.max(4.5, 6.4 - d * 1.5)
          x = stepXBounded(i === 0 ? 0 : turnSign * (i % 2 === 0 ? -1 : 1) * (1.0 + d * 1.1))
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
            conveyorVx: dir * (3.8 + d * 4.4),
            conveyorVz: 0,
          })
          edgeZ = cz - segD / 2
          if (tier >= 4 && i === 1) {
            const iceCz = edgeZ - 1.9 - 2.0
            addBlock({
              stage,
              zone: zoneIdx,
              kind: 'ice',
              x,
              y: y - 0.45,
              z: iceCz,
              w: 4.0,
              h: 0.9,
              d: 4.0,
              color: '#BAE6FD',
            })
            edgeZ = iceCz - 2.0
          }
        }
        break
      }

      case 'pusher_gauntlet': {
        const count = 3 + tier // 4 -> 8 pushers
        const spacing = Math.max(4.1, 5.2 - d * 0.9)
        const walkLen = count * spacing + 3.2
        const walkW = Math.max(3.2, 4.1 - d * 0.7)
        const cz = placeSolid(2.0, walkW, walkLen, 0.25, 0, cB)
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
          const pz = cz + walkLen / 2 - 3.2 - i * spacing
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'pusher',
            x: x + wallSide * (walkW / 2 - 0.35),
            y: y + 0.95,
            z: pz,
            w: walkW * 0.8,
            h: 1.7,
            d: 1.65,
            color: i % 2 === 0 ? cA : '#F97316',
            moveAxis: 'x',
            moveAmp: 1.55 + d * 0.3,
            moveSpeed: 1.6 + d * 1.45,
            movePhase: i * 1.4 + v * 0.6,
          })
        }
        break
      }

      case 'glass_choice': {
        const rows = 4 + Math.min(3, tier)
        for (let r = 0; r < rows; r++) {
          const gap = 1.6 + d * 0.85
          const tileW = Math.max(2.35, 3.05 - d * 0.55)
          const tileD = Math.max(2.5, 3.2 - d * 0.55)
          y += 0.14
          const cz = edgeZ - gap - tileD / 2
          const realSide = rand() > 0.5 ? 1 : 0
          for (let col = 0; col < 2; col++) {
            const isReal = col === realSide
            const ox = col === 0 ? -1.95 : 1.95
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
        const gates = 4 + tier
        const spacing = Math.max(3.6, 4.7 - d * 0.9)
        const len = gates * spacing + 3.6
        const w = Math.max(4.6, 6.4 - d * 1.4)
        const cz = placeSolid(2.0, w, len, 0.2, 0, cB)
        for (let g = 0; g < gates; g++) {
          const gz = cz + len / 2 - 3.3 - g * spacing
          const leftWall = (g + stage) % 2 === 0
          const wallW = w * (0.58 + d * 0.14)
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
        const count = 3 + tier
        for (let i = 0; i < count; i++) {
          const isZ = (i + v) % 2 === 1
          const w = Math.max(2.7, 4.2 - d * 1.2)
          const depth = Math.max(2.7, 4.2 - d * 1.2)
          y += 0.26
          if (isZ) {
            const amp = 1.9 + d * 0.8
            const cz = edgeZ - 2.1 - depth / 2 - amp
            addBlock({
              stage,
              zone: zoneIdx,
              kind: 'moving',
              x,
              y: y - 0.45,
              z: cz,
              w,
              h: 0.9,
              d: depth,
              color: cC,
              moveAxis: 'z',
              moveAmp: amp,
              moveSpeed: 1.25 + d * 1.15,
              movePhase: i * 1.4 + v * 0.5,
            })
            edgeZ = cz - depth / 2 - amp
          } else {
            const cz = edgeZ - (2.0 + d * 0.9) - depth / 2
            addBlock({
              stage,
              zone: zoneIdx,
              kind: 'moving',
              x,
              y: y - 0.45,
              z: cz,
              w,
              h: 0.9,
              d: depth,
              color: cA,
              moveAxis: 'x',
              moveAmp: 2.5 + d * 1.5,
              moveSpeed: 1.25 + d * 1.15,
              movePhase: i * 1.85 + v * 0.4,
            })
            edgeZ = cz - depth / 2
          }
        }
        break
      }

      case 'spinner_arena': {
        const arenas = tier >= 3 ? 2 : 1
        const isCross = tier >= 4
        if (tier >= 2) {
          placePillar(2.0, 3.2, 0.2, 0, cA, 1.3)
        }
        for (let i = 0; i < arenas; i++) {
          const size = Math.max(7.2, (isCross ? 8.8 : 8.2) - d * 0.7)
          const cz = placeSolid(2.2, size, size, 0.3, i === 1 ? turnSign * 2.2 : 0, cB)
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'spinner',
            x,
            y: y + 0.46,
            z: cz,
            w: size - 0.45,
            h: 0.52,
            d: 0.64,
            color: '#EF4444',
            spinnerRadius: (size - 0.45) / 2,
            spinnerSpeed: (i % 2 === 0 ? 1 : -1) * (1.05 + d * 1.45),
            spinnerPhase: stage * 0.7 + i * 1.6,
            spinnerCross: isCross,
          })
        }
        break
      }

      case 'ice_slalom': {
        const segs = 3 + Math.min(3, tier)
        for (let i = 0; i < segs; i++) {
          const gap = 1.9 + d * 1.15
          const segW = Math.max(3.6, 5.2 - d * 1.3)
          const segD = 6.8 + (i % 2) * 0.8
          x = stepXBounded(i === 0 ? 0 : turnSign * (i % 2 === 0 ? -1 : 1) * (2.2 + d * 1.2))
          y += i % 2 === 0 ? -0.15 : 0.22
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
          if (tier >= 2 || i === 1) {
            addBlock({
              stage,
              zone: zoneIdx,
              kind: 'hazard',
              x: x + (i % 2 === 0 ? 0.85 : -0.85),
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
        const segs = 4 + (tier >= 4 ? 2 : 0)
        for (let i = 0; i < segs; i++) {
          if (i % 2 === 0) {
            const beamW = Math.max(1.05, 1.85 - d * 0.72)
            placeSolid(1.85 + d * 0.75, beamW, 7.2 + d * 1.4, 0.22, turnSign * (i === 0 ? 0.8 : -1.2), cA)
          } else {
            const diam = Math.max(2.0, 2.8 - d * 0.65)
            placePillar(2.0 + d * 0.7, diam, 0.3, turnSign * 1.35, cC, 1.4)
          }
        }
        break
      }

      case 'elevator_climb': {
        const lifts = 2 + (tier >= 3 ? 1 : 0)
        for (let i = 0; i < lifts; i++) {
          const w = Math.max(3.2, 4.4 - d * 1.0)
          const depth = w
          const cz = edgeZ - (2.0 + d * 0.6) - depth / 2
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
            d: depth,
            color: i % 2 === 0 ? cA : cC,
            moveAxis: tier >= 3 && i % 2 === 1 ? 'xy' : 'y',
            moveAmp: tier >= 3 && i % 2 === 1 ? 2.1 + d * 0.7 : 1.55,
            moveAmpY: 1.45 + d * 0.3,
            moveSpeed: 1.3 + d * 0.95,
            movePhase: i * 1.6 + v * 0.4,
          })
          y += 1.3
          edgeZ = cz - depth / 2
          placeSolid(2.0 + d * 0.4, Math.max(3.4, 4.5 - d * 0.9), 3.4, 0.1, 0, cB)
        }
        break
      }

      case 'headwind_bridge': {
        const len = 15 + tier * 2.8
        const w = Math.max(3.3, 4.8 - d * 1.2)
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
          conveyorVz: 4.0 + d * 3.8,
        })
        const hurdles = 2 + Math.min(3, tier - 1)
        const step = len / (hurdles + 1)
        for (let h = 1; h <= hurdles; h++) {
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'hazard',
            x,
            y: y + 0.32,
            z: cz + len / 2 - step * h,
            w: w + 0.1,
            h: 0.58,
            d: 0.72,
            color: '#EF4444',
          })
        }
        edgeZ = cz - len / 2
        break
      }

      // ============================================================
      // 21..34 NEW MULTI-MECHANIC COMBO & ADVANCED ARCHETYPES!
      // ============================================================

      case 'zigzag_lasers': {
        // Alternating offset islands with a centered crimson laser hurdle on each island!
        const islands = 4 + Math.min(3, tier)
        for (let i = 0; i < islands; i++) {
          const w = Math.max(2.8, 4.0 - d * 1.0)
          const depth = 4.6
          const dx = i === 0 ? 0 : turnSign * (i % 2 === 0 ? -1 : 1) * (2.2 + d * 1.2)
          const cz = placeSolid(2.0 + d * 1.1, w, depth, 0.28, dx, i % 2 === 0 ? cA : cB)
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'hazard',
            x,
            y: y + 0.32,
            z: cz,
            w: w + 0.12,
            h: 0.62,
            d: 0.68,
            color: '#EF4444',
          })
        }
        break
      }

      case 'twin_towers': {
        // Real 3D spiral tower climbing around a tall decorative core column!
        const steps = 5 + Math.min(3, tier - 1) // 6..8 clean separated spiral ledges
        const radius = 4.9
        const coreX = x
        const coreZ = edgeZ - 2.1 - radius
        const towerH = steps * 1.05 + 3.6
        addBlock({
          stage,
          zone: zoneIdx,
          kind: 'decor',
          x: coreX,
          y: y + towerH / 2 - 1.2,
          z: coreZ,
          w: 3.1,
          h: towerH,
          d: 3.1,
          color: cC,
        })
        const stepSize = Math.max(2.15, 2.7 - d * 0.45)
        for (let i = 0; i < steps; i++) {
          // Clean 180-deg sweep from south (+Z, angle=PI/2) around core to north (-Z, angle=3*PI/2 or -PI/2)
          const theta = Math.PI / 2 + turnSign * (i / (steps - 1)) * Math.PI
          const sx = coreX + Math.cos(theta) * radius
          const sz = coreZ + Math.sin(theta) * radius
          y += 0.72 + d * 0.28
          addBlock({
            stage,
            zone: zoneIdx,
            kind: i % 3 === 2 && tier >= 4 ? 'fade' : 'solid',
            x: sx,
            y: y - 0.4,
            z: sz,
            w: stepSize,
            h: 0.8,
            d: stepSize,
            color: i % 2 === 0 ? cA : cB,
          })
        }
        x = coreX
        edgeZ = coreZ - radius - stepSize / 2
        break
      }

      case 'ice_hurdles': {
        // Slippery ice bridge lined with crimson hurdles — master momentum control!
        const segs = 2 + (tier >= 4 ? 1 : 0)
        for (let s = 0; s < segs; s++) {
          const len = 10.5 + d * 3.5
          const w = Math.max(3.3, 4.6 - d * 1.0)
          const gap = 2.0 + d * 0.75
          x = stepXBounded(s === 0 ? 0 : turnSign * (s % 2 === 0 ? -1.4 : 1.4))
          y += 0.15
          const cz = edgeZ - gap - len / 2
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'ice',
            x,
            y: y - 0.45,
            z: cz,
            w,
            h: 0.9,
            d: len,
            color: '#BAE6FD',
          })
          const hurdles = 2 + (tier >= 4 ? 1 : 0)
          const step = len / (hurdles + 1)
          for (let h = 1; h <= hurdles; h++) {
            addBlock({
              stage,
              zone: zoneIdx,
              kind: 'hazard',
              x,
              y: y + 0.32,
              z: cz + len / 2 - step * h,
              w: w + 0.1,
              h: 0.6,
              d: 0.68,
              color: '#EF4444',
            })
          }
          edgeZ = cz - len / 2
        }
        break
      }

      case 'bouncing_pillars': {
        // Alternating slender round pillar -> trampoline drum -> elevated pillar!
        const pairs = 2 + (tier >= 3 ? 1 : 0)
        for (let i = 0; i < pairs; i++) {
          const pDiam = Math.max(2.2, 3.2 - d * 0.8)
          placePillar(2.1 + d * 0.7, pDiam, 0.35, turnSign * (i % 2 === 0 ? 1.5 : -1.5), cA, 1.8)
          const bDiam = Math.max(2.6, 3.4 - d * 0.6)
          x = stepXBounded(turnSign * (i % 2 === 0 ? -1.7 : 1.7))
          y += 0.45
          const cz = edgeZ - (2.3 + d * 0.7) - bDiam / 2
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'pillar',
            x,
            y: y - 0.6,
            z: cz,
            w: bDiam + 0.4,
            h: 1.1,
            d: bDiam + 0.4,
            color: cB,
          })
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'bounce',
            x,
            y: y + 0.14,
            z: cz,
            w: bDiam - 0.15,
            h: 0.36,
            d: bDiam - 0.15,
            color: '#10B981',
            jumpVel: 17.0 + d * 1.0,
          })
          edgeZ = cz - bDiam / 2
          // Elevated landing island after each bounce
          placeSolid(4.2 + d * 0.8, Math.max(2.8, 3.8 - d * 0.8), 3.6, 1.35, 0, cC)
        }
        break
      }

      case 'fade_bridge_lasers': {
        // Fast disappearing tiles with rhythmic red hurdles — never stop running!
        const tiles = 5 + tier
        const w = Math.max(2.5, 3.6 - d * 0.85)
        for (let i = 0; i < tiles; i++) {
          const tileD = 3.2
          const gap = 1.65 + d * 0.75
          y += 0.18
          const cz = edgeZ - gap - tileD / 2
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'fade',
            x,
            y: y - 0.35,
            z: cz,
            w,
            h: 0.7,
            d: tileD,
            color: i % 2 === 0 ? cA : cB,
          })
          if (i % 2 === 1) {
            addBlock({
              stage,
              zone: zoneIdx,
              kind: 'hazard',
              x,
              y: y + 0.3,
              z: cz,
              w: w + 0.1,
              h: 0.56,
              d: 0.62,
              color: '#EF4444',
            })
          }
          edgeZ = cz - tileD / 2
        }
        break
      }

      case 'moving_hurdles': {
        // Moving horizontal shuttle -> static laser island -> moving shuttle!
        const cycles = 2 + (tier >= 4 ? 1 : 0)
        for (let i = 0; i < cycles; i++) {
          const sw = Math.max(2.8, 3.9 - d * 0.9)
          const czM = edgeZ - (2.1 + d * 0.7) - sw / 2
          y += 0.25
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'moving',
            x,
            y: y - 0.45,
            z: czM,
            w: sw,
            h: 0.9,
            d: sw,
            color: cA,
            moveAxis: 'x',
            moveAmp: 2.6 + d * 1.2,
            moveSpeed: 1.45 + d * 1.0,
            movePhase: i * 1.7,
          })
          edgeZ = czM - sw / 2
          // Static hurdle island between shuttles
          const iw = Math.max(3.2, 4.4 - d * 0.9)
          const czI = placeSolid(2.1 + d * 0.7, iw, 5.2, 0.25, 0, cB)
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'hazard',
            x,
            y: y + 0.32,
            z: czI,
            w: iw + 0.12,
            h: 0.62,
            d: 0.68,
            color: '#EF4444',
          })
        }
        break
      }

      case 'conveyor_pushers': {
        // Conveyor runway with rhythmic side pushers!
        const count = 3 + Math.min(3, tier - 1)
        const spacing = 4.6
        const len = count * spacing + 4.0
        const w = Math.max(3.6, 4.5 - d * 0.7)
        const cz = edgeZ - 2.0 - len / 2
        y += 0.2
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
          color: '#0EA5E9',
          conveyorVx: 0,
          conveyorVz: tier >= 4 ? 3.2 + d * 2.2 : -(3.2 + d * 2.4),
        })
        const wallSide = turnSign
        addBlock({
          stage,
          zone: zoneIdx,
          kind: 'decor',
          x: x + wallSide * (w / 2 + 1.1),
          y: y + 1.5,
          z: cz,
          w: 1.15,
          h: 3.3,
          d: len,
          color: cC,
        })
        for (let i = 0; i < count; i++) {
          const pz = cz + len / 2 - 3.6 - i * spacing
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'pusher',
            x: x + wallSide * (w / 2 - 0.35),
            y: y + 0.95,
            z: pz,
            w: w * 0.78,
            h: 1.65,
            d: 1.6,
            color: '#F97316',
            moveAxis: 'x',
            moveAmp: 1.65,
            moveSpeed: 1.7 + d * 1.25,
            movePhase: i * 1.45,
          })
        }
        edgeZ = cz - len / 2
        break
      }

      case 'ice_spinner_rink': {
        // Slippery glacier arena with rotating crimson sweeper blade (cross-blade on Tier 4+)!
        const rinks = tier >= 4 ? 2 : 1
        const isCross = tier >= 4
        for (let i = 0; i < rinks; i++) {
          const size = Math.max(7.6, 9.0 - d * 0.8)
          const gap = 2.1 + d * 0.6
          x = stepXBounded(i === 0 ? 0 : turnSign * 2.0)
          y += 0.2
          const cz = edgeZ - gap - size / 2
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'ice',
            x,
            y: y - 0.45,
            z: cz,
            w: size,
            h: 0.9,
            d: size,
            color: '#BAE6FD',
          })
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'spinner',
            x,
            y: y + 0.46,
            z: cz,
            w: size - 0.5,
            h: 0.52,
            d: 0.64,
            color: '#EF4444',
            spinnerRadius: (size - 0.5) / 2,
            spinnerSpeed: (i % 2 === 0 ? 1 : -1) * (1.15 + d * 1.15),
            spinnerPhase: stage * 0.5 + i * 1.5,
            spinnerCross: isCross,
          })
          edgeZ = cz - size / 2
        }
        break
      }

      case 'glass_bounce_leap': {
        // Choose the true glass tile, bounce off its spring pad onto the next elevated pair!
        const pairs = 3 + (tier >= 5 ? 1 : 0)
        for (let r = 0; r < pairs; r++) {
          const gap = r === 0 ? 1.8 : 3.9 + d * 0.8
          const tileW = Math.max(2.5, 3.1 - d * 0.45)
          const tileD = 3.2
          y += r === 0 ? 0.15 : 1.05
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
            if (isReal && r < pairs - 1) {
              addBlock({
                stage,
                zone: zoneIdx,
                kind: 'bounce',
                x: x + ox,
                y: y + 0.14,
                z: cz - 0.55,
                w: 1.9,
                h: 0.3,
                d: 1.9,
                color: '#F59E0B',
                jumpVel: 16.2,
              })
            }
          }
          edgeZ = cz - tileD / 2
        }
        break
      }

      case 'pendulum_pillars': {
        // Swinging XY platforms bridged by slender rest pillars!
        const segs = 3 + (tier >= 5 ? 1 : 0)
        for (let i = 0; i < segs; i++) {
          const sw = Math.max(2.9, 3.8 - d * 0.75)
          const cz = edgeZ - (2.1 + d * 0.6) - sw / 2
          y += 0.65
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'moving',
            x,
            y: y - 0.45,
            z: cz,
            w: sw,
            h: 0.9,
            d: sw,
            color: i % 2 === 0 ? cA : cC,
            moveAxis: 'xy',
            moveAmp: 2.3 + d * 1.0,
            moveAmpY: 1.05 + d * 0.35,
            moveSpeed: 1.4 + d * 0.85,
            movePhase: i * 1.9,
          })
          edgeZ = cz - sw / 2
          if (i < segs - 1) {
            placePillar(2.0 + d * 0.5, Math.max(2.2, 3.0 - d * 0.6), 0.35, 0, cB, 1.5)
          }
        }
        break
      }

      case 'lava_pillars_run': {
        // Wide glowing lava floor with elevated circular stepping stones protruding above!
        const stones = 5 + tier
        const spacing = 3.6 + d * 0.65
        const corridorLen = stones * spacing + 2.5
        const corridorW = 7.4
        const startZ = edgeZ - 2.0
        const floorCz = startZ - corridorLen / 2
        // Lava pit bed sits 0.55m below the stone tops
        addBlock({
          stage,
          zone: zoneIdx,
          kind: 'hazard',
          x,
          y: y - 0.85,
          z: floorCz,
          w: corridorW,
          h: 0.6,
          d: corridorLen,
          color: '#EF4444',
        })
        for (let i = 0; i < stones; i++) {
          const diam = Math.max(1.85, 2.85 - d * 0.85)
          const ox = turnSign * (i % 2 === 0 ? -1 : 1) * (1.35 + d * 0.7)
          const sz = startZ - 2.2 - i * spacing
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'pillar',
            x: x + ox,
            y: y - 0.2,
            z: sz,
            w: diam,
            h: 0.9,
            d: diam,
            color: i % 2 === 0 ? cA : cB,
          })
        }
        edgeZ = startZ - corridorLen
        break
      }

      case 'sky_catapult_chain': {
        // High-altitude catapult launchpads firing you onto moving catch platforms & high ledges!
        const launches = 2 + (tier >= 5 ? 1 : 0)
        for (let i = 0; i < launches; i++) {
          const padCz = placeSolid(2.0, 4.4, 4.4, 0.1, 0, cB)
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'jumppad',
            x,
            y: y + 0.16,
            z: padCz - 0.2,
            w: 2.6,
            h: 0.32,
            d: 2.6,
            color: '#0EA5E9',
            jumpVel: 22.8,
          })
          // Catch on a wide moving sky shuttle (or high solid deck on last hop)
          if (i === 0 && tier >= 3) {
            const sw = 4.6
            y += 2.6
            const catchZ = edgeZ - 6.8 - sw / 2
            addBlock({
              stage,
              zone: zoneIdx,
              kind: 'moving',
              x,
              y: y - 0.45,
              z: catchZ,
              w: sw,
              h: 0.9,
              d: sw,
              color: cA,
              moveAxis: 'x',
              moveAmp: 2.0 + d * 0.7,
              moveSpeed: 1.2 + d * 0.6,
              movePhase: i * 1.4,
            })
            edgeZ = catchZ - sw / 2
          } else {
            placeSolid(6.8, Math.max(4.0, 5.2 - d * 0.9), 4.6, 2.6, turnSign * (i % 2 === 0 ? 2.4 : -2.4), cC)
          }
        }
        break
      }

      case 'dual_spinner_catwalk': {
        // Narrow balance beam -> rotating blade island -> narrow beam -> counter-rotating cross-blade!
        const beamW = Math.max(1.25, 1.75 - d * 0.42)
        placeSolid(2.0, beamW, 6.2, 0.2, 0, cA)
        for (let i = 0; i < 2; i++) {
          const size = 7.4
          const cz = placeSolid(2.0, size, size, 0.25, 0, cB)
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'spinner',
            x,
            y: y + 0.46,
            z: cz,
            w: size - 0.5,
            h: 0.52,
            d: 0.64,
            color: '#EF4444',
            spinnerRadius: (size - 0.5) / 2,
            spinnerSpeed: (i === 0 ? 1 : -1) * (1.45 + d * 0.95),
            spinnerPhase: i * 1.8,
            spinnerCross: tier >= 5 || i === 1,
          })
          if (i === 0) {
            placeSolid(2.0, beamW, 6.0, 0.2, 0, cC)
          }
        }
        break
      }

      case 'champion_gauntlet': {
        // STAGE 99 GRAND FINALE — A glorious 5-part mini-gauntlet testing everything before Podium 100!
        // Part 1: Two fast moving shuttles
        for (let i = 0; i < 2; i++) {
          const czM = edgeZ - 2.6 - 1.65
          y += 0.3
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'moving',
            x,
            y: y - 0.45,
            z: czM,
            w: 3.3,
            h: 0.9,
            d: 3.3,
            color: cA,
            moveAxis: 'x',
            moveAmp: 3.0,
            moveSpeed: 2.0,
            movePhase: i * 1.8,
          })
          edgeZ = czM - 1.65
        }
        // Part 2: 3 disappearing speed tiles with a laser hurdle
        for (let i = 0; i < 3; i++) {
          const czF = edgeZ - 2.1 - 1.5
          y += 0.22
          addBlock({
            stage,
            zone: zoneIdx,
            kind: 'fade',
            x,
            y: y - 0.35,
            z: czF,
            w: 3.0,
            h: 0.7,
            d: 3.0,
            color: cB,
          })
          if (i === 1) {
            addBlock({
              stage,
              zone: zoneIdx,
              kind: 'hazard',
              x,
              y: y + 0.32,
              z: czF,
              w: 3.1,
              h: 0.58,
              d: 0.64,
              color: '#EF4444',
            })
          }
          edgeZ = czF - 1.5
        }
        // Part 3: Ice sprint with hurdle -> Launchpad
        const iceCz = edgeZ - 2.2 - 4.5
        y += 0.1
        addBlock({
          stage,
          zone: zoneIdx,
          kind: 'ice',
          x,
          y: y - 0.45,
          z: iceCz,
          w: 4.2,
          h: 0.9,
          d: 9.0,
          color: '#BAE6FD',
        })
        addBlock({
          stage,
          zone: zoneIdx,
          kind: 'hazard',
          x,
          y: y + 0.32,
          z: iceCz + 1.2,
          w: 4.3,
          h: 0.58,
          d: 0.66,
          color: '#EF4444',
        })
        addBlock({
          stage,
          zone: zoneIdx,
          kind: 'jumppad',
          x,
          y: y + 0.16,
          z: iceCz - 2.9,
          w: 2.8,
          h: 0.32,
          d: 2.8,
          color: '#0EA5E9',
          jumpVel: 23.0,
        })
        edgeZ = iceCz - 4.5
        // Part 4: Grand Cross-Blade Summit Arena leading right into Podium 100!
        const arenaCz = placeSolid(6.8, 8.6, 8.6, 2.8, 0, cB)
        addBlock({
          stage,
          zone: zoneIdx,
          kind: 'spinner',
          x,
          y: y + 0.46,
          z: arenaCz,
          w: 8.1,
          h: 0.54,
          d: 0.64,
          color: '#EF4444',
          spinnerRadius: 4.05,
          spinnerSpeed: 1.95,
          spinnerPhase: 0.4,
          spinnerCross: true,
        })
        break
      }
    }

    // Advance cleanly to next checkpoint (`stage + 1`)
    const nextCpD = stage + 1 === 100 ? 20 : 7.6
    const finalGap = 2.1 + d * 0.5
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
