export type LobbyWeatherMode = 'clear' | 'snow' | 'stars'

export interface MouseLockPrefs {
  clickToLock: boolean
  shiftLockAlign: boolean
  sensitivity: number
  /** Camera field of view in 3D worlds (60° – 100°) */
  fov: number
  /** Show 3D Speedrun Personal Best Ghost in Parkour */
  showGhost: boolean
  /** Dynamic 3D Lobby weather mode */
  weather: LobbyWeatherMode
  /** Smooth automatic day/sunset/night cycle in Main Lobby */
  autoDayCycle: boolean
}

const STORAGE_KEY = 'freshblox_mouse_prefs_v1'

const DEFAULT_PREFS: MouseLockPrefs = {
  clickToLock: true,
  shiftLockAlign: false,
  sensitivity: 1.0,
  fov: 68,
  showGhost: true,
  weather: 'clear',
  autoDayCycle: false,
}

export function loadMousePrefs(): MouseLockPrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFS }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw) as Partial<MouseLockPrefs>
    const weather: LobbyWeatherMode =
      parsed.weather === 'snow' || parsed.weather === 'stars' || parsed.weather === 'clear'
        ? parsed.weather
        : DEFAULT_PREFS.weather
    return {
      clickToLock: typeof parsed.clickToLock === 'boolean' ? parsed.clickToLock : DEFAULT_PREFS.clickToLock,
      shiftLockAlign:
        typeof parsed.shiftLockAlign === 'boolean' ? parsed.shiftLockAlign : DEFAULT_PREFS.shiftLockAlign,
      sensitivity:
        typeof parsed.sensitivity === 'number' && Number.isFinite(parsed.sensitivity)
          ? Math.max(0.4, Math.min(2.2, parsed.sensitivity))
          : DEFAULT_PREFS.sensitivity,
      fov:
        typeof parsed.fov === 'number' && Number.isFinite(parsed.fov)
          ? Math.max(55, Math.min(100, Math.round(parsed.fov)))
          : DEFAULT_PREFS.fov,
      showGhost: typeof parsed.showGhost === 'boolean' ? parsed.showGhost : DEFAULT_PREFS.showGhost,
      weather,
      autoDayCycle: typeof parsed.autoDayCycle === 'boolean' ? parsed.autoDayCycle : DEFAULT_PREFS.autoDayCycle,
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
