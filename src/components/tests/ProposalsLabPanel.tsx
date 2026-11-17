import React, { useEffect, useState } from 'react'
import {
  Award,
  Camera,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  CreditCard,
  Crown,
  Flame,
  Gamepad2,
  Gift,
  Hammer,
  Headphones,
  Layers,
  Lightbulb,
  Music,
  RotateCcw,
  Shield,
  ShoppingBag,
  Sparkles,
  Tag,
  Ticket,
  Trophy,
  Users,
  Volume2,
  Wand2,
} from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from '../../data/brandTheme'
import { Lang } from '../../data/locales'
import { LoaderPresetId } from '../loading/FreshLoaders'

interface ProposalsLabPanelProps {
  mode: ThemeMode
  lang: Lang
  selectedLoader: LoaderPresetId
}

const STORAGE_KEY_V2 = 'freshblox_selected_proposals_v2'

interface Wave2Proposal {
  code: string
  category: 'economy' | 'games' | 'audio' | 'platform'
  titlePl: string
  titleEn: string
  descPl: string
  descEn: string
  detailPl: string
  detailEn: string
  accent: string
  badgePl?: string
  badgeEn?: string
  icon: React.ComponentType<{ className?: string }>
}

const WAVE1_IMPLEMENTED = [
  'L-02 + W-01/W-02/W-03 (Szklany Sześcian 3D + tło mapy + pasek + status + tip)',
  'T-01..T-06 (6 Motywów kolorystycznych w TopBarze i lewym pasku)',
  'H-02 + U-01 (Esports Speedrun HUD + stoper 00:00.00 + zapis PB + 3D Duch PB)',
  'U-02 (System Drużyn / Party — wspólne wejście do pokoju)',
  'U-03 (Koło Emotek pod klawiszem G w obu światach 3D)',
  'U-04 (Nowe zaokrąglone 3D Chmurki Czatu z pop-in)',
  'U-05 (5 Zapisanych Zestawów Ubrań w Szatni awatarów)',
  'U-06 (Kolekcja Prawdziwych Odznak + przypinanie ulubionej)',
  'U-08 (Prywatne Pokoje na hasło / tylko dla znajomych w Supabase)',
  'U-09 (Wiadomości Prywatne 1-na-1 DM ze znajomymi + zaproszenia)',
  'U-11 (Suwak FOV 60–100° i zaawansowane ustawienia w mini-menu)',
  'U-12 (Pogoda w Lobby: Śnieg / Deszcz Gwiazd + Auto-cykl dnia)',
  'U-13 (Fizyczne 3D Podium Mistrzów TOP 3 z Supabase w Lobby)',
  'U-14 (Centrum Powiadomień z dzwoneczkiem w TopBarze)',
]

