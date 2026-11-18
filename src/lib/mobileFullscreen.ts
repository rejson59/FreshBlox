// Mobile Fullscreen + Auto-Landscape helper for entering 3D Worlds on phones & tablets

interface FullscreenDoc extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

interface FullscreenEl extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void
}

export function isTouchMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  return coarse || (hasTouch && Math.min(window.innerWidth, window.innerHeight) <= 950)
}

export function isDocumentFullscreen(): boolean {
  if (typeof document === 'undefined') return false
  const doc = document as FullscreenDoc
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement)
}

/**
 * Must be called inside a user click/tap gesture (e.g. clicking "Wejdź do Lobby Głównego").
 * Enters browser fullscreen and locks screen orientation to landscape on supported mobile browsers (Android Brave/Chrome/Edge/Firefox).
 */
export async function enterGameFullscreenLandscape(): Promise<boolean> {
  if (typeof document === 'undefined') return false
  let entered = false
  try {
    const el = document.documentElement as FullscreenEl
    if (!isDocumentFullscreen()) {
      if (el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions)
        entered = true
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen()
        entered = true
      }
    } else {
      entered = true
    }
  } catch {
    // Fullscreen may be unsupported on iOS Safari; handled gracefully via fallback banner
  }

  try {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
    if (orientation?.lock) {
      await orientation.lock('landscape')
    }
  } catch {
    // Orientation lock requires fullscreen on Android and is not supported on desktop/iOS Safari
  }

  return entered
}

export async function exitGameFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return
  try {
    const orientation = screen.orientation as ScreenOrientation & { unlock?: () => void }
    orientation?.unlock?.()
  } catch {
    // ignore
  }
  try {
    const doc = document as FullscreenDoc
    if (doc.fullscreenElement && doc.exitFullscreen) {
      await doc.exitFullscreen()
    } else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen()
    }
  } catch {
    // ignore
  }
}
