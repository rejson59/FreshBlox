import { PlayerPose } from '../lib/multiplayer'

export interface Vec3Tuple {
  x: number
  y: number
  z: number
}

export interface R6PoseTarget {
  comPos: Vec3Tuple
  comRot: Vec3Tuple
  torsoRot: Vec3Tuple
  headRot: Vec3Tuple
  lArmRot: Vec3Tuple
  rArmRot: Vec3Tuple
  lLegRot: Vec3Tuple
  rLegRot: Vec3Tuple
  scaleY: number
  scaleXZ: number
  snappiness: number
  /** When true, comRot.x/y is applied directly without shortest-angle wrap damping (used for crisp 360°/720° flips & spins) */
  directSpinX?: boolean
  directSpinY?: boolean
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t)
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * Reusable zero-allocation scratch pose target so the 60fps loop triggers ZERO GC.
 */
export function createEmptyPoseTarget(): R6PoseTarget {
  return {
    comPos: { x: 0, y: 0, z: 0 },
    comRot: { x: 0, y: 0, z: 0 },
    torsoRot: { x: 0, y: 0, z: 0 },
    headRot: { x: 0, y: 0, z: 0 },
    lArmRot: { x: 0, y: 0, z: 0 },
    rArmRot: { x: 0, y: 0, z: 0 },
    lLegRot: { x: 0, y: 0, z: 0 },
    rLegRot: { x: 0, y: 0, z: 0 },
    scaleY: 1,
    scaleXZ: 1,
    snappiness: 14,
    directSpinX: false,
    directSpinY: false,
  }
}

function resetTarget(out: R6PoseTarget) {
  out.comPos.x = 0
  out.comPos.y = 0
  out.comPos.z = 0
  out.comRot.x = 0
  out.comRot.y = 0
  out.comRot.z = 0
  out.torsoRot.x = 0
  out.torsoRot.y = 0
  out.torsoRot.z = 0
  out.headRot.x = 0
  out.headRot.y = 0
  out.headRot.z = 0
  out.lArmRot.x = 0
  out.lArmRot.y = 0
  out.lArmRot.z = 0
  out.rArmRot.x = 0
  out.rArmRot.y = 0
  out.rArmRot.z = 0
  out.lLegRot.x = 0
  out.lLegRot.y = 0
  out.lLegRot.z = 0
  out.rLegRot.x = 0
  out.rLegRot.y = 0
  out.rLegRot.z = 0
  out.scaleY = 1
  out.scaleXZ = 1
  out.snappiness = 15
  out.directSpinX = false
  out.directSpinY = false
}

/**
 * Viral-grade procedural R6 animation evaluator.
 * Uses anticipation, squash & stretch, follow-through, counter-rotation, and phase choreography.
 * All flips & spins rotate around Center of Mass (`comPivot` at y=1.72) with generous apex clearance — ZERO floor clipping!
 */
