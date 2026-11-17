export type ThemeMode = 'dark' | 'light'

export type ThemePresetId =
  | 'arctic-sky'
  | 'midnight-emerald'
  | 'solar-gold'
  | 'cyber-violet'
  | 'volcanic-coral'
  | 'nordic-frost'

export interface FreshThemePreset {
  id: ThemePresetId
  code: string
  mode: ThemeMode
  namePl: string
  nameEn: string
  shellBg: string
  railBg: string
  topBarBg: string
  panelBg: string
  sidebarBg: string
  border: string
  accent: string
  accentDeep: string
  accentSoft: string
  buttonGradient: string
}

export const FRESH_THEMES: FreshThemePreset[] = [
  {
    id: 'arctic-sky',
    code: 'T-01',
    mode: 'dark',
    namePl: 'Arctic Sky',
    nameEn: 'Arctic Sky',
    shellBg: '#070D19',
    railBg: '#050A14',
    topBarBg: 'rgba(7, 13, 25, 0.90)',
    panelBg: '#0B1323',
    sidebarBg: '#080F1D',
    border: 'rgba(148, 163, 184, 0.14)',
    accent: '#38BDF8',
    accentDeep: '#0284C7',
    accentSoft: 'rgba(56, 189, 248, 0.16)',
    buttonGradient: 'linear-gradient(135deg, #0284C7 0%, #38BDF8 62%, #7DD3FC 100%)',
  },
  {
    id: 'midnight-emerald',
    code: 'T-02',
    mode: 'dark',
    namePl: 'Midnight Emerald',
    nameEn: 'Midnight Emerald',
    shellBg: '#06100F',
    railBg: '#040B0A',
    topBarBg: 'rgba(6, 16, 15, 0.92)',
    panelBg: '#0B1B19',
    sidebarBg: '#081413',
    border: 'rgba(52, 211, 153, 0.18)',
    accent: '#34D399',
    accentDeep: '#059669',
    accentSoft: 'rgba(52, 211, 153, 0.16)',
    buttonGradient: 'linear-gradient(135deg, #059669 0%, #10B981 58%, #34D399 100%)',
  },
  {
    id: 'solar-gold',
    code: 'T-03',
    mode: 'dark',
    namePl: 'Solar Gold',
    nameEn: 'Solar Gold',
    shellBg: '#0B0F1A',
    railBg: '#070A12',
    topBarBg: 'rgba(11, 15, 26, 0.92)',
    panelBg: '#141B2B',
    sidebarBg: '#0E1320',
    border: 'rgba(251, 191, 36, 0.18)',
    accent: '#FBBF24',
    accentDeep: '#D97706',
    accentSoft: 'rgba(251, 191, 36, 0.16)',
    buttonGradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 58%, #FCD34D 100%)',
  },
  {
    id: 'cyber-violet',
    code: 'T-04',
    mode: 'dark',
    namePl: 'Cyber Violet',
    nameEn: 'Cyber Violet',
    shellBg: '#090716',
    railBg: '#060410',
    topBarBg: 'rgba(9, 7, 22, 0.92)',
    panelBg: '#130F26',
    sidebarBg: '#0D0A1C',
    border: 'rgba(167, 139, 250, 0.20)',
    accent: '#A78BFA',
    accentDeep: '#7C3AED',
    accentSoft: 'rgba(167, 139, 250, 0.18)',
    buttonGradient: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 55%, #22D3EE 100%)',
  },
  {
    id: 'volcanic-coral',
    code: 'T-05',
    mode: 'dark',
    namePl: 'Volcanic Coral',
    nameEn: 'Volcanic Coral',
    shellBg: '#120A0D',
    railBg: '#0B0608',
    topBarBg: 'rgba(18, 10, 13, 0.92)',
    panelBg: '#1E1116',
    sidebarBg: '#160C10',
    border: 'rgba(251, 113, 133, 0.20)',
    accent: '#FB7185',
    accentDeep: '#E11D48',
    accentSoft: 'rgba(251, 113, 133, 0.16)',
    buttonGradient: 'linear-gradient(135deg, #E11D48 0%, #F97316 58%, #FB7185 100%)',
  },
  {
    id: 'nordic-frost',
    code: 'T-06',
    mode: 'light',
    namePl: 'Nordic Frost',
    nameEn: 'Nordic Frost',
    shellBg: '#EFF6FF',
    railBg: '#FFFFFF',
    topBarBg: 'rgba(255, 255, 255, 0.92)',
    panelBg: '#FFFFFF',
    sidebarBg: '#F4F9FF',
    border: 'rgba(14, 165, 233, 0.18)',
    accent: '#0284C7',
    accentDeep: '#0369A1',
    accentSoft: 'rgba(14, 165, 233, 0.12)',
    buttonGradient: 'linear-gradient(135deg, #0284C7 0%, #0EA5E9 58%, #38BDF8 100%)',
  },
]

