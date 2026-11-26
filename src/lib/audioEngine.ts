// FreshBlox Audio Engine 2.0 (A-01, A-02, A-03, A-04)
// Zero-dependency procedural Web Audio API synthesizer with:
// - 4-channel Mixer (Master, SFX, Music, UI/Chat) + Global Mute persisted in localStorage
// - Modern glossy UI & gameplay SFX + Portal Arena physics audio (WUB-WUB escalating discs, portals, meteor boom)
// - Procedural per-world ambient/synth music (Lobby / Parkour / Portal Arena)
// - 3D Spatial PannerNode SFX + distance ambient loops (fountain, portals, laser) + surface footsteps

export type AudioMusicWorld = 'none' | 'launcher' | 'lobby' | 'obby' | 'arena' | 'frisbee'
export type FootstepSurface = 'stone' | 'wood' | 'grass' | 'metal' | 'ice' | 'neon' | 'plastic'

export interface AudioPrefs {
  master: number // 0..1
  sfx: number // 0..1
  music: number // 0..1
  ui: number // 0..1
  muted: boolean
}

const AUDIO_STORAGE_KEY = 'freshblox_audio_prefs_v2'

const DEFAULT_AUDIO_PREFS: AudioPrefs = {
  master: 0.75,
  sfx: 0.78,
  music: 0.62,
  ui: 0.65,
  muted: false,
}

function clamp01(v: number, fallback: number): number {
  if (!Number.isFinite(v)) return fallback
  return Math.max(0, Math.min(1, v))
}

export function loadAudioPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(AUDIO_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_AUDIO_PREFS }
    const p = JSON.parse(raw) as Partial<AudioPrefs>
    return {
      master: clamp01(Number(p.master), DEFAULT_AUDIO_PREFS.master),
      sfx: clamp01(Number(p.sfx), DEFAULT_AUDIO_PREFS.sfx),
      music: clamp01(Number(p.music), DEFAULT_AUDIO_PREFS.music),
      ui: clamp01(Number(p.ui), DEFAULT_AUDIO_PREFS.ui),
      muted: Boolean(p.muted),
    }
  } catch {
    return { ...DEFAULT_AUDIO_PREFS }
  }
}

class FreshAudioEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private musicGain: GainNode | null = null
  private uiGain: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null

  private prefs: AudioPrefs = loadAudioPrefs()
  private listeners = new Set<(prefs: AudioPrefs) => void>()

  private currentMusicWorld: AudioMusicWorld = 'none'
  private musicTimer: number | null = null
  private musicStep = 0
  private unlocked = false

  // Continuous gentle spatial ambient loops (fountain water / portal hum / central laser)
  private fountainGain: GainNode | null = null
  private portalHumGain: GainNode | null = null
  private laserHumGain: GainNode | null = null
  private loopsInitialized = false

  constructor() {
    if (typeof window !== 'undefined') {
      const unlockHandler = () => {
        this.unlock()
      }
      window.addEventListener('pointerdown', unlockHandler, { passive: true })
      window.addEventListener('keydown', unlockHandler, { passive: true })
    }
  }

  getPrefs(): AudioPrefs {
    return { ...this.prefs }
  }

  subscribe(fn: (prefs: AudioPrefs) => void): () => void {
    this.listeners.add(fn)
    fn(this.getPrefs())
    return () => {
      this.listeners.delete(fn)
    }
  }

  private emitPrefs() {
    const snap = this.getPrefs()
    try {
      localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(snap))
    } catch {
      // ignore quota
    }
    for (const fn of this.listeners) fn(snap)
  }

  setPrefs(patch: Partial<AudioPrefs>) {
    this.prefs = {
      master: patch.master !== undefined ? clamp01(patch.master, this.prefs.master) : this.prefs.master,
      sfx: patch.sfx !== undefined ? clamp01(patch.sfx, this.prefs.sfx) : this.prefs.sfx,
      music: patch.music !== undefined ? clamp01(patch.music, this.prefs.music) : this.prefs.music,
      ui: patch.ui !== undefined ? clamp01(patch.ui, this.prefs.ui) : this.prefs.ui,
      muted: patch.muted !== undefined ? Boolean(patch.muted) : this.prefs.muted,
    }
    this.applyGains()
    this.emitPrefs()
  }

  toggleMute() {
    this.setPrefs({ muted: !this.prefs.muted })
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return null
      try {
        this.ctx = new AudioCtx()
        this.masterGain = this.ctx.createGain()
        this.sfxGain = this.ctx.createGain()
        this.musicGain = this.ctx.createGain()
        this.uiGain = this.ctx.createGain()

        // Gentle master limiter/compressor so stacked effects never clip
        const comp = this.ctx.createDynamicsCompressor()
        comp.threshold.value = -10
        comp.knee.value = 18
        comp.ratio.value = 5
        comp.attack.value = 0.005
        comp.release.value = 0.14

        this.sfxGain.connect(this.masterGain)
        this.musicGain.connect(this.masterGain)
        this.uiGain.connect(this.masterGain)
        this.masterGain.connect(comp)
        comp.connect(this.ctx.destination)

        this.buildNoiseBuffer()
        this.applyGains()
      } catch {
        return null
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  unlock() {
    const ctx = this.ensureContext()
    if (!ctx) return
    this.unlocked = true
    if (this.currentMusicWorld !== 'none' && !this.musicTimer) {
      this.startMusicLoop(this.currentMusicWorld)
    }
  }

  private buildNoiseBuffer() {
    if (!this.ctx) return
    const length = Math.floor(this.ctx.sampleRate * 1.5)
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      // Soft pink-ish filtered noise for natural water / footsteps / air
      last = (last + 0.08 * white) / 1.08
      data[i] = last * 2.6
    }
    this.noiseBuffer = buffer
  }

  private applyGains() {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.musicGain || !this.uiGain) return
    const now = this.ctx.currentTime
    const m = this.prefs.muted ? 0 : this.prefs.master
    this.masterGain.gain.setTargetAtTime(m, now, 0.025)
    this.sfxGain.gain.setTargetAtTime(this.prefs.sfx, now, 0.025)
    this.musicGain.gain.setTargetAtTime(this.prefs.music * 0.45, now, 0.05)
    this.uiGain.gain.setTargetAtTime(this.prefs.ui, now, 0.025)
  }

  private canPlay(channel: 'sfx' | 'ui' | 'music'): boolean {
    if (this.prefs.muted || this.prefs.master <= 0.001) return false
    if (channel === 'sfx' && this.prefs.sfx <= 0.001) return false
    if (channel === 'ui' && this.prefs.ui <= 0.001) return false
    if (channel === 'music' && this.prefs.music <= 0.001) return false
    return true
  }

  // Helper for clean modern ADSR synth tones
  private playTone(opts: {
    channel: 'sfx' | 'ui' | 'music'
    type?: OscillatorType
    freq: number
    endFreq?: number
    duration: number
    attack?: number
    gain: number
    delay?: number
    filterFreq?: number
    panner?: PannerNode | null
  }) {
    if (!this.canPlay(opts.channel)) return
    const ctx = this.ensureContext()
    if (!ctx) return
    const dest =
      opts.panner ??
      (opts.channel === 'sfx' ? this.sfxGain : opts.channel === 'ui' ? this.uiGain : this.musicGain)
    if (!dest) return

    const t0 = ctx.currentTime + (opts.delay ?? 0)
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = opts.type ?? 'sine'
    osc.frequency.setValueAtTime(Math.max(24, opts.freq), t0)
    if (opts.endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, opts.endFreq), t0 + opts.duration)
    }

    const atk = Math.max(0.003, opts.attack ?? 0.008)
    env.gain.setValueAtTime(0.0001, t0)
    env.gain.linearRampToValueAtTime(opts.gain, t0 + atk)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(atk + 0.015, opts.duration))

    if (opts.filterFreq) {
      const filt = ctx.createBiquadFilter()
      filt.type = 'lowpass'
      filt.frequency.setValueAtTime(opts.filterFreq, t0)
      osc.connect(filt)
      filt.connect(env)
    } else {
      osc.connect(env)
    }

    env.connect(dest)
    osc.start(t0)
    osc.stop(t0 + opts.duration + 0.03)
  }

  private playNoise(opts: {
    channel: 'sfx' | 'ui' | 'music'
    duration: number
    gain: number
    filterType?: BiquadFilterType
    filterFreq: number
    q?: number
    delay?: number
    panner?: PannerNode | null
  }) {
    if (!this.canPlay(opts.channel)) return
    const ctx = this.ensureContext()
    if (!ctx || !this.noiseBuffer) return
    const dest =
      opts.panner ?? (opts.channel === 'sfx' ? this.sfxGain : opts.channel === 'music' ? this.musicGain : this.uiGain)
    if (!dest) return

    const t0 = ctx.currentTime + (opts.delay ?? 0)
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true

    const filt = ctx.createBiquadFilter()
    filt.type = opts.filterType ?? 'bandpass'
    filt.frequency.setValueAtTime(opts.filterFreq, t0)
    filt.Q.value = opts.q ?? 1.4

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t0)
    env.gain.linearRampToValueAtTime(opts.gain, t0 + 0.007)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration)

    src.connect(filt)
    filt.connect(env)
    env.connect(dest)
    src.start(t0, Math.random() * 0.6)
    src.stop(t0 + opts.duration + 0.02)
  }

  // ==================== A-01: MODERN UI & CORE GAMEPLAY SFX ====================

  playClick() {
    this.playTone({ channel: 'ui', type: 'triangle', freq: 720, endFreq: 520, duration: 0.045, gain: 0.14 })
    this.playTone({ channel: 'ui', type: 'sine', freq: 1380, endFreq: 1040, duration: 0.032, gain: 0.06 })
  }

  playChatPop() {
    this.playTone({ channel: 'ui', type: 'sine', freq: 540, endFreq: 860, duration: 0.065, gain: 0.13 })
    this.playTone({ channel: 'ui', type: 'sine', freq: 1080, duration: 0.055, delay: 0.04, gain: 0.07 })
  }

  playJump() {
    this.playTone({ channel: 'sfx', type: 'sine', freq: 210, endFreq: 440, duration: 0.12, gain: 0.18 })
    this.playNoise({ channel: 'sfx', duration: 0.07, gain: 0.07, filterType: 'highpass', filterFreq: 1100 })
  }

  playLedgeGrab() {
    this.playNoise({ channel: 'sfx', duration: 0.075, gain: 0.14, filterType: 'bandpass', filterFreq: 680, q: 1.1 })
    this.playTone({ channel: 'sfx', type: 'triangle', freq: 190, endFreq: 310, duration: 0.09, gain: 0.16 })
  }

  playJumpPad() {
    this.playTone({ channel: 'sfx', type: 'sine', freq: 260, endFreq: 780, duration: 0.24, gain: 0.22 })
    this.playTone({ channel: 'sfx', type: 'triangle', freq: 520, endFreq: 1180, duration: 0.22, delay: 0.04, gain: 0.14 })
  }

  playCheckpoint() {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((n, idx) => {
      this.playTone({
        channel: 'sfx',
        type: 'triangle',
        freq: n,
        duration: 0.24,
        delay: idx * 0.055,
        gain: 0.14,
        filterFreq: 2600,
      })
    })
  }

  playGemCollect() {
    this.playTone({ channel: 'sfx', type: 'sine', freq: 880, duration: 0.12, gain: 0.14 })
    this.playTone({ channel: 'sfx', type: 'triangle', freq: 1318.5, duration: 0.18, delay: 0.045, gain: 0.12 })
  }

  playQuestClaim() {
    const chord = [523.25, 659.25, 783.99, 1046.5, 1318.5]
    chord.forEach((n, i) => {
      this.playTone({
        channel: 'ui',
        type: 'triangle',
        freq: n,
        duration: 0.32,
        delay: i * 0.05,
        gain: 0.12,
        filterFreq: 3200,
      })
    })
  }

  // ==================== PORTAL ARENA PHYSICS & WEAPON-FREE SFX ====================

  playPortalOpen(color: 'cyan' | 'orange', worldPos?: { x: number; y: number; z: number }) {
    const panner = worldPos ? this.createSpatialPanner(worldPos.x, worldPos.y, worldPos.z, 45) : null
    const base = color === 'cyan' ? 320 : 255
    this.playTone({ channel: 'sfx', type: 'sine', freq: base * 0.7, endFreq: base * 1.9, duration: 0.22, gain: 0.24, panner })
    this.playTone({ channel: 'sfx', type: 'triangle', freq: base * 2.2, endFreq: base * 1.3, duration: 0.18, delay: 0.03, gain: 0.13, filterFreq: 2400, panner })
    this.playNoise({ channel: 'sfx', duration: 0.16, gain: 0.11, filterType: 'bandpass', filterFreq: color === 'cyan' ? 1600 : 1100, q: 2.2, panner })
  }

  playPortalFail() {
    this.playTone({ channel: 'sfx', type: 'sawtooth', freq: 185, endFreq: 110, duration: 0.14, gain: 0.13, filterFreq: 520 })
  }

  playPortalWarp(speedKmh = 45) {
    const boost = Math.min(2.0, Math.max(0.85, speedKmh / 60))
    this.playTone({ channel: 'sfx', type: 'sine', freq: 190 * boost, endFreq: 560 * boost, duration: 0.21, gain: 0.28 })
    this.playTone({ channel: 'sfx', type: 'triangle', freq: 620 * boost, endFreq: 240 * boost, duration: 0.22, delay: 0.02, gain: 0.15, filterFreq: 2600 })
    this.playNoise({ channel: 'sfx', duration: 0.2, gain: 0.14, filterType: 'bandpass', filterFreq: 900 * boost, q: 1.5 })
  }

  playGravityPulse(worldPos?: { x: number; y: number; z: number }) {
    const panner = worldPos ? this.createSpatialPanner(worldPos.x, worldPos.y, worldPos.z, 55) : null
    this.playTone({ channel: 'sfx', type: 'sine', freq: 185, endFreq: 46, duration: 0.34, gain: 0.38, panner })
    this.playTone({ channel: 'sfx', type: 'triangle', freq: 440, endFreq: 120, duration: 0.24, gain: 0.18, filterFreq: 1500, panner })
    this.playNoise({ channel: 'sfx', duration: 0.24, gain: 0.18, filterType: 'lowpass', filterFreq: 950, panner })
  }

  playDiscThrow() {
    this.playTone({ channel: 'sfx', type: 'triangle', freq: 380, endFreq: 860, duration: 0.16, gain: 0.2, filterFreq: 2500 })
    this.playNoise({ channel: 'sfx', duration: 0.14, gain: 0.12, filterType: 'bandpass', filterFreq: 1900, q: 2.4 })
  }

  /** Escalating WUB-WUB sound every time a Ricochet Energy Disc passes through a portal! */
  playDiscPortalBoost(portalPasses: number, worldPos?: { x: number; y: number; z: number }) {
    const panner = worldPos ? this.createSpatialPanner(worldPos.x, worldPos.y, worldPos.z, 65) : null
    const stage = Math.min(6, Math.max(1, portalPasses))
    const baseFreq = 180 + stage * 95
    // Dual pulsating WUB-WUB envelope
    this.playTone({ channel: 'sfx', type: 'sawtooth', freq: baseFreq, endFreq: baseFreq * 1.42, duration: 0.11, gain: 0.16, filterFreq: 1100 + stage * 380, panner })
    this.playTone({ channel: 'sfx', type: 'sawtooth', freq: baseFreq * 1.15, endFreq: baseFreq * 1.65, duration: 0.14, delay: 0.09, gain: 0.2, filterFreq: 1400 + stage * 420, panner })
    this.playTone({ channel: 'sfx', type: 'sine', freq: baseFreq * 2.0, endFreq: baseFreq * 2.5, duration: 0.16, delay: 0.05, gain: 0.11, panner })
  }

  playMeteorBoom(worldPos?: { x: number; y: number; z: number }) {
    const panner = worldPos ? this.createSpatialPanner(worldPos.x, worldPos.y, worldPos.z, 85) : null
    this.playTone({ channel: 'sfx', type: 'sine', freq: 140, endFreq: 32, duration: 0.48, gain: 0.45, panner })
    this.playTone({ channel: 'sfx', type: 'sawtooth', freq: 240, endFreq: 68, duration: 0.32, gain: 0.16, filterFreq: 900, panner })
    this.playNoise({ channel: 'sfx', duration: 0.42, gain: 0.26, filterType: 'lowpass', filterFreq: 1300, panner })
  }

  playElimination() {
    const notes = [587.33, 880, 1174.66]
    notes.forEach((n, i) => {
      this.playTone({ channel: 'sfx', type: 'triangle', freq: n, duration: 0.18, delay: i * 0.045, gain: 0.18, filterFreq: 3200 })
    })
  }

  playRoundWin() {
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98]
    fanfare.forEach((n, i) => {
      this.playTone({ channel: 'sfx', type: 'triangle', freq: n, duration: 0.36, delay: i * 0.075, gain: 0.15, filterFreq: 3400 })
    })
  }

  // ==================== A-03: 3D SPATIAL AUDIO & SURFACE FOOTSTEPS ====================

  updateListener(posX: number, posY: number, posZ: number, fwdX: number, fwdY: number, fwdZ: number) {
    if (!this.ctx) return
    const l = this.ctx.listener
    const t = this.ctx.currentTime
    try {
      if (l.positionX) {
        l.positionX.setTargetAtTime(posX, t, 0.02)
        l.positionY.setTargetAtTime(posY, t, 0.02)
        l.positionZ.setTargetAtTime(posZ, t, 0.02)
        l.forwardX.setTargetAtTime(fwdX, t, 0.02)
        l.forwardY.setTargetAtTime(fwdY, t, 0.02)
        l.forwardZ.setTargetAtTime(fwdZ, t, 0.02)
        l.upX.setTargetAtTime(0, t, 0.02)
        l.upY.setTargetAtTime(1, t, 0.02)
        l.upZ.setTargetAtTime(0, t, 0.02)
      } else {
        l.setPosition(posX, posY, posZ)
        l.setOrientation(fwdX, fwdY, fwdZ, 0, 1, 0)
      }
    } catch {
      // ignore older browsers
    }
  }

  private createSpatialPanner(x: number, y: number, z: number, maxDistance = 55): PannerNode | null {
    const ctx = this.ensureContext()
    if (!ctx || !this.sfxGain) return null
    try {
      const p = ctx.createPanner()
      p.panningModel = 'equalpower'
      p.distanceModel = 'linear'
      p.refDistance = 3
      p.maxDistance = maxDistance
      p.rolloffFactor = 1
      if (p.positionX) {
        p.positionX.value = x
        p.positionY.value = y
        p.positionZ.value = z
      } else {
        p.setPosition(x, y, z)
      }
      p.connect(this.sfxGain)
      return p
    } catch {
      return null
    }
  }

  playFootstep(surface: FootstepSurface = 'stone', sprint = false) {
    if (!this.canPlay('sfx')) return
    const jitter = 0.92 + Math.random() * 0.16
    const vol = sprint ? 0.11 : 0.072

    switch (surface) {
      case 'grass':
        this.playNoise({ channel: 'sfx', duration: 0.06, gain: vol * 0.9, filterType: 'bandpass', filterFreq: 950 * jitter, q: 1.1 })
        break
      case 'wood':
        this.playTone({ channel: 'sfx', type: 'triangle', freq: 150 * jitter, endFreq: 85, duration: 0.045, gain: vol * 1.1 })
        this.playNoise({ channel: 'sfx', duration: 0.035, gain: vol * 0.5, filterType: 'bandpass', filterFreq: 750 * jitter })
        break
      case 'metal':
        this.playTone({ channel: 'sfx', type: 'sine', freq: 420 * jitter, endFreq: 210, duration: 0.055, gain: vol * 0.85 })
        this.playNoise({ channel: 'sfx', duration: 0.04, gain: vol * 0.7, filterType: 'highpass', filterFreq: 1800 * jitter })
        break
      case 'ice':
        this.playNoise({ channel: 'sfx', duration: 0.055, gain: vol * 0.85, filterType: 'highpass', filterFreq: 2400 * jitter })
        this.playTone({ channel: 'sfx', type: 'sine', freq: 1120 * jitter, endFreq: 780, duration: 0.04, gain: vol * 0.45 })
        break
      case 'neon':
        this.playTone({ channel: 'sfx', type: 'sine', freq: 260 * jitter, endFreq: 170, duration: 0.05, gain: vol * 0.95 })
        this.playNoise({ channel: 'sfx', duration: 0.035, gain: vol * 0.55, filterType: 'bandpass', filterFreq: 1450 * jitter })
        break
      default: // stone
        this.playNoise({ channel: 'sfx', duration: 0.045, gain: vol * 0.95, filterType: 'bandpass', filterFreq: 1200 * jitter, q: 1.3 })
        this.playTone({ channel: 'sfx', type: 'sine', freq: 115 * jitter, endFreq: 68, duration: 0.04, gain: vol * 0.8 })
        break
    }
  }

  private initAmbientLoops() {
    if (this.loopsInitialized || !this.ctx || !this.sfxGain) return
    this.loopsInitialized = true

    // Fountain noise completely removed — crisp silence around the 3D FreshBlox Statue!
    this.fountainGain = null

    // 1. Subtle low-volume Portal harmonic hum (only audible right next to a portal)
    const pOsc = this.ctx.createOscillator()
    pOsc.type = 'sine'
    pOsc.frequency.value = 112
    const pFilt = this.ctx.createBiquadFilter()
    pFilt.type = 'lowpass'
    pFilt.frequency.value = 260
    this.portalHumGain = this.ctx.createGain()
    this.portalHumGain.gain.value = 0
    pOsc.connect(pFilt)
    pFilt.connect(this.portalHumGain)
    this.portalHumGain.connect(this.sfxGain)
    pOsc.start()

    // 2. Central Laser beam subtle energy hum (Portal Arena only)
    const lOsc = this.ctx.createOscillator()
    lOsc.type = 'triangle'
    lOsc.frequency.value = 82
    const lFilt = this.ctx.createBiquadFilter()
    lFilt.type = 'lowpass'
    lFilt.frequency.value = 220
    this.laserHumGain = this.ctx.createGain()
    this.laserHumGain.gain.value = 0
    lOsc.connect(lFilt)
    lFilt.connect(this.laserHumGain)
    this.laserHumGain.connect(this.sfxGain)
    lOsc.start()
  }

  /** Smoothly adjusts distance-based continuous world ambience (0 = silent) */
  setSpatialLoopLevel(kind: 'fountain' | 'portal' | 'laser', level01: number) {
    if (kind === 'fountain') return // Permanently silenced!
    if (!this.unlocked) return
    const ctx = this.ensureContext()
    if (!ctx) return
    this.initAmbientLoops()
    const target = Math.max(0, Math.min(1, level01))
    const now = ctx.currentTime
    if (kind === 'portal' && this.portalHumGain) {
      this.portalHumGain.gain.setTargetAtTime(target * 0.045, now, 0.14)
    } else if (kind === 'laser' && this.laserHumGain) {
      this.laserHumGain.gain.setTargetAtTime(target * 0.075, now, 0.14)
    }
  }

  /** Soft tactile landing thud scaled by vertical impact velocity */
  playLand(impact01 = 0.5) {
    if (!this.canPlay('sfx')) return
    const k = Math.min(1, Math.max(0.15, impact01))
    this.playTone({ channel: 'sfx', type: 'sine', freq: 118 - k * 24, endFreq: 48, duration: 0.09, gain: 0.11 * k })
    this.playNoise({ channel: 'sfx', duration: 0.055, gain: 0.07 * k, filterType: 'lowpass', filterFreq: 550 })
  }

  stopAllSpatialLoops() {
    this.setSpatialLoopLevel('fountain', 0)
    this.setSpatialLoopLevel('portal', 0)
    this.setSpatialLoopLevel('laser', 0)
  }

  // ==================== A-02: PROCEDURAL AMBIENT / SYNTH WORLD MUSIC ====================

  setWorldMusic(world: AudioMusicWorld) {
    if (this.currentMusicWorld === world) return
    this.currentMusicWorld = world
    this.stopMusicTimer()
    if (world === 'none' || world === 'launcher') {
      this.stopAllSpatialLoops()
      return
    }
    if (this.unlocked) {
      this.startMusicLoop(world)
    }
  }

  private stopMusicTimer() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer)
      this.musicTimer = null
    }
  }

  private startMusicLoop(world: AudioMusicWorld) {
    this.stopMusicTimer()
    this.musicStep = 0
    if (world === 'none' || world === 'launcher') return

    if (world === 'lobby') {
      // Chill Arctic Sky ambient chords + soft crystal bells every 2.4s
      const chords = [
        [261.63, 329.63, 392.0, 493.88], // Cmaj7
        [220.0, 261.63, 329.63, 392.0], // Am7
        [174.61, 220.0, 261.63, 329.63], // Fmaj7
        [196.0, 246.94, 293.66, 392.0], // G6
      ]
      const tick = () => {
        if (!this.canPlay('music')) return
        const chord = chords[this.musicStep % chords.length]
        chord.forEach((freq, idx) => {
          this.playTone({
            channel: 'music',
            type: 'sine',
            freq,
            duration: 2.35,
            attack: 0.45,
            gain: 0.065,
            delay: idx * 0.06,
            filterFreq: 1400,
          })
        })
        // Occasional crystal shimmer high note
        if (this.musicStep % 2 === 0) {
          const bell = chord[(this.musicStep / 2) % chord.length] * 2
          this.playTone({
            channel: 'music',
            type: 'triangle',
            freq: bell,
            duration: 0.9,
            attack: 0.04,
            gain: 0.045,
            delay: 0.9,
            filterFreq: 2200,
          })
        }
        this.musicStep++
      }
      tick()
      this.musicTimer = window.setInterval(tick, 2400)
      return
    }

    if (world === 'obby') {
      // Uplifting rhythmic synth-parkour arpeggio (112 BPM -> 268ms per 8th note)
      const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25]
      const pattern = [0, 2, 4, 5, 3, 5, 4, 2, 1, 3, 5, 7, 4, 3, 2, 0]
      const bass = [130.81, 130.81, 174.61, 196.0]
      const tick = () => {
        if (!this.canPlay('music')) return
        const s = this.musicStep % 16
        const note = scale[pattern[s]]
        this.playTone({
          channel: 'music',
          type: 'triangle',
          freq: note,
          duration: 0.22,
          attack: 0.012,
          gain: s % 4 === 0 ? 0.085 : 0.055,
          filterFreq: 1900,
        })
        if (s % 4 === 0) {
          this.playTone({
            channel: 'music',
            type: 'sine',
            freq: bass[Math.floor(s / 4) % bass.length],
            duration: 0.5,
            attack: 0.03,
            gain: 0.11,
            filterFreq: 650,
          })
        }
        this.musicStep++
      }
      tick()
      this.musicTimer = window.setInterval(tick, 268)
      return
    }

    if (world === 'arena') {
      // Dynamic Portal Arena kinetic synth pulse (126 BPM -> 238ms per 8th note)
      const bassSeq = [110.0, 110.0, 130.81, 98.0] // A2 -> C3 -> G2
      const arpSeq = [220.0, 329.63, 440.0, 392.0, 261.63, 329.63, 523.25, 440.0]
      const tick = () => {
        if (!this.canPlay('music')) return
        const s = this.musicStep % 16
        const bFreq = bassSeq[Math.floor(s / 4) % bassSeq.length]
        // Deep cyber pulse bass on even steps
        if (s % 2 === 0) {
          this.playTone({
            channel: 'music',
            type: 'triangle',
            freq: bFreq,
            endFreq: bFreq * 0.96,
            duration: 0.21,
            attack: 0.008,
            gain: s % 4 === 0 ? 0.13 : 0.08,
            filterFreq: 520,
          })
        }
        // Crisp futuristic arpeggio
        const arp = arpSeq[s % arpSeq.length]
        this.playTone({
          channel: 'music',
          type: 'sine',
          freq: arp,
          duration: 0.16,
          attack: 0.01,
          gain: s % 4 === 2 ? 0.075 : 0.045,
          filterFreq: 2100,
        })
        // Soft synthetic percussion pulse
        if (s % 4 === 0) {
          this.playTone({ channel: 'music', type: 'sine', freq: 95, endFreq: 42, duration: 0.12, gain: 0.12 })
        }
        this.musicStep++
      }
      tick()
      this.musicTimer = window.setInterval(tick, 238)
      return
    }

    if (world === 'frisbee') {
      // High-energy Frisbee King trick-shot synth funk/breakbeat (132 BPM -> 227ms)
      const bassLine = [146.83, 146.83, 174.61, 130.81, 146.83, 196.0, 174.61, 164.81] // D3 groove
      const leadSeq = [587.33, 440.0, 523.25, 659.25, 587.33, 523.25, 440.0, 392.0]
      const tick = () => {
        if (!this.canPlay('music')) return
        const s = this.musicStep % 16
        if (s % 2 === 0) {
          const bf = bassLine[Math.floor(s / 2) % bassLine.length]
          this.playTone({
            channel: 'music',
            type: 'sawtooth',
            freq: bf,
            endFreq: bf * 0.94,
            duration: 0.18,
            attack: 0.008,
            gain: 0.085,
            filterFreq: 680,
          })
        }
        if (s % 4 === 1 || s % 4 === 3) {
          this.playTone({
            channel: 'music',
            type: 'triangle',
            freq: leadSeq[s % leadSeq.length],
            duration: 0.14,
            attack: 0.008,
            gain: 0.055,
            filterFreq: 2200,
          })
        }
        if (s % 4 === 0) {
          this.playTone({ channel: 'music', type: 'sine', freq: 110, endFreq: 46, duration: 0.11, gain: 0.13 })
        } else if (s % 4 === 2) {
          this.playNoise({ channel: 'music', duration: 0.055, gain: 0.045, filterType: 'highpass', filterFreq: 3200 })
        }
        this.musicStep++
      }
      tick()
      this.musicTimer = window.setInterval(tick, 227)
    }
  }

  // ==================== FRISBEE KING SFX ====================

  playFrisbeeThrow(charge01 = 0) {
    if (!this.canPlay('sfx')) return
    const boost = 1 + charge01 * 0.45
    this.playTone({
      channel: 'sfx',
      type: 'triangle',
      freq: 260 * boost,
      endFreq: 760 * boost,
      duration: 0.19,
      attack: 0.008,
      gain: 0.22,
    })
    this.playNoise({
      channel: 'sfx',
      duration: 0.16,
      gain: 0.16,
      filterType: 'bandpass',
      filterFreq: 1800 * boost,
      q: 1.4,
    })
  }

  playFrisbeeBounce(bounces = 1, blazing = false) {
    if (!this.canPlay('sfx')) return
    const pitch = Math.min(2.1, 1 + bounces * 0.16)
    this.playTone({
      channel: 'sfx',
      type: blazing ? 'sawtooth' : 'sine',
      freq: 380 * pitch,
      endFreq: 640 * pitch,
      duration: 0.13,
      attack: 0.004,
      gain: blazing ? 0.22 : 0.17,
      filterFreq: blazing ? 2400 : 1800,
    })
    if (blazing) {
      this.playNoise({ channel: 'sfx', duration: 0.09, gain: 0.14, filterType: 'bandpass', filterFreq: 2600, q: 1.1 })
    }
  }

  playFrisbeeCatch() {
    if (!this.canPlay('sfx')) return
    this.playTone({ channel: 'sfx', type: 'sine', freq: 523.25, endFreq: 783.99, duration: 0.12, gain: 0.22 })
    this.playTone({ channel: 'sfx', type: 'triangle', freq: 1046.5, duration: 0.16, delay: 0.045, gain: 0.16 })
  }

  playFrisbeeIgnite() {
    if (!this.canPlay('sfx')) return
    this.playTone({
      channel: 'sfx',
      type: 'sawtooth',
      freq: 140,
      endFreq: 880,
      duration: 0.34,
      attack: 0.015,
      gain: 0.25,
      filterFreq: 2600,
    })
    this.playNoise({ channel: 'sfx', duration: 0.32, gain: 0.24, filterType: 'bandpass', filterFreq: 1350, q: 0.9 })
  }

  playFrisbeeSlice() {
    if (!this.canPlay('sfx')) return
    // Sharp laser/flame blade slice + deep impact boom
    this.playTone({ channel: 'sfx', type: 'sawtooth', freq: 1480, endFreq: 220, duration: 0.28, attack: 0.004, gain: 0.28, filterFreq: 3400 })
    this.playTone({ channel: 'sfx', type: 'sine', freq: 135, endFreq: 38, duration: 0.34, attack: 0.005, gain: 0.3 })
    this.playNoise({ channel: 'sfx', duration: 0.24, gain: 0.24, filterType: 'highpass', filterFreq: 1900 })
  }
}

export const audioEngine = new FreshAudioEngine()
