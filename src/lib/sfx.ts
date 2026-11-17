import { audioEngine } from './audioEngine'

// Audio 2.0 facade — keeps full backwards compatibility with all existing sfx.play*() calls
class FreshSFX {
  get muted() {
    return audioEngine.getPrefs().muted
  }

  set muted(val: boolean) {
    audioEngine.setPrefs({ muted: val })
  }

  setEnabled(enabled: boolean) {
    audioEngine.setPrefs({ muted: !enabled })
  }

  playClick() {
    audioEngine.playClick()
  }

  playJump() {
    audioEngine.playJump()
  }

  playLedgeGrab() {
    audioEngine.playLedgeGrab()
  }

  playJumpPad() {
    audioEngine.playJumpPad()
  }

  playCheckpoint() {
    audioEngine.playCheckpoint()
  }

  playGemCollect() {
    audioEngine.playGemCollect()
  }

  playQuestClaim() {
    audioEngine.playQuestClaim()
  }

  playChatPop() {
    audioEngine.playChatPop()
  }
}

export const sfx = new FreshSFX()
