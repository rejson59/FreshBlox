import { isLoaderPresetId, LoaderPresetId } from '../components/loading/FreshLoaders'

export interface FreshLabFlags {
  /** Live FPS + coordinates / speed telemetry chip inside 3D worlds */
  showPerfOverlay: boolean
  /** Allow jumping to any Parkour stage (1..100) for testing */
  unlockAllObbyStages: boolean
  /** Test high-speed movement multiplier in 3D worlds */
  turboMovement: boolean
  /** Show extra debug metadata on cards & HUD */
  verboseDebugBadges: boolean
  /** Selected loading screen animation preset (default: L-02 Arctic 3D Glass Cube) */
  loaderPreset: LoaderPresetId
}

export const DEFAULT_LAB_FLAGS: FreshLabFlags = {
  showPerfOverlay: false,
  unlockAllObbyStages: false,
  turboMovement: false,
  verboseDebugBadges: false,
  loaderPreset: 'cube-3d',
}

const STORAGE_KEY = 'freshblox_lab_flags_v2'
const LEGACY_KEY = 'freshblox_lab_flags_v1'

export function loadLabFlags(): FreshLabFlags {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FreshLabFlags>
      return {
        showPerfOverlay: Boolean(parsed.showPerfOverlay),
        unlockAllObbyStages: Boolean(parsed.unlockAllObbyStages),
        turboMovement: Boolean(parsed.turboMovement),
        verboseDebugBadges: Boolean(parsed.verboseDebugBadges),
        loaderPreset: isLoaderPresetId(parsed.loaderPreset)
          ? parsed.loaderPreset
          : DEFAULT_LAB_FLAGS.loaderPreset,
      }
    }
    // One-time migration of boolean flags from v1 while activating the new cube-3d default loader
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy) as Partial<FreshLabFlags>
      return {
        showPerfOverlay: Boolean(parsed.showPerfOverlay),
        unlockAllObbyStages: Boolean(parsed.unlockAllObbyStages),
        turboMovement: Boolean(parsed.turboMovement),
        verboseDebugBadges: Boolean(parsed.verboseDebugBadges),
        loaderPreset: DEFAULT_LAB_FLAGS.loaderPreset,
      }
    }
    return { ...DEFAULT_LAB_FLAGS }
  } catch {
    return { ...DEFAULT_LAB_FLAGS }
  }
}

export function saveLabFlags(flags: FreshLabFlags): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags))
  } catch {
    // ignore storage errors
  }
}
