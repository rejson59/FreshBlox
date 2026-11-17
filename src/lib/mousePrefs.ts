export interface MouseLockPrefs {
  clickToLock: boolean
  shiftLockAlign: boolean
  sensitivity: number
}

const STORAGE_KEY = 'freshblox_mouse_prefs_v1'

const DEFAULT_PREFS: MouseLockPrefs = {
  clickToLock: true,
  shiftLockAlign: false,
  sensitivity: 1.0,
}

export function loadMousePrefs(): MouseLockPrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFS }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw) as Partial<MouseLockPrefs>
    return {
      clickToLock: typeof parsed.clickToLock === 'boolean' ? parsed.clickToLock : DEFAULT_PREFS.clickToLock,
      shiftLockAlign:
        typeof parsed.shiftLockAlign === 'boolean' ? parsed.shiftLockAlign : DEFAULT_PREFS.shiftLockAlign,
      sensitivity:
        typeof parsed.sensitivity === 'number' && Number.isFinite(parsed.sensitivity)
          ? Math.max(0.4, Math.min(2.2, parsed.sensitivity))
          : DEFAULT_PREFS.sensitivity,
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function saveMousePrefs(prefs: MouseLockPrefs): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // ignore storage quota errors
  }
}