export function evaluateR6Pose(
  pose: PlayerPose,
  elapsed: number,
  poseTime: number,
  landingImpact: number, // 0..1 decaying right after landing from jump/fall
  out: R6PoseTarget,
): void {
  resetTarget(out)

  if (pose === 'idle') {
    // Stylish Pro Roblox Idle: asymmetric heroic stance, chest breathe, hip weight shift, natural glance
    const breathe = Math.sin(elapsed * 2.4)
    const sway = Math.sin(elapsed * 1.2)
    const glance = Math.sin(elapsed * 0.75) * Math.sin(elapsed * 0.35)

    out.comPos.x = sway * 0.045
    out.comPos.y = breathe * 0.032
    out.comRot.z = -sway * 0.025

    out.torsoRot.y = -0.17 + sway * 0.05
    out.torsoRot.x = 0.025 + breathe * 0.02
    out.torsoRot.z = sway * 0.03

    out.headRot.y = 0.16 + glance * 0.22
    out.headRot.x = -0.02 - breathe * 0.03
    out.headRot.z = -sway * 0.04

    // Confident slightly angled arms
    out.lArmRot.x = 0.08 + breathe * 0.06
    out.lArmRot.z = 0.11 + breathe * 0.025
    out.lArmRot.y = 0.12

    out.rArmRot.x = -0.08 - breathe * 0.06
    out.rArmRot.z = -0.12 - breathe * 0.025
    out.rArmRot.y = -0.1

    // Grounded asymmetric athletic foot stance
    out.lLegRot.x = 0.07
    out.lLegRot.z = 0.05
    out.lLegRot.y = 0.12

    out.rLegRot.x = -0.09
    out.rLegRot.z = -0.06
    out.rLegRot.y = -0.16

    out.scaleY = 1 + breathe * 0.012
    out.scaleXZ = 1 - breathe * 0.006
    out.snappiness = 12
  } else if (pose === 'walk') {
    // Snappy Stylised Walk: bouncy stride, pelvis-vs-torso counter-twist, swinging arms with swagger
    const w = elapsed * 8.8
    const s = Math.sin(w)
    const c = Math.cos(w)
    const bounce = Math.abs(s)

    out.comPos.y = bounce * 0.12
    out.comPos.x = c * 0.04
    out.comRot.z = -c * 0.045

    out.torsoRot.x = 0.09
    out.torsoRot.y = -s * 0.22
    out.torsoRot.z = c * 0.04

    out.headRot.y = s * 0.14
    out.headRot.x = -0.06 + Math.sin(w * 2 - 0.5) * 0.045
    out.headRot.z = -c * 0.03

    out.lArmRot.x = s * 0.78
    out.lArmRot.z = 0.11 + Math.max(0, -s) * 0.08
    out.lArmRot.y = s * 0.14

    out.rArmRot.x = -s * 0.78
    out.rArmRot.z = -0.11 - Math.max(0, s) * 0.08
    out.rArmRot.y = -s * 0.14

    out.lLegRot.x = -s * 0.74
    out.lLegRot.z = 0.03
    out.rLegRot.x = s * 0.74
    out.rLegRot.z = -0.03

    out.scaleY = 1 + (bounce - 0.5) * 0.045
    out.scaleXZ = 1 - (bounce - 0.5) * 0.02
    out.snappiness = 18
  } else if (pose === 'run') {
    // High-Energy Anime / Parkour Pro Sprint
    const r = elapsed * 13.6
    const s = Math.sin(r)
    const c = Math.cos(r)
    const lift = Math.pow(Math.abs(s), 0.75)

    out.comPos.y = lift * 0.22 - 0.04
    out.comPos.x = c * 0.06
    out.comRot.z = -c * 0.08

    out.torsoRot.x = 0.32 + Math.abs(c) * 0.05
    out.torsoRot.y = -s * 0.34
    out.torsoRot.z = c * 0.07

    out.headRot.x = -0.24
    out.headRot.y = s * 0.24
    out.headRot.z = -c * 0.05

    // Powerful driving sprint arms across torso
    out.lArmRot.x = s * 1.28 - 0.15
    out.lArmRot.z = 0.18 + Math.abs(s) * 0.12
    out.lArmRot.y = 0.25 + s * 0.22

    out.rArmRot.x = -s * 1.28 - 0.15
    out.rArmRot.z = -0.18 - Math.abs(s) * 0.12
    out.rArmRot.y = -0.25 - s * 0.22

    // Explosive scissor sprint stride
    out.lLegRot.x = -s * 1.12
    out.lLegRot.z = 0.05
    out.rLegRot.x = s * 1.12
    out.rLegRot.z = -0.05

    out.scaleY = 1 + (lift - 0.5) * 0.07
    out.scaleXZ = 1 - (lift - 0.5) * 0.032
    out.snappiness = 22
  } else if (pose === 'jump') {
    // Expressive Athletic Ninja/Toy Jump Silhouette
    const t = clamp01(poseTime / 0.22)
    const pop = easeOutBack(t)
    const hover = Math.sin(poseTime * 7) * 0.05

    out.comPos.y = 0.12 + hover
    out.torsoRot.x = -0.14 * pop
    out.torsoRot.y = 0.16

    out.headRot.x = -0.12
    out.headRot.y = -0.14

    out.lArmRot.x = -2.35 * pop
    out.lArmRot.z = 0.36
    out.rArmRot.x = -1.95 * pop
    out.rArmRot.z = -0.44

    // Heroic tucked knee + swept trail leg
    out.lLegRot.x = -0.82 * pop
    out.lLegRot.z = 0.1
    out.rLegRot.x = 0.54 * pop
    out.rLegRot.z = -0.1

    out.scaleY = 1.06 - t * 0.03
    out.scaleXZ = 0.96 + t * 0.02
    out.snappiness = 20
  } else if (pose === 'fall') {
    // Wind-catching dynamic fall with light leg kick & balance arms
    const f = elapsed * 10
    out.comRot.x = 0.1
    out.torsoRot.x = 0.08
    out.headRot.x = 0.18

    out.lArmRot.x = -2.42 + Math.sin(f) * 0.18
    out.lArmRot.z = 0.58 + Math.cos(f) * 0.12
    out.rArmRot.x = -2.42 - Math.sin(f) * 0.18
    out.rArmRot.z = -0.58 - Math.cos(f) * 0.12

    out.lLegRot.x = -0.32 + Math.sin(f * 0.85) * 0.26
    out.lLegRot.z = 0.14
    out.rLegRot.x = -0.12 - Math.sin(f * 0.85) * 0.26
    out.rLegRot.z = -0.14

    out.scaleY = 1.03
    out.scaleXZ = 0.98
    out.snappiness = 15
  } else if (pose === 'wave') {
    // Charismatic Friendly Double-Wave with hip pop & head tilt
    const intro = easeOutBack(clamp01(poseTime / 0.28))
    const w = Math.sin(poseTime * 13.5)
    const groove = Math.sin(poseTime * 4.5)

    out.comPos.x = -0.12 * intro
    out.comPos.y = Math.abs(groove) * 0.06
    out.comRot.z = -0.08 * intro

    out.torsoRot.z = 0.08 * intro
    out.torsoRot.y = -0.14 * intro

    out.headRot.z = 0.2 * intro + w * 0.04
    out.headRot.y = 0.16 * intro

    // Left hand confidently on hip
    out.lArmRot.x = -0.32 * intro
    out.lArmRot.z = 0.52 * intro
    out.lArmRot.y = 0.35 * intro

    // Right arm crisp high wave
    out.rArmRot.x = -2.72 * intro
    out.rArmRot.z = (-0.42 + w * 0.42) * intro
    out.rArmRot.y = -0.2 * intro

    // Relaxed hip-popped stance
    out.lLegRot.z = 0.09 * intro
    out.rLegRot.z = -0.12 * intro
    out.rLegRot.x = -0.08 * intro

    out.snappiness = 18
  } else if (pose === 'dance') {
    // VIRAL 4-BAR "FRESH GROOVE / STURDY SHUFFLE" CHOREOGRAPHY (3.2s seamless loop, 150 BPM!)
    const loopDur = 3.2
    const phase = (poseTime % loopDur) / loopDur // 0..1 across 8 beats
    const beat = phase * 8 // 0..8
    const bFrac = beat % 1
    // Punchy downbeat drop curve: sharp snap down on beat, bouncy rebound!
    const beatDrop = Math.sin(bFrac * Math.PI)
    const hitBounce = Math.pow(beatDrop, 0.7)

    if (beat < 2) {
      // BAR 1 (Beats 0-2): Crisp Side-to-Side Sturdy Step + Cross-Chest Groove
      const dir = beat < 1 ? 1 : -1
      const stepCurve = easeOutQuad(bFrac)

      out.comPos.x = dir * (0.28 * Math.sin(stepCurve * Math.PI))
      out.comPos.y = -0.16 * (1 - beatDrop) + 0.14 * hitBounce
      out.comRot.z = -dir * 0.12 * hitBounce

      out.torsoRot.y = dir * 0.34 * hitBounce
      out.torsoRot.x = 0.14 * (1 - hitBounce)
      out.torsoRot.z = dir * 0.14 * hitBounce

      out.headRot.x = 0.18 * (1 - beatDrop) - 0.08
      out.headRot.y = -dir * 0.24 * hitBounce
      out.headRot.z = dir * 0.12

      // Alternating crisp punch + cross-body swing
      out.lArmRot.x = dir > 0 ? -1.45 * hitBounce - 0.3 : -0.55
      out.lArmRot.z = dir > 0 ? 0.55 : 0.22
      out.lArmRot.y = dir > 0 ? 0.45 : -0.35

      out.rArmRot.x = dir < 0 ? -1.45 * hitBounce - 0.3 : -0.55
      out.rArmRot.z = dir < 0 ? -0.55 : -0.22
      out.rArmRot.y = dir < 0 ? -0.45 : 0.35

      // Footwork kicks & wide sturdy steps
      out.lLegRot.x = dir > 0 ? -0.55 * hitBounce : 0.28 * hitBounce
      out.lLegRot.z = dir > 0 ? 0.28 * hitBounce : 0.06
      out.rLegRot.x = dir < 0 ? -0.55 * hitBounce : 0.28 * hitBounce
      out.rLegRot.z = dir < 0 ? -0.28 * hitBounce : -0.06

      out.scaleY = 0.94 + hitBounce * 0.1
      out.scaleXZ = 1.04 - hitBounce * 0.05
    } else if (beat < 4) {
      // BAR 2 (Beats 2-4): Viral Hype Alternating Sky-Punches + Knee Dip
      const alt = beat < 3 ? 1 : -1
      const snap = easeOutBack(clamp01(bFrac * 1.4))

      out.comPos.y = -0.18 * (1 - beatDrop) + 0.18 * hitBounce
      out.torsoRot.x = -0.06 + 0.18 * (1 - hitBounce)
      out.torsoRot.y = alt * 0.42 * snap
      out.torsoRot.z = -alt * 0.16 * snap

      out.headRot.x = -0.1 + 0.22 * (1 - beatDrop)
      out.headRot.y = -alt * 0.26 * snap

      // One arm punches sky-high, other snaps down to hip!
      out.lArmRot.x = alt > 0 ? -2.65 * snap : 0.45 * snap
      out.lArmRot.z = alt > 0 ? 0.42 : 0.25
      out.rArmRot.x = alt < 0 ? -2.65 * snap : 0.45 * snap
      out.rArmRot.z = alt < 0 ? -0.42 : -0.25

      out.lLegRot.x = alt > 0 ? -0.36 * hitBounce : 0.22
      out.lLegRot.z = 0.22
      out.rLegRot.x = alt < 0 ? -0.36 * hitBounce : 0.22
      out.rLegRot.z = -0.22

      out.scaleY = 0.93 + hitBounce * 0.12
      out.scaleXZ = 1.05 - hitBounce * 0.06
    } else if (beat < 6) {
      // BAR 3 (Beats 4-6): Silky Glide Shuffle + Wave Arms
      const p = (beat - 4) / 2 // 0..1
      const glide = Math.sin(p * Math.PI * 2)
      const foot = Math.sin(p * Math.PI * 4)

      out.comPos.x = glide * 0.34
      out.comPos.y = Math.abs(foot) * 0.16 - 0.04
      out.comRot.z = -glide * 0.14

      out.torsoRot.y = glide * 0.36
      out.torsoRot.z = glide * 0.15
      out.headRot.y = -glide * 0.22
      out.headRot.z = -glide * 0.16

      out.lArmRot.x = -1.35 + Math.sin(p * Math.PI * 4) * 0.55
      out.lArmRot.z = 0.85 + Math.cos(p * Math.PI * 4) * 0.32
      out.rArmRot.x = -1.35 - Math.sin(p * Math.PI * 4) * 0.55
      out.rArmRot.z = -0.85 - Math.cos(p * Math.PI * 4) * 0.32

      out.lLegRot.x = foot * 0.65
      out.lLegRot.z = 0.18 + Math.max(0, foot) * 0.22
      out.rLegRot.x = -foot * 0.65
      out.rLegRot.z = -0.18 - Math.max(0, -foot) * 0.22

      out.scaleY = 0.97 + Math.abs(foot) * 0.06
      out.scaleXZ = 1.02 - Math.abs(foot) * 0.03
    } else {
      // BAR 4 (Beats 6-8): 360° Flair Spin + Drop Pose Finisher!
      const p = (beat - 6) / 2 // 0..1
      if (p < 0.68) {
        const sp = easeInOutCubic(p / 0.68)
        const hop = Math.sin((p / 0.68) * Math.PI)
        out.comPos.y = hop * 0.52
        out.comRot.y = sp * Math.PI * 2
        out.directSpinY = true
        out.comRot.z = 0.14 * hop

        out.lArmRot.x = -1.2
        out.lArmRot.z = 1.15
        out.rArmRot.x = -1.2
        out.rArmRot.z = -1.15

        out.lLegRot.x = -0.45 * hop
        out.rLegRot.x = 0.32 * hop
        out.scaleY = 1 + hop * 0.08
        out.scaleXZ = 1 - hop * 0.04
      } else {
        // Juicy beat-drop finisher!
        const dp = (p - 0.68) / 0.32
        const settle = Math.sin(dp * Math.PI)
        out.comPos.y = -0.22 * settle
        out.comRot.y = 0
        out.directSpinY = true
        out.torsoRot.x = 0.2 * settle
        out.headRot.x = -0.16 * settle

        out.lArmRot.x = -1.75
        out.lArmRot.z = 0.65
        out.rArmRot.x = -1.75
        out.rArmRot.z = -0.65

        out.lLegRot.z = 0.24
        out.rLegRot.z = -0.24
        out.scaleY = 1 - 0.1 * settle
        out.scaleXZ = 1 + 0.06 * settle
      }
    }
    out.snappiness = 24
  } else if (pose === 'cheer') {
    // Explosive Star-Jump Victory Celebration (1.2s choreographed cycle)
    const p = (poseTime % 1.2) / 1.2
    if (p < 0.2) {
      // Anticipation crouch
      const t = easeOutQuad(p / 0.2)
      out.comPos.y = -0.22 * t
      out.torsoRot.x = 0.25 * t
      out.lArmRot.x = 0.65 * t
      out.rArmRot.x = 0.65 * t
      out.lLegRot.x = -0.38 * t
      out.rLegRot.x = -0.38 * t
      out.scaleY = 1 - 0.09 * t
      out.scaleXZ = 1 + 0.05 * t
    } else if (p < 0.72) {
      // High Star-Jump apex!
      const t = (p - 0.2) / 0.52
      const arc = Math.sin(t * Math.PI)
      out.comPos.y = arc * 1.05
      out.torsoRot.x = -0.14 * arc
      out.headRot.x = -0.18 * arc

      out.lArmRot.x = -2.85 * arc
      out.lArmRot.z = 0.68 * arc
      out.rArmRot.x = -2.85 * arc
      out.rArmRot.z = -0.68 * arc

      out.lLegRot.z = 0.52 * arc
      out.rLegRot.z = -0.52 * arc
      out.lLegRot.x = -0.18 * arc
      out.rLegRot.x = -0.18 * arc

      out.scaleY = 1 + 0.08 * arc
      out.scaleXZ = 1 - 0.04 * arc
    } else {
      // Cushioned landing + triumphant fist pump
      const t = (p - 0.72) / 0.28
      const impact = Math.sin(t * Math.PI)
      out.comPos.y = -0.18 * impact
      out.torsoRot.x = 0.14 * impact
      out.lArmRot.x = -2.35 + impact * 0.45
      out.lArmRot.z = 0.35
      out.rArmRot.x = -2.35 + impact * 0.45
      out.rArmRot.z = -0.35
      out.lLegRot.z = 0.16
      out.rLegRot.z = -0.16
      out.scaleY = 1 - 0.08 * impact
      out.scaleXZ = 1 + 0.05 * impact
    }
    out.snappiness = 22
  } else if (pose === 'sit') {
    // Relaxed Hangout Chill Sit (grounded hips, casually swinging legs, propping arms)
    const ease = easeOutQuad(clamp01(poseTime / 0.35))
    const swing = Math.sin(elapsed * 2.6)
    const glance = Math.sin(elapsed * 1.1)

    out.comPos.y = -0.68 * ease
    out.torsoRot.x = -0.18 * ease
    out.headRot.y = glance * 0.24 * ease
    out.headRot.x = 0.1 * ease

    // Arms angled slightly back resting comfortably
    out.lArmRot.x = 0.36 * ease
    out.lArmRot.z = 0.28 * ease
    out.rArmRot.x = 0.36 * ease
    out.rArmRot.z = -0.28 * ease

    // Legs kicked forward swinging lazily
    out.lLegRot.x = (-1.45 + swing * 0.14) * ease
    out.lLegRot.z = 0.12 * ease
    out.rLegRot.x = (-1.45 - swing * 0.14) * ease
    out.rLegRot.z = -0.12 * ease

    out.snappiness = 14
  } else if (pose === 'spin') {
    // Pro Breakdance 720° Tornado Flair Spin (1.45s choreographed cycle)
    const dur = 1.45
    const p = (poseTime % dur) / dur

    if (p < 0.18) {
      // Coil wind-up!
      const t = easeOutQuad(p / 0.18)
      out.comPos.y = -0.22 * t
      out.comRot.y = -0.55 * t
      out.directSpinY = true
      out.torsoRot.x = 0.24 * t
      out.lArmRot.x = -0.8 * t
      out.lArmRot.z = 0.35 * t
      out.rArmRot.x = 0.65 * t
      out.rArmRot.z = -0.4 * t
      out.lLegRot.x = -0.35 * t
      out.rLegRot.x = 0.22 * t
      out.scaleY = 1 - 0.08 * t
      out.scaleXZ = 1 + 0.05 * t
    } else if (p < 0.78) {
      // Airborne 720° Tornado Spin with extended flair kick!
      const t = (p - 0.18) / 0.6
      const spinEase = easeInOutCubic(t)
      const arc = Math.sin(t * Math.PI)

      out.comPos.y = arc * 0.98
      out.comRot.y = mix(-0.55, Math.PI * 4, spinEase)
      out.directSpinY = true
      out.comRot.z = 0.22 * arc

      out.torsoRot.x = -0.1 * arc
      out.lArmRot.x = -1.45
      out.lArmRot.z = 1.25 * arc + 0.2
      out.rArmRot.x = -1.45
      out.rArmRot.z = -1.25 * arc - 0.2

      // One leg extended in tornado kick, other tucked!
      out.lLegRot.x = -1.15 * arc
      out.lLegRot.z = 0.42 * arc
      out.rLegRot.x = 0.48 * arc
      out.rLegRot.z = -0.18 * arc

      out.scaleY = 1 + 0.07 * arc
      out.scaleXZ = 1 - 0.035 * arc
    } else {
      // Cushioned superhero landing settle!
      const t = (p - 0.78) / 0.22
      const impact = Math.sin(t * Math.PI)
      out.comPos.y = -0.22 * impact
      out.comRot.y = 0
      out.directSpinY = true
      out.torsoRot.x = 0.22 * impact
      out.headRot.x = -0.16 * impact
      out.lArmRot.x = -0.45 * impact
      out.lArmRot.z = 0.62 * impact + 0.12
      out.rArmRot.x = -0.45 * impact
      out.rArmRot.z = -0.62 * impact - 0.12
      out.lLegRot.z = 0.2 * impact
      out.rLegRot.z = -0.2 * impact
      out.scaleY = 1 - 0.1 * impact
      out.scaleXZ = 1 + 0.06 * impact
    }
    out.snappiness = 24
  } else if (pose === 'backflip') {
    // PRO PARKOUR BACKFLIP — Anticipation Squat → Explosive Launch → High-Apex Tight Tuck (-360°) → Superhero Landing!
    // Center of mass (`comPivot` at y=1.72) lifts up to +1.78 (world y=3.50!), guaranteeing 100% clearance above the floor!
    const dur = 1.75
    const p = (poseTime % dur) / dur

    if (p < 0.2) {
      // Phase 1: Coiled Anticipation Squat (feet planted, arms swing BACK!)
      const t = easeOutQuad(p / 0.2)
      out.comPos.y = -0.24 * t
      out.comRot.x = 0
      out.directSpinX = true

      out.torsoRot.x = 0.42 * t
      out.headRot.x = -0.3 * t

      out.lArmRot.x = 1.32 * t
      out.lArmRot.z = 0.22 * t
      out.rArmRot.x = 1.32 * t
      out.rArmRot.z = -0.22 * t

      out.lLegRot.x = -0.42 * t
      out.lLegRot.z = 0.1 * t
      out.rLegRot.x = -0.42 * t
      out.rLegRot.z = -0.1 * t

      out.scaleY = 1 - 0.08 * t
      out.scaleXZ = 1 + 0.05 * t
    } else if (p < 0.76) {
      // Phase 2 & 3: Explosive Takeoff → High-Apex Tight Tuck Full -360° Flip → Open-Out!
      const t = (p - 0.2) / 0.56 // 0..1 airborne window
      // Parabolic jump arc peaking at +1.78 above rest (world COM y = 3.50!)
      const heightArc = 4 * t * (1 - t)
      const tuck = Math.sin(clamp01((t - 0.08) / 0.78) * Math.PI) // tightest in midair!

      out.comPos.y = mix(-0.24, 0, clamp01(t * 5)) + heightArc * 1.78
      // Smooth full backward -2π rotation around Center of Mass!
      out.comRot.x = -easeInOutCubic(t) * Math.PI * 2
      out.directSpinX = true

      out.torsoRot.x = -0.24 * (1 - tuck) + 0.15 * tuck
      out.headRot.x = -0.38 * (1 - tuck)

      // Launch arms whip high overhead, then hug tight into the tuck, then open for landing
      out.lArmRot.x = mix(-2.75, -1.25, tuck)
      out.lArmRot.z = mix(0.45, 0.14, tuck)
      out.rArmRot.x = mix(-2.75, -1.25, tuck)
      out.rArmRot.z = mix(-0.45, -0.14, tuck)

      // Tight mid-air tuck knees -> crisp landing extension!
      out.lLegRot.x = -1.25 * tuck + 0.15 * (1 - tuck)
      out.lLegRot.z = 0.08
      out.rLegRot.x = -1.25 * tuck + 0.15 * (1 - tuck)
      out.rLegRot.z = -0.08

      // Stretch on takeoff, compact on apex tuck
      out.scaleY = 1 + (1 - tuck) * 0.08 - tuck * 0.04
      out.scaleXZ = 1 - (1 - tuck) * 0.04 + tuck * 0.03
    } else if (p < 0.9) {
      // Phase 4: Juicy Cushioned Superhero Landing Impact!
      const t = (p - 0.76) / 0.14
      const impact = Math.sin(t * Math.PI)
      out.comPos.y = -0.26 * impact
      out.comRot.x = 0
      out.directSpinX = true

      out.torsoRot.x = 0.34 * impact
      out.headRot.x = -0.24 * impact

      out.lArmRot.x = -0.55 * impact
      out.lArmRot.z = 0.72 * impact + 0.12
      out.rArmRot.x = -0.55 * impact
      out.rArmRot.z = -0.72 * impact - 0.12

      out.lLegRot.x = -0.4 * impact
      out.lLegRot.z = 0.22 * impact + 0.06
      out.rLegRot.x = -0.4 * impact
      out.rLegRot.z = -0.22 * impact - 0.06

      out.scaleY = 1 - 0.11 * impact
      out.scaleXZ = 1 + 0.07 * impact
    } else {
      // Phase 5: Confident Heroic Stand-Up Settle
      const t = easeOutBack((p - 0.9) / 0.1)
      out.comPos.y = 0
      out.comRot.x = 0
      out.directSpinX = true
      out.torsoRot.y = -0.16 * t
      out.headRot.y = 0.16 * t
      out.lArmRot.z = 0.12
      out.rArmRot.z = -0.12
      out.lLegRot.z = 0.06
      out.rLegRot.z = -0.06
    }
    out.snappiness = 26
  }

  // Apply automatic juicy Landing Squash overlay whenever touching down from a jump/fall!
  if (landingImpact > 0.005 && pose !== 'jump' && pose !== 'fall' && pose !== 'backflip') {
    const k = Math.sin(landingImpact * Math.PI)
    out.comPos.y -= 0.22 * k
    out.torsoRot.x += 0.22 * k
    out.lArmRot.z += 0.35 * k
    out.rArmRot.z -= 0.35 * k
    out.lLegRot.x -= 0.26 * k
    out.rLegRot.x -= 0.26 * k
    out.scaleY *= 1 - 0.1 * k
    out.scaleXZ *= 1 + 0.06 * k
  }
}
