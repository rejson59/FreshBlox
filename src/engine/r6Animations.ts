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
    snappiness: 15,
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
  out.lArmRot.z = -0.04
  out.rArmRot.x = 0
  out.rArmRot.y = 0
  out.rArmRot.z = 0.04
  out.lLegRot.x = 0
  out.lLegRot.y = 0
  out.lLegRot.z = -0.025
  out.rLegRot.x = 0
  out.rLegRot.y = 0
  out.rLegRot.z = 0.025
  out.scaleY = 1
  out.scaleXZ = 1
  out.snappiness = 15
  out.directSpinX = false
  out.directSpinY = false
}

/**
 * COORDINATE SIGN CONVENTION (Three.js intrinsic 'XYZ', character facing +Z, limbs hanging along -Y):
 * - Because M = Rx * Ry * Rz, Rz rotates local (0, -L, 0) FIRST → x = +L * sin(rotZ) at EVERY elevation rotX!
 * - LEFT limbs (at x < 0): NEGATIVE rotZ (< 0) = OUTWARD away from body!
 * - RIGHT limbs (at x > 0): POSITIVE rotZ (> 0) = OUTWARD away from body!
 * - rotX < 0 = swing FORWARD (+Z) and UP; rotX > 0 = swing BACKWARD (-Z)!
 * - A hard anti-clipping clamp at the end guarantees arms/legs NEVER clip inward into torso or knees!
 */
