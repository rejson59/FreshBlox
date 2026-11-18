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
  index: number // 0..4
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
  zone: number // 0..4
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
  zone: number // 0..4
  titlePl: string
  titleEn: string
  x: number
  y: number // top surface y
  z: number
  spawnY: number
  facingAngle: number
}

import { routes } from './parkour/routes.ts'

export const STAGES_PER_WORLD = 100
export const worldOf = (stage: number) => Math.floor((Math.max(1, Math.min(500, stage)) - 1) / STAGES_PER_WORLD)
export interface Gate { stage: number; zone: number; x: number; y: number; z: number; to: number | null }
export interface ObbyCourseData {
  zones: typeof OBBY_ZONES
  blocks: ObbyBlockDef[]
  checkpoints: ObbyCheckpointDef[]
  gates: Gate[]
}
export const OBBY_ZONES = [
  ['Lazurowe Wyspy', 'Azure Isles', 'Łatwy', 'Easy', '#ffba18', '#ff7545', '#ff6080', '#98e58a', '#43d9df', '#fff0b4'],
  ['Kanion Wiatraków', 'Windmill Canyon', 'Umiarkowany', 'Moderate', '#ed9852', '#e77549', '#ffde81', '#79bb83', '#73c9dc', '#ffe0a6'],
  ['Szklany Lodowiec', 'Glass Glacier', 'Trudny', 'Hard', '#6fcded', '#82efec', '#bb93ef', '#e2faff', '#87c5f0', '#e1deff'],
  ['Kuźnia Zegarów', 'Clockwork Forge', 'Ekspert', 'Expert', '#bd7350', '#ffa653', '#ffd577', '#6a9c9d', '#a57080', '#ffd5a3'],
  ['Gwiezdne Iglice', 'Star Spires', 'Mistrz', 'Master', '#876dca', '#5eb8da', '#ef8bd0', '#f6c66c', '#26234f', '#987eac'],
].map(([namePl,nameEn,difficultyPl,difficultyEn,primary,secondary,accent,trim,sky,horizon],index) => ({
  index, startStage: index * STAGES_PER_WORLD + 1, endStage: (index + 1) * STAGES_PER_WORLD, difficultyTier: (index + 1) as ObbyDifficultyTier,
  namePl,nameEn,difficultyPl,difficultyEn,difficultyColor: accent,primary,secondary,accent,trim,sky,horizon,
}))

