import React, { useEffect, useState } from 'react'
import {
  Bell,
  Camera,
  Check,
  CloudSnow,
  Copy,
  Crown,
  Gamepad2,
  Layers,
  Layout,
  Lightbulb,
  Lock,
  MessageCircle,
  Palette,
  RotateCcw,
  Shirt,
  Sliders,
  Sparkles,
  Timer,
  Trophy,
  Users,
  Wand2,
} from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from '../../data/brandTheme'
import { Lang } from '../../data/locales'
import { FRESH_LOADERS, FreshLoaderAnimation, LoaderPresetId } from '../loading/FreshLoaders'

interface ProposalsLabPanelProps {
  mode: ThemeMode
  lang: Lang
  selectedLoader: LoaderPresetId
}

const STORAGE_KEY = 'freshblox_selected_proposals_v1'

interface ThemeProposal {
  code: string
  namePl: string
  nameEn: string
  descPl: string
  descEn: string
  bg: string
  surface: string
  accent: string
  accent2: string
  text: string
  current?: boolean
}

const THEME_PROPOSALS: ThemeProposal[] = [
  {
    code: 'T-01',
    namePl: 'Arctic Sky (Obecny)',
    nameEn: 'Arctic Sky (Current)',
    descPl: 'Głęboki granat i czysty lodowy błękit — lekki i rozpoznawalny.',
    descEn: 'Deep navy & crisp arctic sky blue — clean signature identity.',
    bg: '#070D19',
    surface: '#0E1A30',
    accent: '#38BDF8',
    accent2: '#0EA5E9',
    text: '#F8FAFC',
    current: true,
  },
  {
    code: 'T-02',
    namePl: 'Midnight Emerald',
    nameEn: 'Midnight Emerald',
    descPl: 'Ciemny grafit i świeży neonowy szmaragd — nowoczesny gaming.',
    descEn: 'Dark graphite with fresh emerald neon accents.',
    bg: '#071110',
    surface: '#0E1F1D',
    accent: '#34D399',
    accent2: '#10B981',
    text: '#ECFDF5',
  },
  {
    code: 'T-03',
    namePl: 'Solar Gold',
    nameEn: 'Solar Gold',
    descPl: 'Granatowy mat z ciepłym bursztynem i złotem — styl premium.',
    descEn: 'Deep slate navy paired with warm amber-gold highlights.',
    bg: '#0B0F1A',
    surface: '#161C2D',
    accent: '#FBBF24',
    accent2: '#F59E0B',
    text: '#FFFBEB',
  },
  {
    code: 'T-04',
    namePl: 'Cyber Violet',
    nameEn: 'Cyber Violet',
    descPl: 'Obsydian z elektrycznym fioletem i cyjanem — klimat e-sportowy.',
    descEn: 'Obsidian dark canvas with electric violet & cyan glow.',
    bg: '#0A0817',
    surface: '#16112B',
    accent: '#A78BFA',
    accent2: '#22D3EE',
    text: '#F5F3FF',
  },
  {
    code: 'T-05',
    namePl: 'Volcanic Coral',
    nameEn: 'Volcanic Coral',
    descPl: 'Węglowy ciemny motyw z dynamicznym koralowym pomarańczem.',
    descEn: 'Charcoal matte paired with energetic coral-orange accents.',
    bg: '#120B0D',
    surface: '#211417',
    accent: '#FB7185',
    accent2: '#F97316',
    text: '#FFF1F2',
  },
  {
    code: 'T-06',
    namePl: 'Nordic Frost (Jasny)',
    nameEn: 'Nordic Frost (Light)',
    descPl: 'Ultracienkie białe szkło i chłodny kontrast dla fanów jasnego UI.',
    descEn: 'Crisp pearl-glass light canvas with cool arctic contrast.',
    bg: '#EFF6FF',
    surface: '#FFFFFF',
    accent: '#0284C7',
    accent2: '#38BDF8',
    text: '#0F172A',
  },
]

interface HudProposal {
  code: string
  namePl: string
  nameEn: string
  descPl: string
  descEn: string
  style: 'minimal' | 'esports' | 'island' | 'cinema'
}

