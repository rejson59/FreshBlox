export type ThemeMode = 'dark' | 'light'

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