const WAVE2_PROPOSALS: Wave2Proposal[] = [
  // === 1. EKONOMIA FRESHGEMS & MONETYZACJA ===
  {
    code: 'E-01',
    category: 'economy',
    titlePl: 'Odblokowanie Ekonomii FreshGems (Zero Pay-to-Win)',
    titleEn: 'Unlock FreshGems Economy (Zero Pay-to-Win)',
    descPl: 'Włączamy pełny obieg FreshGems: zarabianie za Obby, dzienne misje, passę logowania i bezpieczny zakup strojów/czapek po stronie serwera.',
    descEn: 'Activate full server-verified FreshGems flow: earn from Obby, daily quests, streaks, and buy cosmetics securely.',
    detailPl: 'Walidacja salda w Supabase RPC (brak możliwości oszustwa w przeglądarce) + pełna historia transakcji.',
    detailEn: 'Server-side Supabase RPC ledger validation + full transaction history.',
    accent: '#38BDF8',
    badgePl: 'Fundament',
    badgeEn: 'Core',
    icon: Coins,
  },
  {
    code: 'E-02',
    category: 'economy',
    titlePl: 'Pakiety FreshGems — Stripe (BLIK / Przelewy24 / Karta)',
    titleEn: 'FreshGems Packs — Stripe (BLIK / P24 / Card)',
    descPl: 'Bezpieczny sklep doładowań przez Stripe Checkout z natywnym BLIK, Przelewy24, Apple Pay i kartą + webhook automatycznie dopisujący Gemsy.',
    descEn: 'Secure Stripe Checkout top-up packs with BLIK, P24, Apple Pay, and Cards + webhook fulfillment.',
    detailPl: 'Przykładowe progi: 500 Gems (9,99 zł), 1 200 Gems (19,99 zł +20%), 2 800 Gems (39,99 zł +40%), 6 500 Gems (79,99 zł +60%).',
    detailEn: 'Sample tiers: 500 / 1,200 / 2,800 / 6,500 Gems with bonus multipliers.',
    accent: '#10B981',
    badgePl: 'Płatności',
    badgeEn: 'Payments',
    icon: CreditCard,
  },
  {
    code: 'E-03',
    category: 'economy',
    titlePl: 'Arctic Pass (Karnet Sezonowy 30 Poziomów)',
    titleEn: 'Arctic Pass (30-Tier Season Pass)',
    descPl: 'Darmowa ścieżka dla każdego + ścieżka Premium (za FreshGems lub 19,99 zł) z ekskluzywnymi czapkami, emotkami, śladami kroków i odznaką sezonu.',
    descEn: 'Free track for everyone + Premium track with exclusive hats, trails, emotes, and season badge.',
    detailPl: 'Gracz aktywnie grając w sezonie odzyskuje do 40% kosztu karnetu w FreshGems — wysoka retencja i pełna uczciwość.',
    detailEn: 'Active players earn back up to 40% of pass cost in FreshGems.',
    accent: '#F59E0B',
    badgePl: 'Najwyższy zwrot',
    badgeEn: 'Top Value',
    icon: Ticket,
  },
  {
    code: 'E-04',
    category: 'economy',
    titlePl: 'Ranga VIP / FreshBlox+ (Subskrypcja Miesięczna)',
    titleEn: 'VIP / FreshBlox+ Monthly Membership',
    descPl: '14,99 zł/mies.: miesięczna paczka 600 FreshGems, złota odznaka VIP, +20% XP, 10 slotów strojów i priorytetowe pokoje prywatne.',
    descEn: 'Monthly membership: 600 Gems stipend, VIP badge, +20% XP, 10 outfit slots & priority private rooms.',
    detailPl: 'Wyłącznie wygoda i prestiż — zero przewagi fizycznej (skok/prędkość) w Obby i minigrach.',
    detailEn: 'Strictly prestige & QoL — zero gameplay advantage in Obby or minigames.',
    accent: '#A78BFA',
    icon: Crown,
  },
  {
    code: 'E-05',
    category: 'economy',
    titlePl: 'Sklep Rotacyjny „Oferta Dnia” i Kolekcje Limitowane',
    titleEn: 'Rotating Daily Shop & Limited Drops',
    descPl: 'Co 24h odświeżana rotacja wybranych kosmetyków + weekendowe limitowane dropy (np. Kryształowe Skrzydła, Lodowy Smok na ramię).',
    descEn: 'Daily 24h cosmetic rotation plus weekend limited-edition drops.',
    detailPl: 'Buduje nawyk codziennych odwiedzin bez agresywnych lootboxów (zawsze widzisz dokładnie co kupujesz!).',
    detailEn: 'Drives daily engagement with 100% transparent direct purchases (no lootboxes).',
    accent: '#FB7185',
    icon: ShoppingBag,
  },
  {
    code: 'E-06',
    category: 'economy',
    titlePl: 'Dzienny Kalendarz Logowania (7-Dniowa Passa)',
    titleEn: '7-Day Login Streak Rewards',
    descPl: 'Darmowe nagrody za kolejne dni obecności: FreshGems, XP boost i specjalna czapka za 7. dzień pod rząd.',
    descEn: 'Free consecutive daily rewards: FreshGems, XP boosts, and a day-7 exclusive cosmetic.',
    detailPl: 'Darmowi gracze zawsze mają frajdę i mogą uzbierać na wymarzone przedmioty samą grą.',
    detailEn: 'Free-to-play players steadily earn cosmetics just by playing.',
    accent: '#34D399',
    icon: Flame,
  },
  {
    code: 'E-07',
    category: 'economy',
    titlePl: 'Kody Promocyjne (Creator / Event Codes) w Panelu Admina',
    titleEn: 'Promo / Creator Codes in Admin Panel',
    descPl: 'Właściciel tworzy w Panelu Admina kody typu FRESH2026 (limit użyć, data wygaśnięcia, nagroda Gems/przedmiot), a gracze wpisują je w launcherze.',
    descEn: 'Owner mints limited promo codes in Admin Panel; players redeem them for Gems or items.',
    detailPl: 'Idealne na promocje na TikToku, YouTube, Discordzie i nagrody w konkursach społeczności.',
    detailEn: 'Perfect for TikTok/YouTube/Discord drops and community giveaways.',
    accent: '#22D3EE',
    icon: Tag,
  },
  {
    code: 'E-08',
    category: 'economy',
    titlePl: 'Prezenty dla Znajomych (Gifting w Sklepie)',
    titleEn: 'Gift Cosmetics to Friends',
    descPl: 'Możliwość wysłania znajomemu dowolnego stroju, czapki lub Karnetu jako zapakowany prezent z dedykacją w Centrum Powiadomień.',
    descEn: 'Send any outfit, hat, or pass as a wrapped gift with a note to a friend.',
    detailPl: 'Zwiększa interakcje społeczne i konwersję przy urodzinach oraz wspólnej grze w Party.',
    detailEn: 'Boosts social bonding and organic monetization between friends.',
    accent: '#F472B6',
    icon: Gift,
  },

  // === 2. NOWE GRY I MINIGRY 3D ===
  {
    code: 'G-01',
    category: 'games',
    titlePl: 'Tower of Frost (Wieża Parkour na Czas)',
    titleEn: 'Tower of Frost (Timed Parkour Tower)',
    descPl: 'Pionowa wieża z 6 losowymi kolorowymi sekcjami co 6 minut — wszyscy gracze w pokoju wspinają się naraz bez checkpointów!',
    descEn: 'Vertical 6-section randomized parkour tower every 6 minutes — zero checkpoints, race everyone!',
    detailPl: 'Ogromna regrywalność — każdy mecz ma inną kombinację sekcji i nagradza FreshGems na szczycie.',
    detailEn: 'Massive replayability with fresh stage combos every round.',
    accent: '#38BDF8',
    badgePl: 'Hit 3D',
    badgeEn: '3D Hit',
    icon: Trophy,
  },
  {
    code: 'G-02',
    category: 'games',
    titlePl: 'Ice Floor Arena (Znikające Kafelki PvP)',
    titleEn: 'Ice Floor Arena (Falling Tiles PvP)',
    descPl: '3-poziomowa arena lodowa — każdy kafelek, po którym przebiegniesz, pęka i znika po 0.6s. Ostatni gracz na górze wygrywa rundę!',
    descEn: '3-layer falling-tile arena — tiles crack and vanish 0.6s after being stepped on. Last player standing wins!',
    detailPl: 'Szybkie 90-sekundowe rundy idealne dla znajomych w Party.',
    detailEn: 'Fast 90-second rounds built for squads and Parties.',
    accent: '#22D3EE',
    icon: Layers,
  },
  {
    code: 'G-03',
    category: 'games',
    titlePl: 'Chowany 3D (Hide & Seek) na Mapie Lobby',
    titleEn: '3D Hide & Seek on Lobby Map',
    descPl: 'Jeden szukający, reszta chowa się po placu, tarasie i za portalami. 3 minuty na przetrwanie + bonusowe kryjówki!',
    descEn: 'One seeker, everyone else hides across the plaza and sky terrace for 3 minutes.',
    detailPl: 'Wykorzystuje istniejące Lobby Główne z nowymi interaktywnymi kryjówkami.',
    detailEn: 'Reuses Main Lobby with secret hiding spots and radar pings.',
    accent: '#A78BFA',
    icon: Gamepad2,
  },
  {
    code: 'G-04',
    category: 'games',
    titlePl: 'Eventy w Lobby: Deszcz Kryształów co 10 min',
    titleEn: 'Lobby Live Events: Crystal Rain every 10m',
    descPl: 'Co 10 minut na Placu Głównym z nieba spadają świecące kryształy FreshGems — kto złapie więcej w 45 sekund, dostaje premię!',
    descEn: 'Every 10 minutes glowing FreshGems rain onto the plaza — 45s scramble for bonus rewards!',
    detailPl: 'Ożywia Lobby Główne i daje powód do spędzania czasu na placu ze znajomymi.',
    detailEn: 'Keeps Main Lobby lively between Obby runs.',
    accent: '#FBBF24',
    icon: Sparkles,
  },
  {
    code: 'G-05',
    category: 'games',
    titlePl: 'Red Light / Green Light 3D (Światło Czerwone)',
    titleEn: 'Red Light / Green Light 3D',
    descPl: 'Klasyczny wyścig do mety — ruszysz się na czerwonym świetle, wracasz na start! Świetne dla dużych pokoi.',
    descEn: 'Classic sprint-and-freeze race — move on red light and reset to start!',
    detailPl: 'Proste zasady zrozumiałe w 3 sekundy dla każdego nowego gracza.',
    detailEn: 'Instant 3-second onboarding for new players.',
    accent: '#FB7185',
    icon: Flame,
  },
  {
    code: 'G-06',
    category: 'games',
    titlePl: 'Kreator Własnych Mini-Obby (Edytor Graczy)',
    titleEn: 'Player Mini-Obby Builder (UGC)',
    descPl: 'Gracze układają własne 10-etapowe tory z klocków, udostępniają kod i zbierają polubienia na liście społeczności!',
    descEn: 'Players build 10-stage obstacle courses, publish share codes, and earn likes.',
    detailPl: 'Pierwszy krok do prawdziwej platformy UGC tworzonej przez samych graczy.',
    detailEn: 'First milestone toward full user-generated 3D worlds.',
    accent: '#34D399',
    icon: Hammer,
  },

  // === 3. AUDIO 2.0 ===
  {
    code: 'A-01',
    category: 'audio',
    titlePl: 'Nowoczesne Dźwięki UI i Rozgrywki 2.0',
    titleEn: 'Modern UI & Gameplay SFX 2.0',
    descPl: 'Całkowicie nowe, czyste, lekkie efekty dźwiękowe (miękki skok, kryształowy checkpoint, subtelny klik, dźwięk wygranej) z indywidualnymi suwakami.',
    descEn: 'Brand-new crisp, lightweight sound design (soft jump, crystal checkpoint, clean UI clicks) with volume sliders.',
    detailPl: 'Domyślnie subtelna głośność + szybkie wyciszenie 1 kliknięciem w menu.',
    detailEn: 'Tasteful default volume + instant mute toggle.',
    accent: '#38BDF8',
    icon: Volume2,
  },
  {
    code: 'A-02',
    category: 'audio',
    titlePl: 'Chill Lo-Fi / Arctic Ambient Muzyka w Tle',
    titleEn: 'Chill Lo-Fi / Arctic Ambient Soundtrack',
    descPl: 'Spokojna, relaksująca muzyka w Lobby i energetyczny synth w Obby — osobny suwak Muzyki w opcjach.',
    descEn: 'Relaxing ambient music in Lobby & upbeat synth in Obby with dedicated music slider.',
    detailPl: 'Generowana proceduralnie / ultralekki streaming — zero ciężkich plików przy starcie.',
    detailEn: 'Ultra-lightweight audio with zero startup slowdown.',
    accent: '#A78BFA',
    icon: Music,
  },
  {
    code: 'A-03',
    category: 'audio',
    titlePl: 'Dźwięki Przestrzenne 3D (Fontanna, Portale, Kroki)',
    titleEn: '3D Spatial Audio (Fountain, Portals, Footsteps)',
    descPl: 'Szum wody przy fontannie, delikatny puls energii przy portalu Obby oraz ciche odgłosy kroków zależne od podłoża (marmur, drewno, lód).',
    descEn: 'Distance-based fountain ambience, portal hum, and surface-aware footsteps.',
    detailPl: 'Niesamowicie zwiększa poczucie głębi w świecie 3D.',
    detailEn: 'Massively boosts 3D world immersion.',
    accent: '#22D3EE',
    icon: Headphones,
  },
  {
    code: 'A-04',
    category: 'audio',
    titlePl: 'Mikser Audio (Master / Efekty / Muzyka / Czat)',
    titleEn: 'Full Audio Mixer (Master / SFX / Music / Chat)',
    descPl: '4 niezależne suwaki głośności zapisywane w preferencjach + szybki skrót klawiszowy M-mute.',
    descEn: '4 independent volume sliders saved to preferences.',
    detailPl: 'Pełna kontrola dla każdego gracza na PC i telefonie.',
    detailEn: 'Full control on desktop and mobile.',
    accent: '#34D399',
    icon: Wand2,
  },

  // === 4. PLATFORMA, KOSMETYKI 3D & SPOŁECZNOŚĆ ===
  {
    code: 'P-01',
    category: 'platform',
    titlePl: 'Ślady za Krokami (Trails) & Plecaki / Skrzydła 3D',
    titleEn: '3D Footstep Trails & Wings / Backpacks',
    descPl: 'Nowa kategoria w Szatni awatarów: kolorowe smugi podczas biegu (Lód, Złoty Pył, Tęcza, Neon) oraz akcesoria na plecy 3D!',
    descEn: 'New Wardrobe slot: animated running trails plus 3D wings & backpacks!',
    detailPl: 'Najlepiej sprzedające się i najbardziej pożądane kosmetyki w grach 3D.',
    detailEn: 'The most desirable cosmetic slot in 3D multiplayer games.',
    accent: '#F59E0B',
    badgePl: 'Hit Szatni',
    badgeEn: 'Wardrobe Hit',
    icon: Sparkles,
  },
  {
    code: 'P-02',
    category: 'platform',
    titlePl: 'Pety Towarzyszące 3D (Latające Mini-Kostki / Drony)',
    titleEn: '3D Companion Pets (Floating Cubes / Drones)',
    descPl: 'Urocze, małe 3D towarzysze unoszące się obok ramienia gracza w Lobby i Obby (wyłącznie kosmetyczne, zero P2W).',
    descEn: 'Cute floating 3D companions following your avatar in Lobby & Obby (purely cosmetic).',
    detailPl: 'Świetnie łączą się z ekonomią FreshGems i nagrodami za ukończenie wyzwań.',
    detailEn: 'Pairs great with FreshGems shop and milestone rewards.',
    accent: '#38BDF8',
    icon: Award,
  },
  {
    code: 'P-03',
    category: 'platform',
    titlePl: 'Klany / Gildie ze Wspólnym Tagiem [KLAN]',
    titleEn: 'Clans / Guilds with [TAG]',
    descPl: 'Tworzenie własnego klanu (np. [ICE] rejson59), wspólna lista członków, klanowy ranking punktów i osobny czat klanowy.',
    descEn: 'Create a clan with custom tag, member roster, clan leaderboard & clan chat.',
    detailPl: 'Mocno buduje społeczność i stałych graczy wracających codziennie.',
    detailEn: 'Strong long-term community retention driver.',
    accent: '#A78BFA',
    icon: Users,
  },
  {
    code: 'P-04',
    category: 'platform',
    titlePl: 'Tryb Foto 3D (Photo Mode + Czysty Zrzut PNG)',
    titleEn: '3D Photo Mode (Clean PNG Snapshot)',
    descPl: 'Ukrywa cały HUD, daje wolną kamerę wokół awatara, wybór pozy/emotki i pobiera ostry zrzut ekranu w 1 kliknięcie.',
    descEn: 'Hide all HUD, orbit freely, pick any emote pose, and download a crisp PNG.',
    detailPl: 'Gracze chętnie dzielą się fotkami z Lobby i Podium na Discordzie / TikToku.',
    detailEn: 'Encourages organic sharing on Discord and social media.',
    accent: '#22D3EE',
    icon: Camera,
  },
  {
    code: 'P-05',
    category: 'platform',
    titlePl: 'Automoderacja Czatu + Zgłaszanie Graczy',
    titleEn: 'Chat Auto-Moderation & Player Reporting',
    descPl: 'Filtr wulgaryzmów PL/EN, ochrona antyspamowa (rate-limit), wyciszanie (Mute) i bany czasowe bezpośrednio z Panelu Admina.',
    descEn: 'PL/EN profanity filter, anti-spam rate limit, plus Mute & timed bans in Admin Panel.',
    detailPl: 'Kluczowe bezpieczeństwo przed otwarciem FreshBlox na większą liczbę graczy.',
    detailEn: 'Essential safety layer before scaling public traffic.',
    accent: '#FB7185',
    icon: Shield,
  },
  {
    code: 'P-06',
    category: 'platform',
    titlePl: 'Sezonowe Rankingi TOP 100 z Nagrodami',
    titleEn: 'Seasonal TOP 100 Leaderboards with Rewards',
    descPl: 'Comiesięczne sezony speedrunu Test Obby 100 i aktywności — TOP 3 dostaje ekskluzywną złotą/srebrną/brązową odznakę sezonu!',
    descEn: 'Monthly speedrun & XP seasons with exclusive TOP 3 seasonal trophies.',
    detailPl: 'Podium 3D w Lobby automatycznie odzwierciedla aktualnych mistrzów sezonu.',
    detailEn: 'Lobby 3D Champions Podium syncs live with current season leaders.',
    accent: '#34D399',
    icon: Trophy,
  },
]