const THEME_STORAGE_KEY = 'freshblox_theme_preset_v1'

export function isThemePresetId(val: unknown): val is ThemePresetId {
  return typeof val === 'string' && FRESH_THEMES.some((t) => t.id === val)
}

export function getThemePreset(id: ThemePresetId): FreshThemePreset {
  return FRESH_THEMES.find((t) => t.id === id) ?? FRESH_THEMES[0]
}

export function loadThemePreset(): ThemePresetId {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (isThemePresetId(raw)) return raw
  } catch {
    // ignore
  }
  return 'arctic-sky'
}

export function saveThemePreset(id: ThemePresetId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id)
  } catch {
    // ignore
  }
}

export function applyThemeCssVars(id: ThemePresetId): void {
  if (typeof document === 'undefined') return
  const preset = getThemePreset(id)
  const root = document.documentElement
  root.dataset.themePreset = preset.id
  root.style.setProperty('--fb-shell-bg', preset.shellBg)
  root.style.setProperty('--fb-rail-bg', preset.railBg)
  root.style.setProperty('--fb-topbar-bg', preset.topBarBg)
  root.style.setProperty('--fb-panel-bg', preset.panelBg)
  root.style.setProperty('--fb-sidebar-bg', preset.sidebarBg)
  root.style.setProperty('--fb-border', preset.border)
  root.style.setProperty('--fb-accent', preset.accent)
  root.style.setProperty('--fb-accent-deep', preset.accentDeep)
  root.style.setProperty('--fb-accent-soft', preset.accentSoft)
  root.style.backgroundColor = preset.shellBg
  document.body.style.backgroundColor = preset.shellBg
}

export const ARCTIC_SKY = {
  skyDeep: '#0284C7',
  skyMain: '#38BDF8',
  skyBright: '#BAE6FD',
  iceWhite: '#FFFFFF',
  auraGlow: '#38BDF8',
  dark: {
    pageBg:
      'radial-gradient(ellipse 85% 50% at 50% -10%, rgba(56, 189, 248, 0.25), transparent 65%), radial-gradient(ellipse 60% 42% at 92% 24%, rgba(14, 165, 233, 0.15), transparent 60%), linear-gradient(180deg, #06101F 0%, #071528 50%, #050C18 100%)',
    heroGradient:
      'linear-gradient(135deg, rgba(2, 132, 199, 0.32) 0%, rgba(56, 189, 248, 0.16) 50%, rgba(224, 242, 254, 0.08) 100%)',
    cardBg: 'rgba(11, 24, 44, 0.76)',
    cardSolid: '#0B182C',
    cardBorder: 'rgba(125, 211, 252, 0.18)',
    cardHoverBorder: 'rgba(56, 189, 248, 0.62)',
    textPrimary: '#F0F9FF',
    textSecondary: '#94B8D7',
    mutedBg: 'rgba(56, 189, 248, 0.09)',
    buttonGradient: 'linear-gradient(135deg, #0284C7 0%, #38BDF8 58%, #7DD3FC 100%)',
    badgeBg: 'rgba(56, 189, 248, 0.16)',
    badgeText: '#7DD3FC',
    navBg: 'rgba(6, 16, 31, 0.84)',
  },
  light: {
    pageBg:
      'radial-gradient(ellipse 85% 48% at 50% -8%, rgba(56, 189, 248, 0.34), transparent 65%), radial-gradient(ellipse 55% 45% at 94% 22%, rgba(125, 211, 252, 0.28), transparent 60%), linear-gradient(180deg, #E1F3FF 0%, #F3FAFF 48%, #FFFFFF 100%)',
    heroGradient:
      'linear-gradient(135deg, rgba(2, 132, 199, 0.22) 0%, rgba(125, 211, 252, 0.30) 52%, rgba(255, 255, 255, 0.94) 100%)',
    cardBg: 'rgba(255, 255, 255, 0.86)',
    cardSolid: '#FFFFFF',
    cardBorder: 'rgba(56, 189, 248, 0.28)',
    cardHoverBorder: 'rgba(2, 132, 199, 0.62)',
    textPrimary: '#0B1E33',
    textSecondary: '#3E607E',
    mutedBg: 'rgba(56, 189, 248, 0.11)',
    buttonGradient: 'linear-gradient(135deg, #0284C7 0%, #0EA5E9 58%, #38BDF8 100%)',
    badgeBg: 'rgba(14, 165, 233, 0.13)',
    badgeText: '#0369A1',
    navBg: 'rgba(240, 249, 255, 0.86)',
  },
} as const

export function getThemeTokens(mode: ThemeMode) {
  return mode === 'dark' ? ARCTIC_SKY.dark : ARCTIC_SKY.light
}
