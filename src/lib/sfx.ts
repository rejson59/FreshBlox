// Lightweight procedural Web Audio sound effects (zero external files!)

class FreshSFX {
  private ctx: AudioContext | null = null
  public muted = false

  setEnabled(enabled: boolean) {
    this.muted = !enabled
  }

  private ensureCtx(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return null
      this.ctx = new AudioCtx()
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  playClick() {
    const ctx = this.ensureCtx()
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(520, now)
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.04)
    gain.gain.setValueAtTime(0.06, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.055)
  }

  playJump() {
    const ctx = this.ensureCtx()
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(240, now)
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.11)
    gain.gain.setValueAtTime(0.11, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.14)
  }

  playJumpPad() {
    const ctx = this.ensureCtx()
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(280, now)
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.24)
    gain.gain.setValueAtTime(0.16, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.29)
  }

  playGemCollect() {
    const ctx = this.ensureCtx()
    if (!ctx) return
    const now = ctx.currentTime
    ;[880, 1318.5, 1760].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + i * 0.055)
      gain.gain.setValueAtTime(0.11, now + i * 0.055)
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.22)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + i * 0.055)
      osc.stop(now + i * 0.055 + 0.24)
    })
  }

  playQuestClaim() {
    const ctx = this.ensureCtx()
    if (!ctx) return
    const now = ctx.currentTime
    ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + i * 0.07)
      gain.gain.setValueAtTime(0.12, now + i * 0.07)
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.28)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + i * 0.07)
      osc.stop(now + i * 0.07 + 0.3)
    })
  }

  playChatPop() {
    const ctx = this.ensureCtx()
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(620, now)
    osc.frequency.exponentialRampToValueAtTime(840, now + 0.06)
    gain.gain.setValueAtTime(0.07, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.09)
  }
}

export const sfx = new FreshSFX()