/** Width tolerance, gap distance and moving-platform speed tighten continuously, including at world boundaries. */
export function tuning(stage: number) {
  const f = (stage - 1) / 499
  return { gap: 1.25 + 2.95*f, pad: 4.8 - 1.95*f, lateral: 2.35 + 1.35*f, tempo: .8 + 1.02*f }
}
export function nextCheckpoint(current: number, landed: number) {
  return landed === current + 1 && worldOf(current) === worldOf(landed) && landed <= 500
}
/** At a world end the exit island is not itself a checkpoint. Walk into the aperture. */
export function enteredGate(g: Gate, stage: number, p: { x: number; y: number; z: number }) {
  return stage === g.stage && Math.abs(p.x-g.x) <= 2.25 && Math.abs(p.z-g.z) <= .85 && p.y >= g.y-.15 && p.y <= g.y+4.05
}
export function generateTestObbyCourse(): ObbyCourseData {
  const blocks: ObbyBlockDef[] = [], checkpoints: ObbyCheckpointDef[] = [], gates: Gate[] = []
  for (const zone of OBBY_ZONES) {
    // Independent spaces, also distinct in the multiplayer coordinate system.
    let x = zone.index * 2000, y = 0, z = 0
    const palette = [zone.primary, zone.secondary, zone.accent, zone.trim]
    Array.from({length:STAGES_PER_WORLD}, (_, idx) => {
      const [pl,en,base] = routes[zone.index][idx % 20]
      const variation=Math.floor(idx / 20)
      const beats=base.split(' ')
      // Re-order the obstacle sequence, not merely its colours or spacing.
      const shift=variation ? (variation * 2 + idx % 3) % beats.length : 0
      const reordered=[...beats.slice(shift),...beats.slice(0,shift)]
      const extra = ['','t','g o','f a z','p c e k'][variation]
      return [variation ? `${pl} · ${variation+1}` : pl, variation ? `${en} · ${variation+1}` : en, variation ? `${reordered.join(' ')} ${extra}` : base] as const
    }).forEach(([titlePl, titleEn, score], idx) => {
      const stage = zone.startStage + idx
      const {gap,pad,lateral,tempo} = tuning(stage)
      let serial = 0
      function block(kind: ObbyBlockKind, cx: number, top: number, cz: number, w: number,h: number,d: number,color: string,extra?: Partial<ObbyBlockDef>) {
        blocks.push({id:`${stage}:${serial++}`, stage,zone:zone.index,kind,x:cx,y:top-h/2,z:cz,w,h,d,color,...extra})
      }
      const cpSize = 8
      checkpoints.push({stage,zone:zone.index,titlePl,titleEn,x,y,z,spawnY:y+.07,facingAngle:Math.PI})
      block('checkpoint',x,y,z,cpSize,2.1,cpSize,zone.trim,{checkpointStage:stage})
      let edge = z-cpSize/2, previous = '', prevW=cpSize, prevD=cpSize
      for (const [i,token] of score.split(' ').entries()) {
        const beat = token.slice(-1), direction = token[0] === '>' ? 1 : token[0] === '<' ? -1 : 0
        const color = palette[(i+idx)%4]
        let kind: ObbyBlockKind = 'solid', w=pad, d=pad, h=pad*.65
        const extra: Partial<ObbyBlockDef> = {}
        if (beat === 'n') {w=pad*.65;d=pad*.9}
        if (beat === 'a') {w=pad*.58;d=pad*1.65}
        if (beat === 'o' || beat === 'b') {kind=beat==='o'?'pillar':'bounce';w=d=pad*.9;h=beat==='o'?3.6:1.4; extra.jumpVel=17.8}
        if (beat==='j') {kind='jumppad';extra.jumpVel=19.5}
        if (beat==='f') kind='fade'
        if (beat==='i') {kind='ice';d+=1}
        if ('tze'.includes(beat)) {
          kind='moving';extra.moveAxis=beat==='t'?'x':beat==='z'?'z':'y';extra.moveAmp=beat==='e'?.68:1.1;extra.movePhase=i*1.7;extra.moveSpeed=tempo
        }
        if (beat==='k'||beat==='h') {kind='conveyor';extra.conveyorVx=beat==='h'?(direction||1)*2.2*tempo:0;extra.conveyorVz=beat==='k'?-2.1*tempo:0;d+=1.8}
        if ('vgcp'.includes(beat)) {w=6.4;d=8.8}
        if (beat==='w') {w+=2;d+=1.2}
        if (beat==='q') {w=pad*.6;d=pad+1}
        const turn=token.length===3
        x+=direction*(turn?(prevW+w)/2+gap:lateral*1.27)
        y+=previous==='j'?2.8:previous==='b'?1.8:beat==='u'?.8:beat==='d'?-.67:0
        z=turn?z-(prevD+d)*.19:edge-gap-d/2-(previous==='j'?1.8:0); edge=z-d/2
        prevW=w;prevD=d
        block(kind,x-(beat==='q'?pad*.44:0),y,z,w,h,d,color,extra)
        if(beat==='q') block('pillar',x+pad*.44,y+.12,z,w,2.8,w,zone.secondary)
        if(beat==='g') block('hazard',x,y+.54,z,w-.3,.54,.52,'#e83847')
        if(beat==='p') block('pusher',x,y+2.0,z,2,2,.68,'#f08d41',{moveAxis:'x',moveAmp:2.35,moveSpeed:tempo,movePhase:i})
        if(beat==='v'||beat==='c') block('spinner',x,y+.56,z,6.15,.38,.42,'#ee4262',{spinnerRadius:3.075,spinnerCross:beat==='c',spinnerSpeed:tempo,spinnerPhase:i*.8})
        previous=beat
      }
      z=edge-gap-cpSize/2
      if (stage === zone.endStage) {
        block('solid',x,y,z,10,2.2,cpSize,zone.trim)
        gates.push({stage,zone:zone.index,x,y,z:z-.9,to:stage===500?null:stage+1})
      }
    })
  }
  return {zones:OBBY_ZONES,blocks,checkpoints,gates}
}