const CATEGORIES: Array<{
  id: Wave2Proposal['category']
  titlePl: string
  titleEn: string
  subPl: string
  subEn: string
  accent: string
}> = [
  {
    id: 'economy',
    titlePl: '1. Ekonomia FreshGems & Płatności (E-01 – E-08)',
    titleEn: '1. FreshGems Economy & Monetization (E-01 – E-08)',
    subPl: '100% uczciwy model (zero Pay-to-Win): jak uruchomić FreshGems, Stripe/BLIK, Karnet i darmowe nagrody',
    subEn: '100% fair zero-P2W model: FreshGems ledger, Stripe/BLIK packs, Season Pass & free streaks',
    accent: '#10B981',
  },
  {
    id: 'games',
    titlePl: '2. Nowe Gry i Minigry 3D (G-01 – G-06)',
    titleEn: '2. New 3D Games & Minigames (G-01 – G-06)',
    subPl: 'Kolejne grywalne światy 3D i eventy na żywo w Lobby Głównym',
    subEn: 'Next playable 3D modes and live Lobby events',
    accent: '#38BDF8',
  },
  {
    id: 'audio',
    titlePl: '3. Nowy System Dźwięków 2.0 (A-01 – A-04)',
    titleEn: '3. Next-Gen Audio System 2.0 (A-01 – A-04)',
    subPl: 'Czyste, opcjonalne audio od zera z pełnym mikserem głośności',
    subEn: 'Clean optional audio built from scratch with full mixer controls',
    accent: '#A78BFA',
  },
  {
    id: 'platform',
    titlePl: '4. Kosmetyki 3D, Społeczność & Bezpieczeństwo (P-01 – P-06)',
    titleEn: '4. 3D Cosmetics, Social & Safety (P-01 – P-06)',
    subPl: 'Ślady kroków, pety 3D, klany, tryb foto i automoderacja czatu',
    subEn: 'Footstep trails, 3D pets, clans, photo mode, and chat safety',
    accent: '#F59E0B',
  },
]