export function evaluateR6Pose(
  pose: PlayerPose,
  elapsed: number,
  poseTime: number,
  landingImpact: number,
  out: R6PoseTarget,
): void {
  resetTarget(out)

  if (pose === 'idle') {
    // Bold, Confident Pro Action-Game Ready Stance (grounded wide athletic feet, outward arms, sharp breathing)
    const breathe = Math.sin(elapsed * 2.3)
    const shift = Math.sin(elapsed * 1.15)
    const scan = Math.sin(elapsed * 0.72) * Math.sin(elapsed * 0.38)

    out.comPos.x = shift * 0.03
    out.comPos.y = breathe * 0.028

    // Slight heroic readiness angle, strong upright chest
    out.torsoRot.y = -0.11 + shift * 0.04
    out.torsoRot.x = 0.02 + breathe * 0.018

    // Confident forward gaze with natural subtle scan (zero coy tilt!)
    out.headRot.y = 0.1 + scan * 0.2
    out.headRot.x = -0.02 - breathe * 0.02

    // Arms relaxed naturally close beside torso (realistic R6 hang, zero clipping!)
    out.lArmRot.x = -0.04 + breathe * 0.045
    out.lArmRot.z = -0.045 - breathe * 0.014
    out.lArmRot.y = 0

    out.rArmRot.x = 0.035 - breathe * 0.045
    out.rArmRot.z = 0.045 + breathe * 0.014
    out.rArmRot.y = 0

    // Natural grounded athletic stance (realistic separation!)
    out.lLegRot.x = -0.05
    out.lLegRot.z = -0.04
    out.rLegRot.x = 0.05
    out.rLegRot.z = 0.04

    out.scaleY = 1 + breathe * 0.01
    out.scaleXZ = 1 - breathe * 0.005
    out.snappiness = 12
  } else if (pose === 'walk') {
    // Crisp, Energetic Roblox Pro Walk (clean stride, counter-rotating torso, realistic close arm swing)
    const w = elapsed * 8.8
    const s = Math.sin(w)
    const c = Math.cos(w)
    const bounce = Math.abs(s)

    out.comPos.y = bounce * 0.11
    out.comPos.x = c * 0.035
    out.comRot.z = c * 0.03

    out.torsoRot.x = 0.08
    out.torsoRot.y = -s * 0.2

    out.headRot.y = s * 0.12
    out.headRot.x = -0.05 + Math.sin(w * 2 - 0.5) * 0.035

    // Realistic close arm swing (zero clipping, natural silhouette!)
    out.lArmRot.x = s * 0.75
    out.lArmRot.z = -0.055 - Math.abs(s) * 0.035
    out.rArmRot.x = -s * 0.75
    out.rArmRot.z = 0.055 + Math.abs(s) * 0.035

    // Crisp parallel-to-slightly-outward stride
    out.lLegRot.x = -s * 0.74
    out.lLegRot.z = -0.025
    out.rLegRot.x = s * 0.74
    out.rLegRot.z = 0.025

    out.scaleY = 1 + (bounce - 0.5) * 0.04
    out.scaleXZ = 1 - (bounce - 0.5) * 0.02
    out.snappiness = 18
  } else if (pose === 'run') {
    // High-Energy Action / Parkour Sprint (forward aerodynamic drive, natural tight power arms!)
    const r = elapsed * 13.6
    const s = Math.sin(r)
    const c = Math.cos(r)
    const lift = Math.pow(Math.abs(s), 0.75)

    out.comPos.y = lift * 0.2 - 0.03
    out.comPos.x = c * 0.05
    out.comRot.z = c * 0.05

    out.torsoRot.x = 0.28 + Math.abs(c) * 0.04
    out.torsoRot.y = -s * 0.3

    out.headRot.x = -0.22
    out.headRot.y = s * 0.2

    // Powerful athletic sprint arms close to ribs (zero torso clipping!)
    out.lArmRot.x = s * 1.24 - 0.12
    out.lArmRot.z = -0.085 - Math.abs(s) * 0.055
    out.rArmRot.x = -s * 1.24 - 0.12
    out.rArmRot.z = 0.085 + Math.abs(s) * 0.055

    // Explosive athletic stride
    out.lLegRot.x = -s * 1.12
    out.lLegRot.z = -0.035
    out.rLegRot.x = s * 1.12
    out.rLegRot.z = 0.035

    out.scaleY = 1 + (lift - 0.5) * 0.065
    out.scaleXZ = 1 - (lift - 0.5) * 0.03
    out.snappiness = 22
  } else if (pose === 'jump') {
    // Heroic Open-Silhouette Action Jump (arms swept cleanly up, realistic spread — NEVER blocking face!)
    const t = clamp01(poseTime / 0.2)
    const pop = easeOutBack(t)
    const hover = Math.sin(poseTime * 7) * 0.04

    out.comPos.y = 0.14 + hover
    out.torsoRot.x = -0.1 * pop
    out.torsoRot.y = 0.1

    out.headRot.x = -0.1
    out.headRot.y = -0.08

    // Both arms swept HIGH with crisp natural athletic angle
    out.lArmRot.x = -2.35 * pop
    out.lArmRot.z = -0.22 * pop
    out.rArmRot.x = -2.1 * pop
    out.rArmRot.z = 0.25 * pop

    // Dynamic front knee lift + trailing rear leg
    out.lLegRot.x = -0.72 * pop
    out.lLegRot.z = -0.06
    out.rLegRot.x = 0.52 * pop
    out.rLegRot.z = 0.06

    out.scaleY = 1.06 - t * 0.03
    out.scaleXZ = 0.96 + t * 0.02
    out.snappiness = 20
  } else if (pose === 'fall') {
    // Dynamic Freefall / Skydive Control
    const f = elapsed * 10
    out.comRot.x = 0.08
    out.torsoRot.x = 0.08
    out.headRot.x = 0.16

    out.lArmRot.x = -2.35 + Math.sin(f) * 0.16
    out.lArmRot.z = -0.44 - Math.cos(f) * 0.08
    out.rArmRot.x = -2.35 - Math.sin(f) * 0.16
    out.rArmRot.z = 0.44 + Math.cos(f) * 0.08

    out.lLegRot.x = -0.28 + Math.sin(f * 0.85) * 0.24
    out.lLegRot.z = -0.08
    out.rLegRot.x = -0.12 - Math.sin(f * 0.85) * 0.24
    out.rLegRot.z = 0.08

    out.scaleY = 1.03
    out.scaleXZ = 0.98
    out.snappiness = 15
  } else if (pose === 'wave') {
    // Cool, Confident Game-Hero Wave (natural relaxed left arm close to side, right arm waving cleanly outward!)
    const intro = easeOutBack(clamp01(poseTime / 0.24))
    const w = Math.sin(poseTime * 13)

    out.comPos.y = Math.sin(poseTime * 4) * 0.025
    out.torsoRot.y = -0.09 * intro
    out.torsoRot.x = -0.02 * intro

    out.headRot.y = 0.07 * intro
    out.headRot.x = -0.03 * intro

    // Left arm relaxed naturally close beside hip
    out.lArmRot.x = 0.05 * intro
    out.lArmRot.z = -0.065 * intro

    // Right arm raised high & waving cleanly outside the head
    out.rArmRot.x = -2.68 * intro
    out.rArmRot.z = (0.34 + w * 0.24) * intro

    // Solid grounded stance
    out.lLegRot.x = -0.04
    out.lLegRot.z = -0.055
    out.rLegRot.x = 0.04
    out.rLegRot.z = 0.055

    out.snappiness = 18
  } else if (pose === 'dance') {
    // VIRAL 4-BAR "FRESH HYPE SHUFFLE" CHOREOGRAPHY (3.2s seamless 8-beat loop — bold, outward, snappy!)
    const loopDur = 3.2
    const phase = (poseTime % loopDur) / loopDur
    const beat = phase * 8
    const bFrac = beat % 1
    const beatDrop = Math.sin(bFrac * Math.PI)
    const hitBounce = Math.pow(beatDrop, 0.7)

    if (beat < 2) {
      // BAR 1: Crisp Side-to-Side Sturdy Step + Wide Power Arm Groove
      const dir = beat < 1 ? 1 : -1
      const stepCurve = easeOutQuad(bFrac)

      out.comPos.x = dir * (0.28 * Math.sin(stepCurve * Math.PI))
      out.comPos.y = -0.15 * (1 - beatDrop) + 0.14 * hitBounce
      out.comRot.z = dir * 0.07 * hitBounce

      out.torsoRot.y = dir * 0.3 * hitBounce
      out.torsoRot.x = 0.12 * (1 - hitBounce)

      out.headRot.x = 0.16 * (1 - beatDrop) - 0.06
      out.headRot.y = -dir * 0.2 * hitBounce

      // Arms pumping dynamically forward & strictly OUTWARD
      out.lArmRot.x = dir > 0 ? -1.55 * hitBounce - 0.25 : 0.25
      out.lArmRot.z = dir > 0 ? -0.45 : -0.22
      out.rArmRot.x = dir < 0 ? -1.55 * hitBounce - 0.25 : 0.25
      out.rArmRot.z = dir < 0 ? 0.45 : 0.22

      // Wide sturdy side-steps & kicks (outward!)
      out.lLegRot.x = dir > 0 ? -0.52 * hitBounce : 0.24 * hitBounce
      out.lLegRot.z = dir > 0 ? -0.28 * hitBounce - 0.06 : -0.08
      out.rLegRot.x = dir < 0 ? -0.52 * hitBounce : 0.24 * hitBounce
      out.rLegRot.z = dir < 0 ? 0.28 * hitBounce + 0.06 : 0.08

      out.scaleY = 0.94 + hitBounce * 0.09
      out.scaleXZ = 1.04 - hitBounce * 0.045
    } else if (beat < 4) {
      // BAR 2: Alternating Hype Sky-Punches + Rhythmic Bounce
      const alt = beat < 3 ? 1 : -1
      const snap = easeOutBack(clamp01(bFrac * 1.4))

      out.comPos.y = -0.16 * (1 - beatDrop) + 0.18 * hitBounce
      out.torsoRot.x = -0.05 + 0.16 * (1 - hitBounce)
      out.torsoRot.y = alt * 0.34 * snap

      out.headRot.x = -0.1 + 0.2 * (1 - beatDrop)
      out.headRot.y = -alt * 0.22 * snap

      // One arm punches sky-high & outward, other drives down-back & outward!
      out.lArmRot.x = alt > 0 ? -2.65 * snap : 0.42 * snap
      out.lArmRot.z = alt > 0 ? -0.38 : -0.24
      out.rArmRot.x = alt < 0 ? -2.65 * snap : 0.42 * snap
      out.rArmRot.z = alt < 0 ? 0.38 : 0.24

      out.lLegRot.x = alt > 0 ? -0.34 * hitBounce : 0.18
      out.lLegRot.z = -0.18
      out.rLegRot.x = alt < 0 ? -0.34 * hitBounce : 0.18
      out.rLegRot.z = 0.18

      out.scaleY = 0.94 + hitBounce * 0.11
      out.scaleXZ = 1.04 - hitBounce * 0.05
    } else if (beat < 6) {
      // BAR 3: Smooth Lateral Glide Shuffle + Wide Helicopter Wave Arms
      const p = (beat - 4) / 2
      const glide = Math.sin(p * Math.PI * 2)
      const foot = Math.sin(p * Math.PI * 4)

      out.comPos.x = glide * 0.32
      out.comPos.y = Math.abs(foot) * 0.16 - 0.03
      out.comRot.z = glide * 0.08

      out.torsoRot.y = glide * 0.3
      out.headRot.y = -glide * 0.18

      out.lArmRot.x = -1.25 + Math.sin(p * Math.PI * 4) * 0.5
      out.lArmRot.z = -0.78 - Math.cos(p * Math.PI * 4) * 0.28
      out.rArmRot.x = -1.25 - Math.sin(p * Math.PI * 4) * 0.5
      out.rArmRot.z = 0.78 + Math.cos(p * Math.PI * 4) * 0.28

      out.lLegRot.x = foot * 0.62
      out.lLegRot.z = -0.14 - Math.max(0, foot) * 0.2
      out.rLegRot.x = -foot * 0.62
      out.rLegRot.z = 0.14 + Math.max(0, -foot) * 0.2

      out.scaleY = 0.97 + Math.abs(foot) * 0.06
      out.scaleXZ = 1.02 - Math.abs(foot) * 0.03
    } else {
      // BAR 4: 360° Pro Flair Spin → Power Drop Finisher!
      const p = (beat - 6) / 2
      if (p < 0.68) {
        const sp = easeInOutCubic(p / 0.68)
        const hop = Math.sin((p / 0.68) * Math.PI)
        out.comPos.y = hop * 0.55
        out.comRot.y = sp * Math.PI * 2
        out.directSpinY = true
        out.comRot.z = 0.1 * hop

        out.lArmRot.x = -1.1
        out.lArmRot.z = -1.08
        out.rArmRot.x = -1.1
        out.rArmRot.z = 1.08

        out.lLegRot.x = -0.45 * hop
        out.lLegRot.z = -0.14
        out.rLegRot.x = 0.32 * hop
        out.rLegRot.z = 0.14
        out.scaleY = 1 + hop * 0.08
        out.scaleXZ = 1 - hop * 0.04
      } else {
        const dp = (p - 0.68) / 0.32
        const settle = Math.sin(dp * Math.PI)
        out.comPos.y = -0.2 * settle
        out.comRot.y = 0
        out.directSpinY = true
        out.torsoRot.x = 0.18 * settle
        out.headRot.x = -0.14 * settle

        out.lArmRot.x = -1.55
        out.lArmRot.z = -0.62
        out.rArmRot.x = -1.55
        out.rArmRot.z = 0.62

        out.lLegRot.z = -0.2
        out.rLegRot.z = 0.2
        out.scaleY = 1 - 0.09 * settle
        out.scaleXZ = 1 + 0.05 * settle
      }
    }
    out.snappiness = 24
  } else if (pose === 'cheer') {
    // Explosive Wide Victory Star-Jump (1.2s cycle)
    const p = (poseTime % 1.2) / 1.2
    if (p < 0.2) {
      const t = easeOutQuad(p / 0.2)
      out.comPos.y = -0.2 * t
      out.torsoRot.x = 0.22 * t
      out.lArmRot.x = 0.58 * t
      out.lArmRot.z = -0.16
      out.rArmRot.x = 0.58 * t
      out.rArmRot.z = 0.16
      out.lLegRot.x = -0.34 * t
      out.lLegRot.z = -0.1
      out.rLegRot.x = -0.34 * t
      out.rLegRot.z = 0.1
      out.scaleY = 1 - 0.08 * t
      out.scaleXZ = 1 + 0.05 * t
    } else if (p < 0.72) {
      const t = (p - 0.2) / 0.52
      const arc = Math.sin(t * Math.PI)
      out.comPos.y = arc * 1.05
      out.torsoRot.x = -0.12 * arc
      out.headRot.x = -0.16 * arc

      out.lArmRot.x = -2.75 * arc
      out.lArmRot.z = -0.66 * arc - 0.1
      out.rArmRot.x = -2.75 * arc
      out.rArmRot.z = 0.66 * arc + 0.1

      out.lLegRot.z = -0.46 * arc - 0.06
      out.rLegRot.z = 0.46 * arc + 0.06
      out.lLegRot.x = -0.15 * arc
      out.rLegRot.x = -0.15 * arc

      out.scaleY = 1 + 0.08 * arc
      out.scaleXZ = 1 - 0.04 * arc
    } else {
      const t = (p - 0.72) / 0.28
      const impact = Math.sin(t * Math.PI)
      out.comPos.y = -0.18 * impact
      out.torsoRot.x = 0.12 * impact
      out.lArmRot.x = -2.3 + impact * 0.42
      out.lArmRot.z = -0.36
      out.rArmRot.x = -2.3 + impact * 0.42
      out.rArmRot.z = 0.36
      out.lLegRot.z = -0.14
      out.rLegRot.z = 0.14
      out.scaleY = 1 - 0.08 * impact
      out.scaleXZ = 1 + 0.05 * impact
    }
    out.snappiness = 22
  } else if (pose === 'sit') {
    // Relaxed Hangout Sit (legs forward & apart, arms braced outward behind)
    const ease = easeOutQuad(clamp01(poseTime / 0.32))
    const swing = Math.sin(elapsed * 2.5)
    const glance = Math.sin(elapsed * 1.05)

    out.comPos.y = -0.68 * ease
    out.torsoRot.x = -0.16 * ease
    out.headRot.y = glance * 0.22 * ease
    out.headRot.x = 0.08 * ease

    out.lArmRot.x = 0.36 * ease
    out.lArmRot.z = -0.26 * ease
    out.rArmRot.x = 0.36 * ease
    out.rArmRot.z = 0.26 * ease

    out.lLegRot.x = (-1.45 + swing * 0.14) * ease
    out.lLegRot.z = -0.12 * ease
    out.rLegRot.x = (-1.45 - swing * 0.14) * ease
    out.rLegRot.z = 0.12 * ease

    out.snappiness = 14
  } else if (pose === 'spin') {
    // Pro Martial-Arts 720° Tornado Kick Spin (1.45s choreographed cycle)
    const dur = 1.45
    const p = (poseTime % dur) / dur

    if (p < 0.18) {
      // Athletic coil wind-up!
      const t = easeOutQuad(p / 0.18)
      out.comPos.y = -0.2 * t
      out.comRot.y = -0.55 * t
      out.directSpinY = true
      out.torsoRot.x = 0.22 * t
      out.lArmRot.x = -0.75 * t
      out.lArmRot.z = -0.34 * t - 0.08
      out.rArmRot.x = 0.6 * t
      out.rArmRot.z = 0.38 * t + 0.08
      out.lLegRot.x = -0.34 * t
      out.lLegRot.z = -0.12
      out.rLegRot.x = 0.2 * t
      out.rLegRot.z = 0.12
      out.scaleY = 1 - 0.08 * t
      out.scaleXZ = 1 + 0.05 * t
    } else if (p < 0.78) {
      // Airborne 720° Tornado Kick with wide outward helicopter arms!
      const t = (p - 0.18) / 0.6
      const spinEase = easeInOutCubic(t)
      const arc = Math.sin(t * Math.PI)

      out.comPos.y = arc * 0.98
      out.comRot.y = mix(-0.55, Math.PI * 4, spinEase)
      out.directSpinY = true
      out.comRot.z = 0.18 * arc

      out.torsoRot.x = -0.1 * arc
      out.lArmRot.x = -1.35
      out.lArmRot.z = -1.15 * arc - 0.2
      out.rArmRot.x = -1.35
      out.rArmRot.z = 1.15 * arc + 0.2

      // Extended outward tornado kick + tucked trail leg!
      out.lLegRot.x = -1.12 * arc
      out.lLegRot.z = -0.36 * arc - 0.06
      out.rLegRot.x = 0.45 * arc
      out.rLegRot.z = 0.16 * arc + 0.06

      out.scaleY = 1 + 0.07 * arc
      out.scaleXZ = 1 - 0.035 * arc
    } else {
      // Wide superhero landing settle!
      const t = (p - 0.78) / 0.22
      const impact = Math.sin(t * Math.PI)
      out.comPos.y = -0.2 * impact
      out.comRot.y = 0
      out.directSpinY = true
      out.torsoRot.x = 0.2 * impact
      out.headRot.x = -0.15 * impact
      out.lArmRot.x = -0.4 * impact
      out.lArmRot.z = -0.58 * impact - 0.14
      out.rArmRot.x = -0.4 * impact
      out.rArmRot.z = 0.58 * impact + 0.14
      out.lLegRot.z = -0.18 * impact - 0.06
      out.rLegRot.z = 0.18 * impact + 0.06
      out.scaleY = 1 - 0.09 * impact
      out.scaleXZ = 1 + 0.05 * impact
    }
    out.snappiness = 24
  } else if (pose === 'backflip') {
    // PRO PARKOUR BACKFLIP — Coiled Squat → High Launch → Tight Midair Tuck (-360°) → Wide Superhero Landing!
    const dur = 1.75
    const p = (poseTime % dur) / dur

    if (p < 0.2) {
      // Phase 1: Power Anticipation Squat (feet wide, arms thrust back & outward!)
      const t = easeOutQuad(p / 0.2)
      out.comPos.y = -0.22 * t
      out.comRot.x = 0
      out.directSpinX = true

      out.torsoRot.x = 0.4 * t
      out.headRot.x = -0.28 * t

      out.lArmRot.x = 1.28 * t
      out.lArmRot.z = -0.24 * t - 0.08
      out.rArmRot.x = 1.28 * t
      out.rArmRot.z = 0.24 * t + 0.08

      out.lLegRot.x = -0.4 * t
      out.lLegRot.z = -0.12
      out.rLegRot.x = -0.4 * t
      out.rLegRot.z = 0.12

      out.scaleY = 1 - 0.08 * t
      out.scaleXZ = 1 + 0.05 * t
    } else if (p < 0.76) {
      // Phase 2 & 3: Explosive Takeoff → High-Apex Tight Tuck -360° around COM → Clean Open-Out!
      const t = (p - 0.2) / 0.56
      const heightArc = 4 * t * (1 - t)
      const tuck = Math.sin(clamp01((t - 0.08) / 0.78) * Math.PI)

      out.comPos.y = mix(-0.22, 0, clamp01(t * 5)) + heightArc * 1.78
      out.comRot.x = -easeInOutCubic(t) * Math.PI * 2
      out.directSpinX = true

      out.torsoRot.x = -0.22 * (1 - tuck) + 0.14 * tuck
      out.headRot.x = -0.35 * (1 - tuck)

      // Launch arms whip high & outward, hug cleanly beside tucked knees, then spread for landing!
      out.lArmRot.x = mix(-2.7, -1.2, tuck)
      out.lArmRot.z = mix(-0.44, -0.16, tuck)
      out.rArmRot.x = mix(-2.7, -1.2, tuck)
      out.rArmRot.z = mix(0.44, 0.16, tuck)

      out.lLegRot.x = -1.22 * tuck + 0.14 * (1 - tuck)
      out.lLegRot.z = -0.1
      out.rLegRot.x = -1.22 * tuck + 0.14 * (1 - tuck)
      out.rLegRot.z = 0.1

      out.scaleY = 1 + (1 - tuck) * 0.08 - tuck * 0.04
      out.scaleXZ = 1 - (1 - tuck) * 0.04 + tuck * 0.03
    } else if (p < 0.9) {
      // Phase 4: Bold Wide-Stance Superhero Landing Impact!
      const t = (p - 0.76) / 0.14
      const impact = Math.sin(t * Math.PI)
      out.comPos.y = -0.24 * impact
      out.comRot.x = 0
      out.directSpinX = true

      out.torsoRot.x = 0.32 * impact
      out.headRot.x = -0.22 * impact

      out.lArmRot.x = -0.45 * impact
      out.lArmRot.z = -0.68 * impact - 0.14
      out.rArmRot.x = -0.45 * impact
      out.rArmRot.z = 0.68 * impact + 0.14

      out.lLegRot.x = -0.36 * impact
      out.lLegRot.z = -0.2 * impact - 0.08
      out.rLegRot.x = -0.36 * impact
      out.rLegRot.z = 0.2 * impact + 0.08

      out.scaleY = 1 - 0.1 * impact
      out.scaleXZ = 1 + 0.06 * impact
    } else {
      // Phase 5: Crisp Heroic Rebound Stand
      const t = easeOutBack((p - 0.9) / 0.1)
      out.comPos.y = 0
      out.comRot.x = 0
      out.directSpinX = true
      out.torsoRot.y = -0.1 * t
      out.headRot.y = 0.1 * t
      out.lArmRot.z = -0.11
      out.rArmRot.z = 0.11
      out.lLegRot.z = -0.07
      out.rLegRot.z = 0.07
    }
    out.snappiness = 26
  }

  // Automatic juicy Landing Squash overlay after jumping/falling (with OUTWARD stabilizing arms!)
  if (landingImpact > 0.005 && pose !== 'jump' && pose !== 'fall' && pose !== 'backflip') {
    const k = Math.sin(landingImpact * Math.PI)
    out.comPos.y -= 0.2 * k
    out.torsoRot.x += 0.2 * k
    out.lArmRot.z -= 0.34 * k
    out.rArmRot.z += 0.34 * k
    out.lLegRot.x -= 0.24 * k
    out.lLegRot.z -= 0.08 * k
    out.rLegRot.x -= 0.24 * k
    out.rLegRot.z += 0.08 * k
    out.scaleY *= 1 - 0.09 * k
    out.scaleXZ *= 1 + 0.05 * k
  }

  // HARD MATHEMATICAL ANTI-CLIPPING GUARD:
  // Keeps arms naturally close beside torso while NEVER clipping inward into torso or knees!
  out.lArmRot.z = Math.min(out.lArmRot.z, -0.032)
  out.rArmRot.z = Math.max(out.rArmRot.z, 0.032)
  out.lLegRot.z = Math.min(out.lLegRot.z, -0.018)
  out.rLegRot.z = Math.max(out.rLegRot.z, 0.018)
}