const HUD_PROPOSALS: HudProposal[] = [
  {
    code: 'H-01',
    namePl: 'Minimal Glass',
    nameEn: 'Minimal Glass',
    descPl: 'Ultracienkie półprzezroczyste kapsuły tylko w rogach — maksymalna widoczność mapy.',
    descEn: 'Ultra-thin translucent pills tucked in corners for max visibility.',
    style: 'minimal',
  },
  {
    code: 'H-02',
    namePl: 'Esports Speedrun',
    nameEn: 'Esports Speedrun',
    descPl: 'Wyraźny licznik czasu (01:24.38) i etap centralnie u góry — idealny pod Obby 100.',
    descEn: 'Centered top speedrun timer & stage tracker built for Obby 100.',
    style: 'esports',
  },
  {
    code: 'H-03',
    namePl: 'Dynamic Pill Island',
    nameEn: 'Dynamic Pill Island',
    descPl: 'Jedna pływająca wyspa u góry ekranu, która rozwija się przy nowych etapach i alertach.',
    descEn: 'Single top floating island that expands smoothly for alerts & stages.',
    style: 'island',
  },
  {
    code: 'H-04',
    namePl: 'Cinema Auto-Hide',
    nameEn: 'Cinema Auto-Hide',
    descPl: 'Interfejs sam przygasa podczas biegu i płynnie pojawia się, gdy otwierasz menu lub czat.',
    descEn: 'HUD gently fades out while running and reappears on interaction.',
    style: 'cinema',
  },
]

interface TransitionProposal {
  code: string
  namePl: string
  nameEn: string
  descPl: string
  descEn: string
  variant: 'blur-tip' | 'minimal' | 'room-card'
}

const TRANSITION_PROPOSALS: TransitionProposal[] = [
  {
    code: 'W-01',
    namePl: 'Rozmyta Mapa 3D + Wskazówka',
    nameEn: 'Blurred 3D World + Tip',
    descPl: 'Podgląd mapy w rozmytym tle, Twoja animacja ładowania i przydatna porada sterowania.',
    descEn: 'Blurred 3D backdrop, your chosen loader animation & gameplay tip.',
    variant: 'blur-tip',
  },
  {
    code: 'W-02',
    namePl: 'Szybkie Przejście Minimal',
    nameEn: 'Instant Minimal Fade',
    descPl: 'Czyste ciemne tło, logo, wybrany loader i cienki pasek — maksymalna szybkość i klasa.',
    descEn: 'Clean dark canvas, emblem, chosen loader & sleek thin bar.',
    variant: 'minimal',
  },
  {
    code: 'W-03',
    namePl: 'Karta Pokoju i Statusu',
    nameEn: 'Room & Status Card',
    descPl: 'Pokazuje kod pokoju (#PUBLIC-1), liczbę graczy w środku i kroki łączenia z chmurą.',
    descEn: 'Displays room code, live players inside & cloud sync steps.',
    variant: 'room-card',
  },
]

type FeatureCategory = 'all' | 'gameplay' | 'social' | 'avatar' | 'ui'

interface FeatureProposal {
  code: string
  category: Exclude<FeatureCategory, 'all'>
  icon: React.ComponentType<{ className?: string }>
  accent: string
  titlePl: string
  titleEn: string
  descPl: string
  descEn: string
  impactPl: string
  impactEn: string
}