export const ProposalsLabPanel: React.FC<ProposalsLabPanelProps> = ({ mode, lang }) => {
  const tokens = getThemeTokens(mode)
  const isDark = mode === 'dark'
  const isPl = lang === 'pl'

  const [selected, setSelected] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_V2)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
    } catch {
      return []
    }
  })
  const [copied, setCopied] = useState(false)
  const [showWave1, setShowWave1] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(selected))
    } catch {
      // ignore
    }
  }, [selected])

  const toggle = (code: string) => {
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
  }

  const copySelected = () => {
    const text = selected.join(', ')
    if (!text) return
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const cardBg = isDark ? 'rgba(11, 19, 35, 0.92)' : '#FFFFFF'
  const borderCol = isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(14, 165, 233, 0.2)'

  return (
    <div className="space-y-6">
      {/* Sticky Wave 2 Selection Header */}
      <div
        className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-xl"
        style={{
          background: isDark ? 'rgba(7, 13, 25, 0.92)' : 'rgba(255, 255, 255, 0.94)',
          borderColor: `${ARCTIC_SKY.skyMain}44`,
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-sm sm:text-base font-extrabold" style={{ color: tokens.textPrimary }}>
                {isPl ? 'Propozycje — Fala 2 (Ekonomia FreshGems, Gry 3D, Audio, Kosmetyki)' : 'Proposals — Wave 2 (FreshGems, 3D Games, Audio, Cosmetics)'}
              </h2>
            </div>
            <p className="text-[11px]" style={{ color: tokens.textSecondary }}>
              {isPl
                ? 'Kliknij karty, które chcesz wdrożyć w kolejnym etapie, skopiuj kody i wyślij je na czacie.'
                : 'Select cards you want in the next release, copy codes, and send them in chat.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-xl border border-sky-400/35 bg-sky-500/15 px-3 py-1.5 font-mono text-xs font-black text-sky-400">
            {selected.length} {isPl ? 'wybrano' : 'selected'}
          </span>
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={copySelected}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 transition hover:bg-sky-400 disabled:opacity-45 cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? (isPl ? 'Skopiowano!' : 'Copied!') : isPl ? 'Kopiuj kody' : 'Copy codes'}</span>
          </button>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected([])}
              title={isPl ? 'Wyczyść wybór' : 'Clear'}
              className="flex h-8 w-8 items-center justify-center rounded-xl border text-slate-400 hover:text-white cursor-pointer"
              style={{ borderColor: borderCol }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Wave 1 Implemented Banner */}
      <div
        className="rounded-2xl border p-4"
        style={{
          background: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.06)',
          borderColor: 'rgba(16, 185, 129, 0.35)',
        }}
      >
        <button
          type="button"
          onClick={() => setShowWave1((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="text-xs sm:text-sm font-extrabold text-emerald-400">
              {isPl
                ? '✅ Fala 1 — Wszystkie 23 wybrane propozycje zostały wdrożone!'
                : '✅ Wave 1 — All 23 selected proposals are live!'}
            </span>
          </div>
          <span className="text-[11px] font-bold text-emerald-300">
            {showWave1 ? (isPl ? 'Ukryj listę' : 'Hide') : isPl ? 'Pokaż szczegóły' : 'Show details'}
          </span>
        </button>

        {showWave1 && (
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {WAVE1_IMPLEMENTED.map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-slate-950/35 px-3 py-1.5 text-[11px] font-semibold text-emerald-100"
              >
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Wave 2 Proposal Sections */}
      {CATEGORIES.map((cat) => {
        const items = WAVE2_PROPOSALS.filter((p) => p.category === cat.id)
        return (
          <section key={cat.id} className="space-y-3">
            <div>
              <h3 className="font-display text-base font-extrabold" style={{ color: tokens.textPrimary }}>
                {isPl ? cat.titlePl : cat.titleEn}
              </h3>
              <p className="text-xs" style={{ color: tokens.textSecondary }}>
                {isPl ? cat.subPl : cat.subEn}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {items.map((item) => {
                const Icon = item.icon
                const isSel = selected.includes(item.code)
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => toggle(item.code)}
                    className="group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 cursor-pointer"
                    style={{
                      background: isSel ? `${item.accent}18` : cardBg,
                      borderColor: isSel ? item.accent : borderCol,
                      boxShadow: isSel ? `0 0 0 1px ${item.accent}66` : undefined,
                    }}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="flex h-8 w-8 items-center justify-center rounded-xl"
                            style={{ background: `${item.accent}22`, color: item.accent }}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span
                            className="rounded-lg px-2 py-0.5 font-mono text-[11px] font-black"
                            style={{ background: `${item.accent}20`, color: item.accent }}
                          >
                            {item.code}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {(isPl ? item.badgePl : item.badgeEn) && (
                            <span className="rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-amber-300">
                              {isPl ? item.badgePl : item.badgeEn}
                            </span>
                          )}
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                              isSel ? 'border-transparent bg-emerald-400 text-slate-950' : 'border-white/20'
                            }`}
                          >
                            {isSel && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs font-extrabold leading-snug" style={{ color: tokens.textPrimary }}>
                        {isPl ? item.titlePl : item.titleEn}
                      </div>

                      <p className="text-[11px] leading-relaxed" style={{ color: tokens.textSecondary }}>
                        {isPl ? item.descPl : item.descEn}
                      </p>
                    </div>

                    <div
                      className="mt-3 border-t pt-2 text-[10px] font-semibold leading-snug"
                      style={{ borderColor: borderCol, color: item.accent }}
                    >
                      {isPl ? item.detailPl : item.detailEn}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
