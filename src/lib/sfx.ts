// Audio / SFX intentionally disabled for now — sound design will be rebuilt later.

class FreshSFX {
  public muted = true

  setEnabled(_enabled: boolean) {
    this.muted = true
  }

  playClick() {}
  playJump() {}
  playLedgeGrab() {}
  playJumpPad() {}
  playGemCollect() {}
  playQuestClaim() {}
  playChatPop() {}
}

export const sfx = new FreshSFX()