const FEATURE_PROPOSALS: FeatureProposal[] = [
  {
    code: 'U-01',
    category: 'gameplay',
    icon: Timer,
    accent: '#F59E0B',
    titlePl: 'Tryb Speedrun + Duch (Ghost) w Obby 100',
    titleEn: 'Speedrun Timer + Ghost in Obby 100',
    descPl: 'Dokładny stoper 00:00.00, rekord osobisty (PB), globalna tabela najszybszych przejść i półprzezroczysty duch rekordu.',
    descEn: 'Precision 00:00.00 timer, personal bests, global speedrun board & ghost runner.',
    impactPl: 'Ogromna regrywalność',
    impactEn: 'Huge replayability',
  },
  {
    code: 'U-02',
    category: 'social',
    icon: Users,
    accent: '#38BDF8',
    titlePl: 'System Drużyn / Imprez (Party)',
    titleEn: 'Friend Party System',
    descPl: 'Zbierz znajomych w grupę przed startem — lider jednym kliknięciem przenosi całą ekipę do tego samego pokoju.',
    descEn: 'Squad up before playing — party leader warps everyone into the same room.',
    impactPl: 'Wspólna gra',
    impactEn: 'Play together',
  },
  {
    code: 'U-03',
    category: 'gameplay',
    icon: Wand2,
    accent: '#A78BFA',
    titlePl: 'Koło Emotek (Radial Wheel pod G)',
    titleEn: 'Emote Radial Wheel (G key)',
    descPl: 'Eleganckie koło szybkich gestów i reakcji nad głową (Machanie, Taniec, Brawa, GG, Zwycięstwo) zamiast uczenia się klawiszy.',
    descEn: 'Sleek radial menu for quick emotes and overhead reactions.',
    impactPl: 'Wygoda w 3D',
    impactEn: '3D polish',
  },
  {
    code: 'U-04',
    category: 'social',
    icon: MessageCircle,
    accent: '#34D399',
    titlePl: 'Dymki Czatu 3D nad Awatarem',
    titleEn: '3D Overhead Chat Bubbles',
    descPl: 'Wiadomości z czatu pojawiają się na kilka sekund w czystych, zaokrąglonych dymkach bezpośrednio nad głową gracza.',
    descEn: 'Chat messages briefly pop up in crisp bubbles directly above avatars.',
    impactPl: 'Żywe Lobby',
    impactEn: 'Lively Lobby',
  },
  {
    code: 'U-05',
    category: 'avatar',
    icon: Shirt,
    accent: '#38BDF8',
    titlePl: 'Sloty Zestawów (1–5) w Szatni awatarów',
    titleEn: 'Saved Outfit Slots (1–5)',
    descPl: 'Zapisuj własne ulubione zestawy ubrań, czapek, twarzy i skóry, aby przełączać cały styl jednym kliknięciem.',
    descEn: 'Save custom outfit presets and swap your full look in one click.',
    impactPl: 'Personalizacja',
    impactEn: 'Customization',
  },
  {
    code: 'U-06',
    category: 'avatar',
    icon: Crown,
    accent: '#FBBF24',
    titlePl: 'Kolekcja Odznak i Osiągnięć na Profilu',
    titleEn: 'Profile Badges & Achievements',
    descPl: 'Odblokowywane odznaki (np. Pionier, Mistrz Obby, Bez Upadku, Nocny Marek) z możliwością przypięcia obok nicku.',
    descEn: 'Unlockable badges you can pin next to your username and profile.',
    impactPl: 'Prestiż konta',
    impactEn: 'Profile prestige',
  },
  {
    code: 'U-07',
    category: 'ui',
    icon: Camera,
    accent: '#22D3EE',
    titlePl: 'Tryb Foto 3D (Photo Mode)',
    titleEn: '3D Photo Mode',
    descPl: 'Ukrywa cały HUD jednym przyciskiem, pozwala swobodnie ustawić kamerę wokół awatara i pobrać czyste zdjęcie PNG.',
    descEn: 'Hides HUD, unlocks free orbit camera & downloads a crisp PNG screenshot.',
    impactPl: 'Zrzuty i dzielenie',
    impactEn: 'Shareable shots',
  },
  {
    code: 'U-08',
    category: 'social',
    icon: Lock,
    accent: '#FB7185',
    titlePl: 'Prywatne Pokoje na Hasło / dla Znajomych',
    titleEn: 'Password / Friends-Only Rooms',
    descPl: 'Zakładaj zamknięte pokoje w Lobby i Obby z opcją hasła, linku zaproszenia oraz uprawnieniami hosta.',
    descEn: 'Host private rooms with optional password & simple room controls.',
    impactPl: 'Kontrola pokoju',
    impactEn: 'Room control',
  },
  {
    code: 'U-09',
    category: 'social',
    icon: MessageCircle,
    accent: '#60A5FA',
    titlePl: 'Czat Prywatny (DM) ze Znajomymi',
    titleEn: 'Friend Direct Messages',
    descPl: 'Szybkie wiadomości prywatne między znajomymi w launcherze wraz z przyciskiem „Dołącz do gry” jednym kliknięciem.',
    descEn: 'Quick 1-on-1 messages in launcher with one-tap Join Game invites.',
    impactPl: 'Społeczność',
    impactEn: 'Social hub',
  },
  {
    code: 'U-10',
    category: 'avatar',
    icon: Sparkles,
    accent: '#F59E0B',
    titlePl: 'Pełna Ekonomia FreshGems + Passa 7 Dni',
    titleEn: 'FreshGems Economy + 7-Day Streak',
    descPl: 'Uruchomienie zdobywania FreshGems za codzienne logowanie, dzienne zadania i ukończenia Obby oraz odblokowanie sklepu.',
    descEn: 'Activate FreshGems earning via daily login streaks, quests & shop.',
    impactPl: 'Motywacja dzienna',
    impactEn: 'Daily retention',
  },
  {
    code: 'U-11',
    category: 'ui',
    icon: Sliders,
    accent: '#94A3B8',
    titlePl: 'Zaawansowane Ustawienia (FOV, Czułość, Grafika)',
    titleEn: 'Advanced Settings (FOV, Sens, Graphics)',
    descPl: 'Suwak pola widzenia FOV (60–100°), precyzyjna czułość myszki, zmiana skrótów klawiszowych oraz tryb Niska/Średnia/Wysoka grafika.',
    descEn: 'FOV slider, mouse sensitivity, custom keybinds & graphics presets.',
    impactPl: 'Komfort PC/Mobile',
    impactEn: 'PC & Mobile UX',
  },
  {
    code: 'U-12',
    category: 'gameplay',
    icon: CloudSnow,
    accent: '#7DD3FC',
    titlePl: 'Dynamiczna Pogoda i Cykl Dnia w Lobby',
    titleEn: 'Dynamic Weather & Day Cycle',
    descPl: 'Płynne wschody i zachody słońca nad Placem Głównym oraz opcjonalny delikatny śnieg lub deszcz spadających gwiazd nocą.',
    descEn: 'Smooth sunrises/sunsets plus optional snowfall or meteor showers.',
    impactPl: 'Klimat 3D',
    impactEn: '3D atmosphere',
  },
  {
    code: 'U-13',
    category: 'gameplay',
    icon: Trophy,
    accent: '#FBBF24',
    titlePl: 'Podium 3D Mistrzów w Lobby Głównym',
    titleEn: 'Live 3D Champions Podium in Lobby',
    descPl: 'Fizyczne podium na placu w Lobby, na którym stoją 3D statuetki-awatary TOP 3 graczy z rankingu Obby 100!',
    descEn: 'Physical plaza podium showcasing the real TOP 3 Obby champions in 3D.',
    impactPl: 'Efekt WOW',
    impactEn: 'WOW factor',
  },
  {
    code: 'U-14',
    category: 'ui',
    icon: Bell,
    accent: '#34D399',
    titlePl: 'Centrum Powiadomień w Górnym Pasku',
    titleEn: 'Top Bar Notification Center',
    descPl: 'Dzwoneczek z powiadomieniami: zaproszenia do znajomych, zaproszenia do pokoju i aktualizacje Twoich zgłoszeń.',
    descEn: 'Bell popover for friend requests, room invites & feedback updates.',
    impactPl: 'Przejrzystość',
    impactEn: 'Clarity',
  },
]

function loadSavedPicks(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export const ProposalsLabPanel: React.FC<ProposalsLabPanelProps> = ({
  mode,
  lang,
  selectedLoader,
}) => {
  const [picks, setPicks] = useState<string[]>(() => loadSavedPicks())
  const [featCat, setFeatCat] = useState<FeatureCategory>('all')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(picks))
    } catch {
      // ignore
    }
  }, [picks])

  const tokens = getThemeTokens(mode)
  const isDark = mode === 'dark'
  const isPl = lang === 'pl'

  const panelSurface = isDark ? '#0B1323' : '#FFFFFF'
  const panelBorder = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(14, 165, 233, 0.18)'
  const subtleSurface = isDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(14, 165, 233, 0.06)'

  const loaderMeta = FRESH_LOADERS.find((l) => l.id === selectedLoader) ?? FRESH_LOADERS[0]

  const togglePick = (code: string) => {
    setPicks((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
  }

  const allSelectedCodes = [loaderMeta.code, ...picks]

  const handleCopyPicks = () => {
    const text = isPl
      ? `Wybrane propozycje do FreshBlox: ${allSelectedCodes.join(', ')}`
      : `Selected FreshBlox proposals: ${allSelectedCodes.join(', ')}`
    void navigator.clipboard?.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const filteredFeatures =
    featCat === 'all' ? FEATURE_PROPOSALS : FEATURE_PROPOSALS.filter((f) => f.category === featCat)

  const featCatLabels: Record<FeatureCategory, { pl: string; en: string }> = {
    all: { pl: 'Wszystkie', en: 'All' },
    gameplay: { pl: 'Gameplay 3D', en: '3D Gameplay' },
    social: { pl: 'Społeczność', en: 'Social' },
    avatar: { pl: 'Awatar i Nagrody', en: 'Avatar & Rewards' },
    ui: { pl: 'UI / UX', en: 'UI / UX' },
  }

  return (
    <div className="space-y-5">
      {/* === STICKY SELECTION SUMMARY BAR === */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.14), rgba(11, 19, 35, 0.96))'
            : 'linear-gradient(135deg, rgba(56, 189, 248, 0.14), rgba(255, 255, 255, 0.98))',
          borderColor: 'rgba(56, 189, 248, 0.38)',
        }}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: tokens.textPrimary }}>
              {isPl ? 'Twoja lista wybranych ulepszeń' : 'Your Selected Proposals'}
            </span>
            <span className="rounded-md bg-sky-500/20 px-1.5 py-0.5 font-mono text-[10px] font-black text-sky-300">
              {allSelectedCodes.length}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md border border-sky-400/40 bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] font-black text-sky-200">
              {loaderMeta.code} ({isPl ? 'Ładowanie' : 'Loader'})
            </span>
            {picks.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => togglePick(code)}
                title={isPl ? 'Kliknij, aby odznaczyć' : 'Click to remove'}
                className="rounded-md border border-emerald-400/40 bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-black text-emerald-300 transition hover:bg-rose-500/25 hover:border-rose-400/50 hover:text-rose-200 cursor-pointer"
              >
                {code} ×
              </button>
            ))}
            {picks.length === 0 && (
              <span className="text-[11px]" style={{ color: tokens.textSecondary }}>
                {isPl
                  ? 'Kliknij „Wybierz” przy dowolnej propozycji poniżej, aby dodać ją do listy.'
                  : 'Click Select on any proposal below to build your wishlist.'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {picks.length > 0 && (
            <button
              type="button"
              onClick={() => setPicks([])}
              className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-extrabold transition cursor-pointer"
              style={{ borderColor: panelBorder, color: tokens.textSecondary }}
            >
              <RotateCcw className="h-3 w-3" />
              <span>{isPl ? 'Wyczyść' : 'Clear'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopyPicks}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-extrabold text-white transition hover:brightness-110 cursor-pointer"
            style={{ background: copied ? '#10B981' : ARCTIC_SKY.skyMain }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? (isPl ? 'Skopiowano!' : 'Copied!') : isPl ? 'Kopiuj wybrane' : 'Copy picks'}</span>
          </button>
        </div>
      </div>

      {/* ============================================================
          SECTION 1: COLOR THEME PROPOSALS (T-01 .. T-06)
      ============================================================ */}
      <section
        className="space-y-3 rounded-xl border p-4"
        style={{ background: panelSurface, borderColor: panelBorder }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-sky-400" />
            <h2 className="text-xs font-extrabold uppercase tracking-wider" style={{ color: tokens.textPrimary }}>
              {isPl ? '1. Motywy kolorystyczne launchera (T-01 – T-06)' : '1. Launcher Color Themes (T-01 – T-06)'}
            </h2>
          </div>
          <span className="text-[11px]" style={{ color: tokens.textSecondary }}>
            {isPl ? 'Opcjonalne skórki dla graczy' : 'Optional player themes'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {THEME_PROPOSALS.map((th) => {
            const picked = picks.includes(th.code)
            return (
              <div
                key={th.code}
                onClick={() => togglePick(th.code)}
                className="group flex flex-col overflow-hidden rounded-xl border transition cursor-pointer hover:brightness-105"
                style={{
                  background: isDark ? '#0D172B' : '#F8FBFF',
                  borderColor: picked ? '#34D399' : panelBorder,
                  boxShadow: picked ? '0 0 0 1px rgba(52, 211, 153, 0.45)' : 'none',
                }}
              >
                {/* Live Mini Launcher Mockup */}
                <div className="relative h-24 w-full p-2.5" style={{ background: th.bg }}>
                  <div className="flex h-full gap-2">
                    {/* Mini rail */}
                    <div
                      className="flex w-6 flex-col items-center justify-between rounded-md py-1.5"
                      style={{ background: th.surface }}
                    >
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: th.accent }} />
                      <span className="h-1.5 w-2.5 rounded-full opacity-40" style={{ background: th.text }} />
                      <span className="h-1.5 w-2.5 rounded-full opacity-40" style={{ background: th.text }} />
                    </div>
                    {/* Mini hero + cards */}
                    <div className="flex flex-1 flex-col gap-1.5">
                      <div
                        className="flex flex-1 items-center justify-between rounded-md px-2.5"
                        style={{
                          background: `linear-gradient(120deg, ${th.surface}, ${th.accent2}33)`,
                          border: `1px solid ${th.accent}33`,
                        }}
                      >
                        <div className="space-y-1">
                          <div className="h-1.5 w-14 rounded-full" style={{ background: th.text, opacity: 0.9 }} />
                          <div className="h-1 w-9 rounded-full" style={{ background: th.accent, opacity: 0.8 }} />
                        </div>
                        <span
                          className="rounded px-2 py-0.5 text-[8px] font-black"
                          style={{ background: th.accent, color: th.bg === '#EFF6FF' ? '#FFFFFF' : '#08101E' }}
                        >
                          GRAJ
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 h-6">
                        <div className="rounded-md" style={{ background: th.surface, border: `1px solid ${th.accent}22` }} />
                        <div className="rounded-md" style={{ background: th.surface, border: `1px solid ${th.accent2}22` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex items-start justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-black text-sky-400">{th.code}</span>
                      <span className="truncate text-xs font-extrabold" style={{ color: tokens.textPrimary }}>
                        {isPl ? th.namePl : th.nameEn}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug" style={{ color: tokens.textSecondary }}>
                      {isPl ? th.descPl : th.descEn}
                    </p>
                  </div>
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition"
                    style={{
                      background: picked ? '#10B981' : 'transparent',
                      borderColor: picked ? '#10B981' : panelBorder,
                      color: picked ? '#FFFFFF' : tokens.textSecondary,
                    }}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ============================================================
          SECTION 2: IN-GAME 3D HUD STYLES (H-01 .. H-04)
      ============================================================ */}
      <section
        className="space-y-3 rounded-xl border p-4"
        style={{ background: panelSurface, borderColor: panelBorder }}
      >
        <div className="flex items-center gap-2">
          <Layout className="h-4 w-4 text-emerald-400" />
          <h2 className="text-xs font-extrabold uppercase tracking-wider" style={{ color: tokens.textPrimary }}>
            {isPl ? '2. Style HUD w grach 3D (H-01 – H-04)' : '2. In-Game 3D HUD Layouts (H-01 – H-04)'}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {HUD_PROPOSALS.map((hud) => {
            const picked = picks.includes(hud.code)
            return (
              <div
                key={hud.code}
                onClick={() => togglePick(hud.code)}
                className="flex flex-col overflow-hidden rounded-xl border transition cursor-pointer hover:brightness-105"
                style={{
                  background: isDark ? '#0D172B' : '#F8FBFF',
                  borderColor: picked ? '#34D399' : panelBorder,
                  boxShadow: picked ? '0 0 0 1px rgba(52, 211, 153, 0.45)' : 'none',
                }}
              >
                {/* Mini 3D Viewport Mockup */}
                <div
                  className="relative h-28 w-full overflow-hidden p-2"
                  style={{
                    background: 'linear-gradient(180deg, #1E5A99 0%, #38BDF8 58%, #0E2945 58%, #09182D 100%)',
                  }}
                >
                  {/* Horizon stylized block */}
                  <div className="pointer-events-none absolute left-1/2 top-[54%] h-3 w-12 -translate-x-1/2 rounded-sm bg-sky-200/80 shadow" />

                  {hud.style === 'minimal' && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="rounded-md bg-slate-950/60 px-1.5 py-0.5 font-mono text-[8px] font-bold text-white backdrop-blur">
                          ☰ #OBBY-1
                        </span>
                        <span className="rounded-md bg-slate-950/60 px-1.5 py-0.5 font-mono text-[8px] font-bold text-amber-300 backdrop-blur">
                          42/100
                        </span>
                      </div>
                      <div className="absolute bottom-2 left-2 h-5 w-16 rounded-md bg-slate-950/50 backdrop-blur" />
                    </>
                  )}

                  {hud.style === 'esports' && (
                    <>
                      <div className="mx-auto flex w-fit items-center gap-2 rounded-lg border border-amber-400/50 bg-slate-950/85 px-2.5 py-1 font-mono text-[9px] font-black text-white shadow">
                        <span className="text-amber-300">ETAP 42</span>
                        <span className="opacity-40">|</span>
                        <span className="text-sky-300">01:24.38</span>
                      </div>
                      <div className="absolute bottom-2 right-2 rounded bg-slate-950/75 px-1.5 py-0.5 font-mono text-[8px] text-emerald-300">
                        60 FPS
                      </div>
                    </>
                  )}

                  {hud.style === 'island' && (
                    <div className="mx-auto flex w-fit items-center gap-1.5 rounded-full border border-sky-300/40 bg-slate-950/85 px-3 py-1 text-[8px] font-extrabold text-sky-100 shadow-lg backdrop-blur">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span>Checkpoint #42</span>
                      <span className="text-sky-400">• 3 graczy</span>
                    </div>
                  )}

                  {hud.style === 'cinema' && (
                    <div className="flex h-full flex-col items-center justify-between">
                      <span className="rounded-full bg-slate-950/35 px-2 py-0.5 text-[8px] font-bold text-white/60">
                        Auto-Hide HUD
                      </span>
                      <span className="rounded bg-slate-950/45 px-2 py-0.5 font-mono text-[8px] text-white/75">
                        ESC — Menu
                      </span>
                    </div>
                  )}
                </div>

                {/* Meta */}
                <div className="flex flex-1 items-start justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-black text-emerald-400">{hud.code}</span>
                      <span className="truncate text-xs font-extrabold" style={{ color: tokens.textPrimary }}>
                        {isPl ? hud.namePl : hud.nameEn}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug" style={{ color: tokens.textSecondary }}>
                      {isPl ? hud.descPl : hud.descEn}
                    </p>
                  </div>
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition"
                    style={{
                      background: picked ? '#10B981' : 'transparent',
                      borderColor: picked ? '#10B981' : panelBorder,
                      color: picked ? '#FFFFFF' : tokens.textSecondary,
                    }}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ============================================================
          SECTION 3: WORLD TRANSITION SCREENS (W-01 .. W-03)
      ============================================================ */}
      <section
        className="space-y-3 rounded-xl border p-4"
        style={{ background: panelSurface, borderColor: panelBorder }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-amber-400" />
            <h2 className="text-xs font-extrabold uppercase tracking-wider" style={{ color: tokens.textPrimary }}>
              {isPl ? '3. Ekran wejścia do świata 3D (W-01 – W-03)' : '3. World Entry Transition (W-01 – W-03)'}
            </h2>
          </div>
          <span className="font-mono text-[10px] font-bold text-sky-400">
            {isPl ? `Podgląd z ${loaderMeta.code}` : `Live with ${loaderMeta.code}`}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {TRANSITION_PROPOSALS.map((tr) => {
            const picked = picks.includes(tr.code)
            return (
              <div
                key={tr.code}
                onClick={() => togglePick(tr.code)}
                className="flex flex-col overflow-hidden rounded-xl border transition cursor-pointer hover:brightness-105"
                style={{
                  background: isDark ? '#0D172B' : '#F8FBFF',
                  borderColor: picked ? '#34D399' : panelBorder,
                  boxShadow: picked ? '0 0 0 1px rgba(52, 211, 153, 0.45)' : 'none',
                }}
              >
                <div
                  className="relative flex h-32 flex-col items-center justify-center gap-1.5 overflow-hidden px-4 text-center"
                  style={{
                    background:
                      tr.variant === 'blur-tip'
                        ? 'radial-gradient(circle at 30% 30%, rgba(56,189,248,0.34), rgba(7,13,25,0.96) 72%)'
                        : tr.variant === 'minimal'
                        ? '#060B16'
                        : 'linear-gradient(135deg, #091529 0%, #0F2342 100%)',
                  }}
                >
                  <FreshLoaderAnimation id={selectedLoader} size="sm" mode="dark" />
                  {tr.variant === 'blur-tip' && (
                    <span className="rounded-md bg-slate-950/65 px-2 py-0.5 text-[9px] font-bold text-sky-200 border border-white/10">
                      {isPl ? 'Porada: Wciśnij Shift, aby biec szybciej' : 'Tip: Hold Shift to sprint faster'}
                    </span>
                  )}
                  {tr.variant === 'minimal' && (
                    <div className="h-1 w-28 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full w-2/3 rounded-full bg-sky-400" />
                    </div>
                  )}
                  {tr.variant === 'room-card' && (
                    <div className="flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-slate-950/70 px-2.5 py-1 font-mono text-[9px] font-bold text-sky-100">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span>LOBBY #PUBLIC-1</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 items-start justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-black text-amber-400">{tr.code}</span>
                      <span className="truncate text-xs font-extrabold" style={{ color: tokens.textPrimary }}>
                        {isPl ? tr.namePl : tr.nameEn}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug" style={{ color: tokens.textSecondary }}>
                      {isPl ? tr.descPl : tr.descEn}
                    </p>
                  </div>
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition"
                    style={{
                      background: picked ? '#10B981' : 'transparent',
                      borderColor: picked ? '#10B981' : panelBorder,
                      color: picked ? '#FFFFFF' : tokens.textSecondary,
                    }}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ============================================================
          SECTION 4: FEATURE & UPGRADE PROPOSALS (U-01 .. U-14)
      ============================================================ */}
      <section
        className="space-y-3 rounded-xl border p-4"
        style={{ background: panelSurface, borderColor: panelBorder }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-sky-400" />
            <h2 className="text-xs font-extrabold uppercase tracking-wider" style={{ color: tokens.textPrimary }}>
              {isPl ? '4. Propozycje nowych funkcji i ulepszeń (U-01 – U-14)' : '4. Feature & Upgrade Proposals (U-01 – U-14)'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'gameplay', 'social', 'avatar', 'ui'] as FeatureCategory[]).map((cat) => {
              const active = featCat === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFeatCat(cat)}
                  className="rounded-lg border px-2 py-1 text-[10px] font-extrabold transition cursor-pointer"
                  style={{
                    background: active ? 'rgba(14, 165, 233, 0.18)' : 'transparent',
                    borderColor: active ? 'rgba(56, 189, 248, 0.45)' : panelBorder,
                    color: active ? ARCTIC_SKY.skyBright : tokens.textSecondary,
                  }}
                >
                  {isPl ? featCatLabels[cat].pl : featCatLabels[cat].en}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {filteredFeatures.map((feat) => {
            const Icon = feat.icon
            const picked = picks.includes(feat.code)
            return (
              <div
                key={feat.code}
                onClick={() => togglePick(feat.code)}
                className="flex items-start gap-3 rounded-xl border p-3 transition cursor-pointer hover:brightness-105"
                style={{
                  background: picked ? 'rgba(16, 185, 129, 0.08)' : subtleSurface,
                  borderColor: picked ? 'rgba(52, 211, 153, 0.5)' : panelBorder,
                }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `${feat.accent}20`, color: feat.accent }}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10px] font-black" style={{ color: feat.accent }}>
                      {feat.code}
                    </span>
                    <h3 className="text-xs font-extrabold" style={{ color: tokens.textPrimary }}>
                      {isPl ? feat.titlePl : feat.titleEn}
                    </h3>
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: tokens.textSecondary }}>
                    {isPl ? feat.descPl : feat.descEn}
                  </p>
                  <div className="flex items-center justify-between pt-0.5">
                    <span
                      className="rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
                      style={{ background: `${feat.accent}18`, color: feat.accent }}
                    >
                      {isPl ? feat.impactPl : feat.impactEn}
                    </span>

                    <span
                      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold"
                      style={{
                        background: picked ? '#10B981' : 'rgba(148, 163, 184, 0.14)',
                        color: picked ? '#FFFFFF' : tokens.textSecondary,
                      }}
                    >
                      {picked && <Check className="h-3 w-3" />}
                      {picked ? (isPl ? 'Wybrane' : 'Selected') : isPl ? 'Chcę to' : 'Pick'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
